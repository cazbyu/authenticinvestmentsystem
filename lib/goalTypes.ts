export type GoalType = '12week' | 'custom';
export type DatabaseGoalType = 'twelve_wk_goal' | 'custom_goal';

export const CANONICAL_TO_DB_GOAL_TYPE: Record<GoalType, DatabaseGoalType> = {
  '12week': 'twelve_wk_goal',
  custom: 'custom_goal',
} as const;

export const DB_TO_CANONICAL_GOAL_TYPE: Record<DatabaseGoalType, GoalType> = {
  twelve_wk_goal: '12week',
  custom_goal: 'custom',
} as const;

export const normalizeGoalType = (
  value: string | null | undefined,
  fallback: GoalType = 'custom'
): GoalType => {
  switch (value) {
    case '12week':
    case 'custom':
      return value;
    case 'twelve_wk_goal':
      return '12week';
    case 'custom_goal':
      return 'custom';
    default:
      return fallback;
  }
};

export const goalJoinColumnForType = (
  goalType: GoalType
): 'twelve_wk_goal_id' | 'custom_goal_id' =>
  goalType === 'custom' ? 'custom_goal_id' : 'twelve_wk_goal_id';
