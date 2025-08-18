import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Plus, CreditCard as Edit, UserX, Ban } from 'lucide-react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { Header } from '@/components/Header';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { supabase } from '@/lib/supabase';
import { Task, TaskCard } from '@/components/tasks/TaskCard';

// --- TaskDetailModal Component ---
// Displays detailed information about a task in a modal
function TaskDetailModal({ visible, task, onClose, onUpdate, onDelegate, onCancel }) {
  if (!task) return null;
  
  const [taskNotes, setTaskNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  useEffect(() => {
    if (visible && task?.id) {
      fetchTaskNotes();
    }
  }, [visible, task?.id]);

  const fetchTaskNotes = async () => {
    if (!task?.id) return;
    
    setLoadingNotes(true);
    try {
      const { data, error } = await supabase
        .from('0008-ap-universal-notes-join')
        .select(`
          note:0008-ap-notes(
            id,
            content,
            created_at
          )
        `)
        .eq('parent_id', task.id)
        .eq('parent_type', 'task');

      if (error) throw error;
      
      const notes = data?.map(item => item.note).filter(Boolean) || [];
      setTaskNotes(notes);
    } catch (error) {
      console.error('Error fetching task notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

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
          {taskNotes.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Notes:</Text>
              {loadingNotes ? (
                <Text style={styles.detailValue}>Loading notes...</Text>
              ) : (
                <View style={styles.notesContainer}>
                  {taskNotes.map((note, index) => (
                    <View key={note.id} style={styles.noteItem}>
                      <Text style={styles.noteContent}>{note.content}</Text>
                      <Text style={styles.noteDate}>
                        {new Date(note.created_at).toLocaleDateString('en-US', { 
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric' 
                        })} ({new Date(note.created_at).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit', 
                          hour12: true 
                        })})
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
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
        .not('status', 'in', '(completed,cancelled)');

      if (activeView === 'deposits') {
        taskQuery = taskQuery.in('type', ['task', 'event']).eq('deposit_idea', false);
      } else {
        taskQuery = taskQuery.eq('deposit_idea', true);
      }

      const { data: tasksData, error: tasksError } = await taskQuery;
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
        { data: delegatesData, error: delegatesError }
      ] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds),
        supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0007-ap-domains(id, name)').in('parent_id', taskIds),
        supabase.from('0008-ap-universal-goals-join').select('parent_id, goal:0008-ap-goals-12wk(id, title)').in('parent_id', taskIds),
        supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIds),
        supabase.from('0008-ap-universal-delegates-join').select('parent_id, delegate_id').in('parent_id', taskIds),
      ]);

      if (rolesError) throw rolesError;
      if (domainsError) throw domainsError;
      if (goalsError) throw goalsError;
      if (notesError) throw notesError;
      if (delegatesError) throw delegatesError;

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
    setTimeout(() => setIsFormModalVisible(true), 100); // Small delay to ensure modal transition
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
          : activeView === 'deposits' ? 
            <DraggableFlatList 
              data={tasks} 
              renderItem={renderDraggableItem} 
              keyExtractor={(item) => item.id} 
              onDragEnd={handleDragEnd} 
              contentContainerStyle={styles.taskList} 
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              style={styles.draggableList}
            />
          : <ScrollView 
              style={styles.scrollContent} 
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              contentContainerStyle={styles.scrollContentContainer}
            >
              <View style={styles.taskList}>
                {tasks.map(task => 
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onComplete={handleCompleteTask} 
                    onDoublePress={handleTaskDoublePress} 
                  />
                )}
              </View>
            </ScrollView>
        }
      </View>
      <TouchableOpacity style={styles.fab} onPress={() => setIsFormModalVisible(true)}><Plus size={24} color="#ffffff" /></TouchableOpacity>
      <Modal visible={isFormModalVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode={editingTask ? "edit" : "create"}
          initialData={editingTask || undefined}
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
    draggableList: { flex: 1 },
    scrollContent: { flex: 1 },
    scrollContentContainer: { flexGrow: 1, paddingBottom: 100 },
    taskList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
    draggingItem: { opacity: 0.8, transform: [{ scale: 1.02 }] },
    tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    roleTag: { backgroundColor: '#fce7f3' },
    domainTag: { backgroundColor: '#fed7aa' },
    goalTag: { backgroundColor: '#bfdbfe' },
    tagText: { fontSize: 10, fontWeight: '500', color: '#374151' },
    fab: { position: 'absolute', bottom: 20, right: 20, width: 48, height: 48, borderRadius: 24, backgroundColor: '#0078d4', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
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
    notesContainer: {
      marginTop: 8,
    },
    noteItem: {
      backgroundColor: '#f8fafc',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      borderLeftWidth: 3,
      borderLeftColor: '#0078d4',
    },
    noteContent: {
      fontSize: 14,
      color: '#1f2937',
      lineHeight: 20,
      marginBottom: 4,
    },
    noteDate: {
      fontSize: 12,
      color: '#6b7280',
      fontStyle: 'italic',
    },
});