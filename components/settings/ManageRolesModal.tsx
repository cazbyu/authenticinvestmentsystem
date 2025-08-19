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
import { getSupabaseClient } from '@/lib/supabase';

// Interfaces
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
  category?: string;
}

export function ManageRolesModal({ visible, onClose }: ManageRolesModalProps) {
  const [presetRoles, setPresetRoles] = useState<PresetRole[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [customRoleLabel, setCustomRoleLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);

  const groupedPresetRoles = useMemo(() => {
    if (!presetRoles) return {};
    const grouped = presetRoles.reduce((acc, role) => {
      (acc[role.category] = acc[role.category] || []).push(role);
      return acc;
    }, {} as Record<string, PresetRole[]>);
    
    // Define the desired category order
    const categoryOrder = ['Family', 'Professional', 'Community', 'Recreation'];
    
    // Create ordered object with specified categories first, then others
    const orderedGrouped: Record<string, PresetRole[]> = {};
    
    // Add categories in the specified order
    categoryOrder.forEach(category => {
      if (grouped[category]) {
        orderedGrouped[category] = grouped[category];
      }
    });
    
    // Add any remaining categories not in the specified order
    Object.keys(grouped).forEach(category => {
      if (!categoryOrder.includes(category)) {
        orderedGrouped[category] = grouped[category];
      }
    });
    
    return orderedGrouped;
  }, [presetRoles]);

  useEffect(() => {
    if (visible) {
      fetchData();
    }
  }, [visible]);

  useEffect(() => {
    if (Object.keys(groupedPresetRoles).length > 0) {
      setCollapsedCategories(Object.keys(groupedPresetRoles));
    }
  }, [presetRoles]);


  const fetchData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to manage roles.");
        setLoading(false);
        return;
      }

      const { data: presetData, error: presetError } = await supabase
        .from('0008-ap-preset-roles')
        .select('id, label, category, sort_order')
        .order('sort_order', { ascending: true });

      if (presetError) throw presetError;

      const { data: userData, error: userError } = await supabase
        .from('0008-ap-roles')
        .select('*')
        .eq('user_id', user.id);

      if (userError) throw userError;

      setPresetRoles(presetData || []);
      setUserRoles(userData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      Alert.alert('Error fetching data', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomRole = async () => {
    if (!customRoleLabel.trim()) return;
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newRoleLabel = customRoleLabel.trim();

      // Create temporary role for immediate UI feedback
      const tempRole: UserRole = {
        id: `temp-${Date.now()}`,
        label: newRoleLabel,
        is_active: true,
        user_id: user.id,
        category: 'Custom'
      };

      setUserRoles(prev => [...prev, tempRole]);
      setCustomRoleLabel('');

      try {
        const { data, error } = await supabase
          .from('0008-ap-roles')
          .insert({
            label: newRoleLabel,
            user_id: user.id,
            is_active: true,
            category: 'Custom'
          })
          .select()
          .single();

        if (error) throw error;

        // Replace temp role with real role from database
        setUserRoles(prev => prev.map(role =>
          role.id === tempRole.id ? data : role
        ));
      } catch (error) {
        console.error('Error adding custom role:', error);
        Alert.alert('Error', 'Failed to add custom role');
        // Remove temp role and restore input on error
        setUserRoles(prev => prev.filter(role => role.id !== tempRole.id));
        setCustomRoleLabel(newRoleLabel);
      }
    } catch (error) {
      console.error('Error adding custom role:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleTogglePresetRole = async (presetRole: PresetRole) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const existingUserRole = userRoles.find(r => r.preset_role_id === presetRole.id);
      const newActiveState = existingUserRole ? !existingUserRole.is_active : true;

      // Optimistic update - immediately update UI
      if (existingUserRole) {
        setUserRoles(prev => prev.map(role =>
          role.id === existingUserRole.id
            ? { ...role, is_active: newActiveState }
            : role
        ));

        try {
          const { error } = await supabase
            .from('0008-ap-roles')
            .update({ is_active: newActiveState })
            .eq('id', existingUserRole.id);

          if (error) throw error;
        } catch (error) {
          console.error('Error updating preset role:', error);
          Alert.alert('Error', 'Failed to update role');
          // Revert optimistic update
          setUserRoles(prev => prev.map(role =>
            role.id === existingUserRole.id
              ? { ...role, is_active: !newActiveState }
              : role
          ));
        }
      } else {
        // Create temporary role for immediate UI feedback
        const tempRole: UserRole = {
          id: `temp-${Date.now()}`, // Temporary ID
          label: presetRole.label,
          is_active: true,
          user_id: user.id,
          preset_role_id: presetRole.id,
          category: presetRole.category
        };

        setUserRoles(prev => [...prev, tempRole]);

        try {
          const { data, error } = await supabase
            .from('0008-ap-roles')
            .insert({
              label: presetRole.label,
              user_id: user.id,
              preset_role_id: presetRole.id,
              is_active: true,
              category: presetRole.category
            })
            .select()
            .single();

          if (error) throw error;

          // Replace temp role with real role from database
          setUserRoles(prev => prev.map(role =>
            role.id === tempRole.id ? data : role
          ));
        } catch (error) {
          console.error('Error creating preset role:', error);
          Alert.alert('Error', 'Failed to activate role');
          // Remove temp role on error
          setUserRoles(prev => prev.filter(role => role.id !== tempRole.id));
        }
      }
    } catch (error) {
      console.error('Error toggling preset role:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const toggleCategory = (category: string) => {
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
          {loading ? <ActivityIndicator size="large" color="#0078d4" /> : (
            <>
              {Object.keys(groupedPresetRoles).length > 0 ? (
                <View style={styles.categoryContainer}>
                  <Text style={styles.mainSectionTitle}>Commonly Predefined Roles</Text>
                  {Object.entries(groupedPresetRoles).map(([category, rolesInCategory]) => {
                    const isCollapsed = collapsedCategories.includes(category);
                    return (
                      <View key={category} style={styles.subCategoryContainer}>
                        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleCategory(category)}>
                          <Text style={styles.sectionTitle}>{category}</Text>
                          {isCollapsed ? <ChevronDown size={20} color="#374151" /> : <ChevronUp size={20} color="#374151" />}
                        </TouchableOpacity>
                        {!isCollapsed && (
                          <View style={styles.rolesList}>
                            {rolesInCategory.map(pRole => {
                              const userVersion = userRoles.find(uRole => uRole.preset_role_id === pRole.id);
                              const isActive = userVersion ? userVersion.is_active : false;
                              return (
                                <View key={pRole.id} style={styles.roleItem}>
                                  <Text style={styles.roleLabel}>{pRole.label}</Text>
                                  <Switch
                                    value={isActive}
                                    onValueChange={() => handleTogglePresetRole(pRole)}
                                  />
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : <Text>No preset roles found.</Text>}

              <View style={styles.categoryContainer}>
                <Text style={styles.mainSectionTitle}>Customized Roles</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Add a custom role..."
                    value={customRoleLabel}
                    onChangeText={setCustomRoleLabel}
                  />
                  <TouchableOpacity style={styles.addButton} onPress={handleAddCustomRole}>
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
                {customRoles.length > 0 && (
                  <View style={styles.rolesList}>
                    {customRoles.map(role => (
                      <View key={role.id} style={styles.roleItem}>
                        <Text style={styles.roleLabel}>{role.label}</Text>
                        <Switch
                            value={role.is_active}
                            onValueChange={async (newValue) => {
                              // Optimistically update UI
                              setUserRoles(prev => prev.map(r => 
                                r.id === role.id ? { ...r, is_active: newValue } : r
                              ));
                              
                              try {
                                const supabase = getSupabaseClient();
                                const { error } = await supabase
                                  .from('0008-ap-roles')
                                  .update({ is_active: newValue })
                                  .eq('id', role.id);

                                if (error) throw error;
                              } catch (error) {
                                console.error('Error updating custom role:', error);
                                Alert.alert('Error', 'Failed to update role');
                                // Revert optimistic update
                                setUserRoles(prev => prev.map(r =>
                                  r.id === role.id ? { ...r, is_active: !newValue } : r
                                ));
                              }
                            }}
                          />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: 'white' },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  closeButton: { padding: 4 },
  content: { paddingHorizontal: 16 },
  mainSectionTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 16, marginTop: 8},
  categoryContainer: { marginBottom: 16 },
  subCategoryContainer: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingVertical: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  inputContainer: { flexDirection: 'row', marginBottom: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, marginRight: 8, backgroundColor: 'white' },
  addButton: { backgroundColor: '#0078d4', paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  addButtonText: { color: 'white', fontWeight: '600' },
  rolesList: { backgroundColor: 'white', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  roleItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  roleLabel: { fontSize: 16, flex: 1, color: '#1f2937' },
});