import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, FlatList } from 'react-native';
import { getSupabaseClient } from "@/lib/supabase";
import { X } from 'lucide-react-native';

// TYPE DEFINITIONS
interface DepositIdeaFormProps {
  mode: "create" | "edit";
  initialData?: Partial<any>;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

interface Role { id: string; label: string; }
interface Domain { id: string; name: string; }
interface KeyRelationship { id: string; name: string; role_id: string; }
interface TwelveWeekGoal { id: string; title: string; }

// MAIN FORM COMPONENT
const DepositIdeaForm: React.FC<DepositIdeaFormProps> = ({ mode, initialData, onSubmitSuccess, onClose }) => {

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    notes: initialData?.notes || '',
    follow_up: initialData?.follow_up || false,
    selectedRoleIds: initialData?.roles?.map(r => r.id) || [] as string[],
    selectedDomainIds: initialData?.domains?.map(d => d.id) || [] as string[],
    selectedKeyRelationshipIds: initialData?.keyRelationships?.map(kr => kr.id) || [] as string[],
    selectedGoalId: initialData?.goal_12wk_id || null as string | null,
  });

  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [twelveWeekGoals, setTwelveWeekGoals] = useState<TwelveWeekGoal[]>([]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: roleData } = await supabase.from('0008-ap-roles').select('id,label').eq('user_id', user.id).eq('is_active', true);
        const { data: domainData } = await supabase.from('0007-ap-domains').select('id,name');
        const { data: krData } = await supabase.from('0008-ap-key-relationships').select('id,name,role_id').eq('user_id', user.id);
        const { data: goalData } = await supabase.from('0008-ap-goals-12wk').select('id,title').eq('user_id', user.id).eq('status', 'active');

        setRoles(roleData || []);
        setDomains(domainData || []);
        setKeyRelationships(krData || []);
        setTwelveWeekGoals(goalData || []);
      } catch (error) {
        console.error('Error fetching options:', error);
        Alert.alert('Error', (error as Error).message || 'Failed to load options');
      }
    };
    fetchOptions();
  }, []);

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
    setLoading(true);
    try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found");

        const payload: any = {
            user_id: user.id,
            title: formData.title,
            follow_up: formData.follow_up,
            updated_at: new Date().toISOString(),
        };

        let ideaData;
        let ideaError;

        if (mode === 'edit' && initialData?.id) {
            const { data, error } = await supabase
                .from('0008-ap-deposit-ideas')
                .update(payload)
                .eq('id', initialData.id)
                .select()
                .single();
            ideaData = data;
            ideaError = error;
        } else {
            const { data, error } = await supabase
                .from('0008-ap-deposit-ideas')
                .insert(payload)
                .select()
                .single();
            ideaData = data;
            ideaError = error;
        }

        if (ideaError) throw ideaError;
        if (!ideaData) throw new Error("Failed to create deposit idea");

        const ideaId = ideaData.id;

        if (mode === 'edit' && initialData?.id) {
            await Promise.all([
                supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', ideaId).eq('parent_type', 'depositIdea'),
                supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', ideaId).eq('parent_type', 'depositIdea'),
                supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', ideaId).eq('parent_type', 'depositIdea'),
            ]);
        }

        const roleJoins = formData.selectedRoleIds.map(role_id => ({ parent_id: ideaId, parent_type: 'depositIdea', role_id, user_id: user.id }));
        const domainJoins = formData.selectedDomainIds.map(domain_id => ({ parent_id: ideaId, parent_type: 'depositIdea', domain_id, user_id: user.id }));
        const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ parent_id: ideaId, parent_type: 'depositIdea', key_relationship_id, user_id: user.id }));

        // Only add a new note if there's content in the notes field
        if (formData.notes && formData.notes.trim()) {
            const { data: noteData, error: noteError } = await supabase.from('0008-ap-notes').insert({ user_id: user.id, content: formData.notes }).select().single();
            if (noteError) throw noteError;
            await supabase.from('0008-ap-universal-notes-join').insert({ parent_id: ideaId, parent_type: 'depositIdea', note_id: noteData.id, user_id: user.id });
        }

        if (roleJoins.length > 0) await supabase.from('0008-ap-universal-roles-join').insert(roleJoins);
        if (domainJoins.length > 0) await supabase.from('0008-ap-universal-domains-join').insert(domainJoins);
        if (krJoins.length > 0) await supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins);

        onSubmitSuccess();
        onClose();

    } catch (error) {
        console.error(`Error ${mode === 'edit' ? 'updating' : 'creating'} deposit idea:`, error);
        Alert.alert('Error', (error as Error).message || `Failed to ${mode === 'edit' ? 'update' : 'create'} deposit idea`);
    } finally {
        setLoading(false);
    }
  };

  const filteredKeyRelationships = keyRelationships.filter(kr => formData.selectedRoleIds.includes(kr.role_id));

  return (
    <View style={styles.formContainer}>
        <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{mode === 'create' ? 'New Deposit Idea' : 'Edit Deposit Idea'}</Text>
            <TouchableOpacity onPress={onClose}><X size={24} color="#6b7280" /></TouchableOpacity>
        </View>
        <ScrollView style={styles.formContent}>
            <TextInput style={styles.input} placeholder="Deposit Idea Title" value={formData.title} onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))} />

            <Text style={styles.sectionTitle}>Roles</Text>
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

            {filteredKeyRelationships.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Key Relationships</Text>
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
              </>
            )}

            <Text style={styles.sectionTitle}>Domains</Text>
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

            <TextInput style={[styles.input, { height: 100 }]} placeholder="Notes..." value={formData.notes} onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))} multiline />
        </ScrollView>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}><Text style={styles.submitButtonText}>{loading ? 'Saving...' : mode === 'edit' ? 'Update Idea' : 'Save Idea'}</Text></TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
    formContainer: { flex: 1, backgroundColor: 'white' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    modalTitle: { fontSize: 18, fontWeight: '600' },
    formContent: { padding: 16 },
    input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 8 },
    submitButton: { backgroundColor: '#7c3aed', padding: 16, alignItems: 'center', margin: 16, borderRadius: 8 },
    submitButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
    checkboxGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    checkItem: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '23%',
      marginBottom: 12,
    },
    checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 3, marginRight: 6, justifyContent: 'center', alignItems: 'center' },
    checkedBox: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
    checkmark: { color: 'white', fontSize: 12, fontWeight: 'bold' },
    checkLabel: {
      fontSize: 14,
      color: '#374151',
      marginLeft: 8,
      flexShrink: 1,
    }
});

export default DepositIdeaForm;