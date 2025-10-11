import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, InteractionManager } from 'react-native';
import { TaskCard, Task } from '@/components/tasks/TaskCard';
import { CalendarEventDisplay } from '@/components/calendar/CalendarEventDisplay';
import { formatLocalDate } from '@/lib/dateUtils';

const MINUTE_HEIGHT = 1.5;
const HOUR_HEIGHT = 60 * MINUTE_HEIGHT;
const COLUMN_GUTTER = 4;

interface HourlyCalendarGridProps {
  selectedDate: string;
  expandedTasks: Task[];
  currentTimePosition: number;
  currentTimeString: string;
  onCompleteTask: (taskId: string) => void;
  onTaskDoublePress: (task: Task) => void;
  viewMode?: 'daily' | 'weekly' | 'monthly';
}

const uniqByIdAndDate = <T extends { id: string; start_date?: string; due_date?: string; occurrence_date?: string }>(arr: T[]) => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const dateKey = (item as any).occurrence_date || (item as any).date || item.start_date || item.due_date || '';
    const k = `${item.id}::${dateKey}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
};

const getTimeInMinutes = (timeString: string) => {
  const date = new Date(timeString);
  return date.getHours() * 60 + date.getMinutes();
};

const calculateEventLayout = (events: Task[]) => {
  if (events.length === 0) return [];

  const sortedEvents = [...events].sort((a, b) => {
    const aStart = getTimeInMinutes(a.start_time!);
    const bStart = getTimeInMinutes(b.start_time!);
    return aStart - bStart;
  });

  const eventsWithLayout = sortedEvents.map(event => ({
    ...event,
    startMinutes: getTimeInMinutes(event.start_time!),
    endMinutes: getTimeInMinutes(event.end_time!),
    column: 0,
    maxColumns: 1,
  }));

  const columns: number[] = [];

  for (const event of eventsWithLayout) {
    let assignedColumn = -1;
    for (let i = 0; i < columns.length; i++) {
      if (columns[i] <= event.startMinutes) {
        assignedColumn = i;
        break;
      }
    }

    if (assignedColumn === -1) {
      assignedColumn = columns.length;
      columns.push(event.endMinutes);
    } else {
      columns[assignedColumn] = event.endMinutes;
    }

    event.column = assignedColumn;
  }

  for (const event of eventsWithLayout) {
    let maxOverlaps = 1;

    const overlappingEvents = eventsWithLayout.filter(other =>
      other !== event &&
      other.startMinutes < event.endMinutes &&
      other.endMinutes > event.startMinutes
    );

    const allOverlappingEvents = [event, ...overlappingEvents];
    maxOverlaps = Math.max(...allOverlappingEvents.map(e => e.column)) + 1;
    event.maxColumns = maxOverlaps;
  }

  return eventsWithLayout;
};

export function HourlyCalendarGrid({
  selectedDate,
  expandedTasks,
  currentTimePosition,
  currentTimeString,
  onCompleteTask,
  onTaskDoublePress,
  viewMode = 'daily',
}: HourlyCalendarGridProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [viewportH, setViewportH] = useState(0);
  const [hasScrolledToNow, setHasScrolledToNow] = useState(false);
  const [timeGridWidth, setTimeGridWidth] = useState(0);

  const today = formatLocalDate(new Date());
  const normalizedDate = selectedDate.split('T')[0];
  const isToday = normalizedDate === today;

  useEffect(() => {
    if (hasScrolledToNow) return;
    if (!scrollRef.current || viewportH <= 0) return;

    const contentH = 24 * 60 * MINUTE_HEIGHT;
    let targetY = 0;

    if (isToday) {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      const currentTimeY = minutes * MINUTE_HEIGHT;

      targetY = currentTimeY - viewportH / 2;
      if (targetY < 0) targetY = 0;
      if (targetY > contentH - viewportH) targetY = Math.max(0, contentH - viewportH);
    } else {
      const eightAM = 8 * 60 * MINUTE_HEIGHT;
      targetY = eightAM;
      if (targetY > contentH - viewportH) targetY = Math.max(0, contentH - viewportH);
    }

    const cancel = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: targetY, animated: false });
        setHasScrolledToNow(true);
      });
    });

    return () => cancel && (cancel as any).done === false && (cancel as any).cancel?.();
  }, [selectedDate, viewportH, hasScrolledToNow, isToday, viewMode]);

  useEffect(() => {
    setHasScrolledToNow(false);
  }, [selectedDate, viewMode]);

  const allDayItems = expandedTasks.filter(task =>
    !task.start_time || !task.end_time || task.is_all_day
  );

  const timedEvents = expandedTasks.filter(task =>
    task.start_time && task.end_time && !task.is_all_day
  );

  const eventsWithLayout = calculateEventLayout(timedEvents);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <View style={styles.container}>
      {allDayItems.length > 0 && (
        <View style={styles.allDaySection}>
          <Text style={styles.allDayLabel}>All Day</Text>
          <View style={styles.allDayEvents}>
            {uniqByIdAndDate(allDayItems).map((task, idx) => (
              <TaskCard
                key={`${task.id}-${task.start_date || task.due_date || selectedDate}-${task.type || 'task'}-${idx}`}
                task={task}
                onComplete={onCompleteTask}
                onDoublePress={onTaskDoublePress}
              />
            ))}
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
        style={styles.hoursScrollView}
        showsVerticalScrollIndicator
      >
        <View
          style={[styles.timeGrid, { height: 24 * HOUR_HEIGHT }]}
          onLayout={(event) => {
            const { width } = event.nativeEvent.layout;
            setTimeGridWidth(width - 70);
          }}
        >
          {hours.map(hour => (
            <View key={hour} style={[styles.hourSlot, { height: HOUR_HEIGHT }]}>
              <Text style={styles.hourLabel}>
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </Text>
              <View style={styles.hourLine} />
              <View style={[styles.quarterHourLine, { top: HOUR_HEIGHT * 0.25 }]} />
              <View style={[styles.halfHourLine, { top: HOUR_HEIGHT * 0.5 }]} />
              <Text style={[styles.halfHourLabel, { top: HOUR_HEIGHT * 0.5 }]}>
                :30
              </Text>
              <View style={[styles.quarterHourLine, { top: HOUR_HEIGHT * 0.75 }]} />
            </View>
          ))}

          {eventsWithLayout.map((event, idx) => {
            const top = event.startMinutes * MINUTE_HEIGHT;
            const heightPx = Math.max((event.endMinutes - event.startMinutes) * MINUTE_HEIGHT, 30);
            const availableWidth = timeGridWidth > 0 ? timeGridWidth - 16 : 200;
            const colWidth = (availableWidth - (event.maxColumns - 1) * COLUMN_GUTTER) / event.maxColumns;
            const leftOffset = event.column * (colWidth + COLUMN_GUTTER);

            return (
              <CalendarEventDisplay
                key={`${event.id}-${event.start_time || ''}-${event.end_time || ''}-${selectedDate}-${event.type}-${idx}`}
                task={event}
                onDoublePress={onTaskDoublePress}
                style={{
                  position: 'absolute',
                  top,
                  height: heightPx,
                  left: 70 + leftOffset,
                  width: colWidth,
                  zIndex: 1,
                }}
              />
            );
          })}

          {isToday && (
            <View style={[styles.currentTimeLine, { top: currentTimePosition }]}>
              <View style={styles.currentTimeDot} />
              <View style={styles.currentTimeLineBar} />
              <View style={styles.currentTimeLabel}>
                <Text style={styles.currentTimeLabelText}>
                  {currentTimeString}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 240,
  },
  allDaySection: {
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    padding: 12,
  },
  allDayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  allDayEvents: {
    gap: 8,
  },
  hoursScrollView: {
    flex: 1,
  },
  timeGrid: {
    position: 'relative',
    paddingLeft: 8,
  },
  hourSlot: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourLabel: {
    width: 60,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    paddingRight: 8,
    position: 'absolute',
    left: 0,
    top: -6,
  },
  halfHourLabel: {
    width: 60,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    paddingRight: 8,
    position: 'absolute',
    left: 0,
    top: -6,
  },
  hourLine: {
    position: 'absolute',
    left: 70,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  quarterHourLine: {
    position: 'absolute',
    left: 70,
    right: 0,
    height: 1,
    backgroundColor: '#e5e7eb',
    opacity: 0.8,
  },
  halfHourLine: {
    position: 'absolute',
    left: 70,
    right: 0,
    height: 1,
    backgroundColor: '#d1d5db',
    opacity: 0.9,
  },
  currentTimeLine: {
    position: 'absolute',
    left: 70,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
    marginRight: 4,
  },
  currentTimeLineBar: {
    flex: 1,
    height: 2,
    backgroundColor: '#dc2626',
    marginRight: 8,
  },
  currentTimeLabel: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  currentTimeLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#dc2626',
  },
});
