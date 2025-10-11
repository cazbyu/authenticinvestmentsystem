import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, FlatList, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '@/components/Header';
import { Task, TaskCard } from '@/components/tasks/TaskCard';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { getSupabaseClient } from '@/lib/supabase';
import { X, ArrowUpDown, ArrowLeft } from 'lucide-react-native';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { useGoalProgress } from '@/hooks/useGoalProgress';
import DraggableFlatList from 'react-native-draggable-flatlist';

export default function FollowUpScreen() {
  const router = useRouter();
  const { authenticScore, refreshScore } = useAuthenticScore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortOption, setSortOption] = useState('due_date');
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const { deleteTask } = useGoalProgress();

  useEffect(() => {
    fetchFollowUpTasks();
  }, [sortOption]);

  const fetchFollowUpTasks = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tasksData, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .is('parent_task_id', null)
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .in('type', ['task', 'event']);

      if (tasksError) throw tasksError;
      if (!tasksData || tasksData.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const taskIds = tasksData.map(t => t.id);

      const [
        { data: rolesData, error: rolesError },
        { data: domainsData, error: domainsError },
        { data: goalsData, error: goalsError },
        { data: notesData, error: notesError },
        { data: delegatesData, error: delegatesError },
        { data: keyRelationshipsData, error: keyRelationshipsError }
      ] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-goals-join').select('parent_id, goal_type, twelve_wk_goal:0008-ap-goals-12wk(id, title, status), custom_goal:0008-ap-goals-custom(id, title, status)').in('parent_id', taskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-delegates-join').select('parent_id, delegate_id').in('parent_id', taskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', taskIds).eq('parent_type', 'task')
      ]);

      if (rolesError) throw rolesError;
      if (domainsError) throw domainsError;
      if (goalsError) throw goalsError;
      if (notesError) throw notesError;
      if (delegatesError) throw delegatesError;
      if (keyRelationshipsError) throw keyRelationshipsError;

      const transformedTasks = tasksData.map(task => {
        const taskGoals = goalsData?.filter(g => g.parent_id === task.id).map(g => {
          if (g.goal_type === 'twelve_wk_goal' && g.twelve_wk_goal) {
            const goal = g.twelve_wk_goal;
            if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
              return { id: 'deleted', title: 'Goal no longer available', goal_type: 'deleted', status: 'deleted' };
            }
            return { ...goal, goal_type: '12week' };
          } else if (g.goal_type === 'custom_goal' && g.custom_goal) {
            const goal = g.custom_goal;
            if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
              return { id: 'deleted', title: 'Goal no longer available', goal_type: 'deleted', status: 'deleted' };
            }
            return { ...goal, goal_type: 'custom' };
          }
          return null;
        }).filter(Boolean) || [];

        return {
          ...task,
          roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
          domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
          goals: taskGoals,
          keyRelationships: keyRelationshipsData?.filter(kr => kr.parent_id === task.id).map(kr => kr.key_relationship).filter(Boolean) || [],
          has_notes: notesData?.some(n => n.parent_id === task.id),
          has_delegates: delegatesData?.some(d => d.parent_id === task.id),
          has_attachments: false,
        };
      });

      const followUpTasks = transformedTasks.filter(task => task.has_notes || task.has_delegates);

      let sortedTasks = [...followUpTasks];
      if (sortOption === 'due_date') {
        sortedTasks.sort((a, b) => (new Date(a.due_date || 0).getTime()) - (new Date(b.due_date || 0).getTime()));
      } else if (sortOption === 'roles') {
        sortedTasks.sort((a, b) => (b.roles?.length || 0) - (a.roles?.length || 0));
      } else if (sortOption === 'domains') {
        sortedTasks.sort((a, b) => (b.domains?.length || 0) - (a.domains?.length || 0));
      } else if (sortOption === 'goals') {
        sortedTasks.sort((a, b) => (b.goals?.length || 0) - (a.goals?.length || 0));
      } else if (sortOption === 'delegated') {
        sortedTasks.sort((a, b) => (b.has_delegates ? 1 : 0) - (a.has_delegates ? 1 : 0));
      }

      setTasks(sortedTasks);
      await refreshScore();
    } catch (error) {
      console.error('Error fetching follow up tasks:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to fetch follow up tasks.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (task: Task) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', task.id);

      if (error) throw error;
      setTasks(prevTasks => prevTasks.filter(t => t.id !== task.id));
      await refreshScore(true);
    } catch (error) {
      console.error('Error completing task:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to complete task.');
      fetchFollowUpTasks();
    }
  };

  const handleDeleteTask = async (task: Task) => {
    try {
      setTasks(prevTasks => prevTasks.filter(t => t.id !== task.id));
      await deleteTask(task.id);
    } catch (error) {
      console.error('Error deleting task:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to delete task');
      fetchFollowUpTasks();
    }
  };

  const handleCancelTask = async (task: Task) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('0008-ap-tasks').update({ status: 'cancelled' }).eq('id', task.id);
      if (error) throw error;
      Alert.alert('Success', 'Task has been cancelled');
      setIsDetailModalVisible(false);
      fetchFollowUpTasks();
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to cancel task.');
    }
  };

  const handleTaskDoublePress = (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalVisible(true);
  };

  const handleUpdateTask = (task: Task) => {
    setEditingTask(task);
    setIsDetailModalVisible(false);
    setTimeout(() => setIsFormModalVisible(true), 100);
  };

  const handleDelegateTask = (task: Task) => {
    Alert.alert('Delegate', 'Delegation functionality coming soon!');
    setIsDetailModalVisible(false);
  };

  const handleFormSubmitSuccess = () => {
    setIsFormModalVisible(false);
    setEditingTask(null);
    fetchFollowUpTasks();
  };

  const handleFormClose = () => {
    setIsFormModalVisible(false);
    setEditingTask(null);
  };

  const handleDragEnd = ({ data }: { data: Task[] }) => setTasks(data);

  const sortOptions = [
    { value: 'due_date', label: 'Due Date' },
    { value: 'roles', label: 'Roles' },
    { value: 'domains', label: 'Domains' },
    { value: 'goals', label: 'Goals' },
    { value: 'delegated', label: 'Delegated' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Follow Up</Text>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setIsSortModalVisible(true)}
          >
            <ArrowUpDown size={20} color="#0078d4" />
            <Text style={styles.sortButtonText}>Sort</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Authentic Score</Text>
          <Text style={styles.scoreValue}>{authenticScore}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {loading ? null : tasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tasks requiring follow up</Text>
            <Text style={styles.emptySubtext}>Tasks with notes or delegated to others will appear here</Text>
          </View>
        ) : Platform.OS === 'web' ? (
          <FlatList
            data={tasks}
            renderItem={({ item }) => (
              <TaskCard
                task={item}
                onComplete={handleCompleteTask}
                onDelete={handleDeleteTask}
                onLongPress={() => {}}
                onDoublePress={handleTaskDoublePress}
                isDragging={false}
              />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.taskList}
            showsVerticalScrollIndicator={true}
            style={styles.draggableList}
          />
        ) : (
          <DraggableFlatList
            data={tasks}
            renderItem={({ item, drag, isActive }) => (
              <TaskCard
                task={item}
                onComplete={handleCompleteTask}
                onDelete={handleDeleteTask}
                onLongPress={drag}
                onDoublePress={handleTaskDoublePress}
                isDragging={isActive}
              />
            )}
            keyExtractor={(item) => item.id}
            onDragEnd={handleDragEnd}
            contentContainerStyle={styles.taskList}
            showsVerticalScrollIndicator={true}
            scrollEnabled={true}
            style={styles.draggableList}
          />
        )}
      </View>

      <TaskDetailModal
        visible={isDetailModalVisible}
        task={selectedTask}
        onClose={() => setIsDetailModalVisible(false)}
        onUpdate={handleUpdateTask}
        onDelegate={handleDelegateTask}
        onCancel={handleCancelTask}
      />

      <Modal visible={isFormModalVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode={editingTask ? "edit" : "create"}
          initialData={editingTask || undefined}
          onSubmitSuccess={handleFormSubmitSuccess}
          onClose={handleFormClose}
        />
      </Modal>

      <Modal visible={isSortModalVisible} transparent animationType="fade" onRequestClose={() => setIsSortModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort by</Text>
              <TouchableOpacity onPress={() => setIsSortModalVisible(false)} style={styles.closeButton}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.sortOptionsContainer}>
              {sortOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.sortOption, sortOption === option.value && styles.activeSortOption]}
                  onPress={() => {
                    setSortOption(option.value);
                    setIsSortModalVisible(false);
                  }}
                >
                  <Text style={[styles.sortOptionText, sortOption === option.value && styles.activeSortOptionText]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerContainer: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0078d4',
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
  draggableList: {
    flex: 1,
  },
  taskList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#1f2937',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 20,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  sortOptionsContainer: {
    padding: 8,
  },
  sortOption: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 2,
  },
  activeSortOption: {
    backgroundColor: '#eff6ff',
  },
  sortOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  activeSortOptionText: {
    color: '#0078d4',
    fontWeight: '600',
  },
});
