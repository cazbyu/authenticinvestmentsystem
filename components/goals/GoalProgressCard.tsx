import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Target, Calendar, Plus, TrendingUp, Check, CreditCard as Edit } from 'lucide-react-native';
import { GoalProgress } from '@/hooks/useGoalProgress';
import { parseLocalDate, formatLocalDate } from '@/lib/dateUtils';

interface WeekData {
  weekNumber: number;
  startDate: string;
  endDate: string;
}

interface TaskWithLogs {
  id: string;
  title: string;
  input_kind?: string;
  logs: Array<{
    measured_on: string;   // ✅ correct field
    week_number: number;   // ✅ optional but available
    day_of_week?: number;  // ✅ nullable in schema
    value: number;         // ✅ numeric, default 1
    completed: boolean;    // ✅ derive from value > 0
  }>;
  weeklyActual: number;
  weeklyTarget: number;
}

interface GoalProgressCardProps {
  goal: Goal;
  progress: GoalProgress;
  expanded?: boolean;
  week?: WeekData | null;
  weekActions?: TaskWithLogs[];
  loadingWeekActions?: boolean;
  onAddAction?: () => void; // Renamed from onAddTask
  onToggleCompletion?: (actionId: string, date: string, completed: boolean) => Promise<void>;
  onEdit?: () => void; // New onEdit prop
  onPress?: () => void;
  compact?: boolean;
  selectedWeekNumber?: number;
  onEditAction?: (action: TaskWithLogs) => void; // New prop for editing actions
}

export function GoalProgressCard({
  goal,
  progress,
  expanded = true,
  week,
  weekActions: weekActionsProp,
  loadingWeekActions = false,
  onAddAction,
  onToggleCompletion,
  onEdit, // New prop
  onPress,
  compact = false,
  selectedWeekNumber
  onEditAction, // New prop
}: GoalProgressCardProps) {
  const weekActions = weekActionsProp ?? [];
  const getProgressColor = (percentage: number) => {
    if (percentage >= 85) return '#16a34a'; // Green for 85% and above
    if (percentage >= 60) return '#eab308';
    return '#dc2626';
  };

  const getWeeklyProgressColor = (actual: number, target: number) => {
    const percentage = target > 0 ? (actual / target) * 100 : 0;
    return getProgressColor(percentage);
  };

  const formatWeeklyProgress = (actual: number, target: number) => {
    const percentage = target > 0 ? Math.round((actual / target) * 100) : 0;
    return `${percentage}%`;
  };

  const formatTodayInfo = () => {
    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = dayNames[today.getDay()];
    const monthName = monthNames[today.getMonth()];
    const dayNumber = today.getDate();
    
    return `${monthName} ${dayNumber} (${dayName})`;
  };

  const getGoalTypeLabel = () => {
    if (goal.goal_type === 'custom') {
      const startDate = parseLocalDate(goal.start_date);
      const endDate = parseLocalDate(goal.end_date);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return 'Invalid date range';
      }
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const totalWeeks = Math.ceil(totalDays / 7);
      return `${totalWeeks}-Week Custom Goal`;
    }
    return `Week ${selectedWeekNumber || progress.currentWeek}`;
  };
  const primaryRole = goal.roles?.[0]; // Used for card color
  const cardColor = primaryRole?.color || '#0078d4';

  const generateWeekDays = (startDateString: string) => {
    const days = [];
    const start = parseLocalDate(startDateString); // Use parseLocalDate to avoid timezone shifts

    if (isNaN(start.getTime())) {
      console.warn('Invalid start date provided to generateWeekDays:', startDateString);
      return days;
    }

    // Generate 7 consecutive days starting from the provided start date
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i); // Add i days to get each day of the week

      days.push({
        date: formatLocalDate(day),
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getDay()],
        dayOfWeek: day.getDay(),
      });
    }

    return days;
  };

  const calculateWeeklyProgress = () => {
    if (!week || weekActions.length === 0) {
      return { actual: progress.weeklyActual, target: progress.weeklyTarget };
    }
    
    const totalActual = weekActions.reduce((sum, action) => sum + Math.min(action.weeklyActual, action.weeklyTarget), 0);
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
              <Text style={styles.compactMetricLabel}>Week {selectedWeekNumber || progress.currentWeek}</Text>
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
  const hasWeekContext = !!week;
  const hasWeekActionsProvided = weekActionsProp !== undefined;
  const shouldShowWeeklyProgress =
    hasWeekContext ||
    hasWeekActionsProvided ||
    typeof progress.weeklyTarget === 'number' ||
    typeof progress.weeklyActual === 'number';
  const shouldRenderWeekActions =
    expanded &&
    hasWeekContext &&
    (hasWeekActionsProvided || weekActions.length > 0 || loadingWeekActions || !!onAddAction);

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
                {getGoalTypeLabel()}
              </Text>
            </View>
          </View>
          
          {onEdit && (
            <TouchableOpacity style={styles.editButton} onPress={onEdit}>
              <Edit size={16} color="#6b7280" />
            </TouchableOpacity>
          )}
          
          {/* Individual Goal Total Score */}
          <View style={styles.goalTotalScore}>
            <Text style={[
              styles.goalTotalScoreText,
              { color: getProgressColor(progress.overallProgress) }
            ]}>
              Total {progress.overallProgress}%
            </Text>
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
        {shouldShowWeeklyProgress && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>This Week (Leading)</Text>
              <Text
                style={[
                  styles.progressValue,
                  { color: getWeeklyProgressColor(weeklyProgress.actual, weeklyProgress.target) }
                ]}
              >
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
        )}

        {/* Custom Goal Date Range */}
        {goal.goal_type === 'custom' && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Timeline</Text>
              <Text style={styles.progressValue}>
                {(() => {
                  const startDate = parseLocalDate(goal.start_date);
                  const endDate = parseLocalDate(goal.end_date);
                  const now = new Date();
                  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    return 'Invalid dates';
                  }
                  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                  return `${daysRemaining}/${totalDays} days`;
                })()}
              </Text>
            </View>
            
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(() => {
                      const startDate = parseLocalDate(goal.start_date);
                      const endDate = parseLocalDate(goal.end_date);
                      const now = new Date();
                      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                        return 0;
                      }
                      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                      const daysPassed = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
                      return Math.min(100, (daysPassed / totalDays) * 100);
                    })()}%`,
                    backgroundColor: '#0078d4',
                  }
                ]}
              />
            </View>
          </View>
        )}

        {/* Week-specific Actions (when week prop is provided) */}
        {shouldRenderWeekActions && week && (
          <View style={styles.weekActionsSection}>
            <View style={styles.weekActionsHeader}>
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
                {weekActions.map(action => {
                  const weekDays = generateWeekDays(week.startDate);

                  return (
                    <TouchableOpacity 
                      key={action.id} 
                      style={styles.actionItem}
                      onPress={onEditAction ? () => onEditAction(action) : undefined}
                      activeOpacity={onEditAction ? 0.7 : 1}
                    >
                      <View style={styles.actionHeader}>
                        <Text style={styles.actionTitle} numberOfLines={1}>
                          {action.title}
                        </Text>
                        {action.input_kind === 'count' && (
                          <Text style={styles.actionCount}>
                            {Math.min(action.weeklyActual, action.weeklyTarget)}/{action.weeklyTarget}
                          </Text>
                        )}
                      </View>
                      
                      {/* Day labels above circles for this action */}
                      <View style={styles.dayLabelsRow}>
                        {weekDays.map(day => (
                          <Text key={day.date} style={styles.dayLabelText}>
                            {day.dayName}
                          </Text>
                        ))}
                      </View>
                      
                      <View style={styles.dayDots}>
                        {weekDays.map(day => {
                           const hasLog = action.logs.some(
                             log => log.measured_on === day.date && log.completed
                           );
                            
                           return (
                             <TouchableOpacity
                               key={day.date}
                               style={[styles.dayDot, hasLog && styles.dayDotCompleted]}
                               onPress={onToggleCompletion ? async () => {
                                 try {
                                   await onToggleCompletion(action.id, day.date, hasLog);
                                 } catch (error) {
                                   console.error('Error in day dot toggle:', error);
                                 }
                               } : undefined}
                               activeOpacity={onToggleCompletion ? 0.7 : 1}
                             >
                               {hasLog && <Check size={12} color="#ffffff" />}
                             </TouchableOpacity>
                           );
                         })}
                      </View>

                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Tags */}
        {expanded && (goal.roles?.length > 0 || goal.domains?.length > 0) && (
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
    padding: 12,
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
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
    flexDirection: 'row',
    gap: 10, // Match gap with dayLabelsRow
    justifyContent: 'center',
  },
  dayLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10, // Slightly increased gap for better spacing
    marginBottom: 4, // Space between labels and circles
  },
  dayLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    width: 22, // Slightly increased width to prevent letter wrapping
    textAlign: 'center',
  },
  dayDot: {
    width: 22, // Increased to match label width
    height: 22, // Increased to match label width
    borderRadius: 11, // Half of width/height for perfect circle
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
  dayDotTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  goalTotalScore: {
    alignItems: 'flex-end',
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-end',
  },
  goalTotalScoreText: {
    fontSize: 12,
    fontWeight: '600',
  },
});