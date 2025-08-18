import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, ScrollView, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Plus, ArrowUpDown, Bell, Search, Menu, User, FileText, ChartBar as BarChart3 } from 'lucide-react-native';
import { Header } from '@/components/Header';
import { AddItemModal } from '@/components/AddItemModal';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { supabase } from '@/lib/supabase';
import { useIsFocused } from '@react-navigation/native';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

interface Role {
  id: string;
  label: string;
  category?: string;
  is_active: boolean;
}

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

export default function Roles() {
  const [modalVisible, setModalVisible] = useState(false);
  const [roleAccountVisible, setRoleAccountVisible] = useState(false);
  const [taskFormVisible, setTaskFormVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleTasks, setRoleTasks] = useState<Task[]>([]);
  const [activeView, setActiveView] = useState<'deposits' | 'ideas'>('deposits');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();
  const router = useRouter();

  useEffect(() => {
    if (isFocused) {
      fetchActiveRoles();
    }
  }, [isFocused]);

  const fetchActiveRoles = async () => {
    setLoading(true);
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
      console.log("Error", "Could not fetch roles. Please check your connection and database policies.");
    } else {
      setRoles(data || []);
    }
    setLoading(false);
  };

  const handleAddRole = (data: any) => {
    console.log('Adding new role:', data);
    setModalVisible(false);
    fetchActiveRoles();
  };

  const handleRolePress = async (role: Role) => {
    setSelectedRole(role);
    await fetchRoleTasks(role.id);
    setRoleAccountVisible(true);
  };

  const fetchRoleTasks = async (roleId: string) => {
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
    if (tasksError) {
      console.error('Error fetching role tasks:', tasksError);
      return;
    }

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
  };

  const handleCompleteTask = async (taskId: string) => {
    const { error } = await supabase.from('0008-ap-tasks').update({ 
      status: 'completed', 
      completed_at: new Date().toISOString() 
    }).eq('id', taskId);
    
    if (error) {
      console.log('Error', 'Failed to complete task.');
    } else {
      if (selectedRole) {
        await fetchRoleTasks(selectedRole.id);
      }
    }
  };

  const calculatePoints = (task: Task) => {
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

  const getBorderColor = (task: Task) => {
    if (task.status === "completed") return "#3b82f6";
    if (task.is_urgent && task.is_important) return "#ef4444";
    if (!task.is_urgent && task.is_important) return "#22c55e";
    if (task.is_urgent && !task.is_important) return "#eab308";
    return "#9ca3af";
  };

  const formatDueDate = (date?: string) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const renderRoleCard = (role: Role) => {
    return (
      <TouchableOpacity
        key={role.id}
        style={[
          styles.roleCard,
          isTablet ? styles.roleCardTablet : styles.roleCardMobile,
          hoveredCard === role.id && styles.roleCardHovered
        ]}
        onPress={() => handleRolePress(role)}
        onPressIn={() => setHoveredCard(role.id)}
        onPressOut={() => setHoveredCard(null)}
      >
        <View style={styles.cardContent}>
          <Text style={styles.roleTitle}>{role.label}</Text>
          <Text style={styles.roleCategory}>{role.category || 'Custom'}</Text>
        </View>
      </TouchableOpacity>
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
            <View style={[
              styles.rolesGrid,
              isTablet ? styles.rolesGridTablet : styles.rolesGridMobile
            ]}>
              {roles.map(renderRoleCard)}
            </View>
          </ScrollView>
        )}
      </View>
      
      {/* Role Account Modal */}
      <Modal visible={roleAccountVisible} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.roleAccountContainer}>
          {/* Header */}
          <View style={styles.roleAccountHeader}>
            <TouchableOpacity onPress={() => setRoleAccountVisible(false)} style={styles.menuButton}>
              <Menu size={24} color="#ffffff" />
            </TouchableOpacity>
            
            <View style={styles.roleAccountTitleSection}>
              <Text style={styles.roleAccountTitle}>{selectedRole?.label || 'Role'}</Text>
              <Text style={styles.roleAccountSubtitle}>Why Statement?</Text>
              <Text style={styles.roleAccountDescription}>Guiding principles and core focus</Text>
            </View>
            
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.headerIcon}>
                <Bell size={20} color="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIcon}>
                <Search size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Action Buttons Row */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Deposits</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Ideas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Role Journal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Analytics</Text>
            </TouchableOpacity>
          </View>
          
          {/* Toggle and Controls */}
          <View style={styles.controlsRow}>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, activeView === 'deposits' && styles.activeToggle]}
                onPress={() => {
                  setActiveView('deposits');
                  if (selectedRole) fetchRoleTasks(selectedRole.id);
                }}
              >
                <Text style={[styles.toggleText, activeView === 'deposits' && styles.activeToggleText]}>
                  Deposits
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, activeView === 'ideas' && styles.activeToggle]}
                onPress={() => {
                  setActiveView('ideas');
                  if (selectedRole) fetchRoleTasks(selectedRole.id);
                }}
              >
                <Text style={[styles.toggleText, activeView === 'ideas' && styles.activeToggleText]}>
                  Ideas
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.rightControls}>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => setTaskFormVisible(true)}
              >
                <Plus size={16} color="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.sortButton}>
                <Text style={styles.sortButtonText}>Sort</Text>
                <ArrowUpDown size={14} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Tasks List */}
          <ScrollView style={styles.roleTasksList}>
            {roleTasks.map((task, index) => (
              <View key={task.id} style={[styles.roleTaskCard, { borderLeftColor: getBorderColor(task) }]}>
                <View style={styles.taskNumber}>
                  <Text style={styles.taskNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.roleTaskContent}>
                  <Text style={styles.roleTaskTitle}>
                    {task.title} {task.due_date && `(${formatDueDate(task.due_date)})`}
                  </Text>
                  <View style={styles.roleTaskTags}>
                    {task.roles?.slice(0, 3).map(role => (
                      <View key={role.id} style={[styles.taskTag, styles.roleTaskTag]}>
                        <Text style={styles.taskTagText}>{role.label}</Text>
                      </View>
                    ))}
                    {task.domains?.slice(0, 3).map(domain => (
                      <View key={domain.id} style={[styles.taskTag, styles.domainTaskTag]}>
                        <Text style={styles.taskTagText}>{domain.name}</Text>
                      </View>
                    ))}
                    {task.goals?.slice(0, 3).map(goal => (
                      <View key={goal.id} style={[styles.taskTag, styles.goalTaskTag]}>
                        <Text style={styles.taskTagText}>{goal.title}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.roleTaskActions}>
                  <View style={styles.taskIcons}>
                    {task.has_notes && <FileText size={12} color="#6b7280" />}
                  </View>
                  <Text style={styles.roleTaskPoints}>+ {calculatePoints(task)}</Text>
                  <TouchableOpacity 
                    style={styles.roleCompleteButton}
                    onPress={() => handleCompleteTask(task.id)}
                  >
                    <User size={16} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
          
          {/* Profile Section at Bottom */}
          <View style={styles.profileSection}>
            <View style={styles.profileCard}>
              <User size={40} color="#6b7280" />
              <Text style={styles.profileName}>Name</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
      
      {/* Task Form Modal */}
      <Modal visible={taskFormVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode="create"
          initialData={selectedRole ? { selectedRoleIds: [selectedRole.id] } : undefined}
          onSubmitSuccess={() => {
            setTaskFormVisible(false);
            if (selectedRole) fetchRoleTasks(selectedRole.id);
          }}
          onClose={() => setTaskFormVisible(false)}
        />
      </Modal>
      
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
  rolesGrid: {
    gap: 16,
  },
  rolesGridMobile: {
    flexDirection: 'column',
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
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  roleCardMobile: {
    width: '100%',
    marginHorizontal: 0,
  },
  roleCardTablet: {
    width: '48%',
    marginHorizontal: 0,
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
});