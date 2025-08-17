import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { InvestmentList } from '@/components/InvestmentList';
import { AddItemModal } from '@/components/AddItemModal';
import { supabase } from '@/lib/supabase';
import { useIsFocused } from '@react-navigation/native';

export default function Roles() {
  const [modalVisible, setModalVisible] = useState(false);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  useEffect(() => {
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

    const { data, error } = await supabase
      .from('0008-ap-roles')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching active roles:', error);
      Alert.alert("Error", "Could not fetch roles. Please check your connection and database policies.");
    } else {
      const formattedRoles = data.map(role => ({
        id: role.id,
        title: role.label,
        subtitle: role.category || 'User-defined role',
        category: role.category || 'Custom',
        categoryColor: '#0078d4',
        balance: 75,
        lastActivity: 'N/A',
      }));
      setRoles(formattedRoles);
    }
    setLoading(false);
  };

  const handleAddRole = (data: any) => {
    console.log('Adding new role:', data);
    setModalVisible(false);
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
          <Text style={styles.emptyText}>No active roles found. Go to Settings to activate or create roles!</Text>
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