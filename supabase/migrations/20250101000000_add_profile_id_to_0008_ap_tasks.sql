-- Add profile_id column referencing profiles
ALTER TABLE "0008-ap-tasks"
  ADD COLUMN profile_id uuid NOT NULL REFERENCES profiles(id);

-- Index to speed up profile lookups
CREATE INDEX IF NOT EXISTS idx_0008_ap_tasks_profile_id ON "0008-ap-tasks"(profile_id);

-- Enable row level security
ALTER TABLE "0008-ap-tasks" ENABLE ROW LEVEL SECURITY;

-- Allow users to select their own tasks
CREATE POLICY "Select own tasks" ON "0008-ap-tasks"
  FOR SELECT
  USING (auth.uid() = profile_id);

-- Allow users to insert tasks for themselves
CREATE POLICY "Insert own tasks" ON "0008-ap-tasks"
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);
