import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DepositIdeaCard } from '@/components/depositIdeas/DepositIdeaCard';
import { X, Plus, CreditCard as Edit, UserX, Ban } from 'lucide-react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { Header } from '@/components/Header';
import { Task, TaskCard } from '@/components/tasks/TaskCard';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { getSupabaseClient } from '@/lib/supabase';

import { DepositIdeaDetailModal } from '@/components/depositIdeas/DepositIdeaDetailModal';

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
  const [depositIdeas, setDepositIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [authenticScore, setAuthenticScore] = useState(85);

  const fetchData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (activeView === 'deposits') {
        // Fetch tasks/events
        const { data: tasksData, error: tasksError } = await supabase
          .from('0008-ap-tasks')
          .select('*')
          .eq('user_id', user.id)
          .not('status', 'in', '(completed,cancelled)')
          .in('type', ['task', 'event'])

        if (tasksError) throw tasksError;
        if (!tasksData || tasksData.length === 0) {
          setTasks([]);
          setDepositIdeas([]);
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
          supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0007-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-goals-join').select('parent_id, goal:0008-ap-goals-12wk(id, title)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-delegates-join').select('parent_id, delegate_id').in('parent_id', taskIds).eq('parent_type', 'task')
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
        setDepositIdeas([]);

      } else {
        // Fetch deposit ideas
        const { data: depositIdeasData, error: depositIdeasError } = await supabase
          .from('0008-ap-deposit-ideas')
          .select('*')
          .eq('user_id', user.id)
          .eq('archived', false);

        if (depositIdeasError) throw depositIdeasError;
        if (!depositIdeasData || depositIdeasData.length === 0) {
          setDepositIdeas([]);
          setTasks([]);
          setLoading(false);
          return;
        }

        const depositIdeaIds = depositIdeasData.map(di => di.id);

        const [
          { data: rolesData, error: rolesError },
          { data: domainsData, error: domainsError },
          { data: krData, error: krError },
          { data: notesData, error: notesError }
        ] = await Promise.all([
          supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
          supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0007-ap-domains(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
          supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
          supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea')
        ]);

        if (rolesError) throw rolesError;
        if (domainsError) throw domainsError;
        if (krError) throw krError;
        if (notesError) throw notesError;

        const transformedDepositIdeas = depositIdeasData.map(di => ({
          ...di,
          roles: rolesData?.filter(r => r.parent_id === di.id).map(r => r.role).filter(Boolean) || [],
          domains: domainsData?.filter(d => d.parent_id === di.id).map(d => d.domain).filter(Boolean) || [],
          keyRelationships: krData?.filter(kr => kr.parent_id === di.id).map(kr => kr.key_relationship).filter(Boolean) || [],
          has_notes: notesData?.some(n => n.parent_id === di.id),
          has_attachments: false,
        }));

        setDepositIdeas(transformedDepositIdeas);
        setTasks([]);
      }


    } catch (error) {
      console.error(`Error fetching ${activeView}:`, error);
      Alert.alert('Error', (error as Error).message || `Failed to fetch ${activeView}.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeView, sortOption]);

  const handleCompleteTask = async (taskId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('0008-ap-tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId);
      if (error) throw error;
      fetchData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to complete task.');
    }
  };

  const handleCancelTask = async (task: Task) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('0008-ap-tasks').update({ status: 'cancelled' }).eq('id', task.id);
      if (error) throw error;
      Alert.alert('Success', 'Task has been cancelled');
      setIsDetailModalVisible(false);
      fetchData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to cancel task.');
    }
  };

  const handleTaskDoublePress = (task: Task) => { setSelectedTask(task); setIsDetailModalVisible(true); };
  const [selectedDepositIdea, setSelectedDepositIdea] = useState<any>(null);
  const [isDepositIdeaDetailVisible, setIsDepositIdeaDetailVisible] = useState(false);

  const handleDepositIdeaDoublePress = (depositIdea: any) => { 
    setSelectedDepositIdea(depositIdea);
    setIsDepositIdeaDetailVisible(true);
  };
  const handleUpdateDepositIdea = async (depositIdea: any) => {
    // Fetch the latest note for prefilling
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-universal-notes-join')
        .select(`
          note:0008-ap-notes(
            id,
            content,
            created_at
          )
        `)
        .eq('parent_id', depositIdea.id)
        .eq('parent_type', 'depositIdea')
        .order('created_at', { ascending: false, foreignTable: '0008-ap-notes' })
        .limit(1);

      if (error) throw error;

      const latestNote = data?.[0]?.note?.content || '';
      
      const editData = {
        ...depositIdea,
        type: 'depositIdea',
        notes: latestNote
      };
      setEditingTask(editData);
      setIsDepositIdeaDetailVisible(false);
      setIsFormModalVisible(true);
    } catch (error) {
      console.error('Error fetching note for update:', error);
      // Continue with update even if note fetch fails
      const editData = {
        ...depositIdea,
        type: 'depositIdea',
        notes: ''
      };
      setEditingTask(editData);
      setIsDepositIdeaDetailVisible(false);
      setIsFormModalVisible(true);
    }
  };
  const handleCancelDepositIdea = async (depositIdea: any) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-deposit-ideas')
        .update({
          is_active: false,
          archived: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', depositIdea.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to cancel deposit idea.');
    }
  };
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
  const renderDraggableItem = ({ item, drag, isActive }: RenderItemParams<Task>) => <TaskCard task={item} onComplete={handleCompleteTask} onLongPress={drag} onDoublePress={handleTaskDoublePress} isDragging={isActive} />;
  const sortOptions = [{ value: 'due_date', label: 'Due Date' }, { value: 'priority', label: 'Priority' }, { value: 'title', label: 'Title' }];

  return (
    <SafeAreaView style={styles.container}>
      <Header activeView={activeView} onViewChange={setActiveView} onSortPress={() => setIsSortModalVisible(true)} authenticScore={authenticScore} />
      <View style={styles.content}>
        {loading ? <View style={styles.loadingContainer}><Text style={styles.loadingText}>Loading...</Text></View>
          : (activeView === 'deposits' && tasks.length === 0) || (activeView === 'ideas' && depositIdeas.length === 0) ? 
            <View style={styles.emptyContainer}><Text style={styles.emptyText}>No {activeView} found</Text></View>
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
                {depositIdeas.map(depositIdea => 
                  <DepositIdeaCard 
                    key={depositIdea.id} 
                    depositIdea={depositIdea} 
                    onUpdate={handleUpdateDepositIdea}
                    onCancel={handleCancelDepositIdea}
                    onDoublePress={handleDepositIdeaDoublePress} 
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
      <DepositIdeaDetailModal 
        visible={isDepositIdeaDetailVisible} 
        depositIdea={selectedDepositIdea} 
        onClose={() => setIsDepositIdeaDetailVisible(false)} 
        onUpdate={handleUpdateDepositIdea}
        onCancel={handleCancelDepositIdea}
      />
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
    activeSortOptionText: { color: '#0078d4', fontWeight: '600' }
});