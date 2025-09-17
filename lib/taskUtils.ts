// lib/taskUtils.ts
import { SupabaseClient } from '@supabase/supabase-js';

//
// Calculate points for a single task
//
export function calculateTaskPoints(
  task: any,
  roles: any[] = [],
  domains: any[] = []
): number {
  let points = 0;

  // Base points by urgency / importance
  if (task.urgency === 'high' && task.importance === 'high') points += 5;
  else if (task.urgency === 'high') points += 3;
  else if (task.importance === 'high') points += 2;

  // Add points for roles
  if (roles.length > 0) {
    points += roles.length; // 1 per role
  }

  // Add points for domains
  if (domains.length > 0) {
    points += domains.length; // 1 per domain
  }

  // Bonus: deposits count more
  if (task.type === 'depositIdea') points += 2;

  // Bonus: tied to a 12-week goal
  if (task.twelve_wk_goal_id) points += 3;

  return points;
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
      .eq('status', 'completed');

    if (tasksErr) throw tasksErr;
    console.log('[AuthenticScore] Tasks fetched:', tasksData?.length);

    // 2. Roles
    const { data: rolesData, error: rolesErr } = await supabase
      .from('0008-ap-roles')
      .select('*')
      .eq('user_id', userId);

    if (rolesErr) throw rolesErr;
    console.log('[AuthenticScore] Roles fetched:', rolesData?.length);

    // 3. Domains
    const { data: domainsData, error: domainsErr } = await supabase
      .from('0008-ap-domains')
      .select('*')
      .eq('user_id', userId);

    if (domainsErr) throw domainsErr;
    console.log('[AuthenticScore] Domains fetched:', domainsData?.length);

    // 4. Withdrawals
    const { data: withdrawalsData, error: withdrawalsErr } = await supabase
      .from('0008-ap-withdrawals')
      .select('*')
      .eq('user_id', userId);

    if (withdrawalsErr) throw withdrawalsErr;
    console.log('[AuthenticScore] Withdrawals fetched:', withdrawalsData?.length);

    // 5. Calculate total points
    let totalDeposits = 0;
    (tasksData ?? []).forEach((task: any) => {
      const taskWithData = {
        ...task,
        roles: rolesData?.filter((r: any) => r.task_id === task.id) ?? [],
        domains: domainsData?.filter((d: any) => d.task_id === task.id) ?? [],
      };

      const pts = calculateTaskPoints(taskWithData, taskWithData.roles, taskWithData.domains);
      totalDeposits += pts;

      console.log(`[AuthenticScore] Task ${task.id} => ${pts} pts`);
    });

    const totalWithdrawals = (withdrawalsData ?? []).length * 2;
    console.log('[AuthenticScore] Total Deposits:', totalDeposits);
    console.log('[AuthenticScore] Total Withdrawals:', totalWithdrawals);

    const finalScore = totalDeposits - totalWithdrawals;
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
    const pts = calculateTaskPoints(task, task.roles ?? [], task.domains ?? []);
    totalDeposits += pts;
  });

  const totalWithdrawals = (withdrawals ?? []).length * 2;
  return totalDeposits - totalWithdrawals;
}
