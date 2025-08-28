import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { Alert } from 'react-native';

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
  global_cycle_id?: string;
  created_at: string;
  updated_at: string;
  domains?: Array<{ id: string; name: string }>;
  roles?: Array<{ id: string; label: string; color?: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
}

export interface GlobalCycle {
  id: string;
  title?: string;
  cycle_label?: string;
  start_date: string;
  end_date: string;
  reflection_start?: string;
  reflection_end?: string;
  is_active: boolean;
}

export interface GoalProgress {
  goalId: string;
  currentWeek: number;
  daysRemaining: number;
  weeklyActual: number;
  weeklyTarget: number;
  overallActual: number;
  overallTarget: number;
  overallProgress: number;
}

interface UseGoalProgressOptions {
  scope?: {
    type: 'user' | 'role' | 'domain' | 'key_relationship';
    id?: string;
  };
}

export function useGoalProgress(options: UseGoalProgressOptions = {}) {
  const [goals, setGoals] = useState<TwelveWeekGoal[]>([]);
  const [currentCycle, setCurrentCycle] = useState<GlobalCycle | null>(null);
  const [goalProgress, setGoalProgress] = useState<Record<string, GoalProgress>>({});
  const [loading, setLoading] = useState(false);

  const calculateTaskPoints = (task: any, roles: any[] = [], domains: any[] = []) => {
    let points = 0;
    if (roles && roles.length > 0) points += roles.length;
    if (domains && domains.length > 0) points += domains.length;
    if (task.is_authentic_deposit) points += 2;
    if (task.is_urgent && task.is_important) points += 1.5;
    else if (!task.is_urgent && task.is_important) points += 3;
    else if (task.is_urgent && !task.is_important) points += 1;
    else points += 0.5;
    if (task.is_twelve_week_goal) points += 2;
    return Math.round(points * 10) / 10;
  };

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  const getCurrentWeekInCycle = (cycleStartDate: string) => {
    const now = new Date();
    const startDate = new Date(cycleStartDate);
    const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(daysDiff / 7) + 1;
    return Math.max(1, Math.min(12, weekNumber));
  };

  const getDaysRemainingInCycle = (cycleEndDate: string) => {
    const now = new Date();
    const endDate = new Date(cycleEndDate);
    const daysDiff = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysDiff);
  };

  const getWeekDateRange = (cycleStartDate: string, weekNumber: number) => {
    const startDate = new Date(cycleStartDate);
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + (weekNumber - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return { start: weekStart, end: weekEnd };
  };

  const fetchCurrentCycle = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-global-cycles')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setCurrentCycle(data);
      return data;
    } catch (error) {
      console.error('Error fetching current cycle:', error);
      return null;
    }
  };

  const fetchGoals = async (cycle: GlobalCycle | null) => {
    if (!cycle) return;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch 12-week goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('0008-ap-goals-12wk')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (goalsError) throw goalsError;

      if (!goalsData || goalsData.length === 0) {
        setGoals([]);
        setGoalProgress({});
        return;
      }

      const goalIds = goalsData.map(g => g.id);

      // Fetch related data for goals
      const [
        { data: rolesData, error: rolesError },
        { data: domainsData, error: domainsError },
        { data: krData, error: krError }
      ] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label, color)').in('parent_id', goalIds).eq('parent_type', 'goal'),
        supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', goalIds).eq('parent_type', 'goal'),
        supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', goalIds).eq('parent_type', 'goal')
      ]);

      if (rolesError) throw rolesError;
      if (domainsError) throw domainsError;
      if (krError) throw krError;

      // Apply scope filtering if specified
      let filteredGoalIds = goalIds;
      if (options.scope && options.scope.type !== 'user' && options.scope.id) {
        switch (options.scope.type) {
          case 'role':
            filteredGoalIds = rolesData?.filter(r => r.role?.id === options.scope!.id).map(r => r.parent_id) || [];
            break;
          case 'domain':
            filteredGoalIds = domainsData?.filter(d => d.domain?.id === options.scope!.id).map(d => d.parent_id) || [];
            break;
          case 'key_relationship':
            filteredGoalIds = krData?.filter(kr => kr.key_relationship?.id === options.scope!.id).map(kr => kr.parent_id) || [];
            break;
        }
      }

      // Transform goals with related data
      const transformedGoals = goalsData
        .filter(goal => filteredGoalIds.includes(goal.id))
        .map(goal => ({
          ...goal,
          domains: domainsData?.filter(d => d.parent_id === goal.id).map(d => d.domain).filter(Boolean) || [],
          roles: rolesData?.filter(r => r.parent_id === goal.id).map(r => r.role).filter(Boolean) || [],
          keyRelationships: krData?.filter(kr => kr.parent_id === goal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
        }));

      setGoals(transformedGoals);

      // Calculate progress for each goal
      await calculateGoalProgress(transformedGoals, cycle);

    } catch (error) {
      console.error('Error fetching goals:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const calculateGoalProgress = async (goals: TwelveWeekGoal[], cycle: GlobalCycle) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const progressData: Record<string, GoalProgress> = {};

      for (const goal of goals) {
        const currentWeek = getCurrentWeekInCycle(cycle.start_date);
        const daysRemaining = getDaysRemainingInCycle(cycle.end_date);

        // Get current week date range
        const currentWeekRange = getWeekDateRange(cycle.start_date, currentWeek);
        const currentWeekStart = currentWeekRange.start.toISOString().split('T')[0];
        const currentWeekEnd = currentWeekRange.end.toISOString().split('T')[0];

        // Get cycle date range for overall progress
        const cycleStart = cycle.start_date;
        const cycleEnd = cycle.end_date;

        // Fetch completed tasks for this goal
        const { data: goalJoins } = await supabase
          .from('0008-ap-universal-goals-join')
          .select('parent_id')
          .eq('goal_id', goal.id)
          .eq('parent_type', 'task');

        const taskIds = goalJoins?.map(gj => gj.parent_id) || [];

        if (taskIds.length === 0) {
          progressData[goal.id] = {
            goalId: goal.id,
            currentWeek,
            daysRemaining,
            weeklyActual: 0,
            weeklyTarget: goal.weekly_target,
            overallActual: 0,
            overallTarget: goal.total_target,
            overallProgress: 0,
          };
          continue;
        }

        // Fetch completed tasks for weekly progress
        const { data: weeklyTasks } = await supabase
          .from('0008-ap-tasks')
          .select('*, completed_at')
          .in('id', taskIds)
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .eq('is_twelve_week_goal', true)
          .not('completed_at', 'is', null)
          .gte('completed_at', currentWeekStart)
          .lte('completed_at', currentWeekEnd + 'T23:59:59');

        // Fetch completed tasks for overall progress
        const { data: overallTasks } = await supabase
          .from('0008-ap-tasks')
          .select('*, completed_at')
          .in('id', taskIds)
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .eq('is_twelve_week_goal', true)
          .not('completed_at', 'is', null)
          .gte('completed_at', cycleStart)
          .lte('completed_at', cycleEnd + 'T23:59:59');

        const weeklyActual = weeklyTasks?.length || 0;
        const overallActual = overallTasks?.length || 0;
        const overallProgress = goal.total_target > 0 ? Math.round((overallActual / goal.total_target) * 100) : 0;

        progressData[goal.id] = {
          goalId: goal.id,
          currentWeek,
          daysRemaining,
          weeklyActual,
          weeklyTarget: goal.weekly_target,
          overallActual,
          overallTarget: goal.total_target,
          overallProgress,
        };
      }

      setGoalProgress(progressData);
    } catch (error) {
      console.error('Error calculating goal progress:', error);
    }
  };

  const refreshGoals = async () => {
    const cycle = await fetchCurrentCycle();
    if (cycle) {
      await fetchGoals(cycle);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      const cycle = await fetchCurrentCycle();
      if (cycle) {
        await fetchGoals(cycle);
      }
    };

    initializeData();
  }, [options.scope]);

  return {
    goals,
    currentCycle,
    goalProgress,
    loading,
    refreshGoals,
  };
}