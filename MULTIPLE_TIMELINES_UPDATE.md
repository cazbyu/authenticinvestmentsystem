# Multiple Global Timelines Update

## Summary of Changes

I've updated the global timeline activation system to support your requirements:

1. **Multiple Active Timelines**: Users can now activate multiple global timelines simultaneously
2. **Current + Next Cycle Display**: The "Manage Global" section now shows the current cycle and the next upcoming cycle
3. **No Activation Warnings**: Users can freely activate timelines without warnings about data loss
4. **Clear Activation Status**: Cycles that are already activated show an "Activated" badge and explanatory text

## What Changed

### Database Changes

**New Migration**: `20251003000002_allow_multiple_global_timelines.sql`

- Removed the unique constraint that limited users to one active global timeline
- Updated `fn_activate_user_global_timeline` function to:
  - Create new timelines without deactivating existing ones
  - Prevent duplicate activations of the same cycle
  - Show clear error if trying to activate an already-activated cycle
- Added unique constraint: `idx_user_global_timeline_unique_cycle` to prevent duplicate cycle activations

### UI Changes

**ManageGlobalTimelinesModal Component**:

1. **Active Timelines Section** (formerly "Active Timeline")
   - Now displays ALL active global timelines (not just one)
   - Each timeline shows:
     - Title and date range
     - Goal count and days remaining
     - Progress bar
     - Week start day (Sunday/Monday)
     - Individual "Deactivate Timeline" button

2. **Manage Global Section**
   - Now shows **current cycle** (if within its date range) + **next upcoming cycle**
   - Each cycle displays:
     - Title and date range
     - "Activated" badge if already activated
     - Two activation buttons (Sunday/Monday) if not yet activated
     - Gray informational message if already activated

3. **Activation Flow**
   - No warning modals when activating
   - Direct activation with loading state
   - Success message after activation
   - Error if trying to activate an already-activated cycle

4. **Deactivation Flow**
   - Still shows warning (because this deletes goals)
   - Shows goal count that will be deleted
   - Requires explicit confirmation

## User Experience

### Scenario 1: No Active Timelines
- User opens modal
- Sees empty "Active Timelines" section
- Sees 2 cycles in "Manage Global" (current + next)
- Clicks "Sunday" or "Monday" on desired cycle
- Timeline activates immediately
- Can now create goals

### Scenario 2: One Active Timeline
- User opens modal
- Sees 1 timeline in "Active Timelines" section
- Sees 2 cycles in "Manage Global"
- If one is already activated, it shows "Activated" badge
- Can activate the other cycle by clicking Sunday/Monday
- Now has 2 active timelines

### Scenario 3: Both Cycles Activated
- User opens modal
- Sees 2 timelines in "Active Timelines" section
- Sees 2 cycles in "Manage Global"
- Both show "Activated" badge with explanatory text
- No activation buttons available (all already activated)
- Can deactivate individual timelines if desired

## Technical Details

### fetchAvailableCycles Logic

The function now:
1. Fetches all active global cycles where `reflection_end >= today`
2. Identifies the **current cycle**: `start_date <= today <= reflection_end`
3. Identifies the **next cycle**: First cycle where `start_date > today`
4. Checks which cycles are already activated by the user
5. Marks each cycle with `isAlreadyActivated` flag
6. Returns array with current cycle + next cycle (max 2 items)

### Multiple Timelines State

Changed from:
```typescript
const [activeTimeline, setActiveTimeline] = useState<UserGlobalTimeline | null>(null);
```

To:
```typescript
const [activeTimelines, setActiveTimelines] = useState<UserGlobalTimeline[]>([]);
```

All rendering functions updated to loop through `activeTimelines` array.

### Database Constraint

Added unique index to prevent duplicate activations:
```sql
CREATE UNIQUE INDEX idx_user_global_timeline_unique_cycle
  ON "0008-ap-user-global-timelines"(user_id, global_cycle_id)
  WHERE status = 'active';
```

This ensures:
- A user cannot activate the same cycle twice
- Database-level enforcement (not just UI)
- Clear error message if attempted

## What Stayed the Same

1. **Deactivation**: Still requires warning and confirmation
2. **Goal Creation**: Still validates timeline is active
3. **Timeline Details**: Same information display (title, dates, goals, progress)
4. **Database Functions**: `fn_deactivate_user_global_timeline` unchanged
5. **Week Start Day**: Still supports Sunday/Monday preferences

## Files Modified

1. `/supabase/migrations/20251003000002_allow_multiple_global_timelines.sql` - NEW
2. `/components/timelines/ManageGlobalTimelinesModal.tsx` - UPDATED
   - Changed from single to multiple timelines
   - Updated fetchAvailableCycles logic
   - Removed activation warnings
   - Added activation status badges
   - Updated all rendering functions

## Testing Recommendations

1. **Test with no active timelines**: Activate first timeline
2. **Test with one active timeline**: Activate second timeline
3. **Test duplicate activation**: Try to activate same cycle twice (should show error)
4. **Test deactivation**: Deactivate one timeline while keeping others
5. **Test current + next cycle display**: Verify correct cycles shown
6. **Test activation status**: Verify "Activated" badges appear correctly
7. **Test goal creation**: Verify works on all active timelines

## Migration Order

The migrations should be applied in this order:
1. `20251003000000_global_timeline_activation_system.sql` (original - if not already applied)
2. `20251003000001_global_cycles_test_data.sql` (test data - optional)
3. `20251003000002_allow_multiple_global_timelines.sql` (NEW - enables multiple timelines)

## Benefits

1. **Flexibility**: Users can participate in multiple cycles simultaneously
2. **Clarity**: Clear visual indication of which cycles are activated
3. **Efficiency**: No unnecessary warning dialogs for non-destructive operations
4. **Safety**: Still warns before deleting data (deactivation)
5. **Simplicity**: Straightforward activation process
