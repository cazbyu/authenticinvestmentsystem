import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';

export default function CoachScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Header title="Coach Chat" />
      
      <View style={styles.content}>
        <Text style={styles.placeholderText}>Coach Chat feature coming soon!</Text>
      </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  placeholderText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});