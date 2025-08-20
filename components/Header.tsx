import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { Menu, ArrowUpDown, ChevronLeft, CreditCard as Edit } from 'lucide-react-native';

type DrawerNavigation = DrawerNavigationProp<any>;

interface HeaderProps {
  title?: string;
  activeView?: 'deposits' | 'ideas';
  onViewChange?: (view: 'deposits' | 'ideas') => void;
  activeJournalView?: 'deposits' | 'ideas' | 'journal' | 'analytics';
  onJournalViewChange?: (view: 'deposits' | 'ideas' | 'journal' | 'analytics') => void;
  onSortPress?: () => void;
  authenticScore?: number;
  onBackPress?: () => void;
  backgroundColor?: string;
  onEditPress?: () => void;
}

export function Header({ 
  title, 
  activeView, 
  onViewChange, 
  activeJournalView, 
  onJournalViewChange, 
  onSortPress, 
  authenticScore = 85, 
  onBackPress, 
  backgroundColor, 
  onEditPress 
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
      </View>
      
      {/* Bottom section with toggle and sort */}
      {((activeView && onViewChange) || (activeJournalView && onJournalViewChange)) && (
        <View style={styles.bottomSection}>
          {activeJournalView && onJournalViewChange ? (
            <>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    activeJournalView === 'deposits' && styles.activeToggle
                  ]}
                  onPress={() => onJournalViewChange('deposits')}
                >
                  <Text style={[
                    styles.toggleText,
                    activeJournalView === 'deposits' && styles.activeToggleText
                  ]}>
                    Deposits
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    activeJournalView === 'ideas' && styles.activeToggle
                  ]}
                  onPress={() => onJournalViewChange('ideas')}
                >
                  <Text style={[
                    styles.toggleText,
                    activeJournalView === 'ideas' && styles.activeToggleText
                  ]}>
                    Ideas
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.journalButtonsContainer}>
                <TouchableOpacity
                  style={[
                    styles.journalButton,
                    activeJournalView === 'journal' && styles.activeJournalButton
                  ]}
                  onPress={() => onJournalViewChange('journal')}
                >
                  <Text style={[
                    styles.journalButtonText,
                    activeJournalView === 'journal' && styles.activeJournalButtonText
                  ]}>
                    Role Journal
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.journalButton,
                    activeJournalView === 'analytics' && styles.activeJournalButton
                  ]}
                  onPress={() => onJournalViewChange('analytics')}
                >
                  <Text style={[
                    styles.journalButtonText,
                    activeJournalView === 'analytics' && styles.activeJournalButtonText
                  ]}>
                    Analytics
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  activeView === 'deposits' && styles.activeToggle
                ]}
                onPress={() => onViewChange && onViewChange('deposits')}
              >
                <Text style={[
                  styles.toggleText,
                  activeView === 'deposits' && styles.activeToggleText
                ]}>
                  Deposits
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  activeView === 'ideas' && styles.activeToggle
                ]}
                onPress={() => onViewChange && onViewChange('ideas')}
              >
                <Text style={[
                  styles.toggleText,
                  activeView === 'ideas' && styles.activeToggleText
                ]}>
                  Ideas
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
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
    right: -20,
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
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 2,
  },
  journalButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
  },
  activeToggle: {
    backgroundColor: '#ffffff',
  },
  toggleText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  activeToggleText: {
    color: '#0078d4',
  },
  journalButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
