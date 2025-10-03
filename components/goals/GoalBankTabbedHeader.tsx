import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

export type GoalBankTab = 'timelines' | 'northstar';

interface GoalBankTabbedHeaderProps {
  activeTab: GoalBankTab;
  onTabChange: (tab: GoalBankTab) => void;
  authenticScore: number;
  showBackButton?: boolean;
  onBackPress?: () => void;
  timelineTitle?: string;
  daysRemaining?: number;
  cycleProgressPercentage?: number;
  backgroundColor?: string;
}

export function GoalBankTabbedHeader({
  activeTab,
  onTabChange,
  authenticScore,
  showBackButton,
  onBackPress,
  timelineTitle,
  daysRemaining,
  cycleProgressPercentage,
  backgroundColor = '#0078d4',
}: GoalBankTabbedHeaderProps) {
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.topRow}>
        {showBackButton ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBackPress}
            accessibilityLabel="Go back to timeline selector"
            accessibilityRole="button"
          >
            <ChevronLeft size={24} color="#ffffff" />
            <Text style={styles.backButtonText}>Timelines</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.pageTitle}>Goal Bank</Text>
        )}

        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Authentic Score</Text>
          <Text style={styles.scoreValue}>{authenticScore}</Text>
        </View>
      </View>

      {timelineTitle && (
        <View style={styles.timelineInfo}>
          <Text style={styles.timelineTitle} numberOfLines={1}>
            {timelineTitle}
          </Text>
          {(daysRemaining !== undefined || cycleProgressPercentage !== undefined) && (
            <View style={styles.timelineMetrics}>
              {daysRemaining !== undefined && (
                <Text style={styles.timelineMetric}>{daysRemaining} days left</Text>
              )}
              {cycleProgressPercentage !== undefined && (
                <>
                  <Text style={styles.timelineMetricSeparator}>•</Text>
                  <Text style={styles.timelineMetric}>
                    {Math.round(cycleProgressPercentage)}% complete
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
      )}

      {!showBackButton && (
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'timelines' && styles.activeTab,
            ]}
            onPress={() => onTabChange('timelines')}
            accessibilityLabel="Timelines tab"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'timelines' }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'timelines' && styles.activeTabText,
              ]}
            >
              Timelines
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'northstar' && styles.activeTab,
            ]}
            onPress={() => onTabChange('northstar')}
            accessibilityLabel="North Star tab"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'northstar' }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'northstar' && styles.activeTabText,
              ]}
            >
              North Star
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  timelineInfo: {
    marginBottom: 8,
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  timelineMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineMetric: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  timelineMetricSeparator: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 4,
    borderRadius: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  activeTabText: {
    color: '#0078d4',
  },
});
