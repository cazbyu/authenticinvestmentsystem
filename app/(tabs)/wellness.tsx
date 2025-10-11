import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { Plus, Heart, CreditCard as Edit, UserX, Ban, Menu } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';
import { useGoalProgress } from '@/hooks/useGoalProgress';
import { DraggableFab } from '@/components/DraggableFab';
import { calculateAuthenticScore as calculateAuthenticScoreUtil, calculateAuthenticScoreForDomain } from '@/lib/taskUtils';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';

type DrawerNavigation = DrawerNavigationProp<any>;

interface Domain {
  id: string;
  name: string;
  description?: string;
}

export default function Wellness() {
  const navigation = useNavigation<DrawerNavigation>();
  const { authenticScore, refreshScoreForDomain } = useAuthenticScore();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [depositIdeas, setDepositIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'deposits' | 'ideas' | 'journal' | 'analytics'>('deposits');

  // Main tab navigation state
  const [activeMainTab, setActiveMainTab] = useState<'domains' | 'manage'>('domains');

  // Modal states
  const [taskFormVisible, setTaskFormVisible] = useState(false);
  const [taskDetailVisible, setTaskDetailVisible] = useState(false);
  const [depositIdeaDetailVisible, setDepositIdeaDetailVisible] = useState(false);

  // Selected items
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDepositIdea, setSelectedDepositIdea] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [domainAuthenticScore, setDomainAuthenticScore] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scoreAbortControllerRef = useRef<AbortController | null>(null);

  // 12-Week Goals for selected domain (only fetch when domain is selected)
  const goalProgressScope = useMemo(() =>
    selectedDomain ? { type: 'domain' as const, id: selectedDomain.id } : undefined,
    [selectedDomain?.id]
  );

  const {
    goals: twelveWeekGoals,
    goalProgress,
    loading: goalsLoading,
    refreshGoals
  } = useGoalProgress({
    scope: goalProgressScope
  });

  const fetchAuthenticScoreLocal = useCallback(async (forceRefresh = false, domainId?: string) => {
    // Cancel any in-flight score calculation
    if (scoreAbortControllerRef.current) {
      scoreAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    scoreAbortControllerRef.current = controller;

    try {
      let score: number;
      if (domainId) {
        score = await refreshScoreForDomain(domainId, forceRefresh);
      } else {
        score = authenticScore;
      }

      if (!controller.signal.aborted) {
        setDomainAuthenticScore(score);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('Error calculating authentic score:', error);
      }
    }
  }, [authenticScore, refreshScoreForDomain]);

  const fetchDomains = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-domains')
        .select('*')
        .order('name');

      if (error) throw error;
      setDomains(data || []);
      // Fetch score in background without blocking
      fetchAuthenticScoreLocal(false);
    } catch (error) {
      console.error('Error fetching domains:', error);
      Alert.alert('Error', (error as Error).message);
    }
  }, [fetchAuthenticScoreLocal]);

  const fetchDomainTasks = useCallback(async (domainId: string, view: 'deposits' | 'ideas' = activeView) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this fetch
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if aborted
      if (controller.signal.aborted) {
        return;
      }

      if (view === 'deposits') {
        // Fetch all tasks/events for this user first
        const { data: tasksData, error: tasksError } = await supabase
          .from('0008-ap-tasks')
          .select('*, custom_timeline_id')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .not('status', 'in', '(completed,cancelled)')
          .in('type', ['task', 'event']);

        if (tasksError) throw tasksError;

        if (!tasksData || tasksData.length === 0) {
          setTasks([]);
          setDepositIdeas([]);
          setLoading(false);
          return;
        }

        // Check if aborted
        if (controller.signal.aborted) {
          return;
        }

        const taskIds = tasksData.map(t => t.id);

        const [
          { data: rolesData, error: rolesError },
          { data: domainsData, error: domainsError },
          { data: goalsData, error: goalsError },
          { data: notesData, error: notesError },
          { data: keyRelationshipsData, error: keyRelationshipsError }
        ] = await Promise.all([
          supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-goals-join').select('parent_id, goal:0008-ap-goals-12wk(id, title)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', taskIds).eq('parent_type', 'task')
        ]);

        if (rolesError) throw rolesError;
        if (domainsError) throw domainsError;
        if (goalsError) throw goalsError;
        if (notesError) throw notesError;
        if (keyRelationshipsError) throw keyRelationshipsError;

        // Check if aborted before processing
        if (controller.signal.aborted) {
          return;
        }

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
          has_delegates: false,
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

        // Check if aborted
        if (controller.signal.aborted) {
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

        // Check if aborted before processing
        if (controller.signal.aborted) {
          return;
        }

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
      // Don't show errors if request was aborted
      if (controller.signal.aborted) {
        return;
      }
      console.error(`Error fetching domain ${view}:`, error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [activeView]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  useEffect(() => {
    if (selectedDomain) {
      if (activeView === 'deposits' || activeView === 'ideas') {
        fetchDomainTasks(selectedDomain.id, activeView);
      }
      // Calculate domain-specific score
      fetchAuthenticScoreLocal(true, selectedDomain.id);
    } else {
      // Calculate total score when no domain is selected
      fetchAuthenticScoreLocal(false);
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (scoreAbortControllerRef.current) {
        scoreAbortControllerRef.current.abort();
      }
    };
  }, [selectedDomain, activeView, fetchDomainTasks, fetchAuthenticScoreLocal]);

  const handleViewChange = useCallback((view: 'deposits' | 'ideas' | 'journal' | 'analytics') => {
    setActiveView(view);
    if (selectedDomain && (view === 'deposits' || view === 'ideas')) {
      fetchDomainTasks(selectedDomain.id, view);
    }
  }, [selectedDomain, fetchDomainTasks]);

  const handleCompleteTask = useCallback(async (taskId: string) => {
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
      // Refresh score after task completion
      fetchAuthenticScoreLocal(true);
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  }, [selectedDomain, activeView, fetchDomainTasks, fetchAuthenticScoreLocal]);

  const handleUpdateDepositIdea = useCallback((depositIdea: any) => {
    const editData = {
      ...depositIdea,
      type: 'depositIdea'
    };
    setEditingTask(editData);
    setDepositIdeaDetailVisible(false);
    setTaskFormVisible(true);
  }, []);

  const handleCancelDepositIdea = useCallback(async (depositIdea: any) => {
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
  }, [selectedDomain, activeView, fetchDomainTasks]);

  const handleActivateDepositIdea = useCallback(async (depositIdea: any) => {
    try {
      // For now, just open the form to create a task based on the deposit idea
      const editData = {
        ...depositIdea,
        type: 'task', // Convert to task
        title: depositIdea.title,
        selectedRoleIds: depositIdea.roles?.map(r => r.id) || [],
        selectedDomainIds: depositIdea.domains?.map(d => d.id) || [],
        selectedKeyRelationshipIds: depositIdea.keyRelationships?.map(kr => kr.id) || [],
      };
      setEditingTask(editData);
      setTaskFormVisible(true);
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to activate deposit idea.');
    }
  }, []);
  const handleTaskDoublePress = useCallback((task: Task) => {
    setSelectedTask(task);
    setTaskDetailVisible(true);
  }, []);

  const handleDepositIdeaDoublePress = useCallback((depositIdea: any) => {
    setSelectedDepositIdea(depositIdea);
    setDepositIdeaDetailVisible(true);
  }, []);

  const handleUpdateTask = useCallback((task: Task) => {
    setEditingTask(task);
    setTaskDetailVisible(false);
    setTimeout(() => setTaskFormVisible(true), 100);
  }, []);

  const handleDelegateTask = useCallback((task: Task) => {
    Alert.alert('Delegate', 'Delegation functionality coming soon!');
    setTaskDetailVisible(false);
  }, []);

  const handleCancelTask = useCallback(async (task: Task) => {
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
  }, [selectedDomain, activeView, fetchDomainTasks]);

  const handleFormSubmitSuccess = useCallback(() => {
    setTaskFormVisible(false);
    setEditingTask(null);
    if (selectedDomain) {
      fetchDomainTasks(selectedDomain.id, activeView);
    }
    refreshGoals();
    // Refresh score after task creation/update
    fetchAuthenticScoreLocal(true);
  }, [selectedDomain, activeView, fetchDomainTasks, refreshGoals, fetchAuthenticScoreLocal]);

  const handleFormClose = useCallback(() => {
    setTaskFormVisible(false);
    setEditingTask(null);
  }, []);

  const handleDomainPress = useCallback((domain: Domain) => {
    setSelectedDomain(domain);
  }, []);

  const handleJournalEntryPress = useCallback((entry: any) => {
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
  }, []);

  const getDomainColor = useCallback((domainName: string) => {
    const colors: Record<string, string> = {
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
  }, []);

  // Render custom header
  const renderWellnessBankHeader = () => {
    if (selectedDomain) {
      // Individual domain detail header
      return (
        <View style={[styles.customHeader, { backgroundColor: getDomainColor(selectedDomain.name) }]}>
          <View style={styles.customHeaderTop}>
            <TouchableOpacity
              style={styles.customBackButton}
              onPress={() => setSelectedDomain(null)}
            >
              <Text style={styles.customBackButtonText}>← Back to Wellness Bank</Text>
            </TouchableOpacity>
            <View style={styles.customHeaderCenter}>
              <Text style={styles.customHeaderTitle}>{selectedDomain.name}</Text>
            </View>
            <View style={styles.customScoreContainer}>
              <Text style={styles.customScoreLabel}>Authentic Score</Text>
              <Text style={styles.customScoreValue}>{authenticScore}</Text>
            </View>
          </View>
          <View style={styles.customHeaderBottom}>
            <View style={styles.customToggleGroup}>
              {(['deposits', 'ideas', 'journal', 'analytics'] as const).map((view) => (
                <TouchableOpacity
                  key={view}
                  style={[styles.customToggleButton, activeView === view && styles.customActiveToggle]}
                  onPress={() => handleViewChange(view)}
                >
                  <Text style={[styles.customToggleText, activeView === view && styles.customActiveToggleText]}>
                    {view.charAt(0).toUpperCase() + view.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
    }

    // Main Wellness Bank header with tabs
    return (
      <View style={styles.customHeader}>
        <View style={styles.customHeaderTop}>
          <TouchableOpacity
            style={styles.customMenuButton}
            onPress={() => navigation.openDrawer()}
          >
            <Menu size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.customHeaderCenter}>
            <Text style={styles.customHeaderTitle}>Wellness Bank</Text>
          </View>
          <View style={styles.customScoreContainer}>
            <Text style={styles.customScoreLabel}>Authentic Score</Text>
            <Text style={styles.customScoreValue}>{authenticScore}</Text>
          </View>
        </View>
        <View style={styles.customHeaderBottom}>
          <View style={styles.customMainToggleGroup}>
            <TouchableOpacity
              style={[styles.customToggleButton, activeMainTab === 'domains' && styles.customActiveToggle]}
              onPress={() => setActiveMainTab('domains')}
            >
              <Text style={[styles.customToggleText, activeMainTab === 'domains' && styles.customActiveToggleText]}>
                Domains
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.customToggleButton, activeMainTab === 'manage' && styles.customActiveToggle]}
              onPress={() => setActiveMainTab('manage')}
            >
              <Text style={[styles.customToggleText, activeMainTab === 'manage' && styles.customActiveToggleText]}>
                Manage Domains
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (selectedDomain) {
      // Domain view
      return (
        <View style={styles.content}>

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
                          isGoal: true,
                          selectedDomainIds: selectedDomain ? [selectedDomain.id] : [],
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
              null
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

    // Main Wellness Bank view with tabs
    return (
      <View style={styles.content}>
        {activeMainTab === 'domains' && (
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
        )}

        {activeMainTab === 'manage' && (
          <ScrollView style={styles.manageContent}>
            <View style={styles.manageHeader}>
              <Text style={styles.manageTitle}>Manage Wellness Domains</Text>
            </View>
            <View style={styles.managePlaceholder}>
              <Heart size={48} color="#9ca3af" />
              <Text style={styles.managePlaceholderTitle}>Domain Management Coming Soon</Text>
              <Text style={styles.managePlaceholderText}>
                Future updates will allow you to customize domain names, add custom domains, and set priorities.
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderWellnessBankHeader()}
      {renderContent()}

      <DraggableFab onPress={() => {
        if (selectedDomain) {
          setEditingTask({
            type: 'task',
            selectedDomainIds: [selectedDomain.id],
          } as any);
          setTaskFormVisible(true);
        } else {
          setEditingTask(null);
          setTaskFormVisible(true);
        }
      }}>
        <Plus size={24} color="#ffffff" />
      </DraggableFab>

      {/* Modals */}
      <Modal visible={taskFormVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode={editingTask?.id ? "edit" : "create"}
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
  goalsSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  goalsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    padding: 16,
    paddingBottom: 8,
  },
  goalsList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  // Custom header styles
  customHeader: {
    backgroundColor: '#0078d4',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  customHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  customMenuButton: {
    padding: 4,
  },
  customBackButton: {
    paddingVertical: 4,
  },
  customBackButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  customHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  customHeaderTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  customScoreContainer: {
    alignItems: 'flex-end',
  },
  customScoreLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  customScoreValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  customHeaderBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customMainToggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 2,
  },
  customToggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 2,
  },
  customToggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    minWidth: 70,
    alignItems: 'center',
  },
  customActiveToggle: {
    backgroundColor: '#ffffff',
  },
  customToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  customActiveToggleText: {
    color: '#0078d4',
  },
  // Manage Domains tab styles
  manageContent: {
    flex: 1,
    padding: 16,
  },
  manageHeader: {
    marginBottom: 20,
  },
  manageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  managePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  managePlaceholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  managePlaceholderText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});