import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { X, Plus, Calendar, Trash2, CreditCard as Edit, ChevronDown, ChevronUp } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { Calendar as RNCalendar } from 'react-native-calendars';
import { formatLocalDate, parseLocalDate } from '@/lib/dateUtils';

interface OneYearGoal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: string;
  priority?: number;
  year_target_date?: string;
  created_at: string;
  updated_at: string;
}

interface OneYearGoalsManagerProps {
  onUpdate?: () => void;
}

export function OneYearGoalsManager({ onUpdate }: OneYearGoalsManagerProps) {
  const [goals, setGoals] = useState<OneYearGoal[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<OneYearGoal | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 5,
    targetDate: '',
  });

  const [showCalendar, setShowCalendar] = useState(false);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-goals-1y')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error('Error fetching 1-year goals:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 5,
      targetDate: '',
    });
    setEditingGoal(null);
  };

  const handleCreateGoal = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a goal title');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const goalData = {
        user_id: user.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status: 'active',
      };

      if (editingGoal) {
        const { error } = await supabase
          .from('0008-ap-goals-1y')
          .update({
            ...goalData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingGoal.id);

        if (error) throw error;
        Alert.alert('Success', 'Goal updated successfully!');
      } else {
        const { error } = await supabase
          .from('0008-ap-goals-1y')
          .insert(goalData);

        if (error) throw error;
        Alert.alert('Success', '1-year goal created successfully!');
      }

      setShowCreateForm(false);
      resetForm();
      fetchGoals();
      onUpdate?.();
    } catch (error) {
      console.error('Error saving goal:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditGoal = (goal: OneYearGoal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      description: goal.description || '',
      priority: goal.priority || 5,
      targetDate: goal.year_target_date || '',
    });
    setShowCreateForm(true);
  };

  const handleArchiveGoal = async (goal: OneYearGoal) => {
    Alert.alert(
      'Archive Goal',
      `Are you sure you want to archive "${goal.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              const { error } = await supabase
                .from('0008-ap-goals-1y')
                .update({ status: 'archived', updated_at: new Date().toISOString() })
                .eq('id', goal.id);

              if (error) throw error;
              Alert.alert('Success', 'Goal archived successfully');
              fetchGoals();
              onUpdate?.();
            } catch (error) {
              console.error('Error archiving goal:', error);
              Alert.alert('Error', (error as Error).message);
            }
          }
        }
      ]
    );
  };

  const handleStartCreate = () => {
    resetForm();
    setShowCreateForm(true);
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    resetForm();
  };

  const priorityLabels: Record<number, string> = {
    1: 'Low',
    3: 'Low-Medium',
    5: 'Medium',
    7: 'Medium-High',
    10: 'High',
  };

  if (showCreateForm) {
    return (
      <View style={styles.formContainer}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>
            {editingGoal ? 'Edit 1-Year Goal' : 'Create 1-Year Goal'}
          </Text>
          <TouchableOpacity onPress={handleCancelCreate}>
            <X size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Goal Title *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              placeholder="e.g., Launch my own business, Run a marathon"
              placeholderTextColor="#9ca3af"
              maxLength={200}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              placeholder="Describe what success looks like for this goal..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              maxLength={1000}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Target Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowCalendar(true)}
            >
              <Text style={styles.dateButtonText}>
                {formData.targetDate
                  ? parseLocalDate(formData.targetDate).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric'
                    })
                  : 'Select target date (optional)'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Priority: {priorityLabels[formData.priority] || formData.priority}</Text>
            <View style={styles.prioritySlider}>
              {[1, 3, 5, 7, 10].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityOption,
                    formData.priority === p && styles.activePriorityOption
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, priority: p }))}
                >
                  <Text style={[
                    styles.priorityOptionText,
                    formData.priority === p && styles.activePriorityOptionText
                  ]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.formActions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelCreate}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              (!formData.title.trim() || saving) && styles.saveButtonDisabled
            ]}
            onPress={handleCreateGoal}
            disabled={!formData.title.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>
                {editingGoal ? 'Update Goal' : 'Create Goal'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Modal visible={showCalendar} transparent animationType="fade">
          <View style={styles.calendarOverlay}>
            <View style={styles.calendarContainer}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarTitle}>Select Target Date</Text>
                <TouchableOpacity onPress={() => setShowCalendar(false)}>
                  <X size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <RNCalendar
                onDayPress={(day) => {
                  setFormData(prev => ({ ...prev, targetDate: day.dateString }));
                  setShowCalendar(false);
                }}
                markedDates={formData.targetDate ? {
                  [formData.targetDate]: {
                    selected: true,
                    selectedColor: '#7c3aed'
                  }
                } : {}}
                minDate={formatLocalDate(new Date())}
                theme={{
                  selectedDayBackgroundColor: '#7c3aed',
                  todayTextColor: '#7c3aed',
                  arrowColor: '#7c3aed',
                }}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>1-Year Goals</Text>
          <Text style={styles.headerSubtitle}>
            Your annual milestones that bridge vision and daily action
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleStartCreate}>
          <Plus size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.loadingText}>Loading goals...</Text>
        </View>
      ) : goals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No 1-Year Goals Yet</Text>
          <Text style={styles.emptyText}>
            Create 3-5 meaningful goals that you want to achieve this year
          </Text>
          <TouchableOpacity style={styles.createButton} onPress={handleStartCreate}>
            <Plus size={20} color="#ffffff" />
            <Text style={styles.createButtonText}>Create First Goal</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.goalsList}>
          {goals.map((goal, index) => (
            <View key={goal.id} style={styles.goalCard}>
              <TouchableOpacity
                style={styles.goalHeader}
                onPress={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
              >
                <View style={styles.goalHeaderLeft}>
                  <View style={[
                    styles.priorityBadge,
                    { backgroundColor: goal.priority && goal.priority >= 7 ? '#dc2626' : goal.priority && goal.priority >= 5 ? '#f59e0b' : '#6b7280' }
                  ]}>
                    <Text style={styles.priorityBadgeText}>{goal.priority || 5}</Text>
                  </View>
                  <View style={styles.goalInfo}>
                    <Text style={styles.goalTitle}>{goal.title}</Text>
                    {goal.year_target_date && (
                      <Text style={styles.goalDate}>
                        Target: {new Date(goal.year_target_date).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric'
                        })}
                      </Text>
                    )}
                  </View>
                </View>
                {expandedGoal === goal.id ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
              </TouchableOpacity>

              {expandedGoal === goal.id && (
                <View style={styles.goalDetails}>
                  {goal.description && (
                    <Text style={styles.goalDescription}>{goal.description}</Text>
                  )}
                  <View style={styles.goalActions}>
                    <TouchableOpacity
                      style={styles.editGoalButton}
                      onPress={() => handleEditGoal(goal)}
                    >
                      <Edit size={16} color="#0078d4" />
                      <Text style={styles.editGoalButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.archiveGoalButton}
                      onPress={() => handleArchiveGoal(goal)}
                    >
                      <Trash2 size={16} color="#dc2626" />
                      <Text style={styles.archiveGoalButtonText}>Archive</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#7c3aed',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  goalsList: {
    flex: 1,
    padding: 16,
  },
  goalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#7c3aed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  goalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  priorityBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  goalDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  goalDetails: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  goalDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  goalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  editGoalButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0078d4',
  },
  archiveGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  archiveGoalButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#dc2626',
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  form: {
    flex: 1,
    padding: 16,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dateButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1f2937',
  },
  prioritySlider: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  activePriorityOption: {
    backgroundColor: '#7c3aed',
  },
  priorityOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  activePriorityOptionText: {
    color: '#ffffff',
  },
  formActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
});
