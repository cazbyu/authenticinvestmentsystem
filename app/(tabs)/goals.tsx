import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';
import { CreateGoalModal } from '@/components/goals/CreateGoalModal';
import { EditGoalModal } from '@/components/goals/EditGoalModal';
import ActionEffortModal from '@/components/goals/ActionEffortModal';
import { ManageCustomTimelinesModal } from '@/components/timelines/ManageCustomTimelinesModal';
import { ManageGlobalTimelinesModal } from '@/components/timelines/ManageGlobalTimelinesModal';
import { WithdrawalForm } from '@/components/journal/WithdrawalForm';
import { getSupabaseClient } from '@/lib/supabase';
import { useGoals, fetchGoalActionsForWeek } from '@/hooks/useGoals';
import { Plus, ChevronLeft, ChevronRight, Target, Users, CreditCard as Edit, Minus } from 'lucide-react-native';

interface Timeline {
  id: string;
  source: 'custom' | 'global';
  title?: string;
  start_date: string | null;
  end_date: string | null;
  timeline_type?: 'cycle' | 'project' | 'challenge' | 'custom';
}

interface TimelineWeek {
  week_number: number;
  start_date: string;
  end_date: string;
}

export default function Goals() {
  const [selectedTimeline, setSelectedTimeline] = useState<Timeline | null>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [weekGoalActions, setWeekGoalActions] = useState<Record<string, any[]>>({});
  const [loadingWeekActions, setLoadingWeekActions] = useState(false);
  const [authenticScore, setAuthenticScore] = useState(0);
  
  // Modal states
  const [createGoalModalVisible, setCreateGoalModalVisible] = useState(false);
  const [editGoalModalVisible, setEditGoalModalVisible] = useState(false);
  const [actionEffortModalVisible, setActionEffortModalVisible] = useState(false);
  const [manageCustomTimelinesModalVisible, setManageCustomTimelinesModalVisible] = useState(false);
  const [manageGlobalTimelinesModalVisible, setManageGlobalTimelinesModalVisible] = useState(false);
  const [withdrawalFormVisible, setWithdrawalFormVisible] = useState(false);
  const [timelineSelectorVisible, setTimelineSelectorVisible] = useState(false);
  
  // Selected items
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [selectedGoalForAction, setSelectedGoalForAction] = useState<any>(null);
  
  // Timeline data
  const [allTimelines, setAllTimelines] = useState<Timeline[]>([]);
  const [timelineWeeks, setTimelineWeeks] = useState<TimelineWeek[]>([]);
  const [timelineDaysLeft, setTimelineDaysLeft] = useState<any>(null);
  const [timelinesWithGoals, setTimelinesWithGoals] = useState<any[]>([]);
  
  // Refs for initialization
  const initializedWeekRef = useRef(false);
  
  // Local goals state for the selected timeline
  const [timelineGoals, setTimelineGoals] = useState<any[]>([]);
  const [timelineGoalProgress, setTimelineGoalProgress] = useState<Record<string, any>>({});

  // Use the goals hook with timeline scope
  const {
    loading,
    completeActionSuggestion,
    undoActionOccurrence,
    createTwelveWeekGoal,
    createCustomGoal,
    createTaskWithWeekPlan,
  } = useGoals();

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

  const fetchAllTimelines = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const timelines: Timeline[] = [];

      // Fetch custom timelines
      const { data: customData, error: customError } = await supabase
        .from('0008-ap-custom-timelines')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (customError) throw customError;

      if (customData) {
        customData.forEach(timeline => {
          timelines.push({
            id: timeline.id,
            source: 'custom',
            title: timeline.title,
            start_date: timeline.start_date,
            end_date: timeline.end_date,
            timeline_type: timeline.timeline_type,
          });
        });
      }

      // Fetch global timelines
      const { data: globalData, error: globalError } = await supabase
        .from('0008-ap-user-global-timelines')
        .select(`
          *,
          global_cycle:0008-ap-global-cycles(
            id,
            title,
            cycle_label,
            start_date,
            end_date,
            is_active
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (globalError) throw globalError;

      if (globalData) {
        globalData.forEach(timeline => {
          timelines.push({
            id: timeline.id,
            source: 'global',
            title: timeline.title || timeline.global_cycle?.title || timeline.global_cycle?.cycle_label,
            start_date: timeline.start_date,
            end_date: timeline.end_date,
          });
        });
      }

      setAllTimelines(timelines);
      
      // Fetch goal counts for each timeline
      await fetchTimelinesWithGoalCounts(timelines);

    } catch (error) {
      console.error('Error fetching timelines:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const fetchTimelinesWithGoalCounts = async (timelines: Timeline[]) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const timelinesWithCounts = await Promise.all(
        timelines.map(async (timeline) => {
          let goalCount = 0;
          let daysRemaining = 0;

          // Calculate days remaining
          if (timeline.start_date && timeline.end_date) {
            const now = new Date();
            const endDate = new Date(timeline.end_date);
            daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          }

          // Get goal count based on timeline source
          if (timeline.source === 'global') {
            // Count 12-week goals for global timelines
            const { data: twelveWeekGoals, error } = await supabase
              .from('0008-ap-goals-12wk')
              .select('id')
              .eq('user_id', user.id)
              .or(`user_global_timeline_id.eq.${timeline.id},global_cycle_id.eq.${timeline.id}`)
              .eq('status', 'active');

            if (!error) {
              goalCount = twelveWeekGoals?.length || 0;
            }
          } else if (timeline.source === 'custom') {
            // Count custom goals for custom timelines
            const { data: customGoals, error } = await supabase
              .from('0008-ap-goals-custom')
              .select('id')
              .eq('user_id', user.id)
              .eq('custom_timeline_id', timeline.id)
              .eq('status', 'active');

            if (!error) {
              goalCount = customGoals?.length || 0;
            }
          }

          return {
            ...timeline,
            goalCount,
            daysRemaining,
          };
        })
      );

      setTimelinesWithGoals(timelinesWithCounts);
    } catch (error) {
      console.error('Error fetching timeline goal counts:', error);
    }
  };

  const fetchTimelineGoals = async (timeline: Timeline) => {
    if (!timeline) {
      setTimelineGoals([]);
      setTimelineGoalProgress({});
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let goalsData: any[] = [];

      if (timeline.source === 'global') {
        // Fetch only 12-week goals for global timelines
        const { data, error } = await supabase
          .from('0008-ap-goals-12wk')
          .select('*')
          .eq('user_id', user.id)
          .or(`user_global_timeline_id.eq.${timeline.id},global_cycle_id.eq.${timeline.id}`)
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        goalsData = (data || []).map(goal => ({ ...goal, goal_type: '12week' }));
      } else if (timeline.source === 'custom') {
        // Fetch only custom goals for custom timelines
        const { data, error } = await supabase
          .from('0008-ap-goals-custom')
          .select('*')
          .eq('user_id', user.id)
          .eq('custom_timeline_id', timeline.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (error) throw error;
        goalsData = (data || []).map(goal => ({ ...goal, goal_type: 'custom' }));
      }

      if (goalsData.length === 0) {
        setTimelineGoals([]);
        setTimelineGoalProgress({});
        return;
      }

      const goalIds = goalsData.map(g => g.id);

      // Fetch related data for all goals
      const [
        { data: rolesData, error: rolesError },
        { data: domainsData, error: domainsError },
        { data: krData, error: krError }
      ] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label, color)').in('parent_id', goalIds).in('parent_type', ['goal', 'custom_goal']),
        supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', goalIds).in('parent_type', ['goal', 'custom_goal']),
        supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', goalIds).in('parent_type', ['goal', 'custom_goal'])
      ]);

      if (rolesError) throw rolesError;
      if (domainsError) throw domainsError;
      if (krError) throw krError;

      // Transform goals with related data
      const transformedGoals = goalsData.map(goal => ({
        ...goal,
        domains: domainsData?.filter(d => d.parent_id === goal.id).map(d => d.domain).filter(Boolean) || [],
        roles: rolesData?.filter(r => r.parent_id === goal.id).map(r => r.role).filter(Boolean) || [],
        keyRelationships: krData?.filter(kr => kr.parent_id === goal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
      }));

      setTimelineGoals(transformedGoals);

      // Calculate progress for these goals
      await calculateTimelineGoalProgress(transformedGoals, timeline);

    } catch (error) {
      console.error('Error fetching timeline goals:', error);
      Alert.alert('Error', (error as Error).message);
      setTimelineGoals([]);
      setTimelineGoalProgress({});
    }
  };

  const calculateTimelineGoalProgress = async (goals: any[], timeline: Timeline) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const progressData: Record<string, any> = {};
      const todayString = new Date().toISOString().split('T')[0];

      for (const goal of goals) {
        let currentWeek = 1;
        let daysRemaining = 0;
        let weeklyActual = 0;
        let weeklyTarget = 0;
        let overallActual = 0;
        let overallTarget = 0;

        if (timeline.source === 'global' && goal.goal_type === '12week') {
          // Use timeline weeks for 12-week goals
          currentWeek = getCurrentWeekIndex() + 1;
          daysRemaining = getDaysRemaining();
          weeklyTarget = goal.weekly_target || 0;
          overallTarget = goal.total_target || 0;

          // Calculate actual progress from task completions
          const { data: goalJoins } = await supabase
            .from('0008-ap-universal-goals-join')
            .select('parent_id')
            .eq('twelve_wk_goal_id', goal.id)
            .eq('parent_type', 'task');

          const taskIds = goalJoins?.map(gj => gj.parent_id) || [];

          if (taskIds.length > 0) {
            const currentWeekData = timelineWeeks[getCurrentWeekIndex()];
            if (currentWeekData) {
              const { data: weeklyOccurrences } = await supabase
                .from('0008-ap-tasks')
                .select('*')
                .in('parent_task_id', taskIds)
                .eq('status', 'completed')
                .gte('due_date', currentWeekData.start_date)
                .lte('due_date', currentWeekData.end_date);

              weeklyActual = weeklyOccurrences?.length || 0;
            }

            const { data: overallOccurrences } = await supabase
              .from('0008-ap-tasks')
              .select('*')
              .in('parent_task_id', taskIds)
              .eq('status', 'completed')
              .gte('due_date', timeline.start_date || '1900-01-01')
              .lte('due_date', timeline.end_date || '2100-12-31');

            overallActual = overallOccurrences?.length || 0;
          }
        } else if (timeline.source === 'custom' && goal.goal_type === 'custom') {
          // Calculate for custom goals
          if (timeline.start_date && timeline.end_date) {
            const startDate = new Date(timeline.start_date);
            const endDate = new Date(timeline.end_date);
            const now = new Date();
            daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            
            // Find current week for custom timeline
            const currentWeekData = timelineWeeks[getCurrentWeekIndex()];
            if (currentWeekData) {
              currentWeek = currentWeekData.week_number;
            }
          }

          // Custom goals don't have weekly/total targets like 12-week goals
          weeklyTarget = 0;
          overallTarget = 0;
          weeklyActual = 0;
          overallActual = goal.progress || 0;
        }

        const overallProgress = overallTarget > 0 ? Math.round((Math.min(overallActual, overallTarget) / overallTarget) * 100) : goal.progress || 0;

        progressData[goal.id] = {
          goalId: goal.id,
          currentWeek,
          daysRemaining,
          weeklyActual: Math.min(weeklyActual, weeklyTarget),
          weeklyTarget,
          overallActual: Math.min(overallActual, overallTarget),
          overallTarget,
          overallProgress,
        };
      }

      setTimelineGoalProgress(progressData);
    } catch (error) {
      console.error('Error calculating timeline goal progress:', error);
    }
  };

  const fetchTimelineWeeks = async (timeline: Timeline) => {
    try {
      const supabase = getSupabaseClient();
      
      if (timeline.source === 'custom') {
        // Fetch custom timeline weeks
        const { data: weeksData, error: weeksError } = await supabase
          .from('v_custom_timeline_weeks')
          .select('week_number, start_date, end_date')
          .eq('custom_timeline_id', timeline.id)
          .order('week_number', { ascending: true });

        if (weeksError) throw weeksError;

        const { data: daysData, error: daysError } = await supabase
          .from('v_custom_timeline_days_left')
          .select('*')
          .eq('custom_timeline_id', timeline.id)
          .single();

        if (daysError && daysError.code !== 'PGRST116') throw daysError;

        setTimelineWeeks((weeksData as TimelineWeek[]) || []);
        setTimelineDaysLeft(daysData);
      } else if (timeline.source === 'global') {
        // Fetch global timeline weeks
        const { data: weeksData, error: weeksError } = await supabase
          .from('v_user_global_timeline_weeks')
          .select('week_number, week_start, week_end')
          .eq('timeline_id', timeline.id)
          .order('week_number', { ascending: true });

        if (weeksError) throw weeksError;

        const { data: daysData, error: daysError } = await supabase
          .from('v_user_global_timeline_days_left')
          .select('*')
          .eq('timeline_id', timeline.id)
          .single();

        if (daysError && daysError.code !== 'PGRST116') throw daysError;

        // Map to consistent format
        const mappedWeeks: TimelineWeek[] = (weeksData || []).map((week: any) => ({
          week_number: week.week_number,
          start_date: week.week_start,
          end_date: week.week_end,
        }));

        setTimelineWeeks(mappedWeeks);
        setTimelineDaysLeft(daysData);
      }
    } catch (error) {
      console.error('Error fetching timeline weeks:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  useEffect(() => {
    calculateAuthenticScore();
    fetchAllTimelines();
  }, []);


  useEffect(() => {
    if (selectedTimeline) {
      fetchTimelineWeeks(selectedTimeline);
      fetchTimelineGoals(selectedTimeline);
    }
  }, [selectedTimeline]);

  const getCurrentWeekIndex = (): number => {
    if (!timelineWeeks || timelineWeeks.length === 0) return -1;

    const today = new Date().toISOString().slice(0, 10);

    const index = timelineWeeks.findIndex(
      w => today >= w.start_date && today <= w.end_date
    );

    if (index !== -1) return index;

    const firstWeek = timelineWeeks[0];
    const lastWeek = timelineWeeks[timelineWeeks.length - 1];
    if (today < firstWeek.start_date) return 0;
    if (today > lastWeek.end_date) return timelineWeeks.length - 1;

    return -1;
  };

  useEffect(() => {
    if (selectedTimeline && timelineWeeks.length > 0 && !initializedWeekRef.current) {
      const currentWeek = getCurrentWeekIndex();
      setCurrentWeekIndex(Math.max(0, currentWeek));
      initializedWeekRef.current = true;
    }
  }, [selectedTimeline, timelineWeeks]);

  const handleTimelineSelect = (timeline: Timeline) => {
    setSelectedTimeline(timeline);
    setCurrentWeekIndex(0);
    initializedWeekRef.current = false;
    setTimelineSelectorVisible(false);
  };

  const handleWeekNavigation = (direction: 'prev' | 'next') => {
    setCurrentWeekIndex(prev => {
      if (direction === 'prev') {
        return Math.max(0, prev - 1);
      } else {
        return Math.min(timelineWeeks.length - 1, prev + 1);
      }
    });
  };

  const handleToggleCompletion = async (actionId: string, date: string, currentlyCompleted: boolean) => {
    try {
      if (currentlyCompleted) {
        await undoActionOccurrence({ parentTaskId: actionId, whenISO: date });
      } else {
        await completeActionSuggestion({ parentTaskId: actionId, whenISO: date });
      }
      
      // Refresh week actions
      if (selectedTimeline && timelineWeeks.length > 0) {
        await fetchWeekActions();
      }
      
      // Refresh goals to update progress
      refreshGoals();
    } catch (error) {
      console.error('Error toggling completion:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const fetchWeekActions = async () => {
    if (!selectedTimeline || timelineWeeks.length === 0 || timelineGoals.length === 0) {
      setWeekGoalActions({});
      return;
    }

    setLoadingWeekActions(true);
    try {
      const currentWeek = timelineWeeks[currentWeekIndex];
      if (!currentWeek) {
        setWeekGoalActions({});
        return;
      }

      const goalIds = timelineGoals.map(g => g.id);
      const weekNumber = currentWeek.week_number;

      let actions: Record<string, any[]> = {};

      if (selectedTimeline.source === 'global') {
        actions = await fetchGoalActionsForWeek(goalIds, weekNumber, timelineWeeks);
      } else {
        const customWeeks = timelineWeeks.map((week: TimelineWeek) => ({
          weekNumber: week.week_number,
          startDate: week.start_date,
          endDate: week.end_date,
        }));
        actions = await fetchGoalActionsForWeek(goalIds, weekNumber, [], customWeeks);
      }

      setWeekGoalActions(actions);
    } catch (error) {
      console.error('Error fetching week actions:', error);
      setWeekGoalActions({});
    } finally {
      setLoadingWeekActions(false);
    }
  };

  useEffect(() => {
    if (selectedTimeline && timelineWeeks.length > 0 && timelineGoals.length > 0) {
      fetchWeekActions();
    }
  }, [selectedTimeline, timelineWeeks, timelineGoals, currentWeekIndex]);

  const handleCreateGoal = () => {
    if (!selectedTimeline) {
      Alert.alert('Select Timeline', 'Please select a timeline first');
      return;
    }
    setCreateGoalModalVisible(true);
  };

  const handleEditGoal = (goal: any) => {
    setSelectedGoal(goal);
    setEditGoalModalVisible(true);
  };

  const handleAddAction = (goal: any) => {
    if (selectedTimeline?.source !== 'global') {
      Alert.alert('Not Available', 'Actions can only be added to 12-week goals');
      return;
    }
    setSelectedGoalForAction(goal);
    setActionEffortModalVisible(true);
  };

  const handleGoalFormSuccess = () => {
    setCreateGoalModalVisible(false);
    if (selectedTimeline) {
      fetchTimelineGoals(selectedTimeline);
    }
  };

  const handleEditGoalSuccess = () => {
    setEditGoalModalVisible(false);
    setSelectedGoal(null);
    if (selectedTimeline) {
      fetchTimelineGoals(selectedTimeline);
    }
  };

  const handleActionEffortSuccess = () => {
    setActionEffortModalVisible(false);
    setSelectedGoalForAction(null);
    if (selectedTimeline) {
      fetchTimelineGoals(selectedTimeline);
    }
    fetchWeekActions();
  };

  const handleTimelinesUpdate = () => {
    fetchAllTimelines();
    if (selectedTimeline) {
      fetchTimelineGoals(selectedTimeline);
    }
  };

  const handleWithdrawalSuccess = () => {
    setWithdrawalFormVisible(false);
    calculateAuthenticScore();
  };

  const getCurrentWeek = () => {
    if (timelineWeeks.length > 0) {
      const week = timelineWeeks[currentWeekIndex];
      return week ? {
        weekNumber: week.week_number,
        startDate: week.start_date,
        endDate: week.end_date,
      } : null;
    }
    return null;
  };

  const getTimelineTitle = () => {
    if (!selectedTimeline) return 'Select Timeline';
    return selectedTimeline.title || 'Timeline';
  };

  const getTimelineSubtitle = () => {
    if (!selectedTimeline) return '';
    
    if (selectedTimeline.source === 'custom') {
      const typeLabel = selectedTimeline.timeline_type === 'project' ? 'Project' :
                       selectedTimeline.timeline_type === 'challenge' ? 'Challenge' :
                       selectedTimeline.timeline_type === 'cycle' ? 'Custom Cycle' :
                       'Custom Timeline';
      return typeLabel;
    } else if (selectedTimeline.source === 'global') {
      return 'Global Timeline';
    }
    return '';
  };

  const getDaysRemaining = () => {
    return timelineDaysLeft?.days_left || 0;
  };

  const getProgressPercentage = () => {
    return timelineDaysLeft?.pct_elapsed || 0;
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
      const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
      
      if (start.getFullYear() === end.getFullYear()) {
        if (start.getMonth() === end.getMonth()) {
          return `${start.getDate()} - ${end.getDate()} ${startMonth} ${start.getFullYear()}`;
        } else {
          return `${start.getDate()} ${startMonth} - ${end.getDate()} ${endMonth} ${start.getFullYear()}`;
        }
      } else {
        return `${start.getDate()} ${startMonth} ${start.getFullYear()} - ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
      }
    } catch (error) {
      return 'Invalid date range';
    }
  };

  const getTimelineTypeLabel = (timeline: any) => {
    if (timeline.source === 'custom') {
      switch (timeline.timeline_type) {
        case 'project': return 'Project Timeline';
        case 'challenge': return 'Challenge Timeline';
        case 'cycle': return 'Custom Cycle';
        default: return 'Custom Timeline';
      }
    } else if (timeline.source === 'global') {
      return 'Global Timeline';
    }
    return 'Timeline';
  };

  const getTimelineColor = (timeline: any) => {
    if (timeline.source === 'custom') {
      return '#7c3aed';
    } else if (timeline.source === 'global') {
      return '#059669';
    }
    return '#6b7280';
  };

  const handleTimelinePress = (timeline: any) => {
    setSelectedTimeline(timeline);
    setCurrentWeekIndex(0);
    initializedWeekRef.current = false;
  };

  const refreshGoals = () => {
    if (selectedTimeline) {
      fetchTimelineGoals(selectedTimeline);
    }
  };

  const renderTimelineSelector = () => {
    const customTimelines = allTimelines.filter(t => t.source === 'custom');
    const globalTimelines = allTimelines.filter(t => t.source === 'global');

    return (
      <Modal visible={timelineSelectorVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.selectorContainer}>
          <View style={styles.selectorHeader}>
            <Text style={styles.selectorTitle}>Select Timeline</Text>
            <TouchableOpacity onPress={() => setTimelineSelectorVisible(false)}>
              <Text style={styles.selectorCloseText}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.selectorContent}>
            {/* 12-Week Cycles */}
            {/* Custom Timelines */}
            <View style={styles.timelineGroup}>
              <View style={styles.timelineGroupHeader}>
                <Text style={styles.timelineGroupTitle}>Custom Timelines</Text>
                <TouchableOpacity
                  style={styles.manageCustomButton}
                  onPress={() => {
                    setTimelineSelectorVisible(false);
                    setManageCustomTimelinesModalVisible(true);
                  }}
                >
                  <Edit size={16} color="#7c3aed" />
                  <Text style={styles.manageCustomButtonText}>Manage</Text>
                </TouchableOpacity>
              </View>
              {customTimelines.length === 0 ? (
                <Text style={styles.emptyGroupText}>No custom timelines</Text>
              ) : (
                customTimelines.map(timeline => (
                  <TouchableOpacity
                    key={timeline.id}
                    style={[
                      styles.timelineOption,
                      selectedTimeline?.id === timeline.id && styles.selectedTimelineOption
                    ]}
                    onPress={() => handleTimelineSelect(timeline)}
                  >
                    <View style={styles.timelineOptionContent}>
                      <Text style={styles.timelineOptionTitle}>{timeline.title}</Text>
                      <Text style={styles.timelineOptionSubtitle}>
                        {timeline.timeline_type === 'project' ? 'Project' :
                         timeline.timeline_type === 'challenge' ? 'Challenge' :
                         timeline.timeline_type === 'cycle' ? 'Custom Cycle' :
                         'Custom Timeline'}
                      </Text>
                    </View>
                    {selectedTimeline?.id === timeline.id && (
                      <Text style={styles.selectedIndicator}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Global Timelines */}
            <View style={styles.timelineGroup}>
              <View style={styles.timelineGroupHeader}>
                <Text style={styles.timelineGroupTitle}>Global Timelines</Text>
                <TouchableOpacity
                  style={styles.manageGlobalButton}
                  onPress={() => {
                    setTimelineSelectorVisible(false);
                    setManageGlobalTimelinesModalVisible(true);
                  }}
                >
                  <Edit size={16} color="#0078d4" />
                  <Text style={styles.manageGlobalButtonText}>Manage</Text>
                </TouchableOpacity>
              </View>
              {globalTimelines.length === 0 ? (
                <Text style={styles.emptyGroupText}>No global timelines</Text>
              ) : (
                globalTimelines.map(timeline => (
                  <TouchableOpacity
                    key={timeline.id}
                    style={[
                      styles.timelineOption,
                      selectedTimeline?.id === timeline.id && styles.selectedTimelineOption
                    ]}
                    onPress={() => handleTimelineSelect(timeline)}
                  >
                    <View style={styles.timelineOptionContent}>
                      <Text style={styles.timelineOptionTitle}>{timeline.title}</Text>
                      <Text style={styles.timelineOptionSubtitle}>Global Timeline</Text>
                    </View>
                    {selectedTimeline?.id === timeline.id && (
                      <Text style={styles.selectedIndicator}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const currentWeek = getCurrentWeek();

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Goal Bank" 
        authenticScore={authenticScore}
        daysRemaining={getDaysRemaining()}
        cycleProgressPercentage={getProgressPercentage()}
        cycleTitle={getTimelineTitle()}
      />

      {/* Timeline Selector */}
      <View style={styles.timelineSelector}>
        <TouchableOpacity
          style={styles.timelineSelectorButton}
          onPress={() => setTimelineSelectorVisible(true)}
        >
          <View style={styles.timelineSelectorContent}>
            <Text style={styles.timelineSelectorTitle}>{getTimelineTitle()}</Text>
            <Text style={styles.timelineSelectorSubtitle}>{getTimelineSubtitle()}</Text>
          </View>
          <Text style={styles.timelineSelectorArrow}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Week Navigation */}
      {selectedTimeline && timelineWeeks.length > 0 && (
        <View style={styles.weekNavigation}>
          <TouchableOpacity
            style={[styles.weekNavButton, currentWeekIndex === 0 && styles.weekNavButtonDisabled]}
            onPress={() => handleWeekNavigation('prev')}
            disabled={currentWeekIndex === 0}
          >
            <ChevronLeft size={20} color={currentWeekIndex === 0 ? '#9ca3af' : '#0078d4'} />
          </TouchableOpacity>

          <View style={styles.weekInfo}>
            <Text style={styles.weekTitle}>
              Week {currentWeek?.weekNumber || 1}
            </Text>
            {currentWeek && (
              <Text style={styles.weekDates}>
                {new Date(currentWeek.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {' '}
                {new Date(currentWeek.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.weekNavButton, currentWeekIndex === timelineWeeks.length - 1 && styles.weekNavButtonDisabled]}
            onPress={() => handleWeekNavigation('next')}
            disabled={currentWeekIndex === timelineWeeks.length - 1}
          >
            <ChevronRight size={20} color={currentWeekIndex === timelineWeeks.length - 1 ? '#9ca3af' : '#0078d4'} />
          </TouchableOpacity>
        </View>
      )}

      {/* Goals List */}
      <ScrollView style={styles.content}>
        {!selectedTimeline ? (
          // Show timeline containers when no timeline is selected
          <View style={styles.timelinesContainer}>
            <View style={styles.timelinesHeader}>
              <Text style={styles.timelinesTitle}>Active Timelines</Text>
              <Text style={styles.timelinesSubtitle}>
                Select a timeline to view and manage your goals
              </Text>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0078d4" />
                <Text style={styles.loadingText}>Loading timelines...</Text>
              </View>
            ) : timelinesWithGoals.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Target size={64} color="#6b7280" />
                <Text style={styles.emptyTitle}>No Active Timelines</Text>
                <Text style={styles.emptyText}>
                  Create a timeline to start tracking your goals
                </Text>
                <View style={styles.createTimelineButtons}>
                  <TouchableOpacity
                    style={styles.createCustomButton}
                    onPress={() => setManageCustomTimelinesModalVisible(true)}
                  >
                    <Target size={20} color="#ffffff" />
                    <Text style={styles.createCustomButtonText}>Create Custom Timeline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.timelinesList}>
                {timelinesWithGoals.map(timeline => (
                  <TouchableOpacity
                    key={timeline.id}
                    style={[
                      styles.timelineContainer,
                      { borderLeftColor: getTimelineColor(timeline) }
                    ]}
                    onPress={() => handleTimelinePress(timeline)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.timelineContainerContent}>
                      <View style={styles.timelineContainerHeader}>
                        <View style={styles.timelineContainerInfo}>
                          <Text style={styles.timelineContainerTitle}>
                            {timeline.title}
                          </Text>
                          <Text style={styles.timelineContainerType}>
                            {getTimelineTypeLabel(timeline)}
                          </Text>
                        </View>
                        
                        <View style={styles.timelineContainerStats}>
                          <Text style={styles.timelineContainerGoalCount}>
                            {timeline.goalCount} goal{timeline.goalCount !== 1 ? 's' : ''}
                          </Text>
                          <Text style={[
                            styles.timelineContainerDaysRemaining,
                            { color: timeline.daysRemaining <= 7 ? '#dc2626' : '#6b7280' }
                          ]}>
                            {timeline.daysRemaining} days left
                          </Text>
                        </View>
                      </View>
                      
                      {timeline.start_date && timeline.end_date && (
                        <Text style={styles.timelineContainerDates}>
                          {formatDateRange(timeline.start_date, timeline.end_date)}
                        </Text>
                      )}
                      
                      {/* Progress bar */}
                      <View style={styles.timelineContainerProgress}>
                        <View style={styles.timelineProgressBar}>
                          <View
                            style={[
                              styles.timelineProgressFill,
                              {
                                width: `${(() => {
                                  if (!timeline.start_date || !timeline.end_date) return 0;
                                  const start = new Date(timeline.start_date);
                                  const end = new Date(timeline.end_date);
                                  const now = new Date();
                                  const total = end.getTime() - start.getTime();
                                  const elapsed = now.getTime() - start.getTime();
                                  return Math.min(100, Math.max(0, (elapsed / total) * 100));
                                })()}%`,
                                backgroundColor: getTimelineColor(timeline),
                              }
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
                
                {/* Add Timeline Buttons */}
                <View style={styles.addTimelineSection}>
                  <Text style={styles.addTimelineTitle}>Add Timeline</Text>
                  <View style={styles.addTimelineButtons}>
                    <TouchableOpacity
                      style={styles.addCustomTimelineButton}
                      onPress={() => setManageCustomTimelinesModalVisible(true)}
                    >
                      <Target size={16} color="#7c3aed" />
                      <Text style={styles.addCustomTimelineButtonText}>Custom Timeline</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.addGlobalTimelineButton}
                      onPress={() => setManageGlobalTimelinesModalVisible(true)}
                    >
                      <Users size={16} color="#059669" />
                      <Text style={styles.addGlobalTimelineButtonText}>Global Timeline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0078d4" />
            <Text style={styles.loadingText}>Loading goals...</Text>
          </View>
        ) : timelineGoals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Target size={64} color="#6b7280" />
            <Text style={styles.emptyTitle}>No Goals Yet</Text>
            <Text style={styles.emptyText}>
              Create your first goal for this timeline
            </Text>
            <TouchableOpacity
              style={styles.createGoalButton}
              onPress={handleCreateGoal}
            >
              <Plus size={20} color="#ffffff" />
              <Text style={styles.createGoalButtonText}>Create Goal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.goalsList}>
            {/* Back to Timelines Button */}
            <TouchableOpacity
              style={styles.backToTimelinesButton}
              onPress={() => setSelectedTimeline(null)}
            >
              <ChevronLeft size={20} color="#0078d4" />
              <Text style={styles.backToTimelinesButtonText}>Back to Timelines</Text>
            </TouchableOpacity>
            
            {timelineGoals.map(goal => {
              const progress = timelineGoalProgress[goal.id];
              const safeProgress = progress || {
                weeklyActual: 0,
                weeklyTarget: 0,
                overallActual: 0,
                overallTarget: 0,
                weeklyProgress: 0,
                overallProgress: 0
              };
              const weekActions = weekGoalActions[goal.id] || [];
              
              return (
                <GoalProgressCard
                  key={goal.id}
                  goal={goal}
                  progress={safeProgress}
                  expanded={true}
                  week={currentWeek}
                  weekActions={weekActions}
                  loadingWeekActions={loadingWeekActions}
                  onAddAction={selectedTimeline?.source === 'global' ? () => handleAddAction(goal) : undefined}
                  onToggleCompletion={handleToggleCompletion}
                  onEdit={() => handleEditGoal(goal)}
                  selectedWeekNumber={currentWeek?.weekNumber}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Buttons */}
      {selectedTimeline && (
        <>
          <TouchableOpacity 
            style={styles.fab} 
            onPress={handleCreateGoal}
          >
            <Plus size={24} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.withdrawalFab} 
            onPress={() => setWithdrawalFormVisible(true)}
          >
            <Minus size={20} color="#ffffff" />
          </TouchableOpacity>
        </>
      )}

      {/* Timeline Selector Modal */}
      {renderTimelineSelector()}

      {/* Modals */}
      <CreateGoalModal
        visible={createGoalModalVisible}
        onClose={() => setCreateGoalModalVisible(false)}
        onSubmitSuccess={handleGoalFormSuccess}
        createTwelveWeekGoal={createTwelveWeekGoal}
        createCustomGoal={createCustomGoal}
        selectedTimeline={selectedTimeline}
      />

      <EditGoalModal
        visible={editGoalModalVisible}
        onClose={() => setEditGoalModalVisible(false)}
        onUpdate={handleEditGoalSuccess}
        goal={selectedGoal}
      />

      <ActionEffortModal
        visible={actionEffortModalVisible}
        onClose={() => setActionEffortModalVisible(false)}
        goal={selectedGoalForAction}
        cycleWeeks={timelineWeeks}
        createTaskWithWeekPlan={createTaskWithWeekPlan}
        onSuccess={handleActionEffortSuccess}
      />

      <ManageCustomTimelinesModal
        visible={manageCustomTimelinesModalVisible}
        onClose={() => setManageCustomTimelinesModalVisible(false)}
        onUpdate={handleTimelinesUpdate}
      />

      <ManageGlobalTimelinesModal
        visible={manageGlobalTimelinesModalVisible}
        onClose={() => setManageGlobalTimelinesModalVisible(false)}
        onUpdate={handleTimelinesUpdate}
      />

      <WithdrawalForm
        visible={withdrawalFormVisible}
        onClose={() => setWithdrawalFormVisible(false)}
        onSubmitSuccess={handleWithdrawalSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  timelineSelector: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  timelineSelectorContent: {
    flex: 1,
  },
  timelineSelectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  timelineSelectorSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  timelineSelectorArrow: {
    fontSize: 12,
    color: '#6b7280',
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  weekNavButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  weekNavButtonDisabled: {
    opacity: 0.5,
  },
  weekInfo: {
    alignItems: 'center',
    flex: 1,
  },
  weekTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  weekDates: {
    fontSize: 14,
    color: '#6b7280',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  selectTimelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  selectTimelineButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  createGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  createGoalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  goalsList: {
    gap: 16,
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
  withdrawalFab: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  selectorContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  selectorCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0078d4',
  },
  selectorContent: {
    flex: 1,
    padding: 16,
  },
  timelineGroup: {
    marginBottom: 24,
  },
  timelineGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timelineGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  manageCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#7c3aed',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  manageCustomButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7c3aed',
  },
  manageGlobalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0078d4',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  manageGlobalButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0078d4',
  },
  emptyGroupText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  timelineOption: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedTimelineOption: {
    borderColor: '#0078d4',
    backgroundColor: '#f0f9ff',
  },
  timelineOptionContent: {
    flex: 1,
  },
  timelineOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  timelineOptionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  selectedIndicator: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0078d4',
  },
  timelinesContainer: {
    flex: 1,
  },
  timelinesHeader: {
    padding: 16,
    alignItems: 'center',
  },
  timelinesTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  timelinesSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  timelinesList: {
    padding: 16,
    gap: 16,
  },
  timelineContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineContainerContent: {
    flex: 1,
  },
  timelineContainerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  timelineContainerInfo: {
    flex: 1,
    marginRight: 12,
  },
  timelineContainerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  timelineContainerType: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  timelineContainerStats: {
    alignItems: 'flex-end',
  },
  timelineContainerGoalCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  timelineContainerDaysRemaining: {
    fontSize: 14,
    fontWeight: '500',
  },
  timelineContainerDates: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  timelineContainerProgress: {
    marginTop: 8,
  },
  timelineProgressBar: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  timelineProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  addTimelineSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  addTimelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  addTimelineButtons: {
    gap: 8,
  },
  addCustomTimelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addCustomTimelineButtonText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
  },
  addGlobalTimelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addGlobalTimelineButtonText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '600',
  },
  createTimelineButtons: {
    gap: 12,
    width: '100%',
  },
  createCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    justifyContent: 'center',
  },
  createCustomButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backToTimelinesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backToTimelinesButtonText: {
    color: '#0078d4',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
});