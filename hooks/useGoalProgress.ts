import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { Alert } from 'react-native';
import { generateCycleWeeks, formatLocalDate, parseLocalDate, isValidISODate } from '@/lib/dateUtils';

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
  goal_type: GoalType; // NEW — so UI can distinguish
}

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
  user_global_timeline_id?: string;
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
  start_date: string | null; // null when source='global'
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
  user_global_timeline_id: string;
}

export interface DaysLeftData {
  days_left: number;
  pct_elapsed: number;
  user_global_timeline_id: string;
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
  measured_on: string;  // ✅ correct field name
  week_number: number;  // ✅ add this
  day_of_week?: number; // ✅ optional, nullable in schema
  value: number;        // ✅ add this, default = 1
  created_at: string;
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
  // Guard: ensure we never pass "null" or invalid strings as dates to Supabase filters
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

    // Fetch all active timelines (both global cycles and custom timelines)
    const { data: allTimelines, error } = await supabase
      .from('0008-ap-user-cycles')
      .select(`
        *,
        global:0008-ap-global-cycles(id, start_date, end_date, title)
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error && error.code !== 'PGRST116') throw error;
    
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

    // Transform and hydrate timeline data
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

    // Auto-select the first timeline if none is selected
    if (!selectedTimeline && hydratedTimelines.length > 0) {
  // Prefer global cycle, then most recent custom timeline
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
        .from('v_user_global_timeline_weeks')
        .select('week_number, week_start, week_end, user_global_timeline_id')
        .eq('user_global_timeline_id', currentCycle.id)
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
            user_cycle_id: currentCycle.id,
          }));
          console.log('Using client-side fallback weeks:', clientWeeks);
          setCycleWeeks(clientWeeks);
          return clientWeeks;
        }
        console.log('No valid start_date for client-side fallback');
        setCycleWeeks([]);
        return [];
      }

      if (dbWeeks && dbWeeks.length > 0 && currentCycle.start_date) {
        const week1 = dbWeeks[0];
const expectedWeek1Start = generateCycleWeeks(
  currentCycle.start_date!,
  currentCycle.week_start_day || 'monday'
)[0];

if (week1.week_start !== expectedWeek1Start.start_date) {
          console.warn('Week alignment mismatch, using client-side calculation');
          const clientWeeks = generateCycleWeeks(
  currentCycle.start_date!,
  currentCycle.week_start_day || 'monday',
  currentCycle.end_date || undefined
).map(week => ({
            week_number: week.week_number,
            week_start: week.start_date,
            week_end: week.end_date,
            user_cycle_id: currentCycle.id,
          }));
          console.log('Using client-side calculation due to alignment mismatch:', clientWeeks);
          setCycleWeeks(clientWeeks);
          return clientWeeks;
        }
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
        .from('v_user_global_timeline_days_left')
        .select('*')
        .eq('user_global_timeline_id', currentCycle.id)
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

  const fetchGoals = async (currentCycle?: UserCycle) => {
  console.log('=== FETCH GOALS START ===');
  console.log('Current cycle parameter:', currentCycle);
  
  setLoading(true);
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('No authenticated user found in fetchGoals');
      return;
    }
    
    console.log('User ID in fetchGoals:', user.id);
    console.log('Current cycle in fetchGoals:', currentCycle);

    if (!currentCycle) {
      console.log('No current cycle found in fetchGoals');
      return;
    }
    
    console.log('Selected timeline details:', {
      id: selectedTimeline?.id,
      source: selectedTimeline?.source,
      timeline_type: selectedTimeline?.timeline_type,
      title: selectedTimeline?.title
    });

    let mergedGoals: UnifiedGoal[] = [];

    if (selectedTimeline?.source === 'global' || selectedTimeline?.timeline_type === 'cycle') {
      console.log('Fetching 12-week goals for timeline:', currentCycle.id);
      // Fetch 12-week goals for this timeline
      const { data: goals12, error: error12 } = await supabase
        .from('0008-ap-goals-12wk')
        .select('*')
        .eq('user_id', user.id)
        .eq('user_global_timeline_id', currentCycle.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error12) {
        console.error('Error fetching 12-week goals:', error12);
        throw error12;
      }
      
      console.log('12-week goals query result:', {
        count: goals12?.length || 0,
        goals: goals12?.map(g => ({
          id: g.id,
          title: g.title,
          user_global_timeline_id: g.user_cycle_id,
          status: g.status
        })) || []
      });
      
      const normalized12 = (goals12 ?? []).map(g => ({ 
        ...g, 
        goal_type: 'twelve_wk_goal' as GoalType,
        weekly_target: g.weekly_target || 3,
        total_target: g.total_target || 36
      }));
      mergedGoals = [...normalized12];
    } else {
      console.log('Fetching custom goals for timeline:', currentCycle.id);
      // Fetch custom goals for this custom timeline
      const { data: goalsCustom, error: errorCustom } = await supabase
        .from('0008-ap-goals-custom')
        .select('*')
        .eq('user_id', user.id)
        .eq('custom_timeline_id', currentCycle.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (errorCustom) {
        console.error('Error fetching custom goals:', errorCustom);
        throw errorCustom;
      }
      
      console.log('Custom goals query result:', {
        count: goalsCustom?.length || 0,
        goals: goalsCustom?.map(g => ({
          id: g.id,
          title: g.title,
          custom_timeline_id: g.custom_timeline_id,
          status: g.status
        })) || []
      });
      
      const normalizedCustom = (goalsCustom ?? []).map(g => ({ 
        ...g, 
        goal_type: 'custom_goal' as GoalType,
        weekly_target: 3, // Default for custom goals
        total_target: Math.ceil(((new Date(g.end_date).getTime() - new Date(g.start_date).getTime()) / (1000 * 60 * 60 * 24)) / 7) * 3 // 3 per week
      }));
      mergedGoals = [...normalizedCustom];
    }

    console.log('Final merged goals count:', mergedGoals.length);
    console.log('Final merged goals:', mergedGoals.map(g => ({
      id: g.id,
      title: g.title,
      goal_type: g.goal_type
    })));

    setGoals(mergedGoals);

    // Progress calculation only for 12-week goals (custom handled later)
    if (selectedTimeline?.source === 'global' || selectedTimeline?.timeline_type === 'cycle') {
      const twelveWeekGoals = mergedGoals.filter(g => g.goal_type === 'twelve_wk_goal');
      console.log('Calculating progress for', twelveWeekGoals.length, '12-week goals');
      await calculateGoalProgress(twelveWeekGoals, currentCycle.id);
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

      // Log 12-week goals query details
      console.log('=== 12-WEEK GOALS QUERY DEBUG ===');
      console.log('Query parameters:');
      console.log('- user.id:', user.id);
      console.log('- userCycleId:', userCycleId);
      console.log('- status filter: active');
      console.log('Query results:');
      console.log('- twelveWeekData:', twelveWeekData);
      console.log('- twelveWeekError:', twelveWeekError);
      console.log('- Number of goals found:', twelveWeekData?.length || 0);
      console.log('=== END 12-WEEK GOALS QUERY DEBUG ===');
      
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

      // Fetch task logs for this week's date range
      let weeklyQuery = supabase
  .from('0008-ap-task-log')
  .select('*')
  .in('task_id', taskIds);

      if (isValidISODate(weekData.week_start)) {
        weeklyQuery = weeklyQuery.gte('measured_on', weekData.week_start);
      }
      if (isValidISODate(weekData.week_end)) {
        weeklyQuery = weeklyQuery.lte('measured_on', weekData.week_end);
      }

      const { data: taskLogsData, error: taskLogsError } = await weeklyQuery;

      if (taskLogsError) throw taskLogsError;

      // Transform data into WeeklyTaskData format
      const weeklyTaskData: WeeklyTaskData[] = [];

      for (const task of tasksData) {
        const weekPlan = weekPlansData?.find(wp => wp.task_id === task.id) || null;
        const logs = taskLogsData?.filter(log => log.task_id === task.id) || [];
        const completed = logs.filter(log => log.completed).length;
        const target = weekPlan?.target_days || 0;
        const weeklyScore = target > 0 ? Math.round((completed / target) * 100) : 0;

        weeklyTaskData.push({
          task,
          weekPlan,
          logs,
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

      // Get current week number from cycle weeks
      const currentWeek = getCurrentWeekNumber();
      const daysRemaining = daysLeftData?.days_left || 0;

      for (const goal of goals) {
        // Fetch action tasks (parent tasks) associated with this goal
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

        // Get current week date range
        const currentWeekData = cycleWeeks.find(w => w.week_number === currentWeek);
        
        let weeklyActual = 0;

        if (currentWeekData) {
          // Only apply date filters if we have valid dates
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

        // Fetch completed occurrences for entire cycle
        // Only apply date filters if we have valid timeline dates
        let overallQuery = supabase
          .from('0008-ap-tasks')
          .select('*')
          .in('parent_task_id', taskIds)
          .eq('status', 'completed');

        if (selectedTimeline?.start_date && selectedTimeline.start_date !== '' && isValidISODate(selectedTimeline.start_date)) {
          overallQuery = overallQuery.gte('due_date', selectedTimeline!.start_date!);
        }
        if (selectedTimeline?.end_date && selectedTimeline.end_date !== '' && isValidISODate(selectedTimeline.end_date)) {
          overallQuery = overallQuery.lte('due_date', selectedTimeline!.end_date!);
        }

        const { data: overallOccurrences } = await overallQuery;

        // Fetch total target from week plans for all weeks
        const { data: weekPlansData } = await supabase
          .from('0008-ap-task-week-plan')
          .select('target_days')
          .in('task_id', taskIds)
          .eq('user_cycle_id', timelineId);

        const overallActual = overallOccurrences?.length || 0;
        const overallTarget = weekPlansData?.reduce((sum, wp) => sum + (wp.target_days || 0), 0) || 0;

        // Cap actual at target to handle overages, then calculate percentage
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

      // Calculate overall cycle effort data
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

  // Try to find the week that contains today
  const currentWeekData = cycleWeeks.find(
    week =>
      week.week_start &&
      week.week_end &&
      currentDateString >= week.week_start &&
      currentDateString <= week.week_end
  );

  if (currentWeekData) {
    return currentWeekData.week_number;
  }

  // If today is after all weeks, return the last week
  const lastWeek = cycleWeeks[cycleWeeks.length - 1];
if (currentDateString > lastWeek.week_end) {
  return lastWeek.week_number;
}
const firstWeek = cycleWeeks[0];
if (currentDateString < firstWeek.week_start) {
  return firstWeek.week_number;
}

  // Fallback
  return 1;
};

  const getCurrentWeekIndex = (): number => {
  const n = getCurrentWeekNumber();
  return typeof n === 'number' && !Number.isNaN(n) ? Math.max(0, n - 1) : 0;
};

  const getWeekData = (weekIndex: number): WeekData | null => {
    const weekNumber = weekIndex + 1; // Convert from 0-based index
    const weekData = cycleWeeks.find(w => w.week_number === weekNumber);
    if (!weekData) return null;
    
    return {
      weekNumber,
      startDate: weekData.week_start,
      endDate: weekData.week_end,
    };
  };

    /**
   * Returns synthetic "today" items for goal actions that still have remaining effort this week.
   * No pending rows are created; we only insert a real occurrence when completed.
   */
  const getTodayActionSuggestions = async (): Promise<Array<{
    suggested: true;
    parent_task_id: string;
    user_cycle_id: string;
    date: string;               // today (YYYY-MM-DD)
    remainingThisWeek: number;
  }>> => {
    try {
      if (!selectedTimeline || cycleWeeks.length === 0) return [];

      const supabase = getSupabaseClient();

      // 1) Current week info + today's ISO (uses existing helpers you already have)
      const weekNumber = getCurrentWeekNumber();
      const currentDateISO = formatLocalDate(new Date());

      const wk = cycleWeeks.find(w => w.week_number === weekNumber);
      if (!wk) return [];
      const weekStartISO = wk.week_start;
      const weekEndISO   = wk.week_end;

      // 2) Pull week plans for THIS week (parent task ids + targets)
      const { data: planned, error: planErr } = await supabase
        .from('0008-ap-task-week-plan')
        .select('task_id, target_days')
        .eq('user_cycle_id', selectedTimeline.id)
        .eq('week_number', weekNumber);

      if (planErr) throw planErr;

      const parentIds = (planned ?? []).map(p => p.task_id);
      if (parentIds.length === 0) return [];

      // 3) Count completed OCCURRENCES this week (child rows with parent_task_id)
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

      // 4) Build "today" suggestions for parents that still have remaining effort
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
  
  const fetchGoalActionsForWeek = async (goalIds: string[], weekStartDate: string, weekEndDate: string): Promise<Record<string, TaskWithLogs[]>> => {
    try {
      // Validate date parameters before proceeding
      if (!weekStartDate || !weekEndDate || weekStartDate === 'null' || weekEndDate === 'null') {
        console.warn('Invalid date parameters provided to fetchGoalActionsForWeek:', { weekStartDate, weekEndDate });
        return {};
      }

      console.log('=== fetchGoalActionsForWeek START ===');
      console.log('Input params:', { goalIds, weekStartDate, weekEndDate });
      console.log('Current cycle weeks available:', cycleWeeks.length);
      console.log('Current loading state at start:', loadingWeekActions);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || goalIds.length === 0) {
        console.log('Early return: no user or no goalIds');
        return {};
      }

      // Fetch tasks linked to these goals
      const { data: goalJoins } = await supabase
        .from('0008-ap-universal-goals-join')
        .select('parent_id, twelve_wk_goal_id')
        .or(`twelve_wk_goal_id.in.(${goalIds.join(',')}),custom_goal_id.in.(${goalIds.join(',')})`)
        .eq('parent_type', 'task');

      const taskIds = goalJoins?.map(gj => gj.parent_id) || [];
      if (taskIds.length === 0) return {};

      // Fetch tasks for this user cycle
      console.log('=== 12-WEEK GOALS QUERY DEBUG START ===');
      console.log('Query parameters:');
      console.log('- user_id:', user.id);
      console.log('- user_cycle_id:', selectedTimeline?.id);
      console.log('- status: active');
      
      const { data: tasksData, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', user.id)
        .in('id', taskIds)
        .eq('input_kind', 'count')
        .not('status', 'in', '(completed,cancelled)');

      if (tasksError) throw tasksError;
      if (!tasksData || tasksData.length === 0) {
        console.log('No tasks data found for goal IDs:', goalIds);
        return {};
      }

      console.log('Tasks data found:', tasksData.length, 'tasks');
      console.log('Tasks details:', tasksData.map(t => ({ id: t.id, title: t.title, user_cycle_id: t.user_cycle_id })));

      // Fetch week plans for this specific week
      const weekNumber = cycleWeeks.findIndex(w => w.week_start === weekStartDate) + 1;
      console.log('Calculated week number:', weekNumber, 'from start date:', weekStartDate);
      
      const { data: weekPlansData, error: weekPlansError } = await supabase
        .from('0008-ap-task-week-plan')
        .select('*')
        .in('task_id', taskIds)
        .eq('week_number', weekNumber);

      if (weekPlansError) throw weekPlansError;

      console.log('Week plans data:', weekPlansData);
      console.log('Week plans count:', weekPlansData?.length || 0);

      // Filter tasks to only include those with week plans for this week
      const tasksWithWeekPlans = tasksData.filter(task => 
        weekPlansData?.some(wp => wp.task_id === task.id)
      );
// If no tasks are planned for this week, avoid .in('parent_task_id', []) → parent_task_id=in.()
if (!tasksWithWeekPlans || tasksWithWeekPlans.length === 0) {
  console.log('No tasks with week plans for this week; skipping occurrence fetch.');
  return {};
}

      console.log('Tasks with week plans for this week:', tasksWithWeekPlans.length);
      console.log('Tasks with week plans details:', tasksWithWeekPlans.map(t => ({ id: t.id, title: t.title })));

      // Fetch completed occurrence tasks for this week's date range
      // Only apply date filters if we have valid dates
            let occurrenceQuery = supabase
        .from('0008-ap-tasks')
        .select('*')
        .in('parent_task_id', tasksWithWeekPlans.map(t => t.id))
        .eq('status', 'completed');

      // Guard: only add filters if the dates are valid ISO strings and not empty
      if (weekStartDate && weekStartDate !== '' && isValidISODate(weekStartDate)) {
        occurrenceQuery = occurrenceQuery.gte('due_date', weekStartDate);
      }
      if (weekEndDate && weekEndDate !== '' && isValidISODate(weekEndDate)) {
        occurrenceQuery = occurrenceQuery.lte('due_date', weekEndDate);
      }

      const { data: occurrenceData, error: occurrenceError } = await occurrenceQuery;

      if (occurrenceError) throw occurrenceError;

      console.log('Raw occurrence data from DB:', occurrenceData);
      console.log('Occurrence count:', occurrenceData?.length || 0);
      if (occurrenceData) {
        console.log('Occurrence details:', occurrenceData.map(occ => ({
          id: occ.id,
          parent_task_id: occ.parent_task_id,
          due_date: occ.due_date,
          status: occ.status,
          title: occ.title
        })));
      }

      // Group tasks by goal_id and attach logs
      const groupedActions: Record<string, TaskWithLogs[]> = {};
      
      for (const task of tasksWithWeekPlans) {
        // Find which goal this task belongs to
        const goalJoin = goalJoins?.find(gj => gj.parent_id === task.id);
        if (!goalJoin) {
          console.log('No goal join found for task:', task.id, task.title);
          continue;
        }

        // Check if this task has a week plan for the current week
        const weekPlan = weekPlansData?.find(wp => wp.task_id === task.id);
        if (!weekPlan) {
          console.log('No week plan found for task:', task.id, task.title);
          continue; // Skip tasks not planned for this week
        }

        // Determine which type of goal this task belongs to
const goalId = goalJoin.twelve_wk_goal_id ?? goalJoin.custom_goal_id;
const goalType = goalJoin.twelve_wk_goal_id ? 'twelve_wk_goal' : 'custom_goal';

console.log(`Processing task: ${task.title} (${task.id}) for goal: ${goalId} (${goalType})`);
console.log(`Week plan: target_days=${weekPlan.target_days}`);
        
        // Convert completed occurrences to TaskLog format
        const relevantOccurrences = occurrenceData?.filter(occ => occ.parent_task_id === task.id) || [];
        console.log(`Task ${task.title} (${task.id}) - relevant occurrences:`, relevantOccurrences);
        
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
        
        console.log(`Task ${task.title} - converted logs:`, taskLogs);
        
        // Calculate weekly metrics
        const weeklyActual = taskLogs.length; // All are completed
        const weeklyTarget = weekPlan.target_days;

        const cappedWeeklyActual = Math.min(weeklyActual, weeklyTarget);
        console.log(`Task ${task.title}: ${weeklyActual} actual, ${cappedWeeklyActual} capped, ${weeklyTarget} target (${weeklyTarget > 0 ? Math.round((cappedWeeklyActual / weeklyTarget) * 100) : 0}%)`);

        const taskWithLogs: TaskWithLogs = {
          ...task,
          logs: taskLogs,
          weeklyActual: cappedWeeklyActual, // Store the capped value
          weeklyTarget,
        };

        if (!groupedActions[goalId]) {
          groupedActions[goalId] = [];
        }
        groupedActions[goalId].push(taskWithLogs);
      }

      console.log('=== FINAL GROUPED ACTIONS ===');
      console.log('Goals with actions:', Object.keys(groupedActions).length);
      Object.entries(groupedActions).forEach(([goalId, actions]) => {
        console.log(`Goal ${goalId}:`, actions.map(a => ({
          title: a.title,
          weeklyActual: a.weeklyActual,
          weeklyTarget: a.weeklyTarget,
          logsCount: a.logs.length
        })));
      });
      console.log('=== fetchGoalActionsForWeek END ===');
      
      return groupedActions;
    } catch (error) {
      console.error('Error fetching goal actions for week:', error);
      return {};
    }
  };

  const refreshAllData = async () => {
    try {
      // Fetch available timelines and capture the returned timeline directly
      const timeline = await fetchAvailableTimelines();
      console.log('Timeline returned from fetchAvailableTimelines:', timeline);
      
      if (!timeline) {
        // No active timeline found, clear all dependent data
        console.log('No active timeline found, clearing all data');
        setCycleWeeks([]);
        setDaysLeftData(null);
        setGoals([]);
        setGoalProgress({});
        setCycleEffortData({ totalActual: 0, totalTarget: 0, overallPercentage: 0 });
        return;
      }

      console.log('Using timeline ID for data fetching:', timeline.id);
      
      // Reassociate any orphaned active goals with the current timeline
      await reassociateActiveGoals(timeline.id);

      // Fetch timeline-dependent data in parallel using the timeline ID directly
      const [weeks, daysLeft] = await Promise.all([
        fetchCycleWeeks(timeline),
        fetchDaysLeftData(timeline)
      ]);

      console.log('Fetched weeks:', weeks?.length || 0);
      console.log('Fetched days left data:', daysLeft);
      
      // Fetch goals after we have timeline data, using the timeline ID directly
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

      // Find all active 12-week goals for this user that are not associated with the current cycle
      const { data: orphanedGoals, error: orphanedError } = await supabase
        .from('0008-ap-goals-12wk')
        .select('id, user_cycle_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .neq('user_cycle_id', currentCycleId);

      if (orphanedError) {
        console.error('Error fetching orphaned goals:', orphanedError);
        return;
      }

      console.log('Orphaned goals found:', orphanedGoals?.length || 0);
      if (orphanedGoals && orphanedGoals.length > 0) {
        console.log('Orphaned goals details:', orphanedGoals.map(g => ({
          id: g.id,
          current_user_cycle_id: g.user_cycle_id
        })));
      }
      if (orphanedGoals && orphanedGoals.length > 0) {
        // Update all orphaned goals to use the current cycle
        const { error: updateError } = await supabase
          .from('0008-ap-goals-12wk')
          .update({ 
            user_cycle_id: currentCycleId,
            updated_at: new Date().toISOString()
          })
          .in('id', orphanedGoals.map(g => g.id));

        if (updateError) {
          console.error('Error reassociating goals:', updateError);
          console.log('Update error details:', updateError);
        } else {
          console.log('Successfully reassociated goals with current cycle');
          console.log('Updated goal IDs:', orphanedGoals.map(g => g.id));
        }
      } else {
        console.log('No orphaned goals found - all goals are already associated with current cycle');
      }
      
      console.log('=== REASSOCIATE ACTIVE GOALS END ===');
    } catch (error) {
      console.error('Error in reassociateActiveGoals:', error);
      console.log('Reassociate error details:', error);
    }
  };

  const toggleTaskDay = async (taskId: string, date: string): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();
      
      // Call the RPC function to toggle the task day
      const { data, error } = await supabase.rpc('ap_toggle_task_day', {
        p_task_id: taskId,
        p_date: date
      });

      if (error) throw error;
      
      return data; // Returns the new completed state
    } catch (error) {
      console.error('Error toggling task day:', error);
      throw error;
    }
  };

    /**
   * Creates a completed "occurrence" of a 12-week goal action for a specific date,
   * then copies Roles/Domains/Goal links from the parent action to the occurrence.
   */
  const completeActionSuggestion = async ({
    parentTaskId,
    whenISO,            // 'YYYY-MM-DD' (the day being checked)
  }: {
    parentTaskId: string;
    whenISO: string;
  }): Promise<string> => {
    const supabase = getSupabaseClient();

    // Require user + currentCycle so we can stamp the row
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user || !selectedTimeline) throw new Error('Missing user or selected timeline');
    

    // 1) Load parent for title (you can select more fields if you want)
    const { data: parent, error: pErr } = await supabase
      .from('0008-ap-tasks')
      .select('id, title')
      .eq('id', parentTaskId)
      .single();
    if (pErr || !parent) throw pErr ?? new Error('Parent task not found');
    

    // 2) Insert the completed occurrence row for the given day
    const { data: occ, error: oErr } = await supabase
      .from('0008-ap-tasks')
      .insert({
        user_id: user.id,
        user_cycle_id: selectedTimeline.id,
        title: parent.title,
        type: 'task',
        status: 'completed',
        due_date: whenISO,                     // exact date of the check
        completed_at: new Date().toISOString(),
        parent_task_id: parentTaskId,          // <-- tie occurrence → parent
        is_twelve_week_goal: true,
      })
      .select('id')
      .single();
    if (oErr || !occ) throw oErr ?? new Error('Failed to insert occurrence');
    const occId = occ.id as string;

    // 3) Copy Roles, Domains, and Goal links from parent → occurrence via RPCs
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

    /**
   * Undo today's completion for a parent 12-week Action.
   * Deletes the occurrence row: (parent_task_id = action) AND (due_date = whenISO) AND (status='completed')
   * Returns the number of rows deleted.
   */
  const undoActionOccurrence = async ({
    parentTaskId,
    whenISO,   // 'YYYY-MM-DD'
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

    if (error) {
      throw error;
    }

    // count can be null depending on PostgREST settings; normalize to number
    const deletedCount = typeof count === 'number' ? count : 0;
    return deletedCount;
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
          user_cycle_id: selectedTimeline.id,
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
      
      // Refresh goals to include the new one
      await fetchGoals(selectedTimeline);
      
      return { ...data, goal_type: 'twelve_wk_goal' };
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
      
      // Use timeline dates if not provided
      const startDate = goalData.start_date || selectedTimeline?.start_date;
      const endDate = goalData.end_date || selectedTimeline?.end_date;

      if (!startDate || !endDate) {
        throw new Error('Start date and end date are required for custom goals');
      }

      const { data, error } = await supabase
        .from('0008-ap-goals-custom')
        .insert({
          user_id: user.id,
          custom_timeline_id: selectedTimeline.id,
          title: goalData.title,
          start_date: startDate,
          end_date: endDate,
          status: 'active',
          progress: 0,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Refresh goals to include the new one
      await fetchGoals(selectedTimeline);
      
      return { ...data, goal_type: 'custom_goal', weekly_target: 3, total_target: 36 };
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

      // Create the task
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

      // Handle notes/description via the notes join table
      if (taskData.description && taskData.description.trim()) {
        // Insert the note into the notes table
        const { data: insertedNote, error: noteError } = await supabase
          .from('0008-ap-notes')
          .insert({
            user_id: user.id,
            content: taskData.description.trim(),
          })
          .select()
          .single();

        if (noteError) throw noteError;

        // Link the note to the task
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

      // Create week plans
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

      // Link to goal if specified
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

      // Link roles to task
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

      // Link domains to task
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

      // Link key relationships to task
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

  // Auto-refresh days left data at midnight
  useEffect(() => {
    if (!selectedTimeline) return;

    const updateDaysLeft = () => {
      fetchDaysLeftData(selectedTimeline);
    };

    // Calculate milliseconds until next midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Set timeout for midnight, then interval for every 24 hours
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
    fetchGoalActionsForWeek,
    toggleTaskDay,
    completeActionSuggestion,
    undoActionOccurrence,       // <-- add this export
    getTodayActionSuggestions,  // <-- add this line
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