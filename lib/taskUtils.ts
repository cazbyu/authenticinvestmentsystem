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

  // Linked to 12-week goal bonus
  if (task.is_twelve_week_goal) points += 2;

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

    // 2. Roles + Domains via join tables
    const [{ data: rolesData, error: rolesErr }, { data: domainsData, error: domainsErr }] =
      await Promise.all([
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
      ]);

    if (rolesErr) throw rolesErr;
    if (domainsErr) throw domainsErr;

    // 3. Calculate deposits
    let totalDeposits = 0;
    for (const task of tasksData) {
      const roles =
        rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) ?? [];
      const domains =
        domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) ?? [];

      const pts = calculateTaskPoints(task, roles, domains);
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
    const pts = calculateTaskPoints(task, task.roles ?? [], task.domains ?? []);
    totalDeposits += pts;
  });

  const totalWithdrawals = (withdrawals ?? []).reduce(
    (sum, w) => sum + parseFloat(w.amount?.toString() ?? '0'),
    0
  );

  return Math.round((totalDeposits - totalWithdrawals) * 10) / 10;
}
