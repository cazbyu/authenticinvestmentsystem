import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { supabase } from "@/lib/supabase";
import { X } from 'lucide-react-native';

// --- TYPE DEFINITIONS ---
interface TaskEventFormProps {
  mode: "create" | "edit";
  initialData?: Partial<any>;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

interface Role { id: string; label: string; }
interface Domain { id: string; name: string; }

// --- THE COMPONENT ---
const TaskEventForm: React.FC<TaskEventFormProps> = ({ mode, initialData, onSubmitSuccess, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    is_urgent: false,
    is_important: false,
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    // ... add other form fields as needed
  });
  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch roles and domains for the selection fields
  useEffect(() => {
    const fetchOptions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase.from("roles").select("id,label").eq("user_id", user.id).eq("is_active", true);
      const { data: domainData } = await supabase.from("domains").select("id,name");
      
      setRoles(roleData || []);
      setDomains(domainData || []);
    };
    fetchOptions();
  }, []);

  const handleMultiSelect = (field: 'selectedRoleIds' | 'selectedDomainIds', id: string) => {
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found");

        // 1. Insert the main task
        const { data: taskData, error: taskError } = await supabase
            .from('0007-ap-tasks')
            .insert({
                user_id: user.id,
                title: formData.title,
                is_urgent: formData.is_urgent,
                is_important: formData.is_important,
                status: 'pending',
                type: 'task', // Or determine this dynamically
            })
            .select()
            .single();

        if (taskError) throw taskError;
        if (!taskData) throw new Error("Failed to create task");

        const taskId = taskData.id;

        // 2. Insert into join tables
        const roleJoins = formData.selectedRoleIds.map(role_id => ({
            parent_id: taskId,
            parent_type: 'task',
            role_id: role_id,
            user_id: user.id,
        }));

        const domainJoins = formData.selectedDomainIds.map(domain_id => ({
            parent_id: taskId,
            parent_type: 'task',
            domain_id: domain_id,
            user_id: user.id,
        }));
        
        if (roleJoins.length > 0) {
            const { error: roleError } = await supabase.from('0007-ap-universal-roles-join').insert(roleJoins);
            if (roleError) throw roleError;
        }

        if (domainJoins.length > 0) {
            const { error: domainError } = await supabase.from('0007-ap-universal-domains-join').insert(domainJoins);
            if (domainError) throw domainError;
        }

        onSubmitSuccess(); // This will refetch the data on the dashboard
        onClose(); // Close the modal

    } catch (error) {
        console.error("Error creating task:", error);
        // You could show an alert to the user here
    } finally {
        setLoading(false);
    }
  };


  return (
    <View style={styles.formContainer}>
        <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{mode === 'create' ? 'New Action' : 'Edit Action'}</Text>
            <TouchableOpacity onPress={onClose}><X size={24} color="#6b7280" /></TouchableOpacity>
        </View>
        <ScrollView style={styles.formContent}>
            <TextInput
                style={styles.input}
                placeholder="Action Title"
                value={formData.title}
                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
            />
            
            <View style={styles.switchContainer}>
                <Text>Urgent</Text>
                <Switch value={formData.is_urgent} onValueChange={(val) => setFormData(prev => ({...prev, is_urgent: val}))} />
            </View>
            <View style={styles.switchContainer}>
                <Text>Important</Text>
                <Switch value={formData.is_important} onValueChange={(val) => setFormData(prev => ({...prev, is_important: val}))} />
            </View>

            <Text style={styles.sectionTitle}>Roles</Text>
            <View style={styles.selectionGrid}>
                {roles.map(role => (
                    <TouchableOpacity key={role.id} style={[styles.chip, formData.selectedRoleIds.includes(role.id) && styles.chipSelected]} onPress={() => handleMultiSelect('selectedRoleIds', role.id)}>
                        <Text style={formData.selectedRoleIds.includes(role.id) ? styles.chipTextSelected : styles.chipText}>{role.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.sectionTitle}>Domains</Text>
            <View style={styles.selectionGrid}>
                {domains.map(domain => (
                    <TouchableOpacity key={domain.id} style={[styles.chip, formData.selectedDomainIds.includes(domain.id) && styles.chipSelected]} onPress={() => handleMultiSelect('selectedDomainIds', domain.id)}>
                        <Text style={formData.selectedDomainIds.includes(domain.id) ? styles.chipTextSelected : styles.chipText}>{domain.name}</Text>
                    </TouchableOpacity>
                ))}
            </View>

        </ScrollView>
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.submitButtonText}>{loading ? 'Saving...' : 'Save Action'}</Text>
        </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
    formContainer: { flex: 1, backgroundColor: 'white' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    modalTitle: { fontSize: 18, fontWeight: '600' },
    formContent: { padding: 16 },
    input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
    switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
    selectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6' },
    chipSelected: { backgroundColor: '#0078d4' },
    chipText: { color: '#374151' },
    chipTextSelected: { color: 'white' },
    submitButton: { backgroundColor: '#0078d4', padding: 16, alignItems: 'center', margin: 16, borderRadius: 8 },
    submitButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});

export default TaskEventForm;
