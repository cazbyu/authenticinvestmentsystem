# Timeline Activation System - Debugging Guide

## Overview

This document provides comprehensive debugging instructions for the timeline activation system, covering both 12-Week Global Timelines and Custom Timelines.

## Recent Fixes Applied

### 1. Enhanced Logging System
- Added comprehensive console logging throughout the activation flow
- All logs prefixed with component name for easy filtering (e.g., `[ManageGlobalTimelinesModal]`)
- Logs track the entire lifecycle: user authentication, database queries, RPC calls, and UI updates

### 2. Improved Error Handling
- More detailed error messages in Alert dialogs
- Error details logged to console with full stack traces
- Better error messages guide users on next steps

### 3. Timeline Refresh Logic
- Modal `onUpdate` callbacks now use `async/await` properly
- Goals page explicitly waits for timeline data refresh to complete
- Added logging to track the refresh chain

### 4. Create Goal Modal Enhancement
- Added "no timelines available" message when timeline list is empty
- Enhanced logging shows which timelines are available
- Timeline selection logging for debugging

## How to Debug Timeline Activation Issues

### Step 1: Open Browser Developer Console

1. Open your app in a browser
2. Open Developer Tools (F12 or right-click → Inspect)
3. Go to the Console tab
4. Consider filtering by component name (e.g., type `[ManageGlobalTimelinesModal]` in filter)

### Step 2: Attempt to Activate a 12-Week Timeline

Navigate to: **Goals → Goal Bank → 12 Week Timelines**

#### Expected Console Output

```
[ManageGlobalTimelinesModal] Starting timeline activation
[ManageGlobalTimelinesModal] Cycle ID: <uuid>
[ManageGlobalTimelinesModal] Week start day: sunday
[ManageGlobalTimelinesModal] Current user ID: <uuid>
[ManageGlobalTimelinesModal] Calling fn_activate_user_global_timeline...
[ManageGlobalTimelinesModal] RPC Response: { data: <uuid>, error: null }
[ManageGlobalTimelinesModal] Timeline activated successfully. New timeline ID: <uuid>
[ManageGlobalTimelinesModal] Refreshing timeline data...
[ManageGlobalTimelinesModal] Fetching active timelines for user: <uuid>
[ManageGlobalTimelinesModal] Active timelines query result: { count: 1, error: null, ... }
[ManageGlobalTimelinesModal] Calling onUpdate callback...
[Goals] ManageGlobalTimelinesModal onUpdate called
[Goals] fetchAllTimelines called
[Goals] Fetching timelines for user: <uuid>
[Goals] Querying global timelines...
[Goals] Global timelines query result: { count: 1, ... }
[Goals] Total timelines: 1
[Goals] fetchAllTimelines complete
```

#### If Timeline Activation Fails

Look for these specific error messages in the console:

**Error: "User not authenticated"**
- **Cause**: User session expired or invalid
- **Fix**: Log out and log back in

**Error: "Global cycle not found or not active"**
- **Cause**: The cycle doesn't exist in `0008-ap-global-cycles` or status is not 'active'
- **Fix**: Check database to ensure the cycle exists and is active

**Error: "This global cycle is already activated"**
- **Cause**: User has already activated this exact cycle
- **Fix**: This is expected behavior - check Active Timelines section

**RPC Error with PGRST code**
- **Cause**: Database permission issue or function doesn't exist
- **Fix**: Check that `fn_activate_user_global_timeline` exists and has proper grants

### Step 3: Attempt to Create a Custom Timeline

Navigate to: **Goals → Goal Bank → Manage Custom**

#### Expected Console Output

```
[ManageCustomTimelinesModal] Starting timeline save
[ManageCustomTimelinesModal] Form data: { title: "...", startDate: "...", endDate: "..." }
[ManageCustomTimelinesModal] Editing existing: false
[ManageCustomTimelinesModal] Current user ID: <uuid>
[ManageCustomTimelinesModal] Timeline data to save: { ... }
[ManageCustomTimelinesModal] Creating new timeline...
[ManageCustomTimelinesModal] Insert result: { data: [{ id: <uuid>, ... }], error: null }
[ManageCustomTimelinesModal] Timeline created successfully. ID: <uuid>
[ManageCustomTimelinesModal] Refreshing timelines list...
[ManageCustomTimelinesModal] Fetching custom timelines for user: <uuid>
[ManageCustomTimelinesModal] Custom timelines query result: { count: 1, ... }
[ManageCustomTimelinesModal] Calling onUpdate callback...
[Goals] ManageCustomTimelinesModal onUpdate called
[Goals] fetchAllTimelines called
[Goals] Querying custom timelines...
[Goals] Custom timelines query result: { count: 1, ... }
[Goals] Total timelines: 1
```

#### If Custom Timeline Creation Fails

**Error: "User not found"**
- **Cause**: Authentication issue
- **Fix**: Re-authenticate

**Error: Insert constraint violation**
- **Cause**: Invalid date range (end_date must be after start_date)
- **Fix**: Verify dates in the form

**RLS Policy Violation**
- **Cause**: Row Level Security blocking insert
- **Fix**: Verify RLS policies on `0008-ap-custom-timelines` allow INSERT for authenticated users

### Step 4: Verify Timeline Appears in Goals Screen

After activation/creation, navigate to: **Goals → Goal Bank → Active Timelines**

#### Expected Console Output

```
[Goals] Hydrated timelines: [
  { id: <uuid>, source: 'global', title: '...', start_date: '...', end_date: '...' },
  { id: <uuid>, source: 'custom', title: '...', start_date: '...', end_date: '...' }
]
```

#### If Timeline Doesn't Appear

1. **Check the count in logs**: Look for `[Goals] Total timelines: X`
   - If 0, the database queries aren't returning data
   - If > 0 but not visible, it's a UI rendering issue

2. **Verify in database**:
   - For Global: Check `0008-ap-user-global-timelines` for your user_id and status='active'
   - For Custom: Check `0008-ap-custom-timelines` for your user_id and status='active'

3. **Check query filters**: Ensure status='active' filter isn't excluding your timeline

### Step 5: Verify Timeline Appears in Create Goal Modal

Click the floating action button (FAB) to open Create Goal modal.

#### Expected Console Output

```
[CreateGoalModal] Modal opened
[CreateGoalModal] Available timelines: 2
[CreateGoalModal] Timeline details: [
  { id: <uuid>, source: 'global', title: '...' },
  { id: <uuid>, source: 'custom', title: '...' }
]
[CreateGoalModal] Selected timeline: <uuid> "..."
```

#### If No Timelines Appear

- **Check props**: Verify `allTimelines` prop is being passed correctly
- **Look for**: "No active timelines available" message (red background)
- **Verify**: Goals page is passing updated `allTimelines` array to modal

## Database Verification Queries

Use these SQL queries in Supabase SQL Editor to verify data:

### Check Global Timeline Activations

```sql
SELECT
  ugt.id,
  ugt.user_id,
  ugt.global_cycle_id,
  ugt.status,
  ugt.week_start_day,
  gc.title,
  gc.cycle_label,
  gc.start_date,
  gc.end_date
FROM "0008-ap-user-global-timelines" ugt
JOIN "0008-ap-global-cycles" gc ON gc.id = ugt.global_cycle_id
WHERE ugt.user_id = auth.uid()
  AND ugt.status = 'active'
ORDER BY ugt.created_at DESC;
```

### Check Custom Timelines

```sql
SELECT
  id,
  user_id,
  title,
  description,
  start_date,
  end_date,
  status,
  created_at
FROM "0008-ap-custom-timelines"
WHERE user_id = auth.uid()
  AND status = 'active'
ORDER BY created_at DESC;
```

### Check Available Global Cycles

```sql
SELECT
  id,
  title,
  cycle_label,
  start_date,
  end_date,
  reflection_end,
  status,
  is_active
FROM "0008-ap-global-cycles"
WHERE status = 'active'
  AND reflection_end >= CURRENT_DATE
ORDER BY start_date;
```

## Common Issues and Solutions

### Issue: Timeline Appears in Database but Not in UI

**Symptoms**: Database shows the timeline, but it doesn't appear in the app

**Possible Causes**:
1. UI state not refreshing after modal closes
2. React component not re-rendering
3. Timeline data not being fetched after creation/activation

**Solution**:
1. Check that `onUpdate` callback is being called (look for logs)
2. Verify `fetchAllTimelines()` completes successfully
3. Check that `allTimelines` state is being updated
4. Ensure component dependencies trigger re-render

### Issue: RPC Function Not Found

**Symptoms**: Error "function fn_activate_user_global_timeline does not exist"

**Possible Causes**:
1. Migration not applied
2. Function dropped accidentally
3. Wrong database schema

**Solution**:
1. Check migrations have been applied: Look for `20251007202741_fix_global_timeline_activation_system.sql`
2. Verify function exists:
   ```sql
   SELECT routine_name
   FROM information_schema.routines
   WHERE routine_name = 'fn_activate_user_global_timeline';
   ```
3. Re-apply migration if needed

### Issue: Permission Denied Errors

**Symptoms**: "permission denied for function" or "new row violates row-level security policy"

**Possible Causes**:
1. RLS policies too restrictive
2. Function not granted to authenticated role
3. User not properly authenticated

**Solution**:
1. Verify function grants:
   ```sql
   GRANT EXECUTE ON FUNCTION fn_activate_user_global_timeline(uuid, text) TO authenticated;
   ```
2. Check RLS policies allow the operation
3. Verify user session is valid

## Testing Checklist

Use this checklist to verify the system works end-to-end:

- [ ] Can activate a current 12-week cycle
- [ ] Activated timeline appears in Active Timelines section
- [ ] Activated timeline appears in Create Goal modal dropdown
- [ ] Can create a custom timeline with valid dates
- [ ] Created custom timeline appears in Active Timelines section
- [ ] Created custom timeline appears in Create Goal modal dropdown
- [ ] Can create a goal associated with global timeline
- [ ] Can create a goal associated with custom timeline
- [ ] Multiple timelines can coexist (both global and custom)
- [ ] Timelines filter by status='active' correctly
- [ ] Error messages are clear and actionable

## Additional Debugging Tools

### Enable Verbose Supabase Logging

Add this to your code temporarily for extra debugging:

```typescript
const supabase = getSupabaseClient();
supabase.auth.onAuthStateChange((event, session) => {
  console.log('[Supabase Auth]', event, session?.user?.id);
});
```

### Check Network Requests

1. Open DevTools → Network tab
2. Filter by "supabase" or your domain
3. Look for failed requests (red status codes)
4. Examine request/response payloads

### React DevTools

1. Install React DevTools extension
2. Inspect component state and props
3. Verify `allTimelines` array in Goals component
4. Check modal visibility states

## Getting Help

If you continue to experience issues after following this guide:

1. **Gather logs**: Copy all relevant console logs
2. **Check database**: Run the verification queries above
3. **Export error details**: Screenshot error messages
4. **Document steps**: Write down exact steps to reproduce
5. **Check migrations**: Verify all migrations have been applied

## Summary of Key Files Modified

- `components/timelines/ManageGlobalTimelinesModal.tsx` - Added logging and error handling
- `components/timelines/ManageCustomTimelinesModal.tsx` - Added logging and error handling
- `app/(tabs)/goals.tsx` - Enhanced refresh logic and logging
- `components/goals/CreateGoalModal.tsx` - Added timeline display logging and empty state
- `supabase/migrations/20251007202741_fix_global_timeline_activation_system.sql` - Database function

All changes are backward compatible and focus on improved observability and debugging capabilities.
