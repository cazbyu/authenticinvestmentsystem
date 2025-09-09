import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, Plus, Calendar, Target, Trash2, CreditCard as Edit } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { Calendar as RNCalendar } from 'react-native-calendars';
import { formatLocalDate, parseLocalDate, formatDateRange } from '@/lib/dateUtils';

interface CustomTimeline {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  updated_at: string;
  goals_count?: number;
}

interface ManageCustomTimelinesModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function ManageCustomTimelinesModal({ visible, onClose, onUpdate }: ManageCustomTimelinesModalProps) {
  const [timelines, setTimelines] = useState<CustomTimeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTimeline, setEditingTimeline] = useState<CustomTimeline | null>(null);

  const isValidDateString = (d?: string) => typeof d === 'string' && d !== 'null' && !isNaN(Date.parse(d));
  const safeParseDate = (d: string, context: string): Date | null => {
    try {
      if (!isValidDateString(d)) throw new Error('Invalid date');
      return parseLocalDate(d);
    } catch (err) {
      console.warn(`Invalid date in ${context}:`, d, err);
      return null;
    }
  };
  const safeFormatDateRange = (start: string, end: string, context: string): string => {
    try {
      if (!isValidDateString(start) || !isValidDateString(end)) throw new Error('Invalid date');
      return formatDateRange(start, end);
    } catch (err) {
      console.warn(`Invalid date range in ${context}:`, { start, end }, err);
      return 'Invalid date';
    }
  };
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: formatLocalDate(new Date()),
    endDate: formatLocalDate(new Date(Date.now() + 84 * 24 * 60 * 60 * 1000)), // 12 weeks from now
  });
  
  // Calendar states
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchTimelines();
    }
  }, [visible]);

  const fetchTimelines = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch custom timelines with goal counts
      const { data: timelineData, error } = await supabase
        .from('0008-ap-custom-timelines')
        .select('*, goals:0008-ap-goals-custom(id)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const timelinesWithCounts: CustomTimeline[] = (timelineData || []).map(tl => ({
        ...tl,
        goals_count: tl.goals ? tl.goals.length : 0,
      }));

      setTimelines(timelinesWithCounts);
    } catch (error) {
      console.error('Error fetching custom timelines:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    const today = new Date();
    const twelveWeeksLater = new Date(today.getTime() + 84 * 24 * 60 * 60 * 1000);
    
    setFormData({
      title: '',
      description: '',
      startDate: formatLocalDate(today),
      endDate: formatLocalDate(twelveWeeksLater),
    });
    setEditingTimeline(null);
  };

  const handleCreateTimeline = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a timeline title');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const timelineData = {
        user_id: user.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        start_date: formData.startDate,
        end_date: formData.endDate,
        status: 'active',
      };

      if (editingTimeline) {
        // Update existing timeline
        const { error } = await supabase
          .from('0008-ap-custom-timelines')
          .update({
            ...timelineData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTimeline.id);

        if (error) throw error;
        Alert.alert('Success', 'Timeline updated successfully!');
      } else {
        // Create new timeline
        const { error } = await supabase
          .from('0008-ap-custom-timelines')
          .insert(timelineData);

        if (error) throw error;
        Alert.alert('Success', 'Custom timeline created successfully!');
      }

      setShowCreateForm(false);
      resetForm();
      fetchTimelines();
      onUpdate?.();
    } catch (error) {
      console.error('Error saving timeline:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditTimeline = (timeline: CustomTimeline) => {
    setEditingTimeline(timeline);
    setFormData({
      title: timeline.title,
      description: timeline.description || '',
      startDate: timeline.start_date,
      endDate: timeline.end_date,
    });
    setShowCreateForm(true);
  };

  const handleDeleteTimeline = async (timeline: CustomTimeline) => {
    Alert.alert(
      'Delete Timeline',
      `Are you sure you want to delete "${timeline.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              
              // Delete the timeline itself (cascade removes linked goals)
              const { error } = await supabase
                .from('0008-ap-custom-timelines')
                .delete()
                .eq('id', timeline.id);

              if (error) throw error;

              Alert.alert('Success', 'Timeline deleted successfully');
              fetchTimelines();
              onUpdate?.();
            } catch (error) {
              console.error('Error deleting timeline:', error);
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

  const renderTimelinesList = () => (
    <ScrollView style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Custom Timelines</Text>
        <Text style={styles.headerSubtitle}>
          Create custom goal timelines with your own start and end dates
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0078d4" />
          <Text style={styles.loadingText}>Loading timelines...</Text>
        </View>
      ) : timelines.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Target size={64} color="#6b7280" />
          <Text style={styles.emptyTitle}>No Custom Timelines</Text>
          <Text style={styles.emptyText}>
            Create your first custom timeline to track goals with your own schedule
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleStartCreate}
          >
            <Plus size={20} color="#ffffff" />
            <Text style={styles.createButtonText}>Create Custom Timeline</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.timelinesList}>
          {timelines.map(timeline => {
            const startDate = safeParseDate(timeline.start_date, `timeline ${timeline.id} start`);
            const endDate = safeParseDate(timeline.end_date, `timeline ${timeline.id} end`);
            let daysRemaining = 0;
            let totalDays = 0;
            let progress = 0;
            if (startDate && endDate) {
              const now = new Date();
              daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
              totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
              progress = Math.min(100, Math.max(0, ((now.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100));
            } else {
              console.warn('Invalid timeline dates', timeline);
            }

            return (
              <View key={timeline.id} style={styles.timelineCard}>
                <View style={styles.timelineHeader}>
                  <View style={styles.timelineInfo}>
                    <Text style={styles.timelineTitle}>{timeline.title}</Text>
                    <Text style={styles.timelineDates}>
                      {startDate && endDate
                        ? safeFormatDateRange(timeline.start_date, timeline.end_date, `timeline ${timeline.id}`)
                        : 'Invalid date'}
                    </Text>
                    <Text style={styles.timelineStats}>
                      {startDate && endDate
                        ? `${daysRemaining} days remaining • ${Math.ceil(totalDays / 7)} weeks total`
                        : 'Invalid date range'}
                    </Text>
                  </View>
                  
                  <View style={styles.timelineActions}>
                    <TouchableOpacity
                      style={styles.editTimelineButton}
                      onPress={() => handleEditTimeline(timeline)}
                    >
                      <Edit size={16} color="#0078d4" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteTimelineButton}
                      onPress={() => handleDeleteTimeline(timeline)}
                    >
                      <Trash2 size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.timelineProgress}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${progress}%` }
                      ]}
                    />
                  </View>
                </View>

                {timeline.description && (
                  <Text style={styles.timelineDescription} numberOfLines={2}>
                    {timeline.description}
                  </Text>
                )}
              </View>
            );
          })}
          
          <TouchableOpacity
            style={styles.addTimelineButton}
            onPress={handleStartCreate}
          >
            <Plus size={20} color="#7c3aed" />
            <Text style={styles.addTimelineButtonText}>Add Another Timeline</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  const renderCreateForm = () => (
    <ScrollView style={styles.content}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>
          {editingTimeline ? 'Edit Custom Timeline' : 'Create Custom Timeline'}
        </Text>
        <Text style={styles.formSubtitle}>
          Set up a custom timeline for tracking goals with your own schedule
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Timeline Title *</Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
            placeholder="e.g., Summer Fitness Challenge, Q2 Business Goals"
            placeholderTextColor="#9ca3af"
            maxLength={100}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
            placeholder="Describe the purpose and focus of this timeline..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            maxLength={500}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Start Date *</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowStartCalendar(true)}
          >
            <Text style={styles.dateButtonText}>
              {parseLocalDate(formData.startDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>End Date *</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowEndCalendar(true)}
          >
            <Text style={styles.dateButtonText}>
              {parseLocalDate(formData.endDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.durationInfo}>
          <Text style={styles.durationText}>
            Duration: {(() => {
              const start = parseLocalDate(formData.startDate);
              const end = parseLocalDate(formData.endDate);
              const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
              const weeks = Math.ceil(days / 7);
              return `${days} days (${weeks} weeks)`;
            })()}
          </Text>
        </View>
      </View>

      {/* Start Date Calendar Modal */}
      <Modal visible={showStartCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Start Date</Text>
              <TouchableOpacity onPress={() => setShowStartCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <RNCalendar
              onDayPress={(day) => {
                setFormData(prev => ({ ...prev, startDate: day.dateString }));
                setShowStartCalendar(false);
                
                // Auto-adjust end date if it's before the new start date
                const newStartDate = parseLocalDate(day.dateString);
                const currentEndDate = parseLocalDate(formData.endDate);
                if (currentEndDate <= newStartDate) {
                  const newEndDate = new Date(newStartDate);
                  newEndDate.setDate(newEndDate.getDate() + 84); // 12 weeks
                  setFormData(prev => ({ ...prev, endDate: formatLocalDate(newEndDate) }));
                }
              }}
              markedDates={{
                [formData.startDate]: {
                  selected: true,
                  selectedColor: '#0078d4'
                }
              }}
              theme={{
                selectedDayBackgroundColor: '#0078d4',
                todayTextColor: '#0078d4',
                arrowColor: '#0078d4',
              }}
            />
          </View>
        </View>
      </Modal>

      {/* End Date Calendar Modal */}
      <Modal visible={showEndCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select End Date</Text>
              <TouchableOpacity onPress={() => setShowEndCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <RNCalendar
              onDayPress={(day) => {
                // Validate that end date is after start date
                const selectedEndDate = parseLocalDate(day.dateString);
                const currentStartDate = parseLocalDate(formData.startDate);
                
                if (selectedEndDate <= currentStartDate) {
                  Alert.alert('Invalid Date', 'End date must be after start date');
                  return;
                }
                
                setFormData(prev => ({ ...prev, endDate: day.dateString }));
                setShowEndCalendar(false);
              }}
              markedDates={{
                [formData.endDate]: {
                  selected: true,
                  selectedColor: '#0078d4'
                },
                [formData.startDate]: {
                  marked: true,
                  dotColor: '#16a34a'
                }
              }}
              minDate={formData.startDate}
              theme={{
                selectedDayBackgroundColor: '#0078d4',
                todayTextColor: '#0078d4',
                arrowColor: '#0078d4',
              }}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {showCreateForm 
              ? (editingTimeline ? 'Edit Timeline' : 'Create Timeline')
              : 'Manage Custom Timelines'
            }
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        {showCreateForm ? renderCreateForm() : renderTimelinesList()}

        <View style={styles.actions}>
          {showCreateForm ? (
            <>
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
                onPress={handleCreateTimeline}
                disabled={!formData.title.trim() || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Target size={20} color="#ffffff" />
                    <Text style={styles.saveButtonText}>
                      {editingTimeline ? 'Update Timeline' : 'Create Timeline'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.createNewButton}
              onPress={handleStartCreate}
            >
              <Plus size={20} color="#ffffff" />
              <Text style={styles.createNewButtonText}>Create New Timeline</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
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
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  timelinesList: {
    padding: 16,
    gap: 12,
  },
  timelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#7c3aed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  timelineInfo: {
    flex: 1,
    marginRight: 12,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  timelineDates: {
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '500',
    marginBottom: 4,
  },
  timelineStats: {
    fontSize: 12,
    color: '#6b7280',
  },
  timelineActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editTimelineButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0078d4',
  },
  deleteTimelineButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  timelineProgress: {
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 3,
  },
  timelineDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  addTimelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#7c3aed',
    borderStyle: 'dashed',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addTimelineButtonText: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: '600',
  },
  formHeader: {
    padding: 16,
    alignItems: 'center',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
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
    height: 80,
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
  durationInfo: {
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0078d4',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0078d4',
    textAlign: 'center',
  },
  actions: {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  createNewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createNewButtonText: {
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