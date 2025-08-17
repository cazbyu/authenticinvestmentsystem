import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Rocket, X, FileText, Paperclip, Users, Plus, CreditCard as Edit, UserX, Ban } from 'lucide-react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { Header } from '@/components/Header';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { supabase } from '@/lib/supabase';

// Interface for a Task
interface Task {
  id: string;
  title: string;
  due_date?: string;
  start_time?: string;
  end_time?: string;
  is_urgent?: boolean;
  is_important?: boolean;
  status?: string;
  type?: string;
  is_authentic_deposit?: boolean;
  is_twelve_week_goal?: boolean;
  roles?: Array<{id: string; label: string}>;
  domains?: Array<{id: string; name: string}>;
  goals?: Array<{id: string; title: string}>;
  has_notes?: boolean;
  has_attachments?: boolean;
  has_delegates?: boolean;
}

// Props for the TaskCard component
interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onLongPress?: () => void;
  onDoublePress?: (task: Task) => void;
}

// --- TaskCard Component ---
// Renders a single task item in the list
function TaskCard({ task, onComplete, onLongPress, onDoublePress }: TaskCardProps) {
  const [lastTap, setLastTap] = useState(0);
  const celebrationAnim = new Animated.Value(0);
  const pointsAnim = new Animated.Value(0);

  // Determines the border color based on task priority
  const getBorderColor = () => {
    if (task.status === "completed") return "#3b82f6";
    if (task.is_urgent && task.is_important) return "#ef4444";
    if (!task.is_urgent && task.is_important) return "#22c55e";
    if (task.is_urgent && !task.is_important) return "#eab308";
    return "#9ca3af";
  };

  // Calculates points for completing a task
  const calculatePoints = () => {
    let points = 0;
    if (task.roles && task.roles.length > 0) points += task.roles.length;
    if (task.domains && task.domains.length > 0) points += task.domains.length;
    if (task.is_authentic_deposit) points += 2;
    if (task.is_urgent && task.is_important) points += 1.5;
    else if (!task.is_urgent && task.is_important) points += 3;
    else if (task.is_urgent && !task.is_important) points += 1;
    else points += 0.5;
    if (task.is_twelve_week_goal) points += 2;
    return Math.round(points * 10) / 10;
  };

  // Formats the due date string
  const formatDueDate = (date?: string) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  // Handles single and double tap gestures
  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
      onDoublePress?.(task);
    } else {
      setLastTap(now);
    }
  };

  // Triggers celebration animation on task completion
  const triggerCelebration = () => {
    celebrationAnim.setValue(0);
    pointsAnim.setValue(0);
    Animated.parallel([
      Animated.timing(celebrationAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(pointsAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(pointsAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  };

  // Handles the completion of a task
  const handleComplete = () => {
    triggerCelebration();
    setTimeout(() => {
      onComplete(task.id);
    }, 1000);
  };

  const points = calculatePoints();

  return (
    <TouchableOpacity
      style={[styles.taskCard, { borderLeftColor: getBorderColor() }]}
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={200}
    >
      <View style={styles.taskContent}>
        <View style={styles.taskHeader}>
          <Text style={styles.taskTitle} numberOfLines={2}>
            {task.title}
            {task.due_date && <Text style={styles.dueDate}> ({formatDueDate(task.due_date)})</Text>}
          </Text>
        </View>
        <View style={styles.taskBody}>
          <View style={styles.leftSection}>
            {task.roles && task.roles.length > 0 && (
              <View style={styles.tagSection}><Text style={styles.tagSectionLabel}>Roles:</Text><View style={styles.tagContainer}>{task.roles.map((role) => (<View key={role.id} style={[styles.tag, styles.roleTag]}><Text style={styles.tagText}>{role.label}</Text></View>))}</View></View>
            )}
          </View>
          <View style={styles.middleSection}>
            {task.domains && task.domains.length > 0 && (
              <View style={styles.tagSection}><Text style={styles.tagSectionLabel}>Domains:</Text><View style={styles.tagContainer}>{task.domains.map((domain) => (<View key={domain.id} style={[styles.tag, styles.domainTag]}><Text style={styles.tagText}>{domain.name}</Text></View>))}</View></View>
            )}
            {task.goals && task.goals.length > 0 && (
              <View style={styles.tagSection}><Text style={styles.tagSectionLabel}>Goals:</Text><View style={styles.tagContainer}>{task.goals.map((goal) => (<View key={goal.id} style={[styles.tag, styles.goalTag]}><Text style={styles.tagText}>{goal.title}</Text></View>))}</View></View>
            )}
          </View>
          <View style={styles.iconsSection}>
            <View style={styles.statusIcons}>
              {task.has_notes && <FileText size={12} color="#6b7280" />}
              {task.has_attachments && <Paperclip size={12} color="#6b7280" />}
              {task.has_delegates && <Users size={12} color="#6b7280" />}
            </View>
          </View>
        </View>
      </View>
      <View style={styles.taskActions}>
        <Text style={styles.scoreText}>+{points}</Text>
        <TouchableOpacity style={styles.completeButton} onPress={handleComplete}><Rocket size={18} color="#0078d4" /></TouchableOpacity>
      </View>
      <Animated.View style={[styles.celebrationOverlay, { opacity: celebrationAnim, transform: [{ scale: celebrationAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.2, 1] }) }] }]} pointerEvents="none"><Text style={styles.celebrationText}>🎉 ⭐ 🎊</Text></Animated.View>
      <Animated.View style={[styles.pointsAnimation, { opacity: pointsAnim, transform: [{ translateY: pointsAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -50] }) }] }]} pointerEvents="none"><Text style={styles.pointsAnimationText}>+{points}</Text></Animated.View>
    </TouchableOpacity>
  );
}

// --- TaskDetailModal Component ---
// Displays detailed information about a task in a modal
function TaskDetailModal({ visible, task, onClose, onUpdate, onDelegate, onCancel }) {
  if (!task) return null;
  const formatDateTime = (dateTime) => dateTime ? new Date(dateTime).toLocaleString() : 'Not set';
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.detailContainer}>
        <View style={styles.detailHeader}><Text style={styles.detailTitle}>Task Details</Text><TouchableOpacity onPress={onClose}><X size={24} color="#1f2937" /></TouchableOpacity></View>
        <ScrollView style={styles.detailContent}>
          <Text style={styles.detailTaskTitle}>{task.title}</Text>
          <View style={styles.detailSection}><Text style={styles.detailLabel}>Due Date:</Text><Text style={styles.detailValue}>{formatDateTime(task.due_date)}</Text></View>
          {task.start_time && <View style={styles.detailSection}><Text style={styles.detailLabel}>Start Time:</Text><Text style={styles.detailValue}>{formatDateTime(task.start_time)}</Text></View>}
          {task.end_time && <View style={styles.detailSection}><Text style={styles.detailLabel}>End Time:</Text><Text style={styles.detailValue}>{formatDateTime(task.end_time)}</Text></View>}
          <View style={styles.detailSection}><Text style={styles.detailLabel}>Priority:</Text><Text style={styles.detailValue}>{task.is_urgent && task.is_important ? 'Urgent & Important' : !task.is_urgent && task.is_important ? 'Important' : task.is_urgent && !task.is_important ? 'Urgent' : 'Normal'}</Text></View>
          {task.roles?.length > 0 && <View style={styles.detailSection}><Text style={styles.detailLabel}>Roles:</Text><View style={styles.detailTagContainer}>{task.roles.map(role => <View key={role.id} style={[styles.tag, styles.roleTag]}><Text style={styles.tagText}>{role.label}</Text></View>)}</View></View>}
          {task.domains?.length > 0 && <View style={styles.detailSection}><Text style={styles.detailLabel}>Domains:</Text><View style={styles.detailTagContainer}>{task.domains.map(domain => <View key={domain.id} style={[styles.tag, styles.domainTag]}><Text style={styles.tagText}>{domain.name}</Text></View>)}</View></View>}
          {task.goals?.length > 0 && <View style={styles.detailSection}><Text style={styles.detailLabel}>Goals:</Text><View style={styles.detailTagContainer}>{task.goals.map(goal => <View key={goal.id} style={[styles.tag, styles.goalTag]}><Text style={styles.tagText}>{goal.title}</Text></View>)}</View></View>}
        </ScrollView>
        <View style={styles.detailActions}>
          <TouchableOpacity style={[styles.detailButton, styles.updateButton]} onPress={() => onUpdate(task)}><Edit size={16} color="#ffffff" /><Text style={styles.detailButtonText}>Update</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.detailButton, styles.delegateButton]} onPress={() => onDelegate(task)}><UserX size={16} color="#ffffff" /><Text style={styles.detailButtonText}>Delegate</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.detailButton, styles.cancelButton]} onPress={() => onCancel(task)}><Ban size={16} color="#ffffff" /><Text style={styles.detailButtonText}>Cancel</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// --- Main Dashboard Screen Component ---
export default function Dashboard() {
  const [activeView, setActiveView] = useState<'deposits' | 'ideas'>('deposits');
  const [sortOption, setSortOption] = useState('due_date');
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [authenticScore, setAuthenticScore] = useState(85);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let taskQuery = supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'completed')
        .neq('status', 'cancelled');

      if (activeView === 'deposits') {
        taskQuery = taskQuery.in('type', ['task', 'event']);
      } else {
        taskQuery = taskQuery.eq('type', 'depositIdea');
      }

      const { data: tasksData, error: tasksError } = await taskQuery;
      if (tasksError) throw tasksError;
      if (!tasksData) {
        setTasks([]);
        return;
      }

      const taskIds = tasksData.map(t => t.id);

      const [
        { data: rolesData },
        { data: domainsData },
        { data: goalsData },
        { data: notesData },
        { data: delegatesData }
      ] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds),
        supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0007-ap-domains(id, name)').in('parent_id', taskIds),
        supabase.from('0008-ap-universal-goals-join').select('parent_id, goal:0008-ap-goals-12wk(id, title)').in('parent_id', taskIds),
        supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIds),
        supabase.from('0008-ap-universal-delegates-join').select('parent_id, delegate_id').in('parent_id', taskIds),
      ]);

      const transformedTasks = tasksData.map(task => {
        return {
          ...task,
          roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
          domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
          goals: goalsData?.filter(g => g.parent_id === task.id).map(g => g.goal).filter(Boolean) || [],
          has_notes: notesData?.some(n => n.parent_id === task.id),
          has_delegates: delegatesData?.some(d => d.parent_id === task.id),
          has_attachments: false,
        };
      });

      let sortedTasks = [...transformedTasks];
      if (sortOption === 'due_date') sortedTasks.sort((a, b) => (new Date(a.due_date).getTime() || 0) - (new Date(b.due_date).getTime() || 0));
      else if (sortOption === 'priority') sortedTasks.sort((a, b) => ((b.is_urgent ? 2 : 0) + (b.is_important ? 1 : 0)) - ((a.is_urgent ? 2 : 0) + (a.is_important ? 1 : 0)));
      else if (sortOption === 'title') sortedTasks.sort((a, b) => a.title.localeCompare(b.title));

      setTasks(sortedTasks);

    } catch (error) {
      console.error(`Error fetching ${activeView}:`, error);
      Alert.alert('Error', `Failed to fetch ${activeView}.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeView, sortOption]);

  const handleCompleteTask = async (taskId: string) => {
    const { error } = await supabase.from('0008-ap-tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId);
    if (error) Alert.alert('Error', 'Failed to complete task.');
    else fetchData();
  };

  const handleCancelTask = async (task: Task) => {
    const { error } = await supabase.from('0008-ap-tasks').update({ status: 'cancelled' }).eq('id', task.id);
    if (error) Alert.alert('Error', 'Failed to cancel task.');
    else {
      Alert.alert('Success', 'Task has been cancelled');
      setIsDetailModalVisible(false);
      fetchData();
    }
  };

  const handleTaskDoublePress = (task: Task) => { setSelectedTask(task); setIsDetailModalVisible(true); };
  const handleUpdateTask = (task: Task) => {
    setEditingTask(task);
    setIsDetailModalVisible(false);
    setIsFormModalVisible(true);
  };
  const handleDelegateTask = (task: Task) => { Alert.alert('Delegate', 'Delegation functionality coming soon!'); setIsDetailModalVisible(false); };
  const handleFormSubmitSuccess = () => {
    setIsFormModalVisible(false);
    setEditingTask(null);
    fetchData();
  };
  const handleFormClose = () => {
    setIsFormModalVisible(false);
    setEditingTask(null);
  };
  const handleDragEnd = ({ data }: { data: Task[] }) => setTasks(data);
  const renderDraggableItem = ({ item, drag, isActive }: RenderItemParams<Task>) => <View style={[isActive && styles.draggingItem]}><TaskCard task={item} onComplete={handleCompleteTask} onLongPress={drag} onDoublePress={handleTaskDoublePress} /></View>;
  const sortOptions = [{ value: 'due_date', label: 'Due Date' }, { value: 'priority', label: 'Priority' }, { value: 'title', label: 'Title' }];

  return (
    <SafeAreaView style={styles.container}>
      <Header activeView={activeView} onViewChange={setActiveView} onSortPress={() => setIsSortModalVisible(true)} authenticScore={authenticScore} />
      <View style={styles.content}>
        {loading ? <View style={styles.loadingContainer}><Text style={styles.loadingText}>Loading...</Text></View>
          : tasks.length === 0 ? <View style={styles.emptyContainer}><Text style={styles.emptyText}>No {activeView} found</Text></View>
          : activeView === 'deposits' ? <DraggableFlatList data={tasks} renderItem={renderDraggableItem} keyExtractor={(item) => item.id} onDragEnd={handleDragEnd} contentContainerStyle={styles.taskList} showsVerticalScrollIndicator={false} />
          : <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}><View style={styles.taskList}>{tasks.map(task => <TaskCard key={task.id} task={task} onComplete={handleCompleteTask} onDoublePress={handleTaskDoublePress} />)}</View></ScrollView>
        }
      </View>
      <TouchableOpacity style={styles.fab} onPress={() => setIsFormModalVisible(true)}><Plus size={24} color="#ffffff" /></TouchableOpacity>
      <Modal visible={isFormModalVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode={editingTask ? "edit" : "create"}
          initialData={editingTask}
          onSubmitSuccess={handleFormSubmitSuccess}
          onClose={handleFormClose}
        />
      </Modal>
      <TaskDetailModal visible={isDetailModalVisible} task={selectedTask} onClose={() => setIsDetailModalVisible(false)} onUpdate={handleUpdateTask} onDelegate={handleDelegateTask} onCancel={handleCancelTask} />
      <Modal visible={isSortModalVisible} transparent animationType="fade" onRequestClose={() => setIsSortModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Sort by</Text><TouchableOpacity onPress={() => setIsSortModalVisible(false)} style={styles.closeButton}><X size={20} color="#6b7280" /></TouchableOpacity></View>
            <View style={styles.sortOptions}>{sortOptions.map(option => <TouchableOpacity key={option.value} style={[styles.sortOption, sortOption === option.value && styles.activeSortOption]} onPress={() => { setSortOption(option.value); setIsSortModalVisible(false); }}><Text style={[styles.sortOptionText, sortOption === option.value && styles.activeSortOptionText]}>{option.label}</Text></TouchableOpacity>)}</View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1 },
  scrollContent: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  taskList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  draggingItem: { opacity: 0.8, transform: [{ scale: 1.02 }] },
  taskCard: { backgroundColor: '#ffffff', borderRadius: 8, borderLeftWidth: 4, marginBottom: 12, padding: 16, flexDirection: 'row', alignItems: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, position: 'relative' },
  taskContent: { flex: 1, marginRight: 8 },
  taskHeader: { marginBottom: 8 },
  taskTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937', lineHeight: 22 },
  dueDate: { fontSize: 14, color: '#6b7280', fontWeight: '400' },
  taskBody: { flexDirection: 'row', marginBottom: 4 },
  leftSection: { flex: 1, marginRight: 8 },
  middleSection: { flex: 1, marginRight: 8 },
  iconsSection: { width: 30, justifyContent: 'flex-start', alignItems: 'center' },
  tagSection: { marginBottom: 4 },
  tagSectionLabel: { fontSize: 10, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  roleTag: { backgroundColor: '#fce7f3' },
  domainTag: { backgroundColor: '#fed7aa' },
  goalTag: { backgroundColor: '#bfdbfe' },
  tagText: { fontSize: 10, fontWeight: '500', color: '#374151' },
  statusIcons: { flexDirection: 'column', alignItems: 'center', gap: 2 },
  taskActions: { alignItems: 'center', gap: 8 },
  scoreText: { fontSize: 14, fontWeight: '600', color: '#0078d4' },
  celebrationOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 8 },
  celebrationText: { fontSize: 24 },
  pointsAnimation: { position: 'absolute', top: '50%', right: 20, justifyContent: 'center', alignItems: 'center' },
  pointsAnimationText: { fontSize: 18, fontWeight: 'bold', color: '#16a34a' },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0078d4', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: '#6b7280', fontSize: 16 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#6b7280', fontSize: 16, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 12, margin: 20, minWidth: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  closeButton: { padding: 4 },
  sortOptions: { padding: 8 },
  sortOption: { padding: 12, borderRadius: 8, marginVertical: 2 },
  activeSortOption: { backgroundColor: '#eff6ff' },
  sortOptionText: { fontSize: 14, color: '#374151' },
  activeSortOptionText: { color: '#0078d4', fontWeight: '600' },
  detailContainer: { flex: 1, backgroundColor: '#f8fafc' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#ffffff' },
  detailTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  detailContent: { flex: 1, padding: 16 },
  detailTaskTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 20 },
  detailSection: { marginBottom: 16 },
  detailLabel: { fontSize: 14, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  detailValue: { fontSize: 16, color: '#1f2937' },
  detailTagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  detailActions: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#ffffff' },
  detailButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, gap: 6 },
  updateButton: { backgroundColor: '#0078d4' },
  delegateButton: { backgroundColor: '#7c3aed' },
  cancelButton: { backgroundColor: '#dc2626' },
  detailButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});