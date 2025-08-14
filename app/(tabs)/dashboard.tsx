import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Rocket, X } from 'lucide-react-native';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';

interface Task {
  id: string;
  title: string;
  due_date?: string;
  is_urgent?: boolean;
  is_important?: boolean;
  status?: string;
  type?: string;
  roles?: string[];
  domains?: string[];
  authentic_score?: number;
}

interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
}

function TaskCard({ task, onComplete }: TaskCardProps) {
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
    <View style={[styles.taskCard, { borderLeftColor: getBorderColor() }]}>
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
              {task.roles.map((role, index) => (
                <View key={index} style={[styles.tag, styles.roleTag]}>
                  <Text style={styles.tagText}>{role}</Text>
                </View>
              ))}
            </View>
          )}
          
          {task.domains && task.domains.length > 0 && (
            <View style={styles.tagGroup}>
              <Text style={styles.tagLabel}>D:</Text>
              {task.domains.map((domain, index) => (
                <View key={index} style={[styles.tag, styles.domainTag]}>
                  <Text style={styles.tagText}>{domain}</Text>
                </View>
              ))}
            </View>
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
    </View>
  );
}

export default function Dashboard() {
  const [activeView, setActiveView] = useState<'deposits' | 'ideas'>('deposits');
  const [sortOption, setSortOption] = useState('due_date');
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query;
      
      if (activeView === 'deposits') {
        // Fetch non-completed tasks from tasks_with_scores view
        query = supabase
          .from('tasks_with_scores')
          .select('*')
          .eq('user_id', user.id)
          .neq('status', 'completed');
      } else {
        // Fetch deposit ideas
        query = supabase
          .from('0007-ap-tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'deposit_idea');
      }

      // Apply sorting
      if (sortOption === 'due_date') {
        query = query.order('due_date', { ascending: true, nullsLast: true });
      } else if (sortOption === 'priority') {
        query = query.order('is_urgent', { ascending: false })
                    .order('is_important', { ascending: false });
      } else if (sortOption === 'title') {
        query = query.order('title', { ascending: true });
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching tasks:', error);
        return;
      }

      setTasks(data || []);
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
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.taskList}>
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
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={handleCompleteTask}
              />
            ))
          )}
        </View>
      </ScrollView>

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
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  taskList: {
    paddingBottom: 20,
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