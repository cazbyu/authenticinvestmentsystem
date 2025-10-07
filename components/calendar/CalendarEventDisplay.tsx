import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Task } from '@/components/tasks/TaskCard';

interface CalendarEventDisplayProps {
  task: Task;
  onDoublePress: (task: Task) => void;
  style?: any;
}

export function CalendarEventDisplay({ task, onDoublePress, style }: CalendarEventDisplayProps) {
  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const getBorderColor = () => {
    if (task.status === "completed") return "#3b82f6";
    if (task.is_urgent && task.is_important) return "#ef4444";
    if (!task.is_urgent && task.is_important) return "#22c55e";
    if (task.is_urgent && !task.is_important) return "#eab308";
    return "#9ca3af";
  };

  return (
    <TouchableOpacity
      style={[
        styles.eventContainer,
        { borderLeftColor: getBorderColor() },
        style
      ]}
      onPress={() => onDoublePress(task)}
      activeOpacity={0.8}
    >
      <View style={styles.eventContent}>
        <Text style={styles.eventTitle} numberOfLines={2}>
          {task.title}
        </Text>
        {task.start_time && task.end_time && (
          <Text style={styles.eventTime}>
            {formatTime(task.start_time)} - {formatTime(task.end_time)}
          </Text>
        )}
        {task.start_time && !task.end_time && (
          <Text style={styles.eventTime}>
            {formatTime(task.start_time)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  eventContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    borderLeftWidth: 4,
    padding: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 16,
    marginBottom: 2,
  },
  eventTime: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
});