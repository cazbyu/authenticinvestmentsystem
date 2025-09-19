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
import { useGoals } from '@/hooks/useGoals';
import { useGoalProgress } from '@/hooks/useGoalProgress';
import { calculateAuthenticScore } from '@/lib/taskUtils';
import { formatLocalDate } from '@/lib/dateUtils';
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
  
  // Import functions from useGoalProgress hook
  const {
    toggleTaskDay,
  } = useGoalProgress();
  
  // Local goals state for the selected timeline
  const [timelineGoals, setTimelineGoals] = useState<any[]>([]);
  const [timelineGoalProgress, setTimelineGoalProgress] = useState<Record<string, any>>({});

  const fetchWeekActions = async () => {
    if (!selectedTimeline || timelineWeeks.length === 0 || timelineGoals.length === 0) {
      setWeekGoalActions({});
      return;
    }

    const currentWeek = timelineWeeks[currentWeekIndex];
    if (!currentWeek) {
      setWeekGoalActions({});
      return;
    }

    setLoadingWeekActions(true);
    try {
      const goalIds = timelineGoals.map(g => g.id);
      const actions = await fetchGoalActionsForWeek(
        goalIds,
        currentWeek.week_number,
        selectedTimeline.id,
        timelineWeeks
      );
      setWeekGoalActions(actions);
    } catch (error) {
      console.error('Error fetching week actions:', error);
      setWeekGoalActions({});
    } finally {
      setLoadingWeekActions(false);
    }
  };

  // Add effect to fetch week actions when timeline or week changes
  useEffect(() => {
    if (selectedTimeline && timelineWeeks.length > 0 && timelineGoals.length > 0) {
      fetchWeekActions();
    }
  }, [selectedTimeline, currentWeekIndex, timelineGoals]);

  const handleToggleCompletion = async (actionId: string, date: string, completed: boolean) => {
    try {
      console.log('Toggling completion:', { actionId, date, completed });
      
      if (completed) {
        // If currently completed, undo the completion
        await undoActionOccurrence({ parentTaskId: actionId, whenISO: date });
      } else {
        // If not completed, mark as completed
        await completeActionSuggestion({ parentTaskId: actionId, whenISO: date });
      }
      
      // Refresh the week actions to show updated state
      await fetchWeekActions();
      
      // Also refresh the authentic score
      calculateAuthenticScore();
    } catch (error) {
      console.error('Error toggling completion:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to update completion status');
    }
  };

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
  
  // Use the goals hook with timeline scope
  const {
    loading,
    allGoals,
    goalProgress,
    refreshGoals,
    refreshAllData,
    fetchGoalActionsForWeek,
    completeActionSuggestion,
    undoActionOccurrence,
    createTwelveWeekGoal,
    createCustomGoal,
    createTaskWithWeekPlan,
  } = useGoals();

  useEffect(() => {
    fetchAllTimelines();
    calculateAuthenticScore();
  }, []);

  useEffect(() => {
    if (selectedTimeline) {
      fetchTimelineGoals(selectedTimeline);
      fetchTimelineWeeks(selectedTimeline);
      fetchTimelineDaysLeft(selectedTimeline);
    }
  }, [selectedTimeline]);

  // Set current week index when timeline weeks are loaded
  useEffect(() => {
    if (timelineWeeks.length > 0) {
      const currentWeekIndex = getCurrentWeekIndex();
      setCurrentWeekIndex(currentWeekIndex);
    }
  }, [timelineWeeks]);

  const getCurrentWeekIndex = () => {
    if (timelineWeeks.length === 0) return 0;
    
    const today = formatLocalDate(new Date());
    
    // Find the week that contains today's date
    const currentWeekIndex = timelineWeeks.findIndex(week => 
      today >= week.start_date && today <= week.end_date
    );
    
    // If today is before the timeline starts, show week 0
    if (currentWeekIndex === -1) {
      if (today < timelineWeeks[0].start_date) {
        return 0;
      }
      // If today is after the timeline ends, show the last week
      return timelineWeeks.length - 1;
    }
    
    return currentWeekIndex;
  };

  const calculateAuthenticScore = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const score = await calculateAuthenticScore(supabase, user.id);
      setAuthenticScore(score);
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

      console.log('Custom timelines query result:', {
        data: customData,
        error: customError,
        count: customData?.length || 0
      });
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

// 🔍 Debug log each hydrated timeline
    console.log("DEBUG: hydrated timelines:", timelines.map(t => ({
      id: t.id,
      source: t.source,
      title: t.title,
      start_date: t.start_date,
      end_date: t.end_date
    })));
      
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
            console.log('Fetching custom goals for timeline:', {
              timelineId: timeline.id,
              timelineSource: timeline.source,
              userId: user.id
            });
            
            const { data: customGoals, error } = await supabase
              .from('0008-ap-goals-custom')
              .select('id')
              .eq('user_id', user.id)
              .eq('custom_timeline_id', timeline.id)
              .eq('status', 'active');

            console.log('Custom goals query result:', {
              data: customGoals,
              error: error,
              count: customGoals?.length || 0
            });
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
        // Fetch 12-week goals for global timelines - try both FK columns
        console.log('Fetching global timeline goals for timeline:', timeline.id);
        
        // First try user_global_timeline_id
        const { data, error } = await supabase
          .from('0008-ap-goals-12wk')
          .select('*')
          .eq('user_id', user.id)
          .eq('user_global_timeline_id', timeline.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        
        console.log('Global goals query result (user_global_timeline_id):', { data, error, count: data?.length || 0 });
        
        if (error) {
          console.error('Error with user_global_timeline_id query:', error);
          throw error;
        }
        
        if (data && data.length > 0) {
          goalsData = data.map(goal => ({ ...goal, goal_type: '12week' }));
        } else {
          // Fallback: try global_cycle_id if user_global_timeline_id didn't work
          console.log('No goals found with user_global_timeline_id, trying global_cycle_id fallback');
          const globalCycleId = timeline.global_cycle_id || timeline.global_cycle?.id;
          
          if (globalCycleId) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('0008-ap-goals-12wk')
              .select('*')
              .eq('user_id', user.id)
              .eq('global_cycle_id', globalCycleId)
              .eq('status', 'active')
              .order('created_at', { ascending: false });
            
            console.log('Global goals fallback query result (global_cycle_id):', { 
              data: fallbackData, 
              error: fallbackError, 
              count: fallbackData?.length || 0,
              globalCycleId 
            });
            
            if (fallbackError) {
              console.error('Error with global_cycle_id fallback query:', fallbackError);
            } else if (fallbackData) {
              goalsData = fallbackData.map(goal => ({ ...goal, goal_type: '12week' }));
            }
          }
        }
      } else if (timeline.source === 'custom') {
        console.log('Fetching custom timeline goals for timeline:', timeline.id);
        // Fetch only custom goals for custom timelines
        const { data, error } = await supabase
          .from('0008-ap-goals-custom')
          .select('*')
          .eq('user_id', user.id)
          .eq('custom_timeline_id', timeline.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        console.log('Custom goals query result:', { data, error, count: data?.length || 0 });
        if (error) throw error;
        goalsData = (data || []).map(goal => ({ ...goal, goal_type: 'custom' }));
      }

      console.log('Fetched goals for timeline:', {
        timelineId: timeline.id,
        source: timeline.source,
        goalsCount: goalsData.length,
        goals: goalsData.map(g => ({ id: g.id, title: g.title }))
      });

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
        keyRelationships: krData?.filter(kr => kr.parent_id === goal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
      }));

      console.log('Goals with data:', {
        count: goalsWithData.length,
        sample: goalsWithData[0] ? {
          id: goalsWithData[0].id,
          title: goalsWithData[0].title,
          rolesCount: goalsWithData[0].roles?.length || 0,
          domainsCount: goalsWithData[0].domains?.length || 0
        } : null
      });

      setTimelineGoals(goalsWithData);
      setTimelineGoalProgress({});

    } catch (error) {
      console.error('Error fetching timeline goals:', error);
      Alert.alert('Error', `Failed to fetch goals: ${(error as Error).message}`);
      setTimelineGoals([]);
      setTimelineGoalProgress({});
    }
  };

  const fetchTimelineWeeks = async (timeline: Timeline) => {
    try {
      const supabase = getSupabaseClient();

      let weeks, error;
      
      if (timeline.source === 'global') {
        const result = await supabase
          .from('v_user_global_timeline_weeks')
          .select('week_number, week_start, week_end')
          .eq('timeline_id', timeline.id)
          .order('week_number', { ascending: true });
        weeks = result.data;
        error = result.error;
      } else {
        const result = await supabase
          .from('v_custom_timeline_weeks')
          .select('week_number, week_start, week_end')
          .eq('timeline_id', timeline.id)
          .order('week_number', { ascending: true });
        weeks = result.data;
        error = result.error;
      }

      if (error) throw error;

      // Normalize the data structure
      const normalizedWeeks = (weeks || []).map(week => ({
        week_number: week.week_number,
        start_date: week.week_start,
        end_date: week.week_end,
      }));

      setTimelineWeeks(normalizedWeeks);
    } catch (error) {
      console.error('Error fetching timeline weeks:', error);
      setTimelineWeeks([]);
    }
  };

  const fetchTimelineDaysLeft = async (timeline: Timeline) => {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('v_unified_timeline_days_left')
        .select('timeline_id, days_left, pct_elapsed, source')
        .eq('timeline_id', timeline.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      setTimelineDaysLeft(data);
    } catch (error) {
      console.error('Error fetching timeline days left:', error);
      setTimelineDaysLeft(null);
    }
  };

  const handleTimelineSelect = (timeline: Timeline) => {
    setSelectedTimeline(timeline);
    setCurrentWeekIndex(0);
  };

  const handleBackToTimelines = () => {
    setSelectedTimeline(null);
    setTimelineGoals([]);
    setTimelineWeeks([]);
    setTimelineDaysLeft(null);
    setWeekGoalActions({});
  };

  const renderTimelineSelector = () => (
    <View style={styles.content}>
      <Header 
        title="Goal Bank" 
        authenticScore={authenticScore}
      />
      
      <ScrollView style={styles.timelinesList}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0078d4" />
            <Text style={styles.loadingText}>Loading timelines...</Text>
          </View>
        ) : timelinesWithGoals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Target size={64} color="#6b7280" />
            <Text style={styles.emptyTitle}>No Active Timelines</Text>
            <Text style={styles.emptyText}>
              Create a timeline to start tracking your goals
            </Text>
            <View style={styles.timelineButtons}>
              <TouchableOpacity
                style={styles.createTimelineButton}
                onPress={() => setManageCustomTimelinesModalVisible(true)}
              >
                <Plus size={20} color="#ffffff" />
                <Text style={styles.createTimelineButtonText}>Custom Timeline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createGlobalTimelineButton}
                onPress={() => setManageGlobalTimelinesModalVisible(true)}
              >
                <Users size={20} color="#ffffff" />
                <Text style={styles.createGlobalTimelineButtonText}>Global Timeline</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.timelinesGrid}>
            {timelinesWithGoals.map(timeline => (
              <TouchableOpacity
                key={timeline.id}
                style={[
                  styles.timelineCard,
                  { borderLeftColor: timeline.source === 'global' ? '#0078d4' : '#7c3aed' }
                ]}
                onPress={() => handleTimelineSelect(timeline)}
              >
                <View style={styles.timelineHeader}>
                  <Text style={styles.timelineTitle} numberOfLines={2}>
                    {timeline.title || 'Untitled Timeline'}
                  </Text>
                  <View style={styles.timelineType}>
                    <Text style={styles.timelineTypeText}>
                      {timeline.source === 'global' ? 'Global' : 'Custom'}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.timelineStats}>
                  {timeline.goalCount || 0} goals • {timeline.daysRemaining || 0} days left
                </Text>
                
                {timeline.start_date && timeline.end_date && (
                  <Text style={styles.timelineDates}>
                    {new Date(timeline.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {' '}
                    {new Date(timeline.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Management buttons */}
      <View style={styles.managementButtons}>
        <TouchableOpacity
          style={styles.manageButton}
          onPress={() => setManageCustomTimelinesModalVisible(true)}
        >
          <Edit size={16} color="#7c3aed" />
          <Text style={styles.manageButtonText}>Manage Custom</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.manageGlobalButton}
          onPress={() => setManageGlobalTimelinesModalVisible(true)}
        >
          <Users size={16} color="#0078d4" />
          <Text style={styles.manageGlobalButtonText}>Manage Global</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSelectedTimeline = () => {
    if (!selectedTimeline) return null;

    const currentWeek = timelineWeeks[currentWeekIndex];
    const weekGoalActionsForWeek = weekGoalActions || {};

    return (
      <View style={styles.content}>
        <Header
          title={selectedTimeline.title || 'Timeline Goals'}
          authenticScore={authenticScore}
          backgroundColor={selectedTimeline.source === 'global' ? '#0078d4' : '#7c3aed'}
          onBackPress={handleBackToTimelines}
          daysRemaining={timelineDaysLeft?.days_left}
          cycleProgressPercentage={timelineDaysLeft?.pct_elapsed}
          cycleTitle={selectedTimeline.title}
        />

        {/* Week Navigation */}
        {timelineWeeks.length > 0 && (
          <View style={styles.weekNavigation}>
            <TouchableOpacity
              style={[styles.weekNavButton, currentWeekIndex === 0 && styles.weekNavButtonDisabled]}
              onPress={() => setCurrentWeekIndex(Math.max(0, currentWeekIndex - 1))}
              disabled={currentWeekIndex === 0}
            >
              <ChevronLeft size={20} color={currentWeekIndex === 0 ? '#9ca3af' : '#0078d4'} />
            </TouchableOpacity>
            
            <View style={styles.weekInfo}>
              <Text style={styles.weekTitle}>
                Week {currentWeek?.week_number || 1}
              </Text>
              {currentWeek && (
                <Text style={styles.weekDates}>
                  {new Date(currentWeek.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {' '}
                  {new Date(currentWeek.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              )}
            </View>
            
            <TouchableOpacity
              style={[styles.weekNavButton, currentWeekIndex === timelineWeeks.length - 1 && styles.weekNavButtonDisabled]}
              onPress={() => setCurrentWeekIndex(Math.min(timelineWeeks.length - 1, currentWeekIndex + 1))}
              disabled={currentWeekIndex === timelineWeeks.length - 1}
            >
              <ChevronRight size={20} color={currentWeekIndex === timelineWeeks.length - 1 ? '#9ca3af' : '#0078d4'} />
            </TouchableOpacity>
          </View>
        )}

        <ScrollView style={styles.goalsList}>
          {timelineGoals.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No goals found for this timeline</Text>
              <TouchableOpacity
                style={styles.createGoalButton}
                onPress={() => setCreateGoalModalVisible(true)}
              >
                <Plus size={20} color="#ffffff" />
                <Text style={styles.createGoalButtonText}>Create Goal</Text>
              </TouchableOpacity>
            </View>
          ) : (
            timelineGoals.map(goal => {
              const progress = timelineGoalProgress[goal.id] || {
                currentWeek: currentWeek?.week_number || 1,
                daysRemaining: timelineDaysLeft?.days_left || 0,
                weeklyActual: 0,
                weeklyTarget: goal.weekly_target || 0,
                overallActual: 0,
                overallTarget: goal.total_target || 0,
                overallProgress: 0,
              };
              
              return (
                <GoalProgressCard
                  key={goal.id}
                  goal={goal}
                  progress={progress}
                  expanded={true}
                  week={currentWeek ? {
                    weekNumber: currentWeek.week_number,
                    startDate: currentWeek.start_date,
                    endDate: currentWeek.end_date,
                  } : null}
                  weekActions={weekGoalActionsForWeek[goal.id] || []}
                  loadingWeekActions={loadingWeekActions}
                  onAddAction={() => {
                    setSelectedGoalForAction(goal);
                    setActionEffortModalVisible(true);
                  }}
                  onEdit={() => {
                    setSelectedGoal(goal);
                    setEditGoalModalVisible(true);
                  }}
                  selectedWeekNumber={currentWeek?.week_number}
                  onToggleCompletion={handleToggleCompletion}
                />
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {selectedTimeline ? renderSelectedTimeline() : renderTimelineSelector()}

      {/* FAB for creating goals */}
      <TouchableOpacity 
        style={styles.fabLarge} 
        onPress={() => setCreateGoalModalVisible(true)}
      >
        <Plus size={24} color="#ffffff" />
      </TouchableOpacity>

      {/* Modals */}
      <CreateGoalModal
        visible={createGoalModalVisible}
        onClose={() => setCreateGoalModalVisible(false)}
        onSubmitSuccess={() => {
          setCreateGoalModalVisible(false);
          fetchTimelineGoals(selectedTimeline!);
          fetchAllTimelines();
        }}
        createTwelveWeekGoal={createTwelveWeekGoal}
        createCustomGoal={createCustomGoal}
        selectedTimeline={selectedTimeline}
      />

      <EditGoalModal
        visible={editGoalModalVisible}
        onClose={() => setEditGoalModalVisible(false)}
        onUpdate={() => {
          setEditGoalModalVisible(false);
          fetchTimelineGoals(selectedTimeline!);
          fetchAllTimelines();
        }}
        goal={selectedGoal}
      />

      <ActionEffortModal
        visible={actionEffortModalVisible}
        onClose={() => {
          setActionEffortModalVisible(false);
          // Refresh data after action is created
          fetchTimelineGoals(selectedTimeline!);
          fetchWeekActions();
        }}
        goal={selectedGoalForAction}
        cycleWeeks={timelineWeeks}
        createTaskWithWeekPlan={createTaskWithWeekPlan}
      />

      <ManageCustomTimelinesModal
        visible={manageCustomTimelinesModalVisible}
        onClose={() => setManageCustomTimelinesModalVisible(false)}
        onUpdate={() => {
          fetchAllTimelines();
          if (selectedTimeline) {
            fetchTimelineGoals(selectedTimeline);
          }
        }}
      />

      <ManageGlobalTimelinesModal
        visible={manageGlobalTimelinesModalVisible}
        onClose={() => setManageGlobalTimelinesModalVisible(false)}
        onUpdate={() => {
          fetchAllTimelines();
          if (selectedTimeline) {
            fetchTimelineGoals(selectedTimeline);
          }
        }}
      />

      <WithdrawalForm
        visible={withdrawalFormVisible}
        onClose={() => setWithdrawalFormVisible(false)}
        onSubmitSuccess={() => {
          setWithdrawalFormVisible(false);
          calculateAuthenticScore();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
  timelinesList: {
    flex: 1,
    padding: 16,
  },
  timelinesGrid: {
    gap: 12,
  },
  timelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  timelineType: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  timelineTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
  timelineStats: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  timelineDates: {
    fontSize: 12,
    color: '#9ca3af',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 16,
    marginTop: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  timelineButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  createTimelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  createTimelineButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  createGlobalTimelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  createGlobalTimelineButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  managementButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  manageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  manageButtonText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
  },
  manageGlobalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0078d4',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  manageGlobalButtonText: {
    color: '#0078d4',
    fontSize: 14,
    fontWeight: '600',
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  weekNavButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  weekNavButtonDisabled: {
    backgroundColor: '#f3f4f6',
  },
  weekInfo: {
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  weekDates: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  goalsList: {
    flex: 1,
    padding: 16,
  },
  createGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  createGoalButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0078d4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabLarge: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0078d4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});