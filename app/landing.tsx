import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Users, Heart, Target, ArrowRight, Brain } from 'lucide-react-native';

export default function LandingPage() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/login');
  };

  const renderNavigation = () => (
    <View style={styles.navigation}>
      <View style={styles.navContainer}>
        <View style={styles.logo}>
          <Brain size={28} color="#0078d4" />
          <Text style={styles.logoText}>Authentic Investments</Text>
        </View>
      </View>
    </View>
  );

  const renderHome = () => (
    <ScrollView style={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroContent}>
          <Text style={styles.heroTagline}>
            Authentic Investments
          </Text>
          <Text style={styles.heroSubtitle}>
            It's Time to Invest in What Matters Most
          </Text>
          <Text style={styles.heroDescription}>
            Focus on your Roles, Relationships, Wellness and Goals
          </Text>

          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleGetStarted}
          >
            <Text style={styles.ctaButtonText}>Start Your Journey</Text>
            <ArrowRight size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardsContainer}>
          <View style={styles.featureCard}>
            <Users size={40} color="#7c3aed" />
            <Text style={styles.featureTitle}>Role Bank</Text>
            <Text style={styles.featureDescription}>
              Invest in relationships that matter most to you
            </Text>
          </View>

          <View style={styles.featureCard}>
            <Heart size={40} color="#dc2626" />
            <Text style={styles.featureTitle}>Wellness Bank</Text>
            <Text style={styles.featureDescription}>
              We use 8 Domains of Wellness to maintain Balance
            </Text>
          </View>

          <View style={styles.featureCard}>
            <Target size={40} color="#16a34a" />
            <Text style={styles.featureTitle}>Goal Bank</Text>
            <Text style={styles.featureDescription}>
              You set the timeline, define your goal and get to work so you can measure effort to achieve progress.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By signing in, you agree to our{' '}
            <Text
              style={styles.footerLink}
              onPress={() => router.push('/terms')}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text
              style={styles.footerLink}
              onPress={() => router.push('/privacy')}
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderNavigation()}
      {renderHome()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  navigation: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 12,
  },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  content: {
    flex: 1,
  },
  hero: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 48,
    backgroundColor: '#f8fafc',
  },
  heroContent: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 48,
  },
  heroTagline: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1f2937',
    lineHeight: 40,
    marginBottom: 16,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0078d4',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 32,
  },
  heroDescription: {
    fontSize: 18,
    color: '#6b7280',
    lineHeight: 28,
    marginBottom: 32,
    textAlign: 'center',
    maxWidth: 600,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    width: '100%',
    maxWidth: 1200,
    flexWrap: 'wrap',
  },
  featureCard: {
    flex: 1,
    minWidth: 280,
    maxWidth: 360,
    backgroundColor: '#ffffff',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 24,
    textAlign: 'center',
  },
  footer: {
    paddingTop: 32,
    paddingBottom: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLink: {
    color: '#0078d4',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});