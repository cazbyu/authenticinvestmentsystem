// hooks/useGoals.ts
import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { Alert } from 'react-native';
import { generateCycleWeeks, formatLocalDate, parseLocalDate } from '../lib/dateUtils';

/* ================================
 * DB TABLE / VIEW CONSTANTS (single source of truth)
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

  // Task logs
  TASK_LOG: '0008-ap-task-log',

  // Joins
  UNIVERSAL_GOALS_JOIN: '0008-ap-universal-goals-join',
  UNIVERSAL_ROLES_JOIN: '0008-ap-universal-roles-join',
  UNIVERSAL_DOMAINS_JOIN: '0008-ap-universal-domains-join',
  UNIVERSAL_KEY_REL_JOIN: '0008-ap-universal-key-relationships-join',

  // Role/Domain/KR dictionaries
  ROLES: '0008-ap-roles',
  DOMAINS: '0008-ap-domains',
  KEY_REL: '0008-ap-key-relationships',
};

/* ================================
 * INTERFACES - CRUD + NORMALIZATION FOCUSED
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
  user_global_timeline_id?: string; // Updated FK
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
  custom_timeline_id?: string; // Updated FK
  created_at: string;
  updated_at: string;
  domains?: Array<{ id: string; name: string }>;
  roles?: Array<{ id: string; label: string; color?: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
  notes?: Array<{ content: string; created_at: string }>;
  goal_type: 'custom';
}

export type Goal = TwelveWeekGoal | CustomGoal;

export interface Timeline {
  id: string;
  user_id: string;
  source: 'custom' | 'global';
  title?: string;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'completed' | 'archived';
  timeline_type?: 'cycle' | 'project' | 'challenge' | 'custom';
  week_start_day?: 'sunday' | 'monday';
  global_cycle_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskWeekPlan {
  id: string;
  task_id: string;
  user_global_timeline_id?: string;  // Updated for global timelines
  user_custom_timeline_id?: string;  // Updated for custom timelines
  week_number: number;
  target_days: number;
  created_at: string;
}

export interface UniversalGoalJoin {
  id: string;
  user_id: string;
  parent_type: string;
  parent_id: string;
  goal_type: 'twelve_wk_goal' | 'custom_goal';
  twelve_wk_goal_id?: string;
  custom_goal_id?: string;
  created_at: string;
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
  const [currentTimeline, setCurrentTimeline] = useState<Timeline | null>(null);
  const [loading, setLoading] = useState(false);

  /* --------------------------------
   * UNIVERSAL JOIN HELPER - CENTRALIZED
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
   * Fetch current active timeline (global first, then custom)
   * -------------------------------- */
  const fetchCurrentTimeline = async (): Promise<Timeline | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) return null;

      // Prefer an active global timeline
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
        const hydrated: Timeline = {
          ...globalTimeline,
          source: 'global',
          title: globalTimeline.title ?? '12 Week Timeline',
          start_date: globalTimeline.start_date,
          end_date: globalTimeline.end_date,
        };
        setCurrentTimeline(hydrated);
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
        const hydrated: Timeline = {
          ...customTimeline,
          source: 'custom',
          title: customTimeline.title ?? 'Custom Timeline',
          start_date: customTimeline.start_date,
          end_date: customTimeline.end_date,
        };
        setCurrentTimeline(hydrated);
        return hydrated;
      }

      setCurrentTimeline(null);
      return null;
    } catch (error) {
      console.error('Error fetching current timeline:', error);
      setCurrentTimeline(null);
      return null;
    }
  };

  /* --------------------------------
   * Fetch goals for the active timeline (strict filtering by FK)
   * -------------------------------- */
  const fetchGoals = async (timeline?: Timeline) => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const activeTimeline = timeline || currentTimeline;
      let twelveWeekData: any[] = [];
      let customData: any[] = [];

      if (activeTimeline) {
        if (activeTimeline.source === 'global') {
          // Only 12wk goals for global timeline
          const { data, error } = await supabase
            .from(DB.GOALS_12WK)
            .select('*')
            .eq('user_id', user.id)
            .eq('user_global_timeline_id', activeTimeline.id) // Updated FK
            .eq('status', 'active')
            .order('created_at', { ascending: false });
          if (error) throw error;
          twelveWeekData = data || [];
          customData = [];
        } else if (activeTimeline.source === 'custom') {
          // Only custom goals for custom timeline
          const { data, error } = await supabase
            .from(DB.GOALS_CUSTOM)
            .select('*')
            .eq('user_id', user.id)
            .eq('custom_timeline_id', activeTimeline.id) // Updated FK
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
   * GOAL CREATION FUNCTIONS - CENTRALIZED
   * -------------------------------- */
  const createTwelveWeekGoal = async (goalData: {
    title: string;
    description?: string;
    weekly_target?: number;
    total_target?: number;
  }, selectedTimeline?: Timeline): Promise<TwelveWeekGoal | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const timeline = selectedTimeline || currentTimeline;
      if (!timeline || timeline.source !== 'global') {
        throw new Error('Global timeline required for 12-week goals');
      }

      const { data, error } = await supabase
        .from(DB.GOALS_12WK)
        .insert({
          user_id: user.id,
          user_global_timeline_id: timeline.id, // Updated FK
          title: goalData.title,
          description: goalData.description,
          weekly_target: goalData.weekly_target ?? 3,
          total_target: goalData.total_target ?? 36,
          status: 'active',
          progress: 0,
          start_date: timeline.start_date,
          end_date: timeline.end_date,
        })
        .select('*')
        .single();

      if (error) throw error;
      await fetchGoals(timeline);
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
  }, selectedTimeline?: Timeline): Promise<CustomGoal | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const timeline = selectedTimeline || currentTimeline;
      if (!timeline) {
        throw new Error('Timeline required for custom goals');
      }

      const startDate = goalData.start_date || timeline?.start_date;
      const endDate = goalData.end_date || timeline?.end_date;

      if (!startDate || !endDate) throw new Error('Start date and end date are required for custom goals');

      const { data, error } = await supabase
        .from(DB.GOALS_CUSTOM)
        .insert({
          user_id: user.id,
          custom_timeline_id: timeline.id, // Updated FK
          title: goalData.title,
          description: goalData.description,
          start_date: startDate,
          end_date: endDate,
          status: 'active',
          progress: 0,
        })
        .select()
        .single();

      if (error) throw error;
      await fetchGoals(timeline);

      return { ...data, goal_type: 'custom' };
    } catch (error) {
      console.error('Error creating custom goal:', error);
      throw error;
    }
  };

  /* --------------------------------
   * TASK CREATION WITH WEEK PLAN - CENTRALIZED
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
    id?: string; // For editing existing tasks
  }, selectedTimeline?: Timeline): Promise<{ id: string } | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const timeline = selectedTimeline || currentTimeline;
      if (!timeline) throw new Error('Timeline required for task creation');

      let taskId: string;
      
      if (taskData.id) {
        // Update existing task
        const updateTaskPayload: any = {
          title: taskData.title,
          recurrence_rule: taskData.recurrenceRule,
          updated_at: new Date().toISOString(),
        };

        const { error: taskError } = await supabase
          .from(DB.TASKS)
          .update(updateTaskPayload)
          .eq('id', taskData.id);

        if (taskError) throw taskError;
        taskId = taskData.id;

        // Clear existing joins for update
        await Promise.all([
          supabase.from(DB.UNIVERSAL_ROLES_JOIN).delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          supabase.from(DB.UNIVERSAL_DOMAINS_JOIN).delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          supabase.from(DB.UNIVERSAL_KEY_REL_JOIN).delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          supabase.from(DB.TASK_WEEK_PLAN).delete().eq('task_id', taskId),
        ]);
      } else {
        // Create new task
        const insertTaskPayload: any = {
          user_id: user.id,
          title: taskData.title,
          type: 'task',
          input_kind: 'count',
          unit: 'days',
          status: 'pending',
          due_date: null, // Parent tasks should not have a due_date
          is_twelve_week_goal: timeline.source === 'global',
          recurrence_rule: taskData.recurrenceRule,
          // Conditional timeline FK injection
          ...(timeline.source === 'global'
            ? { user_global_timeline_id: timeline.id }
            : { user_custom_timeline_id: timeline.id }),
        };

        const { data: insertedTask, error: taskError } = await supabase
          .from(DB.TASKS)
          .insert(insertTaskPayload)
          .select('*')
          .single();

        if (taskError) throw taskError;
        taskId = insertedTask.id;
      }

      // Optional note
      if (taskData.description?.trim() && !taskData.id) {
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
            parent_id: taskId,
            parent_type: 'task',
            note_id: insertedNote.id,
            user_id: user.id,
          });
        if (noteJoinError) throw noteJoinError;
      }

      // Week plans with conditional timeline FK
      const weekPlanInserts = taskData.selectedWeeks.map(week => ({
        task_id: taskId,
        week_number: week.weekNumber,
        target_days: week.targetDays,
        // Conditional timeline FK injection
        ...(timeline.source === 'global'
          ? { user_global_timeline_id: timeline.id }
          : { user_custom_timeline_id: timeline.id }),
      }));

      const { error: weekPlanError } = await supabase
        .from(DB.TASK_WEEK_PLAN)
        .insert(weekPlanInserts);
      if (weekPlanError) throw weekPlanError;

      // Link to goal with conditional goal FK
      if (taskData.twelve_wk_goal_id || taskData.custom_goal_id) {
        const goalJoinPayload: any = {
          parent_id: taskId,
          parent_type: 'task',
          user_id: user.id,
          // Conditional goal FK and type injection
          goal_type: taskData.goal_type || (timeline.source === 'global' ? 'twelve_wk_goal' : 'custom_goal'),
          twelve_wk_goal_id: taskData.twelve_wk_goal_id || null,
          custom_goal_id: taskData.custom_goal_id || null,
        };

        const { error: goalJoinError } = await supabase
          .from(DB.UNIVERSAL_GOALS_JOIN)
          .insert(goalJoinPayload);
        if (goalJoinError) throw goalJoinError;
      }

      // Link roles, domains, key relationships
      await Promise.all([
        insertUniversalJoins(supabase, user.id, taskId, 'task', 'role_id', taskData.selectedRoleIds, DB.UNIVERSAL_ROLES_JOIN),
        insertUniversalJoins(supabase, user.id, taskId, 'task', 'domain_id', taskData.selectedDomainIds, DB.UNIVERSAL_DOMAINS_JOIN),
        insertUniversalJoins(supabase, user.id, taskId, 'task', 'key_relationship_id', taskData.selectedKeyRelationshipIds, DB.UNIVERSAL_KEY_REL_JOIN),
      ]);

      await fetchGoals(timeline);
      return { id: taskId };
    } catch (error) {
      console.error('Error creating task with week plan:', error);
      throw error;
    }
  };

  /* --------------------------------
   * TASK DELETION - CENTRALIZED
   * -------------------------------- */
  const deleteTask = async (taskId: string): Promise<void> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Verify task ownership before deletion
      const { data: task, error: taskError } = await supabase
        .from(DB.TASKS)
        .select('id, user_id')
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;
      if (!task || task.user_id !== user.id) {
        throw new Error('Task not found or access denied');
      }

      // Soft delete the task by setting deleted_at timestamp
      const { error: deleteError } = await supabase
        .from(DB.TASKS)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', taskId);

      if (deleteError) throw deleteError;

      console.log('Task soft deleted successfully:', taskId);
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  };

  /* --------------------------------
   * GOAL DELETION - CENTRALIZED
   * -------------------------------- */
  const deleteGoal = async (goalId: string, goalType: '12week' | 'custom'): Promise<void> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Determine the correct table based on goal type
      const tableName = goalType === '12week' ? DB.GOALS_12WK : DB.GOALS_CUSTOM;

      // Verify goal ownership before deletion
      const { data: goal, error: goalError } = await supabase
        .from(tableName)
        .select('id, user_id')
        .eq('id', goalId)
        .single();

      if (goalError) throw goalError;
      if (!goal || goal.user_id !== user.id) {
        throw new Error('Goal not found or access denied');
      }

      // Soft delete the goal by setting status to 'cancelled'
      const { error: deleteError } = await supabase
        .from(tableName)
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString() 
        })
        .eq('id', goalId);

      if (deleteError) throw deleteError;

      console.log('Goal soft deleted successfully:', goalId);
      
      // Refresh goals to update the UI
      await refreshGoals();
    } catch (error) {
      console.error('Error deleting goal:', error);
      throw error;
    }
  };
  /* --------------------------------
   * Refresh orchestration
   * -------------------------------- */
  const refreshAllData = async () => {
    try {
      const timeline = await fetchCurrentTimeline();
      if (!timeline) {
        setTwelveWeekGoals([]);
        setCustomGoals([]);
        setAllGoals([]);
        return;
      }

      await fetchGoals(timeline);
    } catch (error) {
      console.error('Error refreshing all data:', error);
    }
  };

  const refreshGoals = async () => {
    if (currentTimeline) await fetchGoals(currentTimeline);
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
    currentTimeline,
    loading,

    // CRUD operations
    createTwelveWeekGoal,
    createCustomGoal,
    createTaskWithWeekPlan,
    deleteTask,
    deleteGoal,

    // Data refresh
    refreshGoals,
    refreshAllData,

    // Utilities
    fetchCurrentTimeline,
    insertUniversalJoins,
  };
}