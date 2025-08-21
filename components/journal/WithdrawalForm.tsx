import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { X } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

interface WithdrawalFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
  initialData?: {
    id?: string;
    title?: string;
    amount?: number;
    withdrawal_date?: string;
    notes?: string;
    roles?: Array<{id: string; label: string}>;
    domains?: Array<{id: string; name: string}>;
    keyRelationships?: Array<{id: string; name: string}>;
  };
  scope?: {
    type: 'user' | 'role' | 'key_relationship' | 'domain';
    id?: string;
  };
}

interface Role { id: string; label: string; }
interface Domain { id: string; name: string; }
interface KeyRelationship { id: string; name: string; role_id: string; }

export function WithdrawalForm({ 
  visible, 
  onClose, 
  onSubmitSuccess, 
  initialData,
  scope 
}: WithdrawalFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    withdrawalDate: new Date(),
    notes: '',
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    selectedKeyRelationshipIds: [] as string[],
  });

  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setFormData({
          title: initialData.title || '',
          amount: initialData.amount?.toString() || '',
          withdrawalDate: initialData.withdrawal_date ? new Date(initialData.withdrawal_date) : new Date(),
          notes: initialData.notes || '',
          selectedRoleIds: initialData.roles?.map(r => r.id) || [],
          selectedDomainIds: initialData.domains?.map(d => d.id) || [],
          selectedKeyRelationshipIds: initialData.keyRelationships?.map(kr => kr.id) || [],
        });
      } else {
        // Reset form for new withdrawal
        setFormData({
          title: '',
          amount: '',
          withdrawalDate: new Date(),
          notes: '',
          selectedRoleIds: scope?.type === 'role' && scope.id ? [scope.id] : [],
          selectedDomainIds: scope?.type === 'domain' && scope.id ? [scope.id] : [],
          selectedKeyRelationshipIds: scope?.type === 'key_relationship' && scope.id ? [scope.id] : [],
        });
      }
      fetchOptions();
    }
  }, [visible, initialData, scope]);

  const fetchOptions = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { data: roleData },
        { data: domainData },
        { data: krData }
      ] = await Promise.all([
        supabase.from('0008-ap-roles').select('id,label').eq('user_id', user.id).eq('is_active', true),
        supabase.from('0008-ap-domains').select('id,name'),
        supabase.from('0008-ap-key-relationships').select('id,name,role_id').eq('user_id', user.id)
      ]);

      setRoles(roleData || []);
      setDomains(domainData || []);
      setKeyRelationships(krData || []);
    } catch (error) {
      console.error('Error fetching options:', error);
      Alert.alert('Error', (error as Error).message);
    }
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

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.amount || parseFloat(formData.amount) <= 0) {
      Alert.alert('Error', 'Please fill in title and a valid amount');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const withdrawalPayload = {
        user_id: user.id,
        title: formData.title.trim(),
        amount: parseFloat(formData.amount),
        withdrawal_date: formData.withdrawalDate.toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      };

      let withdrawalData;
      let withdrawalError;

      if (initialData?.id) {
        // Update existing withdrawal
        const { data, error } = await supabase
          .from('0008-ap-withdrawals')
          .update(withdrawalPayload)
          .eq('id', initialData.id)
          .select()
          .single();
        withdrawalData = data;
        withdrawalError = error;
      } else {
        // Create new withdrawal
        const { data, error } = await supabase
          .from('0008-ap-withdrawals')
          .insert(withdrawalPayload)
          .select()
          .single();
        withdrawalData = data;
        withdrawalError = error;
      }

      if (withdrawalError) throw withdrawalError;
      if (!withdrawalData) throw new Error('Failed to save withdrawal');

      const withdrawalId = withdrawalData.id;

      // Handle joins for withdrawal
      if (initialData?.id) {
        // Clear existing joins for edit mode
        await Promise.all([
          supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
          supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
          supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
        ]);
      }

      // Create new joins
      const roleJoins = formData.selectedRoleIds.map(role_id => ({ 
        parent_id: withdrawalId, 
        parent_type: 'withdrawal', 
        role_id, 
        user_id: user.id 
      }));
      const domainJoins = formData.selectedDomainIds.map(domain_id => ({ 
        parent_id: withdrawalId, 
        parent_type: 'withdrawal', 
        domain_id, 
        user_id: user.id 
      }));
      const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ 
        parent_id: withdrawalId, 
        parent_type: 'withdrawal', 
        key_relationship_id, 
        user_id: user.id 
      }));

      // Add note if provided
      if (formData.notes && formData.notes.trim()) {
        const { data: noteData, error: noteError } = await supabase
          .from('0008-ap-notes')
          .insert({ user_id: user.id, content: formData.notes })
          .select()
          .single();
        
        if (noteError) throw noteError;
        
        await supabase
          .from('0008-ap-universal-notes-join')
          .insert({ 
            parent_id: withdrawalId, 
            parent_type: 'withdrawal', 
            note_id: noteData.id, 
            user_id: user.id 
          });
      }

      // Insert joins
      if (roleJoins.length > 0) {
        await supabase.from('0008-ap-universal-roles-join').insert(roleJoins);
      }
      if (domainJoins.length > 0) {
        await supabase.from('0008-ap-universal-domains-join').insert(domainJoins);
      }
      if (krJoins.length > 0) {
        await supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins);
      }

      Alert.alert('Success', `Withdrawal ${initialData?.id ? 'updated' : 'created'} successfully`);
      onSubmitSuccess();
      onClose();

    } catch (error) {
      console.error('Error saving withdrawal:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const filteredKeyRelationships = keyRelationships.filter(kr => 
    formData.selectedRoleIds.includes(kr.role_id)
  );

  const formatDateForInput = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {initialData?.id ? 'Edit Withdrawal' : 'New Withdrawal'}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Title/Reason *</Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                placeholder="Enter withdrawal reason"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Amount *</Text>
              <TextInput
                style={styles.input}
                value={formData.amount}
                onChangeText={(text) => setFormData(prev => ({ ...prev, amount: text }))}
                placeholder="0.0"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowCalendar(true)}
              >
                <Text style={styles.dateButtonText}>
                  {formatDateForInput(formData.withdrawalDate)}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Roles</Text>
              <View style={styles.checkboxGrid}>
                {roles.map(role => {
                  const isSelected = formData.selectedRoleIds.includes(role.id);
                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={styles.checkItem}
                      onPress={() => handleMultiSelect('selectedRoleIds', role.id)}
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

            {filteredKeyRelationships.length > 0 && (
              <View style={styles.field}>
                <Text style={styles.label}>Key Relationships</Text>
                <View style={styles.checkboxGrid}>
                  {filteredKeyRelationships.map(kr => {
                    const isSelected = formData.selectedKeyRelationshipIds.includes(kr.id);
                    return (
                      <TouchableOpacity
                        key={kr.id}
                        style={styles.checkItem}
                        onPress={() => handleMultiSelect('selectedKeyRelationshipIds', kr.id)}
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

            <View style={styles.field}>
              <Text style={styles.label}>Domains</Text>
              <View style={styles.checkboxGrid}>
                {domains.map(domain => {
                  const isSelected = formData.selectedDomainIds.includes(domain.id);
                  return (
                    <TouchableOpacity
                      key={domain.id}
                      style={styles.checkItem}
                      onPress={() => handleMultiSelect('selectedDomainIds', domain.id)}
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

            <View style={styles.field}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                placeholder="Optional notes about this withdrawal..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={[
              styles.submitButton,
              (!formData.title.trim() || !formData.amount || loading) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!formData.title.trim() || !formData.amount || loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Saving...' : initialData?.id ? 'Update Withdrawal' : 'Save Withdrawal'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Calendar Modal */}
        <Modal visible={showCalendar} transparent animationType="fade">
          <View style={styles.calendarOverlay}>
            <View style={styles.calendarContainer}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarTitle}>Select Date</Text>
                <TouchableOpacity onPress={() => setShowCalendar(false)}>
                  <X size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <Calendar
                onDayPress={(day) => {
                  setFormData(prev => ({ ...prev, withdrawalDate: new Date(day.timestamp) }));
                  setShowCalendar(false);
                }}
                markedDates={{
                  [formData.withdrawalDate.toISOString().split('T')[0]]: {
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
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  submitButton: {
    backgroundColor: '#0078d4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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