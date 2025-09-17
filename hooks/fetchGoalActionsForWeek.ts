
export async function fetchGoalActionsForWeek(
  goalIds: string[],
  weekNumber: number,
  cycleWeeks: TimelineWeekInput[],
  customTimelineWeeks: TimelineWeekInput[] = [],
  supabase: SupabaseClient
): Promise<Record<string, TaskWithLogs[]>> {

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || goalIds.length === 0) return {};

  const week = cycleWeeks.find(w => w.week_number === weekNumber) ||
    customTimelineWeeks.find(w => w.week_number === weekNumber);
  const weekStartDate = week?.startDate;
  const weekEndDate = week?.endDate;
  if (!weekStartDate || !weekEndDate) return {};

  const { data: goalJoins } = await supabase
    .from('0008-ap-universal-goals-join')
    .select('parent_id, twelve_wk_goal_id, custom_goal_id, goal_type')
    .or(`twelve_wk_goal_id.in.(${goalIds.join(',')}),custom_goal_id.in.(${goalIds.join(',')})`)
    .eq('parent_type', 'task');

  const taskIds = goalJoins?.map(gj => gj.parent_id) || [];
  if (taskIds.length === 0) return {};

  const { data: tasksData } = await supabase
    .from('0008-ap-tasks')
    .select('*')
    .eq('user_id', user.id)
    .in('id', taskIds)
    .eq('input_kind', 'count')
    .not('status', 'in', '(completed,cancelled)');
  if (!tasksData || tasksData.length === 0) return {};

  const { data: weekPlansData } = await supabase
    .from('0008-ap-task-week-plan')
    .select('*')
    .in('task_id', taskIds)
    .eq('week_number', weekNumber);

  const tasksWithWeekPlans = tasksData.filter(task =>
    weekPlansData?.some(wp => wp.task_id === task.id)
  );

  const { data: occurrenceData } = await supabase
    .from('0008-ap-tasks')
    .select('*')
    .in('parent_task_id', tasksWithWeekPlans.map(t => t.id))
    .eq('status', 'completed')
    .gte('due_date', weekStartDate)
    .lte('due_date', weekEndDate);

  const groupedActions = {};
  for (const task of tasksWithWeekPlans) {
    const goalJoin = goalJoins?.find(gj => gj.parent_id === task.id);
    if (!goalJoin) continue;
    const weekPlan = weekPlansData?.find(wp => wp.task_id === task.id);
    if (!weekPlan) continue;
    const goalId = goalJoin.twelve_wk_goal_id || goalJoin.custom_goal_id;
    if (!goalId) continue;
    const relevantOccurrences = occurrenceData?.filter(occ => occ.parent_task_id === task.id) || [];
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
    const weeklyActual = taskLogs.length;
    const weeklyTarget = weekPlan.target_days;
    const cappedWeeklyActual = Math.min(weeklyActual, weeklyTarget);
    const taskWithLogs = {
      ...task,
      goal_type: goalJoin.goal_type === 'twelve_wk_goal' ? '12week' : 'custom',
      logs: taskLogs,
      weeklyActual: cappedWeeklyActual,
      weeklyTarget,
    };
    if (!groupedActions[goalId]) groupedActions[goalId] = [];
    groupedActions[goalId].push(taskWithLogs);
  }
  return groupedActions;
}

