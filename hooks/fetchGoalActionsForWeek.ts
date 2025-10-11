// hooks/fetchGoalActionsForWeek.ts
import { getSupabaseClient } from '@/lib/supabase';

/** Minimal shapes so this helper stands alone. */
export type TimelineWeekInput = {
  week_number?: number;
  weekNumber?: number;
  week_start?: string;
  start_date?: string;
  startDate?: string;
  week_end?: string;
  end_date?: string;
  endDate?: string;
  [k: string]: any;
};

export type TaskLog = {
  id: string;
  task_id: string;
  measured_on: string;
  week_number: number;
  day_of_week?: number;
  value: number;
  created_at: string;
  completed?: boolean;
};

export type TaskWithLogs = {
  id: string;
  title: string;
  recurrence_rule?: string;
  logs: TaskLog[];
  weeklyActual: number;
  weeklyTarget: number;
  goal_type?: '12week' | 'custom';
  roles?: Array<{ id: string; label: string; color?: string }>;
  domains?: Array<{ id: string; name: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
  selectedWeeks?: number[]; // Array of week numbers this action is scheduled for
  [k: string]: any; // carry through task fields from DB
};

/** Small helpers to normalize week objects coming from different views/shapes */
const startOf = (w?: TimelineWeekInput) =>
  w?.week_start ?? w?.start_date ?? w?.startDate;

const endOf = (w?: TimelineWeekInput) =>
  w?.week_end ?? w?.end_date ?? w?.endDate;

const numberOf = (w?: TimelineWeekInput) =>
  (typeof w?.week_number === 'number' ? w?.week_number : w?.weekNumber) as number | undefined;

/**
 * Fetch action tasks + occurrences for given goals within a specific week.
 * Includes detailed console.debug() logging at each step.
 */
export async function fetchGoalActionsForWeek(
  goalIds: string[],
  weekNumber: number,
  timeline: { id: string; source: 'global' | 'custom' },
  cycleWeeks: TimelineWeekInput[]
): Promise<Record<string, TaskWithLogs[]>> {
  try {
    console.log('[fetchGoalActionsForWeek] called with:', {
      goalIdsCount: goalIds?.length ?? 0,
      goalIds,
      weekNumber,
      timelineId: timeline.id,
      timelineSource: timeline.source,
      cycleWeeksCount: cycleWeeks?.length ?? 0,
    });

    const supabase = getSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user ?? null;
    if (!user) {
      console.log('[fetchGoalActionsForWeek] no authenticated user — returning {}');
      return {};
    }
    if (!goalIds || goalIds.length === 0) {
      console.log('[fetchGoalActionsForWeek] empty goalIds — returning {}');
      return {};
    }

    // Resolve the requested week from the provided weeks
    const week = cycleWeeks.find(w => numberOf(w) === weekNumber);

    const weekStartDate = startOf(week);
    const weekEndDate = endOf(week);

    console.log('[fetchGoalActionsForWeek] resolved week:', {
      weekNumber,
      found: Boolean(week),
      weekStartDate,
      weekEndDate,
    });

    if (!weekStartDate || !weekEndDate) {
      console.warn('[fetchGoalActionsForWeek] missing week bounds — returning {}');
      return {};
    }

    // ---- 1) Join: which parent tasks are linked to the requested goals?
    // Build OR filter for both goal types since we might have mixed goals
    const twelveWkFilter = `twelve_wk_goal_id.in.(${goalIds.join(',')})`;
    const customFilter = `custom_goal_id.in.(${goalIds.join(',')})`;
    const orFilter = `${twelveWkFilter},${customFilter}`;
    console.log('[fetchGoalActionsForWeek] universal-goals-join query filter:', orFilter);

    const { data: goalJoins, error: joinsErr } = await supabase
      .from('0008-ap-universal-goals-join')
      .select('parent_id, twelve_wk_goal_id, custom_goal_id, goal_type')
      .or(orFilter)
      .eq('parent_type', 'task');

    if (joinsErr) {
      console.error('[fetchGoalActionsForWeek] error loading goal joins:', joinsErr);
      return {};
    }

    const taskIds = (goalJoins ?? []).map(j => j.parent_id);
    console.log('[fetchGoalActionsForWeek] goalJoins:', {
      count: goalJoins?.length ?? 0,
      taskIdsCount: taskIds.length,
      sample: goalJoins?.slice(0, 3),
    });

    if (taskIds.length === 0) {
      console.log('[fetchGoalActionsForWeek] no parent tasks linked — returning {}');
      return {};
    }

    // ---- 2) Load the parent action tasks (only "count" type, not completed/cancelled)
    const { data: tasksData, error: tasksErr } = await supabase
      .from('0008-ap-tasks')
      .select('*')
      .eq('user_id', user.id)
      .in('id', taskIds)
      .eq('input_kind', 'count')
      .not('status', 'in', '(completed,cancelled)');

    if (tasksErr) {
      console.error('[fetchGoalActionsForWeek] error fetching tasks:', tasksErr);
      return {};
    }
    console.log('[fetchGoalActionsForWeek] tasks fetched:', {
      count: tasksData?.length ?? 0,
      sample: tasksData?.slice(0, 3),
    });

    if (!tasksData || tasksData.length === 0) {
      console.log('[fetchGoalActionsForWeek] 0 tasks after filtering — returning {}');
      return {};
    }

    // ---- 3) Week-plan rows for the target week (to get target_days)
    let weekPlanQuery = supabase
      .from('0008-ap-task-week-plan')
      .select('*')
      .in('task_id', taskIds)
      .eq('week_number', weekNumber)
      .eq(timeline.source === 'global' ? 'user_global_timeline_id' : 'user_custom_timeline_id', timeline.id)
      .is('deleted_at', null);

    const { data: weekPlansData, error: weekPlansErr } = await weekPlanQuery;
    if (weekPlansErr) {
      console.error('[fetchGoalActionsForWeek] error fetching week plans:', weekPlansErr);
      return {};
    }
    console.log('[fetchGoalActionsForWeek] week plans fetched:', {
      count: weekPlansData?.length ?? 0,
      sample: weekPlansData?.slice(0, 3),
    });

    const tasksWithWeekPlans = tasksData.filter(task =>
      (weekPlansData ?? []).some(wp => wp.task_id === task.id)
    );
    console.log('[fetchGoalActionsForWeek] tasks that have a week plan in this week:', {
      count: tasksWithWeekPlans.length,
      ids: tasksWithWeekPlans.slice(0, 10).map(t => t.id),
    });

    if (tasksWithWeekPlans.length === 0) {
      console.log('[fetchGoalActionsForWeek] no tasks have a week plan for this week — returning {}');
      return {};
    }

    // ---- 4) Occurrences (completed child rows) during the week
    const { data: occurrenceData, error: occErr } = await supabase
      .from('0008-ap-tasks')
      .select('*')
      .in('parent_task_id', tasksWithWeekPlans.map(t => t.id))
      .is('deleted_at', null)
      .eq('status', 'completed')
      .gte('due_date', weekStartDate)
      .lte('due_date', weekEndDate);

    if (occErr) {
      console.error('[fetchGoalActionsForWeek] error fetching occurrences:', occErr);
      return {};
    }
    console.log('[fetchGoalActionsForWeek] occurrences fetched:', {
      count: occurrenceData?.length ?? 0,
      sample: occurrenceData?.slice(0, 3),
    });

    // ---- 5) Fetch roles, domains, and key relationships for tasks
    const tasksWithWeekPlanIds = tasksWithWeekPlans.map(t => t.id);
    console.log('[fetchGoalActionsForWeek] fetching associations for task IDs:', tasksWithWeekPlanIds);

    const { data: rolesData, error: rolesErr } = await supabase
      .from('0008-ap-universal-roles-join')
      .select('parent_id, role:0008-ap-roles(id, label, color)')
      .in('parent_id', tasksWithWeekPlanIds)
      .eq('parent_type', 'task');

    const { data: domainsData, error: domainsErr } = await supabase
      .from('0008-ap-universal-domains-join')
      .select('parent_id, domain:0008-ap-domains(id, name)')
      .in('parent_id', tasksWithWeekPlanIds)
      .eq('parent_type', 'task');

    const { data: krData, error: krErr } = await supabase
      .from('0008-ap-universal-key-relationships-join')
      .select('parent_id, key_relationship:0008-ap-key-relationships(id, name)')
      .in('parent_id', tasksWithWeekPlanIds)
      .eq('parent_type', 'task');

    if (rolesErr || domainsErr || krErr) {
      console.error('[fetchGoalActionsForWeek] error fetching associations:', rolesErr || domainsErr || krErr);
    }

    // ---- 6) Fetch all week plans for tasks to determine selectedWeeks
    const { data: allWeekPlans, error: allWeekPlansErr } = await supabase
      .from('0008-ap-task-week-plan')
      .select('*')
      .in('task_id', tasksWithWeekPlanIds)
      .eq(timeline.source === 'global' ? 'user_global_timeline_id' : 'user_custom_timeline_id', timeline.id)
      .is('deleted_at', null);

    if (allWeekPlansErr) {
      console.error('[fetchGoalActionsForWeek] error fetching all week plans:', allWeekPlansErr);
    }

    console.log('[fetchGoalActionsForWeek] all week plans for tasks:', {
      count: allWeekPlans?.length ?? 0,
    });

    // ---- 7) Group results by goal
    const grouped: Record<string, TaskWithLogs[]> = {};

    for (const task of tasksWithWeekPlans) {
      const goalJoin = (goalJoins ?? []).find(gj => gj.parent_id === task.id);
      if (!goalJoin) continue;

      const weekPlan = (weekPlansData ?? []).find(wp => wp.task_id === task.id);
      if (!weekPlan) continue;

      const goalId: string | undefined = goalJoin.twelve_wk_goal_id || goalJoin.custom_goal_id;
      if (!goalId) continue;

      const relevantOccurrences =
        (occurrenceData ?? []).filter(occ => occ.parent_task_id === task.id);

      const taskLogs: TaskLog[] = relevantOccurrences.map(occ => ({
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
      const weeklyTarget = weekPlan.target_days ?? 0;
      const cappedWeeklyActual = Math.min(weeklyActual, weeklyTarget);

      // Get associations for this task
      const taskRoles = rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [];
      const taskDomains = domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [];
      const taskKRs = krData?.filter(kr => kr.parent_id === task.id).map(kr => kr.key_relationship).filter(Boolean) || [];

      // Get all weeks this task is scheduled for
      const selectedWeeks = allWeekPlans?.filter(wp => wp.task_id === task.id).map(wp => wp.week_number) || [];

      const taskWithLogs: TaskWithLogs = {
        ...task,
        goal_type: goalJoin.goal_type === 'twelve_wk_goal' ? '12week' : 'custom',
        logs: taskLogs,
        weeklyActual: cappedWeeklyActual,
        weeklyTarget,
        roles: taskRoles as Array<{ id: string; label: string; color?: string }>,
        domains: taskDomains as Array<{ id: string; name: string }>,
        keyRelationships: taskKRs as Array<{ id: string; name: string }>,
        selectedWeeks: selectedWeeks.sort((a, b) => a - b),
      };

      if (!grouped[goalId]) grouped[goalId] = [];
      grouped[goalId].push(taskWithLogs);
    }

    console.log('[fetchGoalActionsForWeek] final grouped result:', {
      goalBuckets: Object.keys(grouped).length,
      countsPerGoal: Object.fromEntries(
        Object.entries(grouped).map(([g, arr]) => [g, arr.length])
      ),
    });

    return grouped;
  } catch (err) {
    console.error('[fetchGoalActionsForWeek] unexpected error:', err);
    return {};
  }
}