const { test } = require('node:test');
const assert = require('node:assert/strict');

async function fetchGoalActionsForWeek(goalIds, weekNumber, cycleWeeks, customTimelineWeeks = [], supabase) {
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

test('fetchGoalActionsForWeek returns actions for custom timeline week', async () => {
  const goalId = 'goal1';
  const weekNumber = 2;
  const customWeeks = [{ week_number: 2, startDate: '2024-01-08', endDate: '2024-01-14' }];

  const goalJoinsData = [{ parent_id: 'task1', custom_goal_id: goalId, goal_type: 'custom' }];
  const tasksData = [{ id: 'task1', user_id: 'user1', input_kind: 'count', status: 'active' }];
  const weekPlansData = [{ task_id: 'task1', week_number: weekNumber, target_days: 5 }];
  const occurrenceData = [{ id: 'occ1', parent_task_id: 'task1', due_date: '2024-01-10', created_at: '2024-01-10' }];

  const supabaseStub = {
    auth: { getUser: async () => ({ data: { user: { id: 'user1' } } }) },
    from: (table) => {
      if (table === '0008-ap-universal-goals-join') {
        return { select() { return this; }, or() { return this; }, eq() { return Promise.resolve({ data: goalJoinsData }); } };
      }
      if (table === '0008-ap-tasks') {
        let isOccurrence = false;
        return {
          select() { return this; },
          eq(column, value) { if (column === 'status' && value === 'completed') { isOccurrence = true; } return this; },
          in() { return this; },
          not() { return Promise.resolve({ data: tasksData }); },
          gte() { return this; },
          lte() { return Promise.resolve({ data: isOccurrence ? occurrenceData : [] }); }
        };
      }
      if (table === '0008-ap-task-week-plan') {
        return { select() { return this; }, in() { return this; }, eq() { return Promise.resolve({ data: weekPlansData }); } };
      }
      return {};
    }
  };

  const actions = await fetchGoalActionsForWeek([goalId], weekNumber, [], customWeeks, supabaseStub);
  assert.ok(actions[goalId]);
  assert.equal(actions[goalId].length, 1);
  assert.equal(actions[goalId][0].weeklyActual, 1);
  assert.equal(actions[goalId][0].weeklyTarget, 5);
});
