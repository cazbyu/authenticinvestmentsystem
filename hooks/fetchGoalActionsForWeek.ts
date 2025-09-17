// hooks/fetchGoalActionsForWeek.ts
import type { SupabaseClient } from '@supabase/supabase-js';

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
  logs: TaskLog[];
  weeklyActual: number;
  weeklyTarget: number;
  goal_type?: '12week' | 'custom';
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
  cycleWeeks: TimelineWeekInput[],
  customTimelineWeeks: TimelineWeekInput[] = [],
  supabase: SupabaseClient
): Promise<Record<string, TaskWithLogs[]>> {
  try {
    console.debug('[fetchGoalActionsForWeek] called with:', {
      goalIdsCount: goalIds?.length ?? 0,
      goalIds,
      weekNumber,
      cycleWeeksCount: cycleWeeks?.length ?? 0,
      customTimelineWeeksCount: customTimelineWeeks?.length ?? 0,
    });

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user ?? null;
    if (!user) {
      console.debug('[fetchGoalActionsForWeek] no authenticated user — returning {}');
      return {};
    }
    if (!goalIds || goalIds.length === 0) {
      console.debug('[fetchGoalActionsForWeek] empty goalIds — returning {}');
      return {};
    }

    // Resolve the requested week from either list
    const week =
      cycleWeeks.find(w => numberOf(w) === weekNumber) ??
      customTimelineWeeks.find(w => numberOf(w) === weekNumber);

    const weekStartDate = startOf(week);
    const weekEndDate = endOf(week);

    console.debug('[fetchGoalActionsForWeek] resolved week:', {
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
    const orFilter = `twelve_wk_goal_id.in.(${goalIds.join(',')}),custom_goal_id.in.(${goalIds.join(',')})`;
    console.debug('[fetchGoalActionsForWeek] universal-goals-join query filter:', orFilter);

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
    console.debug('[fetchGoalActionsForWeek] goalJoins:', {
      count: goalJoins?.length ?? 0,
      taskIdsCount: taskIds.length,
      sample: goalJoins?.slice(0, 3),
    });

    if (taskIds.length === 0) {
      console.debug('[fetchGoalActionsForWeek] no parent tasks linked — returning {}');
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
    console.debug('[fetchGoalActionsForWeek] tasks fetched:', {
      count: tasksData?.length ?? 0,
      sample: tasksData?.slice(0, 3),
    });

    if (!tasksData || tasksData.length === 0) {
      console.debug('[fetchGoalActionsForWeek] 0 tasks after filtering — returning {}');
      return {};
    }

    // ---- 3) Week-plan rows for the target week (to get target_days)
    const { data: weekPlansData, error: weekPlansErr } = await supabase
      .from('0008-ap-task-week-plan')
      .select('*')
      .in('task_id', taskIds)
      .eq('week_number', weekNumber);

    if (weekPlansErr) {
      console.error('[fetchGoalActionsForWeek] error fetching week plans:', weekPlansErr);
      return {};
    }
    console.debug('[fetchGoalActionsForWeek] week plans fetched:', {
      count: weekPlansData?.length ?? 0,
      sample: weekPlansData?.slice(0, 3),
    });

    const tasksWithWeekPlans = tasksData.filter(task =>
      (weekPlansData ?? []).some(wp => wp.task_id === task.id)
    );
    console.debug('[fetchGoalActionsForWeek] tasks that have a week plan in this week:', {
      count: tasksWithWeekPlans.length,
      ids: tasksWithWeekPlans.slice(0, 10).map(t => t.id),
    });

    if (tasksWithWeekPlans.length === 0) {
      console.debug('[fetchGoalActionsForWeek] no tasks have a week plan for this week — returning {}');
      return {};
    }

    // ---- 4) Occurrences (completed child rows) during the week
    const { data: occurrenceData, error: occErr } = await supabase
      .from('0008-ap-tasks')
      .select('*')
      .in('parent_task_id', tasksWithWeekPlans.map(t => t.id))
      .eq('status', 'completed')
      .gte('due_date', weekStartDate)
      .lte('due_date', weekEndDate);

    if (occErr) {
      console.error('[fetchGoalActionsForWeek] error fetching occurrences:', occErr);
      return {};
    }
    console.debug('[fetchGoalActionsForWeek] occurrences fetched:', {
      count: occurrenceData?.length ?? 0,
      sample: occurrenceData?.slice(0, 3),
    });

    // ---- 5) Group results by goal
    const grouped: Record<string, TaskWithLogs[]> = {};

    for (const task of tasksWithWeekPlans) {
      const goalJoin = (goalJoins ?? []).find(gj => gj.parent_id === task.id);
      if (!goalJoin) continue;

      const weekPlan = (weekPlansData ?? []).find(wp => wp.task_id === task.id);
      if (!weekPlan) continue;

      const goalId: string | undefined =
        goalJoin.twelve_wk_goal_id ?? goalJoin.custom_goal_id;
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

      const taskWithLogs: TaskWithLogs = {
        ...task,
        goal_type: goalJoin.goal_type === 'twelve_wk_goal' ? '12week' : 'custom',
        logs: taskLogs,
        weeklyActual: cappedWeeklyActual,
        weeklyTarget,
      };

      if (!grouped[goalId]) grouped[goalId] = [];
      grouped[goalId].push(taskWithLogs);
    }

    console.debug('[fetchGoalActionsForWeek] final grouped result:', {
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
