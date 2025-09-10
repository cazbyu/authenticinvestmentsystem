import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { getSupabaseClient } from '@/lib/supabase';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';
import TaskEventForm from '@/components/tasks/TaskEventForm'; // Keep this import
import { CycleSetupModal } from '@/components/cycles/CycleSetupModal';
import { CreateGoalModal } from '@/components/goals/CreateGoalModal';
import ActionEffortModal from '@/components/goals/ActionEffortModal';
import { EditGoalModal } from '@/components/goals/EditGoalModal';
import { ManageCustomTimelinesModal } from '@/components/timelines/ManageCustomTimelinesModal';
import { Plus, Target, Calendar, ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { formatDateRange, parseLocalDate, formatLocalDate, safeFormatDateRange } from '@/lib/dateUtils';

import { useGoals } from '@/hooks/useGoals';
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
  const {
    twelveWeekGoals,
    customGoals,
    allGoals,
    currentCycle,
    cycleWeeks,
    daysLeftData,
    goalProgress,
    cycleEffortData,
    loading,
    loadingWeekActions,
    setLoadingWeekActions,
    refreshGoals,
    refreshAllData,
    fetchGoalActionsForWeek,
    completeActionSuggestion,
    undoActionOccurrence,
    createTwelveWeekGoal,
    createCustomGoal,
    createTaskWithWeekPlan,
    getCurrentWeekNumber,
    getCurrentWeekIndex,
    getWeekData,
    weekGoalActions,
    setWeekGoalActions,
  } = useGoals();

  const [editingCycle, setEditingCycle] = useState<any>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(-1); // -1 indicates not yet initialized
  const [goalsExpanded, setGoalsExpanded] = useState(true);
  const [selectedGoalForModal, setSelectedGoalForModal] = useState<any>(null);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const initializedWeekRef = useRef(false);
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(null);
  const [customTimelines, setCustomTimelines] = useState<any[]>([]);
  const [initialGoalType, setInitialGoalType] = useState<'12week' | 'custom'>('12week');
  const [customTimelineWeeks, setCustomTimelineWeeks] = useState<any[]>([]);
  const [customTimelineGoals, setCustomTimelineGoals] = useState<any[]>([]);
  const [customTimelineProgress, setCustomTimelineProgress] = useState<Record<string, any>>({});
  const [isCustomTimelinesModalVisible, setIsCustomTimelinesModalVisible] = useState(false);

 const { width } = useWindowDimensions();
  const twoUp = Platform.OS === 'web' && width >= 768;

  const isValidDateString = (d?: string) => typeof d === 'string' && d !== 'null' && !isNaN(Date.parse(d));
  const safeParseDate = (d: string, context: string): Date | null => {
    try {
      if (!isValidDateString(d)) throw new Error('Invalid date');
      // Support ISO strings that include time components by stripping them
      const parsed = parseLocalDate(d.split('T')[0]);
      if (isNaN(parsed.getTime())) throw new Error('Invalid date');
      return parsed;
    } catch (err) {
      console.warn(`Invalid date in ${context}:`, d, err);
      return null;
    }
  };
  const safeFormatDateRange = (start: string, end: string, context: string): string => {
    try {
      if (!isValidDateString(start) || !isValidDateString(end)) throw new Error('Invalid date');
      return formatDateRange(start, end);
    } catch (err) {
      console.warn(`Invalid date range in ${context}:`, { start, end }, err);
      return 'Invalid date';
    }
  };

  // 12-Week Goals handled via useGoals

  const fetchCustomTimelines = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-custom-timelines')
        .select('*, goals:0008-ap-goals-custom(id)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const timelines = (data || []).map(tl => ({
        ...tl,
        goals_count: tl.goals ? tl.goals.length : 0,
      }));

      setCustomTimelines(timelines);
    } catch (err) {
      console.error('Error fetching custom timelines:', err);
    }
  };

  useEffect(() => {
    fetchCustomTimelines();
  }, []);

  // Initialize selected week to current week (for both cycle and custom timelines)
useEffect(() => {
  if (!initializedWeekRef.current) {
    if (selectedTimelineId === 'twelve-week' && cycleWeeks.length > 0) {
      const currentWeekIndex = getCurrentWeekIndex();
setSelectedWeekIndex(currentWeekIndex >= 0 ? currentWeekIndex : cycleWeeks.length - 1);
      initializedWeekRef.current = true;
    } else if (selectedTimelineId && customTimelineWeeks.length > 0) {
      const now = new Date();
      const currentDateString = formatLocalDate(now);
      const currentWeekIndex = customTimelineWeeks.findIndex(
        w => currentDateString >= w.startDate && currentDateString <= w.endDate
      );
      setSelectedWeekIndex(currentWeekIndex >= 0 ? currentWeekIndex : 0);
      initializedWeekRef.current = true;
    }
  }
}, [selectedTimelineId, cycleWeeks, customTimelineWeeks, getCurrentWeekIndex]);

  // Fetch week-specific actions when week or goals change
  useEffect(() => {
  // Use the right weeks source based on the selected timeline
  const hasWeeks =
    selectedTimelineId === 'twelve-week'
      ? cycleWeeks.length > 0
      : customTimelineWeeks.length > 0;

  if (allGoals.length > 0 && hasWeeks) {
    fetchWeekActions();
  }
}, [selectedTimelineId, selectedWeekIndex, allGoals, cycleWeeks, customTimelineWeeks]);

  const fetchWeekActions = async () => {
    try {
      setLoadingWeekActions(true);

      // Use cycle weeks for 12-week timeline; use custom weeks otherwise
      const wk = selectedTimelineId === 'twelve-week'
        ? getWeekData(selectedWeekIndex)
        : (() => {
            const w = customTimelineWeeks[selectedWeekIndex];
            if (!w) return null;
            return {
              weekNumber: w.week_number,
              startDate: w.startDate,
              endDate: w.endDate,
            };
          })();

      if (!wk) {
        setWeekGoalActions({});
        return;
      }

      // Determine which goals to fetch actions for
      const goalsSource = selectedTimelineId === 'twelve-week' ? allGoals : customTimelineGoals;
      const goalIds = goalsSource.map(g => g.id);
      if (goalIds.length === 0) {
        setWeekGoalActions({});
        return;
      }

      // Guard against invalid dates
      const validStart = typeof wk.startDate === 'string' && wk.startDate !== 'null' && !isNaN(Date.parse(wk.startDate));
      const validEnd = typeof wk.endDate === 'string' && wk.endDate !== 'null' && !isNaN(Date.parse(wk.endDate));
      if (!validStart || !validEnd) {
        console.warn('Skipping fetchWeekActions due to invalid dates', { wk });
        setWeekGoalActions({});
        return;
      }

      const actions = await fetchGoalActionsForWeek(
        goalIds,
        wk.weekNumber,
        selectedTimelineId === 'custom' ? customTimelineWeeks : undefined
      );
      setWeekGoalActions(actions);
    } catch (err: any) {
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

  const handleWeekChange = (direction: 'prev' | 'next') => {
    // Only allow navigation if we have a valid week selection
    if (selectedWeekIndex === -1) return;
    
    const newIndex = direction === 'prev' 
      ? Math.max(0, selectedWeekIndex - 1)
      : Math.min(11, selectedWeekIndex + 1);
    
    setSelectedWeekIndex(newIndex);
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

    const startDate = safeParseDate(weekData.startDate, 'formatWeekHeader start');
    const endDate = safeParseDate(weekData.endDate, 'formatWeekHeader end');
    if (!startDate || !endDate) {
      return `Week ${weekData.weekNumber} — Invalid date`;
    }

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
    return safeFormatDateRange(currentCycle.start_date, currentCycle.end_date, 'current cycle');
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
    if (timelineId !== 'twelve-week') {
      // Load custom timeline data
      loadCustomTimelineData(timelineId);
    }
  };

  const loadCustomTimelineData = async (timelineId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get the custom timeline
      const { data: timeline, error: timelineError } = await supabase
        .from('0008-ap-custom-timelines')
        .select('*')
        .eq('id', timelineId)
        .eq('user_id', user.id)
        .single();

      if (timelineError) throw timelineError;
      if (!timeline) return;

      // Generate weeks for this custom timeline
      const startDate = safeParseDate(timeline?.start_date, 'loadCustomTimelineData start');
      const endDate = safeParseDate(timeline?.end_date, 'loadCustomTimelineData end');
      if (!startDate || !endDate) {
        console.warn('Skipping timeline calculation due to invalid start/end date', {
          start_date: timeline?.start_date,
          end_date: timeline?.end_date,
        });
        return; // or safely handle fallback (e.g., 0 days left)
      }

      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const totalWeeks = Math.ceil(totalDays / 7);

      const weeks = [];
      for (let i = 0; i < totalWeeks; i++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        // Don't let week end go past the timeline end date
        if (weekEnd > endDate) {
          weekEnd.setTime(endDate.getTime());
        }

        weeks.push({
          week_number: i + 1,
          startDate: formatLocalDate(weekStart),
          endDate: formatLocalDate(weekEnd),
          user_cycle_id: timelineId,
        });
      }

      setCustomTimelineWeeks(weeks);

      // Set initial week to current week or first week
      const now = new Date();
      const currentDateString = formatLocalDate(now);
      const currentWeekIndex = weeks.findIndex(week =>
        currentDateString >= week.startDate && currentDateString <= week.endDate
      );
      setSelectedWeekIndex(currentWeekIndex >= 0 ? currentWeekIndex : 0);

      // Load goals for this timeline
      const { data: goalData, error: goalsError } = await supabase
        .from('0008-ap-goals-custom')
        .select('*')
        .eq('custom_timeline_id', timelineId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (goalsError) throw goalsError;

      const goalsWithType = (goalData || []).map(g => ({ ...g, goal_type: 'custom' }));
      setCustomTimelineGoals(goalsWithType);

      // Create mock progress for each goal
      const progress: Record<string, any> = {};
      goalsWithType.forEach(goal => {
        progress[goal.id] = {
          goalId: goal.id,
          currentWeek: Math.max(1, currentWeekIndex + 1),
          daysRemaining: Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
          weeklyActual: 0,
          weeklyTarget: 0,
          overallActual: 0,
          overallTarget: 0,
          overallProgress: 0,
        };
      });
      setCustomTimelineProgress(progress);

    } catch (error) {
      console.error('Error loading custom timeline data:', error);
      Alert.alert('Error', 'Failed to load timeline data');
    }
  };

  const handleBackToTimelines = () => {
    setSelectedTimelineId(null);
    setCustomTimelineWeeks([]);
    setCustomTimelineGoals([]);
    setCustomTimelineProgress({});
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
    
    // Add custom timelines
    customTimelines.forEach(tl => {
      const startDate = safeParseDate(tl.start_date, `timeline ${tl.id} start`);
      const endDate = safeParseDate(tl.end_date, `timeline ${tl.id} end`);
      if (!startDate || !endDate) {
        console.warn('Skipping timeline due to invalid dates', tl);
        return;
      }
      const now = new Date();
      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      timelines.push({
        id: tl.id,
        type: 'custom',
        title: tl.title,
        dateRange: safeFormatDateRange(tl.start_date, tl.end_date, `timeline ${tl.id}`),
        goalCount: tl.goals_count || 0,
        daysRemaining,
        color: '#7c3aed',
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
                setIsCustomTimelinesModalVisible(true);
              }}
            >
              <Plus size={20} color="#ffffff" />
              <Text style={styles.createTimelineButtonText}>Create Custom Timeline</Text>
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
            {daysLeftData?.days_left || calculateCycleProgress().daysRemaining} days left • Today is {(() => {
              const today = new Date();
              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const dayName = dayNames[today.getDay()];
              const monthName = monthNames[today.getMonth()];
              const dayNumber = today.getDate();
              return `${dayNumber} ${monthName} (${dayName})`;
            })()}
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
        </View>

        {/* Navigation Row */}
        {(cycleWeeks.length > 0 || customTimelineWeeks.length > 0) && (
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
                  Week {(() => {
                    if (selectedTimelineId === 'twelve-week') {
                      return getWeekData(selectedWeekIndex)?.weekNumber || 1;
                    } else {
                      return customTimelineWeeks[selectedWeekIndex]?.week_number || 1;
                    }
                  })()}
                </Text>
                <Text style={styles.weekDates}>
                  {(() => {
                    const weekData = selectedTimelineId === 'twelve-week'
                      ? getWeekData(selectedWeekIndex)
                      : customTimelineWeeks[selectedWeekIndex];
                    if (!weekData) return '';
                    const startDate = safeParseDate(weekData.startDate, 'week display start');
                    const endDate = safeParseDate(weekData.endDate, 'week display end');
                    if (!startDate || !endDate) return 'Invalid date';
                    return safeFormatDateRange(weekData.startDate, weekData.endDate);

                  })()}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.weekNavButton,
                  (selectedWeekIndex >= (selectedTimelineId === 'twelve-week' ? cycleWeeks.length : customTimelineWeeks.length) - 1 || loadingWeekActions) && styles.weekNavButtonDisabled
                ]}
                onPress={goNextWeek}
                disabled={selectedWeekIndex >= (selectedTimelineId === 'twelve-week' ? cycleWeeks.length : customTimelineWeeks.length) - 1 || loadingWeekActions}
              >
                <ChevronRight size={16} color={(selectedWeekIndex >= (selectedTimelineId === 'twelve-week' ? cycleWeeks.length : customTimelineWeeks.length) - 1 || loadingWeekActions) ? '#9ca3af' : '#0078d4'} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.expandButton} onPress={() => setGoalsExpanded(!goalsExpanded)}>
                <Text style={styles.expandButtonText}>{goalsExpanded ? 'Collapse' : 'Expand'}</Text>
                {goalsExpanded ? <ChevronUp size={16} color="#0078d4" /> : <ChevronDown size={16} color="#0078d4" />}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 12-Week Goals List */}
        {(loading) ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#1f6feb" />
          </View>
        ) : (twelveWeekGoals.length === 0) ? (
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
          <View style={[styles.goalsList, twoUp && styles.goalsListRow]}>
            {twelveWeekGoals.map(goal => {
              const progress = goalProgress[goal.id];
              const weekData = selectedTimelineId === 'twelve-week' 
                ? getWeekData(selectedWeekIndex)
                : customTimelineWeeks[selectedWeekIndex];
              const goalActions = weekGoalActions[goal.id] || [];
              if (!progress) return null;

              return (
                <View key={goal.id} style={[
                  styles.goalItem,
                ]}>
                  <GoalProgressCard
                    goal={goal}
                    expanded={goalsExpanded}
                    progress={progress}
                    week={weekData}
                    selectedWeekNumber={selectedTimelineId === 'twelve-week' ? weekData?.weekNumber : weekData?.week_number}
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
      </ScrollView>
    );
  } else {
    // Custom timeline view
    const timeline = customTimelines.find(t => t.id === selectedTimelineId);
    if (!timeline) return null;

    const weekData = customTimelineWeeks[selectedWeekIndex];

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
                <Text style={styles.cycleTitle}>{timeline.title}</Text>
              </View>
              <TouchableOpacity
                style={styles.editCycleButton}
                onPress={() => {
                  // Open timeline management for editing
                  setIsCustomTimelinesModalVisible(true);
                }}
              >
                <Text style={styles.editCycleButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.cycleDates}>
              {safeFormatDateRange(timeline.start_date, timeline.end_date, `timeline ${timeline.id}`)}
            </Text>
            <Text style={styles.activeGoalsInfo}>
              Custom Timeline • {customTimelineWeeks.length} weeks • {customTimelineGoals.length} active goal{customTimelineGoals.length !== 1 ? 's' : ''}
            </Text>
          </View>

          <View style={styles.cycleProgress}>
            <Text style={styles.cycleProgressLabel}>
              {(() => {
                const startDate = safeParseDate(timeline?.start_date, 'timeline header start');
                const endDate = safeParseDate(timeline?.end_date, 'timeline header end');
                if (!startDate || !endDate) {
                  console.warn('Skipping timeline calculation due to invalid start/end date', {
                    start_date: timeline?.start_date,
                    end_date: timeline?.end_date,
                  });
                  return 0;
                }
                const now = new Date();
                return Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
              })()} days left • Today is {(() => {
                const today = new Date();
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const dayName = dayNames[today.getDay()];
                const monthName = monthNames[today.getMonth()];
                const dayNumber = today.getDate();
                return `${dayNumber} ${monthName} (${dayName})`;
              })()}
            </Text>
            <View style={styles.cycleProgressBar}>
              <View
                style={[
                  styles.cycleProgressFill,
                  { width: `${(() => {
    if (!timeline?.start_date || !timeline?.end_date || timeline.start_date === 'null' || timeline.end_date === 'null') {
      console.warn('Skipping progress bar calculation due to invalid start/end date', {
        start_date: timeline?.start_date,
        end_date: timeline?.end_date,
      });
      return 0;
    }
    const startDate = safeParseDate(timeline.start_date, 'progress start');
    const endDate = safeParseDate(timeline.end_date, 'progress end');
    if (!startDate || !endDate) return 0;
    const now = new Date();
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const daysPassed = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    return Math.min(100, (daysPassed / totalDays) * 100);
  })()}%` }

                ]}
              />
            </View>
          </View>
        </View>

        {/* Week Navigation for Custom Timeline */}
        {customTimelineWeeks.length > 0 && (
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
                  Week {customTimelineWeeks[selectedWeekIndex]?.week_number || 1}
                </Text>
                <Text style={styles.weekDates}>
                  {(() => {
                    const weekData = customTimelineWeeks[selectedWeekIndex];
                    if (!weekData) return '';
                    const startDate = safeParseDate(weekData.startDate, 'custom timeline week start');
                    const endDate = safeParseDate(weekData.endDate, 'custom timeline week end');
                    if (!startDate || !endDate) return 'Invalid date';
                    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
                  })()}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.weekNavButton,
                  (selectedWeekIndex >= customTimelineWeeks.length - 1 || loadingWeekActions) && styles.weekNavButtonDisabled
                ]}
                onPress={goNextWeek}
                disabled={selectedWeekIndex >= customTimelineWeeks.length - 1 || loadingWeekActions}
              >
                <ChevronRight size={16} color={(selectedWeekIndex >= customTimelineWeeks.length - 1 || loadingWeekActions) ? '#9ca3af' : '#0078d4'} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.expandButton} onPress={() => setGoalsExpanded(!goalsExpanded)}>
                <Text style={styles.expandButtonText}>{goalsExpanded ? 'Collapse' : 'Expand'}</Text>
                {goalsExpanded ? <ChevronUp size={16} color="#0078d4" /> : <ChevronDown size={16} color="#0078d4" />}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Custom Timeline Goals List */}
        {customTimelineGoals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Goals in Timeline Yet</Text>
            <Text style={styles.emptyText}>
              Create your first goal for this custom timeline.
            </Text>
            <TouchableOpacity
              style={styles.createGoalButton}
              onPress={() => {
                setInitialGoalType('custom');
                setCreateGoalModalVisible(true);
              }}
            >
              <Plus color="#ffffff" />
              <Text style={styles.createGoalButtonText}>Create Custom Goal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.goalsList}>
            {customTimelineGoals.map(goal => {
              const progress = customTimelineProgress[goal.id];
              const goalActions = weekGoalActions[goal.id] || [];
              if (!progress) return null;

              return (
                <View key={goal.id} style={styles.goalItem}>
                  <GoalProgressCard
                    goal={goal}
                    expanded={goalsExpanded}
                    progress={progress}
                    week={weekData}
                    selectedWeekNumber={weekData?.week_number}
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
      </ScrollView>
    );
  }
};

  const currentWeek = getWeekData(selectedWeekIndex);
  
  // Don't render week-dependent content until we have a valid week selection
  if (selectedWeekIndex === -1 || !currentWeek) {
    return (
      <SafeAreaView style={styles.container}>
        <Header 
          title="Goal Bank" 
          authenticScore={authenticScore}
          daysRemaining={daysLeftData?.days_left}
          cycleProgressPercentage={daysLeftData?.pct_elapsed}
          cycleTitle={currentCycle?.title}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading current week...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Goal Bank" 
        authenticScore={authenticScore}
        daysRemaining={selectedTimelineId === 'twelve-week' ? daysLeftData?.days_left : (() => {
          if (!selectedTimelineId || selectedTimelineId === 'twelve-week') return undefined;
          const timeline = customTimelines.find(t => t.id === selectedTimelineId);
          if (!timeline) return undefined;
          const endDate = safeParseDate(timeline.end_date, 'header daysRemaining end');
          if (!endDate) {
            console.warn('Skipping daysRemaining calculation due to invalid end date', timeline);
            return undefined;
          }
          const now = new Date();
          return Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        })()}
        cycleProgressPercentage={selectedTimelineId === 'twelve-week' ? daysLeftData?.pct_elapsed : (() => {
          if (!selectedTimelineId || selectedTimelineId === 'twelve-week') return undefined;
          const timeline = customTimelines.find(t => t.id === selectedTimelineId);
          if (!timeline) return undefined;
          const startDate = safeParseDate(timeline.start_date, 'header progress start');
          const endDate = safeParseDate(timeline.end_date, 'header progress end');
          if (!startDate || !endDate) {
            console.warn('Skipping cycleProgressPercentage due to invalid dates', timeline);
            return undefined;
          }
          const now = new Date();
          const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const daysPassed = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
          return Math.min(100, (daysPassed / totalDays) * 100);
        })()}
        cycleTitle={selectedTimelineId === 'twelve-week' ? currentCycle?.title : (() => {
          if (!selectedTimelineId || selectedTimelineId === 'twelve-week') return undefined;
          const timeline = customTimelines.find(t => t.id === selectedTimelineId);
          return timeline?.title;
        })()}
        onEditPress={() => setIsCustomTimelinesModalVisible(true)}
      />
      
      <>
      {selectedTimelineId ? (
        renderSelectedTimeline()
      ) : (currentCycle || customTimelines.length > 0) ? (
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
          if (selectedTimelineId === 'twelve-week') {
            setInitialGoalType('12week');
          } else if (selectedTimelineId) {
            setInitialGoalType('custom');
          } else {
            setInitialGoalType('12week');
          }
          setCreateGoalModalVisible(true);
        }}
      >
        <Plus size={24} color="#ffffff" />
      </TouchableOpacity>
      </>

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

      {/* Manage Custom Timelines Modal */}
      <ManageCustomTimelinesModal
        visible={isCustomTimelinesModalVisible}
        onClose={() => {
          setIsCustomTimelinesModalVisible(false);
          fetchCustomTimelines();
        }}
        onUpdate={fetchCustomTimelines}
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
        cycleWeeks={selectedTimelineId === 'twelve-week' ? cycleWeeks : customTimelineWeeks}
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
                  progress={goalProgress[selectedGoalForModal.id] || customTimelineProgress[selectedGoalForModal.id] || {
                    goalId: selectedGoalForModal.id,
                    currentWeek: 1,
                    daysRemaining: 0,
                    weeklyActual: 0,
                    weeklyTarget: 0,
                    overallActual: 0,
                    overallTarget: 0,
                    overallProgress: 0,
                  }}
                  week={selectedTimelineId === 'twelve-week' ? getWeekData(selectedWeekIndex) : customTimelineWeeks[selectedWeekIndex]}
                  selectedWeekNumber={selectedTimelineId === 'twelve-week' ? getWeekData(selectedWeekIndex)?.weekNumber : customTimelineWeeks[selectedWeekIndex]?.week_number}
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
    paddingHorizontal: 8,
    paddingVertical: 16,
    marginTop: 12,
    gap: 12,
  },
  goalsListRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  goalItem: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
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
    maxWidth: Platform.OS === 'web' ? '48%' : '100%',
    alignSelf: Platform.OS === 'web' ? 'auto' : 'stretch',
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