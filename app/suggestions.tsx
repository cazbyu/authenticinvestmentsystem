import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { SuggestionForm } from '@/components/suggestions/SuggestionForm';
import { SuggestionsList } from '@/components/suggestions/SuggestionsList';
import { getSupabaseClient } from '@/lib/supabase';

export default function SuggestionsScreen() {
  const { colors } = useTheme();
  const [authenticScore, setAuthenticScore] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    calculateAuthenticScore();
  }, []);

  const calculateAuthenticScore = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
    setRefreshing(false);
  };

  const handleSuggestionSubmitted = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Suggestions" authenticScore={authenticScore} />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.content}>
          <View style={[styles.introCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.introTitle, { color: colors.text }]}>
              Share Your Feedback
            </Text>
            <Text style={[styles.introText, { color: colors.textSecondary }]}>
              We value your input! Share suggestions to help us improve your experience.
            </Text>
          </View>

          <SuggestionForm onSubmitSuccess={handleSuggestionSubmitted} />

          <View style={styles.divider} />

          <SuggestionsList refreshTrigger={refreshTrigger} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  introCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 24,
  },
});
