import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { Alert } from 'react-native';
import { generateCycleWeeks, formatLocalDate, parseLocalDate } from '../lib/dateUtils';

export interface TwelveWeekGoal {
  id: string;
  title: string;
  description?: string;
  status: string;
  progress: number;
  weekly_target: number;
  total_target: number;
  start_date?: string;
  end_date?: string;
  user_cycle_id?: string;
  created_at: string;
  updated_at: string;
  domains?: Array<{ id: string; name: string }>;
  roles?: Array<{ id: string; label: string; color?: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
  notes?: Array<{ content: string; created_at: string }>;
  goal_type: '12week';
}

export interface CustomGoal {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
  progress: number;
  created_at: string;
  updated_at: string;
  domains?: Array<{ id: string; name: string }>;
  roles?: Array<{ id: string; label: string; color?: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
  notes?: Array<{ content: string; created_at: string }>;
  goal_type: 'custom';
}

export type Goal = TwelveWeekGoal | CustomGoal;

export interface UserCycle {
  id: string;
  user_id: string;
  source: 'custom' | 'global';
  title?: string;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'completed' | 'archived';
  global_cycle_id?: string | null;
  created_at: string;
  updated_at: string;
  timezone?: string;
  week_start_day?: 'sunday' | 'monday';
}

export interface CycleWeek {
  week_number: number;
  week_start: string;
  week_end: string;
  user_cycle_id: string;
}

export interface DaysLeftData {
  days_left: number;
  pct_elapsed: number;
  user_cycle_id: string;
}

export interface TaskWeekPlan {
  id: string;
  task_id: string;
  user_cycle_id: string;
  week_number: number;
  target_days: number;
  created_at: string;
}

export interface TaskLog {
  id: string;
  task_id: string;
  measured_on: string;
  week_number: number;
  day_of_week?: number;
  value: number;
  created_at: string;
}

export interface TaskWithLogs extends Goal {
  logs: TaskLog[];
  weeklyActual: number;
  weeklyTarget: number;
}

export interface WeekData {
  weekNumber: number;
  startDate: string;
  endDate: string;
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
  overallProgress: number;
}

export interface CycleEffortData {
  totalActual: number;
  totalTarget: number;
  overallPercentage: number;
}

export async function fetchGoalActionsForWeek(
  goalIds: string[],
  weekNumber: number,
  cycleWeeks: CycleWeek[],
  customTimelineWeeks: WeekData[] = []
): Promise<Record<string, TaskWithLogs[]>> {
  try {
    const supabase = getSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user || goalIds.length === 0) return {};

    const week =
      cycleWeeks.find(w => w.week_number === weekNumber) ||
      customTimelineWeeks.find(
        w => w.week_number === weekNumber || (w as any).weekNumber === weekNumber
      );

    const weekStartDate = (week as any)?.week_start ?? (week as any)?.startDate;
    const weekEndDate = (week as any)?.week_end ?? (week as any)?.endDate;
    if (!weekStartDate || !weekEndDate) return {};

    const { data: goalJoins } = await supabase
      .from('0008-ap-universal-goals-join')
      .select('parent_id, twelve_wk_goal_id, custom_goal_id, goal_type')
      .or(`twelve_wk_goal_id.in.(${goalIds.join(',')}),custom_goal_id.in.(${goalIds.join(',')})`)
      .eq('parent_type', 'task');

    const taskIds = goalJoins?.map(gj => gj.parent_id) || [];
    if (taskIds.length === 0) return {};

    const { data: tasksData, error: tasksError } = await supabase
      .from('0008-ap-tasks')
      .select('*')
      .eq('user_id', user.id)
      .in('id', taskIds)
      .eq('input_kind', 'count')
      .not('status', 'in', '(completed,cancelled)');

    if (tasksError) throw tasksError;
    if (!tasksData || tasksData.length === 0) return {};

    const { data: weekPlansData, error: weekPlansError } = await supabase
      .from('0008-ap-task-week-plan')
      .select('*')
      .in('task_id', taskIds)
      .eq('week_number', weekNumber);

    if (weekPlansError) throw weekPlansError;

    const tasksWithWeekPlans = tasksData.filter(task =>
      weekPlansData?.some(wp => wp.task_id === task.id)
    );

    const { data: occurrenceData, error: occurrenceError } = await supabase
      .from('0008-ap-tasks')
      .select('*')
      .in('parent_task_id', tasksWithWeekPlans.map(t => t.id))
      .eq('status', 'completed')
      .gte('due_date', weekStartDate)
      .lte('due_date', weekEndDate);

    if (occurrenceError) throw occurrenceError;

    const groupedActions: Record<string, TaskWithLogs[]> = {};

    for (const task of tasksWithWeekPlans) {
      const goalJoin = goalJoins?.find(gj => gj.parent_id === task.id);
      if (!goalJoin) continue;

      const weekPlan = weekPlansData?.find(wp => wp.task_id === task.id);
      if (!weekPlan) continue;

      const goalId = goalJoin.twelve_wk_goal_id || goalJoin.custom_goal_id;
      if (!goalId) continue;

      const relevantOccurrences =
        occurrenceData?.filter(occ => occ.parent_task_id === task.id) || [];

      const taskLogs = relevantOccurrences.map(occ => ({
        id: occ.id,
        task_id: task.id,
        measured_on: occ.due_date,
        week_number: weekNumber,
        day_of_week: new Date(occ.due_date).getDay(),
        value: 1,
        completed: true,
        created_at: occ.created_at,
      }));

      const weeklyActual = taskLogs.length;
      const weeklyTarget = weekPlan.target_days;
      const cappedWeeklyActual = Math.min(weeklyActual, weeklyTarget);

      const taskWithLogs: TaskWithLogs = {
        ...task,
        goal_type: goalJoin.goal_type === 'twelve_wk_goal' ? '12week' : 'custom',
        logs: taskLogs,
        weeklyActual: cappedWeeklyActual,
        weeklyTarget,
      };

      if (!groupedActions[goalId]) {
        groupedActions[goalId] = [];
      }
      groupedActions[goalId].push(taskWithLogs);
    }

    return groupedActions;
  } catch (error) {
    console.error('Error fetching goal actions for week:', error);
    return {};
  }
}

interface UseGoalsOptions {
  scope?: {
    type: 'user' | 'role' | 'domain' | 'key_relationship';
    id?: string;
  };
}

export function useGoals(options: UseGoalsOptions = {}) {
  const [twelveWeekGoals, setTwelveWeekGoals] = useState<TwelveWeekGoal[]>([]);
  const [customGoals, setCustomGoals] = useState<CustomGoal[]>([]);
  const [allGoals, setAllGoals] = useState<Goal[]>([]);
  const [currentCycle, setCurrentCycle] = useState<UserCycle | null>(null);
  const [cycleWeeks, setCycleWeeks] = useState<CycleWeek[]>([]);
  const [daysLeftData, setDaysLeftData] = useState<DaysLeftData | null>(null);
  const [goalProgress, setGoalProgress] = useState<Record<string, GoalProgress>>({});
  const [cycleEffortData, setCycleEffortData] = useState<CycleEffortData>({ totalActual: 0, totalTarget: 0, overallPercentage: 0 });
  const [weekGoalActions, setWeekGoalActions] = useState<Record<string, TaskWithLogs[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadingWeekActions, setLoadingWeekActions] = useState(false);

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

  const fetchUserCycle = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) return null;

      const { data, error } = await supabase
        .from('0008-ap-user-cycles')
        .select(`
          *,
          global:0008-ap-global-cycles(id, start_date, end_date, title)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      const effectiveStart = data?.start_date ?? data?.global?.start_date ?? null;
      const effectiveEnd = data?.end_date ?? data?.global?.end_date ?? null;

      const hydrated = data
        ? {
            ...data,
            start_date: effectiveStart,
            end_date: effectiveEnd,
            title: data.title ?? data.global?.title ?? null,
          }
        : null;

      setCurrentCycle(hydrated as any);
      return hydrated;
    } catch (error) {
      console.error('Error fetching user cycle:', error);
      return null;
    }
  };

  const fetchCycleWeeks = async (userCycleId: string) => {
    try {
      const supabase = getSupabaseClient();
      
      const { data: dbWeeks, error } = await supabase
        .from('v_user_global_timeline_weeks')
        .select('week_number, start_date:week_start, end_date:week_end, user_global_timeline_id')
        .eq('timeline_id', userCycleId)
        .order('week_number', { ascending: true })
        .returns<CycleWeek[]>();

      if (error) {
        console.warn('Database week view failed, using client-side fallback:', error);
        setCycleWeeks([]);
        return [];
      }

      // Map database columns to expected interface
      const mappedWeeks = (dbWeeks ?? []).map(week => ({
        week_number: week.week_number,
        week_start: week.week_start,
        week_end: week.week_end,
        user_cycle_id: week.user_cycle_id,
      }));
      
      setCycleWeeks(mappedWeeks);
      return mappedWeeks;
    } catch (error) {
      console.error('Error fetching cycle weeks:', error);
      setCycleWeeks([]);
      return [];
    }
  };

  const fetchDaysLeftData = async (userCycleId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('v_user_global_timeline_days_left')
        .select('*')
        .eq('timeline_id', userCycleId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      setDaysLeftData(data);
      return data;
    } catch (error) {
      console.error('Error fetching days left data:', error);
      setDaysLeftData(null);
      return null;
    }
  };

  const fetchGoals = async (userCycleId?: string) => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch 12-week goals (only if we have an active cycle)
      let twelveWeekData: any[] = [];
      if (userCycleId) {
        // First get the user cycle details to determine how to query goals
        const { data: userCycle, error: cycleError } = await supabase
          .from('0008-ap-user-cycles')
          .select('source, global_cycle_id')
          .eq('id', userCycleId)
          .single();

        if (cycleError) throw cycleError;

        // Query goals based on the cycle source
        if (userCycle.source === 'global' && userCycle.global_cycle_id) {
          const { data, error } = await supabase
            .from('0008-ap-goals-12wk')
            .select('*')
            .eq('user_id', user.id)
            .eq('global_cycle_id', userCycle.global_cycle_id)
            .eq('status', 'active')
            .order('created_at', { ascending: false });
          
          if (error) throw error;
          twelveWeekData = data || [];
        } else if (userCycle.source === 'custom') {
          const { data, error } = await supabase
            .from('0008-ap-goals-12wk')
            .select('*')
            .eq('user_id', user.id)
            .eq('timeline_id', userCycleId)
            .eq('status', 'active')
            .order('created_at', { ascending: false });
          
          if (error) throw error;
          twelveWeekData = data || [];
        }
      }

      // Fetch custom goals (independent of cycles)
      const { data: customData, error: customError } = await supabase
        .from('0008-ap-goals-custom')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (customError) throw customError;

      const allGoalIds = [
        ...(twelveWeekData || []).map(g => g.id),
        ...(customData || []).map(g => g.id)
      ];

      if (allGoalIds.length === 0) {
        setTwelveWeekGoals([]);
        setCustomGoals([]);
        setAllGoals([]);
        setGoalProgress({});
        return;
      }

      // Fetch related data for all goals
      const [
        { data: rolesData, error: rolesError },
        { data: domainsData, error: domainsError },
        { data: krData, error: krError }
      ] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label, color)').in('parent_id', allGoalIds).in('parent_type', ['goal', 'custom_goal']),
        supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', allGoalIds).in('parent_type', ['goal', 'custom_goal']),
        supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', allGoalIds).in('parent_type', ['goal', 'custom_goal'])
      ]);

      if (rolesError) throw rolesError;
      if (domainsError) throw domainsError;
      if (krError) throw krError;

      // Apply scope filtering if specified
      let filteredTwelveWeekIds = (twelveWeekData || []).map(g => g.id);
      let filteredCustomIds = (customData || []).map(g => g.id);

      if (options.scope && options.scope.type !== 'user' && options.scope.id) {
        switch (options.scope.type) {
          case 'role':
            const roleGoalIds = rolesData?.filter(r => r.role?.id === options.scope!.id).map(r => r.parent_id) || [];
            filteredTwelveWeekIds = filteredTwelveWeekIds.filter(id => roleGoalIds.includes(id));
            filteredCustomIds = filteredCustomIds.filter(id => roleGoalIds.includes(id));
            break;
          case 'domain':
            const domainGoalIds = domainsData?.filter(d => d.domain?.id === options.scope!.id).map(d => d.parent_id) || [];
            filteredTwelveWeekIds = filteredTwelveWeekIds.filter(id => domainGoalIds.includes(id));
            filteredCustomIds = filteredCustomIds.filter(id => domainGoalIds.includes(id));
            break;
          case 'key_relationship':
            const krGoalIds = krData?.filter(kr => kr.key_relationship?.id === options.scope!.id).map(kr => kr.parent_id) || [];
            filteredTwelveWeekIds = filteredTwelveWeekIds.filter(id => krGoalIds.includes(id));
            filteredCustomIds = filteredCustomIds.filter(id => krGoalIds.includes(id));
            break;
        }
      }

      // Transform 12-week goals with related data
      const transformedTwelveWeekGoals = (twelveWeekData || [])
        .filter(goal => filteredTwelveWeekIds.includes(goal.id))
        .map(goal => ({
          ...goal,
          goal_type: '12week' as const,
          domains: domainsData?.filter(d => d.parent_id === goal.id).map(d => d.domain).filter(Boolean) || [],
          roles: rolesData?.filter(r => r.parent_id === goal.id).map(r => r.role).filter(Boolean) || [],
          keyRelationships: krData?.filter(kr => kr.parent_id === goal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
        }));

      // Transform custom goals with related data
      const transformedCustomGoals = (customData || [])
        .filter(goal => filteredCustomIds.includes(goal.id))
        .map(goal => ({
          ...goal,
          goal_type: 'custom' as const,
          domains: domainsData?.filter(d => d.parent_id === goal.id).map(d => d.domain).filter(Boolean) || [],
          roles: rolesData?.filter(r => r.parent_id === goal.id).map(r => r.role).filter(Boolean) || [],
          keyRelationships: krData?.filter(kr => kr.parent_id === goal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
        }));

      setTwelveWeekGoals(transformedTwelveWeekGoals);
      setCustomGoals(transformedCustomGoals);
      setAllGoals([...transformedTwelveWeekGoals, ...transformedCustomGoals]);

      // Calculate progress for 12-week goals only (custom goals don't use cycle-based progress)
      if (userCycleId) {
        await calculateGoalProgress(transformedTwelveWeekGoals, userCycleId);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const calculateGoalProgress = async (goals: TwelveWeekGoal[], userCycleId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const progressData: Record<string, GoalProgress> = {};
      const currentWeek = getCurrentWeekNumber();
      const daysRemaining = daysLeftData?.days_left || 0;

      for (const goal of goals) {
        const { data: goalJoins } = await supabase
          .from('0008-ap-universal-goals-join')
          .select('parent_id')
          .eq('twelve_wk_goal_id', goal.id)
          .eq('parent_type', 'task');

        const taskIds = goalJoins?.map(gj => gj.parent_id) || [];

        if (taskIds.length === 0) {
          progressData[goal.id] = {
            goalId: goal.id,
            currentWeek,
            daysRemaining,
            weeklyActual: 0,
            weeklyTarget: goal.weekly_target,
            overallActual: 0,
            overallTarget: goal.total_target,
            overallProgress: 0,
          };
          continue;
        }

        const currentWeekData = cycleWeeks.find(w => w.week_number === currentWeek);
        let weeklyActual = 0;

        if (currentWeekData) {
          const { data: weeklyOccurrences } = await supabase
            .from('0008-ap-tasks')
            .select('*')
            .in('parent_task_id', taskIds)
            .eq('status', 'completed')
            .gte('due_date', currentWeekData.week_start)
            .lte('due_date', currentWeekData.week_end);

          weeklyActual = weeklyOccurrences?.length || 0;
        }

        const { data: overallOccurrences } = await supabase
          .from('0008-ap-tasks')
          .select('*')
          .in('parent_task_id', taskIds)
          .eq('status', 'completed')
          .gte('due_date', currentCycle?.start_date || '1900-01-01')
          .lte('due_date', currentCycle?.end_date || '2100-12-31');

        const { data: weekPlansData } = await supabase
          .from('0008-ap-task-week-plan')
          .select('target_days')
          .in('task_id', taskIds)
          .eq('user_cycle_id', userCycleId);

        const overallActual = overallOccurrences?.length || 0;
        const overallTarget = weekPlansData?.reduce((sum, wp) => sum + (wp.target_days || 0), 0) || 0;

        const cappedOverallActual = Math.min(overallActual, overallTarget);
        const overallProgress = overallTarget > 0 ? Math.round((cappedOverallActual / overallTarget) * 100) : 0;

        progressData[goal.id] = {
          goalId: goal.id,
          currentWeek,
          daysRemaining,
          weeklyActual,
          weeklyTarget: goal.weekly_target,
          overallActual: cappedOverallActual,
          overallTarget,
          overallProgress,
        };
      }

      setGoalProgress(progressData);

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

  const getCurrentWeekNumber = useCallback((): number => {
    if (!currentCycle || cycleWeeks.length === 0) return 1;

    const now = new Date();
    const currentDateString = formatLocalDate(now);

    const currentWeekData = cycleWeeks.find(
      week =>
        currentDateString >= week.week_start && currentDateString <= week.week_end
    );

    return currentWeekData?.week_number || 1;
  }, [currentCycle, cycleWeeks]);

  const getCurrentWeekIndex = useCallback((): number => {
  if (!cycleWeeks || cycleWeeks.length === 0) return -1;

  // Normalize today's date to YYYY-MM-DD (same format as DB)
  const today = new Date().toISOString().slice(0, 10);

  // Find the week containing today
  const index = cycleWeeks.findIndex(
    w => today >= w.week_start && today <= w.week_end
  );

  if (index !== -1) return index;

  // Fallbacks: before first week → index 0, after last week → last index
  const firstWeek = cycleWeeks[0];
  const lastWeek = cycleWeeks[cycleWeeks.length - 1];
  if (today < firstWeek.week_start) return 0;
  if (today > lastWeek.week_end) return cycleWeeks.length - 1;

  return -1;
}, [cycleWeeks]);

  const getWeekData = useCallback((weekIndex: number): WeekData | null => {
    const week = cycleWeeks[weekIndex];
    if (!week) return null;

    return {
      weekNumber: week.week_number,
      startDate: week.week_start,
      endDate: week.week_end,
    };
  }, [cycleWeeks]);

  const fetchGoalActionsForWeekForState = (
    goalIds: string[],
    weekNumber: number,
    customWeeks?: WeekData[]
  ) => fetchGoalActionsForWeek(goalIds, weekNumber, cycleWeeks, customWeeks || []);

  const refreshAllData = async () => {
    try {
      const cycle = await fetchUserCycle();
      if (!cycle) {
        setCycleWeeks([]);
        setDaysLeftData(null);
        setTwelveWeekGoals([]);
        setCustomGoals([]);
        setAllGoals([]);
        setGoalProgress({});
        return;
      }

      const [weeks, daysLeft] = await Promise.all([
        fetchCycleWeeks(cycle.id),
        fetchDaysLeftData(cycle.id)
      ]);

      await fetchGoals(cycle.id);
    } catch (error) {
      console.error('Error refreshing all data:', error);
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
    if (!user || !currentCycle) throw new Error('Missing user or current cycle');
    
    const { data: parent, error: pErr } = await supabase
      .from('0008-ap-tasks')
      .select('id, title')
      .eq('id', parentTaskId)
      .single();
    if (pErr || !parent) throw pErr ?? new Error('Parent task not found');
    
    const { data: occ, error: oErr } = await supabase
      .from('0008-ap-tasks')
      .insert({
        user_id: user.id,
        user_global_timeline_id: currentCycle.id,
        title: parent.title,
        type: 'task',
        status: 'completed',
        due_date: whenISO,
        completed_at: new Date().toISOString(),
        parent_task_id: parentTaskId,
        is_twelve_week_goal: true,
      })
      .select('id')
      .single();
    if (oErr || !occ) throw oErr ?? new Error('Failed to insert occurrence');
    const occId = occ.id as string;

    const copyResults = await Promise.all([
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

  const createTwelveWeekGoal = async (goalData: {
    title: string;
    description?: string;
    weekly_target?: number;
    total_target?: number;
  }): Promise<TwelveWeekGoal | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentCycle) return null;

      const { data, error } = await supabase
        .from('0008-ap-goals-12wk')
        .insert({
          user_id: user.id,
          user_global_timeline_id: currentCycle.id,
          title: goalData.title,
          description: goalData.description,
          weekly_target: goalData.weekly_target || 3,
          total_target: goalData.total_target || 36,
          status: 'active',
          progress: 0,
          start_date: currentCycle.start_date,
          end_date: currentCycle.end_date,
        })
        .select()
        .single();

      if (error) throw error;
      
      if (currentCycle) {
        await fetchGoals(currentCycle.id);
      }
      
      return { ...data, goal_type: '12week' };
    } catch (error) {
      console.error('Error creating 12-week goal:', error);
      throw error;
    }
  };

  const createCustomGoal = async (goalData: {
    title: string;
    description?: string;
    start_date: string;
    end_date: string;
  }): Promise<CustomGoal | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('0008-ap-goals-custom')
        .insert({
          user_id: user.id,
          title: goalData.title,
          description: goalData.description,
          start_date: goalData.start_date,
          end_date: goalData.end_date,
          status: 'active',
          progress: 0,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Refresh all goals (both 12-week and custom)
      await fetchGoals(currentCycle?.id);
      
      return { ...data, goal_type: 'custom' };
    } catch (error) {
      console.error('Error creating custom goal:', error);
      throw error;
    }
  };

  const createTaskWithWeekPlan = async (taskData: {
    title: string;
    description?: string;
    twelve_wk_goal_id?: string;
    custom_goal_id?: string;
    goal_type?: 'twelve_wk_goal' | 'custom_goal';
    recurrenceRule?: string;
    selectedRoleIds?: string[];
    selectedDomainIds?: string[];
    selectedKeyRelationshipIds?: string[];
    selectedWeeks: Array<{ weekNumber: number; targetDays: number }>;
  }): Promise<any> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentCycle) return null;

      const { data: insertedTask, error: taskError } = await supabase
        .from('0008-ap-tasks')
        .insert({
          user_id: user.id,
          user_cycle_id: currentCycle.id,
          title: taskData.title,
          type: 'task',
          input_kind: 'count',
          unit: 'days',
          status: 'pending',
          is_twelve_week_goal: true,
          recurrence_rule: taskData.recurrenceRule,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      if (taskData.description && taskData.description.trim()) {
        const { data: insertedNote, error: noteError } = await supabase
          .from('0008-ap-notes')
          .insert({
            user_id: user.id,
            content: taskData.description.trim(),
          })
          .select()
          .single();

        if (noteError) throw noteError;

        const { error: noteJoinError } = await supabase
          .from('0008-ap-universal-notes-join')
          .insert({
            parent_id: insertedTask.id,
            parent_type: 'task',
            note_id: insertedNote.id,
            user_id: user.id,
          });

        if (noteJoinError) throw noteJoinError;
      }

      const weekPlanInserts = taskData.selectedWeeks.map(week => ({
        task_id: insertedTask.id,
        user_cycle_id: currentCycle.id,
        week_number: week.weekNumber,
        target_days: week.targetDays,
      }));

      const { error: weekPlanError } = await supabase
        .from('0008-ap-task-week-plan')
        .insert(weekPlanInserts);

      if (weekPlanError) throw weekPlanError;

      // Link to goal based on type
      if (taskData.twelve_wk_goal_id) {
        const { error: goalJoinError } = await supabase
          .from('0008-ap-universal-goals-join')
          .insert({
            parent_id: insertedTask.id,
            parent_type: 'task',
            twelve_wk_goal_id: taskData.twelve_wk_goal_id,
            goal_type: 'twelve_wk_goal',
            user_id: user.id,
          });

        if (goalJoinError) throw goalJoinError;
      } else if (taskData.custom_goal_id) {
        const { error: goalJoinError } = await supabase
          .from('0008-ap-universal-goals-join')
          .insert({
            parent_id: insertedTask.id,
            parent_type: 'task',
            custom_goal_id: taskData.custom_goal_id,
            goal_type: 'custom_goal',
            user_id: user.id,
          });

        if (goalJoinError) throw goalJoinError;
      }

      // Link roles, domains, and key relationships
      if (taskData.selectedRoleIds && taskData.selectedRoleIds.length > 0) {
        const roleJoins = taskData.selectedRoleIds.map(roleId => ({
          parent_id: insertedTask.id,
          parent_type: 'task',
          role_id: roleId,
          user_id: user.id,
        }));

        const { error: roleJoinError } = await supabase
          .from('0008-ap-universal-roles-join')
          .insert(roleJoins);

        if (roleJoinError) throw roleJoinError;
      }

      if (taskData.selectedDomainIds && taskData.selectedDomainIds.length > 0) {
        const domainJoins = taskData.selectedDomainIds.map(domainId => ({
          parent_id: insertedTask.id,
          parent_type: 'task',
          domain_id: domainId,
          user_id: user.id,
        }));

        const { error: domainJoinError } = await supabase
          .from('0008-ap-universal-domains-join')
          .insert(domainJoins);

        if (domainJoinError) throw domainJoinError;
      }

      if (taskData.selectedKeyRelationshipIds && taskData.selectedKeyRelationshipIds.length > 0) {
        const krJoins = taskData.selectedKeyRelationshipIds.map(krId => ({
          parent_id: insertedTask.id,
          parent_type: 'task',
          key_relationship_id: krId,
          user_id: user.id,
        }));

        const { error: krJoinError } = await supabase
          .from('0008-ap-universal-key-relationships-join')
          .insert(krJoins);

        if (krJoinError) throw krJoinError;
      }

      return { id: insertedTask.id };
    } catch (error) {
      console.error('Error creating task with week plan:', error);
      throw error;
    }
  };

  const refreshGoals = async () => {
    if (currentCycle) {
      await fetchGoals(currentCycle.id);
    } else {
      await fetchGoals();
    }
  };

  useEffect(() => {
    refreshAllData();
  }, [options.scope]);

  useEffect(() => {
    if (!currentCycle) return;

    const updateDaysLeft = () => {
      fetchDaysLeftData(currentCycle.id);
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
  }, [currentCycle]);

  return {
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
    fetchGoalActionsForWeek: fetchGoalActionsForWeekForState,
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
  };
}