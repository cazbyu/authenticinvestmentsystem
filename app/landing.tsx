import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TrendingUp, Target, Users, Mail, ArrowRight, CircleCheck as CheckCircle, Brain, Heart, Zap, Shield, Star, Award } from 'lucide-react-native';

type TabType = 'home' | 'about' | 'products' | 'contact';

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/login');
  };

  const renderNavigation = () => (
    <View style={styles.navigation}>
      <View style={styles.navContainer}>
        <View style={styles.logo}>
          <Brain size={28} color="#0078d4" />
          <Text style={styles.logoText}>Authentic Intelligence</Text>
        </View>
        
        <View style={styles.navTabs}>
          {[
            { id: 'home', label: 'Home' },
            { id: 'about', label: 'About' },
            { id: 'products', label: 'Products' },
            { id: 'contact', label: 'Contact' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.navTab,
                activeTab === tab.id && styles.activeNavTab
              ]}
              onPress={() => setActiveTab(tab.id as TabType)}
            >
              <Text style={[
                styles.navTabText,
                activeTab === tab.id && styles.activeNavTabText
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderHome = () => (
    <ScrollView style={styles.content}>
      {/* Hero Section */}
      <View style={styles.hero}>
        <View style={styles.heroContent}>
          <Text style={styles.heroTagline}>
            Authentic Intelligence
          </Text>
          <Text style={styles.heroSubtitle}>
            Invest in What Matters
          </Text>
          <Text style={styles.heroDescription}>
            Transform how you approach life's most important investments through 
            intelligent systems that help you build authentic wealth across all 
            dimensions of your existence.
          </Text>
          
          <TouchableOpacity 
            style={styles.ctaButton}
            onPress={handleGetStarted}
          >
            <Text style={styles.ctaButtonText}>Start Your Journey</Text>
            <ArrowRight size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.heroVisual}>
          <View style={styles.heroIcon}>
            <TrendingUp size={64} color="#0078d4" />
          </View>
          <Text style={styles.heroIconText}>
            Intelligent Investment Tracking
          </Text>
        </View>
      </View>

      {/* Features Section */}
      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>Why Authentic Intelligence?</Text>
        
        <View style={styles.featuresGrid}>
          <View style={styles.featureCard}>
            <Target size={32} color="#16a34a" />
            <Text style={styles.featureTitle}>Strategic Focus</Text>
            <Text style={styles.featureDescription}>
              Align daily actions with long-term vision through systematic goal tracking
            </Text>
          </View>
          
          <View style={styles.featureCard}>
            <Heart size={32} color="#dc2626" />
            <Text style={styles.featureTitle}>Holistic Balance</Text>
            <Text style={styles.featureDescription}>
              Track investments across all life domains for complete wellness
            </Text>
          </View>
          
          <View style={styles.featureCard}>
            <Users size={32} color="#7c3aed" />
            <Text style={styles.featureTitle}>Role Clarity</Text>
            <Text style={styles.featureDescription}>
              Manage multiple life roles and key relationships with intention
            </Text>
          </View>
          
          <View style={styles.featureCard}>
            <Zap size={32} color="#ea580c" />
            <Text style={styles.featureTitle}>Authentic Deposits</Text>
            <Text style={styles.featureDescription}>
              Build real wealth through meaningful actions and investments
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderAbout = () => (
    <ScrollView style={styles.content}>
      <View style={styles.aboutSection}>
        <Text style={styles.sectionTitle}>About Authentic Intelligence</Text>
        
        <View style={styles.aboutContent}>
          <Text style={styles.aboutText}>
            Authentic Intelligence represents a new paradigm in personal development 
            and life management. We believe that true success comes from making 
            intentional investments in what matters most.
          </Text>
          
          <Text style={styles.aboutText}>
            Our systems help you track, measure, and optimize your investments 
            across all dimensions of life - from relationships and health to 
            career and personal growth.
          </Text>
          
          <View style={styles.missionSection}>
            <Text style={styles.missionTitle}>Our Mission</Text>
            <Text style={styles.missionText}>
              To empower individuals to build authentic wealth by providing 
              intelligent tools that transform how they invest their time, 
              energy, and attention.
            </Text>
          </View>
          
          <View style={styles.valuesSection}>
            <Text style={styles.valuesTitle}>Core Values</Text>
            <View style={styles.valuesList}>
              <View style={styles.valueItem}>
                <CheckCircle size={20} color="#16a34a" />
                <Text style={styles.valueText}>Authenticity over appearance</Text>
              </View>
              <View style={styles.valueItem}>
                <CheckCircle size={20} color="#16a34a" />
                <Text style={styles.valueText}>Systems over motivation</Text>
              </View>
              <View style={styles.valueItem}>
                <CheckCircle size={20} color="#16a34a" />
                <Text style={styles.valueText}>Progress over perfection</Text>
              </View>
              <View style={styles.valueItem}>
                <CheckCircle size={20} color="#16a34a" />
                <Text style={styles.valueText}>Balance over burnout</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderProducts = () => (
    <ScrollView style={styles.content}>
      <View style={styles.productsSection}>
        <Text style={styles.sectionTitle}>Our Products</Text>
        
        {/* Authentic Investment System - Featured */}
        <View style={styles.featuredProduct}>
          <View style={styles.productHeader}>
            <View style={styles.productIcon}>
              <TrendingUp size={40} color="#ffffff" />
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productTitle}>Authentic Investment System</Text>
              <Text style={styles.productSubtitle}>Our flagship personal development platform</Text>
            </View>
          </View>
          
          <Text style={styles.productDescription}>
            The Authentic Investment System (AIS) transforms how you approach personal 
            development by treating your time, energy, and attention as investments. 
            Track deposits and withdrawals across life roles, monitor wellness domains, 
            and achieve 12-week goals with precision.
          </Text>
          
          <View style={styles.productFeatures}>
            <View style={styles.featureRow}>
              <Target size={16} color="#0078d4" />
              <Text style={styles.featureText}>Role-based investment tracking</Text>
            </View>
            <View style={styles.featureRow}>
              <Heart size={16} color="#0078d4" />
              <Text style={styles.featureText}>8-domain wellness monitoring</Text>
            </View>
            <View style={styles.featureRow}>
              <Award size={16} color="#0078d4" />
              <Text style={styles.featureText}>12-week goal achievement system</Text>
            </View>
            <View style={styles.featureRow}>
              <Star size={16} color="#0078d4" />
              <Text style={styles.featureText}>Authentic score calculation</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.productCta}
            onPress={handleGetStarted}
          >
            <Text style={styles.productCtaText}>Start Today</Text>
            <ArrowRight size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
        
        {/* Future Products */}
        <View style={styles.futureProducts}>
          <Text style={styles.futureProductsTitle}>Coming Soon</Text>
          
          <View style={styles.productGrid}>
            <View style={styles.futureProduct}>
              <Brain size={32} color="#7c3aed" />
              <Text style={styles.futureProductTitle}>AI Coach</Text>
              <Text style={styles.futureProductDescription}>
                Personalized coaching powered by artificial intelligence
              </Text>
            </View>
            
            <View style={styles.futureProduct}>
              <Users size={32} color="#059669" />
              <Text style={styles.futureProductTitle}>Team Intelligence</Text>
              <Text style={styles.futureProductDescription}>
                Authentic investment tracking for teams and organizations
              </Text>
            </View>
            
            <View style={styles.futureProduct}>
              <Shield size={32} color="#dc2626" />
              <Text style={styles.futureProductTitle}>Legacy Builder</Text>
              <Text style={styles.futureProductDescription}>
                Long-term wealth and legacy planning tools
              </Text>
            </View>
            
            <View style={styles.futureProduct}>
              <Zap size={32} color="#ea580c" />
              <Text style={styles.futureProductTitle}>Habit Intelligence</Text>
              <Text style={styles.futureProductDescription}>
                Smart habit formation and behavior change systems
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderContact = () => (
    <ScrollView style={styles.content}>
      <View style={styles.contactSection}>
        <Text style={styles.sectionTitle}>Get in Touch</Text>
        
        <View style={styles.contactContent}>
          <Text style={styles.contactDescription}>
            Ready to start your authentic investment journey? We're here to help 
            you transform how you invest in what matters most.
          </Text>
          
          <View style={styles.contactMethods}>
            <View style={styles.contactMethod}>
              <Mail size={24} color="#0078d4" />
              <View style={styles.contactMethodInfo}>
                <Text style={styles.contactMethodTitle}>Email Us</Text>
                <Text style={styles.contactMethodText}>hello@authenticintelligence.com</Text>
              </View>
            </View>
            
            <View style={styles.contactMethod}>
              <Users size={24} color="#0078d4" />
              <View style={styles.contactMethodInfo}>
                <Text style={styles.contactMethodTitle}>Join Our Community</Text>
                <Text style={styles.contactMethodText}>Connect with other authentic investors</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.ctaSection}>
            <Text style={styles.ctaTitle}>Ready to Begin?</Text>
            <Text style={styles.ctaDescription}>
              Start tracking your authentic investments today
            </Text>
            <TouchableOpacity 
              style={styles.ctaButton}
              onPress={handleGetStarted}
            >
              <Text style={styles.ctaButtonText}>Get Started Now</Text>
              <ArrowRight size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return renderHome();
      case 'about':
        return renderAbout();
      case 'products':
        return renderProducts();
      case 'contact':
        return renderContact();
      default:
        return renderHome();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderNavigation()}
      {renderContent()}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  navTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  navTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeNavTab: {
    backgroundColor: '#0078d4',
  },
  navTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeNavTabText: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
  
  // Home Tab Styles
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 60,
    backgroundColor: '#f8fafc',
  },
  heroContent: {
    flex: 1,
    marginRight: 40,
  },
  heroTagline: {
    fontSize: 48,
    fontWeight: '800',
    color: '#1f2937',
    lineHeight: 56,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0078d4',
    marginBottom: 20,
  },
  heroDescription: {
    fontSize: 18,
    color: '#6b7280',
    lineHeight: 28,
    marginBottom: 32,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
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
  heroVisual: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroIconText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
  },
  
  // Features Section
  featuresSection: {
    paddingHorizontal: 20,
    paddingVertical: 60,
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 48,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 24,
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // About Tab Styles
  aboutSection: {
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  aboutContent: {
    maxWidth: 800,
    alignSelf: 'center',
  },
  aboutText: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    marginBottom: 24,
  },
  missionSection: {
    backgroundColor: '#f8fafc',
    padding: 24,
    borderRadius: 12,
    marginBottom: 32,
  },
  missionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  missionText: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
  },
  valuesSection: {
    marginBottom: 32,
  },
  valuesTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  valuesList: {
    gap: 12,
  },
  valueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  valueText: {
    fontSize: 16,
    color: '#6b7280',
  },
  
  // Products Tab Styles
  productsSection: {
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  featuredProduct: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    marginBottom: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#0078d4',
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  productIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0078d4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  productInfo: {
    flex: 1,
  },
  productTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  productSubtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  productDescription: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    marginBottom: 24,
  },
  productFeatures: {
    marginBottom: 24,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  productCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 8,
  },
  productCtaText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Future Products
  futureProducts: {
    marginTop: 32,
  },
  futureProductsTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 24,
    textAlign: 'center',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  futureProduct: {
    width: '48%',
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  futureProductTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  futureProductDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  
  // Contact Tab Styles
  contactSection: {
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  contactContent: {
    maxWidth: 600,
    alignSelf: 'center',
  },
  contactDescription: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 40,
  },
  contactMethods: {
    gap: 24,
    marginBottom: 48,
  },
  contactMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 12,
    gap: 16,
  },
  contactMethodInfo: {
    flex: 1,
  },
  contactMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  contactMethodText: {
    fontSize: 14,
    color: '#6b7280',
  },
  ctaSection: {
    backgroundColor: '#0078d4',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  ctaDescription: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
    marginBottom: 24,
    textAlign: 'center',
  },
});