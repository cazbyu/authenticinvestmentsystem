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
import { X, Plus } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

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

interface TwelveWeekGoal {
  id: string;
  title: string;
  description?: string;
  roles?: Array<{ id: string; label: string; color?: string }>;
  domains?: Array<{ id: string; name: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
}

interface CycleWeek {
  week_number: number;
  week_start: string;
  week_end: string;
  user_global_timeline_id: string;
  user_custom_timeline_id: string;
}

interface ActionEffortModalProps {
  visible: boolean;
  onClose: () => void;
  goal: TwelveWeekGoal | null;
  cycleWeeks: CycleWeek[];
  createTaskWithWeekPlan: (taskData: any) => Promise<any>;
}

const ActionEffortModal: React.FC<ActionEffortModalProps> = ({
  visible,
  onClose,
  goal,
  cycleWeeks,
  createTaskWithWeekPlan,
}) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [recurrenceType, setRecurrenceType] = useState('daily');
  const [selectedCustomDays, setSelectedCustomDays] = useState<number[]>([]); // 0=Sunday, 1=Monday, etc.
  const [saving, setSaving] = useState(false);

  // Multi-select states
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [selectedKeyRelationshipIds, setSelectedKeyRelationshipIds] = useState<string[]>([]);

  // Data fetching states
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [allKeyRelationships, setAllKeyRelationships] = useState<KeyRelationship[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchData();
      resetForm();
    }
  }, [visible, goal]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all roles
      const { data: rolesData } = await supabase
        .from('0008-ap-roles')
        .select('id, label, color')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('label');

      setAllRoles(rolesData || []);

      // Fetch all domains
      const { data: domainsData } = await supabase
        .from('0008-ap-domains')
        .select('id, name')
        .order('name');

      setAllDomains(domainsData || []);

      // Fetch all key relationships
      const { data: krData } = await supabase
        .from('0008-ap-key-relationships')
        .select('id, name, role_id')
        .eq('user_id', user.id);

      setAllKeyRelationships(krData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setNotes('');
    setSelectedWeeks([]);
    setRecurrenceType('daily');
    setSelectedCustomDays([]);

    // Pre-select inherited items from goal
    if (goal) {
      setSelectedRoleIds(goal.roles?.map(r => r.id) || []);
      setSelectedDomainIds(goal.domains?.map(d => d.id) || []);
      setSelectedKeyRelationshipIds(goal.keyRelationships?.map(kr => kr.id) || []);
    } else {
      setSelectedRoleIds([]);
      setSelectedDomainIds([]);
      setSelectedKeyRelationshipIds([]);
    }
  };

  const handleMultiSelect = (field: 'roles' | 'domains' | 'keyRelationships', id: string) => {
    let setter: React.Dispatch<React.SetStateAction<string[]>>;
    let currentSelection: string[];

    switch (field) {
      case 'roles':
        setter = setSelectedRoleIds;
        currentSelection = selectedRoleIds;
        break;
      case 'domains':
        setter = setSelectedDomainIds;
        currentSelection = selectedDomainIds;
        break;
      case 'keyRelationships':
        setter = setSelectedKeyRelationshipIds;
        currentSelection = selectedKeyRelationshipIds;
        break;
      default:
        return;
    }

    const newSelection = currentSelection.includes(id)
      ? currentSelection.filter(itemId => itemId !== id)
      : [...currentSelection, id];
    setter(newSelection);
  };

  const handleWeekToggle = (weekNumber: number) => {
    setSelectedWeeks(prev => 
      prev.includes(weekNumber)
        ? prev.filter(w => w !== weekNumber)
        : [...prev, weekNumber]
    );
  };

  const handleSelectAll = () => {
    const allWeekNumbers = cycleWeeks.map(w => w.week_number);
    if (selectedWeeks.length === allWeekNumbers.length) {
      setSelectedWeeks([]);
    } else {
      setSelectedWeeks(allWeekNumbers);
    }
  };

  const handleRecurrenceSelect = (type: string) => {
    setRecurrenceType(type);
    if (type !== 'custom') {
      setSelectedCustomDays([]); // Clear custom days when switching away from custom
    }
  };

  const handleCustomDayToggle = (dayIndex: number) => {
    setSelectedCustomDays(prev => 
      prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const getTargetDays = () => {
    if (recurrenceType === 'custom') {
      return selectedCustomDays.length;
    }
    return recurrenceType === 'daily' ? 7 : parseInt(recurrenceType.replace('days', '').replace('day', ''));
  };

  const generateRecurrenceRule = () => {
    if (recurrenceType === 'custom' && selectedCustomDays.length > 0) {
      const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const byDays = selectedCustomDays.map(dayIndex => dayNames[dayIndex]).join(',');
      return `RRULE:FREQ=WEEKLY;BYDAY=${byDays}`;
    } else if (recurrenceType === 'daily') {
      return 'RRULE:FREQ=DAILY';
    } else {
      // For other frequencies (6days, 5days, etc.), we'll use daily with interval
      const days = parseInt(recurrenceType.replace('days', '').replace('day', ''));
      if (days === 7) {
        return 'RRULE:FREQ=DAILY';
      } else {
        // For now, treat as weekly with specific days (Mon-Fri for 5days, etc.)
        const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        const byDays = weekdays.slice(0, days).join(',');
        return `RRULE:FREQ=WEEKLY;BYDAY=${byDays}`;
      }
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for the action.');
      return;
    }

    if (selectedWeeks.length === 0) {
      Alert.alert('Error', 'Please select at least one week.');
      return;
    }

    if (recurrenceType === 'custom' && selectedCustomDays.length === 0) {
      Alert.alert('Error', 'Please select at least one day for custom frequency.');
      return;
    }

    setSaving(true);
    try {
      const targetDays = getTargetDays();
      const recurrenceRule = generateRecurrenceRule();

      // Create the task with week plan
      const taskData = {
        title: title.trim(),
        description: notes.trim() || undefined,
        twelve_wk_goal_id: goal?.id,
        goal_type: 'twelve_wk_goal',
        recurrenceRule,
        selectedRoleIds,
        selectedDomainIds,
        selectedKeyRelationshipIds,
        selectedWeeks: selectedWeeks.map(weekNumber => ({
          weekNumber,
          targetDays,
        })),
      };

      await createTaskWithWeekPlan(taskData);

      Alert.alert('Success', 'Action created successfully!');
      
      // Call onClose to trigger parent refresh
      onClose();
    } catch (error) {
      console.error('Error saving action:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to save action.');
    } finally {
      setSaving(false);
    }
  };

  const getRecurrenceLabel = (type: string) => {
    switch (type) {
      case 'daily': return 'Daily';
      case '6days': return '6 days a week';
      case '5days': return '5 days a week';
      case '4days': return '4 days a week';
      case '3days': return '3 days a week';
      case '2days': return 'Twice a week';
      case '1day': return 'Once a week';
      case 'custom': return 'Custom';
      default: return 'Custom';
    }
  };

  // Filter key relationships based on selected roles
  const filteredKeyRelationships = allKeyRelationships.filter(kr =>
    selectedRoleIds.includes(kr.role_id)
  );

  if (!goal) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add Action Effort</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0078d4" />
            <Text style={styles.loadingText}>Loading form data...</Text>
          </View>
        ) : (
          <ScrollView style={styles.content}>
            <View style={styles.form}>
              {/* Linked to Goal */}
              <View style={styles.field}>
                <Text style={styles.label}>Linked to Goal</Text>
                <View style={styles.goalInfo}>
                  <Text style={styles.goalTitle}>{goal.title}</Text>
                </View>
              </View>

              {/* Title */}
              <View style={styles.field}>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g., Do 100 push-ups"
                  placeholderTextColor="#9ca3af"
                  maxLength={100}
                />
              </View>

              {/* Weeks */}
              <View style={styles.field}>
                <Text style={styles.label}>Weeks *</Text>
                <View style={styles.weekSelector}>
                  <TouchableOpacity
                    style={[styles.weekButton, selectedWeeks.length === 12 && styles.weekButtonSelected]}
                    onPress={handleSelectAll}
                  >
                    <Text style={[styles.weekButtonText, selectedWeeks.length === 12 && styles.weekButtonTextSelected]}>
                      Select All
                    </Text>
                  </TouchableOpacity>

                  {cycleWeeks.map(weekData => (
                    <TouchableOpacity
                      key={weekData.week_number}
                      style={[styles.weekButton, selectedWeeks.includes(weekData.week_number) && styles.weekButtonSelected]}
                      onPress={() => handleWeekToggle(weekData.week_number)}
                    >
                      <Text style={[styles.weekButtonText, selectedWeeks.includes(weekData.week_number) && styles.weekButtonTextSelected]}>
                        Week {weekData.week_number}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Frequency */}
              <View style={styles.field}>
                <Text style={styles.label}>Frequency per week *</Text>
                <View style={styles.frequencySelector}>
                  {['daily', '6days', '5days', '4days', '3days', '2days', '1day', 'custom'].map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.frequencyButton, recurrenceType === type && styles.frequencyButtonSelected]}
                      onPress={() => handleRecurrenceSelect(type)}
                    >
                      <Text style={[styles.frequencyButtonText, recurrenceType === type && styles.frequencyButtonTextSelected]}>
                        {getRecurrenceLabel(type)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Custom Days Selection (only show when custom is selected) */}
              {recurrenceType === 'custom' && (
                <View style={styles.field}>
                  <Text style={styles.label}>Select Days *</Text>
                  <View style={styles.customDaysSelector}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.customDayButton,
                          selectedCustomDays.includes(index) && styles.customDayButtonSelected
                        ]}
                        onPress={() => handleCustomDayToggle(index)}
                      >
                        <Text style={[
                          styles.customDayButtonText,
                          selectedCustomDays.includes(index) && styles.customDayButtonTextSelected
                        ]}>
                          {dayName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Roles */}
              <View style={styles.field}>
                <Text style={styles.label}>Roles</Text>
                <View style={styles.checkboxGrid}>
                  {allRoles.map(role => {
                    const isSelected = selectedRoleIds.includes(role.id);
                    const isInherited = goal.roles?.some(gr => gr.id === role.id);
                    return (
                      <TouchableOpacity
                        key={role.id}
                        style={styles.checkItem}
                        onPress={() => handleMultiSelect('roles', role.id)}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={[
                          styles.checkLabel,
                          isInherited && styles.inheritedLabel
                        ]}>
                          {role.label}
                          {isInherited && ' (from goal)'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Domains */}
              <View style={styles.field}>
                <Text style={styles.label}>Domains</Text>
                <View style={styles.checkboxGrid}>
                  {allDomains.map(domain => {
                    const isSelected = selectedDomainIds.includes(domain.id);
                    const isInherited = goal.domains?.some(gd => gd.id === domain.id);
                    return (
                      <TouchableOpacity
                        key={domain.id}
                        style={styles.checkItem}
                        onPress={() => handleMultiSelect('domains', domain.id)}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={[
                          styles.checkLabel,
                          isInherited && styles.inheritedLabel
                        ]}>
                          {domain.name}
                          {isInherited && ' (from goal)'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Key Relationships (filtered by selected roles) */}
              {filteredKeyRelationships.length > 0 && (
                <View style={styles.field}>
                  <Text style={styles.label}>Key Relationships</Text>
                  <View style={styles.checkboxGrid}>
                    {filteredKeyRelationships.map(kr => {
                      const isSelected = selectedKeyRelationshipIds.includes(kr.id);
                      const isInherited = goal.keyRelationships?.some(gkr => gkr.id === kr.id);
                      return (
                        <TouchableOpacity
                          key={kr.id}
                          style={styles.checkItem}
                          onPress={() => handleMultiSelect('keyRelationships', kr.id)}
                        >
                          <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <Text style={[
                            styles.checkLabel,
                            isInherited && styles.inheritedLabel
                          ]}>
                            {kr.name}
                            {isInherited && ' (from goal)'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Notes */}
              <View style={styles.field}>
                <Text style={styles.label}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add details if useful"
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
              </View>
            </View>
          </ScrollView>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.saveButton, (!title.trim() || selectedWeeks.length === 0 || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!title.trim() || selectedWeeks.length === 0 || (recurrenceType === 'custom' && selectedCustomDays.length === 0) || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Action</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  content: {
    flex: 1,
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
    marginBottom: 8,
  },
  goalInfo: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
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
  weekSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weekButtonSelected: {
    backgroundColor: '#1f2937',
    borderColor: '#1f2937',
  },
  weekButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  weekButtonTextSelected: {
    color: '#ffffff',
  },
  frequencySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  frequencyButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  frequencyButtonSelected: {
    backgroundColor: '#1f2937',
    borderColor: '#1f2937',
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  frequencyButtonTextSelected: {
    color: '#ffffff',
  },
  customDaysSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customDayButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  customDayButtonSelected: {
    backgroundColor: '#1f2937',
    borderColor: '#1f2937',
  },
  customDayButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  customDayButtonTextSelected: {
    color: '#ffffff',
  },
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 3,
    marginRight: 8,
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
  checkLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  inheritedLabel: {
    fontWeight: '600',
    color: '#0078d4',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#0078d4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ActionEffortModal;