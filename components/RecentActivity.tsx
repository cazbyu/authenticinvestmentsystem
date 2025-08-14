import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';

const mockActivity = [
  {
    id: '1',
    type: 'deposit',
    title: 'Quality time with family',
    category: 'Spouse/Partner',
    amount: '+15 points',
    time: '2 hours ago',
    color: '#16a34a',
  },
  {
    id: '2',
    type: 'withdrawal',
    title: 'Missed workout session',
    category: 'Physical Health',
    amount: '-8 points',
    time: '4 hours ago',
    color: '#dc2626',
  },
  {
    id: '3',
    type: 'deposit',
    title: 'Completed project milestone',
    category: 'Complete Master\'s Degree',
    amount: '+25 points',
    time: '1 day ago',
    color: '#16a34a',
  },
];

export function RecentActivity() {
  return (
    <View style={styles.container}>
      {mockActivity.map((activity, index) => (
        <View
          key={activity.id}
          style={[
            styles.activityItem,
            index === 0 && styles.firstItem,
            index === mockActivity.length - 1 && styles.lastItem,
          ]}
        >
          <View style={styles.iconContainer}>
            {activity.type === 'deposit' ? (
              <Plus size={16} color="#ffffff" />
            ) : (
              <Minus size={16} color="#ffffff" />
            )}
          </View>
          
          <View style={styles.content}>
            <Text style={styles.activityTitle} numberOfLines={1}>
              {activity.title}
            </Text>
            <Text style={styles.category} numberOfLines={1}>
              {activity.category}
            </Text>
          </View>
          
          <View style={styles.rightContent}>
            <Text style={[styles.amount, { color: activity.color }]}>
              {activity.amount}
            </Text>
            <Text style={styles.time}>{activity.time}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  firstItem: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  lastItem: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0078d4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  category: {
    fontSize: 12,
    color: '#6b7280',
  },
  rightContent: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  time: {
    fontSize: 12,
    color: '#9ca3af',
  },
});