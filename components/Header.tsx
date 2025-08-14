import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase'; 
import { FontAwesome5 } from '@expo/vector-icons';

// The Header now accepts props to control its state from the parent
interface HeaderProps {
  activeView: 'deposits' | 'ideas';
  onViewChange: (view: 'deposits' | 'ideas') => void;
  onSortPress: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeView, onViewChange, onSortPress }) => {
  const router = useRouter();
  const [totalScore, setTotalScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTotalScore = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_total_score', {
          p_time_period: 'all_time',
        });
        if (error) throw error;
        setTotalScore(data);
      } catch (error) {
        console.error("Error fetching total score:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTotalScore();
  }, []);

  const handleScorePress = () => {
    router.push('/ledger');
  };

  return (
    <View style={styles.headerContainer}>
      {/* Top section with title and score */}
      <View style={styles.topSection}>
         <FontAwesome5 name="bars" size={24} color="#343a40" />
        <Text style={styles.headerTitle}>Authentic Investments</Text>
        <TouchableOpacity onPress={handleScorePress} style={styles.scoreContainer}>
          {loading ? (
            <ActivityIndicator size="small" color="#343a40" />
          ) : (
            <Text style={styles.scoreValue}>+ {totalScore.toFixed(1)}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Bottom section with toggle and sort */}
      <View style={styles.bottomSection}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, activeView === 'deposits' && styles.activeButton]}
            onPress={() => onViewChange('deposits')}
          >
            <Text style={[styles.toggleText, activeView === 'deposits' && styles.activeText]}>Deposits</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, activeView === 'ideas' && styles.activeButton]}
            onPress={() => onViewChange('ideas')}
          >
            <Text style={[styles.toggleText, activeView === 'ideas' && styles.activeText]}>Ideas</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.sortButton} onPress={onSortPress}>
          <Text style={styles.sortText}>Sort</Text>
          <FontAwesome5 name="sort-amount-down" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 40, // For status bar
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ADD8E6', // Light blue background
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#343a40',
  },
  scoreContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#343a40',
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 20,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  activeButton: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontWeight: '600',
    color: '#495057',
  },
  activeText: {
    color: '#007bff',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6c757d',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  sortText: {
    color: '#fff',
    fontWeight: '600',
    marginRight: 6,
  },
});

export default Header;
