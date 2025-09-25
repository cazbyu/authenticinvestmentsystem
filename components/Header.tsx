import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { Menu, ArrowUpDown, ChevronLeft, Edit } from 'lucide-react-native';

type DrawerNavigation = DrawerNavigationProp<any>;

interface HeaderProps {
  title?: string;
  activeView?: 'deposits' | 'ideas' | 'journal' | 'analytics';
  onViewChange?: (view: 'deposits' | 'ideas' | 'journal' | 'analytics') => void;
  onSortPress?: () => void;
  authenticScore?: number;
  onBackPress?: () => void;
  backgroundColor?: string;
  onEditPress?: () => void;
  daysRemaining?: number;
  cycleProgressPercentage?: number;
  cycleTitle?: string;
}

export function Header({ 
  title, 
  activeView, 
  onViewChange, 
  onSortPress, 
  authenticScore = 85, 
  onBackPress, 
  backgroundColor, 
  onEditPress,
  daysRemaining,
  cycleProgressPercentage,
  cycleTitle
}: HeaderProps) {
  const navigation = useNavigation<DrawerNavigation>();
  const router = useRouter();
  const canGoBack = router.canGoBack();

  const handleLeftButtonPress = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    if (canGoBack) {
      router.back();
    } else {
      navigation.openDrawer();
    }
  };

  return (
    <View style={[styles.container, backgroundColor && { backgroundColor }]}>
      {/* Top section with menu and score */}
      <View style={styles.topSection}>
        <TouchableOpacity style={styles.menuButton} onPress={handleLeftButtonPress}>
          {canGoBack ? <ChevronLeft size={24} color="#ffffff" /> : <Menu size={24} color="#ffffff" />}
        </TouchableOpacity>
        
        <View style={styles.titleSection}>
          <Text style={styles.title}>{title || 'Authentic'}</Text>
          {!title && <Text style={styles.subtitle}>Investments</Text>}
          {onEditPress && (
            <TouchableOpacity style={styles.editButton} onPress={onEditPress}>
              <Edit size={16} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Authentic Total Score</Text>
          <Text style={styles.scoreValue}>{authenticScore}</Text>
        </View>
        
        {/* Cycle Progress Section */}
        {daysRemaining !== undefined && cycleProgressPercentage !== undefined && (
          <View style={styles.cycleContainer}>
            <Text style={styles.cycleLabel}>
              {cycleTitle ? cycleTitle.substring(0, 12) + (cycleTitle.length > 12 ? '...' : '') : 'Cycle'}
            </Text>
            <Text style={styles.cycleValue}>{daysRemaining}d</Text>
            <View style={styles.cycleProgressBar}>
              <View 
                style={[
                  styles.cycleProgressFill, 
                  { width: `${Math.min(100, Math.max(0, cycleProgressPercentage))}%` }
                ]} 
              />
            </View>
          </View>
        )}
      </View>
      
      {/* Bottom section with toggle and sort */}
      {(activeView && onViewChange) && (
        <View style={styles.bottomSection}>
          {/* Always show both toggle groups */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Deposits / Ideas */}
            <View style={[styles.toggleContainer, { marginRight: 8 }]}>
              <TouchableOpacity
                style={[styles.toggleButton, activeView === 'deposits' && styles.activeToggle]}
                onPress={() => onViewChange && onViewChange('deposits')}
              >
                <Text style={[styles.toggleText, activeView === 'deposits' && styles.activeToggleText]}>
                  Deposits
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleButton, activeView === 'ideas' && styles.activeToggle]}
                onPress={() => onViewChange && onViewChange('ideas')}
              >
                <Text style={[styles.toggleText, activeView === 'ideas' && styles.activeToggleText]}>
                  Ideas
                </Text>
              </TouchableOpacity>
            </View>

            {/* Journal / Analytics - Updated to include Analytics */}
            <View style={styles.journalButtonsContainer}>
              <TouchableOpacity
                style={[styles.journalButton, activeView === 'journal' && styles.activeJournalButton, { minWidth: 70 }]}
                onPress={() => onViewChange && onViewChange('journal')}
              >
                <Text style={[styles.journalButtonText, activeView === 'journal' && styles.activeJournalButtonText]}>
                  Journal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.journalButton, activeView === 'analytics' && styles.activeJournalButton, { minWidth: 70 }]}
                onPress={() => onViewChange && onViewChange('analytics')}
              >
                <Text style={[styles.journalButtonText, activeView === 'analytics' && styles.activeJournalButtonText]}>
                  Analytics
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          
          {/* Updated Sort Button to look like a toggle */}
          {onSortPress && (
            <TouchableOpacity style={styles.sortButton} onPress={onSortPress}>
              <Text style={styles.toggleText}>Sort</Text>
              <ArrowUpDown size={16} color="#ffffff" style={{ marginLeft: 6 }}/>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0078d4',
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  menuButton: {
    padding: 4,
  },
  titleSection: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  subtitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '400',
    opacity: 0.9,
  },
  editButton: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: [{ translateY: -8 }],
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 4,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    color: '#ffffff',
    fontSize: 10,
    opacity: 0.8,
    marginBottom: 2,
  },
  scoreValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  cycleContainer: {
    alignItems: 'flex-end',
    marginLeft: 16,
    minWidth: 60,
  },
  cycleLabel: {
    color: '#ffffff',
    fontSize: 10,
    opacity: 0.8,
    marginBottom: 2,
  },
  cycleValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cycleProgressBar: {
    width: 50,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  cycleProgressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
    width: '100%',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 2,
    minWidth: 120,
    flex: 0,
  },
  journalButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    minWidth: 200,
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 0,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeToggle: {
    backgroundColor: '#ffffff',
  },
  toggleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeToggleText: {
    color: '#0078d4',
  },
  journalButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 70,
    alignItems: 'center',
  },
  activeJournalButton: {
    backgroundColor: '#ffffff',
  },
  journalButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  activeJournalButtonText: {
    color: '#0078d4',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
});
