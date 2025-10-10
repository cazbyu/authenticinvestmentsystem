import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Brain, Target, Users, Heart } from 'lucide-react-native';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1f2937" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.logoSection}>
          <Brain size={64} color="#0078d4" />
          <Text style={styles.appName}>Authentic Intelligence Labs</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Mission</Text>
          <Text style={styles.paragraph}>
            Authentic Intelligence Labs empowers individuals to invest in what truly matters: their roles, relationships, wellness, and goals. We believe that authentic living comes from intentional choices and mindful progress across all dimensions of life.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What We Offer</Text>

          <View style={styles.featureItem}>
            <Users size={32} color="#7c3aed" />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Role Bank</Text>
              <Text style={styles.featureDescription}>
                Invest in the relationships that matter most to you. Define your key roles and nurture the connections that bring meaning to your life.
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Heart size={32} color="#dc2626" />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Wellness Bank</Text>
              <Text style={styles.featureDescription}>
                Achieve balance across 8 domains of wellness: physical, emotional, social, spiritual, intellectual, environmental, occupational, and financial.
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Target size={32} color="#16a34a" />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Goal Bank</Text>
              <Text style={styles.featureDescription}>
                Set meaningful timelines, define clear goals, and track your effort to measure authentic progress toward what matters most.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Philosophy</Text>
          <Text style={styles.paragraph}>
            We believe that success is not just about achieving goals, but about living authentically aligned with your values. Our app helps you make deposits into the areas of life that truly matter, building a rich and fulfilling existence.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developed By</Text>
          <Text style={styles.paragraph}>
            Salt City Digital Design{'\n'}
            1428 E Granada Dr{'\n'}
            Sandy, Utah 84093{'\n'}
            United States
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.copyright}>
            © 2025 Salt City Digital Design. All rights reserved.
          </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 16,
    textAlign: 'center',
  },
  version: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 22,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  copyright: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
