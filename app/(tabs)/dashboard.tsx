import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Rocket, X, FileText, Paperclip, Users, Plus } from 'lucide-react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { Header } from '@/components/Header';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { supabase } from '@/lib/supabase';

interface Task {
  id: string;
  title: string;
  due_date?: string;
  is_urgent?: boolean;
  is_important?: boolean;
  status?: string;
  type?: string;
  roles?: Array<{id: string; label: string}>;
  domains?: Array<{id: string; name: string}>;
  goals?: Array<{id: string; title: string}>;
  authentic_score?: number;
  has_notes?: boolean;
  has_attachments?: boolean;
  has_delegates?: boolean;
}

interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
}

interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onLongPress?: () => void;
}

function TaskCard({ task, onComplete, onLongPress }: TaskCardProps) {
  const getBorderColor = () => {
    if (task.status === "completed") return "#3b82f6"; // blue
    if (task.is_urgent && task.is_important) return "#ef4444"; // red
    if (!task.is_urgent && task.is_important) return "#22c55e"; // green
    if (task.is_urgent && !task.is_important) return "#eab308"; // yellow
    return "#9ca3af"; // gray
  };

  const formatDueDate = (date?: string) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <TouchableOpacity 
      style={[styles.taskCard, { borderLeftColor: getBorderColor() }]}
      onLongPress={onLongPress}
      delayLongPress={200}
    >
      <View style={styles.taskContent}>
        <View style={styles.taskHeader}>
          <Text style={styles.taskTitle} numberOfLines={2}>
            {task.title}
          </Text>
          {task.due_date && (
            <Text style={styles.dueDate}>
              ({formatDueDate(task.due_date)})
            </Text>
          )}
        </View>
        
        <View style={styles.taskTags}>
          {task.roles && task.roles.length > 0 && (
            <View style={styles.tagGroup}>
              <Text style={styles.tagLabel}>R:</Text>
              {task.roles.map((role) => (
                <View key={role.id} style={[styles.tag, styles.roleTag]}>
                  <Text style={styles.tagText}>{role.label}</Text>
                </View>
              ))}
            </View>
          )}
          
          {task.domains && task.domains.length > 0 && (
            <View style={styles.tagGroup}>
              <Text style={styles.tagLabel}>D:</Text>
              {task.domains.map((domain) => (
                <View key={domain.id} style={[styles.tag, styles.domainTag]}>
                  <Text style={styles.tagText}>{domain.name}</Text>
                </View>
              ))}
            </View>
          )}
          
          {task.goals && task.goals.length > 0 && (
            <View style={styles.tagGroup}>
              <Text style={styles.tagLabel}>G:</Text>
              {task.goals.map((goal) => (
                <View key={goal.id} style={[styles.tag, styles.goalTag]}>
                  <Text style={styles.tagText}>{goal.title}</Text>
                </View>
              ))}
            </View>
          )}
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
        {task.authentic_score && (
          <Text style={styles.scoreText}>{task.authentic_score}</Text>
        )}
        <TouchableOpacity
          style={styles.completeButton}
          onPress={() => onComplete(task.id)}
        >
          <Rocket size={18} color="#0078d4" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function Dashboard() {
  const [activeView, setActiveView] = useState<'deposits' | 'ideas'>('deposits');
  const [sortOption, setSortOption] = useState('due_date');
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let tasksData;
      
      if (activeView === 'deposits') {
        // Fetch non-completed tasks with all relationships
        const { data, error } = await supabase
          .from('tasks_with_scores')
          .select(`
            *,
            task_roles:0007-ap-universal-roles-join!inner(
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
          .eq('type', 'deposit_idea')
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
        has_attachments: false, // Add attachment logic when available
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
        .update({ status: 'completed' })
        .eq('id', taskId);

      if (error) {
        console.error('Error completing task:', error);
        return;
      }

      // Refresh the list
      fetchData();
    } catch (error) {
      console.error('Error in handleCompleteTask:', error);
    }
  };

  const handleFormSubmitSuccess = () => {
    setIsFormModalVisible(false);
    fetchData(); // Refresh the task list
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
        authenticScore={85}
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
    borderLeftWidth: 8,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskContent: {
    flex: 1,
    marginRight: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  dueDate: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '400',
  },
  taskTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  tagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  tagLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleTag: {
    backgroundColor: '#e5e7eb',
  },
  domainTag: {
    backgroundColor: '#ddd6fe',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#374151',
  },
  goalTag: {
    backgroundColor: '#fef3c7',
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
});