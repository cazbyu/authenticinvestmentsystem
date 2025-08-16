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
  Switch
} from 'react-native';
import { X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface ManageRolesModalProps {
  visible: boolean;
  onClose: () => void;
}

interface Role {
  id: string;
  label: string;
  is_active: boolean;
  user_id: string;
}

export function ManageRolesModal({ visible, onClose }: ManageRolesModalProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchRoles();
    }
  }, [visible]);

  const fetchRoles = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Error", "You must be logged in to manage roles.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('0007-ap-roles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Error fetching roles', error.message);
    } else {
      setRoles(data || []);
    }
    setLoading(false);
  };

  const handleAddRole = async () => {
    if (!newRoleLabel.trim()) {
      Alert.alert('Error', 'Role name cannot be empty.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('0007-ap-roles')
      .insert({
        label: newRoleLabel.trim(),
        user_id: user.id,
        is_active: true, // Roles are active by default
      })
      .select();
    
    if (error) {
      Alert.alert('Error adding role', error.message);
    } else if (data) {
      setRoles([data[0], ...roles]);
      setNewRoleLabel(''); // Clear the input
    }
  };
  
  const handleToggleRole = async (role: Role) => {
    const { error } = await supabase
      .from('0007-ap-roles')
      .update({ is_active: !role.is_active })
      .eq('id', role.id);

    if (error) {
      Alert.alert('Error updating role', error.message);
    } else {
      // Update the state locally for immediate feedback
      setRoles(roles.map(r => r.id === role.id ? { ...r, is_active: !r.is_active } : r));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Manage Roles</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter new role name"
              value={newRoleLabel}
              onChangeText={setNewRoleLabel}
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAddRole}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.rolesList}>
            {loading ? <Text>Loading roles...</Text> : (
              roles.map(role => (
                <View key={role.id} style={styles.roleItem}>
                  <Text style={styles.roleLabel}>{role.label}</Text>
                  <Switch
                    value={role.is_active}
                    onValueChange={() => handleToggleRole(role)}
                  />
                </View>
              ))
            )}
          </View>
        </ScrollView>
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginRight: 8,
  },
  addButton: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  rolesList: {
    marginTop: 16,
  },
  roleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  roleLabel: {
    fontSize: 16,
  },
});