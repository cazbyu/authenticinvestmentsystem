import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { Alert } from 'react-native';
import { generateCycleWeeks, formatLocalDate, parseLocalDate } from '@/lib/dateUtils';

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
  start_date: string;
  end_date: string;
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
  log_date: string;
  completed: boolean;
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

interface UseGoalProgressOptions {
  scope?: {
    type: 'user' | 'role' | 'domain' | 'key_relationship';
    id?: string;
  };
}

export function useGoalProgress(options: UseGoalProgressOptions = {}) {
  const [goals, setGoals] = useState<TwelveWeekGoal[]>([]);
  const [currentCycle, setCurrentCycle] = useState<UserCycle | null>(null);
  const [cycleWeeks, setCycleWeeks] = useState<CycleWeek[]>([]);
  const [daysLeftData, setDaysLeftData] = useState<DaysLeftData | null>(null);
  const [goalProgress, setGoalProgress] = useState<Record<string, GoalProgress>>({});
  const [weekGoalActions, setWeekGoalActions] = useState<Record<string, TaskWithLogs[]>>({});
  const [loading, setLoading] = useState(false);

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

// Build an object that always has start/end (effective dates)
const effectiveStart = data?.start_date ?? data?.global?.start_date ?? null;
const effectiveEnd   = data?.end_date   ?? data?.global?.end_date   ?? null;

const hydrated = data
  ? {
      ...data,
      start_date: effectiveStart,
      end_date: effectiveEnd,
      // Optional: show global title if user left their title null
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
      
      // First try to get weeks from the database view
      const { data: dbWeeks, error } = await supabase
        .from('v_user_cycle_weeks')
        .select('week_number, start_date, end_date, user_cycle_id')
        .eq('user_cycle_id', userCycleId)
        .order('week_number', { ascending: true })
        .returns<CycleWeek[]>();

      if (error) {
        console.warn('Database week view failed, using client-side fallback:', error);
        // Fallback to client-side calculation
        if (currentCycle) {
          const clientWeeks = generateCycleWeeks(
            currentCycle.start_date!, 
            currentCycle.week_start_day || 'monday'
          ).map(week => ({
            week_number: week.week_number,
            start_date: week.start_date,
            end_date: week.end_date,
            user_cycle_id: userCycleId,
          }));
          setCycleWeeks(clientWeeks);
          return clientWeeks;
        }
        setCycleWeeks([]);
        return [];
      }

      // Validate that Week 1 aligns with the cycle's stored anchor
      if (dbWeeks && dbWeeks.length > 0 && currentCycle) {
        const week1 = dbWeeks[0];
        const expectedWeek1Start = generateCycleWeeks(
          currentCycle.start_date!, 
          currentCycle.week_start_day || 'monday'
        )[0];
        
        if (week1.start_date !== expectedWeek1Start.start_date) {
          console.warn('Week alignment mismatch, using client-side calculation');
          const clientWeeks = generateCycleWeeks(
            currentCycle.start_date!, 
            currentCycle.week_start_day || 'monday'
          ).map(week => ({
            week_number: week.week_number,
            start_date: week.start_date,
            end_date: week.end_date,
            user_cycle_id: userCycleId,
          }));
          setCycleWeeks(clientWeeks);
          return clientWeeks;
        }
      }

      setCycleWeeks(dbWeeks ?? []);
      return dbWeeks ?? [];

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
        .from('v_user_cycle_days_left')
        .select('*')
        .eq('user_cycle_id', userCycleId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      setDaysLeftData(data);
      return data;
    } catch (error) {
      console.error('Error fetching days left data:', error);
      setDaysLeftData(null);
      return null;
    }
  };

  const fetchGoals = async (userCycleId: string) => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch 12-week goals for the user cycle
      const { data: goalsData, error: goalsError } = await supabase
  .from('0008-ap-goals-12wk')
  .select('*')
  .eq('user_id', user.id)
  .eq('user_cycle_id', userCycleId)
  .eq('status', 'active')      
  .order('created_at', { ascending: false });

      if (goalsError) throw goalsError;

      if (!goalsData || goalsData.length === 0) {
        setGoals([]);
        setGoalProgress({});
        return;
      }

      const goalIds = goalsData.map(g => g.id);

      // Fetch related data for goals
      const [
        { data: rolesData, error: rolesError },
        { data: domainsData, error: domainsError },
        { data: krData, error: krError }
      ] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label, color)').in('parent_id', goalIds).eq('parent_type', 'goal'),
        supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', goalIds).eq('parent_type', 'goal'),
        supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', goalIds).eq('parent_type', 'goal')
      ]);

      if (rolesError) throw rolesError;
      if (domainsError) throw domainsError;
      if (krError) throw krError;

      // Apply scope filtering if specified
      let filteredGoalIds = goalIds;
      if (options.scope && options.scope.type !== 'user' && options.scope.id) {
        switch (options.scope.type) {
          case 'role':
            filteredGoalIds = rolesData?.filter(r => r.role?.id === options.scope!.id).map(r => r.parent_id) || [];
            break;
          case 'domain':
            filteredGoalIds = domainsData?.filter(d => d.domain?.id === options.scope!.id).map(d => d.parent_id) || [];
            break;
          case 'key_relationship':
            filteredGoalIds = krData?.filter(kr => kr.key_relationship?.id === options.scope!.id).map(kr => kr.parent_id) || [];
            break;
        }
      }

      // Transform goals with related data
      const baseSet =
  (options.scope && options.scope.type !== 'user' && options.scope.id)
    ? goalsData.filter(goal => filteredGoalIds.includes(goal.id))
    : goalsData;

const transformedGoals = baseSet.map(goal => ({
  ...goal,
          domains: domainsData?.filter(d => d.parent_id === goal.id).map(d => d.domain).filter(Boolean) || [],
          roles: rolesData?.filter(r => r.parent_id === goal.id).map(r => r.role).filter(Boolean) || [],
          keyRelationships: krData?.filter(kr => kr.parent_id === goal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
        }));

      setGoals(transformedGoals);

      // Calculate progress for each goal
      await calculateGoalProgress(transformedGoals, userCycleId);

    } catch (error) {
      console.error('Error fetching goals:', error);
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

      // Fetch task logs for this week's date range
      const { data: taskLogsData, error: taskLogsError } = await supabase
        .from('0008-ap-task-log')
        .select('*')
        .in('task_id', taskIds)
        .gte('log_date', weekData.start_date)
        .lte('log_date', weekData.end_date);

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

  const calculateGoalProgress = async (goals: TwelveWeekGoal[], userCycleId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const progressData: Record<string, GoalProgress> = {};

      // Get current week number from cycle weeks
      const currentWeek = getCurrentWeekNumber();
      const daysRemaining = daysLeftData?.days_left || 0;

      for (const goal of goals) {
        // Fetch tasks associated with this goal
        const { data: goalJoins } = await supabase
          .from('0008-ap-universal-goals-join')
          .select('parent_id')
          .eq('goal_id', goal.id)
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
        let overallActual = 0;

        if (currentWeekData) {
          // Fetch completed task logs for current week
          const { data: weeklyLogs } = await supabase
            .from('0008-ap-task-log')
            .select('*')
            .in('task_id', taskIds)
            .eq('completed', true)
            .gte('log_date', currentWeekData.start_date)
            .lte('log_date', currentWeekData.end_date);

          weeklyActual = weeklyLogs?.length || 0;
        }

        // Fetch completed task logs for entire cycle
        const { data: overallLogs } = await supabase
          .from('0008-ap-task-log')
          .select('*')
          .in('task_id', taskIds)
          .eq('completed', true)
          .gte('log_date', currentCycle?.start_date || '')
          .lte('log_date', currentCycle?.end_date || '');

        overallActual = overallLogs?.length || 0;
        const overallProgress = goal.total_target > 0 ? Math.round((overallActual / goal.total_target) * 100) : 0;

        progressData[goal.id] = {
          goalId: goal.id,
          currentWeek,
          daysRemaining,
          weeklyActual,
          weeklyTarget: goal.weekly_target,
          overallActual,
          overallTarget: goal.total_target,
          overallProgress,
        };
      }

      setGoalProgress(progressData);
    } catch (error) {
      console.error('Error calculating goal progress:', error);
    }
  };

  const getCurrentWeekNumber = (): number => {
    if (!currentCycle || cycleWeeks.length === 0) return 1;
    
    const now = new Date();
    const currentDateString = formatLocalDate(now);
    
    // Find which week we're currently in
    const currentWeekData = cycleWeeks.find(week => 
      currentDateString >= week.start_date && currentDateString <= week.end_date
    );
    
    return currentWeekData?.week_number || 1;
  };

  const getCurrentWeekIndex = (): number => {
    return Math.max(0, getCurrentWeekNumber() - 1); // Convert to 0-based index
  };

  const getWeekData = (weekIndex: number): WeekData | null => {
    const weekNumber = weekIndex + 1; // Convert from 0-based index
    const weekData = cycleWeeks.find(w => w.week_number === weekNumber);
    if (!weekData) return null;
    
    return {
      weekNumber,
      startDate: weekData.start_date,
      endDate: weekData.end_date,
    };
  };

  const fetchGoalActionsForWeek = async (goalIds: string[], weekStartDate: string, weekEndDate: string): Promise<Record<string, TaskWithLogs[]>> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || goalIds.length === 0) return {};

      // Fetch tasks linked to these goals that overlap with the week
      const { data: goalJoins } = await supabase
        .from('0008-ap-universal-goals-join')
        .select('parent_id, goal_id')
        .in('goal_id', goalIds)
        .eq('parent_type', 'task');

      const taskIds = goalJoins?.map(gj => gj.parent_id) || [];
      if (taskIds.length === 0) return {};

      // Fetch tasks that overlap with the week date range
      const { data: tasksData, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', user.id)
        .in('id', taskIds)
        .not('status', 'in', '(completed,cancelled)')
        .or(`due_date.gte.${weekStartDate},due_date.lte.${weekEndDate},start_date.gte.${weekStartDate},start_date.lte.${weekEndDate}`);

      if (tasksError) throw tasksError;
      if (!tasksData || tasksData.length === 0) return {};

      // Fetch task logs for the week date range
      const { data: logsData, error: logsError } = await supabase
        .from('0008-ap-task-log')
        .select('*')
        .in('task_id', tasksData.map(t => t.id))
        .gte('log_date', weekStartDate)
        .lte('log_date', weekEndDate);

      if (logsError) throw logsError;

      // Group tasks by goal_id and attach logs
      const groupedActions: Record<string, TaskWithLogs[]> = {};
      
      for (const task of tasksData) {
        // Find which goal this task belongs to
        const goalJoin = goalJoins?.find(gj => gj.parent_id === task.id);
        if (!goalJoin) continue;

        const goalId = goalJoin.goal_id;
        const taskLogs = logsData?.filter(log => log.task_id === task.id) || [];
        
        // Calculate weekly metrics
        const completedLogs = taskLogs.filter(log => log.completed);
        const weeklyActual = completedLogs.length;
        const weeklyTarget = task.input_kind === 'count' ? 7 : 1; // Default targets

        const taskWithLogs: TaskWithLogs = {
          ...task,
          logs: taskLogs,
          weeklyActual,
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
  };

  const refreshAllData = async () => {
    try {
      // Fetch user cycle first
      const cycle = await fetchUserCycle();
      if (!cycle) {
        // No active cycle, clear all dependent data
        setCycleWeeks([]);
        setDaysLeftData(null);
        setGoals([]);
        setGoalProgress({});
        return;
      }

      // Fetch cycle-dependent data in parallel
      const [weeks, daysLeft] = await Promise.all([
        fetchCycleWeeks(cycle.id),
        fetchDaysLeftData(cycle.id)
      ]);

      // Fetch goals after we have cycle data
      await fetchGoals(cycle.id);
    } catch (error) {
      console.error('Error refreshing all data:', error);
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
    if (!user || !currentCycle) throw new Error('Missing user or current cycle');

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
        user_cycle_id: currentCycle.id,
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
        p_user: user.id,
      }),
    ]);

    return occId;
  };

  const createGoal = async (goalData: {
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
          user_cycle_id: currentCycle.id,
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
      
      // Refresh goals to include the new one
      await fetchGoals(currentCycle.id);
      
      return data;
    } catch (error) {
      console.error('Error creating goal:', error);
      throw error;
    }
  };

  const createTaskWithWeekPlan = async (taskData: {
    title: string;
    description?: string;
    goal_id?: string;
    selectedWeeks: Array<{ weekNumber: number; targetDays: number }>;
  }): Promise<any> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentCycle) return null;

      // Create the task
      const { data: insertedTask, error: taskError } = await supabase
        .from('0008-ap-tasks')
        .insert({
          user_id: user.id,
          user_cycle_id: currentCycle.id,
          title: taskData.title,
          description: taskData.description,
          type: 'task',
          input_kind: 'count',
          unit: 'days',
          status: 'active',
          is_twelve_week_goal: true,
        })
        .select()
        .single();


      // Create week plans
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

      // Link to goal if specified
      if (taskData.goal_id) {
        const { error: goalJoinError } = await supabase
          .from('0008-ap-universal-goals-join')
          .insert({
            parent_id: insertedTask.id,
            parent_type: 'task',
            goal_id: taskData.goal_id,
            user_id: user.id,
          });

        if (goalJoinError) throw goalJoinError;
      }

      return { id: insertedTask.id };
    } catch (error) {
      console.error('Error creating task with week plan:', error);
      throw error;
    }
  };

  const getWeekDateRange = (weekNumber: number): { start: string; end: string } | null => {
    const weekData = cycleWeeks.find(w => w.week_number === weekNumber);
    return weekData ? { start: weekData.start_date, end: weekData.end_date } : null;
  };

  const refreshGoals = async () => {
    if (currentCycle) {
      await fetchGoals(currentCycle.id);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, [options.scope]);

  // Auto-refresh days left data at midnight
  useEffect(() => {
    if (!currentCycle) return;

    const updateDaysLeft = () => {
      fetchDaysLeftData(currentCycle.id);
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
  }, [currentCycle]);

  return {
    goals,
    currentCycle,
    cycleWeeks,
    daysLeftData,
    goalProgress,
    loading,
    refreshGoals,
    refreshAllData,
    fetchTasksAndPlansForWeek,
    fetchGoalActionsForWeek,
    toggleTaskDay,
    completeActionSuggestion,   // <-- add this line
    createGoal,
    createTaskWithWeekPlan,
    getWeekDateRange,
    getCurrentWeekNumber,
    getCurrentWeekIndex,
    getWeekData,
    weekGoalActions,
    setWeekGoalActions,
  };
}