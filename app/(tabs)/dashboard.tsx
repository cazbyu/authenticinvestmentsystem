import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Rocket, X, FileText, Paperclip, Users, Plus, Edit, UserX, Ban } from 'lucide-react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { Header } from '@/components/Header';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { supabase } from '@/lib/supabase';

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
    
    // Role points
    if (task.roles && task.roles.length > 0) {
      points += task.roles.length;
    }
    
    // Domain points
    if (task.domains && task.domains.length > 0) {
      points += task.domains.length;
    }
    
    // Authentic deposit points (max 14 per week)
    if (task.is_authentic_deposit) {
      points += 2;
    }
    
    // Priority-based completion points
    if (task.is_urgent && task.is_important) {
      points += 1.5; // UI
    } else if (!task.is_urgent && task.is_important) {
      points += 3; // NUI
    } else if (task.is_urgent && !task.is_important) {
      points += 1; // UNI
    } else {
      points += 0.5; // NUNI
    }
    
    // 12-week goal points
    if (task.is_twelve_week_goal) {
      points += 2;
    }
    
    return Math.round(points * 10) / 10; // Round to 1 decimal place
  };

  const formatDueDate = (date?: string) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    
    if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
      // Double tap detected
      onDoublePress?.(task);
    } else {
      // Single tap
      setLastTap(now);
    }
  };

  const triggerCelebration = () => {
    // Reset animations
    celebrationAnim.setValue(0);
    pointsAnim.setValue(0);
    
    // Start celebration animation
    Animated.parallel([
      Animated.timing(celebrationAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(pointsAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pointsAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
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
            {task.due_date && (
              <Text style={styles.dueDate}> ({formatDueDate(task.due_date)})</Text>
            )}
          </Text>
        </View>
        
        <View style={styles.taskBody}>
          <View style={styles.leftSection}>
            {/* Roles */}
            {task.roles && task.roles.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={styles.tagSectionLabel}>Roles:</Text>
                <View style={styles.tagContainer}>
                  {task.roles.map((role) => (
                    <View key={role.id} style={[styles.tag, styles.roleTag]}>
                      <Text style={styles.tagText}>{role.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
          
          <View style={styles.rightSection}>
            {/* Domains */}
            {task.domains && task.domains.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={styles.tagSectionLabel}>Domains:</Text>
                <View style={styles.tagContainer}>
                  {task.domains.map((domain) => (
                    <View key={domain.id} style={[styles.tag, styles.domainTag]}>
                      <Text style={styles.tagText}>{domain.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            
            {/* Goals */}
            {task.goals && task.goals.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={styles.tagSectionLabel}>Goals:</Text>
                <View style={styles.tagContainer}>
                  {task.goals.map((goal) => (
                    <View key={goal.id} style={[styles.tag, styles.goalTag]}>
                      <Text style={styles.tagText}>{goal.title}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>
        
        {/* Status Icons */}
        <View style={styles.statusIcons}>
          {task.has_notes && (
            <FileText size={14} color="#6b7280" />
          )}
          {task.has_attachments && (
            <Paperclip size={14} color="#6b7280" />
          )}
          {task.has_delegates && (
            <Users size={14} color="#6b7280" />
          )}
        </View>
      </View>
      
      <View style={styles.taskActions}>
        <Text style={styles.scoreText}>+{points}</Text>
        <TouchableOpacity
          style={styles.completeButton}
          onPress={handleComplete}
        >
          <Rocket size={18} color="#0078d4" />
        </TouchableOpacity>
      </View>

      {/* Celebration Animation Overlay */}
      <Animated.View 
        style={[
          styles.celebrationOverlay,
          {
            opacity: celebrationAnim,
            transform: [{
              scale: celebrationAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.8, 1.2, 1],
              })
            }]
          }
        ]}
        pointerEvents="none"
      >
        <Text style={styles.celebrationText}>🎉 ⭐ 🎊</Text>
      </Animated.View>

      {/* Points Animation */}
      <Animated.View 
        style={[
          styles.pointsAnimation,
          {
            opacity: pointsAnim,
            transform: [{
              translateY: pointsAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -50],
              })
            }]
          }
        ]}
        pointerEvents="none"
      >
        <Text style={styles.pointsAnimationText}>+{points}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

interface TaskDetailModalProps {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onDelegate: (task: Task) => void;
  onCancel: (task: Task) => void;
}

function TaskDetailModal({ visible, task, onClose, onUpdate, onDelegate, onCancel }: TaskDetailModalProps) {
  if (!task) return null;

  const formatDateTime = (dateTime?: string) => {
    if (!dateTime) return 'Not set';
    const date = new Date(dateTime);
    return date.toLocaleString();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.detailContainer}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>Task Details</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.detailContent}>
          <Text style={styles.detailTaskTitle}>{task.title}</Text>
          
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Due Date:</Text>
            <Text style={styles.detailValue}>{task.due_date ? formatDateTime(task.due_date) : 'Not set'}</Text>
          </View>

          {task.start_time && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Start Time:</Text>
              <Text style={styles.detailValue}>{formatDateTime(task.start_time)}</Text>
            </View>
          )}

          {task.end_time && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>End Time:</Text>
              <Text style={styles.detailValue}>{formatDateTime(task.end_time)}</Text>
            </View>
          )}

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Priority:</Text>
            <Text style={styles.detailValue}>
              {task.is_urgent && task.is_important ? 'Urgent & Important' :
               !task.is_urgent && task.is_important ? 'Important' :
               task.is_urgent && !task.is_important ? 'Urgent' :
               'Normal'}
            </Text>
          </View>

          {task.roles && task.roles.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Roles:</Text>
              <View style={styles.detailTagContainer}>
                {task.roles.map((role) => (
                  <View key={role.id} style={[styles.tag, styles.roleTag]}>
                    <Text style={styles.tagText}>{role.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {task.domains && task.domains.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Domains:</Text>
              <View style={styles.detailTagContainer}>
                {task.domains.map((domain) => (
                  <View key={domain.id} style={[styles.tag, styles.domainTag]}>
                    <Text style={styles.tagText}>{domain.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {task.goals && task.goals.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Goals:</Text>
              <View style={styles.detailTagContainer}>
                {task.goals.map((goal) => (
                  <View key={goal.id} style={[styles.tag, styles.goalTag]}>
                    <Text style={styles.tagText}>{goal.title}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.detailActions}>
          <TouchableOpacity 
            style={[styles.detailButton, styles.updateButton]}
            onPress={() => onUpdate(task)}
          >
            <Edit size={16} color="#ffffff" />
            <Text style={styles.detailButtonText}>Update</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.detailButton, styles.delegateButton]}
            onPress={() => onDelegate(task)}
          >
            <UserX size={16} color="#ffffff" />
            <Text style={styles.detailButtonText}>Delegate</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.detailButton, styles.cancelButton]}
            onPress={() => onCancel(task)}
          >
            <Ban size={16} color="#ffffff" />
            <Text style={styles.detailButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function Dashboard() {
  const [activeView, setActiveView] = useState<'deposits' | 'ideas'>('deposits');
  const [sortOption, setSortOption] = useState('due_date');
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [authenticScore, setAuthenticScore] = useState(85);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let tasksData;
      
      if (activeView === 'deposits') {
        // Fetch non-completed tasks and events with all relationships
        const { data, error } = await supabase
          .from('0007-ap-tasks')
          .select(`
            *,
            task_roles:0007-ap-universal-roles-join(
              role:0007-ap-roles(id, label)
            ),
            task_domains:0007-ap-universal-domains-join(
              domain:0007-ap-domains(id, name)
            ),
            task_goals:0007-ap-universal-goals-join(
              goal:0007-ap-goals-12wk(id, title)
            ),
            task_notes:0007-ap-universal-notes-join(note_id),
            task_delegates:0007-ap-universal-delegates-join(delegate_id)
          `)
          .eq('user_id', user.id)
          .neq('status', 'completed')
          .neq('status', 'cancelled')
          .in('type', ['task', 'event'])
          .eq('0007-ap-universal-roles-join.parent_type', 'task')
          .eq('0007-ap-universal-domains-join.parent_type', 'task')
          .eq('0007-ap-universal-goals-join.parent_type', 'task')
          .eq('0007-ap-universal-notes-join.parent_type', 'task')
          .eq('0007-ap-universal-delegates-join.parent_type', 'task');
        
        if (error) {
          console.error('Error fetching deposits:', error);
          return;
        }
        tasksData = data;
      } else {
        // Fetch deposit ideas with all relationships
        const { data, error } = await supabase
          .from('0007-ap-tasks')
          .select(`
            *,
            task_roles:0007-ap-universal-roles-join(
              role:0007-ap-roles(id, label)
            ),
            task_domains:0007-ap-universal-domains-join(
              domain:0007-ap-domains(id, name)
            ),
            task_goals:0007-ap-universal-goals-join(
              goal:0007-ap-goals-12wk(id, title)
            ),
            task_notes:0007-ap-universal-notes-join(note_id),
            task_delegates:0007-ap-universal-delegates-join(delegate_id)
          `)
          .eq('user_id', user.id)
          .eq('type', 'depositIdea')
          .eq('0007-ap-universal-roles-join.parent_type', 'task')
          .eq('0007-ap-universal-domains-join.parent_type', 'task')
          .eq('0007-ap-universal-goals-join.parent_type', 'task')
          .eq('0007-ap-universal-notes-join.parent_type', 'task')
          .eq('0007-ap-universal-delegates-join.parent_type', 'task');
        
        if (error) {
          console.error('Error fetching ideas:', error);
          return;
        }
        tasksData = data;
      }

      // Transform the data to include relationships
      const transformedTasks = tasksData?.map(task => ({
        ...task,
        roles: task.task_roles?.map((tr: any) => tr.role).filter(Boolean) || [],
        domains: task.task_domains?.map((td: any) => td.domain).filter(Boolean) || [],
        goals: task.task_goals?.map((tg: any) => tg.goal).filter(Boolean) || [],
        has_notes: (task.task_notes?.length || 0) > 0,
        has_attachments: false,
        has_delegates: (task.task_delegates?.length || 0) > 0,
      })) || [];

      // Apply client-side sorting
      let sortedTasks = [...transformedTasks];
      if (sortOption === 'due_date') {
        sortedTasks.sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        });
      } else if (sortOption === 'priority') {
        sortedTasks.sort((a, b) => {
          const aPriority = (a.is_urgent ? 2 : 0) + (a.is_important ? 1 : 0);
          const bPriority = (b.is_urgent ? 2 : 0) + (b.is_important ? 1 : 0);
          return bPriority - aPriority;
        });
      } else if (sortOption === 'title') {
        sortedTasks.sort((a, b) => a.title.localeCompare(b.title));
      }

      setTasks(sortedTasks);
    } catch (error) {
      console.error('Error in fetchData:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeView, sortOption]);

  const handleCompleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('0007-ap-tasks')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) {
        console.error('Error completing task:', error);
        return;
      }

      // Update authentic score (simplified - you may want more complex logic)
      const completedTask = tasks.find(t => t.id === taskId);
      if (completedTask) {
        const points = calculateTaskPoints(completedTask);
        setAuthenticScore(prev => prev + points);
      }

      // Refresh the list
      fetchData();
    } catch (error) {
      console.error('Error in handleCompleteTask:', error);
    }
  };

  const calculateTaskPoints = (task: Task) => {
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

  const handleTaskDoublePress = (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalVisible(true);
  };

  const handleUpdateTask = (task: Task) => {
    // TODO: Implement task update functionality
    Alert.alert('Update', 'Task update functionality coming soon!');
    setIsDetailModalVisible(false);
  };

  const handleDelegateTask = (task: Task) => {
    // TODO: Implement task delegation functionality
    Alert.alert('Delegate', 'Task delegation functionality coming soon!');
    setIsDetailModalVisible(false);
  };

  const handleCancelTask = async (task: Task) => {
    try {
      const { error } = await supabase
        .from('0007-ap-tasks')
        .update({ status: 'cancelled' })
        .eq('id', task.id);

      if (error) {
        console.error('Error cancelling task:', error);
        Alert.alert('Error', 'Failed to cancel task');
        return;
      }

      Alert.alert('Success', 'Task has been cancelled');
      setIsDetailModalVisible(false);
      fetchData(); // Refresh the list
    } catch (error) {
      console.error('Error in handleCancelTask:', error);
      Alert.alert('Error', 'Failed to cancel task');
    }
  };

  const handleFormSubmitSuccess = () => {
    setIsFormModalVisible(false);
    fetchData();
  };

  const handleDragEnd = ({ data }: { data: Task[] }) => {
    setTasks(data);
  };

  const renderDraggableItem = ({ item, drag, isActive }: RenderItemParams<Task>) => (
    <View style={[isActive && styles.draggingItem]}>
      <TaskCard
        task={item}
        onComplete={handleCompleteTask}
        onLongPress={drag}
        onDoublePress={handleTaskDoublePress}
      />
    </View>
  );

  const sortOptions = [
    { value: 'due_date', label: 'Due Date' },
    { value: 'priority', label: 'Priority' },
    { value: 'title', label: 'Title' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Header
        activeView={activeView}
        onViewChange={setActiveView}
        onSortPress={() => setIsSortModalVisible(true)}
        authenticScore={authenticScore}
      />
      
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No {activeView} found
            </Text>
          </View>
        ) : activeView === 'deposits' ? (
          <DraggableFlatList
            data={tasks}
            renderItem={renderDraggableItem}
            keyExtractor={(item) => item.id}
            onDragEnd={handleDragEnd}
            contentContainerStyle={styles.taskList}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.taskList}>
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={handleCompleteTask}
                  onDoublePress={handleTaskDoublePress}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsFormModalVisible(true)}
      >
        <Plus size={24} color="#ffffff" />
      </TouchableOpacity>

      {/* Task Creation Form Modal */}
      <Modal
        visible={isFormModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <TaskEventForm
          mode="create"
          onSubmitSuccess={handleFormSubmitSuccess}
          onClose={() => setIsFormModalVisible(false)}
        />
      </Modal>

      {/* Task Detail Modal */}
      <TaskDetailModal
        visible={isDetailModalVisible}
        task={selectedTask}
        onClose={() => setIsDetailModalVisible(false)}
        onUpdate={handleUpdateTask}
        onDelegate={handleDelegateTask}
        onCancel={handleCancelTask}
      />

      {/* Sort Modal */}
      <Modal
        visible={isSortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSortModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort by</Text>
              <TouchableOpacity
                onPress={() => setIsSortModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.sortOptions}>
              {sortOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.sortOption,
                    sortOption === option.value && styles.activeSortOption
                  ]}
                  onPress={() => {
                    setSortOption(option.value);
                    setIsSortModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.sortOptionText,
                    sortOption === option.value && styles.activeSortOptionText
                  ]}>
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
  content: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  taskList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  draggingItem: {
    opacity: 0.8,
    transform: [{ scale: 1.02 }],
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
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    position: 'relative',
  },
  taskContent: {
    flex: 1,
    marginRight: 12,
  },
  taskHeader: {
    marginBottom: 12,
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
    marginBottom: 8,
  },
  leftSection: {
    flex: 1,
    marginRight: 12,
  },
  rightSection: {
    flex: 1,
  },
  tagSection: {
    marginBottom: 8,
  },
  tagSectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleTag: {
    backgroundColor: '#fce7f3',
  },
  domainTag: {
    backgroundColor: '#fed7aa',
  },
  goalTag: {
    backgroundColor: '#bfdbfe',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#374151',
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
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
    backgroundColor: '#f0f9ff',
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0078d4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
  sortOptions: {
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
  // Task Detail Modal Styles
  detailContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  detailContent: {
    flex: 1,
    padding: 16,
  },
  detailTaskTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#1f2937',
  },
  detailTagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  detailActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  detailButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  updateButton: {
    backgroundColor: '#0078d4',
  },
  delegateButton: {
    backgroundColor: '#7c3aed',
  },
  cancelButton: {
    backgroundColor: '#dc2626',
  },
  detailButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});