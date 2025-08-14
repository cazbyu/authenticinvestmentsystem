import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { BankSummaryCard } from '@/components/BankSummaryCard';
import { RecentActivity } from '@/components/RecentActivity';

export default function Dashboard() {
  return (
    <SafeAreaView style={styles.container}>
      <Header title="Authentic Investments" />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Your Investment Banks</Text>
          <BankSummaryCard
            title="Role Bank"
            balance={85}
            color="#0078d4"
            icon="user"
            subtitle="8 Active Roles"
          />
          <BankSummaryCard
            title="Wellness Bank"
            balance={72}
            color="#16a34a"
            icon="heart"
            subtitle="5 Wellness Domains"
          />
          <BankSummaryCard
            title="Goal Bank"
            balance={91}
            color="#dc2626"
            icon="target"
            subtitle="12 Active Goals"
          />
        </View>
        
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <RecentActivity />
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
  },
  summarySection: {
    marginTop: 16,
    marginBottom: 32,
  },
  activitySection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
});