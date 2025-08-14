import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { InvestmentList } from '@/components/InvestmentList';
import { AddItemModal } from '@/components/AddItemModal';

const mockRoles = [
  {
    id: '1',
    title: 'Spouse/Partner',
    subtitle: 'Quality time & emotional support',
    category: 'Family',
    categoryColor: '#dc2626',
    balance: 95,
    lastActivity: '2 hours ago',
  },
  {
    id: '2',
    title: 'Parent',
    subtitle: 'Guidance & presence for children',
    category: 'Family',
    categoryColor: '#dc2626',
    balance: 78,
    lastActivity: '5 hours ago',
  },
  {
    id: '3',
    title: 'Team Leader',
    subtitle: 'Supporting and developing team',
    category: 'Career',
    categoryColor: '#0078d4',
    balance: 82,
    lastActivity: '1 day ago',
  },
  {
    id: '4',
    title: 'Friend',
    subtitle: 'Maintaining meaningful connections',
    category: 'Relationships',
    categoryColor: '#7c3aed',
    balance: 65,
    lastActivity: '3 days ago',
  },
];

export default function Roles() {
  const [modalVisible, setModalVisible] = useState(false);

  const handleAddRole = (data: any) => {
    console.log('Adding new role:', data);
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Role Bank" 
        onAdd={() => setModalVisible(true)}
      />
      <View style={styles.content}>
        <InvestmentList
          items={mockRoles}
          type="role"
          onItemPress={(item) => console.log('Role pressed:', item)}
        />
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
});