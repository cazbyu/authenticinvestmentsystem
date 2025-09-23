// useGoals.ts
import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { Alert } from 'react-native';
import { generateCycleWeeks, formatLocalDate, parseLocalDate } from '../lib/dateUtils';

/* ================================
 * DB TABLE / VIEW CONSTANTS (single source of truth)
 * Adjust here if your DB names differ.
 * ================================ */
const DB = {
  // Timelines
  USER_GLOBAL_TIMELINES: '0008-ap-user-global-timelines',
  CUSTOM_TIMELINES: '0008-ap-custom-timelines',

  // Goals
  GOALS_12WK: '0008-ap-goals-12wk',
  GOALS_CUSTOM: '0008-ap-goals-custom',

  // Tasks + related
  TASKS: '0008-ap-tasks',
  TASK_WEEK_PLAN: '0008-ap-task-week-plan',
  NOTES: '0008-ap-notes',
  NOTES_JOIN: '0008-ap-universal-notes-join',

  // Joins
  UNIVERSAL_GOALS_JOIN: '0008-ap-universal-goals-join',
  UNIVERSAL_ROLES_JOIN: '0008-ap-universal-roles-join',
  UNIVERSAL_DOMAINS_JOIN: '0008-ap-universal-domains-join',
  UNIVERSAL_KEY_REL_JOIN: '0008-ap-universal-key-relationships-join',

  // Role/Domain/KR dictionaries
  ROLES: '0008-ap-roles',
  DOMAINS: '0008-ap-domains',
  KEY_REL: '0008-ap-key-relationships',

  // Views (weeks + days-left); columns must expose: week_number, week_start, week_end, timeline_id
  V_GLOBAL_WEEKS: 'v_user_global_timeline_weeks',
  V_CUSTOM_WEEKS: 'v_custom_timeline_weeks',

  // Views (days-left); columns must expose: timeline_id, days_left, pct_elapsed
  V_GLOBAL_DAYS_LEFT: 'v_user_global_timeline_days_left',
  V_CUSTOM_DAYS_LEFT: 'v_custom_timeline_days_left',
};

/* ================================
 * INTERFACES
 * ================================ */
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
  user_global_timeline_id?: string; // FK to 12wk timeline
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
  custom_timeline_id?: string; // FK to custom timeline
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
  title?: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  timezone?: string | null;
  week_start_day?: 'sunday' | 'monday';
}

export interface CycleWeek {
  week_number: number;
  week_start: string; // YYYY-MM-DD
  week_end: string;   // YYYY-MM-DD
  user_cycle_id: string; // we store timeline_id here for convenience
}

export interface DaysLeftData {
  days_left: number;
  pct_elapsed: number;
  timeline_id: string;
}

export interface TaskWeekPlan {
  id: string;
  task_id: string;
  user_global_timeline_id?: string;  // for global timelines
  user_custom_timeline_id?: string;  // for custom timelines
  week_number: number;
  target_days: number;
  created_at: string;
}

export interface TaskLog {
  id: string;
  task_id: string;
  measured_on: string; // YYYY-MM-DD
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

/* ================================
 * EXPORTED UTILITY (kept compatible)
 * ================================ */
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
        (w: any) => w.week_number === weekNumber || (w as any).weekNumber === weekNumber
      );

    const weekStartDate = (week as any)?.week_start ?? (week as any)?.startDate;
    const weekEndDate = (week as any)?.week_end ?? (week as any)?.endDate;
    if (!weekStartDate || !weekEndDate) return {};

    const { data: goalJoins } = await supabase
      .from(DB.UNIVERSAL_GOALS_JOIN)
      .select('parent_id, twelve_wk_goal_id, custom_goal_id, goal_type')
      .or(`twelve_wk_goal_id.in.(${goalIds.join(',')}),custom_goal_id.in.(${goalIds.join(',')})`)
      .eq('parent_type', 'task');

    const taskIds = goalJoins?.map(gj => gj.parent_id) || [];
    if (taskIds.length === 0) return {};

    const { data: tasksData, error: tasksError } = await supabase
      .from(DB.TASKS)
      .select('*')
      .eq('user_id', user.id)
      .in('id', taskIds)
      .eq('input_kind', 'count')
      .not('status', 'in', '(completed,cancelled)');

    if (tasksError) throw tasksError;
    if (!tasksData || tasksData.length === 0) return {};

    const { data: weekPlansData, error: weekPlansError } = await supabase
      .from(DB.TASK_WEEK_PLAN)
      .select('*')
      .in('task_id', taskIds)
      .eq('week_number', weekNumber);

    if (weekPlansError) throw weekPlansError;

    const tasksWithWeekPlans = tasksData.filter(task =>
      weekPlansData?.some(wp => wp.task_id === task.id)
    );

    const { data: occurrenceData, error: occurrenceError } = await supabase
      .from(DB.TASKS)
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
        created_at: occ.created_at,
      }));

      const weeklyActual = taskLogs.length;
      const weeklyTarget = weekPlan.target_days ?? 0;
      const cappedWeeklyActual = Math.min(weeklyActual, weeklyTarget);

      const taskWithLogs: TaskWithLogs = {
        ...(task as any),
        goal_type: goalJoin.goal_type === 'twelve_wk_goal' ? '12week' : 'custom',
        logs: taskLogs,
        weeklyActual: cappedWeeklyActual,
        weeklyTarget,
      };

      if (!groupedActions[goalId]) groupedActions[goalId] = [];
      groupedActions[goalId].push(taskWithLogs);
    }

    return groupedActions;
  } catch (error) {
    console.error('Error fetching goal actions for week:', error);
    return {};
  }
}

/* ================================
 * HOOK
 * ================================ */
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

  /* --------------------------------
   * Helpers
   * -------------------------------- */
  /* --------------------------------
   * Fetch current active timeline (global first, then custom)
   * -------------------------------- */
  const fetchUserCycle = async (): Promise<UserCycle | null> => {
  try {
    const supabase = getSupabaseClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user) return null;

    // Prefer an active global (12wk) timeline
    const { data: globalTimeline, error: gErr } = await supabase
      .from(DB.USER_GLOBAL_TIMELINES)
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (gErr) throw gErr;

    if (globalTimeline) {
      const hydrated: UserCycle = {
        ...globalTimeline,
        source: 'global',
        title: globalTimeline.title ?? '12 Week Timeline',
        start_date: globalTimeline.start_date,
        end_date: globalTimeline.end_date,
      };
      setCurrentCycle(hydrated);
      return hydrated;
    }

    // Otherwise the active custom timeline
    const { data: customTimeline, error: cErr } = await supabase
      .from(DB.CUSTOM_TIMELINES)
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cErr) throw cErr;

    if (customTimeline) {
      const hydrated: UserCycle = {
        ...customTimeline,
        source: 'custom',
        title: customTimeline.title ?? 'Custom Timeline',
        start_date: customTimeline.start_date,
        end_date: customTimeline.end_date,
      };
      setCurrentCycle(hydrated);
      return hydrated;
    }

    setCurrentCycle(null);
    return null;
  } catch (error) {
    console.error('Error fetching user cycle:', error);
    setCurrentCycle(null);
    return null;
  }
};

  /* --------------------------------
   * Weeks for the active timeline
   * -------------------------------- */
  const fetchCycleWeeks = async (timelineId: string, source: 'global' | 'custom') => {
    try {
      const supabase = getSupabaseClient();
      const view = source === 'custom' ? DB.V_CUSTOM_WEEKS : DB.V_GLOBAL_WEEKS;

      const selectColumns =
        source === 'custom'
          ? 'week_number, start_date, end_date, custom_timeline_id'
          : 'week_number, week_start, week_end, timeline_id';

      const timelineColumn = source === 'custom' ? 'custom_timeline_id' : 'timeline_id';

      const { data: dbWeeks, error } = await supabase
        .from(view)
        .select(selectColumns)
        .eq(timelineColumn, timelineId)
        .order('week_number', { ascending: true });

      if (error) throw error;

      const mappedWeeks: CycleWeek[] = (dbWeeks ?? []).map((w: any) => ({
        week_number: w.week_number,
        week_start: source === 'custom' ? w.start_date : w.week_start,
        week_end: source === 'custom' ? w.end_date : w.week_end,
        user_cycle_id:
          source === 'custom'
            ? (w.custom_timeline_id as string | undefined) ?? timelineId
            : (w.timeline_id as string | undefined) ?? timelineId,
      }));

      setCycleWeeks(mappedWeeks);
      return mappedWeeks;
    } catch (error) {
      console.error('Error fetching cycle weeks:', error);
      setCycleWeeks([]);
      return [];
    }
  };

  /* --------------------------------
   * Days left for the active timeline
   * -------------------------------- */
  const fetchDaysLeftData = async (timelineId: string, source: 'global' | 'custom') => {
    try {
      const supabase = getSupabaseClient();
      const view = source === 'custom' ? DB.V_CUSTOM_DAYS_LEFT : DB.V_GLOBAL_DAYS_LEFT;

      const { data, error } = await supabase
        .from(view)
        .select('*')
        .eq('timeline_id', timelineId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setDaysLeftData(data ?? null);
      return data ?? null;
    } catch (error) {
      console.error('Error fetching days left data:', error);
      setDaysLeftData(null);
      return null;
    }
  };

  /* --------------------------------
   * Fetch goals for the active timeline (strict filtering by FK)
   * -------------------------------- */
  const fetchGoals = async (timelineId?: string) => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let twelveWeekData: any[] = [];
      let customData: any[] = [];

      if (timelineId && currentCycle) {
        if (currentCycle.source === 'global') {
          // Only 12wk goals for global timeline
          const { data, error } = await supabase
            .from(DB.GOALS_12WK)
            .select('*')
            .eq('user_id', user.id)
            .eq('user_global_timeline_id', timelineId) // strict
            .eq('status', 'active')
            .order('created_at', { ascending: false });
          if (error) throw error;
          twelveWeekData = data || [];
          customData = [];
        } else if (currentCycle.source === 'custom') {
          // Only custom goals for custom timeline
          const { data, error } = await supabase
            .from(DB.GOALS_CUSTOM)
            .select('*')
            .eq('user_id', user.id)
            .eq('custom_timeline_id', timelineId) // strict
            .eq('status', 'active')
            .order('created_at', { ascending: false });
          if (error) throw error;
          customData = data || [];
          twelveWeekData = [];
        }
      }

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

      // Fetch related joins for *all* goals
      const [
        { data: rolesData, error: rolesError },
        { data: domainsData, error: domainsError },
        { data: krData, error: krError }
      ] = await Promise.all([
        supabase
          .from(DB.UNIVERSAL_ROLES_JOIN)
          .select(`parent_id, role:${DB.ROLES}(id, label, color)`)
          .in('parent_id', allGoalIds)
          .in('parent_type', ['goal', 'custom_goal']),
        supabase
          .from(DB.UNIVERSAL_DOMAINS_JOIN)
          .select(`parent_id, domain:${DB.DOMAINS}(id, name)`)
          .in('parent_id', allGoalIds)
          .in('parent_type', ['goal', 'custom_goal']),
        supabase
          .from(DB.UNIVERSAL_KEY_REL_JOIN)
          .select(`parent_id, key_relationship:${DB.KEY_REL}(id, name)`)
          .in('parent_id', allGoalIds)
          .in('parent_type', ['goal', 'custom_goal']),
      ]);

      if (rolesError) throw rolesError;
      if (domainsError) throw domainsError;
      if (krError) throw krError;

      // Optional scope filters
      let filteredTwelveWeekIds = (twelveWeekData || []).map(g => g.id);
      let filteredCustomIds = (customData || []).map(g => g.id);

      if (options.scope && options.scope.type !== 'user' && options.scope.id) {
        const scopeId = options.scope.id;
        switch (options.scope.type) {
          case 'role': {
            const roleGoalIds = rolesData?.filter(r => r.role?.id === scopeId).map(r => r.parent_id) || [];
            filteredTwelveWeekIds = filteredTwelveWeekIds.filter(id => roleGoalIds.includes(id));
            filteredCustomIds = filteredCustomIds.filter(id => roleGoalIds.includes(id));
            break;
          }
          case 'domain': {
            const domainGoalIds = domainsData?.filter(d => d.domain?.id === scopeId).map(d => d.parent_id) || [];
            filteredTwelveWeekIds = filteredTwelveWeekIds.filter(id => domainGoalIds.includes(id));
            filteredCustomIds = filteredCustomIds.filter(id => domainGoalIds.includes(id));
            break;
          }
          case 'key_relationship': {
            const krGoalIds = krData?.filter(kr => kr.key_relationship?.id === scopeId).map(kr => kr.parent_id) || [];
            filteredTwelveWeekIds = filteredTwelveWeekIds.filter(id => krGoalIds.includes(id));
            filteredCustomIds = filteredCustomIds.filter(id => krGoalIds.includes(id));
            break;
          }
        }
      }

      // Hydrate 12wk goals
      const transformedTwelveWeekGoals: TwelveWeekGoal[] = (twelveWeekData || [])
        .filter(goal => filteredTwelveWeekIds.includes(goal.id))
        .map(goal => ({
          ...goal,
          goal_type: '12week' as const,
          domains: domainsData?.filter(d => d.parent_id === goal.id).map(d => d.domain).filter(Boolean) || [],
          roles: rolesData?.filter(r => r.parent_id === goal.id).map(r => r.role).filter(Boolean) || [],
          keyRelationships: krData?.filter(kr => kr.parent_id === goal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
        }));

      // Hydrate custom goals
      const transformedCustomGoals: CustomGoal[] = (customData || [])
        .filter(goal => filteredCustomIds.includes(goal.id))
        .map(goal => ({
          ...goal,
          progress: goal.progress ?? 0,
          goal_type: 'custom' as const,
          domains: domainsData?.filter(d => d.parent_id === goal.id).map(d => d.domain).filter(Boolean) || [],
          roles: rolesData?.filter(r => r.parent_id === goal.id).map(r => r.role).filter(Boolean) || [],
          keyRelationships: krData?.filter(kr => kr.parent_id === goal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
        }));

      setTwelveWeekGoals(transformedTwelveWeekGoals);
      setCustomGoals(transformedCustomGoals);
      setAllGoals([...transformedTwelveWeekGoals, ...transformedCustomGoals]);

      await calculateGoalProgress(
        transformedTwelveWeekGoals,
        transformedCustomGoals,
        timelineId
      );
    } catch (error: any) {
      console.error('Error fetching goals:', error);
      Alert.alert('Error', error?.message ?? 'Failed to fetch goals');
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------
   * Progress calculations (weekly + overall)
   * -------------------------------- */
  const calculateGoalProgress = async (
    twelveWeekGoalsIn: TwelveWeekGoal[],
    customGoalsIn: CustomGoal[],
    timelineId?: string
  ) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const progressData: Record<string, GoalProgress> = {};
      const has12wk = Boolean(timelineId && twelveWeekGoalsIn.length > 0);
      const hasCustom = customGoalsIn.length > 0;

      if (!has12wk && !hasCustom) {
        setGoalProgress({});
        setCycleEffortData({ totalActual: 0, totalTarget: 0, overallPercentage: 0 });
        return;
      }

      const todayString = formatLocalDate(new Date());
      const normalizedToday = parseLocalDate(todayString);

      // ---- 12wk goals ----
      if (has12wk && currentCycle?.source === 'global') {
        // Current week in global context
        const currentWeek = getCurrentWeekNumber();
        const daysRemaining = daysLeftData?.days_left || 0;

        for (const goal of twelveWeekGoalsIn) {
          // Find tasks linked to this goal
          const { data: goalJoins } = await supabase
            .from(DB.UNIVERSAL_GOALS_JOIN)
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
              weeklyTarget: goal.weekly_target ?? 0,
              overallActual: 0,
              overallTarget: goal.total_target ?? 0,
              overallProgress: 0,
            };
            continue;
          }

          const currentWeekData = cycleWeeks.find(w => w.week_number === currentWeek);
          let weeklyActual = 0;

          if (currentWeekData) {
            const { data: weeklyOccurrences } = await supabase
              .from(DB.TASKS)
              .select('id')
              .in('parent_task_id', taskIds)
              .eq('status', 'completed')
              .gte('due_date', currentWeekData.week_start)
              .lte('due_date', currentWeekData.week_end);

            weeklyActual = weeklyOccurrences?.length || 0;
          }

          // Overall across active 12wk timeline
          const { data: overallOccurrences } = await supabase
            .from(DB.TASKS)
            .select('id')
            .in('parent_task_id', taskIds)
            .eq('status', 'completed')
            .gte('due_date', currentCycle?.start_date || '1900-01-01')
            .lte('due_date', currentCycle?.end_date || '2100-12-31');

          const weekPlanQuery = supabase
  .from(DB.TASK_WEEK_PLAN)
  .select('target_days')
  .in('task_id', taskIds);

if (currentCycle?.source === 'global') {
  weekPlanQuery.eq('user_global_timeline_id', timelineId);
} else {
  weekPlanQuery.eq('user_custom_timeline_id', timelineId);
}

const { data: weekPlansData, error: wpErr } = await weekPlanQuery;
if (wpErr) throw wpErr;

          const overallActual = overallOccurrences?.length || 0;
          const overallTarget = weekPlansData?.reduce((sum, wp) => sum + (wp.target_days || 0), 0) || 0;

          const cappedOverallActual = Math.min(overallActual, overallTarget);
          const overallProgress = overallTarget > 0 ? Math.round((cappedOverallActual / overallTarget) * 100) : 0;

          progressData[goal.id] = {
            goalId: goal.id,
            currentWeek,
            daysRemaining,
            weeklyActual,
            weeklyTarget: goal.weekly_target ?? 0,
            overallActual: cappedOverallActual,
            overallTarget,
            overallProgress,
          };
        }
      }

      // ---- custom goals ----
      if (hasCustom) {
        for (const goal of customGoalsIn) {
          const customWeeks = goal.start_date
            ? generateCycleWeeks(goal.start_date, currentCycle?.week_start_day || 'monday', goal.end_date)
            : [];

          const totalWeeks = customWeeks.length > 0 ? customWeeks.length : 1;

          let currentWeek = 1;
          if (customWeeks.length > 0) {
            const matchingWeekIndex = customWeeks.findIndex(
              w => todayString >= w.start_date && todayString <= w.end_date
            );
            if (matchingWeekIndex >= 0) currentWeek = matchingWeekIndex + 1;
            else if (todayString > customWeeks[customWeeks.length - 1].end_date) {
              currentWeek = customWeeks[customWeeks.length - 1].week_number;
            } else if (todayString < customWeeks[0].start_date) {
              currentWeek = customWeeks[0].week_number;
            }
          }

          const currentWeekData = customWeeks.find(w => w.week_number === currentWeek);
          const weekStartDate = currentWeekData?.start_date;
          const weekEndDate = currentWeekData?.end_date;

          let daysRemaining = 0;
          if (goal.end_date) {
            const parsedEnd = parseLocalDate(goal.end_date);
            if (!isNaN(parsedEnd.getTime())) {
              const diffDays = Math.ceil((parsedEnd.getTime() - normalizedToday.getTime()) / (1000 * 60 * 60 * 24));
              daysRemaining = Math.max(0, diffDays);
            }
          }

          const { data: goalJoins } = await supabase
            .from(DB.UNIVERSAL_GOALS_JOIN)
            .select('parent_id')
            .eq('custom_goal_id', goal.id)
            .eq('parent_type', 'task');

          const taskIds = goalJoins?.map(gj => gj.parent_id) || [];

          if (taskIds.length === 0) {
            progressData[goal.id] = {
              goalId: goal.id,
              currentWeek,
              daysRemaining,
              weeklyActual: 0,
              weeklyTarget: 0,
              overallActual: 0,
              overallTarget: 0,
              overallProgress: 0,
            };
            continue;
          }

          let weeklyActual = 0;
          if (weekStartDate && weekEndDate) {
            const { data: weeklyOccurrences } = await supabase
              .from(DB.TASKS)
              .select('id')
              .in('parent_task_id', taskIds)
              .eq('status', 'completed')
              .gte('due_date', weekStartDate)
              .lte('due_date', weekEndDate);

            weeklyActual = weeklyOccurrences?.length || 0;
          }

          // For custom, weekly target = number of actions planned per week (simple heuristic)
          const weeklyTarget = taskIds.length;
          const cappedWeeklyActual = Math.min(weeklyActual, weeklyTarget);

          const { data: overallOccurrences } = await supabase
            .from(DB.TASKS)
            .select('id')
            .in('parent_task_id', taskIds)
            .eq('status', 'completed')
            .gte('due_date', goal.start_date || '1900-01-01')
            .lte('due_date', goal.end_date || '2100-12-31');

          const overallActual = overallOccurrences?.length || 0;
          const overallTarget = weeklyTarget * totalWeeks;
          const cappedOverallActual = Math.min(overallActual, overallTarget);
          const overallProgress = overallTarget > 0 ? Math.round((cappedOverallActual / overallTarget) * 100) : 0;

          progressData[goal.id] = {
            goalId: goal.id,
            currentWeek,
            daysRemaining,
            weeklyActual: cappedWeeklyActual,
            weeklyTarget,
            overallActual: cappedOverallActual,
            overallTarget,
            overallProgress,
          };
        }
      }

      setGoalProgress(progressData);

      const totalActual = Object.values(progressData).reduce((sum, p) => sum + Math.min(p.overallActual, p.overallTarget), 0);
      const totalTarget = Object.values(progressData).reduce((sum, p) => sum + p.overallTarget, 0);
      const overallPercentage = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

      setCycleEffortData({ totalActual, totalTarget, overallPercentage });
    } catch (error) {
      console.error('Error calculating goal progress:', error);
    }
  };

  /* --------------------------------
   * Week helpers
   * -------------------------------- */
  const getCurrentWeekNumber = useCallback((): number => {
    if (!currentCycle || cycleWeeks.length === 0) return 1;
    const now = new Date();
    const currentDateString = formatLocalDate(now);
    const currentWeekData = cycleWeeks.find(
      week => currentDateString >= week.week_start && currentDateString <= week.week_end
    );
    return currentWeekData?.week_number || 1;
  }, [currentCycle, cycleWeeks]);

  const getCurrentWeekIndex = useCallback((): number => {
    if (!cycleWeeks || cycleWeeks.length === 0) return -1;
    const today = new Date().toISOString().slice(0, 10);
    const index = cycleWeeks.findIndex(w => today >= w.week_start && today <= w.week_end);
    if (index !== -1) return index;
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

  /* --------------------------------
   * Refresh orchestration
   * -------------------------------- */
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
        setCycleEffortData({ totalActual: 0, totalTarget: 0, overallPercentage: 0 });
        return;
      }

      const [weeks] = await Promise.all([
        fetchCycleWeeks(cycle.id, cycle.source),
        fetchDaysLeftData(cycle.id, cycle.source),
      ]);

      await fetchGoals(cycle.id);
    } catch (error) {
      console.error('Error refreshing all data:', error);
    }
  };

  const refreshGoals = async () => {
    if (currentCycle) await fetchGoals(currentCycle.id);
    else await fetchGoals();
  };

  /* --------------------------------
   * Action helpers (complete/undo)
   * -------------------------------- */
  const completeActionSuggestion = async ({
    parentTaskId,
    whenISO,
  }: { parentTaskId: string; whenISO: string; }): Promise<string> => {
    const supabase = getSupabaseClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user || !currentCycle) throw new Error('Missing user or current cycle');

    const { data: parent, error: pErr } = await supabase
      .from(DB.TASKS)
      .select('id, title')
      .eq('id', parentTaskId)
      .single();
    if (pErr || !parent) throw pErr ?? new Error('Parent task not found');

    const { data: occ, error: oErr } = await supabase
      .from(DB.TASKS)
      .insert({
        user_id: user.id,
        user_cycle_id: currentCycle.id, // keep a direct reference to active timeline
        title: parent.title,
        type: 'task',
        status: 'completed',
        due_date: whenISO,
        completed_at: new Date().toISOString(),
        parent_task_id: parentTaskId,
        is_twelve_week_goal: currentCycle.source === 'global', // preserve your old behavior
      })
      .select('id')
      .single();
    if (oErr || !occ) throw oErr ?? new Error('Failed to insert occurrence');
    const occId = occ.id as string;

    // copy joins
    await Promise.all([
      supabase.rpc('ap_copy_universal_roles_to_task', { from_parent_id: parentTaskId, to_task_id: occId }),
      supabase.rpc('ap_copy_universal_domains_to_task', { from_parent_id: parentTaskId, to_task_id: occId }),
      supabase.rpc('ap_copy_universal_goals_to_task', { from_parent_id: parentTaskId, to_task_id: occId }),
    ]);

    return occId;
  };

  const undoActionOccurrence = async ({
    parentTaskId,
    whenISO,
  }: { parentTaskId: string; whenISO: string; }): Promise<number> => {
    const supabase = getSupabaseClient();
    const { error, count } = await supabase
      .from(DB.TASKS)
      .delete({ count: 'exact' })
      .eq('parent_task_id', parentTaskId)
      .eq('due_date', whenISO)
      .eq('status', 'completed');

    if (error) throw error;
    return typeof count === 'number' ? count : 0;
  };

  /* --------------------------------
   * Creation flows (goals, tasks)
   * -------------------------------- */
  const createTwelveWeekGoal = async (goalData: {
    title: string;
    description?: string;
    weekly_target?: number;
    total_target?: number;
  }): Promise<TwelveWeekGoal | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentCycle || currentCycle.source !== 'global') return null;

      const { data, error } = await supabase
        .from(DB.GOALS_12WK)
        .insert({
          user_id: user.id,
          user_global_timeline_id: currentCycle.id, // strict FK
          title: goalData.title,
          description: goalData.description,
          weekly_target: goalData.weekly_target ?? 3,
          total_target: goalData.total_target ?? 36,
          status: 'active',
          progress: 0,
          start_date: currentCycle.start_date,
          end_date: currentCycle.end_date,
        })
        .select('*')
        .single();

      if (error) throw error;
      await fetchGoals(currentCycle.id);
      return { ...data, goal_type: '12week' };
    } catch (error) {
      console.error('Error creating 12-week goal:', error);
      throw error;
    }
  };

  const createCustomGoal = async (goalData: {
    title: string;
    description?: string;
    start_date?: string;
    end_date?: string;
  }, selectedTimeline?: { id: string; start_date?: string | null; end_date?: string | null }): Promise<CustomGoal | null> => {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selectedTimeline) return null;

    // 🔍 Debug log to check what we are inserting
    console.log("DEBUG: creating custom goal with", {
      userId: user.id,
      selectedTimelineId: selectedTimeline.id,
      selectedTimelineSource: selectedTimeline.source,
      goalData
    });

    const startDate = goalData.start_date || selectedTimeline?.start_date;
    const endDate = goalData.end_date || selectedTimeline?.end_date;

    if (!startDate || !endDate) throw new Error('Start date and end date are required for custom goals');

// 🚨 Debug log before insert
console.log("🚨 DEBUG createCustomGoal inserting into", DB.GOALS_CUSTOM, {
  userId: user.id,
  custom_timeline_id: selectedTimeline?.id,
  goalData,
  startDate,
  endDate,
});

// ✅ Supabase insert starts fresh
const { data, error } = await supabase
  .from(DB.GOALS_CUSTOM)   // <-- use alias, not raw string
  .insert({
        user_id: user.id,
        custom_timeline_id: selectedTimeline.id, // <-- use selectedTimeline.id, not currentCycle.id
        title: goalData.title,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
        progress: 0,
  })
  .select()
  .single();

      if (error) throw error;
      await fetchGoals(selectedTimeline.id);
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
  }): Promise<{ id: string } | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentCycle) return null;

      const { data: insertedTask, error: taskError } = await supabase
        .from(DB.TASKS)
        .insert({
          user_id: user.id,
          user_cycle_id: currentCycle.id,
          title: taskData.title,
          type: 'task',
          input_kind: 'count',
          unit: 'days',
          status: 'pending',
          is_twelve_week_goal: currentCycle.source === 'global',
          recurrence_rule: taskData.recurrenceRule,
        })
        .select('*')
        .single();
      if (taskError) throw taskError;

      // Optional note
      if (taskData.description?.trim()) {
        const { data: insertedNote, error: noteError } = await supabase
          .from(DB.NOTES)
          .insert({
            user_id: user.id,
            content: taskData.description.trim(),
          })
          .select('*')
          .single();
        if (noteError) throw noteError;

        const { error: noteJoinError } = await supabase
          .from(DB.NOTES_JOIN)
          .insert({
            parent_id: insertedTask.id,
            parent_type: 'task',
            note_id: insertedNote.id,
            user_id: user.id,
          });
        if (noteJoinError) throw noteJoinError;
      }

      // Week plans
      const weekPlanInserts = taskData.selectedWeeks.map(week => ({
        task_id: insertedTask.id,
        user_cycle_id: currentCycle.id, // timeline id
        week_number: week.weekNumber,
        target_days: week.targetDays,
      }));
      const { error: weekPlanError } = await supabase
        .from(DB.TASK_WEEK_PLAN)
        .insert(weekPlanInserts);
      if (weekPlanError) throw weekPlanError;

      // Link to goal
      if (taskData.twelve_wk_goal_id) {
        const { error: goalJoinError } = await supabase
          .from(DB.UNIVERSAL_GOALS_JOIN)
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
          .from(DB.UNIVERSAL_GOALS_JOIN)
          .insert({
            parent_id: insertedTask.id,
            parent_type: 'task',
            custom_goal_id: taskData.custom_goal_id,
            goal_type: 'custom_goal',
            user_id: user.id,
          });
        if (goalJoinError) throw goalJoinError;
      }

      // Link roles, domains, key relationships
      if (taskData.selectedRoleIds?.length) {
        const roleJoins = taskData.selectedRoleIds.map(roleId => ({
          parent_id: insertedTask.id,
          parent_type: 'task',
          role_id: roleId,
          user_id: user.id,
        }));
        const { error: roleJoinError } = await supabase
          .from(DB.UNIVERSAL_ROLES_JOIN)
          .insert(roleJoins);
        if (roleJoinError) throw roleJoinError;
      }

      if (taskData.selectedDomainIds?.length) {
        const domainJoins = taskData.selectedDomainIds.map(domainId => ({
          parent_id: insertedTask.id,
          parent_type: 'task',
          domain_id: domainId,
          user_id: user.id,
        }));
        const { error: domainJoinError } = await supabase
          .from(DB.UNIVERSAL_DOMAINS_JOIN)
          .insert(domainJoins);
        if (domainJoinError) throw domainJoinError;
      }

      if (taskData.selectedKeyRelationshipIds?.length) {
        const krJoins = taskData.selectedKeyRelationshipIds.map(krId => ({
          parent_id: insertedTask.id,
          parent_type: 'task',
          key_relationship_id: krId,
          user_id: user.id,
        }));
        const { error: krJoinError } = await supabase
          .from(DB.UNIVERSAL_KEY_REL_JOIN)
          .insert(krJoins);
      }
      await fetchGoals(selectedTimeline.id);
      return { id: insertedTask.id as string };
    } catch (error) {
      console.error('Error creating task with week plan:', error);
      throw error;
    }
  };

  /* --------------------------------
   * Effects
   * -------------------------------- */
  useEffect(() => {
    refreshAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.scope]);

  // Recompute days-left nightly at midnight
  useEffect(() => {
    if (!currentCycle) return;

    const updateDaysLeft = () => {
      fetchDaysLeftData(currentCycle.id, currentCycle.source);
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

  /* --------------------------------
   * Return API
   * -------------------------------- */
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
