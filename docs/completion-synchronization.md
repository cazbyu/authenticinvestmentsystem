# Action Completion Synchronization

## Overview

This document explains how action completion is synchronized between the Dashboard and Goal Bank screens to ensure consistent point allocation and UI updates.

## Architecture

### Shared Completion Handler

Both the Dashboard and Goal Bank now use a shared completion handler located in `/lib/completionHandler.ts`. This ensures:

1. **Identical Database Records**: Both screens create the same occurrence records in the database
2. **Consistent Point Allocation**: Universal joins (roles, domains, goals) are copied identically
3. **Same Authentic Score Contribution**: Points are calculated the same way regardless of completion source
4. **Synchronized UI Updates**: Both screens use the same logic to determine when to hide completed actions

### Key Functions

#### `handleActionCompletion()`

Creates a completion occurrence for an action and copies all associated data:

- **Parameters**:
  - `supabase`: Supabase client instance
  - `userId`: Current user ID
  - `actionId`: Parent task/action ID
  - `dueDate`: Date to mark as completed
  - `timeline`: Optional timeline context (for filtering)
  - `weeklyTarget`: Optional weekly target count (determines UI removal)

- **Returns**: `CompletionResult` with:
  - `success`: Whether the operation succeeded
  - `shouldRemoveFromUI`: Whether the action should be hidden (weekly target reached)
  - `error`: Optional error message

- **Process**:
  1. Checks if occurrence already exists (prevents duplicates)
  2. Creates occurrence record with proper timeline references
  3. Copies universal joins (roles, domains, goals) from parent
  4. Calculates if weekly target is reached
  5. Returns result indicating if UI should update

#### `handleActionUncompletion()`

Removes a completion occurrence:

- **Parameters**:
  - `supabase`: Supabase client instance
  - `actionId`: Parent task/action ID
  - `dueDate`: Date to unmark as completed

- **Process**:
  1. Deletes occurrence record matching parent task and date
  2. Returns success status

## Database Functions

Three database functions ensure proper data copying:

### `ap_copy_universal_roles_to_task()`

Copies all role associations from parent task to occurrence.

### `ap_copy_universal_domains_to_task()`

Copies all domain associations from parent task to occurrence.

### `ap_copy_universal_goals_to_task()`

Copies all goal associations (12-week and custom) from parent task to occurrence.

## Usage in Dashboard

The Dashboard uses `handleActionCompletion()` when completing timeline-based recurring tasks:

```typescript
const result = await handleActionCompletion(
  supabase,
  user.id,
  task.id,
  dateToComplete,
  timeline,
  task.weeklyTargetCount
);

if (result.success && result.shouldRemoveFromUI) {
  // Remove from UI - target reached
} else if (result.success) {
  // Refresh to show updated count
}
```

## Usage in Goal Bank

The Goal Bank uses `handleActionCompletion()` when checking off action days:

```typescript
const result = await handleActionCompletion(
  supabase,
  user.id,
  actionId,
  date,
  selectedTimeline,
  weeklyTarget
);

if (result.success && result.shouldRemoveFromUI) {
  // Hide action from current week view
}
```

## Authentic Score Calculation

The Authentic Score is calculated using `calculateAuthenticScore()` in `/lib/taskUtils.ts`:

1. Queries all completed tasks for the user
2. Loads associated roles and domains via universal join tables
3. Calculates points using `calculateTaskPoints()` for each task
4. Subtracts withdrawals
5. Returns final score

### Point Calculation

Points are awarded based on:

- **Roles**: +1 point per role
- **Domains**: +1 point per domain
- **Authentic Deposit**: +2 points
- **Urgency/Importance**:
  - Urgent + Important: +1.5 points
  - Not Urgent + Important: +3 points
  - Urgent + Not Important: +1 point
  - Neither: +0.5 points
- **Goal Link**: +2 points if linked to active 12-week goal

## Data Flow

### Completing an Action

1. **User Action**: User checks off an action day in Goal Bank or Dashboard
2. **Optimistic Update**: UI immediately updates to show completion
3. **Shared Handler**: `handleActionCompletion()` is called
4. **Database Insert**: Occurrence record created in `0008-ap-tasks`
5. **Copy Joins**: RPC functions copy roles, domains, goals to occurrence
6. **Weekly Check**: Calculates if weekly target reached
7. **Return Result**: Indicates if action should be hidden
8. **UI Update**: If target reached, action is removed; otherwise, counter updates
9. **Score Refresh**: Authentic Score recalculated in background

### Data Consistency

Both screens ensure:

- ✅ Same occurrence record structure
- ✅ Same universal join copying
- ✅ Same point calculation logic
- ✅ Same weekly target checking
- ✅ Same UI removal logic

## Benefits

1. **Single Source of Truth**: One completion handler for all screens
2. **Consistent Points**: Same score contribution regardless of completion source
3. **Synchronized UI**: Dashboard and Goal Bank stay in sync
4. **Maintainability**: Changes to completion logic only need to be made once
5. **Testability**: Shared handler can be tested independently

## Testing

To verify synchronization:

1. ✅ Complete an action in Goal Bank → verify it disappears from Dashboard
2. ✅ Complete an action in Dashboard → verify it updates in Goal Bank
3. ✅ Verify Authentic Score increases by same amount from both sources
4. ✅ Check that roles, domains, goals are copied correctly
5. ✅ Confirm weekly target logic works consistently
6. ✅ Test edge cases (last action of week, duplicate prevention)
