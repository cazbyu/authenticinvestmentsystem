import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { Alert } from 'react-native';
import { generateCycleWeeks, formatLocalDate, isValidISODate } from '@/lib/dateUtils';
import { fetchGoalActionsForWeek } from '@/hooks/fetchGoalActionsForWeek';

export type GoalType = 'twelve_wk_goal' | 'custom_goal';

export interface Timeline {
  id: string;
  user_id: string;
  source: 'custom' | 'global';
  title?: string;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'completed' | 'archived';
  timeline_type?: 'cycle' | 'project' | 'challenge' | 'custom';
  week_start_day?: 'sunday' | 'monday';
  global_cycle_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UnifiedGoal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: string;
  progress: number;
  weekly_target: number;
  total_target: number;
  start_date?: string;
  end_date?: string;
  created_at?: string;
  updated_at?: string;
  timeline_id: string | null;
  source: 'custom' | 'global';
  goal_type: GoalType;
}

type UnifiedGoalRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  progress: number | null;
  weekly_target: number | null;
  total_target: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  timeline_id: string | null;
  source?: 'custom' | 'global';
};

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
  timeline_id?: string;
  created_at: string;
  updated_at: string;
  domains?: Array<{ id: string; name: string }>;
  roles?: Array<{ id: string; label: string; color?: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
  notes?: Array<{ content: string; created_at: string }>;
}

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
  timeline_id: string;
}

export interface DaysLeftData {
  days_left: number;
  pct_elapsed: number;
  timeline_id: string;
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
  completed?: boolean; // <-- added so code using log.completed is valid
}

export interface TaskWithLogs extends TwelveWeekGoal {
  logs: TaskLog[];
  weeklyActual: number;
  weeklyTarget: number;
}

export interface WeekData {
  weekNumber: number;
  startDate: string;
  endDate: string;
}

type TimelineWeekInput =
  | CycleWeek
  | WeekData
  | {
      week_number?: number;
      weekNumber?: number;
      week_start?: string;
      weekStart?: string;
      start_date?: string;
      startDate?: string;
      week_end?: string;
      weekEnd?: string;
      end_date?: string;
      endDate?: string;
    };

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

interface UseGoalProgressOptions {
  scope?: {
    type: 'user' | 'role' | 'domain' | 'key_relationship';
    id?: string;
  };
}

export function useGoalProgress(options: UseGoalProgressOptions = {}) {
  const [goals, setGoals] = useState<UnifiedGoal[]>([]);
  const [selectedTimeline, setSelectedTimeline] = useState<Timeline | null>(null);
  const [availableTimelines, setAvailableTimelines] = useState<Timeline[]>([]);
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

      // NOTE: Leaving as-is to match your current backend shape.
      // If you want me to make this robust to renames and include custom timelines, say the word.
      const { data: globalTimelines, error: globalErr } = await supabase
  .from('0008-ap-user-global-timelines')
  .select('*')
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

// ✅ FIX: merge them into one array
const allTimelines = [
  ...(globalTimelines ?? []).map(t => ({ ...t, source: 'global' as const })),
  ...(customTimelines ?? []).map(t => ({ ...t, source: 'custom' as const })),
];

      console.log('Raw timelines from database:', allTimelines?.length || 0);
      if (allTimelines) {
        console.log('Timeline details:', allTimelines.map(t => ({
          id: t.id,
          source: t.source,
          title: t.title,
          start_date: t.start_date,
          end_date: t.end_date,
          global: t.global
        })));
      }

      const hydratedTimelines = (allTimelines || []).map(timeline => {
        const effectiveStart = timeline.start_date ?? timeline.global?.start_date ?? null;
        const effectiveEnd = timeline.end_date ?? timeline.global?.end_date ?? null;

        return {
          ...timeline,
          start_date: effectiveStart,
          end_date: effectiveEnd,
          title: timeline.title ?? timeline.global?.title ?? null,
        };
      });

      console.log('Hydrated timelines:', hydratedTimelines.length);
      if (hydratedTimelines.length > 0) {
        console.log('Hydrated timeline details:', hydratedTimelines.map(t => ({
          id: t.id,
          source: t.source,
          title: t.title,
          start_date: t.start_date,
          end_date: t.end_date
        })));
      }

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

      console.log('Returning existing selectedTimeline:', selectedTimeline?.id || 'null');
      console.log('=== FETCH AVAILABLE TIMELINES END ===');
      return selectedTimeline;
    } catch (error) {
      console.error('Error fetching available timelines:', error);
      return null;
    }
  };

  const fetchCycleWeeks = async (currentCycle: UserCycle) => {
    try {
      console.log('=== FETCH CYCLE WEEKS START ===');
      console.log('Current cycle passed to fetchCycleWeeks:', currentCycle);

      const supabase = getSupabaseClient();

      const { data: dbWeeks, error } = await supabase
        .from('v_unified_timeline_weeks')
        .select('week_number, week_start, week_end, timeline_id, source')
        .eq('timeline_id', currentCycle.id)
        .order('week_number', { ascending: true })
        .returns<CycleWeek[]>();

      console.log('Database weeks query result:', { data: dbWeeks, error });

      if (error) {
        console.warn('Database week view failed, using client-side fallback:', error);
        if (currentCycle.start_date) {
          const clientWeeks = generateCycleWeeks(
            currentCycle.start_date!,
            currentCycle.week_start_day || 'monday',
            currentCycle.end_date || undefined
          ).map(week => ({
            week_number: week.week_number,
            week_start: week.start_date,
            week_end: week.end_date,
            timeline_id: currentCycle.id,
          }));
          console.log('Using client-side fallback weeks:', clientWeeks);
          setCycleWeeks(clientWeeks);
          return clientWeeks;
        }
        console.log('No valid start_date for client-side fallback');
        setCycleWeeks([]);
        return [];
      }

      console.log('Using database weeks:', dbWeeks);
      setCycleWeeks(dbWeeks ?? []);
      console.log('=== FETCH CYCLE WEEKS END ===');
      return dbWeeks ?? [];
    } catch (error) {
      console.error('Error fetching cycle weeks:', error);
      setCycleWeeks([]);
      return [];
    }
  };

  const fetchDaysLeftData = async (currentCycle: UserCycle) => {
    try {
      console.log('=== FETCH DAYS LEFT START ===');
      console.log('Current cycle passed to fetchDaysLeftData:', currentCycle);

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('v_unified_timeline_days_left')
        .select('timeline_id, days_left, pct_elapsed, source')
        .eq('timeline_id', currentCycle.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      console.log('Days left data result:', data);
      setDaysLeftData(data);
      console.log('=== FETCH DAYS LEFT END ===');
      return data;
    } catch (error) {
      console.error('Error fetching days left data:', error);
      setDaysLeftData(null);
      return null;
    }
  };

  const fetchGoals = async (currentCycle?: UserCycle | Timeline | null) => {
    console.log('=== FETCH GOALS START ===');
    console.log('Current cycle parameter:', currentCycle);

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user found in fetchGoals');
        setGoals([]);
        return;
      }

      console.log('User ID in fetchGoals:', user.id);
      console.log('Current cycle in fetchGoals:', currentCycle);
      console.log('Selected timeline state in fetchGoals:', {
        id: selectedTimeline?.id,
        source: selectedTimeline?.source,
        timeline_type: selectedTimeline?.timeline_type,
        title: selectedTimeline?.title,
      });

      const resolvedTimeline = currentCycle ?? selectedTimeline;

      if (!resolvedTimeline) {
        console.log('No timeline found in fetchGoals');
        setGoals([]);
        return;
      }

      const resolvedTimelineType =
        'timeline_type' in resolvedTimeline && resolvedTimeline.timeline_type
          ? resolvedTimeline.timeline_type
          : 'cycle';

      console.log('Resolved timeline details for fetchGoals:', {
        id: resolvedTimeline.id,
        source: resolvedTimeline.source,
        timeline_type: resolvedTimelineType,
        title: resolvedTimeline.title,
      });

      let mergedGoals: UnifiedGoal[] = [];

      console.log('Fetching unified goals for timeline:', resolvedTimeline.id);

      const { data: unified, error: unifiedErr } = await supabase
        .from<UnifiedGoalRow>('v_unified_goals')
        .select(`
          id, user_id, title, description, status, progress,
          weekly_target, total_target, start_date, end_date,
          created_at, updated_at, timeline_id
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .eq('timeline_id', resolvedTimeline.id)
        .order('created_at', { ascending: false });

      if (unifiedErr) {
        console.error('Error fetching unified goals:', unifiedErr);
        throw unifiedErr;
      }

      mergedGoals = (unified ?? []).map(g => {
        const inferredSource = g.source ?? resolvedTimeline.source ?? 'custom';
        const goalType = inferredSource === 'global' ? 'twelve_wk_goal' : 'custom_goal';

        return {
          id: g.id,
          user_id: g.user_id,
          title: g.title,
          description: g.description ?? undefined,
          status: g.status,
          progress: g.progress ?? 0,
          weekly_target: g.weekly_target ?? 3,
          total_target: g.total_target ?? 36,
          start_date: g.start_date ?? undefined,
          end_date: g.end_date ?? undefined,
          created_at: g.created_at ?? undefined,
          updated_at: g.updated_at ?? undefined,
          timeline_id: g.timeline_id ?? null,
          source: inferredSource,
          goal_type: goalType,
        };
      });

      console.log('Final merged goals count:', mergedGoals.length);
      setGoals(mergedGoals);

      // Progress calculation only for 12-week goals
      const twelveWeekGoals = mergedGoals.filter(g => g.goal_type === 'twelve_wk_goal');
      if (twelveWeekGoals.length > 0) {
        console.log('Calculating progress for', twelveWeekGoals.length, '12-week goals');
        await calculateGoalProgress(twelveWeekGoals, resolvedTimeline.id);
      }

      console.log('=== FETCH GOALS END ===');
    } catch (error) {
      console.error('Error fetching goals:', error);
      console.log('Fetch goals error details:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasksAndPlansForWeek = async (userCycleId: string, weekNumber: number): Promise<WeeklyTaskData[]> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Fetch tasks for this user cycle
      const { data: tasksData, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('user_cycle_id', userCycleId)
        .eq('input_kind', 'count')
        .not('status', 'in', '(completed,cancelled)');

      if (tasksError) throw tasksError;
      if (!tasksData || tasksData.length === 0) return [];

      const taskIds = tasksData.map(t => t.id);

      // Fetch week plans for this specific week
      const { data: weekPlansData, error: weekPlansError } = await supabase
        .from('0008-ap-task-week-plan')
        .select('*')
        .in('task_id', taskIds)
        .eq('user_cycle_id', userCycleId)
        .eq('week_number', weekNumber);

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
          completed: true,
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

  const calculateGoalProgress = async (goals: UnifiedGoal[], timelineId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const progressData: Record<string, GoalProgress> = {};

      // Current week and days remaining
      const currentWeek = getCurrentWeekNumber() ?? 1;
      const daysRemaining = daysLeftData?.days_left || 0;

      for (const goal of goals) {
        // Fetch parent action tasks linked to this goal
        const { data: goalJoins } = await supabase
          .from('0008-ap-universal-goals-join')
          .select('parent_id')
          .eq(goal.goal_type === 'custom_goal' ? 'custom_goal_id' : 'twelve_wk_goal_id', goal.id)
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

        if (selectedTimeline?.start_date && isValidISODate(selectedTimeline.start_date)) {
          overallQuery = overallQuery.gte('due_date', selectedTimeline.start_date);
        }
        if (selectedTimeline?.end_date && isValidISODate(selectedTimeline.end_date)) {
          overallQuery = overallQuery.lte('due_date', selectedTimeline.end_date);
        }

        const { data: overallOccurrences } = await overallQuery;

        // Sum targets across all week plans for these tasks
        const { data: weekPlansData } = await supabase
          .from('0008-ap-task-week-plan')
          .select('target_days')
          .in('task_id', taskIds)
          .eq('user_cycle_id', timelineId);

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

  const getTodayActionSuggestions = async (): Promise<Array<{
    suggested: true;
    parent_task_id: string;
    user_cycle_id: string;
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
      const weekEndISO   = wk.week_end;

      const { data: planned, error: planErr } = await supabase
        .from('0008-ap-task-week-plan')
        .select('task_id, target_days')
        .eq('user_cycle_id', selectedTimeline.id)
        .eq('week_number', weekNumber);

      if (planErr) throw planErr;

      const parentIds = (planned ?? []).map(p => p.task_id);
      if (parentIds.length === 0) return [];

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
        user_cycle_id: string;
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
            user_cycle_id: selectedTimeline.id,
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

  const fetchGoalActionsForWeekForState = (
    goalIds: string[],
    weekNumber: number,
    customWeeks?: WeekData[]
  ) => fetchGoalActionsForWeek(goalIds, weekNumber, cycleWeeks, customWeeks || []);

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

      // Reassociate any orphaned active 12-week goals to current timeline
      await reassociateActiveGoals(timeline.id);

      const [weeks, daysLeft] = await Promise.all([
        fetchCycleWeeks(timeline),
        fetchDaysLeftData(timeline)
      ]);

      console.log('Fetched weeks:', weeks?.length || 0);
      console.log('Fetched days left data:', daysLeft);

      await fetchGoals(timeline);
    } catch (error) {
      console.error('Error refreshing all data:', error);
    }
  };

  const reassociateActiveGoals = async (currentCycleId: string) => {
    try {
      console.log('=== REASSOCIATE ACTIVE GOALS START ===');
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user found');
        return;
      }

      console.log('User ID:', user.id);
      console.log('Current cycle ID:', currentCycleId);

      // Find orphaned goals from unified view
      const { data: orphanedGoals, error: orphanedError } = await supabase
        .from('v_unified_goals')
        .select('id, timeline_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .neq('timeline_id', currentCycleId);

      if (orphanedError) throw orphanedError;

      if (orphanedGoals && orphanedGoals.length > 0) {
        const orphanedIds = orphanedGoals.map(g => g.id);
        let globalIds: string[] = [];
        let customIds: string[] = [];

        if (orphanedIds.length > 0) {
          const { data: globalMatches, error: globalLookupError } = await supabase
            .from('0008-ap-goals-12wk')
            .select('id')
            .in('id', orphanedIds);

          if (globalLookupError) throw globalLookupError;
          globalIds = globalMatches?.map(g => g.id) ?? [];

          const { data: customMatches, error: customLookupError } = await supabase
            .from('0008-ap-goals-custom')
            .select('id')
            .in('id', orphanedIds);

          if (customLookupError) throw customLookupError;
          customIds = customMatches?.map(g => g.id) ?? [];
        }

        if (globalIds.length > 0) {
          await supabase
            .from('0008-ap-goals-12wk')
            .update({
              user_global_timeline_id: currentCycleId,
              updated_at: new Date().toISOString(),
            })
            .in('id', globalIds);
        }

        if (customIds.length > 0) {
          await supabase
            .from('0008-ap-goals-custom')
            .update({
              custom_timeline_id: selectedTimeline.id,
              updated_at: new Date().toISOString(),
            })
            .in('id', customIds);
        }

        console.log('Successfully reassociated goals with current cycle');
      } else {
        console.log('No orphaned goals found - all goals are already associated with current cycle');
      }

      console.log('=== REASSOCIATE ACTIVE GOALS END ===');
    } catch (error) {
      console.error('Error in reassociateActiveGoals:', error);
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

    const { data: occ, error: oErr } = await supabase
      .from('0008-ap-tasks')
      .insert({
        user_id: user.id,
        user_cycle_id: selectedTimeline.id,
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

  const createTwelveWeekGoal = async (goalData: {
    title: string;
    description?: string;
    weekly_target?: number;
    total_target?: number;
  }): Promise<UnifiedGoal | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedTimeline) return null;

      const { data, error } = await supabase
        .from('0008-ap-goals-12wk')
        .insert({
          user_id: user.id,
          user_global_timeline_id: selectedTimeline.id, // <-- real FK column
          title: goalData.title,
          description: goalData.description,
          weekly_target: goalData.weekly_target || 3,
          total_target: goalData.total_target || 36,
          status: 'active',
          progress: 0,
          start_date: selectedTimeline.start_date,
          end_date: selectedTimeline.end_date,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchGoals(selectedTimeline);
      return {
        id: data.id,
        user_id: data.user_id,
        title: data.title,
        description: data.description ?? undefined,
        status: data.status,
        progress: data.progress ?? 0,
        weekly_target: data.weekly_target ?? (goalData.weekly_target ?? 3),
        total_target: data.total_target ?? (goalData.total_target ?? 36),
        start_date: data.start_date ?? undefined,
        end_date: data.end_date ?? undefined,
        created_at: data.created_at ?? undefined,
        updated_at: data.updated_at ?? undefined,
        timeline_id: data.user_global_timeline_id ?? selectedTimeline.id,
        source: 'global',
        goal_type: 'twelve_wk_goal',
      };
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
}): Promise<UnifiedGoal | null> => {
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

    const { data, error } = await supabase
      .from('0008-ap-goals-custom')
      .insert({
        user_id: user.id,
        custom_timeline_id: selectedTimeline.id,  // <-- this is the critical FK
        title: goalData.title,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
        progress: 0,
      })
      .select()
      .single();


      if (error) throw error;

      await fetchGoals(selectedTimeline);
      return {
        id: data.id,
        user_id: data.user_id,
        title: data.title,
        description: data.description ?? undefined,
        status: data.status,
        progress: data.progress ?? 0,
        weekly_target: data.weekly_target ?? 3,
        total_target: data.total_target ?? 36,
        start_date: data.start_date ?? undefined,
        end_date: data.end_date ?? undefined,
        created_at: data.created_at ?? undefined,
        updated_at: data.updated_at ?? undefined,
        timeline_id: data.custom_timeline_id ?? selectedTimeline.id,
        source: 'custom',
        goal_type: 'custom_goal',
      };
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
    recurrenceRule?: string;
    selectedRoleIds?: string[];
    selectedDomainIds?: string[];
    selectedKeyRelationshipIds?: string[];
    selectedWeeks: Array<{ weekNumber: number; targetDays: number }>;
  }): Promise<any> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedTimeline) return null;

      const { data: insertedTask, error: taskError } = await supabase
        .from('0008-ap-tasks')
        .insert({
          user_id: user.id,
          user_cycle_id: selectedTimeline.id,
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
        user_cycle_id: selectedTimeline.id,
        week_number: week.weekNumber,
        target_days: week.targetDays,
      }));

      const { error: weekPlanError } = await supabase
        .from('0008-ap-task-week-plan')
        .insert(weekPlanInserts);

      if (weekPlanError) throw weekPlanError;

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

  const getWeekDateRange = (weekNumber: number): { start: string; end: string } | null => {
    const weekData = cycleWeeks.find(w => w.week_number === weekNumber);
    return weekData ? { start: weekData.week_start, end: weekData.week_end } : null;
  };

  const refreshGoals = async () => {
    if (selectedTimeline) {
      await fetchGoals(selectedTimeline);
    }
  };

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

  return {
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
    refreshGoals,
    refreshAllData,
    fetchTasksAndPlansForWeek,
    fetchGoalActionsForWeek: fetchGoalActionsForWeekForState,
    toggleTaskDay,
    completeActionSuggestion,
    undoActionOccurrence,
    getTodayActionSuggestions,
    createTwelveWeekGoal,
    createCustomGoal,
    createTaskWithWeekPlan,
    getWeekDateRange,
    getCurrentWeekNumber,
    getCurrentWeekIndex,
    getWeekData,
    weekGoalActions,
    setWeekGoalActions,
  };
}