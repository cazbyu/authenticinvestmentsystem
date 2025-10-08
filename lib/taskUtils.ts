// lib/taskUtils.ts
import { SupabaseClient } from '@supabase/supabase-js';

//
// Calculate points for a single task
//
export function calculateTaskPoints(
  task: any,
  roles: any[] = [],
  domains: any[] = [],
  goals: any[] = []
): number {
  let points = 0;

  // Role + Domain points
  if (roles.length > 0) points += roles.length;
  if (domains.length > 0) points += domains.length;

  // Authentic deposit bonus
  if (task.is_authentic_deposit) points += 2;

  // Urgency / Importance weights
  if (task.is_urgent && task.is_important) points += 1.5;
  else if (!task.is_urgent && task.is_important) points += 3;
  else if (task.is_urgent && !task.is_important) points += 1;
  else points += 0.5;

  // Linked to active goal bonus (exclude archived/cancelled goals)
  // Award +2 bonus for any active goal (12-week OR custom)
  const activeGoals = (goals || []).filter(g => g.goal_type !== 'deleted' && g.status !== 'archived' && g.status !== 'cancelled');
  if (activeGoals.length > 0) points += 2;

  return Math.round(points * 10) / 10;
}

//
// Calculate Authentic Score directly from Supabase
//
export async function calculateAuthenticScore(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  try {
    console.log('[AuthenticScore] Starting calculation for user:', userId);

    // 1. Completed tasks (deposits)
    const { data: tasksData, error: tasksErr } = await supabase
      .from('0008-ap-tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null);

    if (tasksErr) throw tasksErr;
    if (!tasksData || tasksData.length === 0) {
      console.log('[AuthenticScore] No completed tasks found.');
      return 0;
    }

    const taskIds = tasksData.map(t => t.id);

    // 2. Roles + Domains + Goals via join tables
    const [
      { data: rolesData, error: rolesErr },
      { data: domainsData, error: domainsErr },
      { data: goalsData, error: goalsErr }
    ] = await Promise.all([
        supabase
          .from('0008-ap-universal-roles-join')
          .select('parent_id, role:0008-ap-roles(id, label)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-domains-join')
          .select('parent_id, domain:0008-ap-domains(id, name)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-goals-join')
          .select('parent_id, goal_type, twelve_wk_goal:0008-ap-goals-12wk(id, title, status), custom_goal:0008-ap-goals-custom(id, title, status)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
      ]);

    if (rolesErr) throw rolesErr;
    if (domainsErr) throw domainsErr;
    if (goalsErr) throw goalsErr;

    // 3. Calculate deposits
    let totalDeposits = 0;
    for (const task of tasksData) {
      const roles =
        rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) ?? [];
      const domains =
        domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) ?? [];

      // Transform polymorphic goals
      const taskGoals = goalsData?.filter(g => g.parent_id === task.id).map(g => {
        if (g.goal_type === 'twelve_wk_goal' && g.twelve_wk_goal) {
          const goal = g.twelve_wk_goal;
          if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
            return null;
          }
          return { ...goal, goal_type: '12week' };
        } else if (g.goal_type === 'custom_goal' && g.custom_goal) {
          const goal = g.custom_goal;
          if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
            return null;
          }
          return { ...goal, goal_type: 'custom' };
        }
        return null;
      }).filter(Boolean) || [];

      const pts = calculateTaskPoints(task, roles, domains, taskGoals);
      totalDeposits += pts;

    }

    // 4. Withdrawals
    const { data: withdrawalsData, error: withdrawalsErr } = await supabase
      .from('0008-ap-withdrawals')
      .select('amount')
      .eq('user_id', userId);

    if (withdrawalsErr) throw withdrawalsErr;

    const totalWithdrawals =
      withdrawalsData?.reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0) || 0;

    console.log('[AuthenticScore] Deposits:', totalDeposits);
    console.log('[AuthenticScore] Withdrawals:', totalWithdrawals);

    const finalScore = Math.round((totalDeposits - totalWithdrawals) * 10) / 10;
    console.log('[AuthenticScore] Final Score:', finalScore);

    return finalScore;
  } catch (err) {
    console.error('Error calculating authentic score:', err);
    return 0;
  }
}

//
// Variant: calculate Authentic Score from already-fetched tasks
//
export function calculateAuthenticScoreFromTasks(
  tasks: any[],
  withdrawals: any[] = []
): number {
  let totalDeposits = 0;

  (tasks ?? []).forEach((task: any) => {
    const pts = calculateTaskPoints(task, task.roles ?? [], task.domains ?? [], task.goals ?? []);
    totalDeposits += pts;
  });

  const totalWithdrawals = (withdrawals ?? []).reduce(
    (sum, w) => sum + parseFloat(w.amount?.toString() ?? '0'),
    0
  );

  return Math.round((totalDeposits - totalWithdrawals) * 10) / 10;
}

//
// Calculate Authentic Score filtered by a specific role
//
export async function calculateAuthenticScoreForRole(
  supabase: SupabaseClient,
  userId: string,
  roleId: string
): Promise<number> {
  try {
    console.log('[AuthenticScoreForRole] Starting calculation for user:', userId, 'role:', roleId);

    // 1. Completed tasks (deposits)
    const { data: tasksData, error: tasksErr } = await supabase
      .from('0008-ap-tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null);

    if (tasksErr) throw tasksErr;
    if (!tasksData || tasksData.length === 0) {
      console.log('[AuthenticScoreForRole] No completed tasks found.');
      return 0;
    }

    const taskIds = tasksData.map(t => t.id);

    // 2. Roles + Domains + Goals via join tables
    const [
      { data: rolesData, error: rolesErr },
      { data: domainsData, error: domainsErr },
      { data: goalsData, error: goalsErr }
    ] = await Promise.all([
        supabase
          .from('0008-ap-universal-roles-join')
          .select('parent_id, role:0008-ap-roles(id, label)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-domains-join')
          .select('parent_id, domain:0008-ap-domains(id, name)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-goals-join')
          .select('parent_id, goal_type, twelve_wk_goal:0008-ap-goals-12wk(id, title, status), custom_goal:0008-ap-goals-custom(id, title, status)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
      ]);

    if (rolesErr) throw rolesErr;
    if (domainsErr) throw domainsErr;
    if (goalsErr) throw goalsErr;

    // 3. Filter tasks that have the specified role
    const roleTaskIds = rolesData?.filter(r => r.role?.id === roleId).map(r => r.parent_id) || [];
    const filteredTasks = tasksData.filter(task => roleTaskIds.includes(task.id));

    // 4. Calculate deposits for filtered tasks
    let totalDeposits = 0;
    for (const task of filteredTasks) {
      const roles =
        rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) ?? [];
      const domains =
        domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) ?? [];

      // Transform polymorphic goals
      const taskGoals = goalsData?.filter(g => g.parent_id === task.id).map(g => {
        if (g.goal_type === 'twelve_wk_goal' && g.twelve_wk_goal) {
          const goal = g.twelve_wk_goal;
          if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
            return null;
          }
          return { ...goal, goal_type: '12week' };
        } else if (g.goal_type === 'custom_goal' && g.custom_goal) {
          const goal = g.custom_goal;
          if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
            return null;
          }
          return { ...goal, goal_type: 'custom' };
        }
        return null;
      }).filter(Boolean) || [];

      const pts = calculateTaskPoints(task, roles, domains, taskGoals);
      totalDeposits += pts;
    }

    // 5. Withdrawals (all withdrawals are counted, not filtered by role)
    const { data: withdrawalsData, error: withdrawalsErr } = await supabase
      .from('0008-ap-withdrawals')
      .select('amount')
      .eq('user_id', userId);

    if (withdrawalsErr) throw withdrawalsErr;

    const totalWithdrawals =
      withdrawalsData?.reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0) || 0;

    console.log('[AuthenticScoreForRole] Deposits:', totalDeposits);
    console.log('[AuthenticScoreForRole] Withdrawals:', totalWithdrawals);

    const finalScore = Math.round((totalDeposits - totalWithdrawals) * 10) / 10;
    console.log('[AuthenticScoreForRole] Final Score:', finalScore);

    return finalScore;
  } catch (err) {
    console.error('Error calculating authentic score for role:', err);
    return 0;
  }
}

//
// Calculate Authentic Score filtered by a specific domain
//
export async function calculateAuthenticScoreForDomain(
  supabase: SupabaseClient,
  userId: string,
  domainId: string
): Promise<number> {
  try {
    console.log('[AuthenticScoreForDomain] Starting calculation for user:', userId, 'domain:', domainId);

    // 1. Completed tasks (deposits)
    const { data: tasksData, error: tasksErr } = await supabase
      .from('0008-ap-tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null);

    if (tasksErr) throw tasksErr;
    if (!tasksData || tasksData.length === 0) {
      console.log('[AuthenticScoreForDomain] No completed tasks found.');
      return 0;
    }

    const taskIds = tasksData.map(t => t.id);

    // 2. Roles + Domains + Goals via join tables
    const [
      { data: rolesData, error: rolesErr },
      { data: domainsData, error: domainsErr },
      { data: goalsData, error: goalsErr }
    ] = await Promise.all([
        supabase
          .from('0008-ap-universal-roles-join')
          .select('parent_id, role:0008-ap-roles(id, label)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-domains-join')
          .select('parent_id, domain:0008-ap-domains(id, name)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-goals-join')
          .select('parent_id, goal_type, twelve_wk_goal:0008-ap-goals-12wk(id, title, status), custom_goal:0008-ap-goals-custom(id, title, status)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
      ]);

    if (rolesErr) throw rolesErr;
    if (domainsErr) throw domainsErr;
    if (goalsErr) throw goalsErr;

    // 3. Filter tasks that have the specified domain
    const domainTaskIds = domainsData?.filter(d => d.domain?.id === domainId).map(d => d.parent_id) || [];
    const filteredTasks = tasksData.filter(task => domainTaskIds.includes(task.id));

    // 4. Calculate deposits for filtered tasks
    let totalDeposits = 0;
    for (const task of filteredTasks) {
      const roles =
        rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) ?? [];
      const domains =
        domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) ?? [];

      // Transform polymorphic goals
      const taskGoals = goalsData?.filter(g => g.parent_id === task.id).map(g => {
        if (g.goal_type === 'twelve_wk_goal' && g.twelve_wk_goal) {
          const goal = g.twelve_wk_goal;
          if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
            return null;
          }
          return { ...goal, goal_type: '12week' };
        } else if (g.goal_type === 'custom_goal' && g.custom_goal) {
          const goal = g.custom_goal;
          if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
            return null;
          }
          return { ...goal, goal_type: 'custom' };
        }
        return null;
      }).filter(Boolean) || [];

      const pts = calculateTaskPoints(task, roles, domains, taskGoals);
      totalDeposits += pts;
    }

    // 5. Withdrawals (all withdrawals are counted, not filtered by domain)
    const { data: withdrawalsData, error: withdrawalsErr } = await supabase
      .from('0008-ap-withdrawals')
      .select('amount')
      .eq('user_id', userId);

    if (withdrawalsErr) throw withdrawalsErr;

    const totalWithdrawals =
      withdrawalsData?.reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0) || 0;

    console.log('[AuthenticScoreForDomain] Deposits:', totalDeposits);
    console.log('[AuthenticScoreForDomain] Withdrawals:', totalWithdrawals);

    const finalScore = Math.round((totalDeposits - totalWithdrawals) * 10) / 10;
    console.log('[AuthenticScoreForDomain] Final Score:', finalScore);

    return finalScore;
  } catch (err) {
    console.error('Error calculating authentic score for domain:', err);
    return 0;
  }
}

export interface GoalProgressData {
  weeklyActual: number;
  weeklyTarget: number;
  overallProgress: number;
  currentWeek: number;
  totalActual?: number;
  totalTarget?: number;
}

export async function calculateGoalProgress(
  supabase: SupabaseClient,
  goalId: string,
  goalType: '12week' | 'custom',
  weeklyTarget: number = 3,
  totalTarget: number = 36
): Promise<GoalProgressData> {
  try {
    const goalTypeForJoin = goalType === '12week' ? 'twelve_wk_goal' : 'custom_goal';
    const goalIdField = goalType === '12week' ? 'twelve_wk_goal_id' : 'custom_goal_id';

    const { data: taskJoins, error: joinError } = await supabase
      .from('0008-ap-universal-goals-join')
      .select('parent_id')
      .eq(goalIdField, goalId)
      .eq('goal_type', goalTypeForJoin)
      .eq('parent_type', 'task');

    if (joinError) throw joinError;

    if (!taskJoins || taskJoins.length === 0) {
      return {
        weeklyActual: 0,
        weeklyTarget: weeklyTarget,
        overallProgress: 0,
        currentWeek: 1,
      };
    }

    const taskIds = taskJoins.map(j => j.parent_id);

    const { data: logs, error: logsError } = await supabase
      .from('0008-ap-task-log')
      .select('task_id, measured_on, value, completed')
      .in('task_id', taskIds);

    if (logsError) throw logsError;

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const thisWeekLogs = (logs || []).filter(log => {
      const logDate = new Date(log.measured_on);
      return logDate >= startOfWeek && logDate <= endOfWeek && log.completed;
    });

    const weeklyActual = thisWeekLogs.length;

    const totalCompletedLogs = (logs || []).filter(log => log.completed).length;
    const overallProgress = totalTarget > 0 ? Math.round((totalCompletedLogs / totalTarget) * 100) : 0;

    return {
      weeklyActual,
      weeklyTarget,
      overallProgress,
      currentWeek: 1,
    };
  } catch (error) {
    console.error('Error calculating goal progress:', error);
    return {
      weeklyActual: 0,
      weeklyTarget: weeklyTarget,
      overallProgress: 0,
      currentWeek: 1,
    };
  }
}

/**
 * Calculate total goal progress across ALL weeks in a timeline
 * This provides the cumulative completion percentage for a goal
 */
export async function calculateTotalGoalProgress(
  supabase: SupabaseClient,
  goalId: string,
  goalType: '12week' | 'custom',
  timeline: { id: string; source: 'global' | 'custom' }
): Promise<{ totalActual: number; totalTarget: number; percentage: number }> {
  try {
    const goalTypeForJoin = goalType === '12week' ? 'twelve_wk_goal' : 'custom_goal';
    const goalIdField = goalType === '12week' ? 'twelve_wk_goal_id' : 'custom_goal_id';

    // 1. Get all tasks linked to this goal
    const { data: taskJoins, error: joinError } = await supabase
      .from('0008-ap-universal-goals-join')
      .select('parent_id')
      .eq(goalIdField, goalId)
      .eq('goal_type', goalTypeForJoin)
      .eq('parent_type', 'task');

    if (joinError) throw joinError;

    if (!taskJoins || taskJoins.length === 0) {
      return { totalActual: 0, totalTarget: 0, percentage: 0 };
    }

    const taskIds = taskJoins.map(j => j.parent_id);

    // 2. Get all week plans for these tasks in the timeline
    const timelineIdField = timeline.source === 'global' ? 'user_global_timeline_id' : 'user_custom_timeline_id';

    const { data: weekPlans, error: weekPlansError } = await supabase
      .from('0008-ap-task-week-plan')
      .select('task_id, week_number, target_days')
      .in('task_id', taskIds)
      .eq(timelineIdField, timeline.id)
      .is('deleted_at', null);

    if (weekPlansError) throw weekPlansError;

    if (!weekPlans || weekPlans.length === 0) {
      return { totalActual: 0, totalTarget: 0, percentage: 0 };
    }

    // 3. Get timeline weeks with date boundaries to match occurrences to specific weeks
    const { data: timelineWeeks, error: weeksError } = await supabase
      .from('v_unified_timeline_weeks')
      .select('week_number, week_start, week_end')
      .eq('timeline_id', timeline.id)
      .eq('source', timeline.source)
      .order('week_number', { ascending: true });

    if (weeksError) throw weeksError;

    if (!timelineWeeks || timelineWeeks.length === 0) {
      console.log('[calculateTotalGoalProgress] No timeline weeks found');
      return { totalActual: 0, totalTarget: 0, percentage: 0 };
    }

    // Get current date to filter out future weeks
    const today = new Date().toISOString().split('T')[0];
    const currentWeekNumber = timelineWeeks.find(w => w.week_start <= today && w.week_end >= today)?.week_number;
    const maxWeekNumber = currentWeekNumber || timelineWeeks[timelineWeeks.length - 1].week_number;

    console.log('[calculateTotalGoalProgress] Today:', today, 'Current week:', currentWeekNumber, 'Max week:', maxWeekNumber);

    // 4. Get all completed occurrences for these tasks
    const { data: completedOccurrences, error: occurrencesError } = await supabase
      .from('0008-ap-tasks')
      .select('parent_task_id, due_date')
      .in('parent_task_id', taskIds)
      .eq('status', 'completed')
      .is('deleted_at', null);

    if (occurrencesError) throw occurrencesError;

    console.log('[calculateTotalGoalProgress] Total occurrences retrieved:', completedOccurrences?.length || 0);

    // Count total actual completions (capped per task per week by target_days)
    let totalActual = 0;
    let totalTarget = 0;

    // Group occurrences by task and week based on due_date matching to week boundaries
    const occurrencesByTaskAndWeek: Record<string, Record<number, number>> = {};

    for (const occ of completedOccurrences || []) {
      // Find which week this occurrence belongs to based on its due_date
      const matchingWeek = timelineWeeks.find(w =>
        occ.due_date >= w.week_start && occ.due_date <= w.week_end
      );

      if (!matchingWeek) {
        console.log('[calculateTotalGoalProgress] Occurrence outside timeline range:', occ.due_date);
        continue;
      }

      // Skip future weeks (only count up to current week)
      if (matchingWeek.week_number > maxWeekNumber) {
        console.log('[calculateTotalGoalProgress] Skipping future week:', matchingWeek.week_number);
        continue;
      }

      // Check if this task has a week plan entry for this week
      const hasWeekPlan = weekPlans.some(
        wp => wp.task_id === occ.parent_task_id && wp.week_number === matchingWeek.week_number
      );

      if (!hasWeekPlan) {
        console.log('[calculateTotalGoalProgress] No week plan for task:', occ.parent_task_id, 'week:', matchingWeek.week_number);
        continue;
      }

      // Initialize counters if needed
      if (!occurrencesByTaskAndWeek[occ.parent_task_id]) {
        occurrencesByTaskAndWeek[occ.parent_task_id] = {};
      }
      if (!occurrencesByTaskAndWeek[occ.parent_task_id][matchingWeek.week_number]) {
        occurrencesByTaskAndWeek[occ.parent_task_id][matchingWeek.week_number] = 0;
      }

      // Count this occurrence for the specific week it belongs to
      occurrencesByTaskAndWeek[occ.parent_task_id][matchingWeek.week_number]++;
      console.log('[calculateTotalGoalProgress] Counted occurrence:', {
        taskId: occ.parent_task_id,
        dueDate: occ.due_date,
        weekNumber: matchingWeek.week_number,
        count: occurrencesByTaskAndWeek[occ.parent_task_id][matchingWeek.week_number]
      });
    }

    // Cap each week's actual by its target and sum them up
    // Also calculate totalTarget only for weeks up to and including the current week
    for (const weekPlan of weekPlans) {
      // Skip future weeks
      if (weekPlan.week_number > maxWeekNumber) {
        continue;
      }

      const taskId = weekPlan.task_id;
      const weekNumber = weekPlan.week_number;
      const target = weekPlan.target_days || 0;
      const actual = occurrencesByTaskAndWeek[taskId]?.[weekNumber] || 0;
      const cappedActual = Math.min(actual, target);

      console.log('[calculateTotalGoalProgress] Week plan:', {
        taskId,
        weekNumber,
        target,
        actual,
        cappedActual
      });

      totalActual += cappedActual;
      totalTarget += target;
    }

    const percentage = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

    console.log('[calculateTotalGoalProgress] FINAL RESULT:', {
      goalId,
      goalType,
      taskCount: taskIds.length,
      weekPlansCount: weekPlans.length,
      weeksIncluded: `1-${maxWeekNumber}`,
      occurrencesCount: completedOccurrences?.length || 0,
      totalTarget,
      totalActual,
      percentage: `${percentage}%`,
      calculationBreakdown: `${totalActual} completed out of ${totalTarget} target (weeks 1-${maxWeekNumber}) = ${percentage}%`
    });

    return { totalActual, totalTarget, percentage };
  } catch (error) {
    console.error('Error calculating total goal progress:', error);
    return { totalActual: 0, totalTarget: 0, percentage: 0 };
  }
}

/**
 * Checks if a completion occurrence already exists for a specific parent task and date
 */
export async function checkOccurrenceExists(
  supabase: SupabaseClient,
  parentTaskId: string,
  dueDate: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('0008-ap-tasks')
      .select('id')
      .eq('parent_task_id', parentTaskId)
      .eq('due_date', dueDate)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('[checkOccurrenceExists] Error:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('[checkOccurrenceExists] Unexpected error:', error);
    return false;
  }
}

/**
 * Gets all completed dates for a parent task within a week range
 */
export async function getWeekCompletionStatus(
  supabase: SupabaseClient,
  parentTaskId: string,
  weekStart: string,
  weekEnd: string
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('0008-ap-tasks')
      .select('due_date')
      .eq('parent_task_id', parentTaskId)
      .eq('status', 'completed')
      .gte('due_date', weekStart)
      .lte('due_date', weekEnd)
      .is('deleted_at', null);

    if (error) {
      console.error('[getWeekCompletionStatus] Error:', error);
      return [];
    }

    return (data || []).map(item => item.due_date);
  } catch (error) {
    console.error('[getWeekCompletionStatus] Unexpected error:', error);
    return [];
  }
}
