import { getSupabaseClient } from './supabase';
import {
  WeeklyGoalProgress,
  WeeklyRoleInvestment,
  WeeklyDomainBalance,
  WeeklyWithdrawalAnalysis,
  WeeklyAggregationData,
} from '@/types/reflections';

export const getWeekDateRange = (date: Date = new Date()): { start: string; end: string } => {
  const current = new Date(date);
  const dayOfWeek = current.getDay(); // 0 = Sunday

  // Calculate Sunday (start of week)
  const start = new Date(current);
  start.setDate(current.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);

  // Calculate Saturday (end of week)
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
};

export const fetchWeeklyGoalProgress = async (
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyGoalProgress[]> => {
  const supabase = getSupabaseClient();

  // Fetch active goals
  const { data: goals, error: goalsError } = await supabase
    .from('v_unified_goals')
    .select('id, title, goal_type, weekly_target')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (goalsError || !goals) {
    console.error('Error fetching goals:', goalsError);
    return [];
  }

  const progress: WeeklyGoalProgress[] = [];

  for (const goal of goals) {
    // Count completed tasks for this goal in the week
    const { count, error: countError } = await supabase
      .from('0008-ap-universal-goals-join')
      .select('*, 0008-ap-tasks!inner(completed_at)', { count: 'exact', head: true })
      .eq('parent_type', 'task')
      .gte('0008-ap-tasks.completed_at', weekStart)
      .lte('0008-ap-tasks.completed_at', weekEnd)
      .or(`twelve_wk_goal_id.eq.${goal.id},custom_goal_id.eq.${goal.id}`);

    if (countError) {
      console.error('Error counting tasks:', countError);
      continue;
    }

    const actualCompletion = count || 0;
    const weeklyTarget = goal.weekly_target || 0;
    const percentage = weeklyTarget > 0 ? Math.round((actualCompletion / weeklyTarget) * 100) : 0;

    progress.push({
      goal_id: goal.id,
      goal_title: goal.title,
      goal_type: goal.goal_type,
      weekly_target: weeklyTarget,
      actual_completion: actualCompletion,
      completion_percentage: percentage,
    });
  }

  return progress;
};

export const fetchWeeklyRoleInvestments = async (
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyRoleInvestment[]> => {
  const supabase = getSupabaseClient();

  // Fetch all roles
  const { data: roles, error: rolesError } = await supabase
    .from('0008-ap-roles')
    .select('id, label, color')
    .eq('user_id', userId)
    .order('label');

  if (rolesError || !roles) {
    console.error('Error fetching roles:', rolesError);
    return [];
  }

  const investments: WeeklyRoleInvestment[] = [];

  for (const role of roles) {
    // Count tasks completed for this role in the week
    const { count: taskCount } = await supabase
      .from('0008-ap-universal-roles-join')
      .select('*, 0008-ap-tasks!inner(completed_at)', { count: 'exact', head: true })
      .eq('parent_type', 'task')
      .eq('role_id', role.id)
      .gte('0008-ap-tasks.completed_at', weekStart)
      .lte('0008-ap-tasks.completed_at', weekEnd);

    // Count deposit ideas created for this role in the week
    const { count: depositCount } = await supabase
      .from('0008-ap-universal-roles-join')
      .select('*, 0008-ap-deposit-ideas!inner(created_at)', { count: 'exact', head: true })
      .eq('parent_type', 'depositIdea')
      .eq('role_id', role.id)
      .gte('0008-ap-deposit-ideas.created_at', weekStart)
      .lte('0008-ap-deposit-ideas.created_at', weekEnd);

    const totalTasks = taskCount || 0;
    const totalDeposits = depositCount || 0;

    // Only include roles with activity
    if (totalTasks > 0 || totalDeposits > 0) {
      investments.push({
        role_id: role.id,
        role_label: role.label,
        role_color: role.color,
        task_count: totalTasks,
        deposit_idea_count: totalDeposits,
      });
    }
  }

  // Sort by task count descending
  return investments.sort((a, b) => b.task_count - a.task_count);
};

export const fetchWeeklyDomainBalance = async (
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyDomainBalance[]> => {
  const supabase = getSupabaseClient();

  // Fetch all domains
  const { data: domains, error: domainsError } = await supabase
    .from('0008-ap-domains')
    .select('id, name, color')
    .order('name');

  if (domainsError || !domains) {
    console.error('Error fetching domains:', domainsError);
    return [];
  }

  const balance: WeeklyDomainBalance[] = [];

  for (const domain of domains) {
    // Count tasks completed for this domain in the week
    const { count: taskCount } = await supabase
      .from('0008-ap-universal-domains-join')
      .select('*, 0008-ap-tasks!inner(completed_at)', { count: 'exact', head: true })
      .eq('parent_type', 'task')
      .eq('domain_id', domain.id)
      .gte('0008-ap-tasks.completed_at', weekStart)
      .lte('0008-ap-tasks.completed_at', weekEnd);

    const totalActivities = taskCount || 0;

    // Only include domains with activity
    if (totalActivities > 0) {
      balance.push({
        domain_id: domain.id,
        domain_name: domain.name,
        domain_color: domain.color,
        activity_count: totalActivities,
      });
    }
  }

  // Sort by activity count descending
  return balance.sort((a, b) => b.activity_count - a.activity_count);
};

export const fetchWeeklyWithdrawalAnalysis = async (
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyWithdrawalAnalysis[]> => {
  const supabase = getSupabaseClient();

  // Fetch withdrawals in the week
  const { data: withdrawals, error: withdrawalsError } = await supabase
    .from('0008-ap-withdrawals')
    .select('id, amount, withdrawn_at')
    .eq('user_id', userId)
    .gte('withdrawn_at', weekStart)
    .lte('withdrawn_at', weekEnd);

  if (withdrawalsError || !withdrawals || withdrawals.length === 0) {
    return [];
  }

  // Group withdrawals by role
  const roleMap = new Map<string, { label: string; count: number; amount: number }>();

  for (const withdrawal of withdrawals) {
    // Fetch associated roles
    const { data: roleJoins } = await supabase
      .from('0008-ap-universal-roles-join')
      .select('role_id, 0008-ap-roles(label)')
      .eq('parent_type', 'withdrawal')
      .eq('parent_id', withdrawal.id);

    if (roleJoins) {
      for (const join of roleJoins) {
        const roleLabel = (join as any)['0008-ap-roles']?.label || 'Unknown';
        const existing = roleMap.get(join.role_id) || { label: roleLabel, count: 0, amount: 0 };
        existing.count += 1;
        existing.amount += withdrawal.amount || 0;
        roleMap.set(join.role_id, existing);
      }
    }
  }

  // Convert to array and sort by count descending
  const analysis: WeeklyWithdrawalAnalysis[] = Array.from(roleMap.entries()).map(([roleId, data]) => ({
    role_id: roleId,
    role_label: data.label,
    withdrawal_count: data.count,
    total_amount: data.amount,
  }));

  return analysis.sort((a, b) => b.withdrawal_count - a.withdrawal_count);
};

export const fetchWeeklyAggregationData = async (
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyAggregationData> => {
  const [goalProgress, roleInvestments, domainBalance, withdrawalAnalysis] = await Promise.all([
    fetchWeeklyGoalProgress(userId, weekStart, weekEnd),
    fetchWeeklyRoleInvestments(userId, weekStart, weekEnd),
    fetchWeeklyDomainBalance(userId, weekStart, weekEnd),
    fetchWeeklyWithdrawalAnalysis(userId, weekStart, weekEnd),
  ]);

  const totalTargetsHit = goalProgress.filter(g => g.completion_percentage >= 100).length;
  const totalGoalsTracked = goalProgress.length;

  return {
    goalProgress,
    roleInvestments,
    domainBalance,
    withdrawalAnalysis,
    totalTargetsHit,
    totalGoalsTracked,
  };
};
