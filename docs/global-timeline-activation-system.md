# Global Timeline Activation System

## Overview

The Global Timeline Activation System provides a controlled way for users to activate and manage global 12-week timelines. Users can only have one active global timeline at a time, and the system enforces data integrity by properly managing goals and actions when timelines are activated or deactivated.

## Key Features

1. **Single Active Timeline**: Users can only have one active global timeline at a time
2. **Safe Activation**: Activating a new timeline properly handles existing data
3. **Warning Dialogs**: Users are warned before data loss operations
4. **Cascade Deletion**: Deactivating a timeline removes all associated goals and actions
5. **Validation**: Goal creation is prevented on inactive timelines

## Database Schema

### Tables

#### 0008-ap-global-cycles
Global 12-week cycles available for all users to join.

Key columns:
- `id`: UUID primary key
- `title`: Human-readable title
- `cycle_label`: Short label (e.g., "Q1-2025")
- `start_date`, `end_date`: Cycle date range
- `reflection_end`: End of reflection period
- `status`: 'active', 'inactive', or 'completed'

#### 0008-ap-user-global-timelines
User's connection to a global cycle.

Key columns:
- `id`: UUID primary key
- `user_id`: Foreign key to auth.users
- `global_cycle_id`: Foreign key to 0008-ap-global-cycles
- `start_date`, `end_date`: User's adjusted dates (based on week start day)
- `status`: 'active', 'archived', or 'completed'
- `week_start_day`: 'sunday' or 'monday'

#### 0008-ap-goals-12wk
Goals associated with a user's global timeline.

Key columns:
- `id`: UUID primary key
- `user_id`: Foreign key to auth.users
- `user_global_timeline_id`: Foreign key to user global timeline
- `title`, `description`: Goal details
- `status`: 'active', 'completed', 'cancelled', 'paused'

### Database Functions

#### fn_activate_user_global_timeline
Activates a new global timeline for the user.

**Parameters:**
- `p_global_cycle_id` (uuid): ID of global cycle to activate
- `p_week_start_day` (text): 'sunday' or 'monday'

**Returns:** UUID of the newly created user global timeline

**Behavior:**
1. Validates the global cycle exists and is active
2. Adjusts start/end dates based on week start day preference
3. Deactivates any existing active global timeline (with cascade deletion)
4. Creates new active user global timeline

**Usage Example:**
```sql
SELECT fn_activate_user_global_timeline(
  'c1111111-1111-1111-1111-111111111111',
  'sunday'
);
```

#### fn_deactivate_user_global_timeline
Deactivates a user's global timeline and removes all data.

**Parameters:**
- `p_user_global_timeline_id` (uuid): ID of timeline to deactivate

**Returns:** boolean (true on success)

**Behavior:**
1. Verifies timeline belongs to authenticated user
2. Deletes all tasks/actions associated with timeline goals
3. Deletes all goals associated with the timeline
4. Sets timeline status to 'archived'

**Usage Example:**
```sql
SELECT fn_deactivate_user_global_timeline(
  'timeline-uuid-here'
);
```

#### fn_check_timeline_has_goals
Checks if a timeline has associated goals.

**Parameters:**
- `p_user_global_timeline_id` (uuid): ID of timeline to check

**Returns:** TABLE with columns:
- `has_goals` (boolean): Whether timeline has goals
- `goal_count` (integer): Number of active goals

**Usage Example:**
```sql
SELECT * FROM fn_check_timeline_has_goals(
  'timeline-uuid-here'
);
```

## UI Components

### ManageGlobalTimelinesModal

The main interface for managing global timelines.

**Sections:**

1. **Active Timeline**
   - Shows the user's currently active global timeline
   - Displays title, date range, goal count, days remaining
   - Shows progress bar indicating cycle completion
   - Provides "Deactivate Timeline" button

2. **Manage Global**
   - Lists the next 2 available global cycles
   - Each cycle shows title, date range, and activation options
   - Users can choose Sunday or Monday week start when activating

**Warning Modals:**

1. **Activation Warning**
   - Triggered when activating a new timeline while one is active with goals
   - Shows count of goals that will be deleted
   - Requires explicit confirmation

2. **Deactivation Warning**
   - Triggered when deactivating a timeline
   - Shows count of goals that will be deleted
   - Requires explicit confirmation

## User Workflow

### Activating First Timeline

1. User opens "Manage Global Timelines" modal
2. Views available cycles in "Manage Global" section
3. Clicks activation button with preferred week start day
4. Timeline is immediately activated
5. User can start creating goals

### Switching Timelines

1. User opens "Manage Global Timelines" modal
2. Views current active timeline with goal count
3. Clicks activation button for a different cycle
4. Warning modal appears showing data loss impact
5. User confirms or cancels
6. If confirmed:
   - Current timeline is deactivated
   - All goals and actions are deleted
   - New timeline is activated
   - User can create goals on new timeline

### Deactivating Timeline

1. User opens "Manage Global Timelines" modal
2. Clicks "Deactivate Timeline" button
3. Warning modal appears showing data loss impact
4. User confirms or cancels
5. If confirmed:
   - Timeline is set to 'archived' status
   - All goals and actions are deleted
   - User has no active global timeline

## Goal Creation Validation

Goals can only be created on active timelines. The CreateGoalModal component validates:

1. A timeline is selected
2. For global timelines, checks that the timeline status is 'active'
3. If timeline is inactive, shows error and prevents goal creation
4. RLS policies on database also enforce this constraint

## Data Integrity

### RLS Policies

The system enforces data integrity through Row Level Security policies:

1. **Goal Insert Policy**: Prevents inserting goals for inactive timelines
2. **Timeline Access**: Users can only access their own timelines
3. **Function Security**: All functions use SECURITY DEFINER with auth checks

### Cascade Deletion Order

When deactivating a timeline:
1. Delete all tasks/actions (0008-ap-tasks)
2. Delete all goals (0008-ap-goals-12wk)
3. Archive the timeline (0008-ap-user-global-timelines)

This order ensures referential integrity is maintained.

## Testing Considerations

### Test Data

The migration `20251003000001_global_cycles_test_data.sql` creates 4 test cycles:
- Q1 2025 Growth Cycle
- Q2 2025 Innovation Cycle
- Q3 2025 Momentum Cycle
- Q4 2025 Excellence Cycle

### Testing Scenarios

1. **Activate first timeline**: Should work without warnings
2. **Create goals**: Should succeed on active timeline
3. **Activate second timeline with goals**: Should show warning and delete goals
4. **Deactivate timeline with goals**: Should show warning and delete goals
5. **Try to create goal on inactive timeline**: Should be blocked
6. **View available cycles**: Should show next 2 cycles only

## Migration Files

1. `20251003000000_global_timeline_activation_system.sql`
   - Creates database functions
   - Updates RLS policies
   - Adds indexes

2. `20251003000001_global_cycles_test_data.sql`
   - Creates test global cycles
   - Should be removed or commented out in production

## Security Considerations

1. **Authentication**: All functions verify auth.uid()
2. **Authorization**: Users can only manage their own timelines
3. **Data Loss Protection**: Warning modals prevent accidental data loss
4. **Atomic Operations**: Database functions ensure data consistency
5. **RLS Enforcement**: Policies prevent unauthorized access

## Future Enhancements

Potential improvements to consider:

1. **Archive View**: Allow users to view archived timelines and goals
2. **Export Before Deactivation**: Export goals/data before deletion
3. **Timeline History**: Track timeline activation/deactivation events
4. **Bulk Operations**: Activate multiple users to same cycle (team features)
5. **Notification System**: Notify users when new cycles are available
