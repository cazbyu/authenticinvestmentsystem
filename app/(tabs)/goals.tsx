import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { getSupabaseClient } from '@/lib/supabase';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';
import { useGoals } from '@/hooks/useGoals';
import TaskEventForm from '@/components/tasks/TaskEventForm'; // Keep this import
import { CycleSetupModal } from '@/components/cycles/CycleSetupModal';
import { CreateGoalModal } from '@/components/goals/CreateGoalModal';
import { EditGoalModal } from '@/components/goals/EditGoalModal';
import ActionEffortModal from '@/components/goals/ActionEffortModal';
import { Plus, Target, Calendar, ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { formatDateRange, parseLocalDate } from '@/lib/dateUtils';

export default function Goals() { // Ensure this is the default export
  const [authenticScore, setAuthenticScore] = useState(0);
  const [taskFormVisible, setTaskFormVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [cycleSetupVisible, setCycleSetupVisible] = useState(false);
  const [createGoalModalVisible, setCreateGoalModalVisible] = useState(false);
  const [editGoalModalVisible, setEditGoalModalVisible] = useState(false);
  const [selectedGoalToEdit, setSelectedGoalToEdit] = useState<any>(null);
  const [isActionEffortModalVisible, setIsActionEffortModalVisible] = useState(false);
  const [selectedGoalForAction, setSelectedGoalForAction] = useState<any>(null);
  const [editingCycle, setEditingCycle] = useState<any>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [goalsExpanded, setGoalsExpanded] = useState(true);
  const [selectedGoalForModal, setSelectedGoalForModal] = useState<any>(null);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const initializedWeekRef = useRef(false);
  const [weekGoalActions, setWeekGoalActions] = useState<Record<string, any[]>>({});
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(null);
  const [initialGoalType, setInitialGoalType] = useState<'12week' | 'custom'>('12week');

 const { width } = useWindowDimensions();
 const twoUp = Platform.OS === 'web' && width >= 768;

  // 12-Week Goals
  const { 
    twelveWeekGoals,
    customGoals,
    allGoals,
    currentCycle, 
    daysLeftData, 
    goalProgress, 
    cycleWeeks,
    cycleEffortData,
    loading: goalsLoading, 
    loadingWeekActions,
    setLoadingWeekActions,
    refreshGoals,
    refreshAllData,
    createTwelveWeekGoal,
    createCustomGoal,
    createTaskWithWeekPlan,
    fetchGoalActionsForWeek,
    getCurrentWeekIndex,
    getWeekData,
    completeActionSuggestion,
  undoActionOccurrence,
  } = useGoals();

  // Initialize selected week to current week
  // Initialize selected week to current week (run once when cycleWeeks arrive)
useEffect(() => {
  if (!initializedWeekRef.current && cycleWeeks.length > 0) {
    const currentWeekIndex = getCurrentWeekIndex();
    setSelectedWeekIndex(currentWeekIndex);
    initializedWeekRef.current = true;
  }
}, [cycleWeeks]);

  // Fetch week-specific actions when week or goals change
  useEffect(() => {
    console.log('=== FETCH WEEK ACTIONS USEEFFECT TRIGGERED ===');
    console.log('useEffect triggered for fetchWeekActions:', { 
      selectedWeekIndex, 
      goalsCount: allGoals.length, 
      cycleWeeksCount: cycleWeeks.length 
    });
    console.log('loadingWeekActions state:', loadingWeekActions);
    console.log('Dependencies that triggered this effect:', {
      selectedWeekIndex,
      allGoalsLength: allGoals.length,
      cycleWeeksLength: cycleWeeks.length
    });
    if (allGoals.length > 0 && cycleWeeks.length > 0) {
      fetchWeekActions();
    }
    console.log('=== END FETCH WEEK ACTIONS USEEFFECT ===');
  }, [selectedWeekIndex, allGoals, cycleWeeks]);

  const fetchWeekActions = async () => {
  try {
    console.log('=== FETCH WEEK ACTIONS START ===');
    console.log('Selected week index:', selectedWeekIndex);
    console.log('Cycle weeks available:', cycleWeeks.length);
    setLoadingWeekActions(true);
    
    const weekData = getWeekData(selectedWeekIndex);
    console.log('Week data calculated:', weekData);
    if (!weekData || allGoals.length === 0) {
      console.log('No week data or goals - clearing actions');
      setWeekGoalActions({});
      return;
    }

    const goalIds = allGoals.map(g => g.id);
    console.log('Goal IDs to fetch actions for:', goalIds);
    const actions = await fetchGoalActionsForWeek(goalIds, weekData.startDate, weekData.endDate);
    console.log('Actions received from fetchGoalActionsForWeek:', actions);
    setWeekGoalActions(actions);
    console.log('setWeekGoalActions called with:', actions);
    console.log('=== FETCH WEEK ACTIONS END ===');

  } catch (err: any) {
    // Ignore transient preview/network/auth refresh errors (status 0)
    if (!(err && (err.status === 0 || err.name === 'TypeError'))) {
      console.error('fetchWeekActions error:', err);
    }
  } finally {
    setLoadingWeekActions(false);
  }
};

    const handleToggleCompletion = async (actionId: string, date: string, completed: boolean) => {
    console.log('=== HANDLE TOGGLE COMPLETION START (optimistic) ===');
    console.log('Params:', { actionId, date, completed });

    // 1) Optimistic local update
    let touchedGoalId: string | null = null;
    let optimisticDidChange = false;

    setWeekGoalActions(prev => {
      const next: Record<string, any[]> = {};
      for (const [goalId, actions] of Object.entries(prev)) {
        const arr = [...actions];
        const idx = arr.findIndex(a => a.id === actionId);
        if (idx !== -1) {
          touchedGoalId = goalId;

          const action = arr[idx];
          const logs = action.logs ?? [];
          const hadLog = logs.some((l: any) => (l.measured_on ?? l.log_date) === date);
          let nextLogs = logs;
          let nextActual = action.weeklyActual ?? 0;

          if (!completed && !hadLog) {
            nextLogs = [...logs, { measured_on: date, completed: true }];
            nextActual += 1;
            optimisticDidChange = true;
            console.log('[OPTIMISTIC] added log', { actionId, date });
          } else if (completed && hadLog) {
            nextLogs = logs.filter((l: any) => (l.measured_on ?? l.log_date) !== date);
            nextActual = Math.max(0, nextActual - 1);
            optimisticDidChange = true;
            console.log('[OPTIMISTIC] removed log', { actionId, date });
          }

          arr[idx] = { ...action, logs: nextLogs, weeklyActual: nextActual };
        }
        next[goalId] = arr;
      }
      return next;
    });

    if (!touchedGoalId) {
      console.warn('[TOGGLE] action not found in state');
      return;
    }

    // 2) Server write in background
    try {
      if (completed) {
        console.log('[SERVER] undoActionOccurrence...', { actionId, date });
        await undoActionOccurrence({ parentTaskId: actionId, whenISO: date });
        console.log('[SERVER] undoActionOccurrence done');
      } else {
        console.log('[SERVER] completeActionSuggestion...', { actionId, date });
        await completeActionSuggestion({ parentTaskId: actionId, whenISO: date });
        console.log('[SERVER] completeActionSuggestion done');
      }

      console.log('=== HANDLE TOGGLE COMPLETION END (success) ===');
    } catch (error) {
      console.error('[SERVER] error:', error);

      // 3) Revert optimistic change on failure
      if (optimisticDidChange) {
        console.log('[REVERT] reverting optimistic change...');
        setWeekGoalActions(prev => {
          const next: Record<string, any[]> = {};
          for (const [goalId, actions] of Object.entries(prev)) {
            const arr = [...actions];
            const idx = arr.findIndex(a => a.id === actionId);
            if (idx !== -1) {
              const action = arr[idx];
              const logs = action.logs ?? [];
              const hadLog = logs.some((l: any) => (l.measured_on ?? l.log_date) === date);
              let nextLogs = logs;
              let nextActual = action.weeklyActual ?? 0;

              if (!completed && hadLog) {
                nextLogs = logs.filter((l: any) => (l.measured_on ?? l.log_date) !== date);
                nextActual = Math.max(0, nextActual - 1);
              } else if (completed && !hadLog) {
                nextLogs = [...logs, { measured_on: date, completed: true }];
                nextActual += 1;
              }

              arr[idx] = { ...action, logs: nextLogs, weeklyActual: nextActual };
            }
            next[goalId] = arr;
          }
          return next;
        });
      }

      Alert.alert('Error', 'Failed to update completion status');
      console.log('=== HANDLE TOGGLE COMPLETION END (reverted) ===');
    }
  };

  const goPrevWeek = () => {
    console.log('goPrevWeek called, current index:', selectedWeekIndex);
    setSelectedWeekIndex(prev => {
      const newIndex = Math.max(0, prev - 1);
      console.log('goPrevWeek: changing from', prev, 'to', newIndex);
      return newIndex;
    });
  };

  const goNextWeek = () => {
    console.log('goNextWeek called, current index:', selectedWeekIndex, 'max:', cycleWeeks.length - 1);
    setSelectedWeekIndex(prev => {
      const newIndex = Math.min(cycleWeeks.length - 1, prev + 1);
      console.log('goNextWeek: changing from', prev, 'to', newIndex);
      return newIndex;
    });
  };

  const formatWeekHeader = () => {
    const weekData = getWeekData(selectedWeekIndex);
    if (!weekData) return 'Week 1';
    
    const startDate = parseLocalDate(weekData.startDate);
    const endDate = parseLocalDate(weekData.endDate);
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    
    return `Week ${weekData.weekNumber} — ${formatDate(startDate)} – ${formatDate(endDate)}`;
  };

  const calculateTaskPoints = (task: any, roles: any[] = [], domains: any[] = []) => {
    let points = 0;
    if (roles && roles.length > 0) points += roles.length;
    if (domains && domains.length > 0) points += domains.length;
    if (task.is_authentic_deposit) points += 2;
    if (task.is_urgent && task.is_important) points += 1.5;
    else if (!task.is_urgent && task.is_important) points += 3;
    else if (task.is_urgent && !task.is_important) points += 1;
    else points += 0.5;
    if (task.is_twelve_week_goal) points += 2;
    return Math.round(points * 10) / 10;
  };

  const calculateAuthenticScore = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate deposits from completed tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .not('completed_at', 'is', null);

      if (tasksError) throw tasksError;

      let totalDeposits = 0;
      if (tasksData && tasksData.length > 0) {
        const taskIds = tasksData.map(t => t.id);
        const [
          { data: rolesData },
          { data: domainsData }
        ] = await Promise.all([
          supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task')
        ]);

        for (const task of tasksData) {
          const taskWithData = {
            ...task,
            roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
            domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
          };
          totalDeposits += calculateTaskPoints(task, taskWithData.roles, taskWithData.domains);
        }
      }

      // Calculate withdrawals
      const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from('0008-ap-withdrawals')
        .select('amount')
        .eq('user_id', user.id);

      if (withdrawalsError) throw withdrawalsError;

      const totalWithdrawals = withdrawalsData?.reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0) || 0;
      
      const balance = totalDeposits - totalWithdrawals;
      setAuthenticScore(Math.round(balance * 10) / 10);
    } catch (error) {
      console.error('Error calculating authentic score:', error);
    }
  };

  useEffect(() => {
    calculateAuthenticScore();
    refreshAllData();
  }, []);

  // Auto-refresh days left data at midnight
  useEffect(() => {
    if (!currentCycle) return;

    const updateAtMidnight = () => {
      refreshAllData();
    };

    // Calculate milliseconds until next midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Set timeout for midnight, then interval for every 24 hours
    const midnightTimeout = setTimeout(() => {
      updateAtMidnight();
      const dailyInterval = setInterval(updateAtMidnight, 24 * 60 * 60 * 1000);
      return () => clearInterval(dailyInterval);
    }, msUntilMidnight);

    return () => clearTimeout(midnightTimeout);
  }, [currentCycle, refreshAllData]);

  const handleFormSubmitSuccess = () => {
    setTaskFormVisible(false);
    setEditingTask(null);
    refreshAllData();
  };

  const handleFormClose = () => {
    setTaskFormVisible(false);
    setEditingTask(null);
  };

  const handleCycleCreated = () => {
    setCycleSetupVisible(false);
    setEditingCycle(null);
    refreshAllData();
  };

  const handleCreateGoalSuccess = () => {
    setCreateGoalModalVisible(false);
    setInitialGoalType('12week'); // Reset to default
    refreshAllData();
  };

  const handleEditGoalSuccess = () => {
    setEditGoalModalVisible(false);
    setSelectedGoalToEdit(null);
    refreshAllData();
  };

  const formatCycleDateRange = () => {
    if (!currentCycle?.start_date || !currentCycle?.end_date) return '';
    return formatDateRange(currentCycle.start_date, currentCycle.end_date);
  };

  const calculateCycleProgress = () => {
    if (!currentCycle?.start_date || !currentCycle?.end_date) {
      return { percentage: 0, daysRemaining: 0 };
    }
    const now = new Date();
    const startDate = new Date(currentCycle.start_date);
    const endDate = new Date(currentCycle.end_date);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysPassed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, totalDays - daysPassed);
    const percentage = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));
    return { percentage, daysRemaining };
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 85) return '#16a34a';
    if (percentage >= 60) return '#eab308';
    return '#dc2626';
  };

  const handleGoalDoublePress = (goal: any) => {
    setSelectedGoalForModal(goal);
    setGoalModalVisible(true);
  };

  const handleGoalModalClose = () => {
    setGoalModalVisible(false);
    setSelectedGoalForModal(null);
  };

  const handleTimelineSelect = (timelineId: string) => {
    setSelectedTimelineId(timelineId);
  };

  const handleBackToTimelines = () => {
    setSelectedTimelineId(null);
  };

  const renderTimelineContainers = () => {
    const timelines = [];
    
    // Add 12-week cycle timeline if it exists
    if (currentCycle) {
      const twelveWeekGoalsCount = twelveWeekGoals.length;
      const cycleProgress = calculateCycleProgress();
      
      timelines.push({
        id: 'twelve-week',
        type: '12week',
        title: currentCycle.title || '12-Week Cycle',
        dateRange: formatCycleDateRange(),
        goalCount: twelveWeekGoalsCount,
        daysRemaining: cycleProgress.daysRemaining,
        color: '#0078d4',
      });
    }
    
    // Add custom goals as individual timelines
    customGoals.forEach(goal => {
      const startDate = parseLocalDate(goal.start_date);
      const endDate = parseLocalDate(goal.end_date);
      const now = new Date();
      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      
      timelines.push({
        id: goal.id,
        type: 'custom',
        title: goal.title,
        dateRange: formatDateRange(goal.start_date, goal.end_date),
        goalCount: 1, // Each custom goal is its own timeline
        daysRemaining,
        color: '#7c3aed',
        goal: goal,
      });
    });
    
    return (
      <View style={styles.timelinesContainer}>
        <Text style={styles.timelinesTitle}>Goal Timelines</Text>
        <View style={styles.timelinesGrid}>
          {timelines.map(timeline => (
            <TouchableOpacity
              key={timeline.id}
              style={[styles.timelineCard, { borderLeftColor: timeline.color }]}
              onPress={() => handleTimelineSelect(timeline.id)}
            >
              <View style={styles.timelineHeader}>
                <Text style={styles.timelineTitle} numberOfLines={2}>
                  {timeline.title}
                </Text>
                <Text style={styles.timelineDates}>
                  {timeline.dateRange}
                </Text>
              </View>
              
              <View style={styles.timelineStats}>
                <Text style={styles.timelineGoalCount}>
                  {timeline.goalCount} active goal{timeline.goalCount !== 1 ? 's' : ''}
                </Text>
                <Text style={styles.timelineDaysLeft}>
                  {timeline.daysRemaining} days left
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        
        {timelines.length === 0 && (
          <View style={styles.emptyTimelines}>
            <Text style={styles.emptyTimelinesText}>No active goal timelines</Text>
            <TouchableOpacity
              style={styles.createTimelineButton}
              onPress={() => {
                setInitialGoalType('custom');
                setCreateGoalModalVisible(true);
              }}
            >
              <Plus size={20} color="#ffffff" />
              <Text style={styles.createTimelineButtonText}>Create Custom Goal</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderSelectedTimeline = () => {
  if (!selectedTimelineId) return null;

  if (selectedTimelineId === 'twelve-week') {
    // 12-Week cycle view
    return (
      <ScrollView style={styles.content}>
        <View style={styles.cycleHeader}>
          <TouchableOpacity
            style={styles.backToTimelinesButton}
            onPress={handleBackToTimelines}
          >
            <Text style={styles.backToTimelinesText}>← Back to Timelines</Text>
          </TouchableOpacity>

          <View style={styles.cycleInfo}>
            <View style={styles.cycleTitleRow}>
              <View style={styles.cycleTitleContent}>
                <Text style={styles.cycleTitle}>
                  {currentCycle.title || '12-Week Cycle'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.editCycleButton}
                onPress={() => {
                  setCycleSetupVisible(true);
                }}
              >
                <Text style={styles.editCycleButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.cycleDates}>{formatCycleDateRange()}</Text>
            <Text style={styles.activeGoalsInfo}>
              You have {twelveWeekGoals.length} active 12-Week Goals
            </Text>
          </View>

        <View style={styles.cycleProgress}>
          <Text style={styles.cycleProgressLabel}>
            {calculateCycleProgress().daysRemaining} days left
          </Text>
          <View style={styles.cycleProgressBar}>
            <View
              style={[
                styles.cycleProgressFill,
                { width: `${calculateCycleProgress().percentage}%` }
              ]}
            />
          </View>
        </View>

        {/* Navigation Row */}
        {cycleWeeks.length > 0 && (
          <View style={styles.navigationRow}>
            <View style={styles.weekNavContainer}>
              <TouchableOpacity
                style={[
                  styles.weekNavButton,
                  (selectedWeekIndex === 0 || loadingWeekActions) && styles.weekNavButtonDisabled
                ]}
                onPress={goPrevWeek}
                disabled={selectedWeekIndex === 0 || loadingWeekActions}
              >
                <ChevronLeft size={16} color={(selectedWeekIndex === 0 || loadingWeekActions) ? '#9ca3af' : '#0078d4'} />
              </TouchableOpacity>

              <View style={styles.weekDisplay}>
                <Text style={styles.weekNumber}>
                  Week {getWeekData(selectedWeekIndex)?.weekNumber || 1}
                </Text>
                <Text style={styles.weekDates}>
                  {(() => {
                    const weekData = getWeekData(selectedWeekIndex);
                    if (!weekData) return '';
                    const startDate = parseLocalDate(weekData.startDate);
                    const endDate = parseLocalDate(weekData.endDate);
                    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
                  })()}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.weekNavButton,
                  (selectedWeekIndex >= cycleWeeks.length - 1 || loadingWeekActions) && styles.weekNavButtonDisabled
                ]}
                onPress={goNextWeek}
                disabled={selectedWeekIndex >= cycleWeeks.length - 1 || loadingWeekActions}
              >
                <ChevronRight size={16} color={(selectedWeekIndex >= cycleWeeks.length - 1 || loadingWeekActions) ? '#9ca3af' : '#0078d4'} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.expandButton} onPress={() => setGoalsExpanded(!goalsExpanded)}>
                <Text style={styles.expandButtonText}>{goalsExpanded ? 'Collapse' : 'Expand'}</Text>
                {goalsExpanded ? <ChevronUp size={16} color="#0078d4" /> : <ChevronDown size={16} color="#0078d4" />}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 12-Week Goals List */}
        {goalsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#1f6feb" />
          </View>
        ) : twelveWeekGoals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No 12-Week Goals Yet</Text>
            <Text style={styles.emptyText}>
              Create your first 12-week goal to start tracking progress.
            </Text>
            <TouchableOpacity
              style={styles.createGoalButton}
              onPress={() => {
                setInitialGoalType('12week');
                setCreateGoalModalVisible(true);
              }}
            >
              <Plus color="#ffffff" />
              <Text style={styles.createGoalButtonText}>Create 12-Week Goal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.goalsList}>
            {twelveWeekGoals.map(goal => {
              const progress = goalProgress[goal.id];
              const weekData = getWeekData(selectedWeekIndex);
              const goalActions = weekGoalActions[goal.id] || [];
              if (!progress) return null;

              return (
                <View key={goal.id} style={[styles.goalItem, twoUp && styles.goalItemTwoCol]}>
                  <GoalProgressCard
                    goal={goal}
                    expanded={goalsExpanded}
                    progress={progress}
                    week={weekData}
                    selectedWeekNumber={weekData?.weekNumber}
                    weekActions={goalActions}
                    loadingWeekActions={loadingWeekActions}
                    onAddAction={() => {
                      setSelectedGoalForAction(goal);
                      setIsActionEffortModalVisible(true);
                    }}
                    onToggleCompletion={handleToggleCompletion}
                    onEdit={() => {
                      setSelectedGoalToEdit(goal);
                      setEditGoalModalVisible(true);
                    }}
                    onPress={() => handleGoalDoublePress(goal)}
                  />
                </View>
              );
            })}
          </View>
        )}
        </View>
      </ScrollView>
    );
  } else {
    // Custom goal view
    const customGoal = customGoals.find(g => g.id === selectedTimelineId);
    if (!customGoal) return null;

    return (
      <ScrollView style={styles.content}>
        <View style={styles.cycleHeader}>
          <TouchableOpacity
            style={styles.backToTimelinesButton}
            onPress={handleBackToTimelines}
          >
            <Text style={styles.backToTimelinesText}>← Back to Timelines</Text>
          </TouchableOpacity>

          <View style={styles.cycleInfo}>
            <View style={styles.cycleTitleRow}>
              <View style={styles.cycleTitleContent}>
                <Text style={styles.cycleTitle}>{customGoal.title}</Text>
              </View>
              <TouchableOpacity
                style={styles.editCycleButton}
                onPress={() => {
                  setSelectedGoalToEdit(customGoal);
                  setEditGoalModalVisible(true);
                }}
              >
                <Text style={styles.editCycleButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.cycleDates}>
              {formatDateRange(customGoal.start_date, customGoal.end_date)}
            </Text>
            <Text style={styles.activeGoalsInfo}>Custom Goal Timeline</Text>
          </View>

          <View style={styles.cycleProgress}>
            <Text style={styles.cycleProgressLabel}>
              {(() => {
                const startDate = parseLocalDate(customGoal.start_date);
                const endDate = parseLocalDate(customGoal.end_date);
                const now = new Date();
                const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                return daysRemaining;
              })()} days left
            </Text>
            <View style={styles.cycleProgressBar}>
              <View
                style={[
                  styles.cycleProgressFill,
                  { width: `${(() => {
                      const startDate = parseLocalDate(customGoal.start_date);
                      const endDate = parseLocalDate(customGoal.end_date);
                      const now = new Date();
                      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                      const daysPassed = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
                      return Math.min(100, (daysPassed / totalDays) * 100);
                    })()}%` }
                ]}
              />
            </View>
          </View>

          {/* Custom Goal Display */}
          <View style={styles.goalsList}>
            <View style={[styles.goalItem, twoUp && styles.goalItemTwoCol]}>
              <GoalProgressCard
                key={customGoal.id}
                goal={customGoal}
                expanded={true}
                progress={{
                  goalId: customGoal.id,
                  currentWeek: 1,
                  daysRemaining: (() => {
                    const startDate = parseLocalDate(customGoal.start_date);
                    const endDate = parseLocalDate(customGoal.end_date);
                    const now = new Date();
                    return Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                  })(),
                  weeklyActual: 0,
                  weeklyTarget: 0,
                  overallActual: 0,
                  overallTarget: 0,
                  overallProgress: 0,
                }}
                onEdit={() => {
                  setSelectedGoalToEdit(customGoal);
                  setEditGoalModalVisible(true);
                }}
                onPress={() => handleGoalDoublePress(customGoal)}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }
};

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Goal Bank" 
        authenticScore={authenticScore}
        daysRemaining={daysLeftData?.days_left}
        cycleProgressPercentage={daysLeftData?.pct_elapsed}
        cycleTitle={currentCycle?.title}
      />
      
      {selectedTimelineId ? (
        renderSelectedTimeline()
      ) : (currentCycle || customGoals.length > 0) ? (
        renderTimelineContainers()
      ) : (
        <View style={styles.noCycleContainer}>
          <Target size={64} color="#6b7280" />
          <Text style={styles.noCycleTitle}>Start Your Goal Journey</Text>
          <Text style={styles.noCycleText}>
            Create a 12-week cycle to track systematic goals, or create custom goals with your own timeline.
          </Text>
          
          <View style={styles.startOptions}>
            <TouchableOpacity 
              style={styles.startCycleButton}
              onPress={() => setCycleSetupVisible(true)}
            >
              <Calendar size={20} color="#ffffff" />
              <Text style={styles.startCycleButtonText}>Start 12-Week Cycle</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.startCustomGoalButton}
              onPress={() => {
                setInitialGoalType('custom');
                setCreateGoalModalVisible(true);
              }}
            >
              <Target size={20} color="#7c3aed" />
              <Text style={styles.startCustomGoalButtonText}>Create Custom Goal</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => {
          setInitialGoalType('12week');
          setCreateGoalModalVisible(true);
        }}
      >
        <Plus size={24} color="#ffffff" />
      </TouchableOpacity>

      {/* Task Form Modal */}
      <Modal visible={taskFormVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode={editingTask?.id ? "edit" : "create"}
          initialData={editingTask || undefined}
          onSubmitSuccess={handleFormSubmitSuccess}
          onClose={handleFormClose}
        />
      </Modal>

      {/* Cycle Setup Modal */}
      <CycleSetupModal
        visible={cycleSetupVisible}
        onClose={() => setCycleSetupVisible(false)}
        onSuccess={handleCycleCreated}
        initialData={editingCycle}
      />

      {/* Create Goal Modal */}
      <CreateGoalModal
        visible={createGoalModalVisible}
        onClose={() => setCreateGoalModalVisible(false)}
        onSubmitSuccess={handleCreateGoalSuccess}
        createTwelveWeekGoal={createTwelveWeekGoal}
        createCustomGoal={createCustomGoal}
        initialGoalType={initialGoalType}
      />

      {/* Edit Goal Modal */}
      <EditGoalModal
        visible={editGoalModalVisible}
        onClose={() => setEditGoalModalVisible(false)}
        onUpdate={handleEditGoalSuccess}
        goal={selectedGoalToEdit}
      />

      {/* Action Effort Modal */}
      <ActionEffortModal
        visible={isActionEffortModalVisible}
        onClose={() => {
          setIsActionEffortModalVisible(false);
          setSelectedGoalForAction(null);
          refreshAllData();
        }}
        goal={selectedGoalForAction}
        cycleWeeks={cycleWeeks}
        createTaskWithWeekPlan={createTaskWithWeekPlan}
      />

      {/* Individual Goal Modal */}
      <Modal visible={goalModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.goalModalContainer}>
          <View style={styles.goalModalHeader}>
            <Text style={styles.goalModalTitle}>
              {selectedGoalForModal?.title || 'Goal Details'}
            </Text>
            <TouchableOpacity onPress={handleGoalModalClose} style={styles.goalModalCloseButton}>
              <X size={24} color="#1f2937" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.goalModalContent}>
            {selectedGoalForModal && (
              <View style={styles.goalModalBody}>
                <GoalProgressCard
                  goal={selectedGoalForModal}
                  expanded={true}
                  progress={goalProgress[selectedGoalForModal.id] || {
                    goalId: selectedGoalForModal.id,
                    currentWeek: 1,
                    daysRemaining: 0,
                    weeklyActual: 0,
                    weeklyTarget: 0,
                    overallActual: 0,
                    overallTarget: 0,
                    overallProgress: 0,
                  }}
                  week={getWeekData(selectedWeekIndex)}
                  selectedWeekNumber={getWeekData(selectedWeekIndex)?.weekNumber}
                  weekActions={weekGoalActions[selectedGoalForModal.id] || []}
                  loadingWeekActions={loadingWeekActions}
                  onAddAction={() => {
                    setSelectedGoalForAction(selectedGoalForModal);
                    setGoalModalVisible(false);
                    setIsActionEffortModalVisible(true);
                  }}
                  onToggleCompletion={handleToggleCompletion}
                  onEdit={() => {
                    setSelectedGoalToEdit(selectedGoalForModal);
                    setGoalModalVisible(false);
                    setEditGoalModalVisible(true);
                  }}
                />
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
  cycleHeader: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cycleInfo: {
    marginBottom: 12,
  },
  cycleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cycleTitleContent: {
    flex: 1,
  },
  cycleTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  editCycleButton: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0078d4',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editCycleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0078d4',
  },
  cycleDates: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  activeGoalsInfo: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  weekStartInfo: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  cycleProgress: {
    flex: 1,
    marginRight: 16,
  },
  cycleProgressLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
  },
  cycleProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  cycleProgressFill: {
    height: '100%',
    backgroundColor: '#0078d4',
    borderRadius: 4,
  },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  weekNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cycleEffortContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 12,
  },
  cycleEffortScore: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  cycleEffortLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  cycleEffortText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandCollapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#0078d4',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  expandCollapseButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0078d4',
  },
  weekNavButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  weekNavButtonDisabled: {
    backgroundColor: '#f3f4f6',
    shadowOpacity: 0,
    elevation: 0,
  },
  weekDisplay: {
    alignItems: 'center',
    marginHorizontal: 12,
    minWidth: 100,
  },
  weekNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 2,
  },
  weekDates: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 14,
  },
  globalControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  globalExpandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#0078d4',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  globalExpandButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0078d4',
  },
  goalsList: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
  padding: 16,
  marginTop: 12,
},

goalItem: {
  width: '100%',
  maxWidth: '100%',
  marginBottom: 12,
},

  goalItemTwoCol: {
    width: '48%',
    maxWidth: '48%',
    marginRigh: 12,
 },

  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  createGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createGoalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  noCycleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noCycleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  noCycleText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  startCycleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  startCycleButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0078d4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  goalModalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  goalModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  goalModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  goalModalCloseButton: {
    padding: 4,
  },
  goalModalContent: {
    flex: 1,
  },
  goalModalBody: {
    padding: 16,
  },
  timelinesContainer: {
    padding: 16,
  },
  timelinesTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  timelinesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: Platform.OS === 'web' ? 'space-between' : 'flex-start',
    gap: 12,
  },
  timelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 16,
    width: Platform.OS === 'web' ? '48%' : '100%',
    maxWidth: Platform.OS === 'web' ? '48%' : undefined,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineHeader: {
    marginBottom: 12,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  timelineDates: {
    fontSize: 12,
    color: '#6b7280',
  },
  timelineStats: {
    gap: 4,
  },
  timelineGoalCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  timelineDaysLeft: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyTimelines: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTimelinesText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  createTimelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createTimelineButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backToTimelinesButton: {
    marginBottom: 16,
  },
  backToTimelinesText: {
    fontSize: 14,
    color: '#0078d4',
    fontWeight: '500',
  },
  startOptions: {
    gap: 16,
    alignItems: 'center',
  },
  startCustomGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#7c3aed',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  startCustomGoalButtonText: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: '600',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0078d4',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 12,
    gap: 4,
  },
  expandButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0078d4',
  },
});