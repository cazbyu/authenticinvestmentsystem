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
import { X, Target, Calendar, Users, Plus, FileText, ChevronDown, ChevronUp, Clock } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { formatLocalDate, parseLocalDate, formatDateRange } from '@/lib/dateUtils';

interface Timeline {
  id: string;
  source: 'custom' | 'global';
  title?: string;
  start_date: string | null;
  end_date: string | null;
  timeline_type?: 'cycle' | 'project' | 'challenge' | 'custom';
}

interface Role {
  id: string;
  label: string;
  color?: string;
}

interface Domain {
  id: string;
  name: string;
}

interface KeyRelationship {
  id: string;
  name: string;
  role_id: string;
}

interface CreateGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
  createTwelveWeekGoal: (goalData: {
    title: string;
    description?: string;
    weekly_target?: number;
    total_target?: number;
  }) => Promise<any>;
  createCustomGoal: (goalData: {
    title: string;
    description?: string;
    start_date?: string;
    end_date?: string;
  }, selectedTimeline?: { id: string; start_date?: string | null; end_date?: string | null }) => Promise<any>;
  selectedTimeline: Timeline | null;
}

export function CreateGoalModal({ 
  visible, 
  onClose, 
  onSubmitSuccess, 
  createTwelveWeekGoal,
  createCustomGoal,
  selectedTimeline
}: CreateGoalModalProps) {
  // Form data state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    notes: '',
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    selectedKeyRelationshipIds: [] as string[],
  });

  // Data states
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [allKeyRelationships, setAllKeyRelationships] = useState<KeyRelationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Timeline selector state
  const [availableTimelines, setAvailableTimelines] = useState<Timeline[]>([]);
  const [currentSelectedTimeline, setCurrentSelectedTimeline] = useState<Timeline | null>(null);
  const [showTimelineSelector, setShowTimelineSelector] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchData();
      if (selectedTimeline) {
        setCurrentSelectedTimeline(selectedTimeline);
      } else {
        fetchAvailableTimelines();
      }
    } else {
      resetForm();
    }
  }, [visible, selectedTimeline]);

  // Auto-select all roles and domains when data is loaded
  useEffect(() => {
    if (visible && allRoles.length > 0 && allDomains.length > 0) {
      // Don't auto-select roles and domains - let user choose
    }
  }, [visible, allRoles, allDomains]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { data: rolesData },
        { data: domainsData },
        { data: krData }
      ] = await Promise.all([
        supabase.from('0008-ap-roles').select('id, label, color').eq('user_id', user.id).eq('is_active', true).order('label'),
        supabase.from('0008-ap-domains').select('id, name').order('name'),
        supabase.from('0008-ap-key-relationships').select('id, name, role_id').eq('user_id', user.id)
      ]);

      setAllRoles(rolesData || []);
      setAllDomains(domainsData || []);
      setAllKeyRelationships(krData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTimelines = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const timelines: Timeline[] = [];

      // Fetch custom timelines
      const { data: customData, error: customError } = await supabase
        .from('0008-ap-custom-timelines')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (customError) throw customError;

      if (customData) {
        customData.forEach(timeline => {
          timelines.push({
            id: timeline.id,
            source: 'custom',
            title: timeline.title,
            start_date: timeline.start_date,
            end_date: timeline.end_date,
            timeline_type: timeline.timeline_type,
          });
        });
      }

      // Fetch global timelines
      const { data: globalData, error: globalError } = await supabase
        .from('0008-ap-user-global-timelines')
        .select(`
          *,
          global_cycle:0008-ap-global-cycles(
            id,
            title,
            cycle_label,
            start_date,
            end_date,
            is_active
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (globalError) throw globalError;

      if (globalData) {
        globalData.forEach(timeline => {
          timelines.push({
            id: timeline.id,
            source: 'global',
            title: timeline.title || timeline.global_cycle?.title || timeline.global_cycle?.cycle_label,
            start_date: timeline.start_date,
            end_date: timeline.end_date,
          });
        });
      }

      setAvailableTimelines(timelines);
    } catch (error) {
      console.error('Error fetching available timelines:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      notes: '',
      selectedRoleIds: [],
      selectedDomainIds: [],
      selectedKeyRelationshipIds: [],
    });
    setCurrentSelectedTimeline(null);
    setShowTimelineSelector(false);
  };

  const handleMultiSelect = (field: 'selectedRoleIds' | 'selectedDomainIds' | 'selectedKeyRelationshipIds', id: string) => {
    setFormData(prev => {
      const currentSelection = prev[field] as string[];
      const newSelection = currentSelection.includes(id)
        ? currentSelection.filter(itemId => itemId !== id)
        : [...currentSelection, id];
      return { ...prev, [field]: newSelection };
    });
  };

  const handleCreateGoal = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a goal title');
      return;
    }

    if (!currentSelectedTimeline) {
      Alert.alert('Error', 'Please select a timeline');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Determine goal type based on timeline
      const goalType = currentSelectedTimeline.source === 'global' ? '12week' : 'custom';
      
      let goalData;
      
      if (goalType === '12week') {
        goalData = await createTwelveWeekGoal({
          title: formData.title,
          description: formData.description,
        });
      } else {
        goalData = await createCustomGoal({
          title: formData.title,
          description: formData.description,
        }, currentSelectedTimeline);
      }

      if (!goalData) throw new Error('Failed to create goal');

      const goalId = goalData.id;
      const parentType = goalType === '12week' ? 'goal' : 'custom_goal';

      // Insert role joins
      if (formData.selectedRoleIds.length > 0) {
        const roleJoins = formData.selectedRoleIds.map(roleId => ({
          parent_id: goalId,
          parent_type: parentType,
          role_id: roleId,
          user_id: user.id,
        }));
        const { error: roleError } = await supabase
          .from('0008-ap-universal-roles-join')
          .insert(roleJoins);
        if (roleError) throw roleError;
      }

      // Insert domain joins
      if (formData.selectedDomainIds.length > 0) {
        const domainJoins = formData.selectedDomainIds.map(domainId => ({
          parent_id: goalId,
          parent_type: parentType,
          domain_id: domainId,
          user_id: user.id,
        }));
        const { error: domainError } = await supabase
          .from('0008-ap-universal-domains-join')
          .insert(domainJoins);
        if (domainError) throw domainError;
      }

      // Insert key relationship joins
      if (formData.selectedKeyRelationshipIds.length > 0) {
        const krJoins = formData.selectedKeyRelationshipIds.map(krId => ({
          parent_id: goalId,
          parent_type: parentType,
          key_relationship_id: krId,
          user_id: user.id,
        }));
        const { error: krError } = await supabase
          .from('0008-ap-universal-key-relationships-join')
          .insert(krJoins);
        if (krError) throw krError;
      }

      // Insert note if provided
      if (formData.notes.trim()) {
        const { data: newNote, error: noteError } = await supabase
          .from('0008-ap-notes')
          .insert({
            user_id: user.id,
            content: formData.notes.trim(),
          })
          .select()
          .single();
        if (noteError) throw noteError;

        const { error: noteJoinError } = await supabase
          .from('0008-ap-universal-notes-join')
          .insert({
            parent_id: goalId,
            parent_type: parentType,
            note_id: newNote.id,
            user_id: user.id,
          });
        if (noteJoinError) throw noteJoinError;
      }

      Alert.alert('Success', 'Goal created successfully!');
      onSubmitSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating goal:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to create goal');
    } finally {
      setSaving(false);
    }
  };

  // Filter key relationships based on selected roles
  const filteredKeyRelationships = allKeyRelationships.filter(kr =>
    formData.selectedRoleIds.includes(kr.role_id)
  );

  const getTimelineTypeLabel = (timeline: Timeline) => {
    if (timeline.source === 'global') return 'Global 12-Week';
    if (timeline.timeline_type === 'cycle') return 'Custom Cycle';
    if (timeline.timeline_type === 'project') return 'Project';
    if (timeline.timeline_type === 'challenge') return 'Challenge';
    return 'Custom Timeline';
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Goal</Text>
          <TouchableOpacity 
            style={[styles.saveButton, (!formData.title.trim() || !currentSelectedTimeline || saving) && styles.saveButtonDisabled]}
            onPress={handleCreateGoal}
            disabled={!formData.title.trim() || !currentSelectedTimeline || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0078d4" />
              <Text style={styles.loadingText}>Loading form data...</Text>
            </View>
          ) : (
            <View style={styles.form}>
              {/* Goal Title */}
              <View style={styles.field}>
                <Text style={styles.label}>Goal Title</Text>
                <TextInput
                  style={styles.input}
                  value={formData.title}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                  placeholder="Enter your goal title"
                  placeholderTextColor="#9ca3af"
                  maxLength={100}
                />
              </View>

              {/* Timeline Selector */}
              <View style={styles.field}>
                <Text style={styles.label}>Timeline</Text>
                {selectedTimeline ? (
                  <View style={styles.selectedTimelineContainer}>
                    <View style={[styles.timelineTypeIndicator, { 
                      backgroundColor: selectedTimeline.source === 'global' ? '#0078d4' : '#7c3aed' 
                    }]}>
                      <Text style={styles.timelineTypeText}>
                        {getTimelineTypeLabel(selectedTimeline)}
                      </Text>
                    </View>
                    <View style={styles.timelineDetails}>
                      <Text style={styles.timelineTitle}>
                        {selectedTimeline.title || 'Untitled Timeline'}
                      </Text>
                      {selectedTimeline.start_date && selectedTimeline.end_date && (
                        <Text style={styles.timelineDates}>
                          {formatDateRange(selectedTimeline.start_date, selectedTimeline.end_date)}
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.timelineSelector}
                    onPress={() => setShowTimelineSelector(true)}
                  >
                    <Text style={styles.timelineSelectorText}>
                      {currentSelectedTimeline 
                        ? currentSelectedTimeline.title || 'Selected Timeline'
                        : 'Select Timeline'
                      }
                    </Text>
                    <ChevronDown size={20} color="#6b7280" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Active Roles */}
              <View style={styles.field}>
                <Text style={styles.label}>Active Roles</Text>
                <View style={styles.checkboxContainer}>
                  {allRoles.map(role => {
                    const isSelected = formData.selectedRoleIds.includes(role.id);
                    return (
                      <TouchableOpacity
                        key={role.id}
                        style={styles.checkboxRowGrid}
                        onPress={() => handleMultiSelect('selectedRoleIds', role.id)}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.checkboxLabelGrid}>{role.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Key Relationships */}
              {filteredKeyRelationships.length > 0 && (
                <View style={styles.field}>
                  <Text style={styles.label}>Key Relationships</Text>
                  <View style={styles.checkboxContainer}>
                    {filteredKeyRelationships.map(kr => {
                      const isSelected = formData.selectedKeyRelationshipIds.includes(kr.id);
                      return (
                        <TouchableOpacity
                          key={kr.id}
                          style={styles.checkboxRowGrid}
                          onPress={() => handleMultiSelect('selectedKeyRelationshipIds', kr.id)}
                        >
                          <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <Text style={styles.checkboxLabelGrid}>{kr.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Wellness Domains */}
              <View style={styles.field}>
                <Text style={styles.label}>Wellness Domains</Text>
                <View style={styles.checkboxContainer}>
                  {allDomains.map(domain => {
                    const isSelected = formData.selectedDomainIds.includes(domain.id);
                    return (
                      <TouchableOpacity
                        key={domain.id}
                        style={styles.checkboxRowGrid}
                        onPress={() => handleMultiSelect('selectedDomainIds', domain.id)}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.checkboxLabelGrid}>{domain.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Description */}
              <View style={styles.field}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                  placeholder="Describe your goal and why it matters..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
              </View>

              {/* Notes */}
              <View style={styles.field}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.notes}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                  placeholder="Additional notes for this goal..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Timeline Selector Modal */}
        <Modal visible={showTimelineSelector} transparent animationType="fade">
          <View style={styles.timelineSelectorOverlay}>
            <View style={styles.timelineSelectorContainer}>
              <View style={styles.timelineSelectorHeader}>
                <Text style={styles.timelineSelectorTitle}>Select Timeline</Text>
                <TouchableOpacity onPress={() => setShowTimelineSelector(false)}>
                  <X size={24} color="#1f2937" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.timelineSelectorContent}>
                {availableTimelines.map(timeline => (
                  <TouchableOpacity
                    key={timeline.id}
                    style={[
                      styles.timelineSelectorItem,
                      { borderLeftColor: timeline.source === 'global' ? '#0078d4' : '#7c3aed' }
                    ]}
                    onPress={() => {
                      setCurrentSelectedTimeline(timeline);
                      setShowTimelineSelector(false);
                    }}
                  >
                    <View style={styles.timelineSelectorItemContent}>
                      <Text style={styles.timelineSelectorItemTitle}>
                        {timeline.title || 'Untitled Timeline'}
                      </Text>
                      <Text style={styles.timelineSelectorItemSubtitle}>
                        {getTimelineTypeLabel(timeline)}
                      </Text>
                      {timeline.start_date && timeline.end_date && (
                        <Text style={styles.timelineSelectorItemDates}>
                          {formatDateRange(timeline.start_date, timeline.end_date)}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  saveButton: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
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
  form: {
    padding: 16,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  fieldDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectedTimelineContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineTypeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  timelineTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  timelineDetails: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  timelineDates: {
    fontSize: 12,
    color: '#6b7280',
  },
  timelineSelector: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineSelectorText: {
    fontSize: 16,
    color: '#1f2937',
  },
  checkboxContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  checkboxRowGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '25%',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#1f2937',
    flex: 1,
  },
  checkboxLabelGrid: {
    fontSize: 11,
    color: '#1f2937',
    flex: 1,
    lineHeight: 14,
  },
  timelineSelectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  timelineSelectorContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    maxHeight: '80%',
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  timelineSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  timelineSelectorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  timelineSelectorContent: {
    maxHeight: 400,
  },
  timelineSelectorItem: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  timelineSelectorItemContent: {
    flex: 1,
  },
  timelineSelectorItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  timelineSelectorItemSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  timelineSelectorItemDates: {
    fontSize: 12,
    color: '#9ca3af',
  },
});