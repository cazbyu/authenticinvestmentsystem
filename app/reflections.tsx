import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Header } from '@/components/Header';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import DailyNotesView from '@/components/reflections/DailyNotesView';
import WeeklyReflectionView from '@/components/reflections/WeeklyReflectionView';
import { BookOpen, Calendar } from 'lucide-react-native';

const TAB_STORAGE_KEY = '@reflections_active_tab';

type TabType = 'daily' | 'weekly';

export default function ReflectionsScreen() {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [authenticScore, setAuthenticScore] = useState(0);

  useEffect(() => {
    loadActiveTab();
    calculateAuthenticScore();
  }, []);

  const loadActiveTab = async () => {
    try {
      const savedTab = await AsyncStorage.getItem(TAB_STORAGE_KEY);
      if (savedTab === 'daily' || savedTab === 'weekly') {
        setActiveTab(savedTab);
      }
    } catch (error) {
      console.error('Error loading active tab:', error);
    }
  };

  const handleTabChange = async (tab: TabType) => {
    setActiveTab(tab);
    try {
      await AsyncStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch (error) {
      console.error('Error saving active tab:', error);
    }
  };

  const calculateAuthenticScore = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get today's date
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Fetch completed tasks for today
      const { data: tasks, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select(`
          *,
          universal_roles:0008-ap-universal-roles-join!parent_id(role_id),
          universal_domains:0008-ap-universal-domains-join!parent_id(domain_id)
        `)
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .gte('completed_at', startOfDay.toISOString())
        .lt('completed_at', endOfDay.toISOString());

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
        return;
      }

      // Calculate score
      let score = 0;
      if (tasks) {
        tasks.forEach((task: any) => {
          let points = 0;
          const roles = task.universal_roles || [];
          const domains = task.universal_domains || [];

          if (roles.length > 0) points += roles.length;
          if (domains.length > 0) points += domains.length;
          if (task.is_authentic_deposit) points += 2;
          if (task.is_urgent && task.is_important) points += 1.5;
          else if (!task.is_urgent && task.is_important) points += 3;
          else if (task.is_urgent && !task.is_important) points += 1;
          else points += 0.5;

          score += Math.round(points * 10) / 10;
        });
      }

      // Fetch withdrawals for today
      const { data: withdrawals } = await supabase
        .from('0008-ap-withdrawals')
        .select('amount')
        .eq('user_id', user.id)
        .gte('withdrawn_at', startOfDay.toISOString())
        .lt('withdrawn_at', endOfDay.toISOString());

      if (withdrawals) {
        const totalWithdrawals = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
        score = Math.max(0, score - totalWithdrawals);
      }

      setAuthenticScore(Math.round(score));
    } catch (error) {
      console.error('Error calculating authentic score:', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Reflections" authenticScore={authenticScore} />

      {/* Tab Selector */}
      <View style={[styles.tabSelector, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'daily' && [styles.activeTab, { backgroundColor: colors.primary }]
          ]}
          onPress={() => handleTabChange('daily')}
        >
          <BookOpen
            size={18}
            color={activeTab === 'daily' ? '#ffffff' : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'daily' ? '#ffffff' : colors.textSecondary }
            ]}
          >
            Daily Reflection
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'weekly' && [styles.activeTab, { backgroundColor: colors.primary }]
          ]}
          onPress={() => handleTabChange('weekly')}
        >
          <Calendar
            size={18}
            color={activeTab === 'weekly' ? '#ffffff' : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'weekly' ? '#ffffff' : colors.textSecondary }
            ]}
          >
            Weekly Reflection
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'daily' ? <DailyNotesView /> : <WeeklyReflectionView />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabSelector: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 10,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});
