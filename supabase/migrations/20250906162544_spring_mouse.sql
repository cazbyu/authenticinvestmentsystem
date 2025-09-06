/*
  # Add Foreign Key Constraints for Universal Join Tables

  1. Add foreign key constraints to universal join tables
     - Add constraint for `0008-ap-universal-roles-join.parent_id` -> `0008-ap-tasks.id` when parent_type = 'task'
     - Add constraint for `0008-ap-universal-domains-join.parent_id` -> `0008-ap-tasks.id` when parent_type = 'task'
     - Add constraint for `0008-ap-universal-key-relationships-join.parent_id` -> `0008-ap-tasks.id` when parent_type = 'task'
     - Add constraint for `0008-ap-universal-notes-join.parent_id` -> `0008-ap-tasks.id` when parent_type = 'task'

  This enables PostgREST to infer relationships for !inner join syntax.
*/

-- Add foreign key constraint for roles join table
ALTER TABLE "0008-ap-universal-roles-join"
ADD CONSTRAINT "fk_universal_roles_join_task"
FOREIGN KEY (parent_id) REFERENCES "0008-ap-tasks"(id) ON DELETE CASCADE
NOT VALID;

-- Validate the constraint
ALTER TABLE "0008-ap-universal-roles-join"
VALIDATE CONSTRAINT "fk_universal_roles_join_task";

-- Add foreign key constraint for domains join table
ALTER TABLE "0008-ap-universal-domains-join"
ADD CONSTRAINT "fk_universal_domains_join_task"
FOREIGN KEY (parent_id) REFERENCES "0008-ap-tasks"(id) ON DELETE CASCADE
NOT VALID;

-- Validate the constraint
ALTER TABLE "0008-ap-universal-domains-join"
VALIDATE CONSTRAINT "fk_universal_domains_join_task";

-- Add foreign key constraint for key relationships join table
ALTER TABLE "0008-ap-universal-key-relationships-join"
ADD CONSTRAINT "fk_universal_key_relationships_join_task"
FOREIGN KEY (parent_id) REFERENCES "0008-ap-tasks"(id) ON DELETE CASCADE
NOT VALID;

-- Validate the constraint
ALTER TABLE "0008-ap-universal-key-relationships-join"
VALIDATE CONSTRAINT "fk_universal_key_relationships_join_task";

-- Add foreign key constraint for notes join table
ALTER TABLE "0008-ap-universal-notes-join"
ADD CONSTRAINT "fk_universal_notes_join_task"
FOREIGN KEY (parent_id) REFERENCES "0008-ap-tasks"(id) ON DELETE CASCADE
NOT VALID;

-- Validate the constraint
ALTER TABLE "0008-ap-universal-notes-join"
VALIDATE CONSTRAINT "fk_universal_notes_join_task";