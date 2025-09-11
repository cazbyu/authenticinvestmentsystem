import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase';

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
  const params = useLocalSearchParams<{ weekStart?: string }>();

  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [weekEnd, setWeekEnd] = useState<Date | null>(null);

  // Format a date as YYYY-MM-DD for query parameters
  const toDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const fetchWeek = async () => {
      // Determine which date to query
      let baseDate: Date;
      if (params.weekStart) {
        baseDate = new Date(params.weekStart as string);
      } else {
        baseDate = startOfWeek(new Date());
      }

      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('v_user_cycle_weeks')
          .select('start_date,end_date')
          .eq('start_date', toDateString(baseDate))
          .single();

        if (error || !data) {
          throw error || new Error('No week data');
        }

        setWeekStart(new Date(data.start_date));
        setWeekEnd(new Date(data.end_date));
      } catch (err) {
        console.error('Error fetching week data:', err);
        // Fallback to local calculation if anything goes wrong
        const localStart = startOfWeek(baseDate);
        setWeekStart(localStart);
        setWeekEnd(addDays(localStart, 6));
      }
    };

    fetchWeek();
  }, [params.weekStart]);

  const weekLabel = useMemo(() => {
    if (!weekStart || !weekEnd) return '';
    const options = { month: 'long', day: 'numeric' } as const;
    return `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}`;
  }, [weekStart, weekEnd]);

  const days = useMemo(() => {
    if (!weekStart) return [];
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const updateWeekParam = (date: Date) => {
    router.setParams({ weekStart: toDateString(date) });
  };

  const goToPreviousWeek = () => {
    if (!weekStart) return;
    updateWeekParam(addDays(weekStart, -7));
  };

  const goToNextWeek = () => {
    if (!weekStart) return;
    updateWeekParam(addDays(weekStart, 7));
  };

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
});

