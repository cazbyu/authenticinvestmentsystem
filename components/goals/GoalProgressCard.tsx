import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Target, Calendar, Plus, TrendingUp } from 'lucide-react-native';
import { TwelveWeekGoal, GoalProgress } from '@/hooks/useGoalProgress';

interface GoalProgressCardProps {
  goal: TwelveWeekGoal;
  progress: GoalProgress;
  onAddTask?: () => void;
  onPress?: () => void;
  compact?: boolean;
}

export function GoalProgressCard({ 
  goal, 
  progress, 
  onAddTask, 
  onPress, 
  compact = false 
}: GoalProgressCardProps) {
  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return '#16a34a';
    if (percentage >= 60) return '#eab308';
    return '#dc2626';
  };

  const getWeeklyProgressColor = (actual: number, target: number) => {
    const percentage = target > 0 ? (actual / target) * 100 : 0;
    return getProgressColor(percentage);
  };

  const formatWeeklyProgress = (actual: number, target: number) => {
    return `${actual}/${target}`;
  };

  const primaryRole = goal.roles?.[0];
  const cardColor = primaryRole?.color || '#0078d4';

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactCard, { borderLeftColor: cardColor }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.compactContent}>
          <View style={styles.compactHeader}>
            <Text style={styles.compactTitle} numberOfLines={1}>
              {goal.title}
            </Text>
            {onAddTask && (
              <TouchableOpacity
                style={[styles.addTaskButton, { backgroundColor: cardColor }]}
                onPress={onAddTask}
              >
                <Plus size={12} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.compactMetrics}>
            <View style={styles.compactMetric}>
              <Text style={styles.compactMetricLabel}>Week {progress.currentWeek}</Text>
              <Text style={[
                styles.compactMetricValue,
                { color: getWeeklyProgressColor(progress.weeklyActual, progress.weeklyTarget) }
              ]}>
                {formatWeeklyProgress(progress.weeklyActual, progress.weeklyTarget)}
              </Text>
            </View>
            
            <View style={styles.compactMetric}>
              <Text style={styles.compactMetricLabel}>Overall</Text>
              <Text style={[
                styles.compactMetricValue,
                { color: getProgressColor(progress.overallProgress) }
              ]}>
                {progress.overallProgress}%
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: cardColor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.cardContent}>
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <View style={[styles.iconContainer, { backgroundColor: cardColor }]}>
              <Target size={20} color="#ffffff" />
            </View>
            <View style={styles.titleContent}>
              <Text style={styles.title} numberOfLines={2}>
                {goal.title}
              </Text>
              <Text style={styles.subtitle}>
                Week {progress.currentWeek} • {progress.daysRemaining} days left
              </Text>
            </View>
          </View>
          
          {onAddTask && (
            <TouchableOpacity
              style={[styles.addTaskButtonLarge, { backgroundColor: cardColor }]}
              onPress={onAddTask}
            >
              <Plus size={16} color="#ffffff" />
              <Text style={styles.addTaskButtonText}>Task</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Leading Indicator: Weekly Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>This Week (Leading)</Text>
            <Text style={[
              styles.progressValue,
              { color: getWeeklyProgressColor(progress.weeklyActual, progress.weeklyTarget) }
            ]}>
              {formatWeeklyProgress(progress.weeklyActual, progress.weeklyTarget)}
            </Text>
          </View>
          
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, (progress.weeklyActual / Math.max(1, progress.weeklyTarget)) * 100)}%`,
                  backgroundColor: getWeeklyProgressColor(progress.weeklyActual, progress.weeklyTarget),
                }
              ]}
            />
          </View>
        </View>

        {/* Lagging Indicator: Overall Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Overall (Lagging)</Text>
            <Text style={[
              styles.progressValue,
              { color: getProgressColor(progress.overallProgress) }
            ]}>
              {progress.overallActual}/{progress.overallTarget} ({progress.overallProgress}%)
            </Text>
          </View>
          
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress.overallProgress}%`,
                  backgroundColor: getProgressColor(progress.overallProgress),
                }
              ]}
            />
          </View>
        </View>

        {/* Tags */}
        {(goal.roles?.length > 0 || goal.domains?.length > 0) && (
          <View style={styles.tagsSection}>
            {goal.roles?.slice(0, 2).map(role => (
              <View key={role.id} style={[styles.tag, styles.roleTag]}>
                <Text style={styles.tagText}>{role.label}</Text>
              </View>
            ))}
            {goal.domains?.slice(0, 2).map(domain => (
              <View key={domain.id} style={[styles.tag, styles.domainTag]}>
                <Text style={styles.tagText}>{domain.name}</Text>
              </View>
            ))}
            {(goal.roles?.length > 2 || goal.domains?.length > 2) && (
              <View style={[styles.tag, styles.moreTag]}>
                <Text style={styles.tagText}>
                  +{(goal.roles?.length || 0) + (goal.domains?.length || 0) - 4}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 12,
    width: '48%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  compactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderLeftWidth: 3,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
    padding: 16,
  },
  compactContent: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 22,
    marginBottom: 4,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  addTaskButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addTaskButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTaskButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  compactMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compactMetric: {
    alignItems: 'center',
  },
  compactMetricLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 2,
  },
  compactMetricValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleTag: {
    backgroundColor: '#fce7f3',
    borderColor: '#f3e8ff',
  },
  domainTag: {
    backgroundColor: '#fed7aa',
    borderColor: '#fdba74',
  },
  moreTag: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#374151',
  },
});