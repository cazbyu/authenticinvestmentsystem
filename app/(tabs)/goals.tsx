import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { getSupabaseClient } from '@/lib/supabase';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';
import { useGoals } from '@/hooks/useGoals';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { CycleSetupModal } from '@/components/cycles/CycleSetupModal';
import { CreateGoalModal } from '@/components/goals/CreateGoalModal';
import { EditGoalModal } from '@/components/goals/EditGoalModal';
import ActionEffortModal from '@/components/goals/ActionEffortModal';
import { Plus, Target, Calendar, ChevronLeft, ChevronRight, X, ChevronDown } from 'lucide-react-native';
import { formatDateRange, parseLocalDate } from '@/lib/dateUtils';

export default function Goals() {
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
  const [selectedGoalFilterId, setSelectedGoalFilterId] = useState<string | null>(null);
  const [showGoalDropdown, setShowGoalDropdown] = useState(false);
  const initializedWeekRef = useRef(false);
  const [weekGoalActions, setWeekGoalActions] = useState<Record<string, any[]>>({});

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

  const getFilteredGoals = () => {
    if (selectedGoalFilterId) {
      return allGoals.filter(goal => goal.id === selectedGoalFilterId);
    }
    return allGoals;
  };

  const getSelectedGoalTitle = () => {
    if (selectedGoalFilterId) {
      const selectedGoal = allGoals.find(goal => goal.id === selectedGoalFilterId);
      return selectedGoal?.title || 'Selected Goal';
    }
    return 'All Goals';
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
      
      {currentCycle ? (
        <ScrollView style={styles.content}>
          {/* Cycle Header */}
          <View style={styles.cycleHeader}>
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
              <Text style={styles.cycleDates}>
                {formatCycleDateRange()}
              </Text>
              {currentCycle.week_start_day && (
                <Text style={styles.weekStartInfo}>
                  Weeks start on {currentCycle.week_start_day === 'sunday' ? 'Sunday' : 'Monday'}
                </Text>
              )}
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
            
            {/* Week Navigator */}
            {cycleWeeks.length > 0 && (
              <View style={styles.weekNavigatorContainer}>
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
                        const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        return `${formatDate(startDate)} – ${formatDate(endDate)}`;
                      })()}
                    </Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={[
                      styles.weekNavButton, 
                      (selectedWeekIndex >= (cycleWeeks.length - 1) || loadingWeekActions) && styles.weekNavButtonDisabled
                    ]}
                    onPress={goNextWeek}
                    disabled={selectedWeekIndex >= (cycleWeeks.length - 1) || loadingWeekActions}
                  >
                    <ChevronRight size={16} color={(selectedWeekIndex >= (cycleWeeks.length - 1) || loadingWeekActions) ? '#9ca3af' : '#0078d4'} />
                  </TouchableOpacity>
                </View>
                
                {/* Overall Cycle Effort Score */}
                <View style={styles.cycleEffortScore}>
                  <Text style={[
                    styles.cycleEffortText,
                    { color: getProgressColor(cycleEffortData.overallPercentage) }
                  ]}>
                    {cycleEffortData.overallPercentage}%
                  </Text>
                </View>
              </View>
            )}

            {/* Goal Filter Dropdown */}
            {allGoals.length > 1 && (
              <View style={styles.goalFilterContainer}>
                <TouchableOpacity
                  style={styles.goalFilterButton}
                  onPress={() => setShowGoalDropdown(true)}
                >
                  <Text style={styles.goalFilterButtonText}>
                    {getSelectedGoalTitle()}
                  </Text>
                  <ChevronDown size={16} color="#0078d4" />
                </TouchableOpacity>
              </View>
            )}

            {/* Goals List */}
            {goalsLoading ? (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="small" color="#1f6feb" />
  </View>
) : getFilteredGoals().length === 0 ? (
    <View style={styles.emptyContainer}>
    <Text style={styles.emptyTitle}>
      {allGoals.length === 0 ? 'No Goals Yet' : 'No Goals Match Filter'}
    </Text>
    <Text style={styles.emptyText}>
      {allGoals.length === 0 
        ? 'Create your first goal to start tracking progress.'
        : 'Try selecting a different goal or view all goals.'
      }
    </Text>

    <TouchableOpacity
      style={styles.createGoalButton}
      onPress={() => setCreateGoalModalVisible(true)}
    >
      <Plus color="#ffffff" />
      <Text style={styles.createGoalButtonText}>Create First Goal</Text>
    </TouchableOpacity>
  </View>
) : (
  <View style={styles.goalsList}>
    {getFilteredGoals().map(goal => {
      const progress = goalProgress[goal.id];
      const weekData = getWeekData(selectedWeekIndex);
      const goalActions = weekGoalActions[goal.id] || [];
      
      // For 12-week goals, require progress data. For custom goals, show without progress
      if (goal.goal_type === '12week' && !progress) return null;

      return (
        <GoalProgressCard
          key={goal.id}
          goal={goal}
          progress={progress || {
            goalId: goal.id,
            currentWeek: 1,
            daysRemaining: 0,
            weeklyActual: 0,
            weeklyTarget: 0,
            overallActual: 0,
            overallTarget: 0,
            overallProgress: 0,
          }}
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
        />
      );
    })}
  </View>
)}
          </View>

                </ScrollView>
      ) : (
        <View style={styles.noCycleContainer}>
          <Target size={64} color="#6b7280" />
          <Text style={styles.noCycleTitle}>Start Your 12-Week Journey</Text>
          <Text style={styles.noCycleText}>
            Create a custom 12-week cycle or sync with the community to begin tracking your authentic investments and achieving your goals.
          </Text>
          <TouchableOpacity 
            style={styles.startCycleButton}
            onPress={() => setCycleSetupVisible(true)}
          >
            <Calendar size={20} color="#ffffff" />
            <Text style={styles.startCycleButtonText}>Start 12-Week Cycle</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => {
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

      {/* Goal Filter Modal */}
      <Modal visible={showGoalDropdown} transparent animationType="fade">
        <View style={styles.goalDropdownOverlay}>
          <View style={styles.goalDropdownContent}>
            <View style={styles.goalDropdownHeader}>
              <Text style={styles.goalDropdownTitle}>Filter by Goal</Text>
              <TouchableOpacity onPress={() => setShowGoalDropdown(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.goalDropdownList}>
              {/* Show All Goals Option */}
              <TouchableOpacity
                style={[
                  styles.goalDropdownItem,
                  selectedGoalFilterId === null && styles.selectedGoalDropdownItem
                ]}
                onPress={() => {
                  setSelectedGoalFilterId(null);
                  setShowGoalDropdown(false);
                }}
              >
                <Text style={[
                  styles.goalDropdownItemText,
                  selectedGoalFilterId === null && styles.selectedGoalDropdownItemText
                ]}>
                  Show All Goals
                </Text>
                {selectedGoalFilterId === null && (
                  <View style={styles.selectedIndicator}>
                    <Text style={styles.selectedIndicatorText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
              
              {/* Individual Goals */}
              {allGoals.map(goal => (
                <TouchableOpacity
                  key={goal.id}
                  style={[
                    styles.goalDropdownItem,
                    selectedGoalFilterId === goal.id && styles.selectedGoalDropdownItem
                  ]}
                  onPress={() => {
                    setSelectedGoalFilterId(goal.id);
                    setShowGoalDropdown(false);
                  }}
                >
                  <Text style={[
                    styles.goalDropdownItemText,
                    selectedGoalFilterId === goal.id && styles.selectedGoalDropdownItemText
                  ]} numberOfLines={2}>
                    {goal.title} {goal.goal_type === 'custom' && '(Custom)'}
                  </Text>
                  {selectedGoalFilterId === goal.id && (
                    <View style={styles.selectedIndicator}>
                      <Text style={styles.selectedIndicatorText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
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
  weekStartInfo: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  cycleProgress: {
    alignItems: 'center',
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
  weekNavigatorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  weekNavContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 200,
  },
  cycleEffortScore: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  cycleEffortText: {
    fontSize: 14,
    fontWeight: '600',
  },
  goalFilterContainer: {
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  goalFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#0078d4',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    minWidth: 150,
    justifyContent: 'center',
  },
  goalFilterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0078d4',
    textAlign: 'center',
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
  goalsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
    marginTop: 12,
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
  goalDropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  goalDropdownContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    minWidth: 300,
    maxWidth: 400,
    maxHeight: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  goalDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  goalDropdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  goalDropdownList: {
    maxHeight: 400,
  },
  goalDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedGoalDropdownItem: {
    backgroundColor: '#f0f9ff',
  },
  goalDropdownItemText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    marginRight: 8,
  },
  selectedGoalDropdownItemText: {
    color: '#0078d4',
    fontWeight: '600',
  },
  selectedIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0078d4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedIndicatorText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});