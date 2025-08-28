import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { getSupabaseClient } from '@/lib/supabase';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';
import { useGoalProgress } from '@/hooks/useGoalProgress';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { Plus, Target, Calendar } from 'lucide-react-native';

export default function Goals() {
  const [authenticScore, setAuthenticScore] = useState(0);
  const [taskFormVisible, setTaskFormVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);

  // 12-Week Goals
  const { goals: twelveWeekGoals, currentCycle, goalProgress, loading: goalsLoading, refreshGoals } = useGoalProgress();

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
    refreshGoals();
  }, []);

  const handleFormSubmitSuccess = () => {
    setTaskFormVisible(false);
    setEditingTask(null);
    refreshGoals();
  };

  const handleFormClose = () => {
    setTaskFormVisible(false);
    setEditingTask(null);
  };

  const formatCycleDateRange = () => {
    if (!currentCycle?.start_date || !currentCycle?.end_date) return '';
    const startDate = new Date(currentCycle.start_date);
    const endDate = new Date(currentCycle.end_date);
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
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
      />
      
      {currentCycle ? (
        <ScrollView style={styles.content}>
          {/* Cycle Header */}
          <View style={styles.cycleHeader}>
            <View style={styles.cycleInfo}>
              <Text style={styles.cycleTitle}>
                {currentCycle.title || '12-Week Cycle'}
              </Text>
              <Text style={styles.cycleDates}>
                {formatCycleDateRange()}
              </Text>
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
          </View>

          {/* Goals List */}
          {goalsLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading goals...</Text>
            </View>
          ) : twelveWeekGoals.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Target size={48} color="#6b7280" />
              <Text style={styles.emptyTitle}>No 12-Week Goals Yet</Text>
              <Text style={styles.emptyText}>
                Create your first 12-week goal to start tracking your progress with leading and lagging indicators.
              </Text>
              <TouchableOpacity 
                style={styles.createGoalButton}
                onPress={() => {
                  setEditingTask({
                    type: 'goal',
                    twelveWeekGoalChecked: true,
                  } as any);
                  setTaskFormVisible(true);
                }}
              >
                <Plus size={20} color="#ffffff" />
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
                      setEditingTask({
                        type: 'task',
                        selectedGoalIds: [goal.id],
                        twelveWeekGoalChecked: true,
                        countsTowardWeeklyProgress: true,
                        selectedRoleIds: goal.roles?.map(r => r.id) || [],
                        selectedDomainIds: goal.domains?.map(d => d.id) || [],
                        selectedKeyRelationshipIds: goal.keyRelationships?.map(kr => kr.id) || [],
                      } as any);
                      setTaskFormVisible(true);
                    }}
                  />
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.noCycleContainer}>
          <Calendar size={48} color="#6b7280" />
          <Text style={styles.noCycleTitle}>No Active Cycle</Text>
          <Text style={styles.noCycleText}>
            There's no active 12-week cycle currently running. Goals will be available when a cycle is active.
          </Text>
        </View>
      )}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => {
          setEditingTask({
            type: 'task',
            twelveWeekGoalChecked: true,
            countsTowardWeeklyProgress: true,
          } as any);
          setTaskFormVisible(true);
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
  cycleTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  cycleDates: {
    fontSize: 14,
    color: '#6b7280',
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
    padding: 16,
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