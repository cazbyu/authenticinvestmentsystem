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
import { X, Plus, Users, Target, Trash2, Edit, ChevronDown, ChevronUp } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { formatLocalDate, parseLocalDate, formatDateRange } from '@/lib/dateUtils';

interface GlobalCycle {
  id: string;
  title?: string;
  cycle_label?: string;
  start_date: string;
  end_date: string;
  reflection_end: string;
  is_active: boolean;
}

interface UserGlobalTimeline {
  id: string;
  user_id: string;
  global_cycle_id: string;
  title?: string;
  start_date: string;
  end_date: string;
  status: string;
  week_start_day: string;
  timezone: string;
  created_at: string;
  updated_at: string;
  global_cycle?: GlobalCycle;
}

interface ManageGlobalTimelinesModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function ManageGlobalTimelinesModal({ visible, onClose, onUpdate }: ManageGlobalTimelinesModalProps) {
  const [userGlobalTimelines, setUserGlobalTimelines] = useState<UserGlobalTimeline[]>([]);
  const [availableGlobalCycles, setAvailableGlobalCycles] = useState<GlobalCycle[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTimeline, setEditingTimeline] = useState<UserGlobalTimeline | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    globalCycleId: '',
    weekStartDay: 'sunday' as 'sunday' | 'monday',
  });
  
  const [saving, setSaving] = useState(false);
  const [showGlobalCycleDropdown, setShowGlobalCycleDropdown] = useState(false);

  const isValidDateString = (d?: string) => typeof d === 'string' && d !== 'null' && !isNaN(Date.parse(d));
  const safeParseDate = (d: string, context: string): Date | null => {
    try {
      if (!isValidDateString(d)) throw new Error('Invalid date');
      const parsed = parseLocalDate(d);
      if (isNaN(parsed.getTime())) throw new Error('Invalid date');
      return parsed;
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

  useEffect(() => {
    if (visible) {
      fetchUserGlobalTimelines();
      fetchAvailableGlobalCycles();
    }
  }, [visible]);

  const fetchUserGlobalTimelines = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user global timelines with their linked global cycles
      const { data: timelineData, error } = await supabase
        .from('0008-ap-user-global-timelines')
        .select(`
          *,
          global_cycle:0008-ap-global-cycles(
            id,
            title,
            cycle_label,
            start_date,
            end_date,
            reflection_end,
            is_active
          ),
          goals:0008-ap-goals-12wk(
            id,
            status
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUserGlobalTimelines(timelineData || []);
    } catch (error) {
      console.error('Error fetching user global timelines:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableGlobalCycles = async () => {
    try {
      const supabase = getSupabaseClient();
      
      // Fetch all active global cycles with reflection_end
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      const { data: cycleData, error } = await supabase
        .from("0008-ap-global-cycles")
        .select("id, title, cycle_label, start_date, end_date, reflection_end, is_active, status")
        .eq("status", "active")                 // current + all future
        .gte("reflection_end", today)           // drop past cycles
        .order("start_date", { ascending: true })
        .limit(3);                              // current + next 2

      if (error) throw error;

      // Filter to show current cycle + next 2 cycles
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const filteredCycles: GlobalCycle[] = [];
      
      if (cycleData) {
        // Find current cycle (current date between start_date and reflection_end)
        const currentCycle = cycleData.find(cycle => 
          currentDate >= cycle.start_date && currentDate <= cycle.reflection_end
        );
        
        if (currentCycle) {
          filteredCycles.push(currentCycle);
        }
        
        // Find next cycles (start_date after current date)
        const futureCycles = cycleData
          .filter(cycle => cycle.start_date > currentDate)
          .slice(0, 2); // Take only the next 2
        
        filteredCycles.push(...futureCycles);
      }
      
      setAvailableGlobalCycles(filteredCycles);
    } catch (error) {
      console.error('Error fetching available global cycles:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const resetForm = () => {
    setFormData({
      globalCycleId: '',
      weekStartDay: 'sunday',
    });
    setEditingTimeline(null);
    setShowGlobalCycleDropdown(false);
  };

  const handleCreateTimeline = async () => {
    if (!formData.globalCycleId) {
      Alert.alert('Error', 'Please select a global cycle');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Get the selected global cycle data
      const selectedCycle = availableGlobalCycles.find(cycle => cycle.id === formData.globalCycleId);
      if (!selectedCycle) throw new Error('Selected global cycle not found');

      // Calculate adjusted dates for Monday start
      let adjustedStartDate = selectedCycle.start_date;
      let adjustedEndDate = selectedCycle.end_date;
      
      if (formData.weekStartDay === 'monday') {
        // Add one day to both start and end dates for Monday start
        const startDate = new Date(selectedCycle.start_date);
        const endDate = new Date(selectedCycle.end_date);
        startDate.setDate(startDate.getDate() + 1);
        endDate.setDate(endDate.getDate() + 1);
        adjustedStartDate = formatLocalDate(startDate);
        adjustedEndDate = formatLocalDate(endDate);
      }

      const timelineData = {
        user_id: user.id,
        global_cycle_id: formData.globalCycleId,
        title: null,
        start_date: adjustedStartDate,
        end_date: adjustedEndDate,
        status: 'active',
        week_start_day: formData.weekStartDay,
        timezone: 'UTC',
      };

      if (editingTimeline) {
        // Update existing timeline
        const { error } = await supabase
          .from('0008-ap-user-global-timelines')
          .update({
            ...timelineData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTimeline.id);

        if (error) throw error;
        Alert.alert('Success', 'Global timeline updated successfully!');
      } else {
        // Create new timeline
        const { error } = await supabase
          .from('0008-ap-user-global-timelines')
          .insert(timelineData);

        if (error) throw error;
        Alert.alert('Success', 'Global timeline created successfully!');
      }

      setShowCreateForm(false);
      resetForm();
      fetchUserGlobalTimelines();
      onUpdate?.();
    } catch (error) {
      console.error('Error saving global timeline:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditTimeline = (timeline: UserGlobalTimeline) => {
    setEditingTimeline(timeline);
    setFormData({
      globalCycleId: timeline.global_cycle_id,
      weekStartDay: timeline.week_start_day as 'sunday' | 'monday',
    });
    setShowCreateForm(true);
  };

  const handleDeleteTimeline = async (timeline: UserGlobalTimeline) => {
    const timelineTitle = timeline.title || timeline.global_cycle?.title || timeline.global_cycle?.cycle_label || 'this timeline';
    
    Alert.alert(
      'Delete Global Timeline',
      `Are you sure you want to delete "${timelineTitle}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              
              // Delete the timeline itself
              const { error } = await supabase
                .from('0008-ap-user-global-timelines')
                .delete()
                .eq('id', timeline.id);

              if (error) throw error;

              Alert.alert('Success', 'Global timeline deleted successfully');
              fetchUserGlobalTimelines();
              onUpdate?.();
            } catch (error) {
              console.error('Error deleting global timeline:', error);
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

  const getSelectedCycleInfo = () => {
    if (!formData.globalCycleId) return null;
    return availableGlobalCycles.find(cycle => cycle.id === formData.globalCycleId);
  };

  const renderTimelinesList = () => (
    <ScrollView style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Global 12 Week Timelines</Text>
        <Text style={styles.headerSubtitle}>
          Connect to community 12-week cycles and global challenges
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0078d4" />
          <Text style={styles.loadingText}>Loading global timelines...</Text>
        </View>
      ) : userGlobalTimelines.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Users size={64} color="#6b7280" />
          <Text style={styles.emptyTitle}>No Global 12 Week Timelines</Text>
          <Text style={styles.emptyText}>
            Connect to community 12-week cycles and global challenges to track goals together
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleStartCreate}
          >
            <Plus size={20} color="#ffffff" />
            <Text style={styles.createButtonText}>Connect to Global 12 Week Timeline</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.timelinesList}>
          {userGlobalTimelines.map(timeline => {
            const startDate = timeline.start_date ? parseLocalDate(timeline.start_date) : null;
            const endDate = timeline.end_date ? parseLocalDate(timeline.end_date) : null;
            let daysRemaining = 0;
            let totalDays = 0;
            let progress = 0;
            if (startDate && endDate) {
              const now = new Date();
              daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
              totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
              progress = Math.min(100, Math.max(0, ((now.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100));
            }

            const displayTitle = timeline.title || timeline.global_cycle?.title || timeline.global_cycle?.cycle_label || 'Global Timeline';

            return (
              <View key={timeline.id} style={styles.timelineCard}>
                <View style={styles.timelineHeader}>
                  <View style={styles.timelineInfo}>
                    <Text style={styles.timelineTitle}>{displayTitle}</Text>
                    <Text style={styles.timelineDates}>
                      {timeline.start_date && timeline.end_date
                        ? formatDateRange(timeline.start_date, timeline.end_date)
                        : 'Invalid date'}
                    </Text>
                    <Text style={styles.timelineStats}>
                      {startDate && endDate
                        ? `${timeline.goals?.length || 0} active goals • ${daysRemaining} days remaining`
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
              </View>
            );
          })}
          
          <TouchableOpacity
            style={styles.addTimelineButton}
            onPress={handleStartCreate}
          >
            <Plus size={20} color="#0078d4" />
            <Text style={styles.addTimelineButtonText}>Connect to Another Global Timeline</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  const renderCreateForm = () => (
    <ScrollView style={styles.content}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>
          {editingTimeline ? 'Edit Global 12 Week Timeline' : 'Connect to Global 12 Week Timeline'}
        </Text>
        <Text style={styles.formSubtitle}>
          Connect to a community 12-week cycle or global challenge
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Select Global 12 Week Timeline *</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowGlobalCycleDropdown(!showGlobalCycleDropdown)}
          >
            <Text style={styles.dropdownText}>
              {formData.globalCycleId 
                ? (() => {
                    const cycle = availableGlobalCycles.find(c => c.id === formData.globalCycleId);
                    return cycle?.title || cycle?.cycle_label || 'Selected Cycle';
                  })()
                : 'Select a global 12-week timeline...'
              }
            </Text>
            {showGlobalCycleDropdown ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </TouchableOpacity>
          
          {showGlobalCycleDropdown && (
            <View style={styles.dropdownContent}>
              {availableGlobalCycles.map(cycle => (
                <TouchableOpacity
                  key={cycle.id}
                  style={[
                    styles.dropdownOption,
                    formData.globalCycleId === cycle.id && styles.selectedDropdownOption
                  ]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, globalCycleId: cycle.id }));
                    setShowGlobalCycleDropdown(false);
                  }}
                >
                  <View style={styles.cycleOptionContent}>
                    <Text style={[
                      styles.cycleOptionTitle,
                      formData.globalCycleId === cycle.id && styles.selectedCycleOptionTitle
                    ]}>
                      {cycle.title || cycle.cycle_label || 'Global 12 Week Timeline'}
                    </Text>
                    <Text style={[
                      styles.cycleOptionDates,
                      formData.globalCycleId === cycle.id && styles.selectedCycleOptionDates
                    ]}>
                      {safeFormatDateRange(cycle.start_date, cycle.end_date, `cycle ${cycle.id}`)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Show selected cycle info */}
        {getSelectedCycleInfo() && (
          <View style={styles.selectedCycleInfo}>
            <Text style={styles.selectedCycleTitle}>Selected Timeline</Text>
            <Text style={styles.selectedCycleName}>
              {getSelectedCycleInfo()?.title || getSelectedCycleInfo()?.cycle_label}
            </Text>
            <Text style={styles.selectedCycleDates}>
              {(() => {
                const cycle = getSelectedCycleInfo();
                if (!cycle) return '';
                
                // Apply Monday adjustment to display dates if selected
                let startDate = cycle.start_date;
                let endDate = cycle.end_date;
                
                if (formData.weekStartDay === 'monday') {
                  const adjustedStart = parseLocalDate(cycle.start_date);
                  const adjustedEnd = parseLocalDate(cycle.end_date);
                  if (isNaN(adjustedStart.getTime()) || isNaN(adjustedEnd.getTime())) {
                    return 'Invalid date';
                  }
                  adjustedStart.setDate(adjustedStart.getDate() + 1);
                  adjustedEnd.setDate(adjustedEnd.getDate() + 1);
                  startDate = formatLocalDate(adjustedStart);
                  endDate = formatLocalDate(adjustedEnd);
                }
                
                return formatDateRange(startDate, endDate);
              })()}
            </Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Week Start Day</Text>
          <View style={styles.weekStartToggle}>
            <TouchableOpacity
              style={[
                styles.weekStartOption,
                formData.weekStartDay === 'sunday' && styles.activeWeekStartOption
              ]}
              onPress={() => setFormData(prev => ({ ...prev, weekStartDay: 'sunday' }))}
            >
              <Text style={[
                styles.weekStartOptionText,
                formData.weekStartDay === 'sunday' && styles.activeWeekStartOptionText
              ]}>
                Sunday
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.weekStartOption,
                formData.weekStartDay === 'monday' && styles.activeWeekStartOption
              ]}
              onPress={() => setFormData(prev => ({ ...prev, weekStartDay: 'monday' }))}
            >
              <Text style={[
                styles.weekStartOptionText,
                formData.weekStartDay === 'monday' && styles.activeWeekStartOptionText
              ]}>
                Monday
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {showCreateForm 
              ? (editingTimeline ? 'Edit Global Timeline' : 'Connect to Global Timeline')
              : 'Manage Global Timelines'
            }
          </Text>
          <>
            <TouchableOpacity
              style={[
                styles.weekStartOption,
                formData.weekStartDay === 'sunday' && styles.activeWeekStartOption
              ]}
              onPress={() => setFormData(prev => ({ ...prev, weekStartDay: 'sunday' }))}
            >
              <Text style={[
                styles.weekStartOptionText,
                formData.weekStartDay === 'sunday' && styles.activeWeekStartOptionText
              ]}>
                Sunday
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.weekStartOption,
                formData.weekStartDay === 'monday' && styles.activeWeekStartOption
              ]}
              onPress={() => setFormData(prev => ({ ...prev, weekStartDay: 'monday' }))}
            >
              <Text style={[
                styles.weekStartOptionText,
                formData.weekStartDay === 'monday' && styles.activeWeekStartOptionText
              ]}>
                Monday
              </Text>
            </TouchableOpacity>
          </>
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
    backgroundColor: '#0078d4',
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
    borderLeftColor: '#0078d4',
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
    color: '#0078d4',
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
    backgroundColor: '#0078d4',
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
    borderColor: '#0078d4',
    borderStyle: 'dashed',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addTimelineButtonText: {
    color: '#0078d4',
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
  dropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 16,
    color: '#1f2937',
  },
  dropdownContent: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedDropdownOption: {
    backgroundColor: '#f0f9ff',
  },
  cycleOptionContent: {
    flex: 1,
  },
  cycleOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  selectedCycleOptionTitle: {
    color: '#0078d4',
    fontWeight: '600',
  },
  cycleOptionDates: {
    fontSize: 12,
    color: '#6b7280',
  },
  selectedCycleOptionDates: {
    color: '#0078d4',
  },
  selectedCycleInfo: {
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0078d4',
    marginBottom: 16,
  },
  selectedCycleTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0078d4',
    marginBottom: 4,
  },
  selectedCycleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  selectedCycleDates: {
    fontSize: 14,
    color: '#6b7280',
  },
  weekStartToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  weekStartOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeWeekStartOption: {
    backgroundColor: '#0078d4',
  },
  weekStartOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeWeekStartOptionText: {
    color: '#ffffff',
  },
  connectButton: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  connectButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: '#0078d4',
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
    backgroundColor: '#0078d4',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createNewButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});