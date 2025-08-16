import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator
} from 'react-native';
import { X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

// --- (Interfaces remain the same) ---
interface ManageRolesModalProps {
  visible: boolean;
  onClose: () => void;
}
interface PresetRole {
  id: string;
  label: string;
  category: string;
}
interface UserRole {
  id: string;
  label: string;
  is_active: boolean;
  user_id: string;
  preset_role_id?: string;
}

export function ManageRolesModal({ visible, onClose }: ManageRolesModalProps) {
  const [presetRoles, setPresetRoles] = useState<PresetRole[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [customRoleLabel, setCustomRoleLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);

  const groupedPresetRoles = useMemo(() => {
    return presetRoles.reduce((acc, role) => {
      (acc[role.category] = acc[role.category] || []).push(role);
      return acc;
    }, {} as Record<string, PresetRole[]>);
  }, [presetRoles]);

  useEffect(() => {
    if (visible) {
      fetchData().then(() => {
        setCollapsedCategories(Object.keys(groupedPresetRoles));
      });
    }
  }, [visible, presetRoles.length]);

  const fetchData = async () => {
    // ... (fetchData function remains the same)
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Error", "You must be logged in to manage roles.");
      setLoading(false);
      return;
    }

    const { data: presetData, error: presetError } = await supabase.from('0007-ap-preset-roles').select('id, label, category');
    const { data: userData, error: userError } = await supabase.from('0007-ap-roles').select('*').eq('user_id', user.id);

    if (presetError || userError) {
      Alert.alert('Error fetching data', presetError?.message || userError?.message);
    } else {
      setPresetRoles(presetData || []);
      setUserRoles(userData || []);
    }
    setLoading(false);
  };

  const handleAddCustomRole = async () => {
    // ... (handleAddCustomRole function remains the same)
    if (!customRoleLabel.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('0007-ap-roles')
      .insert({ label: customRoleLabel.trim(), user_id: user.id, is_active: true })
      .select()
      .single();
    
    if (error) {
      Alert.alert('Error adding custom role', error.message);
    } else if (data) {
      setUserRoles([data, ...userRoles]);
      setCustomRoleLabel('');
    }
  };
  
  const handleTogglePresetRole = async (presetRole: PresetRole) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const existingUserRole = userRoles.find(r => r.preset_role_id === presetRole.id);

    if (existingUserRole) {
      // --- OPTIMISTIC UI FIX ---
      // 1. Immediately update the screen
      const updatedRoles = userRoles.map(r => 
        r.id === existingUserRole.id ? { ...r, is_active: !r.is_active } : r
      );
      setUserRoles(updatedRoles);
      
      // 2. Update the database in the background
      await supabase
        .from('0007-ap-roles')
        .update({ is_active: !existingUserRole.is_active })
        .eq('id', existingUserRole.id);

    } else {
      // Create the new role and assume it's active
      const newRole = { 
          label: presetRole.label, 
          user_id: user.id, 
          preset_role_id: presetRole.id, 
          is_active: true 
      };

      // 1. Immediately update the screen
      // (We add a temporary ID for the key, Supabase will create the real one)
      setUserRoles([...userRoles, { ...newRole, id: `temp-${Date.now()}` }]);
      
      // 2. Insert into the database in the background, then refetch to get the real ID
      const { error } = await supabase.from('0007-ap-roles').insert(newRole);
      if (error) Alert.alert('Error activating role', error.message);
      else await fetchData(); // Refetch here to sync the real ID
    }
  };

  const toggleCategory = (category: string) => {
    // ... (toggleCategory function remains the same)
    setCollapsedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const customRoles = userRoles.filter(role => !role.preset_role_id);

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
            {/* ... The JSX in the return() statement remains exactly the same ... */}
        </ScrollView>
      </View>
    </Modal>
  );
}

// --- (Styles remain the same) ---
const styles = StyleSheet.create({
  //...
});