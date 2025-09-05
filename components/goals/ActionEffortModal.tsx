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
  start_date: string;
  end_date: string;
  user_cycle_id: string;
}

interface ActionEffortModalProps {
  visible: boolean;
  onClose: () => void;
  goal: TwelveWeekGoal | null;
  cycleWeeks: CycleWeek[];
  createOrUpdateParentTask: (taskData: any) => Promise<any>;
  upsertWeekPlans: (taskId: string, weekPlans: any[]) => Promise<void>;
}

const ActionEffortModal: React.FC<ActionEffortModalProps> = ({
  visible,
  onClose,
  goal,
  cycleWeeks,
  createOrUpdateParentTask,
  upsertWeekPlans,
}) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [frequency, setFrequency] = useState(7); // Daily by default
  const [additionalRoleIds, setAdditionalRoleIds] = useState('');
  const [additionalDomainIds, setAdditionalDomainIds] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      // Reset form when modal opens
      setTitle('');
      setNotes('');
      setSelectedWeeks([]);
      setFrequency(7);
      setAdditionalRoleIds('');
      setAdditionalDomainIds('');
    }
  }, [visible]);

  const handleWeekToggle = (weekNumber: number) => {
    setSelectedWeeks(prev => 
      prev.includes(weekNumber) 
        ? prev.filter(w => w !== weekNumber)
        : [...prev, weekNumber]
    );
  };

  const handleSelectAll = () => {
    if (selectedWeeks.length === 12) {
      setSelectedWeeks([]);
    } else {
      setSelectedWeeks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    }
  };

  const handleFrequencySelect = (freq: number) => {
    setFrequency(freq);
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

    setSaving(true);
    try {
      // Prepare inherited role and domain IDs from the goal
      const inheritedRoleIds = goal?.roles?.map(r => r.id) || [];
      const inheritedDomainIds = goal?.domains?.map(d => d.id) || [];

      // Parse additional role and domain IDs
      const addRoleIds = additionalRoleIds
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
      
      const addDomainIds = additionalDomainIds
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);

      // Create the parent task
      const taskData = {
        title: title.trim(),
        description: notes.trim() || undefined,
        goal_id: goal?.id,
        inherited_role_ids: inheritedRoleIds,
        inherited_domain_ids: inheritedDomainIds,
        add_role_ids: addRoleIds,
        add_domain_ids: addDomainIds,
        selectedWeeks: selectedWeeks.map(weekNumber => ({
          weekNumber,
          targetDays: frequency,
        })),
      };

      const result = await createOrUpdateParentTask(taskData);
      
      if (result?.id) {
        // Create week plans
        const weekPlans = selectedWeeks.map(weekNumber => ({
          week_number: weekNumber,
          target_days: frequency,
        }));
        
        await upsertWeekPlans(result.id, weekPlans);
      }

      Alert.alert('Success', 'Action created successfully!');
      onClose();
    } catch (error) {
      console.error('Error saving action:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to save action.');
    } finally {
      setSaving(false);
    }
  };

  const getFrequencyLabel = (freq: number) => {
    switch (freq) {
      case 7: return 'Daily';
      case 6: return '6 days a week';
      case 5: return '5 days a week';
      case 4: return '4 days a week';
      case 3: return '3 days a week';
      case 2: return 'Twice a week';
      case 1: return 'Once a week';
      default: return 'Custom';
    }
  };

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

        <ScrollView style={styles.content}>
          <View style={styles.form}>
            {/* Linked to Goal */}
            <View style={styles.field}>
              <Text style={styles.label}>Linked to Goal</Text>
              <View style={styles.goalInfo}>
                <Text style={styles.goalTitle}>{goal.title}</Text>
                <View style={styles.inheritedTags}>
                  {goal.roles?.map(role => (
                    <View key={role.id} style={[styles.tag, styles.roleTag, { backgroundColor: role.color || '#f3e8ff' }]}>
                      <Text style={styles.tagText}>{role.label}</Text>
                    </View>
                  ))}
                  {goal.domains?.map(domain => (
                    <View key={domain.id} style={[styles.tag, styles.domainTag]}>
                      <Text style={styles.tagText}>{domain.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Title */}
            <View style={styles.field}>
              <Text style={styles.label}>Title</Text>
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
              <Text style={styles.label}>Weeks</Text>
              <View style={styles.weekSelector}>
                <TouchableOpacity
                  style={[styles.weekButton, selectedWeeks.length === 12 && styles.weekButtonSelected]}
                  onPress={handleSelectAll}
                >
                  <Text style={[styles.weekButtonText, selectedWeeks.length === 12 && styles.weekButtonTextSelected]}>
                    Select All
                  </Text>
                </TouchableOpacity>
                
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(week => (
                  <TouchableOpacity
                    key={week}
                    style={[styles.weekButton, selectedWeeks.includes(week) && styles.weekButtonSelected]}
                    onPress={() => handleWeekToggle(week)}
                  >
                    <Text style={[styles.weekButtonText, selectedWeeks.includes(week) && styles.weekButtonTextSelected]}>
                      Week {week}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Frequency */}
            <View style={styles.field}>
              <Text style={styles.label}>Frequency per week</Text>
              <View style={styles.frequencySelector}>
                {[7, 6, 5, 4, 3, 2, 1].map(freq => (
                  <TouchableOpacity
                    key={freq}
                    style={[styles.frequencyButton, frequency === freq && styles.frequencyButtonSelected]}
                    onPress={() => handleFrequencySelect(freq)}
                  >
                    <Text style={[styles.frequencyButtonText, frequency === freq && styles.frequencyButtonTextSelected]}>
                      {getFrequencyLabel(freq)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

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

            {/* Roles */}
            <View style={styles.field}>
              <Text style={styles.label}>Roles (goal defaults locked)</Text>
              <Text style={styles.inheritedInfo}>
                Inherited: {goal.roles?.length || 0}. You can add more below.
              </Text>
              {goal.roles && goal.roles.length > 0 && (
                <Text style={styles.inheritedList}>
                  {goal.roles.map(r => r.label).join(', ')}
                </Text>
              )}
              <TextInput
                style={styles.input}
                value={additionalRoleIds}
                onChangeText={setAdditionalRoleIds}
                placeholder="Add role ids comma-separated"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Domains */}
            <View style={styles.field}>
              <Text style={styles.label}>Domains (goal defaults locked)</Text>
              <Text style={styles.inheritedInfo}>
                Inherited: {goal.domains?.length || 0}. You can add more below.
              </Text>
              {goal.domains && goal.domains.length > 0 && (
                <Text style={styles.inheritedList}>
                  {goal.domains.map(d => d.name).join(', ')}
                </Text>
              )}
              <TextInput
                style={styles.input}
                value={additionalDomainIds}
                onChangeText={setAdditionalDomainIds}
                placeholder="Add domain ids comma-separated"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>
        </ScrollView>

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
            disabled={!title.trim() || selectedWeeks.length === 0 || saving}
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
  inheritedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  roleTag: {
    backgroundColor: '#fce7f3',
    borderColor: '#f3e8ff',
  },
  domainTag: {
    backgroundColor: '#fed7aa',
    borderColor: '#fdba74',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
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
  inheritedInfo: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  inheritedList: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
    marginBottom: 8,
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