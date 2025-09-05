import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Check, FileText, Paperclip, Users } from 'lucide-react-native';

// Interface for a Task
export interface Task {
  id: string;
  title: string;
  due_date?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  recurrence_rule?: string;
  recurrence_rule?: string;
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
  logs?: Array<{ log_date: string; completed: boolean }>; // Added for GoalProgressCard
  keyRelationships?: Array<{id: string; name: string}>;
}

// Props for the TaskCard component
interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onLongPress?: () => void;
  onDoublePress?: (task: Task) => void;
  isDragging?: boolean;
}

// --- TaskCard Component ---
// Renders a single task item in the list
export const TaskCard = React.forwardRef<View, TaskCardProps>(
  ({ task, onComplete, onLongPress, onDoublePress, isDragging }, ref) => {
    const [lastTap, setLastTap] = useState(0);

  // Determines the border color based on task priority
  const getBorderColor = () => {
    if (task.status === "completed") return "#3b82f6";
    if (task.is_urgent && task.is_important) return "#ef4444";
    if (!task.is_urgent && task.is_important) return "#22c55e";
    if (task.is_urgent && !task.is_important) return "#eab308";
    return "#9ca3af";
  };

  // Calculates points for completing a task
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

  // Formats the due date string
  const formatDueDate = (date?: string) => {
    if (!date) return "";
    try {
      // Always parse date-only strings as local dates to avoid timezone shifts
      const [year, month, day] = date.split('T')[0].split('-').map(Number);
      const d = new Date(year, month - 1, day);
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      return `${months[d.getMonth()]} ${d.getDate()}`;
    } catch (error) {
      console.error('Error formatting date:', date, error);
      return "";
    }
  };

  const DOUBLE_PRESS_DELAY = 300;

  const handlePress = () => {
    const now = Date.now();
    if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
      setLastTap(0); // Reset to prevent triple-tap issues
      onDoublePress?.(task);
    } else {
      setLastTap(now);
    }
  };


  // Handles the completion of a task
  const handleComplete = () => {
    onComplete(task.id);
  };

  const points = calculatePoints();

  return (
    <TouchableOpacity
      ref={ref}
      style={[styles.taskCard, { borderLeftColor: getBorderColor() }, isDragging && styles.draggingItem]}
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={200}
    >
        <View style={styles.taskContent}>
          <View style={styles.taskHeader}>
            <Text style={styles.taskTitle} numberOfLines={2}>
  {task.title}
  {task.due_date && <Text style={styles.dueDate}> ({formatDueDate(task.due_date)})</Text>}
  {task.goals && task.goals[0] && (
    <Text style={styles.inlineGoalChip}>  •  {task.goals[0].title}</Text>
  )}
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
          </View>
        </View>
        <View style={styles.rightSection}>
          <View style={styles.statusIcons}>
            {task.has_notes && <FileText size={12} color="#6b7280" />}
            {task.has_attachments && <Paperclip size={12} color="#6b7280" />}
            {task.has_delegates && <Users size={12} color="#6b7280" />}
          </View>
          <View style={styles.taskActions}>
            <TouchableOpacity style={styles.completeButton} onPress={handleComplete}>
              <View style={styles.checkmarkContainer}>
                <Check size={20} color="#16a34a" strokeWidth={3} />
              </View>
            </TouchableOpacity>
            <Text style={styles.scoreText}>+{points}</Text>
          </View>
        </View>
    </TouchableOpacity>
  );
  });

  const styles = StyleSheet.create({
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
      
    inlineGoalChip: {
  fontSize: 12,
  fontWeight: '500',
  color: '#1f2937',
},
    
    leftSection: {
        flex: 1,
        marginRight: 8,
      },
      middleSection: {
        flex: 1,
        marginRight: 8,
      },
      rightSection: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        minWidth: 60,
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 8,
      },
      taskActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      },
      scoreText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0078d4',
      },
      completeButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
      },
      checkmarkContainer: {
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
      },
      draggingItem: {
        opacity: 0.8,
        transform: [{ scale: 1.02 }],
      },
  });