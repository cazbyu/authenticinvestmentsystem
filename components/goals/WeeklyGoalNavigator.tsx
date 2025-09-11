import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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
  const initialStart = startOfWeek(new Date());
  const [weekStart, setWeekStart] = useState<Date>(() => initialStart);
  const [weekEnd, setWeekEnd] = useState<Date>(() => addDays(initialStart, 6));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCurrentWeek = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/current-week');
        if (!res.ok) throw new Error('Failed to fetch current week');
        const data = await res.json();
        const startDate = new Date(`${data.start_date}T00:00:00Z`);
        const endDate = new Date(`${data.end_date}T00:00:00Z`);
        setWeekStart(startDate);
        setWeekEnd(endDate);
        setError(null);
      } catch (err) {
        setError('Unable to load current week.');
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentWeek();
  }, []);

  const weekLabel = useMemo(() => {
    const options = { month: 'long', day: 'numeric' } as const;
    return `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}`;
  }, [weekStart, weekEnd]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const goToPreviousWeek = () => {
    const newStart = addDays(weekStart, -7);
    setWeekStart(newStart);
    setWeekEnd(addDays(newStart, 6));
  };
  const goToNextWeek = () => {
    const newStart = addDays(weekStart, 7);
    setWeekStart(newStart);
    setWeekEnd(addDays(newStart, 6));
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

