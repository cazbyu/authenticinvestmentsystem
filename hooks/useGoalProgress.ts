// hooks/useGoalProgress.ts
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { Alert } from 'react-native';
import { generateCycleWeeks, formatLocalDate, isValidISODate } from '@/lib/dateUtils';
import { fetchGoalActionsForWeek } from '@/hooks/fetchGoalActionsForWeek';
// Import CRUD functions from useGoals to avoid duplication
import { 
  useGoals, 
  type Goal, 
  type Timeline, 
  type TaskWeekPlan, 
  type UniversalGoalJoin,
  type TwelveWeekGoal,
  type CustomGoal
} from '@/hooks/useGoals';

/* ================================
 * PROGRESS-SPECIFIC INTERFACES
 * ================================ */
export type GoalType = 'twelve_wk_goal' | 'custom_goal';

export interface TaskLog {
  id: string;
  task_id: string;
  measured_on: string; // YYYY-MM-DD
  week_number: number;
  day_of_week?: number;
  weekly_target?: number;
  total_target?: number;
  value: number;
  created_at: string;
  completed?: boolean;
}

export interface TaskWithLogs {
  id: string;
  logs: TaskLog[];
  weeklyActual: number;
  weeklyTarget: number;
  goal_type?: '12week' | 'custom';
  [k: string]: any; // carry through task fields from DB
}

export interface CycleWeek {
  week_number: number;
  week_start: string; // YYYY-MM-DD
  week_end: string;   // YYYY-MM-DD
  timeline_id: string; // normalized field for global/custom timeline
}

export interface DaysLeftData {
  days_left: number;
  pct_elapsed: number;
  timeline_id: string;
}

export interface WeekData {
  weekNumber: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface WeeklyTaskData {
  task: any;
  weekPlan: TaskWeekPlan | null;
  logs: TaskLog[];
  completed: number;
  target: number;
  weeklyScore: number;
}

export interface GoalProgress {
  goalId: string;
  currentWeek: number;
  daysRemaining: number;
  weeklyActual: number;
  weeklyTarget: number;
  overallActual: number;
  overallTarget: number;
  overallProgress: number; // 0..100
}

export interface CycleEffortData {
  totalActual: number;
  totalTarget: number;
  overallPercentage: number;
}

// Re-export types for convenience
export type { TwelveWeekGoal, CustomGoal, Timeline };

/* ================================
 * HOOK OPTIONS
 * ================================ */
interface UseGoalProgressOptions {
  scope?: {
    type: 'user' | 'role' | 'domain' | 'key_relationship';
    id?: string;
  };
}

/* ================================
 * PROGRESS-FOCUSED HOOK
 * ================================ */
export function useGoalProgress(options: UseGoalProgressOptions = {}) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedTimeline, setSelectedTimeline] = useState<Timeline | null>(null);
  const [availableTimelines, setAvailableTimelines] = useState<Timeline[]>([]);
  const [cycleWeeks, setCycleWeeks] = useState<CycleWeek[]>([]);
  const [daysLeftData, setDaysLeftData] = useState<DaysLeftData | null>(null);
  const [goalProgress, setGoalProgress] = useState<Record<string, GoalProgress>>({});
  const [cycleEffortData, setCycleEffortData] = useState<CycleEffortData>({ totalActual: 0, totalTarget: 0, overallPercentage: 0 });
  const [weekGoalActions, setWeekGoalActions] = useState<Record<string, TaskWithLogs[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadingWeekActions, setLoadingWeekActions] = useState(false);

  // Import CRUD functions from useGoals hook
  const {
    createTwelveWeekGoal,
    createCustomGoal,
    createTaskWithWeekPlan,
    deleteTask,
    refreshGoals: refreshGoalsFromUseGoals,
  } = useGoals(options);

  /* --------------------------------
   * TIMELINE MANAGEMENT (progress-specific)
   * -------------------------------- */
  const fetchAvailableTimelines = async () => {
    try {
      console.log('=== FETCH AVAILABLE TIMELINES START ===');
      const supabase = getSupabaseClient();
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) {
        console.log('No authenticated user found');
        return null;
      }

      console.log('Fetching timelines for user:', user.id);

      const { data: globalTimelines, error: globalErr } = await supabase
        .from('0008-ap-user-global-timelines')
        .select(`
          *,
          global_cycle:0008-ap-global-cycles(
            id,
            title,
            cycle_label,
            start_date,
            end_date,
            reflection_end,
            is_active
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (globalErr) throw globalErr;

      const { data: customTimelines, error: customErr } = await supabase
        .from('0008-ap-custom-timelines')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (customErr) throw customErr;

      // Merge them into one array
      const allTimelines = [
        ...(globalTimelines ?? []).map(t => ({ ...t, source: 'global' as const })),
        ...(customTimelines ?? []).map(t => ({ ...t, source: 'custom' as const })),
      ];

      console.log('Raw timelines from database:', allTimelines?.length || 0);

      const hydratedTimelines = (allTimelines || []).map(timeline => {
        const effectiveStart = timeline.start_date ?? timeline.global_cycle?.start_date ?? null;
        const effectiveEnd = timeline.end_date ?? timeline.global_cycle?.end_date ?? null;

        return {
          ...timeline,
          start_date: effectiveStart,
          end_date: effectiveEnd,
          title: timeline.title ?? timeline.global_cycle?.title ?? null,
        };
      });

      console.log('Hydrated timelines:', hydratedTimelines.length);
      setAvailableTimelines(hydratedTimelines);

      // Auto-select a timeline if none selected
      if (!selectedTimeline && hydratedTimelines.length > 0) {
        const globalTimeline = hydratedTimelines.find(t => t.source === 'global');
        const chosenTimeline = globalTimeline || hydratedTimelines[0];
        console.log('Auto-selecting timeline:', {
          id: chosenTimeline.id,
          source: chosenTimeline.source,
          title: chosenTimeline.title
        });
        setSelectedTimeline(chosenTimeline);
        return chosenTimeline;
      }

      console.log('=== FETCH AVAILABLE TIMELINES END ===');
      return selectedTimeline;
    } catch (error) {
      console.error('Error fetching available timelines:', error);
      return null;
    }
  };

  /* --------------------------------
   * WEEK/DAY CALCULATIONS (progress-specific)
   * -------------------------------- */
  const fetchCycleWeeks = async (timeline: Timeline): Promise<CycleWeek[]> => {
  try {
    const supabase = getSupabaseClient();
    
    // Use unified view for both global and custom timelines
    const result = await supabase
      .from('v_unified_timeline_weeks')
      .select('week_number, week_start, week_end, timeline_id, source')
      .eq('timeline_id', timeline.id)
      .eq('source', timeline.source)
      .order('week_number', { ascending: true });

    if (result.error) throw result.error;

    const weeks: CycleWeek[] = result.data?.map(w => ({
      week_number: w.week_number,
      week_start: w.week_start,
      week_end: w.week_end,
      timeline_id: w.timeline_id,
    })) ?? [];

    return weeks;
  } catch (err) {
    console.error('Error fetching cycle weeks:', err);
    return [];
  }
};

  const fetchDaysLeftData = async (timeline: Timeline): Promise<DaysLeftData | null> => {
  try {
    const supabase = getSupabaseClient();

    // Use unified view for both global and custom timelines
    const { data, error } = await supabase
      .from('v_unified_timeline_days_left')
      .select('timeline_id, days_left, pct_elapsed, source')
      .eq('timeline_id', timeline.id)
      .eq('source', timeline.source)
      .single();

    if (error) throw error;

    return {
      timeline_id: data.timeline_id,
      days_left: data.days_left,
      pct_elapsed: data.pct_elapsed,
    };
  } catch (err) {
    console.error('Error fetching days left data:', err);
    return null;
  }
};

  /* --------------------------------
   * GOAL PROGRESS CALCULATIONS (progress-specific)
   * -------------------------------- */
  const fetchGoalsForTimeline = async (timeline?: Timeline | null) => {
    console.log('=== FETCH GOALS FOR TIMELINE START ===');
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user found in fetchGoalsForTimeline');
        setGoals([]);
        return;
      }

      const resolvedTimeline = timeline ?? selectedTimeline;

      if (!resolvedTimeline) {
        console.log('No timeline found in fetchGoalsForTimeline');
        setGoals([]);
        return;
      }

      console.log('Fetching goals for timeline:', resolvedTimeline.id);

      let goalsData: any[] = [];

      if (resolvedTimeline.source === 'global') {
        // Fetch 12-week goals for global timeline
        const { data, error } = await supabase
          .from('0008-ap-goals-12wk')
          .select('*')
          .eq('user_id', user.id)
          .eq('user_global_timeline_id', resolvedTimeline.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (error) throw error;
        goalsData = (data || []).map(goal => ({ ...goal, goal_type: '12week' }));
      } else {
        // Fetch custom goals for custom timeline
        const { data, error } = await supabase
          .from('0008-ap-goals-custom')
          .select('*')
          .eq('user_id', user.id)
          .eq('custom_timeline_id', resolvedTimeline.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (error) throw error;
        goalsData = (data || []).map(goal => ({ 
          ...goal, 
          goal_type: 'custom',
          weekly_target: 3, // Default weekly target for custom goals
          total_target: 100, // Default total target for custom goals
        }));
      }

      if (goalsData.length === 0) {
        setGoals([]);
        setGoalProgress({});
        setCycleEffortData({ totalActual: 0, totalTarget: 0, overallPercentage: 0 });
        return;
      }

      // Fetch related data
      const goalIds = goalsData.map(g => g.id);
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

      // Apply scope filtering if needed
      let filteredGoalIds = goalIds;
      if (options.scope && options.scope.type !== 'user' && options.scope.id) {
        const scopeId = options.scope.id;
        switch (options.scope.type) {
          case 'role': {
            const roleGoalIds = rolesData?.filter(r => r.role?.id === scopeId).map(r => r.parent_id) || [];
            filteredGoalIds = filteredGoalIds.filter(id => roleGoalIds.includes(id));
            break;
          }
          case 'domain': {
            const domainGoalIds = domainsData?.filter(d => d.domain?.id === scopeId).map(d => d.parent_id) || [];
            filteredGoalIds = filteredGoalIds.filter(id => domainGoalIds.includes(id));
            break;
          }
          case 'key_relationship': {
            const krGoalIds = krData?.filter(kr => kr.key_relationship?.id === scopeId).map(kr => kr.parent_id) || [];
            filteredGoalIds = filteredGoalIds.filter(id => krGoalIds.includes(id));
            break;
          }
        }
      }

      // Transform goals with related data
      const transformedGoals = goalsData
        .filter(goal => filteredGoalIds.includes(goal.id))
        .map(goal => ({
          ...goal,
          domains: domainsData?.filter(d => d.parent_id === goal.id).map(d => d.domain).filter(Boolean) || [],
          roles: rolesData?.filter(r => r.parent_id === goal.id).map(r => r.role).filter(Boolean) || [],
          keyRelationships: krData?.filter(kr => kr.parent_id === goal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
        }));

      console.log('Final transformed goals count:', transformedGoals.length);
      setGoals(transformedGoals);

      // Progress calculation only for goals with targets
      const goalsWithTargets = transformedGoals.filter(g => 
        g.weekly_target && g.total_target
      );
      
      if (goalsWithTargets.length > 0) {
        console.log('Calculating progress for', goalsWithTargets.length, 'goals');
        await calculateGoalProgress(goalsWithTargets, resolvedTimeline);
      }

      console.log('=== FETCH GOALS FOR TIMELINE END ===');
    } catch (error) {
      console.error('Error fetching goals for timeline:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------
   * TASK EXECUTION TRACKING (progress-specific)
   * -------------------------------- */
  const fetchTasksAndPlansForWeek = async (
    timeline: Timeline,
    weekNumber: number
  ): Promise<WeeklyTaskData[]> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Fetch tasks for this timeline with conditional FK
      let tasksQuery = supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('input_kind', 'count')
        .not('status', 'in', '(completed,cancelled)');

      // Apply conditional timeline FK filter
      if (timeline.source === 'global') {
        tasksQuery = tasksQuery.eq('user_global_timeline_id', timeline.id);
      } else {
        tasksQuery = tasksQuery.eq('user_custom_timeline_id', timeline.id);
      }

      const { data: tasksData, error: tasksError } = await tasksQuery;

      if (tasksError) throw tasksError;
      if (!tasksData || tasksData.length === 0) return [];

      const taskIds = tasksData.map(t => t.id);
     
      // Fetch week plans for this specific week with conditional FK
      let weekPlanQuery = supabase
        .from('0008-ap-task-week-plan')
        .select('*')
        .in('task_id', taskIds)
        .eq('week_number', weekNumber)
        .eq('user_cycle_id', timeline.id);

      const { data: weekPlansData, error: weekPlansError } = await weekPlanQuery;
      if (weekPlansError) throw weekPlansError;

      // Get the week date range
      const weekData = cycleWeeks.find(w => w.week_number === weekNumber);
      if (!weekData) return [];

      // Fetch task logs (occurrences) for this week's date range
      let weeklyQuery = supabase
        .from('0008-ap-tasks')
        .select('*')
        .in('parent_task_id', taskIds)
        .eq('status', 'completed');

      if (isValidISODate(weekData.week_start)) {
        weeklyQuery = weeklyQuery.gte('due_date', weekData.week_start);
      }
      if (isValidISODate(weekData.week_end)) {
        weeklyQuery = weeklyQuery.lte('due_date', weekData.week_end);
      }

      const { data: taskLogsData, error: taskLogsError } = await weeklyQuery;
      if (taskLogsError) throw taskLogsError;

      // Transform data into WeeklyTaskData format
      const weeklyTaskData: WeeklyTaskData[] = [];

      for (const task of tasksData) {
        const weekPlan = weekPlansData?.find(wp => wp.task_id === task.id) || null;
        const logs = taskLogsData?.filter(log => log.parent_task_id === task.id) || [];
        const completed = logs.length; // occurrences are completed rows
        const target = weekPlan?.target_days || 0;
        const weeklyScore = target > 0 ? Math.round((Math.min(completed, target) / target) * 100) : 0;

        const normalizedLogs: TaskLog[] = logs.map(occ => ({
          id: occ.id,
          task_id: task.id,
          measured_on: occ.due_date,
          week_number: weekNumber,
          day_of_week: new Date(occ.due_date).getDay(),
          value: 1,
          created_at: occ.created_at,
        }));

        weeklyTaskData.push({
          task,
          weekPlan,
          logs: normalizedLogs,
          completed,
          target,
          weeklyScore,
        });
      }

      return weeklyTaskData;
    } catch (error) {
      console.error('Error fetching tasks and plans for week:', error);
      return [];
    }
  };

  const calculateGoalProgress = async (goals: Goal[], timeline: Timeline) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const progressData: Record<string, GoalProgress> = {};

      // Current week and days remaining
      const currentWeek = getCurrentWeekNumber() ?? 1;
      const daysRemaining = daysLeftData?.days_left || 0;

      for (const goal of goals) {
        // Fetch parent action tasks linked to this goal with conditional FK
        const goalTypeField = goal.goal_type === '12week' ? 'twelve_wk_goal_id' : 'custom_goal_id';
        const goalTypeValue = goal.goal_type === '12week' ? 'twelve_wk_goal' : 'custom_goal';
        
        const { data: goalJoins } = await supabase
          .from('0008-ap-universal-goals-join')
          .select('parent_id')
          .eq(goalTypeField, goal.id)
          .eq('goal_type', goalTypeValue)
          .eq('parent_type', 'task');

        const taskIds = goalJoins?.map(gj => gj.parent_id) || [];

        if (taskIds.length === 0) {
          progressData[goal.id] = {
            goalId: goal.id,
            currentWeek,
            daysRemaining,
            weeklyActual: 0,
            weeklyTarget: goal.goal_type === '12week' ? (goal.weekly_target || 3) : 3,
            overallActual: 0,
            overallTarget: goal.goal_type === '12week' ? (goal.total_target || 36) : 100,
            overallProgress: 0,
          };
          continue;
        }

        // Current week date range
        const currentWeekData = cycleWeeks.find(w => w.week_number === currentWeek);
        let weeklyActual = 0;

        if (currentWeekData) {
          let weeklyQuery = supabase
            .from('0008-ap-tasks')
            .select('*')
            .in('parent_task_id', taskIds)
            .eq('status', 'completed');

          if (isValidISODate(currentWeekData.week_start)) {
            weeklyQuery = weeklyQuery.gte('due_date', currentWeekData.week_start);
          }
          if (isValidISODate(currentWeekData.week_end)) {
            weeklyQuery = weeklyQuery.lte('due_date', currentWeekData.week_end);
          }

          const { data: weeklyOccurrences } = await weeklyQuery;
          weeklyActual = weeklyOccurrences?.length || 0;
        }

        // Whole cycle completed occurrences
        let overallQuery = supabase
          .from('0008-ap-tasks')
          .select('*')
          .in('parent_task_id', taskIds)
          .eq('status', 'completed');

        if (timeline?.start_date && isValidISODate(timeline.start_date)) {
          overallQuery = overallQuery.gte('due_date', timeline.start_date);
        }
        if (timeline?.end_date && isValidISODate(timeline.end_date)) {
          overallQuery = overallQuery.lte('due_date', timeline.end_date);
        }

        const { data: overallOccurrences } = await overallQuery;

        // Sum targets across all week plans for these tasks with conditional FK
        let weekPlansQuery = supabase
          .from('0008-ap-task-week-plan')
          .select('target_days')
          .in('task_id', taskIds)
          .eq('user_cycle_id', timeline.id);

        const { data: weekPlansData, error: weekPlansError } = await weekPlansQuery;
        if (weekPlansError) throw weekPlansError;

        const overallActual = overallOccurrences?.length || 0;
        const overallTarget = weekPlansData?.reduce((sum, wp) => sum + (wp.target_days || 0), 0) || 0;

        const cappedOverallActual = Math.min(overallActual, overallTarget);
        const overallProgress = overallTarget > 0 ? Math.round((cappedOverallActual / overallTarget) * 100) : 0;

        progressData[goal.id] = {
          goalId: goal.id,
          currentWeek,
          daysRemaining,
          weeklyActual,
          weeklyTarget: goal.weekly_target || 3,
          overallActual: cappedOverallActual,
          overallTarget,
          overallProgress,
        };
      }

      setGoalProgress(progressData);

      // Overall cycle effort
      const totalActual = Object.values(progressData).reduce((sum, p) => sum + Math.min(p.overallActual, p.overallTarget), 0);
      const totalTarget = Object.values(progressData).reduce((sum, p) => sum + p.overallTarget, 0);
      const overallPercentage = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

      setCycleEffortData({
        totalActual,
        totalTarget,
        overallPercentage
      });
    } catch (error) {
      console.error('Error calculating goal progress:', error);
    }
  };

  /* --------------------------------
   * ACTION SUGGESTIONS & EXECUTION (progress-specific)
   * -------------------------------- */
  const getTodayActionSuggestions = async (): Promise<Array<{
    suggested: true;
    parent_task_id: string;
    timeline_id: string;
    timeline_source: 'global' | 'custom';
    date: string;
    remainingThisWeek: number;
  }>> => {
    try {
      if (!selectedTimeline || cycleWeeks.length === 0) return [];

      const supabase = getSupabaseClient();

      const weekNumber = getCurrentWeekNumber();
      const currentDateISO = formatLocalDate(new Date());

      const wk = cycleWeeks.find(w => w.week_number === weekNumber);
      if (!wk) return [];
      const weekStartISO = wk.week_start;
      const weekEndISO = wk.week_end;

      // Get task plans for this week with conditional FK
      let planQuery = supabase
        .from('0008-ap-task-week-plan')
        .select('task_id, target_days')
        .eq('week_number', weekNumber);

      // Apply conditional timeline FK filter
      if (selectedTimeline.source === 'global') {
        planQuery = planQuery.eq('user_global_timeline_id', selectedTimeline.id);
      } else {
        planQuery = planQuery.eq('user_custom_timeline_id', selectedTimeline.id);
      }

      const { data: planned, error: planErr } = await planQuery;
      if (planErr) throw planErr;

      const parentIds = (planned ?? []).map(p => p.task_id);
      if (parentIds.length === 0) return [];

      // fetch completed task occurrences for this week
      const { data: weekOcc, error: occErr } = await supabase
        .from('0008-ap-tasks')
        .select('parent_task_id, due_date')
        .in('parent_task_id', parentIds)
        .gte('due_date', weekStartISO)
        .lte('due_date', weekEndISO)
        .eq('status', 'completed');

      if (occErr) throw occErr;

      const completedByParent: Record<string, number> = {};
      for (const row of weekOcc ?? []) {
        completedByParent[row.parent_task_id] =
          (completedByParent[row.parent_task_id] ?? 0) + 1;
      }

      const out: Array<{
        suggested: true;
        parent_task_id: string;
        timeline_id: string;
        timeline_source: 'global' | 'custom';
        date: string;
        remainingThisWeek: number;
      }> = [];

      for (const p of planned ?? []) {
        const actual = completedByParent[p.task_id] ?? 0;
        const remaining = (p.target_days ?? 0) - actual;
        if (remaining > 0) {
          out.push({
            suggested: true as const,
            parent_task_id: p.task_id,
            timeline_id: selectedTimeline.id,
            timeline_source: selectedTimeline.source,
            date: currentDateISO,
            remainingThisWeek: remaining,
          });
        }
      }

      return out;
    } catch (e) {
      console.error('Error computing today suggestions:', e);
      return [];
    }
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