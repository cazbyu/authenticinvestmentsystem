import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { InvestmentList } from '@/components/InvestmentList';
import { AddItemModal } from '@/components/AddItemModal';
import { supabase } from '@/lib/supabase'; // Import Supabase
import { useIsFocused } from '@react-navigation/native'; // Import useIsFocused

export default function Roles() {
  const [modalVisible, setModalVisible] = useState(false);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused(); // This will be true when the screen is active

  useEffect(() => {
    // We only want to fetch data when the screen is focused
    if (isFocused) {
      fetchActiveRoles();
    }
  }, [isFocused]);

  const fetchActiveRoles = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Fetch only the roles for the current user that are marked as active
    const { data, error } = await supabase
      .from('0008-ap-roles')
      .select('*')
      .eq('profile_id', user.id)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching active roles:', error);
    } else {
      // The InvestmentList component expects specific property names,
      // so we map the data to match it.
      const formattedRoles = data.map(role => ({
        id: role.id,
        title: role.label,
        subtitle: role.category || 'User-defined role', // Provide a default subtitle
        category: role.category || 'Custom',
        categoryColor: '#0078d4', // Default color
        balance: 75, // Placeholder balance
        lastActivity: 'N/A', // Placeholder activity
      }));
      setRoles(formattedRoles);
    }
    setLoading(false);
  };

  const handleAddRole = (data: any) => {
    console.log('Adding new role:', data);
    setModalVisible(false);
    // After adding a new role, you might want to refetch the list
    fetchActiveRoles(); 
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Role Bank" 
        onAdd={() => setModalVisible(true)}
      />
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#0078d4" style={{ marginTop: 20 }}/>
        ) : roles.length === 0 ? (
          <Text style={styles.emptyText}>No active roles found. Add one or activate a preset role in Settings!</Text>
        ) : (
          <InvestmentList
            items={roles}
            type="role"
            onItemPress={(item) => console.log('Role pressed:', item)}
          />
        )}
      </View>
      
      <AddItemModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleAddRole}
        type="role"
        title="Add New Role"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: '#6b7280',
    paddingHorizontal: 20,
  },
});