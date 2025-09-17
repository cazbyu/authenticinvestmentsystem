import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';
import { CreateGoalModal } from '@/components/goals/CreateGoalModal';
import { EditGoalModal } from '@/components/goals/EditGoalModal';
import ActionEffortModal from '@/components/goals/ActionEffortModal';
import { ManageCustomTimelinesModal } from '@/components/timelines/ManageCustomTimelinesModal';
import { ManageGlobalTimelinesModal } from '@/components/timelines/ManageGlobalTimelinesModal';
import { WithdrawalForm } from '@/components/journal/WithdrawalForm';
import { getSupabaseClient } from '@/lib/supabase';
import { useGoals, fetchGoalActionsForWeek } from '@/hooks/useGoals';
import { Plus, ChevronLeft, ChevronRight, Target, Users, CreditCard as Edit, Minus } from 'lucide-react-native';

interface Timeline {
  id: string;
  source: 'custom' | 'global';
  title?: string;
  start_date: string | null;
  end_date: string | null;
  timeline_type?: 'cycle' | 'project' | 'challenge' | 'custom';
  global_cycle_id?: string | null;
  global_cycle?: {
    id?: string | null;
    title?: string | null;
    cycle_label?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    is_active?: boolean | null;
  } | null;
}

interface TimelineWeek {
  week_number: number;
  start_date: string;
  end_date: string;
}

export default function Goals() {
  const [selectedTimeline, setSelectedTimeline] = useState<Timeline | null>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [weekGoalActions, setWeekGoalActions] = useState<Record<string, any[]>>({});
  const [loadingWeekActions, setLoadingWeekActions] = useState(false);
  const [authenticScore, setAuthenticScore] = useState(0);
  
  // Modal states
  const [createGoalModalVisible, setCreateGoalModalVisible] = useState(false);
  const [editGoalModalVisible, setEditGoalModalVisible] = useState(false);
  const [actionEffortModalVisible, setActionEffortModalVisible] = useState(false);
  const [manageCustomTimelinesModalVisible, setManageCustomTimelinesModalVisible] = useState(false);
  const [manageGlobalTimelinesModalVisible, setManageGlobalTimelinesModalVisible] = useState(false);
  const [withdrawalFormVisible, setWithdrawalFormVisible] = useState(false);
  const [timelineSelectorVisible, setTimelineSelectorVisible] = useState(false);
  
  // Selected items
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [selectedGoalForAction, setSelectedGoalForAction] = useState<any>(null);
  
  // Timeline data
  const [allTimelines, setAllTimelines] = useState<Timeline[]>([]);
  const [timelineWeeks, setTimelineWeeks] = useState<TimelineWeek[]>([]);
  const [timelineDaysLeft, setTimelineDaysLeft] = useState<any>(null);
  const [timelinesWithGoals, setTimelinesWithGoals] = useState<any[]>([]);
  
  // Refs for initialization
  const initializedWeekRef = useRef(false);
  
  // Local goals state for the selected timeline
  const [timelineGoals, setTimelineGoals] = useState<any[]>([]);
  const [timelineGoalProgress, setTimelineGoalProgress] = useState<Record<string, any>>({});

  // Use the goals hook with timeline scope
  const {
    loading,
    completeActionSuggestion,
    undoActionOccurrence,
    createTwelveWeekGoal,
    createCustomGoal,
    createTaskWithWeekPlan,
  } = useGoals();

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

  const calculateAuthenticScore = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tasksData, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .not('completed_at', 'is', null);

      if (tasksError) throw tasksError;

      let totalDeposits = 0;
      if (tasksData && tasksData.length > 0) {
        const taskIds = tasksData.map(t => t.id);
        const [
          { data: rolesData },
          { data: domainsData }
        ] = await Promise.all([
          supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task')
        ]);

        for (const task of tasksData) {
          const taskWithData = {
            ...task,
            roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
            domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
          };
          totalDeposits += calculateTaskPoints(task, taskWithData.roles, taskWithData.domains);
        }
      }

      const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from('0008-ap-withdrawals')
        .select('amount')
        .eq('user_id', user.id);

      if (withdrawalsError) throw withdrawalsError;

      const totalWithdrawals = withdrawalsData?.reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0) || 0;
      const balance = totalDeposits - totalWithdrawals;
      setAuthenticScore(Math.round(balance * 10) / 10);
    } catch (error) {
      console.error('Error calculating authentic score:', error);
    }
  };

  const fetchAllTimelines = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const timelines: Timeline[] = [];

      // Fetch custom timelines
      const { data: customData, error: customError } = await supabase
        .from('0008-ap-custom-timelines')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (customError) throw customError;

      if (customData) {
        customData.forEach(timeline => {
          timelines.push({
            id: timeline.id,
            source: 'custom',
            title: timeline.title,
            start_date: timeline.start_date,
            end_date: timeline.end_date,
            timeline_type: timeline.timeline_type,
          });
        });
      }

      // Fetch global timelines
      const { data: globalData, error: globalError } = await supabase
        .from('0008-ap-user-global-timelines')
        .select(`
          *,
          global_cycle:0008-ap-global-cycles(
            id,
            title,
            cycle_label,
            start_date,
            end_date,
            is_active
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (globalError) throw globalError;

      if (globalData) {
        globalData.forEach(timeline => {
          timelines.push({
            id: timeline.id,
            source: 'global',
            title: timeline.title || timeline.global_cycle?.title || timeline.global_cycle?.cycle_label,
            start_date: timeline.start_date,
            end_date: timeline.end_date,
            global_cycle_id: timeline.global_cycle_id ?? timeline.global_cycle?.id,
            global_cycle: timeline.global_cycle || null,
          });
        });
      }

      setAllTimelines(timelines);
      
      // Fetch goal counts for each timeline
      await fetchTimelinesWithGoalCounts(timelines);

    } catch (error) {
      console.error('Error fetching timelines:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const fetchTimelinesWithGoalCounts = async (timelines: Timeline[]) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const timelinesWithCounts = await Promise.all(
        timelines.map(async (timeline) => {
          let goalCount = 0;
          let daysRemaining = 0;

          // Calculate days remaining
          if (timeline.start_date && timeline.end_date) {
            const now = new Date();
            const endDate = new Date(timeline.end_date);
            daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          }

          // Get goal count based on timeline source
          if (timeline.source === 'global') {
            // Count 12-week goals for global timelines
            const globalCycleId = timeline.global_cycle_id ?? timeline.global_cycle?.id;
            const orFilter = globalCycleId
              ? `user_global_timeline_id.eq.${timeline.id},global_cycle_id.eq.${globalCycleId}`
              : `user_global_timeline_id.eq.${timeline.id}`;

            const { data: twelveWeekGoals, error } = await supabase
              .from('0008-ap-goals-12wk')
              .select('id')
              .eq('user_id', user.id)
              .or(orFilter)
              .eq('status', 'active');

            if (!error) {
              goalCount = twelveWeekGoals?.length || 0;
            }
          } else if (timeline.source === 'custom') {
            // Count custom goals for custom timelines
            const { data: customGoals, error } = await supabase
              .from('0008-ap-goals-custom')
              .select('id')
              .eq('user_id', user.id)
              .eq('custom_timeline_id', timeline.id)
              .eq('status', 'active');

            if (!error) {
              goalCount = customGoals?.length || 0;
            }
          }

          return {
            ...timeline,
            goalCount,
            daysRemaining,
          };
        })
      );

      setTimelinesWithGoals(timelinesWithCounts);
    } catch (error) {
      console.error('Error fetching timeline goal counts:', error);
    }
  };

  const fetchTimelineGoals = async (timeline: Timeline) => {
    if (!timeline) {
      setTimelineGoals([]);
      setTimelineGoalProgress({});
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let goalsData: any[] = [];

      if (timeline.source === 'global') {
        // Fetch only 12-week goals for global timelines
        const globalCycleId = timeline.global_cycle_id ?? timeline.global_cycle?.id;
        const orFilter = globalCycleId
          ? `user_global_timeline_id.eq.${timeline.id},global_cycle_id.eq.${globalCycleId}`
          : `user_global_timeline_id.eq.${timeline.id}`;

        const { data, error } = await supabase
          .from('0008-ap-goals-12wk')
          .select('*')
          .eq('user_id', user.id)
          .or(orFilter)
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        goalsData = (data || []).map(goal => ({ ...goal, goal_type: '12week' }));
      } else if (timeline.source === 'custom') {
        // Fetch only custom goals for custom timelines
        const { data, error } = await supabase
          .from('0008-ap-goals-custom')
          .select('*')
          .eq('user_id', user.id)
          .eq('custom_timeline_id', timeline.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (error) throw error;
        goalsData = (data || []).map(goal => ({ ...goal, goal_type: 'custom' }));
      }

      if (goalsData.length === 0) {
        setTimelineGoals([]);
        setTimelineGoalProgress({});
        return;
      }

      const goalIds = goalsData.map(g => g.id);

      // Fetch related data for all goals
      const [
        { data: rolesData, error: rolesError },
        { data: domainsData, error: domainsError },
        { data: krData, error: krError }
      ] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label, color)').in('parent_id', goalIds).in('parent_type', ['goal', 'custom_goal']),
        supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', goalIds).in('parent_type', ['goal', 'custom_goal']),
        supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', goalIds).in('parent_type', ['goal', 'custom_goal'])
      ]);

      if (rolesError) throw rolesError;
      if (domainsError) throw domainsError;
      if (krError) throw krError;

      // Process goals with their related data
      const goalsWithData = goalsData.map(goal => ({
        ...goal,
        roles: rolesData?.filter(r => r.parent_id === goal.id).map(r => r.role).filter(Boolean) || [],
        domains: domainsData?.filter(d => d.parent_id === goal.id).map(d => d.domain).filter(Boolean) || [],
        key_relationships: krData?.filter(kr => kr.parent_id === goal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
      }));

      setTimelineGoals(goalsWithData);
      setTimelineGoalProgress({});

    } catch (error) {
      console.error('Error fetching timeline goals:', error);
      setTimelineGoals([]);
      setTimelineGoalProgress({});
    }
  };

  const fetchTimelineDaysLeft = async (timeline: Timeline) => {
    try {
      const supabase = getSupabaseClient();

      let data, error;
      
      if (timeline.source === 'global') {
        const result = await supabase
          .from('v_user_global_timeline_days_left')
          .select('timeline_id, days_left, pct_elapsed')
          .eq('timeline_id', timeline.id)
          .maybeSingle();
        data = result.data;
        error = result.error;
      } else {
        const result = await supabase
          .from('v_custom_timeline_days_left')
          .select('timeline_id, days_left, pct_elapsed')
          .eq('timeline_id', timeline.id)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }

      if (error && error.code !== 'PGRST116') throw error;

      setTimelineDaysLeft(data);
    } catch (error) {
      console.error('Error fetching timeline days left:', error);
      setTimelineDaysLeft(null);
    }
  };
    }
  };
}