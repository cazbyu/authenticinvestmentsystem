import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../lib/supabase';
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
  user_cycle_id?: string;
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
  created_at: string;
  updated_at: string;
  domains?: Array<{ id: string; name: string }>;
  roles?: Array<{ id: string; label: string; color?: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
  notes?: Array<{ content: string; created_at: string }>;
  goal_type: 'custom';
}

export type Goal = TwelveWeekGoal | CustomGoal;

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
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalProgress, setGoalProgress] = useState<Record<string, GoalProgress>>({});
  const [loading, setLoading] = useState(false);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch ONLY 12-week goals from the correct table
      const { data: twelveWeekData, error: twelveWeekError } = await supabase
        .from('0008-ap-goals-12wk')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (twelveWeekError) throw twelveWeekError;

      // Fetch ONLY custom goals from the correct table
      const { data: customData, error: customError } = await supabase
        .from('0008-ap-goals-custom')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (customError) throw customError;

      const allGoalIds = [
        ...(twelveWeekData || []).map(g => g.id),
        ...(customData || []).map(g => g.id)
      ];

      if (allGoalIds.length === 0) {
        setGoals([]);
        setGoalProgress({});
        return;
      }

      // Fetch related data for all goals
      const [
        { data: rolesData, error: rolesError },
        { data: domainsData, error: domainsError },
        { data: krData, error: krError }
      ] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label, color)').in('parent_id', allGoalIds).in('parent_type', ['goal', 'custom_goal']),
        supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', allGoalIds).in('parent_type', ['goal', 'custom_goal']),
        supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', allGoalIds).in('parent_type', ['goal', 'custom_goal'])
      ]);

      if (rolesError) throw rolesError;
      if (domainsError) throw domainsError;
      if (krError) throw krError;

      // Apply scope filtering if specified
      let filteredTwelveWeekIds = (twelveWeekData || []).map(g => g.id);
      let filteredCustomIds = (customData || []).map(g => g.id);

      if (options.scope && options.scope.type !== 'user' && options.scope.id) {
        switch (options.scope.type) {
          case 'role':
            const roleGoalIds = rolesData?.filter(r => r.role?.id === options.scope!.id).map(r => r.parent_id) || [];
            filteredTwelveWeekIds = filteredTwelveWeekIds.filter(id => roleGoalIds.includes(id));
            filteredCustomIds = filteredCustomIds.filter(id => roleGoalIds.includes(id));
            break;
          case 'domain':
            const domainGoalIds = domainsData?.filter(d => d.domain?.id === options.scope!.id).map(d => d.parent_id) || [];
            filteredTwelveWeekIds = filteredTwelveWeekIds.filter(id => domainGoalIds.includes(id));
            filteredCustomIds = filteredCustomIds.filter(id => domainGoalIds.includes(id));
            break;
          case 'key_relationship':
            const krGoalIds = krData?.filter(kr => kr.key_relationship?.id === options.scope!.id).map(kr => kr.parent_id) || [];
            filteredTwelveWeekIds = filteredTwelveWeekIds.filter(id => krGoalIds.includes(id));
            filteredCustomIds = filteredCustomIds.filter(id => krGoalIds.includes(id));
            break;
        }
      }

      // Transform 12-week goals with related data
      const transformedTwelveWeekGoals = (twelveWeekData || [])
        .filter(goal => filteredTwelveWeekIds.includes(goal.id))
        .map(goal => ({
          ...goal,
          goal_type: '12week' as const,
          domains: domainsData?.filter(d => d.parent_id === goal.id).map(d => d.domain).filter(Boolean) || [],
          roles: rolesData?.filter(r => r.parent_id === goal.id).map(r => r.role).filter(Boolean) || [],
          keyRelationships: krData?.filter(kr => kr.parent_id === goal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
        }));

      // Transform custom goals with related data
      const transformedCustomGoals = (customData || [])
        .filter(goal => filteredCustomIds.includes(goal.id))
        .map(goal => ({
          ...goal,
          progress: goal.progress ?? 0,
          goal_type: 'custom' as const,
          domains: domainsData?.filter(d => d.parent_id === goal.id).map(d => d.domain).filter(Boolean) || [],
          roles: rolesData?.filter(r => r.parent_id === goal.id).map(r => r.role).filter(Boolean) || [],
          keyRelationships: krData?.filter(kr => kr.parent_id === goal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
        }));

      // Combine goals but maintain separation by type
      const allGoals = [...transformedTwelveWeekGoals, ...transformedCustomGoals];
      setGoals(allGoals);

      // Calculate progress for each goal type separately
      await calculateGoalProgress(transformedTwelveWeekGoals, transformedCustomGoals);
    } catch (error) {
      console.error('Error fetching goals:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const calculateGoalProgress = async (
    twelveWeekGoals: TwelveWeekGoal[],
    customGoals: CustomGoal[]
  ) => {
    try {
      const progressData: Record<string, GoalProgress> = {};

      // Process 12-week goals
      for (const goal of twelveWeekGoals) {
        progressData[goal.id] = {
          goalId: goal.id,
          currentWeek: 1,
          daysRemaining: 0,
          weeklyActual: 0,
          weeklyTarget: goal.weekly_target,
          overallActual: 0,
          overallTarget: goal.total_target,
          overallProgress: goal.progress || 0,
        };
      }

      // Process custom goals
      for (const goal of customGoals) {
        progressData[goal.id] = {
          goalId: goal.id,
          currentWeek: 1,
          daysRemaining: 0,
          weeklyActual: 0,
          weeklyTarget: 0,
          overallActual: 0,
          overallTarget: 0,
          overallProgress: goal.progress || 0,
        };
      }

      setGoalProgress(progressData);
    } catch (error) {
      console.error('Error calculating goal progress:', error);
    }
  };

  const refreshGoals = async () => {
    await fetchGoals();
  };

  useEffect(() => {
    fetchGoals();
  }, [options.scope]);

  return {
    goals,
    goalProgress,
    loading,
    refreshGoals,
  };
}