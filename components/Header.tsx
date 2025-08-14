import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Menu, ArrowUpDown } from 'lucide-react-native';

interface HeaderProps {
  activeView: 'deposits' | 'ideas';
  onViewChange: (view: 'deposits' | 'ideas') => void;
  onSortPress: () => void;
  authenticScore?: number;
}

export function Header({ activeView, onViewChange, onSortPress, authenticScore = 85 }: HeaderProps) {
  return (
    <View style={styles.container}>
      {/* Top section with menu and score */}
      <View style={styles.topSection}>
        <TouchableOpacity style={styles.menuButton}>
          <Menu size={24} color="#ffffff" />
        </TouchableOpacity>
        
        <View style={styles.titleSection}>
          <Text style={styles.title}>Authentic</Text>
          <Text style={styles.subtitle}>Investments</Text>
        </View>
        
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Authentic Total Score</Text>
          <Text style={styles.scoreValue}>{authenticScore}</Text>
        </View>
      </View>
      
      {/* Bottom section with toggle and sort */}
      <View style={styles.bottomSection}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              styles.leftToggle,
              activeView === 'deposits' && styles.activeToggle
            ]}
            onPress={() => onViewChange('deposits')}
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
              styles.rightToggle,
              activeView === 'ideas' && styles.activeToggle
            ]}
            onPress={() => onViewChange('ideas')}
          >
            <Text style={[
              styles.toggleText,
              activeView === 'ideas' && styles.activeToggleText
            ]}>
              Ideas
            </Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={styles.sortButton} onPress={onSortPress}>
          <ArrowUpDown size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>
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
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
  },
  leftToggle: {
    marginRight: 2,
  },
  rightToggle: {
    marginLeft: 2,
  },
  activeToggle: {
    backgroundColor: '#ffffff',
  },
  toggleText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  activeToggleText: {
    color: '#0078d4',
  },
  sortButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});