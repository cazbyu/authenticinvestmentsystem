import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { InvestmentList } from '@/components/InvestmentList';
import { AddItemModal } from '@/components/AddItemModal';

const mockGoals = [
  {
    id: '1',
    title: 'Complete Master\'s Degree',
    subtitle: 'Educational advancement',
    category: 'Education',
    categoryColor: '#0078d4',
    balance: 67,
    lastActivity: '1 day ago',
  },
  {
    id: '2',
    title: 'Launch Side Business',
    subtitle: 'Financial independence project',
    category: 'Financial',
    categoryColor: '#16a34a',
    balance: 45,
    lastActivity: '3 days ago',
  },
  {
    id: '3',
    title: 'Run Half Marathon',
    subtitle: 'Physical fitness milestone',
    category: 'Health',
    categoryColor: '#dc2626',
    balance: 73,
    lastActivity: '6 hours ago',
  },
  {
    id: '4',
    title: 'Write a Book',
    subtitle: 'Creative & professional goal',
    category: 'Creative',
    categoryColor: '#7c3aed',
    balance: 34,
    lastActivity: '1 week ago',
  },
];

export default function Goals() {
  const [modalVisible, setModalVisible] = useState(false);

  const handleAddGoal = (data: any) => {
    console.log('Adding new goal:', data);
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Goal Bank" 
        onAdd={() => setModalVisible(true)}
      />
      <View style={styles.content}>
        <InvestmentList
          items={mockGoals}
          type="goal"
          onItemPress={(item) => console.log('Goal pressed:', item)}
        />
      </View>
      
      <AddItemModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleAddGoal}
        type="goal"
        title="Add New Goal"
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