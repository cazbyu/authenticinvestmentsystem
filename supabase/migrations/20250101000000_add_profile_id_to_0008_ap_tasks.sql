-- Add user_id column referencing auth.users
ALTER TABLE "0008-ap-tasks"
  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id);

-- Index to speed up user lookups
CREATE INDEX IF NOT EXISTS idx_0008_ap_tasks_user_id ON "0008-ap-tasks"(user_id);

-- Enable row level security
ALTER TABLE "0008-ap-tasks" ENABLE ROW LEVEL SECURITY;

-- Allow users to select their own tasks
CREATE POLICY "Select own tasks" ON "0008-ap-tasks"
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert tasks for themselves
CREATE POLICY "Insert own tasks" ON "0008-ap-tasks"
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
