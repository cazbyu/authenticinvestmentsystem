// hooks/useGoals.ts
import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { Alert } from 'react-native';
import { generateCycleWeeks, formatLocalDate, parseLocalDate } from '../lib/dateUtils';

/* ================================
 * DB TABLE / VIEW CONSTANTS (single source of truth)
 * Adjust here if your DB names differ.
 * ================================ */
const DB = {
  // Timelines
  USER_GLOBAL_TIMELINES: '0008-ap-user-global-timelines',
  CUSTOM_TIMELINES: '0008-ap-custom-timelines',

  // Goals
  GOALS_12WK: '0008-ap-goals-12wk',
  GOALS_CUSTOM: '0008-ap-goals-custom',

  // Tasks + related
  TASKS: '0008-ap-tasks',
  TASK_WEEK_PLAN: '0008-ap-task-week-plan',
  NOTES: '0008-ap-notes',
  NOTES_JOIN: '0008-ap-universal-notes-join',

  // Joins
  UNIVERSAL_GOALS_JOIN: '0008-ap-universal-goals-join',
  UNIVERSAL_ROLES_JOIN: '0008-ap-universal-roles-join',
  UNIVERSAL_DOMAINS_JOIN: '0008-ap-universal-domains-join',
  UNIVERSAL_KEY_REL_JOIN: '0008-ap-universal-key-relationships-join',

  // Role/Domain/KR dictionaries
  ROLES: '0008-ap-roles',
  DOMAINS: '0008-ap-domains',
  KEY_REL: '0008-ap-key-relationships',

  // Views (weeks + days-left); columns must expose: week_number, week_start, week_end, timeline_id
  V_GLOBAL_WEEKS: 'v_user_global_timeline_weeks',
  V_CUSTOM_WEEKS: 'v_custom_timeline_weeks',

  // Views (days-left); columns must expose: timeline_id, days_left, pct_elapsed
  V_GLOBAL_DAYS_LEFT: 'v_user_global_timeline_days_left',
  V_CUSTOM_DAYS_LEFT: 'v_custom_timeline_days_left',
};

/* ================================
 * INTERFACES
 * ================================ */
export interface TwelveWeekGoal {
  id: string;
  title: string;
  description?: string;
  status: string;
  progress: number;
  weekly_target: number;
  total_target: number;
  start_date?: string;
  end_date?: string;
  user_global_timeline_id?: string; // FK to 12wk timeline
  created_at: string;
  updated_at: string;
  domains?: Array<{ id: string; name: string }>;
  roles?: Array<{ id: string; label: string; color?: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
  notes?: Array<{ content: string; created_at: string }>;
  goal_type: '12week';
}

export interface CustomGoal {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
  progress: number;
  custom_timeline_id?: string; // FK to custom timeline
  created_at: string;
  updated_at: string;
  domains?: Array<{ id: string; name: string }>;
  roles?: Array<{ id: string; label: string; color?: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
  notes?: Array<{ content: string; created_at: string }>;
  goal_type: 'custom';
}

export type Goal = TwelveWeekGoal | CustomGoal;

export interface UserCycle {
  id: string;
  user_id: string;
  source: 'custom' | 'global';
  title?: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  timezone?: string | null;
  week_start_day?: 'sunday' | 'monday';
}

export interface CycleWeek {
  week_number: number;
  week_start: string; // YYYY-MM-DD
  week_end: string;   // YYYY-MM-DD
  timeline_id: string; // normalized field for global/custom timeline
}

export interface DaysLeftData {
  days_left: number;
  pct_elapsed: number;
  timeline_id: string;
}

export interface TaskWeekPlan {
  id: string;
  task_id: string;
  user_global_timeline_id?: string;  // for global timelines
  user_custom_timeline_id?: string;  // for custom timelines
  week_number: number;
  target_days: number;
  created_at: string;
}

export interface TaskLog {
  id: string;
  task_id: string;
  measured_on: string; // YYYY-MM-DD
  week_number: number;
  day_of_week?: number;
  value: number;
  created_at: string;
}

export interface TaskWithLogs extends Goal {
  logs: TaskLog[];
  weeklyActual: number;
  weeklyTarget: number;
}

export interface WeekData {
  weekNumber: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface WeeklyTaskData {
  task: any;
  weekPlan: TaskWeekPlan | null;
  logs: TaskLog[];
  completed: number;
  target: number;
  weeklyScore: number;
}

export interface GoalProgress {
  goalId: string;
  currentWeek: number;
  daysRemaining: number;
  weeklyActual: number;
  weeklyTarget: number;
  overallActual: number;
  overallTarget: number;
  overallProgress: number; // 0..100
}

export interface CycleEffortData {
  totalActual: number;
  totalTarget: number;
  overallPercentage: number;
}

/* ================================
 * HOOK OPTIONS
 * ================================ */
interface UseGoalsOptions {
  scope?: {
    type: 'user' | 'role' | 'domain' | 'key_relationship';
    id?: string;
  };
}

/* ================================
 * MAIN HOOK - CRUD + NORMALIZATION ONLY
 * ================================ */
export function useGoals(options: UseGoalsOptions = {}) {
  const [twelveWeekGoals, setTwelveWeekGoals] = useState<TwelveWeekGoal[]>([]);
  const [customGoals, setCustomGoals] = useState<CustomGoal[]>([]);
  const [allGoals, setAllGoals] = useState<Goal[]>([]);
  const [currentCycle, setCurrentCycle] = useState<UserCycle | null>(null);
  const [loading, setLoading] = useState(false);

  /* --------------------------------
   * Fetch current active timeline (global first, then custom)
   * -------------------------------- */
  const fetchUserCycle = async (): Promise<UserCycle | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) return null;

      // Prefer an active global (12wk) timeline
      const { data: globalTimeline, error: gErr } = await supabase
        .from(DB.USER_GLOBAL_TIMELINES)
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (gErr) throw gErr;

      if (globalTimeline) {
        const hydrated: UserCycle = {
          ...globalTimeline,
          source: 'global',
          title: globalTimeline.title ?? '12 Week Timeline',
          start_date: globalTimeline.start_date,
          end_date: globalTimeline.end_date,
        };
        setCurrentCycle(hydrated);
        return hydrated;
      }

      // Otherwise the active custom timeline
      const { data: customTimeline, error: cErr } = await supabase
        .from(DB.CUSTOM_TIMELINES)
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cErr) throw cErr;

      if (customTimeline) {
        const hydrated: UserCycle = {
          ...customTimeline,
          source: 'custom',
          title: customTimeline.title ?? 'Custom Timeline',
          start_date: customTimeline.start_date,
          end_date: customTimeline.end_date,
        };
        setCurrentCycle(hydrated);
        return hydrated;
      }

      setCurrentCycle(null);
      return null;
    } catch (error) {
      console.error('Error fetching user cycle:', error);
      setCurrentCycle(null);
      return null;
    }
  };

  /* --------------------------------
   * Fetch goals for the active timeline (strict filtering by FK)
   * -------------------------------- */
  const fetchGoals = async (timelineId?: string) => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let twelveWeekData: any[] = [];
      let customData: any[] = [];

      if (timelineId && currentCycle) {
        if (currentCycle.source === 'global') {
          // Only 12wk goals for global timeline
          const { data, error } = await supabase
            .from(DB.GOALS_12WK)
            .select('*')
            .eq('user_id', user.id)
            .eq('user_global_timeline_id', timelineId) // strict
            .eq('status', 'active')
            .order('created_at', { ascending: false });
          if (error) throw error;
          twelveWeekData = data || [];
          customData = [];
        } else if (currentCycle.source === 'custom') {
          // Only custom goals for custom timeline
          const { data, error } = await supabase
            .from(DB.GOALS_CUSTOM)
            .select('*')
            .eq('user_id', user.id)
            .eq('custom_timeline_id', timelineId) // strict
            .eq('status', 'active')
            .order('created_at', { ascending: false });
          if (error) throw error;
          customData = data || [];
          twelveWeekData = [];
        }
      }

      const allGoalIds = [
        ...(twelveWeekData || []).map(g => g.id),
        ...(customData || []).map(g => g.id)
      ];

      if (allGoalIds.length === 0) {
        setTwelveWeekGoals([]);
        setCustomGoals([]);
        setAllGoals([]);
        return;
      }

      // Fetch related joins for *all* goals
      const [
        { data: rolesData, error: rolesError },
        { data: domainsData, error: domainsError },
        { data: krData, error: krError }
      ] = await Promise.all([
        supabase
          .from(DB.UNIVERSAL_ROLES_JOIN)
          .select(`parent_id, role:${DB.ROLES}(id, label, color)`)
          .in('parent_id', allGoalIds)
          .in('parent_type', ['goal', 'custom_goal']),
        supabase
          .from(DB.UNIVERSAL_DOMAINS_JOIN)
          .select(`parent_id, domain:${DB.DOMAINS}(id, name)`)
          .in('parent_id', allGoalIds)
          .in('parent_type', ['goal', 'custom_goal']),
        supabase
          .from(DB.UNIVERSAL_KEY_REL_JOIN)
          .select(`parent_id, key_relationship:${DB.KEY_REL}(id, name)`)
          .in('parent_id', allGoalIds)
          .in('parent_type', ['goal', 'custom_goal']),
      ]);

      if (rolesError) throw rolesError;
      if (domainsError) throw domainsError;
      if (krError) throw krError;

      // Optional scope filters
      let filteredTwelveWeekIds = (twelveWeekData || []).map(g => g.id);
      let filteredCustomIds = (customData || []).map(g => g.id);

      if (options.scope && options.scope.type !== 'user' && options.scope.id) {
        const scopeId = options.scope.id;
        switch (options.scope.type) {
          case 'role': {
            const roleGoalIds = rolesData?.filter(r => r.role?.id === scopeId).map(r => r.parent_id) || [];
            filteredTwelveWeekIds = filteredTwelveWeekIds.filter(id => roleGoalIds.includes(id));
            filteredCustomIds = filteredCustomIds.filter(id => roleGoalIds.includes(id));
            break;
          }
          case 'domain': {
            const domainGoalIds = domainsData?.filter(d => d.domain?.id === scopeId).map(d => d.parent_id) || [];
            filteredTwelveWeekIds = filteredTwelveWeekIds.filter(id => domainGoalIds.includes(id));
            filteredCustomIds = filteredCustomIds.filter(id => domainGoalIds.includes(id));
            break;
          }
          case 'key_relationship': {
            const krGoalIds = krData?.filter(kr => kr.key_relationship?.id === scopeId).map(kr => kr.parent_id) || [];
            filteredTwelveWeekIds = filteredTwelveWeekIds.filter(id => krGoalIds.includes(id));
            filteredCustomIds = filteredCustomIds.filter(id => krGoalIds.includes(id));
            break;
          }
        }
      }

      // Hydrate 12wk goals
      const transformedTwelveWeekGoals: TwelveWeekGoal[] = (twelveWeekData || [])
        .filter(goal => filteredTwelveWeekIds.includes(goal.id))
        .map(goal => ({
          ...goal,
          goal_type: '12week' as const,
          domains: domainsData?.filter(d => d.parent_id === goal.id).map(d => d.domain).filter(Boolean) || [],
          roles: rolesData?.filter(r => r.parent_id === goal.id).map(r => r.role).filter(Boolean) || [],
          keyRelationships: krData?.filter(kr => kr.parent_id === goal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
        }));

      // Hydrate custom goals
      const transformedCustomGoals: CustomGoal[] = (customData || [])
        .filter(goal => filteredCustomIds.includes(goal.id))
        .map(goal => ({
          ...goal,
          progress: goal.progress ?? 0,
          goal_type: 'custom' as const,
          domains: domainsData?.filter(d => d.parent_id === goal.id).map(d => d.domain).filter(Boolean) || [],
          roles: rolesData?.filter(r => r.parent_id === goal.id).map(r => r.role).filter(Boolean) || [],
          keyRelationships: krData?.filter(kr => kr.parent_id === goal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
        }));

      setTwelveWeekGoals(transformedTwelveWeekGoals);
      setCustomGoals(transformedCustomGoals);
      setAllGoals([...transformedTwelveWeekGoals, ...transformedCustomGoals]);

    } catch (error: any) {
      console.error('Error fetching goals:', error);
      Alert.alert('Error', error?.message ?? 'Failed to fetch goals');
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------
   * GOAL CREATION FUNCTIONS (centralized here)
   * -------------------------------- */
  const createTwelveWeekGoal = async (goalData: {
    title: string;
    description?: string;
    weekly_target?: number;
    total_target?: number;
  }): Promise<TwelveWeekGoal | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentCycle || currentCycle.source !== 'global') return null;

      const { data, error } = await supabase
        .from(DB.GOALS_12WK)
        .insert({
          user_id: user.id,
          user_global_timeline_id: currentCycle.id, // strict FK
          title: goalData.title,
          description: goalData.description,
          weekly_target: goalData.weekly_target ?? 3,
          total_target: goalData.total_target ?? 36,
          status: 'active',
          progress: 0,
          start_date: currentCycle.start_date,
          end_date: currentCycle.end_date,
        })
        .select('*')
        .single();

      if (error) throw error;
      await fetchGoals(currentCycle.id);
      return { ...data, goal_type: '12week' };
    } catch (error) {
      console.error('Error creating 12-week goal:', error);
      throw error;
    }
  };

  const createCustomGoal = async (goalData: {
    title: string;
    description?: string;
    start_date?: string;
    end_date?: string;
  }, selectedTimeline?: { id: string; start_date?: string | null; end_date?: string | null }): Promise<CustomGoal | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedTimeline) return null;

      const startDate = goalData.start_date || selectedTimeline?.start_date;
      const endDate = goalData.end_date || selectedTimeline?.end_date;

      if (!startDate || !endDate) throw new Error('Start date and end date are required for custom goals');

      const { data, error } = await supabase
        .from(DB.GOALS_CUSTOM)
        .insert({
          user_id: user.id,
          custom_timeline_id: selectedTimeline.id,
          title: goalData.title,
          start_date: startDate,
          end_date: endDate,
          status: 'active',
          progress: 0,
        })
        .select()
        .single();

      if (error) throw error;
      if (selectedTimeline) {
        await fetchGoals(selectedTimeline.id);
      }

      return { ...data, goal_type: 'custom' };
    } catch (error) {
      console.error('Error creating custom goal:', error);
      throw error;
    }
  };

  /* --------------------------------
   * TASK CREATION WITH WEEK PLAN (centralized here)
   * -------------------------------- */
  const createTaskWithWeekPlan = async (taskData: {
    title: string;
    description?: string;
    twelve_wk_goal_id?: string;
    custom_goal_id?: string;
    goal_type?: 'twelve_wk_goal' | 'custom_goal';
    recurrenceRule?: string;
    selectedRoleIds?: string[];
    selectedDomainIds?: string[];
    selectedKeyRelationshipIds?: string[];
    selectedWeeks: Array<{ weekNumber: number; targetDays: number }>;
  }): Promise<{ id: string } | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentCycle) return null;

      const insertTaskPayload: any = {
        user_id: user.id,
        title: taskData.title,
        type: 'task',
        input_kind: 'count',
        unit: 'days',
        status: 'pending',
        is_twelve_week_goal: currentCycle.source === 'global',
        recurrence_rule: taskData.recurrenceRule,
      };

      if (currentCycle.source === 'global') {
        insertTaskPayload.user_global_timeline_id = currentCycle.id;
      } else {
        insertTaskPayload.user_custom_timeline_id = currentCycle.id;
      }

      const { data: insertedTask, error: taskError } = await supabase
        .from(DB.TASKS)
        .insert(insertTaskPayload)
        .select('*')
        .single();

      if (taskError) throw taskError;

      // Optional note
      if (taskData.description?.trim()) {
        const { data: insertedNote, error: noteError } = await supabase
          .from(DB.NOTES)
          .insert({
            user_id: user.id,
            content: taskData.description.trim(),
          })
          .select('*')
          .single();
        if (noteError) throw noteError;

        const { error: noteJoinError } = await supabase
          .from(DB.NOTES_JOIN)
          .insert({
            parent_id: insertedTask.id,
            parent_type: 'task',
            note_id: insertedNote.id,
            user_id: user.id,
          });
        if (noteJoinError) throw noteJoinError;
      }

      // Week plans
      const weekPlanInserts = taskData.selectedWeeks.map(week => {
        const base = {
          task_id: insertedTask.id,
          week_number: week.weekNumber,
          target_days: week.targetDays,
        };
        return currentCycle.source === 'global'
          ? { ...base, user_global_timeline_id: currentCycle.id }
          : { ...base, user_custom_timeline_id: currentCycle.id };
      });

      const { error: weekPlanError } = await supabase
        .from(DB.TASK_WEEK_PLAN)
        .insert(weekPlanInserts);
      if (weekPlanError) throw weekPlanError;

      // Link to goal
      if (taskData.twelve_wk_goal_id) {
        const { error: goalJoinError } = await supabase
          .from(DB.UNIVERSAL_GOALS_JOIN)
          .insert({
            parent_id: insertedTask.id,
            parent_type: 'task',
            twelve_wk_goal_id: taskData.twelve_wk_goal_id,
            goal_type: 'twelve_wk_goal',
            user_id: user.id,
          });
        if (goalJoinError) throw goalJoinError;
      } else if (taskData.custom_goal_id) {
        const { error: goalJoinError } = await supabase
          .from(DB.UNIVERSAL_GOALS_JOIN)
          .insert({
            parent_id: insertedTask.id,
            parent_type: 'task',
            custom_goal_id: taskData.custom_goal_id,
            goal_type: 'custom_goal',
            user_id: user.id,
          });
        if (goalJoinError) throw goalJoinError;
      }

      // Link roles, domains, key relationships
      await Promise.all([
        insertUniversalJoins(supabase, user.id, insertedTask.id, 'task', 'role_id', taskData.selectedRoleIds, DB.UNIVERSAL_ROLES_JOIN),
        insertUniversalJoins(supabase, user.id, insertedTask.id, 'task', 'domain_id', taskData.selectedDomainIds, DB.UNIVERSAL_DOMAINS_JOIN),
        insertUniversalJoins(supabase, user.id, insertedTask.id, 'task', 'key_relationship_id', taskData.selectedKeyRelationshipIds, DB.UNIVERSAL_KEY_REL_JOIN),
      ]);

      if (currentCycle) {
        await fetchGoals(currentCycle.id);
      }

      return { id: insertedTask.id as string };
    } catch (error) {
      console.error('Error creating task with week plan:', error);
      throw error;
    }
  };

  /* --------------------------------
   * UNIVERSAL JOIN HELPER (centralized here)
   * -------------------------------- */
  const insertUniversalJoins = async (
    supabase: any,
    userId: string,
    parentId: string,
    parentType: string,
    foreignKeyField: string,
    selectedIds?: string[],
    tableName: string
  ) => {
    if (!selectedIds?.length) return;

    const joins = selectedIds.map(id => ({
      parent_id: parentId,
      parent_type: parentType,
      [foreignKeyField]: id,
      user_id: userId,
    }));

    const { error } = await supabase
      .from(tableName)
      .insert(joins);
    if (error) throw error;
  };

  /* --------------------------------
   * Refresh orchestration
   * -------------------------------- */
  const refreshAllData = async () => {
    try {
      const cycle = await fetchUserCycle();
      if (!cycle) {
        setTwelveWeekGoals([]);
        setCustomGoals([]);
        setAllGoals([]);
        return;
      }

      await fetchGoals(cycle.id);
    } catch (error) {
      console.error('Error refreshing all data:', error);
    }
  };

  const refreshGoals = async () => {
    if (currentCycle) await fetchGoals(currentCycle.id);
    else await fetchGoals();
  };

  /* --------------------------------
   * Effects
   * -------------------------------- */
  useEffect(() => {
    refreshAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.scope]);

  /* --------------------------------
   * Return API - CRUD + NORMALIZATION ONLY
   * -------------------------------- */
  return {
    // State
    twelveWeekGoals,
    customGoals,
    allGoals,
    currentCycle,
    loading,

    // CRUD operations
    createTwelveWeekGoal,
    createCustomGoal,
    createTaskWithWeekPlan,

    // Data refresh
    refreshGoals,
    refreshAllData,

    // Utilities
    fetchUserCycle,
    insertUniversalJoins,
  };
}