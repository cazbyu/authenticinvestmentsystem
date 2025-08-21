import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { FileText, Calendar, Filter } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

interface JournalEntry {
  id: string;
  date: string;
  description: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  balance: number;
  has_notes: boolean;
  source_id: string; // task_id or withdrawal_id
  source_type: 'task' | 'withdrawal';
}

interface JournalViewProps {
  scope: {
    type: 'user' | 'role' | 'key_relationship' | 'domain';
    id?: string;
    name?: string;
  };
  onEntryPress: (entry: JournalEntry) => void;
}

export function JournalView({ scope, onEntryPress }: JournalViewProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'deposits' | 'withdrawals'>('all');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'all'>('month');

  const fetchJournalEntries = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate date filter
      let dateFilter = '';
      const now = new Date();
      if (dateRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = weekAgo.toISOString().split('T')[0];
      } else if (dateRange === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFilter = monthAgo.toISOString().split('T')[0];
      }

      const journalEntries: JournalEntry[] = [];

      // Fetch deposits (completed tasks/events)
      if (filter === 'all' || filter === 'deposits') {
        let tasksQuery = supabase
          .from('0008-ap-tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .not('completed_at', 'is', null);

        if (dateFilter) {
          tasksQuery = tasksQuery.gte('completed_at', dateFilter);
        }

        const { data: tasksData, error: tasksError } = await tasksQuery;
        if (tasksError) throw tasksError;

        if (tasksData && tasksData.length > 0) {
          const taskIds = tasksData.map(t => t.id);

          // Get scope-filtered task IDs based on the current scope
          let scopeFilteredTaskIds = taskIds;
          if (scope.type !== 'user' && scope.id) {
            let joinTable = '';
            let joinField = '';
            
            switch (scope.type) {
              case 'role':
                joinTable = '0008-ap-universal-roles-join';
                joinField = 'role_id';
                break;
              case 'key_relationship':
                joinTable = '0008-ap-universal-key-relationships-join';
                joinField = 'key_relationship_id';
                break;
              case 'domain':
                joinTable = '0008-ap-universal-domains-join';
                joinField = 'domain_id';
                break;
            }

            if (joinTable) {
              const { data: scopeData, error: scopeError } = await supabase
                .from(joinTable)
                .select('parent_id')
                .in('parent_id', taskIds)
                .eq('parent_type', 'task')
                .eq(joinField, scope.id);

              if (scopeError) throw scopeError;
              scopeFilteredTaskIds = scopeData?.map(s => s.parent_id) || [];
            }
          }

          // Get notes for tasks
          const { data: notesData } = await supabase
            .from('0008-ap-universal-notes-join')
            .select('parent_id')
            .in('parent_id', scopeFilteredTaskIds)
            .eq('parent_type', 'task');

          const tasksWithNotes = new Set(notesData?.map(n => n.parent_id) || []);

          // Filter tasks to scope and create deposit entries
          const scopedTasks = tasksData.filter(task => scopeFilteredTaskIds.includes(task.id));
          
          for (const task of scopedTasks) {
            const points = calculateTaskPoints(task);
            journalEntries.push({
              id: task.id,
              date: task.completed_at?.split('T')[0] || task.due_date,
              description: task.title,
              type: 'deposit',
              amount: points,
              balance: 0, // Will be calculated later
              has_notes: tasksWithNotes.has(task.id),
              source_id: task.id,
              source_type: 'task',
            });
          }
        }
      }

      // Fetch withdrawals
      if (filter === 'all' || filter === 'withdrawals') {
        let withdrawalsQuery = supabase
          .from('0008-ap-withdrawals')
          .select('*')
          .eq('user_id', user.id);

        if (dateFilter) {
          withdrawalsQuery = withdrawalsQuery.gte('withdrawal_date', dateFilter);
        }

        const { data: withdrawalsData, error: withdrawalsError } = await withdrawalsQuery;
        if (withdrawalsError) throw withdrawalsError;

        if (withdrawalsData && withdrawalsData.length > 0) {
          const withdrawalIds = withdrawalsData.map(w => w.id);

          // Get scope-filtered withdrawal IDs
          let scopeFilteredWithdrawalIds = withdrawalIds;
          if (scope.type !== 'user' && scope.id) {
            let joinTable = '';
            let joinField = '';
            
            switch (scope.type) {
              case 'role':
                joinTable = '0008-ap-universal-roles-join';
                joinField = 'role_id';
                break;
              case 'key_relationship':
                joinTable = '0008-ap-universal-key-relationships-join';
                joinField = 'key_relationship_id';
                break;
              case 'domain':
                joinTable = '0008-ap-universal-domains-join';
                joinField = 'domain_id';
                break;
            }

            if (joinTable) {
              const { data: scopeData, error: scopeError } = await supabase
                .from(joinTable)
                .select('parent_id')
                .in('parent_id', withdrawalIds)
                .eq('parent_type', 'withdrawal')
                .eq(joinField, scope.id);

              if (scopeError) throw scopeError;
              scopeFilteredWithdrawalIds = scopeData?.map(s => s.parent_id) || [];
            }
          }

          // Get notes for withdrawals
          const { data: notesData } = await supabase
            .from('0008-ap-universal-notes-join')
            .select('parent_id')
            .in('parent_id', scopeFilteredWithdrawalIds)
            .eq('parent_type', 'withdrawal');

          const withdrawalsWithNotes = new Set(notesData?.map(n => n.parent_id) || []);

          // Filter withdrawals to scope and create withdrawal entries
          const scopedWithdrawals = withdrawalsData.filter(withdrawal => scopeFilteredWithdrawalIds.includes(withdrawal.id));
          
          for (const withdrawal of scopedWithdrawals) {
            journalEntries.push({
              id: withdrawal.id,
              date: withdrawal.withdrawal_date,
              description: withdrawal.title,
              type: 'withdrawal',
              amount: parseFloat(withdrawal.amount.toString()),
              balance: 0, // Will be calculated later
              has_notes: withdrawalsWithNotes.has(withdrawal.id),
              source_id: withdrawal.id,
              source_type: 'withdrawal',
            });
          }
        }
      }

      // Sort by date and calculate running balance
      journalEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      let runningBalance = 0;
      for (const entry of journalEntries) {
        if (entry.type === 'deposit') {
          runningBalance += entry.amount;
        } else {
          runningBalance -= entry.amount;
        }
        entry.balance = runningBalance;
      }

      setEntries(journalEntries);
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const calculateTaskPoints = (task: any) => {
    let points = 0;
    if (task.roles && task.roles.length > 0) points += task.roles.length;
    if (task.domains && task.domains.length > 0) points += task.domains.length;
    if (task.is_authentic_deposit) points += 2;
    if (task.is_urgent && task.is_important) points += 1.5;
    else if (!task.is_urgent && task.is_important) points += 3;
    else if (task.is_urgent && !task.is_important) points += 1;
    else points += 0.5;
    if (task.is_twelve_week_goal) points += 2;
    return Math.round(points * 10) / 10;
  };

  useEffect(() => {
    fetchJournalEntries();
  }, [scope, filter, dateRange]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const formatBalance = (balance: number) => {
    const prefix = balance >= 0 ? '+' : '';
    return `${prefix}${balance.toFixed(1)}`;
  };

  const getBalanceColor = (balance: number) => {
    return balance >= 0 ? '#16a34a' : '#dc2626';
  };

  return (
    <View style={styles.container}>
      {/* Filter Controls */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <View style={styles.filterGroup}>
            {(['all', 'deposits', 'withdrawals'] as const).map((filterOption) => (
              <TouchableOpacity
                key={filterOption}
                style={[
                  styles.filterButton,
                  filter === filterOption && styles.activeFilterButton
                ]}
                onPress={() => setFilter(filterOption)}
              >
                <Text style={[
                  styles.filterButtonText,
                  filter === filterOption && styles.activeFilterButtonText
                ]}>
                  {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.filterGroup}>
            {(['week', 'month', 'all'] as const).map((rangeOption) => (
              <TouchableOpacity
                key={rangeOption}
                style={[
                  styles.filterButton,
                  dateRange === rangeOption && styles.activeFilterButton
                ]}
                onPress={() => setDateRange(rangeOption)}
              >
                <Text style={[
                  styles.filterButtonText,
                  dateRange === rangeOption && styles.activeFilterButtonText
                ]}>
                  {rangeOption.charAt(0).toUpperCase() + rangeOption.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Journal Header */}
      <View style={styles.journalHeader}>
        <Text style={styles.headerDate}>Date</Text>
        <Text style={styles.headerDescription}>Description</Text>
        <Text style={styles.headerNotes}>Notes</Text>
        <Text style={styles.headerDeposit}>Deposit</Text>
        <Text style={styles.headerWithdrawal}>Withdrawal</Text>
        <Text style={styles.headerBalance}>Balance</Text>
      </View>

      {/* Journal Entries */}
      <ScrollView style={styles.journalContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading journal...</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No journal entries found</Text>
          </View>
        ) : (
          entries.map((entry, index) => (
            <TouchableOpacity
              key={entry.id}
              style={[
                styles.journalRow,
                index % 2 === 0 ? styles.evenRow : styles.oddRow
              ]}
              onPress={() => onEntryPress(entry)}
            >
              <Text style={styles.cellDate}>{formatDate(entry.date)}</Text>
              <Text style={styles.cellDescription} numberOfLines={2}>
                {entry.description}
              </Text>
              <View style={styles.cellNotes}>
                {entry.has_notes && (
                  <FileText size={14} color="#6b7280" />
                )}
              </View>
              <Text style={styles.cellDeposit}>
                {entry.type === 'deposit' ? `+${entry.amount.toFixed(1)}` : ''}
              </Text>
              <Text style={styles.cellWithdrawal}>
                {entry.type === 'withdrawal' ? entry.amount.toFixed(1) : ''}
              </Text>
              <Text style={[
                styles.cellBalance,
                { color: getBalanceColor(entry.balance) }
              ]}>
                {formatBalance(entry.balance)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  filterContainer: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterGroup: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 2,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activeFilterButton: {
    backgroundColor: '#0078d4',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeFilterButtonText: {
    color: '#ffffff',
  },
  journalHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#d1d5db',
  },
  headerDate: {
    width: 70,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  headerDescription: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    paddingHorizontal: 8,
  },
  headerNotes: {
    width: 40,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  headerDeposit: {
    width: 60,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'right',
  },
  headerWithdrawal: {
    width: 70,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'right',
  },
  headerBalance: {
    width: 70,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'right',
  },
  journalContent: {
    flex: 1,
  },
  journalRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  evenRow: {
    backgroundColor: '#ffffff',
  },
  oddRow: {
    backgroundColor: '#f8fafc',
  },
  cellDate: {
    width: 70,
    fontSize: 12,
    color: '#374151',
    textAlign: 'center',
  },
  cellDescription: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    paddingHorizontal: 8,
    lineHeight: 18,
  },
  cellNotes: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDeposit: {
    width: 60,
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
    textAlign: 'right',
  },
  cellWithdrawal: {
    width: 70,
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
    textAlign: 'right',
  },
  cellBalance: {
    width: 70,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center',
  },
});