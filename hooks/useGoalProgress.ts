import { useState, useEffect } from 'react';
import { useGoals } from './useGoals';
import { getSupabaseClient } from '../lib/supabase';
import { formatLocalDate } from '../lib/dateUtils';

// Type definitions
interface UseGoalProgressOptions {
  scope?: string;
}

interface WeekData {
  weekNumber: number;
  startDate: string;
  endDate: string;
}

interface GoalProgress {
  [goalId: string]: any;
}

interface CycleEffortData {
  totalActual: number;
  totalTarget: number;
  overallPercentage: number;
}

interface Goal {
  id: string;
  title: string;
  [key: string]: any;
}

interface Timeline {
  id: string;
  source: 'global' | 'custom';
  [key: string]: any;
}

interface TaskWithLogs {
  id: string;
  title: string;
  [key: string]: any;
}

export function useGoalProgress(options: UseGoalProgressOptions = {}) {
  // State variables
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedTimeline, setSelectedTimeline] = useState<Timeline | null>(null);
  const [availableTimelines, setAvailableTimelines] = useState<Timeline[]>([]);
  const [cycleWeeks, setCycleWeeks] = useState<any[]>([]);
  const [daysLeftData, setDaysLeftData] = useState<any>(null);
  const [goalProgress, setGoalProgress] = useState<GoalProgress>({});
  const [cycleEffortData, setCycleEffortData] = useState<CycleEffortData>({ totalActual: 0, totalTarget: 0, overallPercentage: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingWeekActions, setLoadingWeekActions] = useState(false);
  const [weekGoalActions, setWeekGoalActions] = useState<any[]>([]);

  // Import functions from useGoals
  const {
    createTwelveWeekGoal,
    createCustomGoal,
    createTaskWithWeekPlan,
    deleteTask,
    refreshGoals: refreshGoalsFromUseGoals
  } = useGoals();

  // Placeholder functions - these need to be implemented
  const fetchAvailableTimelines = async (): Promise<Timeline | null> => {
    // TODO: Implement this function
    return null;
  };

  const fetchCycleWeeks = async (timeline: Timeline): Promise<any[]> => {
    // TODO: Implement this function
    return [];
  };

  const fetchDaysLeftData = async (timeline: Timeline): Promise<any> => {
    // TODO: Implement this function
    return null;
  };

  const fetchGoalsForTimeline = async (timeline: Timeline): Promise<void> => {
    // TODO: Implement this function
  };

  const getTodayActionSuggestions = async (): Promise<any[]> => {
    // TODO: Implement this function
    return [];
  };

  const fetchTasksAndPlansForWeek = async (weekNumber: number): Promise<TaskWithLogs[]> => {
    if (!selectedTimeline || !cycleWeeks || cycleWeeks.length === 0) return [];

    const wk = cycleWeeks.find(w => w.week_number === weekNumber);
    if (!wk) return [];
    const weekStartISO = wk.week_start;
    const weekEndISO = wk.week_end;

    const supabase = getSupabaseClient();

    let query = supabase
      .from('0008-ap-tasks')
      .select(`
        *,
        0008-ap-task-week-plan!inner(target_days)
      `)
      .eq('type', 'task')
      .gte('due_date', weekStartISO)
      .lte('due_date', weekEndISO);

    // Filter by timeline
    if (selectedTimeline.source === 'global') {
      query = query
        .eq('is_twelve_week_goal', true)
        .eq('0008-ap-task-week-plan.user_global_timeline_id', selectedTimeline.id);
    } else {
      query = query
        .eq('custom_timeline_id', selectedTimeline.id)
        .eq('0008-ap-task-week-plan.user_custom_timeline_id', selectedTimeline.id);
    }

    const { data: tasks, error } = await query;

    if (error) {
      console.error('Error fetching tasks for week:', error);
      return [];
    }

    return tasks || [];
  };

  const fetchGoalActionsForWeek = async (weekNumber: number): Promise<any[]> => {
    if (!selectedTimeline || !cycleWeeks || cycleWeeks.length === 0) return [];

    const wk = cycleWeeks.find(w => w.week_number === weekNumber);
    if (!wk) return [];

    const supabase = getSupabaseClient();

    let weekPlanQuery = supabase
      .from('0008-ap-task-week-plan')
      .select('target_days')
      .in('task_id', []);

    // Filter by timeline
    if (selectedTimeline.source === 'global') {
      weekPlanQuery = weekPlanQuery.eq('user_global_timeline_id', selectedTimeline.id);
    } else {
      weekPlanQuery = weekPlanQuery.eq('user_custom_timeline_id', selectedTimeline.id);
    }

    const { data: weekPlans, error: weekPlanError } = await weekPlanQuery;

    if (weekPlanError) {
      console.error('Error fetching week plans:', weekPlanError);
      return [];
    }

    return weekPlans || [];
  };

  const toggleTaskDay = async (taskId: string, date: string): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.rpc('ap_toggle_task_day', {
        p_task_id: taskId,
        p_date: date
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error toggling task day:', error);
      throw error;
    }
  };

  const completeActionSuggestion = async ({
    parentTaskId,
    whenISO,
  }: {
    parentTaskId: string;
    whenISO: string;
  }): Promise<string> => {
    const supabase = getSupabaseClient();

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user || !selectedTimeline) throw new Error('Missing user or selected timeline');

    const { data: parent, error: pErr } = await supabase
      .from('0008-ap-tasks')
      .select('id, title')
      .eq('id', parentTaskId)
      .single();
    if (pErr || !parent) throw pErr ?? new Error('Parent task not found');

    // Create occurrence with conditional timeline FK
    const occurrencePayload: any = {
      user_id: user.id,
      title: parent.title,
      type: 'task',
      status: 'completed',
      due_date: whenISO,
      completed_at: new Date().toISOString(),
      parent_task_id: parentTaskId,
      is_twelve_week_goal: selectedTimeline.source === 'global',
      // Only set custom_timeline_id for custom timelines
      ...(selectedTimeline.source === 'custom' ? { custom_timeline_id: selectedTimeline.id } : {}),
    };

    const { data: occ, error: oErr } = await supabase
      .from('0008-ap-tasks')
      .insert(occurrencePayload)
      .select('id')
      .single();
    if (oErr || !occ) throw oErr ?? new Error('Failed to insert occurrence');

    const occId = occ.id as string;

    // Copy universal joins from parent task
    await Promise.all([
      supabase.rpc('ap_copy_universal_roles_to_task', {
        from_parent_id: parentTaskId,
        to_task_id: occId,
      }),
      supabase.rpc('ap_copy_universal_domains_to_task', {
        from_parent_id: parentTaskId,
        to_task_id: occId,
      }),
      supabase.rpc('ap_copy_universal_goals_to_task', {
        from_parent_id: parentTaskId,
        to_task_id: occId,
      }),
    ]);

    return occId;
  };

  const undoActionOccurrence = async ({
    parentTaskId,
    whenISO,
  }: {
    parentTaskId: string;
    whenISO: string;
  }): Promise<number> => {
    const supabase = getSupabaseClient();

    const { error, count } = await supabase
      .from('0008-ap-tasks')
      .delete({ count: 'exact' })
      .eq('parent_task_id', parentTaskId)
      .eq('due_date', whenISO)
      .eq('status', 'completed');

    if (error) throw error;
    return typeof count === 'number' ? count : 0;
  };

  /* --------------------------------
   * WEEK UTILITIES (progress-specific)
   * -------------------------------- */
  const getCurrentWeekNumber = () => {
    if (!cycleWeeks || cycleWeeks.length === 0) return null;

    const now = new Date();
    const currentDateString = formatLocalDate(now);

    const currentWeekData = cycleWeeks.find(
      week =>
        week.week_start &&
        week.week_end &&
        currentDateString >= week.week_start &&
        currentDateString <= week.week_end
    );

    if (currentWeekData) return currentWeekData.week_number;

    const lastWeek = cycleWeeks[cycleWeeks.length - 1];
    if (currentDateString > lastWeek.week_end) return lastWeek.week_number;

    const firstWeek = cycleWeeks[0];
    if (currentDateString < firstWeek.week_start) return firstWeek.week_number;

    return 1;
  };

  const getCurrentWeekIndex = (): number => {
    const n = getCurrentWeekNumber();
    return typeof n === 'number' && !Number.isNaN(n) ? Math.max(0, n - 1) : 0;
  };

  const getWeekData = (weekIndex: number): WeekData | null => {
    const weekNumber = weekIndex + 1;
    const weekData = cycleWeeks.find(w => w.week_number === weekNumber);
    if (!weekData) return null;

    return {
      weekNumber,
      startDate: weekData.week_start,
      endDate: weekData.week_end,
    };
  };

  const getWeekDateRange = (weekNumber: number): { start: string; end: string } | null => {
    const weekData = cycleWeeks.find(w => w.week_number === weekNumber);
    return weekData ? { start: weekData.week_start, end: weekData.week_end } : null;
  };

  /* --------------------------------
   * REFRESH ORCHESTRATION (progress-specific)
   * -------------------------------- */
  const refreshAllData = async () => {
    try {
      const timeline = await fetchAvailableTimelines();
      console.log('Timeline returned from fetchAvailableTimelines:', timeline);

      if (!timeline) {
        console.log('No active timeline found, clearing all data');
        setCycleWeeks([]);
        setDaysLeftData(null);
        setGoals([]);
        setGoalProgress({});
        setCycleEffortData({ totalActual: 0, totalTarget: 0, overallPercentage: 0 });
        return;
      }

      console.log('Using timeline ID for data fetching:', timeline.id);

      const [weeks, daysLeft] = await Promise.all([
        fetchCycleWeeks(timeline),
        fetchDaysLeftData(timeline)
      ]);

      console.log('Fetched weeks:', weeks?.length || 0);
      console.log('Fetched days left data:', daysLeft);

      await fetchGoalsForTimeline(timeline);
    } catch (error) {
      console.error('Error refreshing all data:', error);
    }
  };

  const refreshGoals = async () => {
    if (selectedTimeline) {
      await fetchGoalsForTimeline(selectedTimeline);
    } else {
      // Also refresh the useGoals data
      await refreshGoalsFromUseGoals();
    }
  };

  /* --------------------------------
   * Effects
   * -------------------------------- */
  useEffect(() => {
    refreshAllData();
  }, [options.scope]);

  useEffect(() => {
    if (!selectedTimeline) return;

    const updateDaysLeft = () => {
      fetchDaysLeftData(selectedTimeline);
    };

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    const midnightTimeout = setTimeout(() => {
      updateDaysLeft();
      const dailyInterval = setInterval(updateDaysLeft, 24 * 60 * 60 * 1000);
      return () => clearInterval(dailyInterval);
    }, msUntilMidnight);

    return () => clearTimeout(midnightTimeout);
  }, [selectedTimeline]);

  /* --------------------------------
   * Return API - PROGRESS + ANALYTICS ONLY
   * -------------------------------- */
  return {
    // State
    goals,
    selectedTimeline,
    availableTimelines,
    setSelectedTimeline,
    cycleWeeks,
    daysLeftData,
    goalProgress,
    cycleEffortData,
    loading,
    loadingWeekActions,
    setLoadingWeekActions,

    // Data refresh
    refreshGoals,
    refreshAllData,

    // Timeline & week utilities
    fetchTasksAndPlansForWeek,
    fetchGoalActionsForWeek,
    getCurrentWeekNumber,
    getCurrentWeekIndex,
    getWeekData,
    getWeekDateRange,

    // Action execution
    toggleTaskDay,
    completeActionSuggestion,
    undoActionOccurrence,
    getTodayActionSuggestions,

    // CRUD operations (imported from useGoals)
    createTwelveWeekGoal,
    createCustomGoal,
    createTaskWithWeekPlan,
    deleteTask,

    // Week actions state
    weekGoalActions,
    setWeekGoalActions,
  };
}