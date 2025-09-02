import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { getSupabaseClient } from '@/lib/supabase';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';
import { useGoalProgress } from '@/hooks/useGoalProgress';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { CycleSetupModal } from '@/components/cycles/CycleSetupModal';
import { CreateGoalModal } from '@/components/goals/CreateGoalModal';
import { Plus, Target, Calendar } from 'lucide-react-native';
import { formatDateRange } from '@/lib/dateUtils';

export default function Goals() {
  const [authenticScore, setAuthenticScore] = useState(0);
  const [taskFormVisible, setTaskFormVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [cycleSetupVisible, setCycleSetupVisible] = useState(false);
  const [createGoalModalVisible, setCreateGoalModalVisible] = useState(false);
  const [editingCycle, setEditingCycle] = useState<any>(null);

  // 12-Week Goals
  const { 
    goals: twelveWeekGoals, 
    currentCycle, 
    daysLeftData, 
    goalProgress, 
    loading: goalsLoading, 
    refreshGoals,
    refreshAllData,
    createGoal,
    cycleWeeks,
    selectedWeekNumber,
    setSelectedWeekNumber
  } = useGoalProgress();

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

      // Calculate deposits from completed tasks
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

      // Calculate withdrawals
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

  useEffect(() => {
    calculateAuthenticScore();
    refreshAllData();
  }, []);

  // Auto-refresh days left data at midnight
  useEffect(() => {
    if (!currentCycle) return;

    const updateAtMidnight = () => {
      refreshAllData();
    };

    // Calculate milliseconds until next midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Set timeout for midnight, then interval for every 24 hours
    const midnightTimeout = setTimeout(() => {
      updateAtMidnight();
      const dailyInterval = setInterval(updateAtMidnight, 24 * 60 * 60 * 1000);
      return () => clearInterval(dailyInterval);
    }, msUntilMidnight);

    return () => clearTimeout(midnightTimeout);
  }, [currentCycle, refreshAllData]);

  const handleFormSubmitSuccess = () => {
    setTaskFormVisible(false);
    setEditingTask(null);
    refreshAllData();
  };

  const handleFormClose = () => {
    setTaskFormVisible(false);
    setEditingTask(null);
  };

  const handleCycleCreated = () => {
    setCycleSetupVisible(false);
    setEditingCycle(null);
    refreshAllData();
  };

  const handleCreateGoalSuccess = () => {
    setCreateGoalModalVisible(false);
    refreshAllData();
  };
  const formatCycleDateRange = () => {
    if (!currentCycle?.start_date || !currentCycle?.end_date) return '';
    return formatDateRange(currentCycle.start_date, currentCycle.end_date);
  };

  const calculateCycleProgress = () => {
    if (!currentCycle?.start_date || !currentCycle?.end_date) {
      return { percentage: 0, daysRemaining: 0 };
    }
    const now = new Date();
    const startDate = new Date(currentCycle.start_date);
    const endDate = new Date(currentCycle.end_date);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysPassed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, totalDays - daysPassed);
    const percentage = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));
    return { percentage, daysRemaining };
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Goal Bank" 
        authenticScore={authenticScore}
        daysRemaining={daysLeftData?.days_left}
        cycleProgressPercentage={daysLeftData?.pct_elapsed}
        cycleTitle={currentCycle?.title}
      />
      
      {currentCycle ? (
        <ScrollView style={styles.content}>
          {/* Cycle Header */}
          <View style={styles.cycleHeader}>
            <View style={styles.cycleInfo}>
              <View style={styles.cycleTitleRow}>
                <View style={styles.cycleTitleContent}>
              <Text style={styles.cycleTitle}>
                {currentCycle.title || '12-Week Cycle'}
              </Text>
                </View>
                <TouchableOpacity 
                  style={styles.editCycleButton}
                  onPress={() => {
                    setEditingCycle(currentCycle);
                    setCycleSetupVisible(true);
                  }}
                >
                  <Text style={styles.editCycleButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.cycleDates}>
                {formatCycleDateRange()}
              </Text>
              {currentCycle.week_start_day && (
                <Text style={styles.weekStartInfo}>
                  Weeks start on {currentCycle.week_start_day === 'sunday' ? 'Sunday' : 'Monday'}
                </Text>
              )}
            </View>
            
            <View style={styles.cycleProgress}>
              <Text style={styles.cycleProgressLabel}>
                {calculateCycleProgress().daysRemaining} days left
              </Text>
              <View style={styles.cycleProgressBar}>
                <View
                  style={[
                    styles.cycleProgressFill,
                    { width: `${calculateCycleProgress().percentage}%` }
                  ]}
                />
              </View>
            </View>

{/* Week Navigator */}
<View style={{ marginTop: 8, marginBottom: 12 }}>
  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    {cycleWeeks.map(w => (
      <TouchableOpacity
        key={w.week_number}
        onPress={() => setSelectedWeekNumber(w.week_number)}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 20,
          marginRight: 8,
          backgroundColor: selectedWeekNumber === w.week_number ? '#0078d4' : '#e5e7eb'
        }}
      >
        <Text style={{ 
          color: selectedWeekNumber === w.week_number ? 'white' : '#111827',
          fontWeight: '600'
        }}>
          {`W${w.week_number}`}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
</View>
            
            {/* Goals List */}
{goalsLoading ? (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="small" color="#1f6feb" />
  </View>
) : twelveWeekGoals.length === 0 ? (
    <View style={styles.emptyContainer}>
    <Text style={styles.emptyTitle}>No 12-Week Goals Yet</Text>
    <Text style={styles.emptyText}>
      Create your first 12-week goal to start tracking this cycle.
    </Text>

    <TouchableOpacity
      style={styles.createGoalButton}
      onPress={() => setCreateGoalModalVisible(true)}
    >
      <Plus color="#ffffff" />
      <Text style={styles.createGoalButtonText}>Create First Goal</Text>
    </TouchableOpacity>
  </View>
) : (
  <View style={styles.goalsList}>
    {twelveWeekGoals.map(goal => {
      const progress = goalProgress[goal.id];
      if (!progress) return null;

      return (
        <GoalProgressCard
          key={goal.id}
          goal={goal}
          progress={progress}
          onAddTask={() => {
  // Prefill the task form with the goal + selected week date window
  const wk = cycleWeeks?.find(w => w.week_number === selectedWeekNumber);
  setEditingTask({
    type: 'task',
    selectedGoalIds: [goal.id],
    twelveWeekGoalChecked: true,
    countsTowardWeeklyProgress: true,
    selectedRoleIds: goal.roles?.map(r => r.id) || [],
    selectedDomainIds: goal.domains?.map(d => d.id) || [],
    selectedKeyRelationshipIds: goal.keyRelationships?.map(kr => kr.id) || [],
    // helpful defaults for the form:
    due_date: wk?.start_date ?? undefined,
    end_date: wk?.end_date ?? undefined,
  } as any);
  setTaskFormVisible(true);
}}
        />
      );
    })}
  </View>
)}
          </View>

                </ScrollView>
      ) : (
        <View style={styles.noCycleContainer}>
          <Target size={64} color="#6b7280" />
          <Text style={styles.noCycleTitle}>Start Your 12-Week Journey</Text>
          <Text style={styles.noCycleText}>
            Create a custom 12-week cycle or sync with the community to begin tracking your authentic investments and achieving your goals.
          </Text>
          <TouchableOpacity 
            style={styles.startCycleButton}
            onPress={() => setCycleSetupVisible(true)}
          >
            <Calendar size={20} color="#ffffff" />
            <Text style={styles.startCycleButtonText}>Start 12-Week Cycle</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => {
          setCreateGoalModalVisible(true);
        }}
      >
        <Plus size={24} color="#ffffff" />
      </TouchableOpacity>

      {/* Task Form Modal */}
      <Modal visible={taskFormVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode={editingTask?.id ? "edit" : "create"}
          initialData={editingTask || undefined}
          onSubmitSuccess={handleFormSubmitSuccess}
          onClose={handleFormClose}
        />
      </Modal>

      {/* Cycle Setup Modal */}
      <CycleSetupModal
        visible={cycleSetupVisible}
        onClose={() => setCycleSetupVisible(false)}
        onSuccess={handleCycleCreated}
        initialData={editingCycle}
      />

      {/* Create Goal Modal */}
      <CreateGoalModal
        visible={createGoalModalVisible}
        onClose={() => setCreateGoalModalVisible(false)}
        onSubmitSuccess={handleCreateGoalSuccess}
        createGoal={createGoal}
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
  cycleHeader: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cycleInfo: {
    marginBottom: 12,
  },
  cycleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cycleTitleContent: {
    flex: 1,
  },
  cycleTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  editCycleButton: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0078d4',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editCycleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0078d4',
  },
  cycleDates: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  weekStartInfo: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  cycleProgress: {
    alignItems: 'center',
  },
  cycleProgressLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
  },
  cycleProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  cycleProgressFill: {
    height: '100%',
    backgroundColor: '#0078d4',
    borderRadius: 4,
  },
  goalsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
    marginTop: 12,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 16,
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
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  createGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createGoalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  noCycleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noCycleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  noCycleText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  startCycleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  startCycleButtonText: {
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
});