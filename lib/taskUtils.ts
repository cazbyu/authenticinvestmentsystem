// utils/taskUtils.ts

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
  if (roles?.length) points += roles.length;
  if (domains?.length) points += domains.length;

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
 * Calculate the authentic score for a set of tasks.
 */
export const calculateAuthenticScore = (
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
