export type ReflectionType = 'daily' | 'weekly';

export interface Reflection {
  id: string;
  user_id: string;
  reflection_type: ReflectionType;
  date: string;
  content: string;
  authentic_score: number;
  archived: boolean;
  created_at: string;
  updated_at: string;

  // Weekly reflection specific fields
  week_start_date?: string;
  week_end_date?: string;
  question_proud?: string;
  question_impact?: string;
  question_progress?: string;
  question_withdrawals?: string;
  weekly_target_completion?: number;
  total_goals_tracked?: number;
}

export interface ReflectionFormData {
  content: string;
  selectedRoleIds: string[];
  selectedDomainIds: string[];
  selectedGoalIds: string[];

  // Weekly specific questions
  questionProud?: string;
  questionImpact?: string;
  questionProgress?: string;
  questionWithdrawals?: string;
}

export interface Role {
  id: string;
  label: string;
  color?: string;
}

export interface Domain {
  id: string;
  name: string;
  color?: string;
}

export interface UnifiedGoal {
  id: string;
  title: string;
  description?: string;
  goal_type: '12week' | 'custom' | '1y_goal';
  status?: string;
}

export interface WeeklyGoalProgress {
  goal_id: string;
  goal_title: string;
  goal_type: string;
  weekly_target: number;
  actual_completion: number;
  completion_percentage: number;
}

export interface WeeklyRoleInvestment {
  role_id: string;
  role_label: string;
  role_color?: string;
  task_count: number;
  deposit_idea_count: number;
}

export interface WeeklyDomainBalance {
  domain_id: string;
  domain_name: string;
  domain_color?: string;
  activity_count: number;
}

export interface WeeklyWithdrawalAnalysis {
  role_id: string;
  role_label: string;
  withdrawal_count: number;
  total_amount: number;
}

export interface WeeklyAggregationData {
  goalProgress: WeeklyGoalProgress[];
  roleInvestments: WeeklyRoleInvestment[];
  domainBalance: WeeklyDomainBalance[];
  withdrawalAnalysis: WeeklyWithdrawalAnalysis[];
  totalTargetsHit: number;
  totalGoalsTracked: number;
}

export type RichTextFormat = 'bold' | 'italic' | 'underline' | 'bulletList' | 'numberedList';

export interface RichTextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  editable?: boolean;
}
