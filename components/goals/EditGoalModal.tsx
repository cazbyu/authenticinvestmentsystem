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
import { X, Trash2 } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { TwelveWeekGoal } from '@/hooks/useGoalProgress'; // Assuming this interface is available

interface Role { id: string; label: string; color?: string; }
interface Domain { id: string; name: string; }
interface KeyRelationship { id: string; name: string; role_id: string; }
interface Note { id: string; content: string; created_at: string; }

interface EditGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdate: () => void; // Callback to refresh data in parent
  goal: TwelveWeekGoal | null;
}

export function EditGoalModal({ visible, onClose, onUpdate, goal }: EditGoalModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newNoteText, setNewNoteText] = useState(''); // For adding new notes
  const [noteText, setNoteText] = useState('');
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [existingNoteIds, setExistingNoteIds] = useState<string[]>([]);
  
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [selectedKeyRelationshipIds, setSelectedKeyRelationshipIds] = useState<string[]>([]);

  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [allKeyRelationships, setAllKeyRelationships] = useState<KeyRelationship[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);

  useEffect(() => {
    if (visible && goal) {
      loadGoalData();
      fetchOptions();
    } else if (!visible) {
      // Reset state when modal closes
      setTitle('');
      setDescription('');
      setNewNoteText('');
      setSelectedRoleIds([]);
      setSelectedDomainIds([]);
      setSelectedKeyRelationshipIds([]);
      setAllRoles([]);
      setAllDomains([]);
      setAllKeyRelationships([]);
      setLoading(true);
      setSaving(false);
    }
  }, [visible, goal]);

  const loadGoalData = async () => {
    if (!goal) return;
    setTitle(goal.title);
    setDescription(goal.description || '');
    
    // Load existing associations
    setSelectedRoleIds(goal.roles?.map(r => r.id) || []);
    setSelectedDomainIds(goal.domains?.map(d => d.id) || []);
    setSelectedKeyRelationshipIds(goal.keyRelationships?.map(kr => kr.id) || []);
  };

  const fetchOptions = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const [
        { data: rolesData },
        { data: domainsData },
        { data: krData }
      ] = await Promise.all([
        supabase.from('0008-ap-roles').select('id, label, color').eq('user_id', user.id).eq('is_active', true),
        supabase.from('0008-ap-domains').select('id, name'),
        supabase.from('0008-ap-key-relationships').select('id, name, role_id').eq('user_id', user.id)
      ]);

      setAllRoles(rolesData || []);
      setAllDomains(domainsData || []);
      setAllKeyRelationships(krData || []);
    } catch (error) {
      console.error('Error fetching options:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to load options.');
    } finally {
      setLoading(false);
    }
  };

  const handleMultiSelect = (field: 'roles' | 'domains' | 'keyRelationships' | 'notes', id: string) => {
    let setter: React.Dispatch<React.SetStateAction<string[]>>;
    let currentSelection: string[];

    switch (field) {
      case 'roles': setter = setSelectedRoleIds; currentSelection = selectedRoleIds; break;
      case 'domains': setter = setSelectedDomainIds; currentSelection = selectedDomainIds; break;
      case 'keyRelationships': setter = setSelectedKeyRelationshipIds; currentSelection = selectedKeyRelationshipIds; break;
      default: return;
    }

    const newSelection = currentSelection.includes(id)
      ? currentSelection.filter(itemId => itemId !== id)
      : [...currentSelection, id];
    setter(newSelection);
  };

  const handleSave = async () => {
    if (!goal || !title.trim()) {
      Alert.alert('Error', 'Goal title cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // 1. Update main goal data
      const { error: goalUpdateError } = await supabase
        .from('0008-ap-goals-12wk')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', goal.id);

      if (goalUpdateError) throw goalUpdateError;

      // 2. Handle Joins (Roles, Domains, Key Relationships)
      const updateJoins = async (
        tableName: string, 
        parentIdField: string, 
        childIdField: string, 
        currentLinkedIds: string[], 
        newLinkedIds: string[]
      ) => {
        const toAdd = newLinkedIds.filter(id => !currentLinkedIds.includes(id));
        const toRemove = currentLinkedIds.filter(id => !newLinkedIds.includes(id));

        if (toRemove.length > 0) {
          const { error } = await supabase
            .from(tableName)
            .delete()
            .eq(parentIdField, goal.id)
            .in(childIdField, toRemove);
          if (error) throw error;
        }

        if (toAdd.length > 0) {
          const inserts = toAdd.map(id => ({
            parent_id: goal.id,
            parent_type: 'goal',
            [childIdField]: id,
            user_id: user.id,
          }));
          const { error } = await supabase
            .from(tableName)
            .insert(inserts);
          if (error) throw error;
        }
      };

      // Fetch current joins for comparison
      const [{ data: currentRolesJoins }, { data: currentDomainsJoins }, { data: currentKRsJoins }] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('role_id').eq('parent_id', goal.id).eq('parent_type', 'goal'),
        supabase.from('0008-ap-universal-domains-join').select('domain_id').eq('parent_id', goal.id).eq('parent_type', 'goal'),
        supabase.from('0008-ap-universal-key-relationships-join').select('key_relationship_id').eq('parent_id', goal.id).eq('parent_type', 'goal'),
      ]);

      const currentRoleIds = currentRolesJoins?.map(j => j.role_id) || [];
      const currentDomainIds = currentDomainsJoins?.map(j => j.domain_id) || [];
      const currentKRIds = currentKRsJoins?.map(j => j.key_relationship_id) || [];

      await Promise.all([
        updateJoins('0008-ap-universal-roles-join', 'parent_id', 'role_id', currentRoleIds, selectedRoleIds),
        updateJoins('0008-ap-universal-domains-join', 'parent_id', 'domain_id', currentDomainIds, selectedDomainIds),
        updateJoins('0008-ap-universal-key-relationships-join', 'parent_id', 'key_relationship_id', currentKRIds, selectedKeyRelationshipIds),
      ]);

      // 3. Add new note if provided
      if (newNoteText.trim()) {
        const { data: newNote, error: newNoteError } = await supabase
          .from('0008-ap-notes') 
          .insert({ user_id: user.id, content: newNoteText.trim() })
          .select('id')
          .single();
        if (newNoteError) throw newNoteError;

        const { error: noteJoinError } = await supabase
          .from('0008-ap-universal-notes-join')
          .insert({ parent_id: goal.id, parent_type: 'goal', note_id: newNote.id, user_id: user.id });
        if (noteJoinError) throw noteJoinError;
      }

      Alert.alert('Success', 'Goal updated successfully!');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error saving goal:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to save goal.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    console.log('Delete button clicked, goal:', goal);
    if (!goal) return;
    setShowConfirmDeleteModal(true);
  };

  const confirmDelete = async () => {
    console.log('Delete confirmed, starting deletion process...');
    if (!goal) return;

    try {
      setSaving(true);
      setShowConfirmDeleteModal(false);
      console.log('Set saving to true');
      
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');
      console.log('User authenticated:', user.id);
      
      // Delete all join table entries for this goal
      console.log('Deleting join table entries...');
      await Promise.all([
        supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', goal.id).eq('parent_type', 'goal'),
        supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', goal.id).eq('parent_type', 'goal'),
        supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', goal.id).eq('parent_type', 'goal'),
        supabase.from('0008-ap-universal-notes-join').delete().eq('parent_id', goal.id).eq('parent_type', 'goal'),
      ]);
      console.log('Join table entries deleted');

      // Find and delete any tasks linked to this goal
      console.log('Finding tasks linked to goal...');
      const { data: goalTaskJoins, error: goalTaskJoinsError } = await supabase
        .from('0008-ap-universal-goals-join')
        .select('parent_id')
        .eq('twelve_wk_goal_id', goal.id)
        .eq('parent_type', 'task');

      if (goalTaskJoinsError) throw goalTaskJoinsError;
      console.log('Found linked tasks:', goalTaskJoins);

      const taskIds = goalTaskJoins?.map(gtj => gtj.parent_id) || [];
      
      if (taskIds.length > 0) {
        console.log('Deleting linked tasks and their data...');
        await Promise.all([
          supabase.from('0008-ap-task-week-plan').delete().in('task_id', taskIds),
          supabase.from('0008-ap-task-log').delete().in('task_id', taskIds),
          supabase.from('0008-ap-universal-roles-join').delete().in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').delete().in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-key-relationships-join').delete().in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-notes-join').delete().in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-goals-join').delete().in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-tasks').delete().in('id', taskIds)
        ]);
        console.log('Linked tasks deleted');
      }
      
      // Delete any remaining goal joins (deposit ideas, etc.)
      console.log('Deleting remaining goal joins...');
      await supabase.from('0008-ap-universal-goals-join').delete().eq('twelve_wk_goal_id', goal.id);
      console.log('Remaining goal joins deleted');
      
      // Now delete the goal itself
      console.log('Deleting goal itself...');
      const { error } = await supabase
        .from('0008-ap-goals-12wk')
        .delete()
        .eq('id', goal.id);

      if (error) throw error;
      console.log('Goal deleted successfully');

      Alert.alert('Success', 'Goal deleted successfully!');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error deleting goal:', error);
      console.log('Delete error details:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to delete goal.');
    } finally {
      console.log('Setting saving to false');
      setSaving(false);
    }
  };

  const filteredKeyRelationships = allKeyRelationships.filter(kr =>
    selectedRoleIds.includes(kr.role_id)
  );

  if (!goal) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Edit 12-Week Goal</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0078d4" />
              <Text style={styles.loadingText}>Loading data...</Text>
            </View>
          ) : (
            <View style={styles.form}>
              {/* Goal Title */}
              <View style={styles.field}>
                <Text style={styles.label}>Goal Title *</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter goal title"
                  placeholderTextColor="#9ca3af"
                  maxLength={100}
                />
              </View>

              {/* Goal Description */}
              <View style={styles.field}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe your goal and why it matters..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
              </View>

              {/* Wellness Domains */}
              <View style={styles.field}>
                <Text style={styles.label}>Wellness Domains</Text>
                <View style={styles.checkboxGrid}>
                  {allDomains.map(domain => {
                    const isSelected = selectedDomainIds.includes(domain.id);
                    return (
                      <TouchableOpacity
                        key={domain.id}
                        style={styles.checkItem}
                        onPress={() => handleMultiSelect('domains', domain.id)}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.checkLabel}>{domain.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Active Roles */}
              <View style={styles.field}>
                <Text style={styles.label}>Active Roles</Text>
                <View style={styles.checkboxGrid}>
                  {allRoles.map(role => {
                    const isSelected = selectedRoleIds.includes(role.id);
                    return (
                      <TouchableOpacity
                        key={role.id}
                        style={styles.checkItem}
                        onPress={() => handleMultiSelect('roles', role.id)}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.checkLabel}>{role.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Key Relationships (filtered by selected Roles) */}
              {filteredKeyRelationships.length > 0 && (
                <View style={styles.field}>
                  <Text style={styles.label}>Key Relationships</Text>
                  <View style={styles.checkboxGrid}>
                    {filteredKeyRelationships.map(kr => {
                      const isSelected = selectedKeyRelationshipIds.includes(kr.id);
                      return (
                        <TouchableOpacity
                          key={kr.id}
                          style={styles.checkItem}
                          onPress={() => handleMultiSelect('keyRelationships', kr.id)}
                        >
                          <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <Text style={styles.checkLabel}>{kr.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
              
              {/* Existing Notes */}
              {allNotes.length > 0 && (
                <View style={styles.field}>
                  <Text style={styles.label}>Existing Notes</Text>
                  <View style={styles.checkboxGrid}>
                    {allNotes.map(note => {
                      const isSelected = existingNoteIds.includes(note.id);
                      return (
                        <TouchableOpacity
                          key={note.id}
                          style={styles.checkItem}
                          onPress={() => handleMultiSelect('notes', note.id)}
                        >
                          <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <Text style={styles.checkLabel} numberOfLines={1}>{note.content}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Add New Note */}
              <View style={styles.field}>
                <Text style={styles.label}>Add New Note</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder="Write a new note for this goal..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={saving}
          >
            <Trash2 size={16} color="#ffffff" />
            <Text style={styles.deleteButtonText}>Delete Goal</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.saveButton, (!title.trim() || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!title.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Custom Delete Confirmation Modal */}
        {showConfirmDeleteModal && (
          <Modal
            visible={showConfirmDeleteModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowConfirmDeleteModal(false)}
          >
            <View style={styles.confirmOverlay}>
              <View style={styles.confirmContainer}>
                <Text style={styles.confirmTitle}>Delete Goal</Text>
                <Text style={styles.confirmMessage}>
                  Are you sure you want to delete this goal? This action cannot be undone.
                </Text>
                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    style={styles.confirmCancelButton}
                    onPress={() => setShowConfirmDeleteModal(false)}
                    disabled={saving}
                  >
                    <Text style={styles.confirmCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmDeleteButton,
                      saving && styles.confirmDeleteButtonDisabled,
                    ]}
                    onPress={confirmDelete}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.confirmDeleteButtonText}>Delete</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
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
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    minWidth: 300,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmCancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmDeleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  confirmDeleteButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  confirmDeleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  existingNotesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  existingNotesLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 8,
  },
  existingNoteItem: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0078d4',
  },
  existingNoteContent: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
    marginBottom: 4,
  },
  existingNoteDate: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
});