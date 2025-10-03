import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { FileText, Target, TrendingUp, ExternalLink } from 'lucide-react-native';
import { router } from 'expo-router';

interface OneYearGoal {
  id: string;
  title: string;
  description?: string;
  status: string;
}

interface NorthStarData {
  mission_text?: string;
  vision_text?: string;
  vision_timeframe?: string;
  oneYearGoals: OneYearGoal[];
}

interface NorthStarQuickViewProps {
  data: NorthStarData | null;
  loading?: boolean;
  onNavigateToSettings: () => void;
}

export function NorthStarQuickView({ data, loading, onNavigateToSettings }: NorthStarQuickViewProps) {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0078d4" />
        <Text style={styles.loadingText}>Loading North Star...</Text>
      </View>
    );
  }

  const hasMission = data?.mission_text && data.mission_text.trim().length > 0;
  const hasVision = data?.vision_text && data.vision_text.trim().length > 0;
  const activeGoals = data?.oneYearGoals?.filter(g => g.status === 'active') || [];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>North Star Aspirations</Text>
        <Text style={styles.headerSubtitle}>
          Your strategic foundation and long-term vision
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        {/* Mission Statement Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <FileText size={20} color="#0078d4" />
              <Text style={styles.cardTitle}>Mission Statement</Text>
            </View>
            <TouchableOpacity onPress={onNavigateToSettings} style={styles.editButton}>
              <ExternalLink size={16} color="#6b7280" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {hasMission ? (
            <Text style={styles.cardContent} numberOfLines={6}>
              {data.mission_text}
            </Text>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Define your personal mission statement - your core purpose, values, and the impact you want to make.
              </Text>
              <TouchableOpacity onPress={onNavigateToSettings} style={styles.getStartedButton}>
                <Text style={styles.getStartedButtonText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 5-Year Vision Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <TrendingUp size={20} color="#16a34a" />
              <Text style={styles.cardTitle}>
                {data?.vision_timeframe === '5_year' ? '5-Year Vision' : 'Vision Statement'}
              </Text>
            </View>
            <TouchableOpacity onPress={onNavigateToSettings} style={styles.editButton}>
              <ExternalLink size={16} color="#6b7280" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {hasVision ? (
            <Text style={styles.cardContent} numberOfLines={6}>
              {data.vision_text}
            </Text>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Envision your ideal future across personal growth, career, relationships, and lifestyle in 5 years.
              </Text>
              <TouchableOpacity onPress={onNavigateToSettings} style={styles.getStartedButton}>
                <Text style={styles.getStartedButtonText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 1-Year Goals Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Target size={20} color="#7c3aed" />
              <Text style={styles.cardTitle}>1-Year Goals</Text>
            </View>
            <TouchableOpacity onPress={onNavigateToSettings} style={styles.editButton}>
              <ExternalLink size={16} color="#6b7280" />
              <Text style={styles.editButtonText}>Manage</Text>
            </TouchableOpacity>
          </View>

          {activeGoals.length > 0 ? (
            <View style={styles.goalsListContainer}>
              {activeGoals.slice(0, 5).map((goal, index) => (
                <View key={goal.id} style={styles.goalItem}>
                  <View style={styles.goalBullet}>
                    <Text style={styles.goalNumber}>{index + 1}</Text>
                  </View>
                  <View style={styles.goalContent}>
                    <Text style={styles.goalTitle} numberOfLines={2}>
                      {goal.title}
                    </Text>
                    {goal.year_target_date && (
                      <Text style={styles.goalDate}>
                        Target: {new Date(goal.year_target_date).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric'
                        })}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
              {activeGoals.length > 5 && (
                <TouchableOpacity onPress={onNavigateToSettings} style={styles.viewMoreButton}>
                  <Text style={styles.viewMoreText}>
                    +{activeGoals.length - 5} more goals
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Set your top 3-5 goals for the next year that bridge your vision and daily actions.
              </Text>
              <TouchableOpacity onPress={onNavigateToSettings} style={styles.getStartedButton}>
                <Text style={styles.getStartedButtonText}>Add Goals</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    padding: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  cardsContainer: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  cardContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  emptyState: {
    padding: 16,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  getStartedButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0078d4',
  },
  getStartedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  goalsListContainer: {
    gap: 12,
  },
  goalItem: {
    flexDirection: 'row',
    gap: 12,
  },
  goalBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  goalContent: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  goalDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  viewMoreButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7c3aed',
  },
});
