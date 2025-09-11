import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase';

// Format a date to YYYY-MM-DD for Supabase
const toDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to get Monday as the start of the week
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Adjust when day is Sunday (0) to get previous Monday
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper to add days to a date
function addDays(date: Date, amount: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

export function WeeklyGoalNavigator() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();

  // Use raw date from params or today's date if none provided
  const baseDate = useMemo(() => {
    if (typeof params.date === 'string') {
      const parsed = new Date(params.date);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  }, [params.date]);

  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCurrentWeek = async () => {
      setLoading(true);
      try {
        const supabase = getSupabaseClient();
        const { data: weekData, error: weekError } = await supabase
          .from('v_user_cycle_weeks')
          .select('start_date, end_date')
          .lte('start_date', toDateString(baseDate))
          .gte('end_date', toDateString(baseDate))
          .single();

        if (weekError || !weekData) {
          throw weekError || new Error('Week not found');
        }

        setWeekStart(new Date(weekData.start_date));
        setError(null);
      } catch {
        setWeekStart(startOfWeek(baseDate));
        setError('Unable to load current week.');
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentWeek();
  }, [baseDate]);

  const weekEnd = useMemo(() => (weekStart ? addDays(weekStart, 6) : null), [weekStart]);
  const weekLabel = useMemo(() => {
    if (!weekStart || !weekEnd) return '';
    const options = { month: 'long', day: 'numeric' } as const;
    return `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}`;
  }, [weekStart, weekEnd]);

  const days = useMemo(() => {
    if (!weekStart) return [] as Date[];
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const goToPreviousWeek = () => {
    if (!weekStart) return;
    const newStart = addDays(weekStart, -7);
    setWeekStart(newStart);
    router.setParams({ date: toDateString(newStart) });
  };

  const goToNextWeek = () => {
    if (!weekStart) return;
    const newStart = addDays(weekStart, 7);
    setWeekStart(newStart);
    router.setParams({ date: toDateString(newStart) });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading current week…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.navigation}>
        <TouchableOpacity onPress={goToPreviousWeek} style={styles.navButton}>
          <Text style={styles.navButtonText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        <TouchableOpacity onPress={goToNextWeek} style={styles.navButton}>
          <Text style={styles.navButtonText}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.daysRow}>
        {days.map((day) => (
          <View key={day.toISOString()} style={styles.dayItem}>
            <Text style={styles.dayLabel}>
              {day.toLocaleDateString('en-US', { weekday: 'short' })}
            </Text>
            <Text style={styles.dayNumber}>{day.getDate()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    backgroundColor: '#ffffff',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  navButton: {
    padding: 8,
  },
  navButtonText: {
    fontSize: 18,
    color: '#0078d4',
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  dayItem: {
    alignItems: 'center',
    flex: 1,
  },
  dayLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  errorText: {
    color: '#b91c1c',
    paddingHorizontal: 16,
  },
});

