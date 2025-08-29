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
    const roles = task.roles || [];
    const domains = task.domains || [];
    
    let points = 0;
    if (roles.length > 0) points += roles.length;
    if (domains.length > 0) points += domains.length;
    if (task.is_authentic_deposit) points += 2;
    if (task.is_urgent && task.is_important) points += 1.5;
    else if (!task.is_urgent && task.is_important) points += 3;
    else if (task.is_urgent && !task.is_important) points += 1;
    else points += 0.5;
    if (task.is_twelve_week_goal) points += 2;
    return Math.round(points * 10) / 10;
  };

  const buildScopeFilter = (tableName: string) => {
    if (scope.type === 'user' || !scope.id) {
      return null; // No additional filtering needed
    }

    switch (scope.type) {
      case 'role':
        return `${tableName}_roles!inner(role_id.eq.${scope.id})`;
      case 'key_relationship':
        return `${tableName}_key_relationships!inner(key_relationship_id.eq.${scope.id})`;
      case 'domain':
        return `${tableName}_domains!inner(domain_id.eq.${scope.id})`;
      default:
        return null;
    }
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

      // Fetch deposits (completed tasks/events) with all related data in one query
      if (filter === 'all' || filter === 'deposits') {
        let tasksQuery = supabase
          .from('0008-ap-tasks')
          .select(`
            *,
            task_roles:0008-ap-universal-roles-join!inner(
              role:0008-ap-roles(id, label)
            ),
            task_domains:0008-ap-universal-domains-join(
              domain:0008-ap-domains(id, name)
            ),
            task_goals:0008-ap-universal-goals-join(
              goal:0008-ap-goals-12wk(id, title)
            ),
            task_key_relationships:0008-ap-universal-key-relationships-join(
              key_relationship:0008-ap-key-relationships(id, name)
            ),
            task_notes:0008-ap-universal-notes-join(
              note:0008-ap-notes(id, content, created_at)
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .not('completed_at', 'is', null)
          .eq('0008-ap-universal-roles-join.parent_type', 'task')
          .eq('0008-ap-universal-domains-join.parent_type', 'task')
          .eq('0008-ap-universal-goals-join.parent_type', 'task')
          .eq('0008-ap-universal-key-relationships-join.parent_type', 'task')
          .eq('0008-ap-universal-notes-join.parent_type', 'task');

        // Apply scope filtering at database level
        if (scope.type !== 'user' && scope.id) {
          switch (scope.type) {
            case 'role':
              tasksQuery = tasksQuery.eq('0008-ap-universal-roles-join.role_id', scope.id);
              break;
            case 'key_relationship':
              tasksQuery = tasksQuery.eq('0008-ap-universal-key-relationships-join.key_relationship_id', scope.id);
              break;
            case 'domain':
              tasksQuery = tasksQuery.eq('0008-ap-universal-domains-join.domain_id', scope.id);
              break;
          }
        }

        if (dateFilter) {
          tasksQuery = tasksQuery.gte('completed_at', dateFilter);
        }

        const { data: tasksData, error: tasksError } = await tasksQuery;
        if (tasksError) {
          console.error('Tasks query error:', tasksError);
          // If the complex query fails, fall back to simpler approach
          await fetchJournalEntriesSimple();
          return;
        }

        if (tasksData) {
          for (const task of tasksData) {
            // Transform nested data to flat structure
            const taskWithData = {
              ...task,
              roles: task.task_roles?.map(tr => tr.role).filter(Boolean) || [],
              domains: task.task_domains?.map(td => td.domain).filter(Boolean) || [],
              goals: task.task_goals?.map(tg => tg.goal).filter(Boolean) || [],
              keyRelationships: task.task_key_relationships?.map(tkr => tkr.key_relationship).filter(Boolean) || [],
            };

            const points = calculateTaskPoints(taskWithData);
            const hasNotes = task.task_notes && task.task_notes.length > 0;

            journalEntries.push({
              id: task.id,
              date: task.completed_at?.split('T')[0] || task.due_date,
              description: task.title,
              type: 'deposit',
              amount: points,
              balance: 0, // Will be calculated later
              has_notes: hasNotes,
              source_id: task.id,
              source_type: 'task',
              source_data: taskWithData,
            });
          }
        }
      }

      // Fetch withdrawals with all related data in one query
      if (filter === 'all' || filter === 'withdrawals') {
        let withdrawalsQuery = supabase
          .from('0008-ap-withdrawals')
          .select(`
            *,
            withdrawal_roles:0008-ap-universal-roles-join(
              role:0008-ap-roles(id, label)
            ),
            withdrawal_domains:0008-ap-universal-domains-join(
              domain:0008-ap-domains(id, name)
            ),
            withdrawal_key_relationships:0008-ap-universal-key-relationships-join(
              key_relationship:0008-ap-key-relationships(id, name)
            ),
            withdrawal_notes:0008-ap-universal-notes-join(
              note:0008-ap-notes(id, content, created_at)
            )
          `)
          .eq('user_id', user.id)
          .eq('0008-ap-universal-roles-join.parent_type', 'withdrawal')
          .eq('0008-ap-universal-domains-join.parent_type', 'withdrawal')
          .eq('0008-ap-universal-key-relationships-join.parent_type', 'withdrawal')
          .eq('0008-ap-universal-notes-join.parent_type', 'withdrawal');

        // Apply scope filtering at database level
        if (scope.type !== 'user' && scope.id) {
          switch (scope.type) {
            case 'role':
              withdrawalsQuery = withdrawalsQuery.eq('0008-ap-universal-roles-join.role_id', scope.id);
              break;
            case 'key_relationship':
              withdrawalsQuery = withdrawalsQuery.eq('0008-ap-universal-key-relationships-join.key_relationship_id', scope.id);
              break;
            case 'domain':
              withdrawalsQuery = withdrawalsQuery.eq('0008-ap-universal-domains-join.domain_id', scope.id);
              break;
          }
        }

        if (dateFilter) {
          withdrawalsQuery = withdrawalsQuery.gte('withdrawn_at', dateFilter);
        }

        const { data: withdrawalsData, error: withdrawalsError } = await withdrawalsQuery;
        if (withdrawalsError) {
          console.error('Withdrawals query error:', withdrawalsError);
          // Continue without withdrawals if query fails
        } else if (withdrawalsData) {
          for (const withdrawal of withdrawalsData) {
            // Transform nested data to flat structure
            const withdrawalWithData = {
              ...withdrawal,
              roles: withdrawal.withdrawal_roles?.map(wr => wr.role).filter(Boolean) || [],
              domains: withdrawal.withdrawal_domains?.map(wd => wd.domain).filter(Boolean) || [],
              keyRelationships: withdrawal.withdrawal_key_relationships?.map(wkr => wkr.key_relationship).filter(Boolean) || [],
            };

            const hasNotes = withdrawal.withdrawal_notes && withdrawal.withdrawal_notes.length > 0;

            journalEntries.push({
              id: withdrawal.id,
              date: withdrawal.withdrawn_at,
              description: withdrawal.title,
              type: 'withdrawal',
              amount: parseFloat(withdrawal.amount.toString()),
              balance: 0, // Will be calculated later
              has_notes: hasNotes,
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
      // Fall back to simple approach if optimized query fails
      await fetchJournalEntriesSimple();
    } finally {
      setLoading(false);
    }
  };

  // Fallback method using the original approach if optimized queries fail
  const fetchJournalEntriesSimple = async () => {
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

      // Fetch deposits (completed tasks/events) - simplified version
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

          const [
            { data: rolesData },
            { data: domainsData },
            { data: notesData }
          ] = await Promise.all([
            supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIds).eq('parent_type', 'task')
          ]);

          // Apply scope filtering
          let scopeFilteredTaskIds = taskIds;
          if (scope.type !== 'user' && scope.id) {
            switch (scope.type) {
              case 'role':
                scopeFilteredTaskIds = rolesData?.filter(r => r.role?.id === scope.id).map(r => r.parent_id) || [];
                break;
              case 'domain':
                scopeFilteredTaskIds = domainsData?.filter(d => d.domain?.id === scope.id).map(d => d.parent_id) || [];
                break;
            }
          }

          const tasksWithNotes = new Set(notesData?.map(n => n.parent_id) || []);
          const scopedTasks = tasksData.filter(task => scopeFilteredTaskIds.includes(task.id));
          
          for (const task of scopedTasks) {
            const taskWithData = {
              ...task,
              roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
              domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
            };

            const points = calculateTaskPoints(taskWithData);
            journalEntries.push({
              id: task.id,
              date: task.completed_at?.split('T')[0] || task.due_date,
              description: task.title,
              type: 'deposit',
              amount: points,
              balance: 0,
              has_notes: tasksWithNotes.has(task.id),
              source_id: task.id,
              source_type: 'task',
              source_data: taskWithData,
            });
          }
        }
      }

      // Fetch withdrawals - simplified version
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
          for (const withdrawal of withdrawalsData) {
            journalEntries.push({
              id: withdrawal.id,
              date: withdrawal.withdrawn_at,
              description: withdrawal.title,
              type: 'withdrawal',
              amount: parseFloat(withdrawal.amount.toString()),
              balance: 0,
              has_notes: false,
              source_id: withdrawal.id,
              source_type: 'withdrawal',
              source_data: withdrawal,
            });
          }
        }
      }

      // Sort by date and calculate running balance
      journalEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      let runningBalance = 0;
      const chronologicalEntries = [...journalEntries].reverse();
      for (const entry of chronologicalEntries) {
        if (entry.type === 'deposit') {
          runningBalance += entry.amount;
        } else {
          runningBalance -= entry.amount;
        }
      }
      
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
      console.error('Error in fallback journal fetch:', error);
      Alert.alert('Error', (error as Error).message);
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
    backgroundColor: '#f1f5f9',
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