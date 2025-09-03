import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Target, Calendar, Plus, TrendingUp, Check } from 'lucide-react-native';
import { TwelveWeekGoal, GoalProgress } from '@/hooks/useGoalProgress';

interface WeekData {
  weekNumber: number;
  startDate: string;
  endDate: string;
}

interface TaskWithLogs {
  id: string;
  title: string;
  input_kind?: string;
  logs: Array<{ log_date: string; completed: boolean }>;
  weeklyActual: number;
  weeklyTarget: number;
}

interface GoalProgressCardProps {
  goal: TwelveWeekGoal;
  progress: GoalProgress;
  week?: WeekData | null;
  weekActions?: TaskWithLogs[];
  loadingWeekActions?: boolean;
  onAddAction?: () => void; // Renamed from onAddTask
  onToggleToday?: (actionId: string, completed: boolean) => Promise<void>;
  onPress?: () => void;
  compact?: boolean;
}

export function GoalProgressCard({ 
  goal, 
  progress, 
  week,
  weekActions = [],
  loadingWeekActions = false,
  onAddAction,
  onToggleToday,  // <-- add this
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

  const primaryRole = goal.roles?.[0]; // Used for card color
  const cardColor = primaryRole?.color || '#0078d4';

  const generateWeekDays = (startDate: string, endDate: string, weekStartDay: 'sunday' | 'monday' = 'sunday') => {
    const days = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Generate 7 days starting from the week start
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);

      if (day <= end) {
        days.push({
          date: day.toISOString().split('T')[0],
          dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getDay()],
          dayOfWeek: day.getDay(),
        });
      }
    }
    
    return days;
  };

  const calculateWeeklyProgress = () => {
    if (!week || weekActions.length === 0) {
      return { actual: progress.weeklyActual, target: progress.weeklyTarget };
    }
    
    const totalActual = weekActions.reduce((sum, action) => sum + action.weeklyActual, 0);
    const totalTarget = weekActions.reduce((sum, action) => sum + action.weeklyTarget, 0);
    
    return { actual: totalActual, target: totalTarget };
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactCard, { borderLeftColor: cardColor }]}
        onPress={onPress}
        activeOpacity={onPress ? 0.8 : 1}
      >
        <View style={styles.compactContent}>
          <View style={styles.compactHeader}>
            <Text style={styles.compactTitle} numberOfLines={1}>
              {goal.title}
            </Text>
            {onAddAction && (
              <TouchableOpacity
                style={[styles.addTaskButton, { backgroundColor: cardColor }]}
                onPress={onAddAction}
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

  const weeklyProgress = calculateWeeklyProgress();

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: cardColor }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
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
          
          {/* Removed the large "Task" button as per new requirements */}
          {/* onAddTask && (
            <TouchableOpacity
              style={[styles.addTaskButtonLarge, { backgroundColor: cardColor }]}
              onPress={onAddTask}
            >
              <Plus size={16} color="#ffffff" />
              <Text style={styles.addTaskButtonText}>Task</Text>
            </TouchableOpacity> */}
        </View>

        {/* Leading Indicator: Weekly Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>This Week (Leading)</Text>
            <Text style={[
              styles.progressValue,
              { color: getWeeklyProgressColor(weeklyProgress.actual, weeklyProgress.target) }
            ]}>
              {formatWeeklyProgress(weeklyProgress.actual, weeklyProgress.target)}
            </Text>
          </View>
          
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, (weeklyProgress.actual / Math.max(1, weeklyProgress.target)) * 100)}%`,
                  backgroundColor: getWeeklyProgressColor(weeklyProgress.actual, weeklyProgress.target),
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

        {/* Week-specific Actions (when week prop is provided) */}
        {week && (
          <View style={styles.weekActionsSection}>
            <View style={styles.weekActionsHeader}>
              <Text style={styles.weekActionsTitle}>
                Week {week.weekNumber} Actions
              </Text>
              {onAddAction && (
                <TouchableOpacity
                  style={[styles.addActionButton, { borderColor: cardColor }]}
                  onPress={onAddAction}
                >
                  <Plus size={12} color={cardColor} />
                  <Text style={[styles.addActionButtonText, { color: cardColor }]}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {loadingWeekActions ? (
              <View style={styles.loadingActions}>
                <ActivityIndicator size="small" color={cardColor} />
                <Text style={styles.loadingActionsText}>Loading actions...</Text>
              </View>
            ) : weekActions.length === 0 && onAddAction ? (
              <View style={styles.emptyActions}>
                <Text style={styles.emptyActionsText}>No actions this week</Text>
                {onAddAction && (
                  <TouchableOpacity
                    style={[styles.addActionButton, { borderColor: cardColor }]}
                    onPress={onAddAction}
                  >
                    <Plus size={12} color={cardColor} />
                    <Text style={[styles.addActionButtonText, { color: cardColor }]}>Add action</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.actionsList}>
                {/* Day labels above circles */}
                <View style={styles.dayLabelsRow}>
                  {generateWeekDays(week.startDate, week.endDate, goal.user_cycle_id ? (goal as any).user_cycle_week_start_day : 'sunday').map(day => (
                    <Text key={day.date} style={styles.dayLabelText}>
                      {day.dayName}
                    </Text>
                  ))}
                </View>

                {weekActions.map(action => {
                  const weekDays = generateWeekDays(week.startDate, week.endDate, goal.user_cycle_id ? (goal as any).user_cycle_week_start_day : 'sunday');

                  return (
                    <View key={action.id} style={styles.actionItem}>
                      <View style={styles.actionHeader}>
                        <Text style={styles.actionTitle} numberOfLines={1}>
                          {action.title}
                        </Text>
                        {action.input_kind === 'count' && (
                          <Text style={styles.actionCount}>
                            {action.weeklyActual}/{action.weeklyTarget}
                          </Text>
                        )}
                      </View>
                      
                      <View style={styles.dayDots}>
                        {weekDays.map(day => {
                          const hasLog = action.logs.some(log => 
                            log.log_date === day.date && log.completed
                          );

                              const todayISO = new Date().toISOString().split('T')[0];
    const isToday = day.date === todayISO;

    if (isToday && onToggleToday) {
      return (
        <TouchableOpacity
          key={day.date}
          activeOpacity={0.8}
          onPress={async () => {
            // If a log exists for today → uncheck (undo); else → complete (check)
            await onToggleToday(action.id, hasLog);
          }}
          style={[styles.dayDot, hasLog && styles.dayDotCompleted]}
        >
          {hasLog && <Check size={12} color="#ffffff" />}
        </TouchableOpacity>
      );
    }

    // All non-today dates stay as static dots
    return (
      <View
        key={day.date}
        style={[styles.dayDot, hasLog && styles.dayDotCompleted]}
      >
        {hasLog && <Check size={12} color="#ffffff" />}
      </View>
    );

                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

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
    width: 28, // Slightly larger for better touch target
    height: 28,
    borderRadius: 14,
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
  weekActionsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  weekActionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  weekActionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  addActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  addActionButtonText: {
    fontSize: 10,
    fontWeight: '600',
  },
  loadingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadingActionsText: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyActions: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  emptyActionsText: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  actionsList: {
    gap: 8,
  },
  actionItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    padding: 8,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  actionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  dayDots: {
    flexDirection: 'row', // Changed from 'row' to 'row'
    gap: 8, // Increased gap for better spacing
    justifyContent: 'center',
  },
  dayLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8, // Match gap with dayDots
    marginBottom: 4, // Space between labels and circles
  },
  dayLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    width: 20, // Fixed width to align with circles
    textAlign: 'center',
  },
  dayDot: {
    width: 20, // Fixed width for circles
    height: 20, // Fixed height for circles
    borderRadius: 10, // Half of width/height for perfect circle
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', // Empty circle
    borderWidth: 1, // Outline
    borderColor: '#6b7280', // Gray outline
  },
  dayDotCompleted: {
    backgroundColor: '#1f2937', // Filled dark circle
    borderColor: '#1f2937', // Match border color
  },
});