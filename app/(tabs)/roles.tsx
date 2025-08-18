import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, ScrollView, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Edit, UserX, Plus, ArrowUpDown, Bell, Search, Menu, User, FileText, ChartBar as BarChart3, Rocket, Paperclip, Users } from 'lucide-react-native';
import { Edit, UserX } from '@/ui/icons';
import { Header } from '@/components/Header';
import { AddItemModal } from '@/components/AddItemModal';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { supabase } from '@/lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { Animated } from 'react-native';

// Import TaskDetailModal from dashboard
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
    <View style={taskDetailStyles.detailContainer}>
      <View style={taskDetailStyles.detailHeader}>
        <Text style={taskDetailStyles.detailTitle}>Task Details</Text>
        <TouchableOpacity onPress={onClose}>
          <X size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>
      <ScrollView style={taskDetailStyles.detailContent}>
        <Text style={taskDetailStyles.detailTaskTitle}>{task.title}</Text>
        <View style={taskDetailStyles.detailSection}>
          <Text style={taskDetailStyles.detailLabel}>Due Date:</Text>
          <Text style={taskDetailStyles.detailValue}>{formatDateTime(task.due_date)}</Text>
        </View>
        {task.start_time && (
          <View style={taskDetailStyles.detailSection}>
            <Text style={taskDetailStyles.detailLabel}>Start Time:</Text>
            <Text style={taskDetailStyles.detailValue}>{formatDateTime(task.start_time)}</Text>
          </View>
        )}
        {task.end_time && (
          <View style={taskDetailStyles.detailSection}>
            <Text style={taskDetailStyles.detailLabel}>End Time:</Text>
            <Text style={taskDetailStyles.detailValue}>{formatDateTime(task.end_time)}</Text>
          </View>
        )}
        <View style={taskDetailStyles.detailSection}>
          <Text style={taskDetailStyles.detailLabel}>Priority:</Text>
          <Text style={taskDetailStyles.detailValue}>
            {task.is_urgent && task.is_important ? 'Urgent & Important' : 
             !task.is_urgent && task.is_important ? 'Important' : 
             task.is_urgent && !task.is_important ? 'Urgent' : 'Normal'}
          </Text>
        </View>
        {task.roles?.length > 0 && (
          <View style={taskDetailStyles.detailSection}>
            <Text style={taskDetailStyles.detailLabel}>Roles:</Text>
            <View style={taskDetailStyles.detailTagContainer}>
              {task.roles.map(role => (
                <View key={role.id} style={[taskDetailStyles.tag, taskDetailStyles.roleTag]}>
                  <Text style={taskDetailStyles.tagText}>{role.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {task.domains?.length > 0 && (
          <View style={taskDetailStyles.detailSection}>
            <Text style={taskDetailStyles.detailLabel}>Domains:</Text>
            <View style={taskDetailStyles.detailTagContainer}>
              {task.domains.map(domain => (
                <View key={domain.id} style={[taskDetailStyles.tag, taskDetailStyles.domainTag]}>
                  <Text style={taskDetailStyles.tagText}>{domain.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {taskNotes.length > 0 && (
          <View style={taskDetailStyles.detailSection}>
            <Text style={taskDetailStyles.detailLabel}>Notes:</Text>
            {loadingNotes ? (
              <Text style={taskDetailStyles.detailValue}>Loading notes...</Text>
            ) : (
              <View style={taskDetailStyles.notesContainer}>
                {taskNotes.map((note, index) => (
                  <View key={note.id} style={taskDetailStyles.noteItem}>
                    <Text style={taskDetailStyles.noteContent}>{note.content}</Text>
                    <Text style={taskDetailStyles.noteDate}>
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
        {task.goals?.length > 0 && (
          <View style={taskDetailStyles.detailSection}>
            <Text style={taskDetailStyles.detailLabel}>Goals:</Text>
            <View style={taskDetailStyles.detailTagContainer}>
              {task.goals.map(goal => (
                <View key={goal.id} style={[taskDetailStyles.tag, taskDetailStyles.goalTag]}>
                  <Text style={taskDetailStyles.tagText}>{goal.title}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
      <View style={taskDetailStyles.detailActions}>
        <TouchableOpacity 
          style={[taskDetailStyles.detailButton, taskDetailStyles.updateButton]} 
          onPress={() => onUpdate(task)}
        >
          <Edit size={16} color="#ffffff" />
          <Text style={taskDetailStyles.detailButtonText}>Update</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[taskDetailStyles.detailButton, taskDetailStyles.delegateButton]} 
          onPress={() => onDelegate(task)}
        >
          <UserX size={16} color="#ffffff" />
          <Text style={taskDetailStyles.detailButtonText}>Delegate</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[taskDetailStyles.detailButton, taskDetailStyles.cancelButton]} 
          onPress={() => onCancel(task)}
        >
          <Ban size={16} color="#ffffff" />
          <Text style={taskDetailStyles.detailButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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

// TaskCard Component - copied from dashboard
interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onLongPress?: () => void;
  onDoublePress?: (task: Task) => void;
}

function TaskCard({ task, onComplete, onLongPress, onDoublePress }: TaskCardProps) {
  const [lastTap, setLastTap] = useState(0);
  const celebrationAnim = new Animated.Value(0);
  const pointsAnim = new Animated.Value(0);

  const getBorderColor = () => {
    if (task.status === "completed") return "#3b82f6";
    if (task.is_urgent && task.is_important) return "#ef4444";
    if (!task.is_urgent && task.is_important) return "#22c55e";
    if (task.is_urgent && !task.is_important) return "#eab308";
    return "#9ca3af";
  };

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

  const formatDueDate = (date?: string) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 400;
    if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
      setLastTap(0);
      onDoublePress?.(task);
    } else {
      setLastTap(now);
    }
  };

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
              <View style={styles.tagRow}>
                <Text style={styles.tagRowLabel}>Roles:</Text>
                <View style={styles.tagContainer}>
                  {task.roles.slice(0, 3).map((role, index) => (
                    <View key={role.id} style={[styles.pillTag, styles.rolePillTag]}>
                      <Text style={styles.pillTagText}>{role.label}</Text>
                    </View>
                  ))}
                  {task.roles.length > 3 && (
                    <View style={[styles.pillTag, styles.morePillTag]}>
                      <Text style={styles.pillTagText}>+{task.roles.length - 3}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
          <View style={styles.middleSection}>
            {task.domains && task.domains.length > 0 && (
              <View style={styles.tagRow}>
                <Text style={styles.tagRowLabel}>Domains:</Text>
                <View style={styles.tagContainer}>
                  {task.domains.slice(0, 3).map((domain, index) => (
                    <View key={domain.id} style={[styles.pillTag, styles.domainPillTag]}>
                      <Text style={styles.pillTagText}>{domain.name}</Text>
                    </View>
                  ))}
                  {task.domains.length > 3 && (
                    <View style={[styles.pillTag, styles.morePillTag]}>
                      <Text style={styles.pillTagText}>+{task.domains.length - 3}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
            {task.goals && task.goals.length > 0 && (
              <View style={styles.tagRow}>
                <Text style={styles.tagRowLabel}>Goals:</Text>
                <View style={styles.tagContainer}>
                  {task.goals.slice(0, 3).map((goal, index) => (
                    <View key={goal.id} style={[styles.pillTag, styles.goalPillTag]}>
                      <Text style={styles.pillTagText}>{goal.title}</Text>
                    </View>
                  ))}
                  {task.goals.length > 3 && (
                    <View style={[styles.pillTag, styles.morePillTag]}>
                      <Text style={styles.pillTagText}>+{task.goals.length - 3}</Text>
                    </View>
                  )}
                </View>
              </View>
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
        <TouchableOpacity style={styles.completeButton} onPress={handleComplete}>
          <Rocket size={18} color="#0078d4" />
        </TouchableOpacity>
      </View>
      <Animated.View style={[styles.celebrationOverlay, { opacity: celebrationAnim, transform: [{ scale: celebrationAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.2, 1] }) }] }]} pointerEvents="none">
        <Text style={styles.celebrationText}>🎉 ⭐ 🎊</Text>
      </Animated.View>
      <Animated.View style={[styles.pointsAnimation, { opacity: pointsAnim, transform: [{ translateY: pointsAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -50] }) }] }]} pointerEvents="none">
        <Text style={styles.pointsAnimationText}>+{points}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function Roles() {
  const [modalVisible, setModalVisible] = useState(false);
  const [roleAccountVisible, setRoleAccountVisible] = useState(false);
  const [taskFormVisible, setTaskFormVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [roleTasks, setRoleTasks] = useState<Task[]>([]);
  const [activeView, setActiveView] = useState<'deposits' | 'ideas'>('deposits');
  const [sortOption, setSortOption] = useState('due_date');
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

  const handleTaskDoublePress = (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalVisible(true);
  };

  const handleUpdateTask = (task: Task) => {
    // Implementation for updating task
    setIsDetailModalVisible(false);
    console.log('Update task:', task);
  };

  const handleDelegateTask = (task: Task) => {
    // Implementation for delegating task
    setIsDetailModalVisible(false);
    console.log('Delegate task:', task);
  };

  const handleCancelTask = async (task: Task) => {
    const { error } = await supabase.from('0008-ap-tasks').update({ 
      status: 'cancelled' 
    }).eq('id', task.id);
    
    if (error) {
      console.log('Error', 'Failed to cancel task.');
    } else {
      console.log('Success', 'Task has been cancelled');
      setIsDetailModalVisible(false);
      if (selectedRole) {
        await fetchRoleTasks(selectedRole.id);
      }
    }
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

  const handleSortPress = () => {
    // Sort functionality can be implemented later
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
        <SafeAreaView style={styles.container}>
          <Header 
            title={selectedRole?.label || 'Role'}
            activeView={activeView}
            onViewChange={(view) => {
              setActiveView(view);
              if (selectedRole) fetchRoleTasks(selectedRole.id);
            }}
            onSortPress={handleSortPress}
            onBackPress={() => setRoleAccountVisible(false)}
          />
          
          <View style={styles.content}>
            {roleTasks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No {activeView} currently associated with this Role
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.tasksList} contentContainerStyle={styles.tasksListContent}>
                {roleTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleCompleteTask}
                    onDoublePress={handleTaskDoublePress}
                  />
                ))}
              </ScrollView>
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
  
  // Task Card Styles (copied from dashboard)
  tasksList: {
    flex: 1,
  },
  tasksListContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  taskCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderLeftWidth: 4,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    position: 'relative',
  },
  taskContent: {
    flex: 1,
    marginRight: 8,
  },
  taskHeader: {
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 22,
  },
  dueDate: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '400',
  },
  taskBody: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  leftSection: {
    flex: 1,
    marginRight: 8,
  },
  middleSection: {
    flex: 1,
    marginRight: 8,
  },
  iconsSection: {
    width: 30,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  tagRowLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    marginRight: 6,
    flexShrink: 0,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
  },
  pillTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  rolePillTag: {
    backgroundColor: '#fce7f3',
    borderColor: '#f3e8ff',
  },
  domainPillTag: {
    backgroundColor: '#fed7aa',
    borderColor: '#fdba74',
  },
  goalPillTag: {
    backgroundColor: '#bfdbfe',
    borderColor: '#93c5fd',
  },
  morePillTag: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  pillTagText: {
    fontSize: 8,
    fontWeight: '500',
    color: '#374151',
  },
  statusIcons: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  taskActions: {
    alignItems: 'center',
    gap: 8,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0078d4',
  },
  completeButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#0078d4',
    backgroundColor: '#ffffff',
  },
  celebrationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
  },
  celebrationText: {
    fontSize: 24,
  },
  pointsAnimation: {
    position: 'absolute',
    top: '50%',
    right: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointsAnimationText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
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
});

// Task Detail Modal Styles
const taskDetailStyles = StyleSheet.create({
  detailContainer: { 
    flex: 1, 
    backgroundColor: '#f8fafc' 
  },
  detailHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e7eb', 
    backgroundColor: '#ffffff' 
  },
  detailTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#1f2937' 
  },
  detailContent: { 
    flex: 1, 
    padding: 16 
  },
  detailTaskTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#1f2937', 
    marginBottom: 20 
  },
  detailSection: { 
    marginBottom: 16 
  },
  detailLabel: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#6b7280', 
    marginBottom: 4 
  },
  detailValue: { 
    fontSize: 16, 
    color: '#1f2937' 
  },
  detailTagContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 6, 
    marginTop: 4 
  },
  tag: { 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 12 
  },
  roleTag: { 
    backgroundColor: '#fce7f3' 
  },
  domainTag: { 
    backgroundColor: '#fed7aa' 
  },
  goalTag: { 
    backgroundColor: '#bfdbfe' 
  },
  tagText: { 
    fontSize: 10, 
    fontWeight: '500', 
    color: '#374151' 
  },
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
  detailActions: { 
    flexDirection: 'row', 
    padding: 16, 
    gap: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#e5e7eb', 
    backgroundColor: '#ffffff' 
  },
  detailButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    borderRadius: 8, 
    gap: 6 
  },
  updateButton: { 
    backgroundColor: '#0078d4' 
  },
  delegateButton: { 
    backgroundColor: '#7c3aed' 
  },
  cancelButton: { 
    backgroundColor: '#dc2626' 
  },
  detailButtonText: { 
    color: '#ffffff', 
    fontSize: 14, 
    fontWeight: '600' 
  },
});