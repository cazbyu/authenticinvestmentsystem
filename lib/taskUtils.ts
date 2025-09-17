/**
 * Centralized task scoring utilities
 * 
 * This file contains the authoritative implementations of task scoring logic
 * used throughout the application for calculating authentic investment points.
 */

/**
 * Calculate the "points" for a given task based on roles, domains, urgency, importance, and goal type.
 */
export const calculateTaskPoints = (
  task: any,
  roles: any[] = [],
  domains: any[] = []
): number => {
  let points = 0;

  // Add points for roles and domains
  if (roles && roles.length > 0) points += roles.length;
  if (domains && domains.length > 0) points += domains.length;

  // Authentic deposit bonus
  if (task.is_authentic_deposit) points += 2;

  // Urgent/important matrix scoring
  if (task.is_urgent && task.is_important) points += 1.5;
  else if (!task.is_urgent && task.is_important) points += 3;
  else if (task.is_urgent && !task.is_important) points += 1;
  else points += 0.5;

  // Twelve-week goal bonus
  if (task.is_twelve_week_goal) points += 2;

  return Math.round(points * 10) / 10;
};

/**
 * Calculate the authentic score for a user based on completed tasks and withdrawals.
 * This is the main function used for calculating the total authentic investment balance.
 */
export const calculateAuthenticScore = async (
  supabase: any,
  userId: string
): Promise<number> => {
  try {
    // Calculate deposits from completed tasks
    const { data: tasksData, error: tasksError } = await supabase
      .from('0008-ap-tasks')
      .select('*')
      .eq('user_id', userId)
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

    // Calculate withdrawals
    const { data: withdrawalsData, error: withdrawalsError } = await supabase
      .from('0008-ap-withdrawals')
      .select('amount')
      .eq('user_id', userId);

    if (withdrawalsError) throw withdrawalsError;

    const totalWithdrawals = withdrawalsData?.reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0) || 0;
    
    const balance = totalDeposits - totalWithdrawals;
    return Math.round(balance * 10) / 10;
  } catch (error) {
    console.error('Error calculating authentic score:', error);
    return 0;
  }
};

/**
 * Calculate the authentic score for a set of tasks (without database queries).
 * Used when you already have the tasks and their related data.
 */
export const calculateAuthenticScoreFromTasks = (
  tasks: any[],
  rolesByTask: Record<string, any[]> = {},
  domainsByTask: Record<string, any[]> = {}
): number => {
  if (!tasks || tasks.length === 0) return 0;

  let total = 0;

  for (const task of tasks) {
    const roles = rolesByTask[task.id] || [];
    const domains = domainsByTask[task.id] || [];
    total += calculateTaskPoints(task, roles, domains);
  }

  return Math.round(total * 10) / 10;
};