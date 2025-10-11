/*
  # Create Core Application Tables

  1. New Tables
     - `0008-ap-roles` - User roles for categorization
     - `0008-ap-key-relationships` - Key relationships for users
     - `0008-ap-tasks` - Core tasks/events table with timeline support
     - `0008-ap-universal-roles-join` - Universal join table for roles
     - `0008-ap-universal-domains-join` - Universal join table for domains
     - `0008-ap-universal-key-relationships-join` - Universal join table for key relationships
     - `0008-ap-universal-goals-join` - Universal join table for goals
     - `0008-ap-universal-notes-join` - Universal join table for notes
     - `0008-ap-universal-delegates-join` - Universal join table for delegates

  2. Security
     - Enable RLS on all tables
     - Policies for authenticated users

  3. Notes
     - Universal join tables support polymorphic associations
     - Tasks table supports both standalone and timeline-based actions
*/

CREATE TABLE IF NOT EXISTS "0008-ap-roles" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  color text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "0008-ap-key-relationships" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES "0008-ap-roles"(id) ON DELETE SET NULL,
  name text NOT NULL,
  image_path text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "0008-ap-tasks" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_task_id uuid REFERENCES "0008-ap-tasks"(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('task', 'event', 'depositIdea', 'withdrawal')),
  title text NOT NULL,
  description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'archived')),
  due_date date,
  start_date date,
  end_date date,
  start_time time,
  end_time time,
  completed_at timestamptz,
  is_urgent boolean DEFAULT false,
  is_important boolean DEFAULT false,
  is_anytime boolean DEFAULT false,
  is_authentic_deposit boolean DEFAULT false,
  global_timeline_id uuid,
  custom_timeline_id uuid,
  input_kind text CHECK (input_kind IN ('count', 'yesno', 'time', 'boolean')),
  recurrence_rule text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "0008-ap-universal-roles-join" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  parent_type text NOT NULL CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal')),
  role_id uuid NOT NULL REFERENCES "0008-ap-roles"(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(parent_id, parent_type, role_id)
);

CREATE TABLE IF NOT EXISTS "0008-ap-universal-domains-join" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  parent_type text NOT NULL CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal')),
  domain_id uuid NOT NULL REFERENCES "0008-ap-domains"(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(parent_id, parent_type, domain_id)
);

CREATE TABLE IF NOT EXISTS "0008-ap-universal-key-relationships-join" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  parent_type text NOT NULL CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal')),
  key_relationship_id uuid NOT NULL REFERENCES "0008-ap-key-relationships"(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(parent_id, parent_type, key_relationship_id)
);

CREATE TABLE IF NOT EXISTS "0008-ap-universal-goals-join" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  parent_type text NOT NULL CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal')),
  twelve_wk_goal_id uuid,
  custom_goal_id uuid,
  goal_type text CHECK (goal_type IN ('twelve_wk_goal', 'custom_goal')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_goal_type_id CHECK (
    (goal_type = 'twelve_wk_goal' AND twelve_wk_goal_id IS NOT NULL AND custom_goal_id IS NULL) OR
    (goal_type = 'custom_goal' AND custom_goal_id IS NOT NULL AND twelve_wk_goal_id IS NULL)
  ),
  UNIQUE(parent_id, parent_type, twelve_wk_goal_id, custom_goal_id)
);

CREATE TABLE IF NOT EXISTS "0008-ap-universal-notes-join" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  parent_type text NOT NULL CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal', 'goal', 'custom_goal')),
  note_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(parent_id, parent_type, note_id)
);

CREATE TABLE IF NOT EXISTS "0008-ap-universal-delegates-join" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  parent_type text NOT NULL CHECK (parent_type IN ('task', 'depositIdea', 'withdrawal')),
  delegate_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(parent_id, parent_type, delegate_id)
);

ALTER TABLE "0008-ap-roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0008-ap-key-relationships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0008-ap-tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0008-ap-universal-roles-join" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0008-ap-universal-domains-join" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0008-ap-universal-key-relationships-join" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0008-ap-universal-goals-join" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0008-ap-universal-notes-join" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "0008-ap-universal-delegates-join" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own roles" ON "0008-ap-roles"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own roles" ON "0008-ap-roles"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own roles" ON "0008-ap-roles"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own roles" ON "0008-ap-roles"
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can select their own key relationships" ON "0008-ap-key-relationships"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own key relationships" ON "0008-ap-key-relationships"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own key relationships" ON "0008-ap-key-relationships"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own key relationships" ON "0008-ap-key-relationships"
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can select their own tasks" ON "0008-ap-tasks"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tasks" ON "0008-ap-tasks"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tasks" ON "0008-ap-tasks"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tasks" ON "0008-ap-tasks"
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their role joins" ON "0008-ap-universal-roles-join"
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage their domain joins" ON "0008-ap-universal-domains-join"
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage their KR joins" ON "0008-ap-universal-key-relationships-join"
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage their goal joins" ON "0008-ap-universal-goals-join"
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage their note joins" ON "0008-ap-universal-notes-join"
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage their delegate joins" ON "0008-ap-universal-delegates-join"
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_roles_user_id ON "0008-ap-roles"(user_id);
CREATE INDEX IF NOT EXISTS idx_key_relationships_user_id ON "0008-ap-key-relationships"(user_id);
CREATE INDEX IF NOT EXISTS idx_key_relationships_role_id ON "0008-ap-key-relationships"(role_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON "0008-ap-tasks"(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON "0008-ap-tasks"(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON "0008-ap-tasks"(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON "0008-ap-tasks"(type);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON "0008-ap-tasks"(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_global_timeline ON "0008-ap-tasks"(global_timeline_id);
CREATE INDEX IF NOT EXISTS idx_tasks_custom_timeline ON "0008-ap-tasks"(custom_timeline_id);
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON "0008-ap-tasks"(recurrence_rule) WHERE recurrence_rule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON "0008-ap-tasks"(deleted_at);
CREATE INDEX IF NOT EXISTS idx_universal_roles_parent ON "0008-ap-universal-roles-join"(parent_id, parent_type);
CREATE INDEX IF NOT EXISTS idx_universal_roles_role ON "0008-ap-universal-roles-join"(role_id);
CREATE INDEX IF NOT EXISTS idx_universal_domains_parent ON "0008-ap-universal-domains-join"(parent_id, parent_type);
CREATE INDEX IF NOT EXISTS idx_universal_domains_domain ON "0008-ap-universal-domains-join"(domain_id);
CREATE INDEX IF NOT EXISTS idx_universal_krs_parent ON "0008-ap-universal-key-relationships-join"(parent_id, parent_type);
CREATE INDEX IF NOT EXISTS idx_universal_krs_kr ON "0008-ap-universal-key-relationships-join"(key_relationship_id);
CREATE INDEX IF NOT EXISTS idx_universal_goals_parent ON "0008-ap-universal-goals-join"(parent_id, parent_type);
CREATE INDEX IF NOT EXISTS idx_universal_goals_12wk ON "0008-ap-universal-goals-join"(twelve_wk_goal_id);
CREATE INDEX IF NOT EXISTS idx_universal_goals_custom ON "0008-ap-universal-goals-join"(custom_goal_id);
CREATE INDEX IF NOT EXISTS idx_universal_notes_parent ON "0008-ap-universal-notes-join"(parent_id, parent_type);
CREATE INDEX IF NOT EXISTS idx_universal_notes_note ON "0008-ap-universal-notes-join"(note_id);
CREATE INDEX IF NOT EXISTS idx_universal_delegates_parent ON "0008-ap-universal-delegates-join"(parent_id, parent_type);
CREATE INDEX IF NOT EXISTS idx_universal_delegates_delegate ON "0008-ap-universal-delegates-join"(delegate_id);
