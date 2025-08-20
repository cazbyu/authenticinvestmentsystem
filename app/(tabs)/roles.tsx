import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, ScrollView, TouchableOpacity, Dimensions, Modal, TextInput, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CreditCard as Edit, UserX, Plus, X, Ban } from 'lucide-react-native';
import { Header } from '@/components/Header';
import { AddItemModal } from '@/components/AddItemModal';
import { Task, TaskCard } from '@/components/tasks/TaskCard';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import { EditKRModal } from '@/components/settings/EditKRModal';
import { EditRoleModal } from '@/components/settings/EditRoleModal';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { getSupabaseClient } from '@/lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { Animated } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

interface Role {
  id: string;
  label: string;
  category?: string;
  is_active: boolean;
  image_path?: string;
  color?: string;
  image_path?: string;
  color?: string;
}

interface KeyRelationship {
  id: string;
  name: string;
  role_id: string;
  user_id: string;
  image_path?: string;
  description?: string;
}

export default function Roles() {
  const [modalVisible, setModalVisible] = useState(false);
  const [roleAccountVisible, setRoleAccountVisible] = useState(false);
  const [krAccountVisible, setKrAccountVisible] = useState(false);
  const [taskFormVisible, setTaskFormVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedKR, setSelectedKR] = useState<KeyRelationship | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [roleTasks, setRoleTasks] = useState<Task[]>([]);
  const [krTasks, setKrTasks] = useState<Task[]>([]);
  const [roleKeyRelationships, setRoleKeyRelationships] = useState<KeyRelationship[]>([]);
  const [addKRModalVisible, setAddKRModalVisible] = useState(false);
  const [newKRName, setNewKRName] = useState('');
  const [editKRModalVisible, setEditKRModalVisible] = useState(false);
  const [editingKR, setEditingKR] = useState<KeyRelationship | null>(null);
  const [editRoleModalVisible, setEditRoleModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [activeJournalView, setActiveJournalView] = useState<'deposits' | 'ideas' | 'journal' | 'analytics'>('deposits');
  const [sortOption, setSortOption] = useState('due_date');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();
  const router = useRouter();

  useEffect(() => {
    if (isFocused) {
      fetchActiveRoles();
    }
  }, [isFocused]);

  useEffect(() => {
    if (roles.length > 0) {
      fetchAllKeyRelationships();
    }
  }, [roles]);

  // Add effect to refetch tasks when activeJournalView changes
  useEffect(() => {
    if (selectedRole) {
      fetchRoleTasks(selectedRole.id, activeJournalView);
    }
  }, [activeJournalView, selectedRole?.id]);

  useEffect(() => {
    if (selectedKR) {
      fetchKRTasks(selectedKR.id, activeJournalView);
    }
  }, [activeJournalView, selectedKR?.id]);
  const fetchActiveRoles = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('0008-ap-roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching active roles:', error);
        Alert.alert('Error', (error as Error).message);
      } else {
        setRoles(data || []);
      }
    } catch (error) {
      console.error('Error fetching active roles:', error);
      Alert.alert('Error', (error as Error).message);
    }
    setLoading(false);
  };

  const fetchAllKeyRelationships = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-key-relationships')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching key relationships:', error);
        Alert.alert('Error', (error as Error).message);
      } else {
        setKeyRelationships(data || []);
      }
    } catch (error) {
      console.error('Error fetching key relationships:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleAddRole = (data: any) => {
    console.log('Adding new role:', data);
    setModalVisible(false);
    fetchActiveRoles();
  };

  const handleRolePress = async (role: Role) => {
    setSelectedRole(role);
    await fetchRoleTasks(role.id);
    await fetchRoleKeyRelationships(role.id);
    setRoleAccountVisible(true);
  };

  const handleKRPress = async (kr: KeyRelationship) => {
    setSelectedKR(kr);
    await fetchKRTasks(kr.id);
    setKrAccountVisible(true);
  };

  const handleEditKR = (kr: KeyRelationship) => {
    setEditingKR(kr);
    setEditKRModalVisible(true);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setEditRoleModalVisible(true);
  };

  const fetchRoleTasks = async (roleId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let taskQuery = supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', user.id)
        .not('status', 'in', '(completed,cancelled)');

      // Apply filtering based on activeJournalView
      if (activeJournalView === 'deposits') {
        taskQuery = taskQuery.in('type', ['task', 'event']).eq('deposit_idea', false);
      } else if (activeJournalView === 'ideas') {
        taskQuery = taskQuery.eq('deposit_idea', true);
      } else {
        // For journal and analytics views, default to deposits for background data
        taskQuery = taskQuery.in('type', ['task', 'event']).eq('deposit_idea', false);
      }

      const { data: tasksData, error: tasksError } = await taskQuery;
      if (tasksError) throw tasksError;

      if (!tasksData || tasksData.length === 0) {
        setRoleTasks([]);
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

      const transformedTasks = tasksData.map(task => ({
        ...task,
        roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
        domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
        goals: goalsData?.filter(g => g.parent_id === task.id).map(g => g.goal).filter(Boolean) || [],
        has_notes: notesData?.some(n => n.parent_id === task.id),
        has_delegates: delegatesData?.some(d => d.parent_id === task.id),
        has_attachments: false,
      }));

      // Filter tasks that belong to this specific role
      const roleSpecificTasks = transformedTasks.filter(task =>
        task.roles.some(role => role.id === roleId)
      );

      setRoleTasks(roleSpecificTasks);
    } catch (error) {
      console.error('Error fetching role tasks:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const fetchRoleKeyRelationships = async (roleId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-key-relationships')
        .select('*')
        .eq('user_id', user.id)
        .eq('role_id', roleId);

      if (error) throw error;
      setRoleKeyRelationships(data || []);
    } catch (error) {
      console.error('Error fetching role key relationships:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleAddKeyRelationship = async () => {
    if (!newKRName.trim() || !selectedRole) return;
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-key-relationships')
        .insert({
          name: newKRName.trim(),
          role_id: selectedRole.id,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setNewKRName('');
      setAddKRModalVisible(false);
      await fetchRoleKeyRelationships(selectedRole.id);
      await fetchAllKeyRelationships();
    } catch (error) {
      console.error('Error adding key relationship:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to add key relationship');
    }
  };

  const fetchKRTasks = async (krId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let taskQuery = supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', user.id)
        .not('status', 'in', '(completed,cancelled)');

      // Apply filtering based on activeJournalView
      if (activeJournalView === 'deposits') {
        taskQuery = taskQuery.in('type', ['task', 'event']).eq('deposit_idea', false);
      } else if (activeJournalView === 'ideas') {
        taskQuery = taskQuery.eq('deposit_idea', true);
      } else {
        // For journal and analytics views, default to deposits for background data
        taskQuery = taskQuery.in('type', ['task', 'event']).eq('deposit_idea', false);
      }

      const { data: tasksData, error: tasksError } = await taskQuery;
      if (tasksError) throw tasksError;

      if (!tasksData || tasksData.length === 0) {
        setKrTasks([]);
        return;
      }

      const taskIds = tasksData.map(t => t.id);

      const [
        { data: rolesData, error: rolesError },
        { data: domainsData, error: domainsError },
        { data: goalsData, error: goalsError },
        { data: notesData, error: notesError },
        { data: delegatesData, error: delegatesError },
        { data: krData, error: krError }
      ] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds),
        supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0007-ap-domains(id, name)').in('parent_id', taskIds),
        supabase.from('0008-ap-universal-goals-join').select('parent_id, goal:0008-ap-goals-12wk(id, title)').in('parent_id', taskIds),
        supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIds),
        supabase.from('0008-ap-universal-delegates-join').select('parent_id, delegate_id').in('parent_id', taskIds),
        supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', taskIds),
      ]);

      if (rolesError) throw rolesError;
      if (domainsError) throw domainsError;
      if (goalsError) throw goalsError;
      if (notesError) throw notesError;
      if (delegatesError) throw delegatesError;
      if (krError) throw krError;

      const transformedTasks = tasksData.map(task => ({
        ...task,
        roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
        domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
        goals: goalsData?.filter(g => g.parent_id === task.id).map(g => g.goal).filter(Boolean) || [],
        keyRelationships: krData?.filter(kr => kr.parent_id === task.id).map(kr => kr.key_relationship).filter(Boolean) || [],
        has_notes: notesData?.some(n => n.parent_id === task.id),
        has_delegates: delegatesData?.some(d => d.parent_id === task.id),
        has_attachments: false,
      }));

      // Filter tasks that belong to this specific key relationship
      const krSpecificTasks = transformedTasks.filter(task =>
        task.keyRelationships?.some(kr => kr.id === krId)
      );

      setKrTasks(krSpecificTasks);
    } catch (error) {
      console.error('Error fetching KR tasks:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('0008-ap-tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString()
      }).eq('id', taskId);

      if (error) throw error;
      if (selectedRole) {
        await fetchRoleTasks(selectedRole.id);
      }
      if (selectedKR) {
        await fetchKRTasks(selectedKR.id);
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to complete task.');
    }
  };

  const handleTaskDoublePress = (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalVisible(true);
  };

  const handleUpdateTask = (task: Task) => {
    setEditingTask(task);
    setIsDetailModalVisible(false);
    setTimeout(() => setTaskFormVisible(true), 100); // Small delay to ensure modal transition
  };

  const handleDelegateTask = (task: Task) => {
    // Implementation for delegating task
    setIsDetailModalVisible(false);
    console.log('Delegate task:', task);
  };

  const handleCancelTask = async (task: Task) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('0008-ap-tasks').update({
        status: 'cancelled'
      }).eq('id', task.id);

      if (error) throw error;
      Alert.alert('Success', 'Task has been cancelled');
      setIsDetailModalVisible(false);
      if (selectedRole) {
        await fetchRoleTasks(selectedRole.id);
      }
      if (selectedKR) {
        await fetchKRTasks(selectedKR.id);
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to cancel task.');
    }
  };

  const renderRoleCard = (role: Role) => {
    return (
      <TouchableOpacity
        key={role.id}
        style={[
          styles.roleCard,
          isTablet ? styles.roleCardTablet : styles.roleCardMobile,
          hoveredCard === role.id && styles.roleCardHovered,
          { borderColor: role.color || 'rgba(0, 0, 0, 0.05)' }
        ]}
        onPress={() => handleRolePress(role)}
        onPressIn={() => setHoveredCard(role.id)}
        onPressOut={() => setHoveredCard(null)}
      >
        <TouchableOpacity 
          style={styles.editIcon}
          onPress={() => handleEditRole(role)}
        >
          <Edit size={16} color="#6b7280" />
        </TouchableOpacity>
        
        <View style={styles.cardContent}>
          {role.image_path && (
            <Image 
              source={{ 
                uri: getSupabaseClient().storage
                  .from('0008-role-images')
                  .getPublicUrl(role.image_path).data.publicUrl 
              }} 
              style={styles.roleMainImage} 
            />
          )}
          <Text style={styles.roleTitle}>{role.label}</Text>
          <Text style={styles.roleCategory}>{role.category || 'Custom'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderKRCard = (kr: KeyRelationship) => {
    // Find the role this KR belongs to
    const parentRole = roles.find(role => role.id === kr.role_id);

    // Get image URL if image_path exists
    let imageUrl = null;
    if (kr.image_path) {
      try {
        const supabase = getSupabaseClient();
        const { data } = supabase.storage
          .from('0008-key-relationship-images')
          .getPublicUrl(kr.image_path);
        imageUrl = data.publicUrl;
      } catch (error) {
        console.error('Error loading image URL:', error);
      }
    }
    
    return (
      <TouchableOpacity
        key={kr.id}
        style={[
          styles.roleCard,
          isTablet ? styles.roleCardTablet : styles.roleCardMobile,
          hoveredCard === kr.id && styles.roleCardHovered
        ]}
        onPress={() => handleKRPress(kr)}
        onPressIn={() => setHoveredCard(kr.id)}
        onPressOut={() => setHoveredCard(null)}
      >
        <TouchableOpacity 
          style={styles.editIcon}
          onPress={() => handleEditKR(kr)}
        >
          <Edit size={16} color="#6b7280" />
        </TouchableOpacity>
        
        <View style={styles.cardContent}>
          {imageUrl && (
            <Image source={{ uri: imageUrl }} style={styles.krMainImage} />
          )}
          <Text style={styles.roleTitle}>{kr.name}</Text>
          <Text style={styles.roleCategory}>{parentRole?.label || 'Key Relationship'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const handleSortPress = () => {
    // Sort functionality can be implemented later
  };

  const renderJournalLedger = () => {
    const placeholderRows = [
      { date: '2025-01-15', description: 'Quality time with family', notes: 'Dinner together', deposit: '+15', withdrawal: '', balance: '85' },
      { date: '2025-01-14', description: 'Missed workout session', notes: 'Too busy with work', deposit: '', withdrawal: '-8', balance: '70' },
      { date: '2025-01-13', description: 'Completed project milestone', notes: 'Delivered on time', deposit: '+25', withdrawal: '', balance: '78' },
      { date: '2025-01-12', description: 'Skipped family event', notes: 'Work conflict', deposit: '', withdrawal: '-12', balance: '53' },
      { date: '2025-01-11', description: 'Helped with homework', notes: 'Math tutoring', deposit: '+10', withdrawal: '', balance: '65' },
      { date: '2025-01-10', description: 'Argued with spouse', notes: 'Stress from work', deposit: '', withdrawal: '-15', balance: '55' },
    ];

    return (
      <View style={styles.journalContainer}>
        {/* Header Row */}
        <View style={styles.journalHeader}>
          <Text style={[styles.journalHeaderText, styles.dateColumn]}>Date</Text>
          <Text style={[styles.journalHeaderText, styles.descriptionColumn]}>Description</Text>
          <Text style={[styles.journalHeaderText, styles.notesColumn]}>Notes</Text>
          <Text style={[styles.journalHeaderText, styles.amountColumn]}>Deposit</Text>
          <Text style={[styles.journalHeaderText, styles.amountColumn]}>Withdrawal</Text>
          <Text style={[styles.journalHeaderText, styles.balanceColumn]}>Balance</Text>
        </View>
        
        {/* Data Rows */}
        <ScrollView style={styles.journalScrollView}>
          {placeholderRows.map((row, index) => (
            <View 
              key={index} 
              style={[
                styles.journalRow, 
                index % 2 === 0 ? styles.journalRowEven : styles.journalRowOdd
              ]}
            >
              <Text style={[styles.journalCellText, styles.dateColumn]}>{row.date}</Text>
              <Text style={[styles.journalCellText, styles.descriptionColumn]} numberOfLines={2}>{row.description}</Text>
              <Text style={[styles.journalCellText, styles.notesColumn]} numberOfLines={2}>{row.notes}</Text>
              <Text style={[styles.journalCellText, styles.amountColumn, styles.depositText]}>{row.deposit}</Text>
              <Text style={[styles.journalCellText, styles.amountColumn, styles.withdrawalText]}>{row.withdrawal}</Text>
              <Text style={[styles.journalCellText, styles.balanceColumn, styles.balanceText]}>{row.balance}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };
  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Role Bank" 
      />
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0078d4" />
          </View>
        ) : roles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No active roles found. Go to Settings to activate or create roles!</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Roles Section */}
            <View style={[
              styles.rolesGrid,
              isTablet ? styles.rolesGridTablet : styles.rolesGridMobile
            ]}>
              {roles.map(renderRoleCard)}
            </View>
            
            {/* Key Relationships Section */}
            {keyRelationships.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Key Relationships:</Text>
                <View style={[
                  styles.rolesGrid,
                  isTablet ? styles.rolesGridTablet : styles.rolesGridMobile
                ]}>
                  {keyRelationships.map(kr => {
                    // Only show KRs that belong to currently active roles
                    const parentRole = roles.find(role => role.id === kr.role_id);
                    if (!parentRole) return null;
                    
                    let imageUrl = null;
                    if (kr.image_path) {
                      try {
                        const supabase = getSupabaseClient();
                        imageUrl = supabase.storage
                          .from('0008-key-relationship-images')
                          .getPublicUrl(kr.image_path).data.publicUrl;
                      } catch (error) {
                        console.error('Error loading image URL:', error);
                      }
                    }

                    return (
                      <TouchableOpacity
                        key={kr.id}
                        style={[
                          styles.roleCard,
                          isTablet ? styles.roleCardTablet : styles.roleCardMobile,
                          hoveredCard === kr.id && styles.roleCardHovered
                        ]}
                        onPress={() => handleKRPress(kr)}
                        onPressIn={() => setHoveredCard(kr.id)}
                        onPressOut={() => setHoveredCard(null)}
                      >
                        <TouchableOpacity 
                          style={styles.editIcon}
                          onPress={() => handleEditKR(kr)}
                        >
                          <Edit size={16} color="#6b7280" />
                        </TouchableOpacity>
                        
                        <View style={styles.cardContent}>
                          {imageUrl && (
                            <Image source={{ uri: imageUrl }} style={styles.krMainImage} />
                          )}
                          <Text style={styles.roleTitle}>{kr.name}</Text>
                          <Text style={styles.roleCategory}>
                            {parentRole.label}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }).filter(Boolean)}
                </View>
              </>
            )}
          </ScrollView>
        )}
      </View>
      
      {/* Role Account Modal */}
      <Modal visible={roleAccountVisible} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.container}>
          <Header 
            title={selectedRole?.label || 'Role'}
            backgroundColor={selectedRole?.color}
            activeView={activeJournalView}
            onViewChange={(view: 'deposits' | 'ideas' | 'journal' | 'analytics') => {
              setActiveJournalView(view);
              if ((view === 'deposits' || view === 'ideas') && selectedRole) {
                fetchRoleTasks(selectedRole.id);
              }
            }}
            onSortPress={(activeJournalView === 'deposits' || activeJournalView === 'ideas') ? handleSortPress : undefined}
            onBackPress={() => setRoleAccountVisible(false)}
            onEditPress={() => {
              if (selectedRole) {
                handleEditRole(selectedRole);
              }
            }}
          />
          
          <View style={styles.content}>
            {(activeJournalView === 'deposits' || activeJournalView === 'ideas') && roleTasks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No {activeJournalView} currently associated with this Role
                </Text>
              </View>
            ) : (activeJournalView === 'deposits' || activeJournalView === 'ideas') ? (
              <ScrollView style={styles.tasksList} contentContainerStyle={styles.tasksListContent}>
                <View style={styles.tasksSection}>
                  {roleTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onComplete={handleCompleteTask}
                      onDoublePress={handleTaskDoublePress}
                    />
                  ))}
                </View>
              </ScrollView>
            ) : activeJournalView === 'journal' ? (
              renderJournalLedger()
            ) : activeJournalView === 'analytics' ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Analytics view coming soon!</Text>
              </View>
            ) : null}
            )}
            
            {/* Key Relationships Section - Always visible */}
            <ScrollView style={styles.tasksList} contentContainerStyle={styles.tasksListContent}>
              <View style={styles.krSection}>
                <Text style={styles.krSectionTitle}>Key Relationships</Text>
                
                {roleKeyRelationships.length > 0 && (
                  <View style={styles.krGrid}>
                    {roleKeyRelationships.map(kr => {
                      let imageUrl = null;
                      if (kr.image_path) {
                        try {
                          const supabase = getSupabaseClient();
                          const { data } = supabase.storage
                            .from('0008-key-relationship-images')
                            .getPublicUrl(kr.image_path);
                          imageUrl = data.publicUrl;
                          imageUrl = data.publicUrl;
                        } catch (error) {
                          console.error('Error loading image URL:', error);
                        }
                      }
                      return (
                        <TouchableOpacity
                          key={kr.id}
                          style={styles.krCard}
                          onPress={() => handleKRPress(kr)}
                        >
                          <TouchableOpacity 
                            style={styles.krEditIcon}
                            onPress={() => handleEditKR(kr)}
                          >
                            <Edit size={14} color="#6b7280" />
                          </TouchableOpacity>
                          <Text style={styles.krCardTitle}>{kr.name}</Text>
                          {imageUrl && (
                            <Image source={{ uri: imageUrl }} style={styles.krCardImage} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                
                {/* Universal Add Button - always available */}
                {roleKeyRelationships.length === 0 ? (
                  <TouchableOpacity 
                    style={styles.addKRButton}
                    onPress={() => setAddKRModalVisible(true)}
                  >
                    <Plus size={20} color="#0078d4" />
                    <Text style={styles.addKRButtonText}>Add Key Relationships</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={styles.addMoreKRButton}
                    onPress={() => setAddKRModalVisible(true)}
                  >
                    <Plus size={16} color="#0078d4" />
                    <Text style={styles.addMoreKRButtonText}>Add More</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.fab} 
              onPress={() => setTaskFormVisible(true)}
            >
              <Plus size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
      
      {/* Key Relationship Account Modal */}
      <Modal visible={krAccountVisible} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.container}>
          <Header 
            title={selectedKR?.name || 'Key Relationship'}
            activeView={activeJournalView}
            onViewChange={(view: 'deposits' | 'ideas' | 'journal' | 'analytics') => {
              setActiveJournalView(view);
              if ((view === 'deposits' || view === 'ideas') && selectedKR) {
                fetchKRTasks(selectedKR.id);
              }
            }}
            onSortPress={(activeJournalView === 'deposits' || activeJournalView === 'ideas') ? handleSortPress : undefined}
            onBackPress={() => setKrAccountVisible(false)}
            onEditPress={() => {
              if (selectedKR) {
                handleEditKR(selectedKR);
              }
            }}
          />
          
          <View style={styles.content}>
            {(activeJournalView === 'deposits' || activeJournalView === 'ideas') && krTasks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No {activeJournalView} currently associated with this Key Relationship
                </Text>
              </View>
            ) : (activeJournalView === 'deposits' || activeJournalView === 'ideas') ? (
              <ScrollView style={styles.tasksList} contentContainerStyle={styles.tasksListContent}>
                <View style={styles.tasksSection}>
                  {krTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onComplete={handleCompleteTask}
                      onDoublePress={handleTaskDoublePress}
                    />
                  ))}
                </View>
              </ScrollView>
            ) : activeJournalView === 'journal' ? (
              renderJournalLedger()
            ) : activeJournalView === 'analytics' ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Analytics view coming soon!</Text>
              </View>
            ) : null}
            )}
            
            <TouchableOpacity 
              style={styles.fab} 
              onPress={() => setTaskFormVisible(true)}
            >
              <Plus size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
      
      {/* Task Detail Modal */}
      <Modal visible={isDetailModalVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskDetailModal 
          visible={isDetailModalVisible}
          task={selectedTask}
          onClose={() => setIsDetailModalVisible(false)}
          onUpdate={handleUpdateTask}
          onDelegate={handleDelegateTask}
          onCancel={handleCancelTask}
        />
      </Modal>
      
      {/* Task Form Modal */}
      <Modal visible={taskFormVisible} animationType="slide" presentationStyle="pageSheet">
  <TaskEventForm
    mode={editingTask ? "edit" : "create"}
    initialData={editingTask || (selectedRole ? { selectedRoleIds: [selectedRole.id] } : undefined)}
    onSubmitSuccess={() => {
      setTaskFormVisible(false);
      setEditingTask(null);
      if (selectedRole) fetchRoleTasks(selectedRole.id);
      if (selectedKR) fetchKRTasks(selectedKR.id);
    }}
    onClose={() => {
      setTaskFormVisible(false);
      setEditingTask(null);
    }}
  />
</Modal>
      
      {/* Add Key Relationship Modal */}
      <Modal visible={addKRModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.addKRModalContent}>
            <View style={styles.addKRModalHeader}>
              <Text style={styles.addKRModalTitle}>Add Key Relationship</Text>
              <TouchableOpacity onPress={() => {
                setAddKRModalVisible(false);
                setNewKRName('');
              }}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.addKRModalBody}>
              <Text style={styles.addKRLabel}>
                {selectedRole ? `Add a key relationship for ${selectedRole.label}:` : 'Add a key relationship:'}
              </Text>
              <TextInput
                style={styles.addKRInput}
                placeholder="Enter relationship name (e.g., 'John Smith', 'My Manager')"
                value={newKRName}
                onChangeText={setNewKRName}
                autoFocus
              />
            </View>
            
            <View style={styles.addKRModalActions}>
              <TouchableOpacity 
                style={styles.addKRCancelButton}
                onPress={() => {
                  setAddKRModalVisible(false);
                  setNewKRName('');
                }}
              >
                <Text style={styles.addKRCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.addKRSaveButton, !newKRName.trim() && styles.addKRSaveButtonDisabled]}
                onPress={handleAddKeyRelationship}
                disabled={!newKRName.trim()}
              >
                <Text style={styles.addKRSaveButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Edit KR Modal */}
      <EditKRModal
        visible={editKRModalVisible}
        onClose={() => {
          setEditKRModalVisible(false);
          setEditingKR(null);
        }}
        onUpdate={() => {
          fetchAllKeyRelationships();
          if (selectedRole) {
            fetchRoleKeyRelationships(selectedRole.id);
          }
        }}
        keyRelationship={editingKR}
        roleName={editingKR ? roles.find(r => r.id === editingKR.role_id)?.label : undefined}
      />
      
      {/* Edit Role Modal */}
      <EditRoleModal
        visible={editRoleModalVisible}
        onClose={() => {
          setEditRoleModalVisible(false);
          setEditingRole(null);
        }}
        onUpdate={() => {
          fetchActiveRoles();
        }}
        role={editingRole}
      />
      
      <AddItemModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleAddRole}
        type="role"
        title="Add New Role"
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 32,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  rolesGrid: {
    gap: 16,
  },
  rolesGridMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  rolesGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  roleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 2,
    position: 'relative',
  },
  roleCardMobile: {
    width: '48%',
    marginHorizontal: 0,
  },
  roleCardTablet: {
    width: '48%',
    marginHorizontal: 0,
  },
  editIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 6,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
    alignItems: 'center',
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  roleCategory: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  
  tasksList: {
    flex: 1,
  },
  tasksListContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
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
  
  // Key Relationships Section Styles
  tasksSection: {
    marginBottom: 32,
  },
  krSection: {
    marginBottom: 32,
  },
  krSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  addKRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#0078d4',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    gap: 8,
  },
  addKRButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0078d4',
  },
  krGrid: {
    gap: 12,
    marginBottom: 16,
  },
  krCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    width: '48%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
  },
  krEditIcon: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    padding: 4,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  krCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  krCardImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignSelf: 'center',
  },
  krMainImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 12,
  },
  krMainImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 12,
  },
  roleMainImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 12,
  },
  addMoreKRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#0078d4',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  addMoreKRButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0078d4',
  },
  
  // Add KR Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addKRModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  addKRModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  addKRModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  addKRModalBody: {
    padding: 20,
  },
  addKRLabel: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 12,
    lineHeight: 24,
  },
  addKRInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  addKRModalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  addKRCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  addKRCancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  addKRSaveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0078d4',
    alignItems: 'center',
  },
  addKRSaveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  addKRSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  
  // Journal Ledger Styles
  journalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    margin: 16,
    overflow: 'hidden',
  },
  journalHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  journalHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  journalScrollView: {
    flex: 1,
  },
  journalRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  journalRowEven: {
    backgroundColor: '#ffffff',
  },
  journalRowOdd: {
    backgroundColor: '#f9fafb',
  },
  journalCellText: {
    fontSize: 11,
    color: '#374151',
    textAlign: 'center',
  },
  dateColumn: {
    width: '15%',
  },
  descriptionColumn: {
    width: '25%',
  },
  notesColumn: {
    width: '20%',
  },
  amountColumn: {
    width: '15%',
  },
  balanceColumn: {
    width: '10%',
  },
  depositText: {
    color: '#16a34a',
    fontWeight: '600',
  },
  withdrawalText: {
    color: '#dc2626',
    fontWeight: '600',
  },
  balanceText: {
    color: '#0078d4',
    fontWeight: '600',
  },
});