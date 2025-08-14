import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { InvestmentList } from '@/components/InvestmentList';
import { AddItemModal } from '@/components/AddItemModal';

const mockWellness = [
  {
    id: '1',
    title: 'Physical Health',
    subtitle: 'Exercise & nutrition focus',
    category: 'Health',
    categoryColor: '#16a34a',
    balance: 88,
    lastActivity: '4 hours ago',
  },
  {
    id: '2',
    title: 'Mental Clarity',
    subtitle: 'Meditation & mindfulness',
    category: 'Mental',
    categoryColor: '#0891b2',
    balance: 72,
    lastActivity: '1 day ago',
  },
  {
    id: '3',
    title: 'Spiritual Growth',
    subtitle: 'Faith & personal development',
    category: 'Spiritual',
    categoryColor: '#7c3aed',
    balance: 91,
    lastActivity: '6 hours ago',
  },
  {
    id: '4',
    title: 'Creative Expression',
    subtitle: 'Art, music & writing',
    category: 'Creative',
    categoryColor: '#ea580c',
    balance: 56,
    lastActivity: '2 days ago',
  },
];

export default function Wellness() {
  const [modalVisible, setModalVisible] = useState(false);

  const handleAddWellness = (data: any) => {
    console.log('Adding new wellness domain:', data);
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Wellness Bank" 
        onAdd={() => setModalVisible(true)}
      />
      <View style={styles.content}>
        <InvestmentList
          items={mockWellness}
          type="wellness"
          onItemPress={(item) => console.log('Wellness pressed:', item)}
        />
      </View>
      
      <AddItemModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleAddWellness}
        type="wellness"
        title="Add Wellness Domain"
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