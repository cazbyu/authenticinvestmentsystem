import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { FileText, Plus } from 'lucide-react-native';
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
  source_data?: any; // Full task or withdrawal data for editing
}

interface JournalViewProps {
  scope: {
    type: 'user' | 'role' | 'key_relationship' | 'domain';
    id?: string;
    name?: string;
  };
  onEntryPress: (entry: JournalEntry) => void;
  onAddWithdrawal?: () => void;
}

export function JournalView({ scope, onEntryPress, onAddWithdrawal }: JournalViewProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'deposits' | 'withdrawals'>('all');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'all'>('month');
  const [totalBalance, setTotalBalance] = useState(0);

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

          // Get all related data for tasks
          const [
            { data: rolesData, error: rolesError },
            { data: domainsData, error: domainsError },
            { data: goalsData, error: goalsError },
            { data: notesData, error: notesError },
            { data: krData, error: krError }
          ] = await Promise.all([
            supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-goals-join').select('parent_id, goal:0008-ap-goals-12wk(id, title)').in('parent_id', taskIds).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIds).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', taskIds).eq('parent_type', 'task')
          ]);

          if (rolesError) throw rolesError;
          if (domainsError) throw domainsError;
          if (goalsError) throw goalsError;
          if (notesError) throw notesError;
          if (krError) throw krError;

          // Apply scope filtering
          let scopeFilteredTaskIds = taskIds;
          if (scope.type !== 'user' && scope.id) {
            switch (scope.type) {
              case 'role':
                scopeFilteredTaskIds = rolesData?.filter(r => r.role?.id === scope.id).map(r => r.parent_id) || [];
                break;
              case 'key_relationship':
                scopeFilteredTaskIds = krData?.filter(kr => kr.key_relationship?.id === scope.id).map(kr => kr.parent_id) || [];
                break;
              case 'domain':
                scopeFilteredTaskIds = domainsData?.filter(d => d.domain?.id === scope.id).map(d => d.parent_id) || [];
                break;
            }
          }

          const tasksWithNotes = new Set(notesData?.map(n => n.parent_id) || []);

          // Create deposit entries for scope-filtered tasks
          const scopedTasks = tasksData.filter(task => scopeFilteredTaskIds.includes(task.id));
          
          for (const task of scopedTasks) {
            // Attach related data to task
            const taskWithData = {
              ...task,
              roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
              domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
              goals: goalsData?.filter(g => g.parent_id === task.id).map(g => g.goal).filter(Boolean) || [],
            };

            const points = calculateTaskPoints(taskWithData);
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
              source_data: taskWithData,
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
          withdrawalsQuery = withdrawalsQuery.gte('withdrawn_at', dateFilter);
        }

        const { data: withdrawalsData, error: withdrawalsError } = await withdrawalsQuery;
        if (withdrawalsError) throw withdrawalsError;

        if (withdrawalsData && withdrawalsData.length > 0) {
          const withdrawalIds = withdrawalsData.map(w => w.id);

          // Get all related data for withdrawals
          const [
            { data: rolesData, error: rolesError },
            { data: domainsData, error: domainsError },
            { data: krData, error: krError },
            { data: notesData, error: notesError }
          ] = await Promise.all([
            supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', withdrawalIds).eq('parent_type', 'withdrawal'),
            supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', withdrawalIds).eq('parent_type', 'withdrawal'),
            supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', withdrawalIds).eq('parent_type', 'withdrawal'),
            supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', withdrawalIds).eq('parent_type', 'withdrawal')
          ]);

          if (rolesError) throw rolesError;
          if (domainsError) throw domainsError;
          if (krError) throw krError;
          if (notesError) throw notesError;

          // Apply scope filtering
          let scopeFilteredWithdrawalIds = withdrawalIds;
          if (scope.type !== 'user' && scope.id) {
            switch (scope.type) {
              case 'role':
                scopeFilteredWithdrawalIds = rolesData?.filter(r => r.role?.id === scope.id).map(r => r.parent_id) || [];
                break;
              case 'key_relationship':
                scopeFilteredWithdrawalIds = krData?.filter(kr => kr.key_relationship?.id === scope.id).map(kr => kr.parent_id) || [];
                break;
              case 'domain':
                scopeFilteredWithdrawalIds = domainsData?.filter(d => d.domain?.id === scope.id).map(d => d.parent_id) || [];
                break;
            }
          }

          const withdrawalsWithNotes = new Set(notesData?.map(n => n.parent_id) || []);

          // Create withdrawal entries for scope-filtered withdrawals
          const scopedWithdrawals = withdrawalsData.filter(withdrawal => scopeFilteredWithdrawalIds.includes(withdrawal.id));
          
          for (const withdrawal of scopedWithdrawals) {
            // Attach related data to withdrawal
            const withdrawalWithData = {
              ...withdrawal,
              roles: rolesData?.filter(r => r.parent_id === withdrawal.id).map(r => r.role).filter(Boolean) || [],
              domains: domainsData?.filter(d => d.parent_id === withdrawal.id).map(d => d.domain).filter(Boolean) || [],
              keyRelationships: krData?.filter(kr => kr.parent_id === withdrawal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
            };

            journalEntries.push({
              id: withdrawal.id,
              date: withdrawal.withdrawn_at,
              description: withdrawal.title,
              type: 'withdrawal',
              amount: parseFloat(withdrawal.amount.toString()),
              balance: 0, // Will be calculated later
              has_notes: withdrawalsWithNotes.has(withdrawal.id),
              source_id: withdrawal.id,
              source_type: 'withdrawal',
              source_data: withdrawalWithData,
            });
          }
        }
      }

      // Sort by date and calculate running balance
      journalEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      let runningBalance = 0;
      // Calculate balance in chronological order (oldest first) but display newest first
      const chronologicalEntries = [...journalEntries].reverse();
      for (const entry of chronologicalEntries) {
        if (entry.type === 'deposit') {
          runningBalance += entry.amount;
        } else {
          runningBalance -= entry.amount;
        }
      }
      
      // Now assign balances in reverse chronological order (newest first)
      let currentBalance = runningBalance;
      for (const entry of journalEntries) {
        entry.balance = currentBalance;
        if (entry.type === 'deposit') {
          currentBalance -= entry.amount;
        } else {
          currentBalance += entry.amount;
        }
      }

      setTotalBalance(runningBalance);
      setEntries(journalEntries);
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
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

  const getHeaderTitle = () => {
    switch (scope.type) {
      case 'user':
        return 'Total Authentic Score';
      case 'role':
        return `Authentic Score – ${scope.name}`;
      case 'key_relationship':
        return `Authentic Score – ${scope.name}`;
      case 'domain':
        return `Authentic Score – ${scope.name}`;
      default:
        return 'Authentic Score';
    }
  };

  return (
    <View style={styles.container}>
      {/* Filter Controls */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <View style={styles.filterRowContent}>
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
        
          {/* Add Withdrawal Button */}
          {onAddWithdrawal && (
            <TouchableOpacity style={styles.addWithdrawalButton} onPress={onAddWithdrawal}>
              <Plus size={16} color="#dc2626" />
              <Text style={styles.addWithdrawalText}>Add Withdrawal</Text>
            </TouchableOpacity>
          )}
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
              key={`${entry.source_type}-${entry.id}`}
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
    flexDirection: 'column',
    gap: 12,
  },
  filterRowContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  filterRowContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  filterGroup: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 2,
  },
  addWithdrawalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
    gap: 6,
  },
  addWithdrawalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
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