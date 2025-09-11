import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';
import { CreateGoalModal } from '@/components/goals/CreateGoalModal';
import { EditGoalModal } from '@/components/goals/EditGoalModal';
import ActionEffortModal from '@/components/goals/ActionEffortModal';
import { CycleSetupModal } from '@/components/cycles/CycleSetupModal';
import { ManageCustomTimelinesModal } from '@/components/timelines/ManageCustomTimelinesModal';
import { WithdrawalForm } from '@/components/journal/WithdrawalForm';
import { getSupabaseClient } from '@/lib/supabase';
import { useGoals, Goal, TwelveWeekGoal, CustomGoal, UserCycle, CycleWeek, DaysLeftData, GoalProgress, TaskWithLogs } from '@/hooks/useGoals';
import { Plus, ChevronLeft, ChevronRight, Target, Calendar, Users, CreditCard as Edit } from 'lucide-react-native';

interface Timeline {
  id: string;
  source: 'custom' | 'global';
  title?: string;
  start_date: string | null;
  end_date: string | null;
  timeline_type?: 'cycle' | 'project' | 'challenge' | 'custom';
  goals_count?: number;
}

interface WeekData {
  weekNumber: number;
  startDate: string;
  endDate: string;
}

export default function Goals() {
  const {
    twelveWeekGoals,
    customGoals,
    allGoals,
    currentCycle,
    cycleWeeks,
    daysLeftData,
    goalProgress,
    cycleEffortData,
    loading,
    loadingWeekActions,
    setLoadingWeekActions,
    refreshGoals,
    refreshAllData,
    fetchGoalActionsForWeek,
    completeActionSuggestion,
    undoActionOccurrence,
    createTwelveWeekGoal,
    createCustomGoal,
    createTaskWithWeekPlan,
    getCurrentWeekNumber,
    getCurrentWeekIndex,
    getWeekData,
    weekGoalActions,
    setWeekGoalActions,
  } = useGoals();

  // Timeline management
  const [customTimelines, setCustomTimelines] = useState<Timeline[]>([]);
  const [selectedTimeline, setSelectedTimeline] = useState<Timeline | null>(null);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(1);
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [customTimelineWeeks, setCustomTimelineWeeks] = useState<WeekData[]>([]);

  // Modal states
  const [createGoalModalVisible, setCreateGoalModalVisible] = useState(false);
  const [editGoalModalVisible, setEditGoalModalVisible] = useState(false);
  const [actionEffortModalVisible, setActionEffortModalVisible] = useState(false);
  const [cycleSetupModalVisible, setCycleSetupModalVisible] = useState(false);
  const [customTimelinesModalVisible, setCustomTimelinesModalVisible] = useState(false);
  const [withdrawalFormVisible, setWithdrawalFormVisible] = useState(false);

  // Selected items
  const [selectedGoal, setSelectedGoal] = useState<TwelveWeekGoal | null>(null);
  const [editingGoal, setEditingGoal] = useState<TwelveWeekGoal | null>(null);
  const [authenticScore, setAuthenticScore] = useState(0);

  useEffect(() => {
    fetchCustomTimelines();
    calculateAuthenticScore();
  }, []);

  useEffect(() => {
    if (currentCycle) {
      setSelectedTimeline({
        id: currentCycle.id,
        source: currentCycle.source,
        title: currentCycle.title,
        start_date: currentCycle.start_date,
        end_date: currentCycle.end_date,
        timeline_type: currentCycle.timeline_type || 'cycle',
      });
      
      // Set initial week to current week
      const currentWeek = getCurrentWeekNumber();
      setSelectedWeekNumber(currentWeek);
      
      // Update week data for current week
      const currentWeekData = getWeekData(currentWeek - 1);
      setWeekData(currentWeekData);
    }
  }, [currentCycle, getCurrentWeekNumber, getWeekData]);

  useEffect(() => {
    if (selectedTimeline && selectedTimeline.source === 'custom') {
      generateCustomTimelineWeeks(selectedTimeline);
    }
  }, [selectedTimeline]);

  useEffect(() => {
    if (selectedTimeline && allGoals.length > 0) {
      loadWeekActions();
    }
  }, [selectedWeekNumber, selectedTimeline, allGoals]);

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

  const fetchCustomTimelines = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-custom-timelines')
        .select('*, goals:0008-ap-goals-custom(id)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const timelinesWithCounts: Timeline[] = (data || []).map(tl => ({
        id: tl.id,
        source: 'custom',
        title: tl.title,
        start_date: tl.start_date,
        end_date: tl.end_date,
        timeline_type: tl.timeline_type || 'custom',
        goals_count: tl.goals ? tl.goals.length : 0,
      }));

      setCustomTimelines(timelinesWithCounts);
    } catch (error) {
      console.error('Error fetching custom timelines:', error);
    }
  };

  const generateCustomTimelineWeeks = (timeline: Timeline) => {
    if (!timeline.start_date || !timeline.end_date) return;

    try {
      const startDate = new Date(timeline.start_date);
      const endDate = new Date(timeline.end_date);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const totalWeeks = Math.ceil(totalDays / 7);

      const weeks: WeekData[] = [];
      for (let i = 0; i < totalWeeks; i++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (i * 7));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        weeks.push({
          weekNumber: i + 1,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0],
        });
      }

      setCustomTimelineWeeks(weeks);

      // Set initial week to current week for custom timelines
      const now = new Date();
      const currentWeekIndex = weeks.findIndex(week => {
        const weekStartDate = new Date(week.startDate);
        const weekEndDate = new Date(week.endDate);
        return now >= weekStartDate && now <= weekEndDate;
      });

      if (currentWeekIndex >= 0) {
        setSelectedWeekNumber(currentWeekIndex + 1);
        setWeekData(weeks[currentWeekIndex]);
      } else {
        // If current date is outside timeline, default to first week
        setSelectedWeekNumber(1);
        setWeekData(weeks[0] || null);
      }
    } catch (error) {
      console.error('Error generating custom timeline weeks:', error);
    }
  };

  const loadWeekActions = async () => {
    if (!selectedTimeline || allGoals.length === 0) return;

    setLoadingWeekActions(true);
    try {
      const goalIds = allGoals.map(g => g.id);
      const actions = await fetchGoalActionsForWeek(
        goalIds,
        selectedWeekNumber,
        selectedTimeline.source === 'custom' ? customTimelineWeeks : undefined
      );
      setWeekGoalActions(actions);
    } catch (error) {
      console.error('Error loading week actions:', error);
    } finally {
      setLoadingWeekActions(false);
    }
  };

  const handleWeekChange = (direction: 'prev' | 'next') => {
    const maxWeeks = selectedTimeline?.source === 'custom' 
      ? customTimelineWeeks.length 
      : 12;

    let newWeekNumber = selectedWeekNumber;
    if (direction === 'next' && selectedWeekNumber < maxWeeks) {
      newWeekNumber = selectedWeekNumber + 1;
    } else if (direction === 'prev' && selectedWeekNumber > 1) {
      newWeekNumber = selectedWeekNumber - 1;
    }

    if (newWeekNumber !== selectedWeekNumber) {
      setSelectedWeekNumber(newWeekNumber);
      
      // Update week data based on timeline type
      if (selectedTimeline?.source === 'custom') {
        const customWeek = customTimelineWeeks.find(w => w.weekNumber === newWeekNumber);
        setWeekData(customWeek || null);
      } else {
        // For 12-week cycles, use the getWeekData function
        const cycleWeekData = getWeekData(newWeekNumber - 1);
        setWeekData(cycleWeekData);
      }
    }
  };

  const handleTimelineSelect = (timeline: Timeline) => {
    setSelectedTimeline(timeline);
    
    if (timeline.source === 'custom') {
      generateCustomTimelineWeeks(timeline);
    } else {
      // For 12-week cycles, set to current week
      const currentWeek = getCurrentWeekNumber();
      setSelectedWeekNumber(currentWeek);
      const currentWeekData = getWeekData(currentWeek - 1);
      setWeekData(currentWeekData);
    }
  };

  const handleToggleCompletion = async (actionId: string, date: string, isCurrentlyCompleted: boolean) => {
    try {
      if (isCurrentlyCompleted) {
        await undoActionOccurrence({ parentTaskId: actionId, whenISO: date });
      } else {
        await completeActionSuggestion({ parentTaskId: actionId, whenISO: date });
      }
      
      // Refresh the week actions to show updated completion status
      loadWeekActions();
      refreshGoals();
    } catch (error) {
      console.error('Error toggling completion:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleCreateCustomTimeline = async (timelineData: {
    title: string;
    description?: string;
    start_date: string;
    end_date: string;
    timeline_type?: string;
  }) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { data, error } = await supabase
        .from('0008-ap-custom-timelines')
        .insert({
          user_id: user.id,
          title: timelineData.title,
          description: timelineData.description,
          start_date: timelineData.start_date,
          end_date: timelineData.end_date,
          timeline_type: timelineData.timeline_type || 'custom',
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      await fetchCustomTimelines();
      return data;
    } catch (error) {
      console.error('Error creating custom timeline:', error);
      throw error;
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
      const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
      
      if (start.getFullYear() === end.getFullYear()) {
        if (start.getMonth() === end.getMonth()) {
          return `${start.getDate()} - ${end.getDate()} ${startMonth}`;
        } else {
          return `${start.getDate()} ${startMonth} - ${end.getDate()} ${endMonth}`;
        }
      } else {
        return `${start.getDate()} ${startMonth} ${start.getFullYear()} - ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
      }
    } catch (error) {
      console.error('Error formatting date range:', error);
      return 'Invalid date';
    }
  };

  const renderTimelineSelector = () => {
    const allTimelines: Timeline[] = [];
    
    // Add current cycle if exists
    if (currentCycle) {
      allTimelines.push({
        id: currentCycle.id,
        source: currentCycle.source,
        title: currentCycle.title,
        start_date: currentCycle.start_date,
        end_date: currentCycle.end_date,
        timeline_type: currentCycle.timeline_type || 'cycle',
      });
    }
    
    // Add custom timelines
    allTimelines.push(...customTimelines);

    if (allTimelines.length === 0) {
      return (
        <View style={styles.noTimelineContainer}>
          <Target size={48} color="#6b7280" />
          <Text style={styles.noTimelineTitle}>No Active Timeline</Text>
          <Text style={styles.noTimelineText}>
            Create a 12-week cycle or custom timeline to start tracking goals
          </Text>
          <View style={styles.timelineButtons}>
            <TouchableOpacity
              style={styles.createTimelineButton}
              onPress={() => setCycleSetupModalVisible(true)}
            >
              <Calendar size={20} color="#ffffff" />
              <Text style={styles.createTimelineButtonText}>Start 12-Week Cycle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.createCustomTimelineButton}
              onPress={() => setCustomTimelinesModalVisible(true)}
            >
              <Target size={20} color="#7c3aed" />
              <Text style={styles.createCustomTimelineButtonText}>Custom Timeline</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.timelineSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.timelineOptions}>
            {allTimelines.map(timeline => (
              <TouchableOpacity
                key={timeline.id}
                style={[
                  styles.timelineOption,
                  selectedTimeline?.id === timeline.id && styles.selectedTimelineOption
                ]}
                onPress={() => handleTimelineSelect(timeline)}
              >
                <Text style={[
                  styles.timelineOptionTitle,
                  selectedTimeline?.id === timeline.id && styles.selectedTimelineOptionTitle
                ]}>
                  {timeline.title || (timeline.source === 'global' ? '12-Week Cycle' : 'Custom Timeline')}
                </Text>
                <Text style={[
                  styles.timelineOptionSubtitle,
                  selectedTimeline?.id === timeline.id && styles.selectedTimelineOptionSubtitle
                ]}>
                  {timeline.source === 'global' ? 'Community Cycle' : 
                   timeline.timeline_type === 'cycle' ? 'Custom Cycle' :
                   timeline.timeline_type === 'project' ? 'Project Timeline' :
                   timeline.timeline_type === 'challenge' ? 'Challenge Timeline' :
                   'Custom Timeline'}
                </Text>
                {timeline.start_date && timeline.end_date && (
                  <Text style={[
                    styles.timelineOptionDates,
                    selectedTimeline?.id === timeline.id && styles.selectedTimelineOptionDates
                  ]}>
                    {formatDateRange(timeline.start_date, timeline.end_date)}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        
        <TouchableOpacity
          style={styles.manageTimelinesButton}
          onPress={() => setCustomTimelinesModalVisible(true)}
        >
          <Edit size={16} color="#7c3aed" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderWeekNavigation = () => {
    if (!selectedTimeline || !weekData) return null;

    const maxWeeks = selectedTimeline.source === 'custom' 
      ? customTimelineWeeks.length 
      : 12;

    return (
      <View style={styles.weekNavigation}>
        <TouchableOpacity
          style={[styles.weekNavButton, selectedWeekNumber <= 1 && styles.weekNavButtonDisabled]}
          onPress={() => handleWeekChange('prev')}
          disabled={selectedWeekNumber <= 1}
        >
          <ChevronLeft size={20} color={selectedWeekNumber <= 1 ? '#9ca3af' : '#0078d4'} />
        </TouchableOpacity>

        <View style={styles.weekInfo}>
          <Text style={styles.weekTitle}>Week {selectedWeekNumber}</Text>
          <Text style={styles.weekDates}>
            {formatDateRange(weekData.startDate, weekData.endDate)}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.weekNavButton, selectedWeekNumber >= maxWeeks && styles.weekNavButtonDisabled]}
          onPress={() => handleWeekChange('next')}
          disabled={selectedWeekNumber >= maxWeeks}
        >
          <ChevronRight size={20} color={selectedWeekNumber >= maxWeeks ? '#9ca3af' : '#0078d4'} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderGoalsList = () => {
    if (!selectedTimeline) return null;

    const timelineGoals = selectedTimeline.source === 'custom' 
      ? customGoals.filter(g => g.custom_timeline_id === selectedTimeline.id)
      : twelveWeekGoals;

    if (timelineGoals.length === 0) {
      return (
        <View style={styles.emptyGoalsContainer}>
          <Target size={48} color="#6b7280" />
          <Text style={styles.emptyGoalsTitle}>No Goals Yet</Text>
          <Text style={styles.emptyGoalsText}>
            Create your first goal for this timeline to start tracking progress
          </Text>
          <TouchableOpacity
            style={styles.createGoalButton}
            onPress={() => setCreateGoalModalVisible(true)}
          >
            <Plus size={20} color="#ffffff" />
            <Text style={styles.createGoalButtonText}>Create Goal</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView style={styles.goalsList}>
        {timelineGoals.map(goal => {
          const progress = goalProgress[goal.id];
          const actions = weekGoalActions[goal.id] || [];

          return (
            <GoalProgressCard
              key={goal.id}
              goal={goal}
              progress={progress}
              expanded={true}
              week={weekData}
              weekActions={actions}
              loadingWeekActions={loadingWeekActions}
              selectedWeekNumber={selectedWeekNumber}
              onAddAction={() => {
                setSelectedGoal(goal as TwelveWeekGoal);
                setActionEffortModalVisible(true);
              }}
              onToggleCompletion={handleToggleCompletion}
              onEdit={() => {
                setEditingGoal(goal as TwelveWeekGoal);
                setEditGoalModalVisible(true);
              }}
            />
          );
        })}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Goal Bank" 
        authenticScore={authenticScore}
        daysRemaining={daysLeftData?.days_left}
        cycleProgressPercentage={daysLeftData?.pct_elapsed}
        cycleTitle={selectedTimeline?.title}
      />

      {renderTimelineSelector()}
      {renderWeekNavigation()}
      {renderGoalsList()}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setCreateGoalModalVisible(true)}
      >
        <Plus size={24} color="#ffffff" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.withdrawalFab} 
        onPress={() => setWithdrawalFormVisible(true)}
      >
        <Text style={styles.withdrawalFabText}>-</Text>
      </TouchableOpacity>

      {/* Modals */}
      <CreateGoalModal
        visible={createGoalModalVisible}
        onClose={() => setCreateGoalModalVisible(false)}
        onSubmitSuccess={() => {
          setCreateGoalModalVisible(false);
          refreshGoals();
        }}
        createTwelveWeekGoal={createTwelveWeekGoal}
        createCustomGoal={createCustomGoal}
        selectedTimeline={selectedTimeline}
      />

      <EditGoalModal
        visible={editGoalModalVisible}
        onClose={() => {
          setEditGoalModalVisible(false);
          setEditingGoal(null);
        }}
        onUpdate={() => {
          setEditGoalModalVisible(false);
          setEditingGoal(null);
          refreshGoals();
        }}
        goal={editingGoal}
      />

      <ActionEffortModal
        visible={actionEffortModalVisible}
        onClose={() => {
          setActionEffortModalVisible(false);
          setSelectedGoal(null);
        }}
        goal={selectedGoal}
        cycleWeeks={cycleWeeks}
        createTaskWithWeekPlan={createTaskWithWeekPlan}
      />

      <CycleSetupModal
        visible={cycleSetupModalVisible}
        onClose={() => setCycleSetupModalVisible(false)}
        onSuccess={() => {
          setCycleSetupModalVisible(false);
          refreshAllData();
        }}
        createCustomTimeline={handleCreateCustomTimeline}
        mode="cycle"
      />

      <ManageCustomTimelinesModal
        visible={customTimelinesModalVisible}
        onClose={() => setCustomTimelinesModalVisible(false)}
        onUpdate={() => {
          fetchCustomTimelines();
          refreshAllData();
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
  timelineSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineOptions: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 12,
  },
  timelineOption: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    minWidth: 200,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  selectedTimelineOption: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0078d4',
  },
  timelineOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  selectedTimelineOptionTitle: {
    color: '#0078d4',
  },
  timelineOptionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  selectedTimelineOptionSubtitle: {
    color: '#0078d4',
  },
  timelineOptionDates: {
    fontSize: 11,
    color: '#9ca3af',
  },
  selectedTimelineOptionDates: {
    color: '#0078d4',
  },
  manageTimelinesButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  noTimelineContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noTimelineTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  noTimelineText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  timelineButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  createTimelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createTimelineButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  createCustomTimelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#7c3aed',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createCustomTimelineButtonText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  weekNavButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  weekNavButtonDisabled: {
    opacity: 0.5,
  },
  weekInfo: {
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  weekDates: {
    fontSize: 12,
    color: '#6b7280',
  },
  goalsList: {
    flex: 1,
    padding: 16,
  },
  emptyGoalsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyGoalsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyGoalsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  createGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  createGoalButtonText: {
    color: '#ffffff',
    fontSize: 16,
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
  withdrawalFab: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  withdrawalFabText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
});