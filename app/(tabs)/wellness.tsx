import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { TaskCard, Task } from '@/components/tasks/TaskCard';
import { DepositIdeaCard } from '@/components/depositIdeas/DepositIdeaCard';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import { DepositIdeaDetailModal } from '@/components/depositIdeas/DepositIdeaDetailModal';
import { JournalView } from '@/components/journal/JournalView';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { getSupabaseClient } from '@/lib/supabase';
import { Plus, Heart, CreditCard as Edit, UserX, Ban } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';
import { useGoalProgress } from '@/hooks/useGoalProgress';

type DrawerNavigation = DrawerNavigationProp<any>;

interface Domain {
  id: string;
  name: string;
  description?: string;
}

export default function Wellness() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [depositIdeas, setDepositIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'deposits' | 'ideas' | 'journal' | 'analytics'>('deposits');
  
  // Modal states
  const [taskFormVisible, setTaskFormVisible] = useState(false);
  const [taskDetailVisible, setTaskDetailVisible] = useState(false);
  const [depositIdeaDetailVisible, setDepositIdeaDetailVisible] = useState(false);
  
  // Selected items
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDepositIdea, setSelectedDepositIdea] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [authenticScore, setAuthenticScore] = useState(0);

  // 12-Week Goals for selected domain
  const { 
    goals: twelveWeekGoals, 
    goalProgress, 
    loading: goalsLoading, 
    refreshGoals 
  } = useGoalProgress({
    scope: selectedDomain ? { type: 'domain', id: selectedDomain.id } : undefined
  });

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

  const fetchDomains = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-domains')
        .select('*')
        .order('name');

      if (error) throw error;
      setDomains(data || []);
      await calculateAuthenticScore();
    } catch (error) {
      console.error('Error fetching domains:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const fetchDomainTasks = async (domainId: string, view: 'deposits' | 'ideas' = activeView) => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (view === 'deposits') {
        // Fetch all tasks/events for this user first
        const { data: tasksData, error: tasksError } = await supabase
          .from('0008-ap-tasks')
          .select('*')
          .eq('user_id', user.id)
          .not('status', 'in', '(completed,cancelled)')
          .in('type', ['task', 'event']);

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
          { data: delegatesData, error: delegatesError },
          { data: keyRelationshipsData, error: keyRelationshipsError }
        ] = await Promise.all([
          supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-goals-join').select('parent_id, goal:0008-ap-goals-12wk(id, title)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', taskIds).eq('parent_type', 'task')
        ]);

        if (rolesError) throw rolesError;
        if (domainsError) throw domainsError;
        if (goalsError) throw goalsError;
        if (notesError) throw notesError;
        if (delegatesError) throw delegatesError;
        if (keyRelationshipsError) throw keyRelationshipsError;

        // Filter tasks that have the selected domain
        const domainTaskIds = domainsData?.filter(d => d.domain?.id === domainId).map(d => d.parent_id) || [];
        const filteredTasks = tasksData.filter(task => domainTaskIds.includes(task.id));

        const transformedTasks = filteredTasks.map(task => ({
          ...task,
          roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
          domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
          goals: goalsData?.filter(g => g.parent_id === task.id).map(g => g.goal).filter(Boolean) || [],
          keyRelationships: keyRelationshipsData?.filter(kr => kr.parent_id === task.id).map(kr => kr.key_relationship).filter(Boolean) || [],
          has_notes: notesData?.some(n => n.parent_id === task.id),
          has_delegates: delegatesData?.some(d => d.parent_id === task.id),
          has_attachments: false,
        }));

        setTasks(transformedTasks);
        setDepositIdeas([]);

      } else {
        // Fetch all deposit ideas for this user first
        const { data: depositIdeasData, error: depositIdeasError } = await supabase
          .from('0008-ap-deposit-ideas')
          .select('*')
          .eq('user_id', user.id)
          .eq('archived', false)
          .is('activated_task_id', null);

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
          supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
          supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
          supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea')
        ]);

        if (rolesError) throw rolesError;
        if (domainsError) throw domainsError;
        if (krError) throw krError;
        if (notesError) throw notesError;

        // Filter deposit ideas that have the selected domain
        const domainDepositIdeaIds = domainsData?.filter(d => d.domain?.id === domainId).map(d => d.parent_id) || [];
        const filteredDepositIdeas = depositIdeasData.filter(di => domainDepositIdeaIds.includes(di.id));

        const transformedDepositIdeas = filteredDepositIdeas.map(di => ({
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
      console.error(`Error fetching domain ${view}:`, error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  useEffect(() => {
    if (selectedDomain && (activeView === 'deposits' || activeView === 'ideas')) {
      fetchDomainTasks(selectedDomain.id, activeView);
    }
  }, [selectedDomain, activeView]);

  const handleViewChange = (view: 'deposits' | 'ideas' | 'journal' | 'analytics') => {
    setActiveView(view);
    if (selectedDomain && (view === 'deposits' || view === 'ideas')) {
      fetchDomainTasks(selectedDomain.id, view);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;
      
      if (selectedDomain) {
        fetchDomainTasks(selectedDomain.id, activeView);
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleUpdateDepositIdea = async (depositIdea: any) => {
    const editData = {
      ...depositIdea,
      type: 'depositIdea'
    };
    setEditingTask(editData);
    setDepositIdeaDetailVisible(false);
    setTaskFormVisible(true);
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
      
      if (selectedDomain) {
        fetchDomainTasks(selectedDomain.id, activeView);
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleTaskDoublePress = (task: Task) => {
    setSelectedTask(task);
    setTaskDetailVisible(true);
  };

  const handleDepositIdeaDoublePress = (depositIdea: any) => {
    setSelectedDepositIdea(depositIdea);
    setDepositIdeaDetailVisible(true);
  };

  const handleUpdateTask = (task: Task) => {
    setEditingTask(task);
    setTaskDetailVisible(false);
    setTimeout(() => setTaskFormVisible(true), 100);
  };

  const handleDelegateTask = (task: Task) => {
    Alert.alert('Delegate', 'Delegation functionality coming soon!');
    setTaskDetailVisible(false);
  };

  const handleCancelTask = async (task: Task) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ status: 'cancelled' })
        .eq('id', task.id);

      if (error) throw error;
      Alert.alert('Success', 'Task has been cancelled');
      setTaskDetailVisible(false);
      
      if (selectedDomain) {
        fetchDomainTasks(selectedDomain.id, activeView);
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleFormSubmitSuccess = () => {
    setTaskFormVisible(false);
    setEditingTask(null);
    if (selectedDomain) {
      fetchDomainTasks(selectedDomain.id, activeView);
    }
    refreshGoals();
  };

  const handleFormClose = () => {
    setTaskFormVisible(false);
    setEditingTask(null);
  };

  const handleDomainPress = (domain: Domain) => {
    setSelectedDomain(domain);
  };

  const handleJournalEntryPress = (entry: any) => {
    if (entry.source_type === 'task') {
      setSelectedTask(entry.source_data);
      setTaskDetailVisible(true);
    } else if (entry.source_type === 'withdrawal') {
      // Open TaskEventForm in withdrawal mode for editing
      const editData = {
        ...entry.source_data,
        type: 'withdrawal'
      };
      setEditingTask(editData);
      setTaskFormVisible(true);
    }
  };

  const getDomainColor = (domainName: string) => {
    const colors = {
      'Community': '#7c3aed',
      'Financial': '#059669',
      'Physical': '#16a34a',
      'Social': '#0078d4',
      'Emotional': '#dc2626',
      'Intellectual': '#0891b2',
      'Recreational': '#ea580c',
      'Spiritual': '#7c3aed',
    };
    return colors[domainName] || '#6b7280';
  };

  const renderContent = () => {
    if (selectedDomain) {
      // Domain view
      return (
        <View style={styles.content}>
          <Header
            title={selectedDomain.name}
            activeView={activeView}
            onViewChange={handleViewChange}
            authenticScore={authenticScore}
            backgroundColor={getDomainColor(selectedDomain.name)}
            onBackPress={() => setSelectedDomain(null)}
          />

          {/* 12-Week Goals Section */}
          {activeView === 'deposits' && twelveWeekGoals.length > 0 && (
            <View style={styles.goalsSection}>
              <Text style={styles.goalsSectionTitle}>12-Week Goals</Text>
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
                          selectedDomainIds: [selectedDomain.id],
                        } as any);
                        setTaskFormVisible(true);
                      }}
                    />
                  );
                })}
              </View>
            </View>
          )}
          <ScrollView style={styles.taskList}>
            {activeView === 'journal' ? (
              <JournalView
                scope={{ type: 'domain', id: selectedDomain.id, name: selectedDomain.name }}
                onEntryPress={handleJournalEntryPress}
              />
            ) : activeView === 'analytics' ? (
              <AnalyticsView
                scope={{ type: 'domain', id: selectedDomain.id, name: selectedDomain.name }}
              />
            ) : loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : activeView === 'deposits' ? (
              tasks.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No deposits found for this domain</Text>
                </View>
              ) : (
                tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleCompleteTask}
                    onDoublePress={handleTaskDoublePress}
                  />
                ))
              )
            ) : activeView === 'ideas' ? (
              depositIdeas.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No ideas found for this domain</Text>
                </View>
              ) : (
                depositIdeas.map(depositIdea => (
                  <DepositIdeaCard
                    key={depositIdea.id}
                    depositIdea={depositIdea}
                    onUpdate={handleUpdateDepositIdea}
                    onCancel={handleCancelDepositIdea}
                    onDoublePress={handleDepositIdeaDoublePress}
                  />
                ))
              )
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Feature coming soon!</Text>
              </View>
            )}
          </ScrollView>
        </View>
      );
    }

    // Domains list view
    return (
      <View style={styles.content}>
        <Header 
          title="Wellness Bank" 
          authenticScore={authenticScore}
        />
        
        <ScrollView style={styles.domainsList}>
          {domains.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No domains found</Text>
            </View>
          ) : (
            <View style={styles.domainsGrid}>
              {domains.map(domain => (
                <TouchableOpacity
                  key={domain.id}
                  style={[
                    styles.domainCard,
                    { borderLeftColor: getDomainColor(domain.name) }
                  ]}
                  onPress={() => handleDomainPress(domain)}
                  activeOpacity={0.8}
                >
                  <View style={styles.domainCardContent}>
                    <View style={[styles.domainIcon, { backgroundColor: getDomainColor(domain.name) }]}>
                      <Heart size={24} color="#ffffff" />
                    </View>
                    <View style={styles.domainInfo}>
                      <Text style={styles.domainName}>{domain.name}</Text>
                      {domain.description && (
                        <Text style={styles.domainDescription} numberOfLines={2}>
                          {domain.description}
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderContent()}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setTaskFormVisible(true)}
      >
        <Plus size={24} color="#ffffff" />
      </TouchableOpacity>

      {/* Modals */}
      <Modal visible={taskFormVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode={editingTask ? "edit" : "create"}
          initialData={editingTask || undefined}
          onSubmitSuccess={handleFormSubmitSuccess}
          onClose={handleFormClose}
        />
      </Modal>

      <TaskDetailModal
        visible={taskDetailVisible}
        task={selectedTask}
        onClose={() => setTaskDetailVisible(false)}
        onUpdate={handleUpdateTask}
        onDelegate={handleDelegateTask}
        onCancel={handleCancelTask}
      />

      <DepositIdeaDetailModal
        visible={depositIdeaDetailVisible}
        depositIdea={selectedDepositIdea}
        onClose={() => setDepositIdeaDetailVisible(false)}
        onUpdate={handleUpdateDepositIdea}
        onCancel={handleCancelDepositIdea}
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
  domainsList: {
    flex: 1,
    padding: 16,
  },
  domainsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  domainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '48%',
  },
  domainCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  domainIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  domainInfo: {
    flex: 1,
  },
  domainName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  domainDescription: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  taskListContainer: {
    flex: 1,
  },
  taskList: {
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
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  fab: {
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
  goalsSection: {
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
  goalsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  goalsList: {
    gap: 12,
  },
});