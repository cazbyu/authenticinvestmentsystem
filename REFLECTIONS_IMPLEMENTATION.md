# Reflections System Implementation

## Overview

A comprehensive weekly and daily reflections system has been implemented with rich text support, automatic data aggregation, and seamless associations with roles, domains, and goals.

## Key Features

### 1. Dual Tab Interface
- **Daily Notes**: Journaling interface for daily reflections
- **Weekly Reflection**: Data-driven weekly review with reflective questions
- Tab selection is persisted using AsyncStorage

### 2. Rich Text Editor
- **Formatting Options**: Bold, Italic, Bullet Lists, Numbered Lists
- **Markdown Support**: Text is stored as markdown and rendered with formatting
- **Toolbar**: Positioned at the bottom of text inputs for easy access
- **Components**:
  - `RichTextInput.tsx`: Input with formatting toolbar
  - `RichTextDisplay.tsx`: Renders markdown with proper formatting

### 3. Daily Notes
- **Layout**: Notes section on top, followed by Roles, Domains, and Goals sections
- **Associations**: Link notes to roles, domains, and active goals via universal join tables
- **History**: Displays last 7 days of notes
- **Auto-Archive**: Daily notes older than 7 days are automatically archived
- **Modal View**: Tap any note to view full content with rich text rendering

### 4. Weekly Reflection

#### Data Aggregation (Automatic)
- **Leading Indicators Review**:
  - Shows completion percentage for all active goals
  - Displays which goals hit their weekly targets
  - Progress bars for each goal

- **Role Investment Summary**:
  - Lists roles with completed tasks/events
  - Shows deposit ideas created per role
  - Sorted by most invested role

- **Wellness Domain Balance**:
  - Activity count per wellness domain
  - Sorted from highest to lowest activity

- **Withdrawals Analysis**:
  - Identifies roles with most withdrawals
  - Color-coded (green for none, yellow/orange for withdrawals present)

#### Reflective Questions
Four rich text input fields:
1. "What were you most proud of this week?"
2. "Which deposits had the biggest impact?"
3. "What progress did you make towards your goals?"
4. "What were my biggest withdrawals and how can I prevent similar withdrawals next week?"

#### Associations
- Link weekly reflection to specific roles, domains, and goals
- Displayed as colored chips when viewing previous reflections

#### Previous Reflections
- Shows last 12 weeks of reflections
- Auto-archived after 12 weeks
- Modal view for viewing full reflection details

### 5. Database Schema

#### Universal Join Tables Updated
Added 'reflection' as valid parent_type to:
- `0008-ap-universal-roles-join`
- `0008-ap-universal-domains-join`
- `0008-ap-universal-key-relationships-join`
- `0008-ap-universal-notes-join`

#### Archiving Function
- `archive_old_reflections(p_user_id)`: Archives old reflections
  - Daily: 7 days
  - Weekly: 12 weeks (84 days)
- Called automatically when views load

### 6. Supabase Edge Function

**Function**: `create-weekly-reflections`
- **Purpose**: Automatically generate weekly reflections every Sunday
- **Schedule**: Should be set to run via cron: `0 0 * * 0` (Sundays at midnight)
- **Behavior**: Calls `create_weekly_reflection_for_user` for all active users
- **Deployment**: Already deployed and ready to use

**To Schedule the Edge Function**:
1. Go to Supabase Dashboard → Edge Functions
2. Select `create-weekly-reflections`
3. Add a cron trigger with schedule: `0 0 * * 0`
4. Enable the trigger

### 7. Weekly Data Aggregation

**File**: `lib/weeklyReflectionData.ts`

Functions:
- `getWeekDateRange()`: Calculates Sunday-Saturday week range
- `fetchWeeklyGoalProgress()`: Goal completion vs targets
- `fetchWeeklyRoleInvestments()`: Task counts and deposit ideas per role
- `fetchWeeklyDomainBalance()`: Activity counts per wellness domain
- `fetchWeeklyWithdrawalAnalysis()`: Withdrawal counts grouped by role
- `fetchWeeklyAggregationData()`: Combines all weekly data

## File Structure

```
components/reflections/
├── DailyNotesView.tsx          # Daily notes interface
├── WeeklyReflectionView.tsx    # Weekly reflection interface
├── RichTextInput.tsx           # Rich text editor with toolbar
└── RichTextDisplay.tsx         # Markdown renderer

lib/
└── weeklyReflectionData.ts     # Weekly data aggregation functions

types/
└── reflections.ts              # TypeScript types

supabase/
├── migrations/
│   ├── 20251009000000_add_reflection_parent_type.sql
│   └── 20251009000001_create_archive_reflections_function.sql
└── functions/
    └── create-weekly-reflections/
        └── index.ts            # Edge function for weekly generation

app/
└── reflections.tsx             # Main reflections screen with tabs
```

## Usage Flow

### Daily Notes
1. User opens Reflections screen
2. Daily Notes tab is selected by default
3. User writes note with rich text formatting
4. User selects roles, domains, and goals to associate
5. User taps "Save"
6. Note appears in "Recent Notes" section

### Weekly Reflection
1. User opens Reflections screen
2. User taps "Weekly Reflection" tab
3. System displays auto-aggregated data (goals, roles, domains, withdrawals)
4. User answers four reflective questions with rich text
5. User optionally associates reflection with roles, domains, goals
6. User taps "Save"
7. Reflection appears in "Previous Weekly Reflections" section

## Next Steps (Optional Enhancements)

1. **Email Notifications**: Send users an email when their weekly reflection is ready
2. **Export Feature**: Allow users to export reflections as PDF or markdown
3. **Search**: Add search functionality to find specific reflections
4. **Tags**: Allow custom tags beyond roles/domains/goals
5. **Streaks**: Track daily journaling streaks to encourage consistency
6. **Insights Dashboard**: Visualize trends over multiple weeks

## Testing Checklist

- ✅ Daily notes can be created with rich text formatting
- ✅ Roles, domains, and goals can be associated with daily notes
- ✅ Previous daily notes are displayed correctly
- ✅ Weekly reflection shows aggregated data
- ✅ Weekly reflective questions can be answered with rich text
- ✅ Previous weekly reflections are displayed
- ✅ Tab selection is persisted
- ✅ Archiving function works for old reflections
- ✅ Edge function deploys successfully
- ✅ Build completes without errors

## Known Issues

None at this time.

## Support

For questions or issues with the reflections system, refer to:
- Database schema: `supabase/migrations/`
- Edge function logs: Supabase Dashboard → Edge Functions → Logs
- Client-side errors: Check browser console or React Native debugger
