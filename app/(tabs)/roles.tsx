import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { TaskCard, Task } from '@/components/tasks/TaskCard';
import { DepositIdeaCard } from '@/components/depositIdeas/DepositIdeaCard';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import { DepositIdeaDetailModal } from '@/components/depositIdeas/DepositIdeaDetailModal';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { ManageRolesModal } from '@/components/settings/ManageRolesModal';
import { EditRoleModal } from '@/components/settings/EditRoleModal';
import { EditKRModal } from '@/components/settings/EditKRModal';
import { getSupabaseClient } from '@/lib/supabase';
import { Plus, Users, CreditCard as Edit, UserX, Ban } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';

type DrawerNavigation = DrawerNavigationProp<any>;

interface Role {
  id: string;
  label: string;
  category?: string;
  image_path?: string;
  color?: string;
}

interface KeyRelationship {
  id: string;
  name: string;
  description?: string;
  image_path?: string;
  role_id: string;
}

export default function Roles() {
  const navigation = useNavigation<DrawerNavigation>();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [selectedKR, setSelectedKR] = useState<KeyRelationship | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [depositIdeas, setDepositIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'deposits' | 'ideas' | 'journal' | 'analytics'>('deposits');
  const [krView, setKRView] = useState<'deposits' | 'ideas'>('deposits');
  
  // Modal states
  const [manageRolesVisible, setManageRolesVisible] = useState(false);
  const [editRoleVisible, setEditRoleVisible] = useState(false);
  const [editKRVisible, setEditKRVisible] = useState(false);
  const [taskFormVisible, setTaskFormVisible] = useState(false);
  const [taskDetailVisible, setTaskDetailVisible] = useState(false);
  const [depositIdeaDetailVisible, setDepositIdeaDetailVisible] = useState(false);
  
  // Selected items
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDepositIdea, setSelectedDepositIdea] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingKR, setEditingKR] = useState<KeyRelationship | null>(null);

  const fetchRoles = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('label');

      if (error) throw error;
      setRoles(data || []);
      
      // Don't auto-select first role - show accounts page by default
    } catch (error) {
      console.error('Error fetching roles:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const fetchKeyRelationships = async (roleId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-key-relationships')
        .select('*')
        .eq('user_id', user.id)
        .eq('role_id', roleId)
        .order('name');

      if (error) throw error;
      setKeyRelationships(data || []);
      setSelectedKR(null); // Don't auto-select first KR
    } catch (error) {
      console.error('Error fetching key relationships:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const fetchRoleTasks = async (roleId: string, view: 'deposits' | 'ideas' = activeView) => {
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
          { data: delegatesData, error: delegatesError }
        ] = await Promise.all([
          supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0007-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-goals-join').select('parent_id, goal:0008-ap-goals-12wk(id, title)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', taskIds).eq('parent_type', 'task')
        ]);

        if (rolesError) throw rolesError;
        if (domainsError) throw domainsError;
        if (goalsError) throw goalsError;
        if (notesError) throw notesError;
        if (delegatesError) throw delegatesError;

        // Filter tasks that have the selected role
        const roleTaskIds = rolesData?.filter(r => r.role?.id === roleId).map(r => r.parent_id) || [];
        const filteredTasks = tasksData.filter(task => roleTaskIds.includes(task.id));

        const transformedTasks = filteredTasks.map(task => ({
          ...task,
          roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
          domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
          goals: goalsData?.filter(g => g.parent_id === task.id).map(g => g.goal).filter(Boolean) || [],
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
          supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0007-ap-domains(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
          supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
          supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea')
        ]);

        if (rolesError) throw rolesError;
        if (domainsError) throw domainsError;
        if (krError) throw krError;
        if (notesError) throw notesError;

        // Filter deposit ideas that have the selected role
        const roleDepositIdeaIds = rolesData?.filter(r => r.role?.id === roleId).map(r => r.parent_id) || [];
        const filteredDepositIdeas = depositIdeasData.filter(di => roleDepositIdeaIds.includes(di.id));

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
      console.error(`Error fetching role ${view}:`, error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchKRTasks = async (krId: string, view: 'deposits' | 'ideas' = krView) => {
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
          { data: delegatesData, error: delegatesError }
        ] = await Promise.all([
          supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0007-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-goals-join').select('parent_id, goal:0008-ap-goals-12wk(id, title)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', taskIds).eq('parent_type', 'task')
        ]);

        if (rolesError) throw rolesError;
        if (domainsError) throw domainsError;
        if (goalsError) throw goalsError;
        if (notesError) throw notesError;
        if (delegatesError) throw delegatesError;

        // Filter tasks that have the selected key relationship
        const krTaskIds = delegatesData?.filter(kr => kr.key_relationship?.id === krId).map(kr => kr.parent_id) || [];
        const filteredTasks = tasksData.filter(task => krTaskIds.includes(task.id));

        const transformedTasks = filteredTasks.map(task => ({
          ...task,
          roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
          domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
          goals: goalsData?.filter(g => g.parent_id === task.id).map(g => g.goal).filter(Boolean) || [],
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
          supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0007-ap-domains(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
          supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
          supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea')
        ]);

        if (rolesError) throw rolesError;
        if (domainsError) throw domainsError;
        if (krError) throw krError;
        if (notesError) throw notesError;

        // Filter deposit ideas that have the selected key relationship
        const krDepositIdeaIds = krData?.filter(kr => kr.key_relationship?.id === krId).map(kr => kr.parent_id) || [];
        const filteredDepositIdeas = depositIdeasData.filter(di => krDepositIdeaIds.includes(di.id));

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
      console.error(`Error fetching KR ${view}:`, error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      fetchKeyRelationships(selectedRole.id);
      fetchRoleTasks(selectedRole.id, activeView);
    }
  }, [selectedRole, activeView]);

  useEffect(() => {
    if (selectedKR) {
      fetchKRTasks(selectedKR.id, krView);
    }
  }, [selectedKR, krView]);

  const handleViewChange = (view: 'deposits' | 'ideas' | 'journal' | 'analytics') => {
    setActiveView(view);
    if (selectedRole && (view === 'deposits' || view === 'ideas')) {
      fetchRoleTasks(selectedRole.id, view);
    }
  };

  const handleKRViewChange = (view: 'deposits' | 'ideas') => {
    setKRView(view);
    if (selectedKR) {
      fetchKRTasks(selectedKR.id, view);
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
      
      if (selectedRole) {
        fetchRoleTasks(selectedRole.id, activeView);
      }
      if (selectedKR) {
        fetchKRTasks(selectedKR.id, krView);
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
      
      if (selectedRole) {
        fetchRoleTasks(selectedRole.id, activeView);
      }
      if (selectedKR) {
        fetchKRTasks(selectedKR.id, krView);
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
      
      if (selectedRole) {
        fetchRoleTasks(selectedRole.id, activeView);
      }
      if (selectedKR) {
        fetchKRTasks(selectedKR.id, krView);
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleFormSubmitSuccess = () => {
    setTaskFormVisible(false);
    setEditingTask(null);
    if (selectedRole) {
      fetchRoleTasks(selectedRole.id, activeView);
    }
    if (selectedKR) {
      fetchKRTasks(selectedKR.id, krView);
    }
  };

  const handleFormClose = () => {
    setTaskFormVisible(false);
    setEditingTask(null);
  };

  const handleRolePress = (role: Role) => {
    setSelectedRole(role);
    setSelectedKR(null);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setEditRoleVisible(true);
  };

  const handleEditKR = (kr: KeyRelationship) => {
    setEditingKR(kr);
    setEditKRVisible(true);
  };

  const handleRoleUpdate = () => {
    fetchRoles();
    setEditRoleVisible(false);
    setEditingRole(null);
  };

  const handleKRUpdate = () => {
    if (selectedRole) {
      fetchKeyRelationships(selectedRole.id);
    }
    setEditKRVisible(false);
    setEditingKR(null);
  };

  const handleAddKR = async (roleId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-key-relationships')
        .insert({
          name: 'New Key Relationship',
          role_id: roleId,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh KRs and open edit modal for the new one
      await fetchKeyRelationships(roleId);
      setEditingKR(data);
      setEditKRVisible(true);
    } catch (error) {
      console.error('Error creating key relationship:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const getImageUrl = (imagePath?: string, bucket: string = '0008-role-images') => {
    if (!imagePath) return null;
    try {
      const supabase = getSupabaseClient();
      const { data } = supabase.storage.from(bucket).getPublicUrl(imagePath);
      return data.publicUrl;
    } catch (error) {
      console.error('Error getting image URL:', error);
      return null;
    }
  };

  const renderContent = () => {
    if (selectedKR) {
      // Key Relationship view
      return (
        <View style={styles.content}>
          <View style={[styles.header, { backgroundColor: selectedRole?.color || '#0078d4' }]}>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => setSelectedKR(null)}
                >
                  <Text style={styles.backButtonText}>← Back to Role</Text>
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                  <Text style={styles.headerTitle}>{selectedKR.name}</Text>
                  <Text style={styles.headerSubtitle}>Key Relationship in {selectedRole?.label}</Text>
                </View>
              </View>
              <View style={styles.headerRight}>
                {selectedKR.image_path && (
                  <Image 
                    source={{ uri: getImageUrl(selectedKR.image_path, '0008-key-relationship-images') }} 
                    style={styles.headerImage} 
                  />
                )}
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => handleEditKR(selectedKR)}
                >
                  <Edit size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, krView === 'deposits' && styles.activeToggle]}
                onPress={() => handleKRViewChange('deposits')}
              >
                <Text style={[styles.toggleText, krView === 'deposits' && styles.activeToggleText]}>
                  Deposits
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, krView === 'ideas' && styles.activeToggle]}
                onPress={() => handleKRViewChange('ideas')}
              >
                <Text style={[styles.toggleText, krView === 'ideas' && styles.activeToggleText]}>
                  Ideas
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.taskList}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : krView === 'deposits' ? (
              tasks.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No deposits found for this key relationship</Text>
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
            ) : (
              depositIdeas.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No ideas found for this key relationship</Text>
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
            )}
          </ScrollView>
        </View>
      );
    }

    if (selectedRole) {
      // Role view
      return (
        <View style={styles.content}>
          <Header
            title={selectedRole.label}
            activeView={activeView}
            onViewChange={handleViewChange}
            backgroundColor={selectedRole.color}
            onEditPress={() => handleEditRole(selectedRole)}
            onBackPress={() => setSelectedRole(null)}
          />

          <ScrollView style={styles.taskList}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : activeView === 'deposits' ? (
              tasks.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No deposits found for this role</Text>
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
                  <Text style={styles.emptyText}>No ideas found for this role</Text>
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

          {keyRelationships.length > 0 && (
            <View style={styles.keyRelationshipsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Key Relationships</Text>
                <TouchableOpacity
                  style={styles.addKRButton}
                  onPress={() => handleAddKR(selectedRole.id)}
                >
                  <Plus size={16} color="#0078d4" />
                  <Text style={styles.addKRButtonText}>Add KR</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.keyRelationshipsList}>
                  {keyRelationships.map(kr => (
                    <TouchableOpacity
                      key={kr.id}
                      style={styles.keyRelationshipCard}
                      onPress={() => setSelectedKR(kr)}
                    >
                      {kr.image_path ? (
                        <Image 
                          source={{ uri: getImageUrl(kr.image_path, '0008-key-relationship-images') }} 
                          style={styles.krImage} 
                        />
                      ) : (
                        <View style={styles.krImagePlaceholder}>
                          <Users size={24} color="#6b7280" />
                        </View>
                      )}
                      <Text style={styles.krName} numberOfLines={2}>{kr.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Show Add KR button even when no KRs exist */}
          {keyRelationships.length === 0 && (
            <View style={styles.keyRelationshipsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Key Relationships</Text>
                <TouchableOpacity
                  style={styles.addKRButton}
                  onPress={() => handleAddKR(selectedRole.id)}
                >
                  <Plus size={16} color="#0078d4" />
                  <Text style={styles.addKRButtonText}>Add KR</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.emptyKRText}>No key relationships yet</Text>
            </View>
          )}
        </View>
      );
    }

    // Roles list view
    return (
      <View style={styles.content}>
        <Header 
          title="Role Bank" 
          authenticScore={85}
        />
        
        <ScrollView style={styles.rolesList}>
  {roles.length === 0 ? (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No active roles found</Text>
      <TouchableOpacity 
        style={styles.manageButton}
        onPress={() => setManageRolesVisible(true)}
      >
        <Text style={styles.manageButtonText}>Manage Roles</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.rolesGrid}>
      {roles.map(role => (
        <View
          key={role.id}
          style={[
            styles.roleCard,
            styles.roleCardHalf, // ← requires styles.roleCardHalf
            { borderLeftColor: role.color || '#0078d4' }
          ]}
        >
          <View style={styles.roleCardContent}>
            {/* LEFT side = navigate into the Role */}
            <TouchableOpacity
              style={styles.roleCardLeft}
              onPress={() => handleRolePress(role)}
              activeOpacity={0.8}
            >
              {role.image_path ? (
                <Image 
                  source={{ uri: getImageUrl(role.image_path) }} 
                  style={styles.roleImage} 
                />
              ) : (
                <View style={[styles.roleImagePlaceholder, { backgroundColor: role.color || '#0078d4' }]}>
                  <Text style={styles.roleImageText}>
                    {role.label.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.roleInfo}>
                <Text style={styles.roleName}>{role.label}</Text>
                {role.category && (
                  <Text style={styles.roleCategory}>{role.category}</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* RIGHT side = edit role settings (image/color) */}
            <TouchableOpacity 
              style={styles.editRoleButton}
              onPress={() => handleEditRole(role)}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Edit size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>
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

      <TouchableOpacity 
        style={styles.manageFab} 
        onPress={() => setManageRolesVisible(true)}
      >
        <Users size={20} color="#ffffff" />
      </TouchableOpacity>

      {/* Modals */}
      <ManageRolesModal
        visible={manageRolesVisible}
        onClose={() => setManageRolesVisible(false)}
      />

      <EditRoleModal
        visible={editRoleVisible}
        onClose={() => setEditRoleVisible(false)}
        onUpdate={handleRoleUpdate}
        role={editingRole}
      />

      <EditKRModal
        visible={editKRVisible}
        onClose={() => setEditKRVisible(false)}
        onUpdate={handleKRUpdate}
        keyRelationship={editingKR}
        roleName={selectedRole?.label}
      />

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
  header: {
    backgroundColor: '#0078d4',
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 14,
    opacity: 0.9,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  headerSubtitle: {
    color: '#ffffff',
    fontSize: 14,
    opacity: 0.9,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
  },
  editButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 6,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 2,
    alignSelf: 'flex-start',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    minWidth: 80,
    alignItems: 'center',
  },
  activeToggle: {
    backgroundColor: '#ffffff',
  },
  toggleText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  activeToggleText: {
    color: '#0078d4',
  },
  rolesList: {
    flex: 1,
    padding: 16,
  },
  roleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roleCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
rolesGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: 12,
  paddingHorizontal: 16,    // nice gutters
},
roleCardHalf: {
  width: '48%',
},
    roleCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  roleImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  roleImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  roleImageText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  roleCategory: {
    fontSize: 14,
    color: '#6b7280',
  },
  editRoleButton: {
    padding: 8,
  },
  taskList: {
    flex: 1,
    padding: 16,
  },
  keyRelationshipsSection: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  addKRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0078d4',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  addKRButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0078d4',
  },
  emptyKRText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 16,
    fontStyle: 'italic',
  },
  keyRelationshipsList: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  keyRelationshipCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    width: 100,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  krImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 8,
  },
  krImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  krName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 16,
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
  manageButton: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  manageButtonText: {
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
  manageFab: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});