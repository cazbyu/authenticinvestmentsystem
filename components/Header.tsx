import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { Menu, ArrowUpDown, ChevronLeft, CreditCard as Edit } from 'lucide-react-native';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';

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
  authenticScore: propAuthenticScore,
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
  const { authenticScore: contextAuthenticScore } = useAuthenticScore();

  // Use prop if provided (for role/domain-specific scores), otherwise use context
  const displayScore = propAuthenticScore ?? contextAuthenticScore;

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
          <Text style={styles.scoreValue}>{displayScore}</Text>
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
      
      {/* Bottom section with unified tab bar */}
      {(activeView && onViewChange) && (
        <View style={styles.bottomSection}>
          {/* Unified tab container */}
          <View style={styles.toggleContainer}>
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

            <TouchableOpacity
              style={[styles.toggleButton, activeView === 'journal' && styles.activeToggle]}
              onPress={() => onViewChange && onViewChange('journal')}
            >
              <Text style={[styles.toggleText, activeView === 'journal' && styles.activeToggleText]}>
                Journal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleButton, activeView === 'analytics' && styles.activeToggle]}
              onPress={() => onViewChange && onViewChange('analytics')}
            >
              <Text style={[styles.toggleText, activeView === 'analytics' && styles.activeToggleText]}>
                Analytics
              </Text>
            </TouchableOpacity>
          </View>


          {/* Sort Button */}
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
    justifyContent: 'center',
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
    display: 'none',
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
    gap: 0,
    flex: 1,
    maxWidth: 500,
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 70,
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
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
});
