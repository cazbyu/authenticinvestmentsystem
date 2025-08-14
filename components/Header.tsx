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
        
        {/* Updated Sort Button to look like a toggle */}
        <TouchableOpacity style={styles.sortButton} onPress={onSortPress}>
          <Text style={styles.toggleText}>Sort</Text>
          <ArrowUpDown size={16} color="#ffffff" style={{ marginLeft: 6 }}/>
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
    borderRadius: 16, // Smaller border radius
    padding: 2,
  },
  toggleButton: {
    paddingHorizontal: 16, // Reduced horizontal padding
    paddingVertical: 6,  // Reduced vertical padding
    borderRadius: 10, // Smaller border radius
  },
  activeToggle: {
    backgroundColor: '#ffffff',
  },
  toggleText: {
    color: '#ffffff',
    fontSize: 12, // Smaller font size
    fontWeight: '600',
  },
  activeToggleText: {
    color: '#0078d4',
  },
  // New style for the sort button to match the toggle
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8, // Adjusted to vertically align text
    borderRadius: 16,
  },
});
