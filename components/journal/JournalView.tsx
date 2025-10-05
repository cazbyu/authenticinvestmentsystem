import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FileText, Plus } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

interface JournalEntry {
  id: string;
  date: string; // completed_at (task) or withdrawn_at (withdrawal)
  description: string;
  type: 'deposit' | 'withdrawal';
  amount: number; // deposit points or withdrawal amount
  balance: number; // running balance
  has_notes: boolean;
  source_id: string; // task_id or withdrawal_id
  source_type: 'task' | 'withdrawal';
  source_data?: any;
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
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const fetchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const previousScopeRef = React.useRef<string>('');

  // --- deterministic, simple points so deposits are not 0.0 ---
  const calculateTaskPoints = (task: any) => {
    const roleCount = Array.isArray(task?.roles) ? task.roles.length : 0;
    const domainCount = Array.isArray(task?.domains) ? task.domains.length : 0;
    const base = 1;      // every completed task is at least 1 point
    const perRole = 1;   // +1 per role
    const perDomain = 0.5; // +0.5 per domain
    return base + roleCount * perRole + domainCount * perDomain;
  };

  // helper to group records by parent_id for fast lookup
  const groupByParentId = <T extends { parent_id: string }>(rows: T[] | null | undefined) => {
    const map = new Map<string, T[]>();
    (rows ?? []).forEach((r) => {
      const arr = map.get(r.parent_id) ?? [];
      arr.push(r);
      map.set(r.parent_id, arr);
    });
    return map;
  };

  // calculate start date for the range filter (YYYY-MM-DD)
  const getDateFilter = (): string | '' => {
    if (dateRange === 'all') return '';
    const now = new Date();
    const days = dateRange === 'week' ? 7 : 30;
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return since.toISOString().split('T')[0];
  };

  const fetchJournalEntries = async () => {
    // Create new AbortController for this fetch
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setEntries([]);
        setTotalBalance(0);
        setLoading(false);
        return;
      }

      // Check if aborted
      if (controller.signal.aborted) {
        return;
      }

      const dateFilter = getDateFilter();
      const journalEntries: JournalEntry[] = [];

      // ---------------------------------------------------------
      // 1) Deposits = completed tasks
      // ---------------------------------------------------------
      if (filter === 'all' || filter === 'deposits') {
        let tasksQuery = supabase
          .from('0008-ap-tasks')
          .select('id, title, completed_at')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .not('completed_at', 'is', null);

        if (dateFilter) {
          tasksQuery = tasksQuery.gte('completed_at', dateFilter);
        }

        const { data: tasksData, error: tasksError } = await tasksQuery;
        if (tasksError) {
          console.error('Tasks query error:', tasksError);
          throw tasksError;
        }

        if (tasksData && tasksData.length) {
          const taskIds = tasksData.map((t: any) => t.id);

          // pull role/domain/keyRel/notes/goals for these tasks
          const [
            rolesRes,
            domainsRes,
            keyRelsRes,
            notesRes,
            goalsRes,
          ] = await Promise.all([
            supabase
              .from('0008-ap-universal-roles-join')
              .select('parent_id, role_id, role:0008-ap-roles(id,label)')
              .in('parent_id', taskIds)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-domains-join')
              .select('parent_id, domain_id, domain:0008-ap-domains(id,name)')
              .in('parent_id', taskIds)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-key-relationships-join')
              .select('parent_id, key_relationship_id, key_relationship:0008-ap-key-relationships(id,name)')
              .in('parent_id', taskIds)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-notes-join')
              .select('parent_id, note:0008-ap-notes(id,content,created_at)')
              .in('parent_id', taskIds)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-goals-join')
              .select(`
                parent_id,
                goal_type,
                twelve_wk_goal_id,
                custom_goal_id,
                tw:0008-ap-goals-12wk(id,title),
                cg:0008-ap-goals-custom(id,title)
              `)
              .in('parent_id', taskIds)
              .eq('parent_type', 'task'),
          ]);

          const taskRoles = rolesRes.data ?? [];
          const taskDomains = domainsRes.data ?? [];
          const taskKeyRels = keyRelsRes.data ?? [];
          const taskNotes = notesRes.data ?? [];
          const taskGoals = goalsRes.data ?? [];

          // scope filter for tasks (role/domain/key_relationship)
          let allowedTaskIds = new Set(taskIds);
          if (scope.type !== 'user' && scope.id) {
            if (scope.type === 'role') {
              allowedTaskIds = new Set(
                taskRoles
                  .filter((r: any) => r.role?.id === scope.id || r.role_id === scope.id)
                  .map((r: any) => r.parent_id)
              );
            } else if (scope.type === 'domain') {
              allowedTaskIds = new Set(
                taskDomains
                  .filter((d: any) => d.domain?.id === scope.id || d.domain_id === scope.id)
                  .map((d: any) => d.parent_id)
              );
            } else if (scope.type === 'key_relationship') {
              allowedTaskIds = new Set(
                taskKeyRels
                  .filter((k: any) => k.key_relationship?.id === scope.id || k.key_relationship_id === scope.id)
                  .map((k: any) => k.parent_id)
              );
            }
          }

          // index lookups
          const rolesByTask = groupByParentId(taskRoles);
          const domainsByTask = groupByParentId(taskDomains);
          const keyRelsByTask = groupByParentId(taskKeyRels);
          const notesByTask = groupByParentId(taskNotes);
          const goalsByTask = groupByParentId(taskGoals);

          for (const t of tasksData) {
            if (!allowedTaskIds.has(t.id)) continue;

            const roles = (rolesByTask.get(t.id) ?? []).map((r: any) => r.role).filter(Boolean);
            const domains = (domainsByTask.get(t.id) ?? []).map((d: any) => d.domain).filter(Boolean);
            const keyRelationships = (keyRelsByTask.get(t.id) ?? [])
              .map((k: any) => k.key_relationship)
              .filter(Boolean);
            const notes = (notesByTask.get(t.id) ?? []).map((n: any) => n.note).filter(Boolean);
            const goals = (goalsByTask.get(t.id) ?? []).map((g: any) => {
              if (g.goal_type === 'twelve_wk_goal') return { type: '12wk', id: g.tw?.id, title: g.tw?.title };
              if (g.goal_type === 'custom_goal') return { type: 'custom', id: g.cg?.id, title: g.cg?.title };
              // fallback if goal_type isn't set but IDs exist:
              if (g.tw?.id) return { type: '12wk', id: g.tw.id, title: g.tw.title };
              if (g.cg?.id) return { type: 'custom', id: g.cg.id, title: g.cg.title };
              return null;
            }).filter(Boolean);

            const source_data = { ...t, roles, domains, keyRelationships, notes, goals };
            const points = calculateTaskPoints({ roles, domains });

            journalEntries.push({
              id: t.id,
              date: t.completed_at, // <-- completed_at for tasks
              description: t.title,
              type: 'deposit',
              amount: points,
              balance: 0,
              has_notes: notes.length > 0,
              source_id: t.id,
              source_type: 'task',
              source_data,
            });
          }
        }
      }

      // ---------------------------------------------------------
      // 2) Withdrawals
      // ---------------------------------------------------------
      if (filter === 'all' || filter === 'withdrawals') {
        let withdrawalsQuery = supabase
          .from('0008-ap-withdrawals')
          .select('id, title, amount, withdrawn_at, user_id')
          .eq('user_id', user.id);

        if (dateFilter) {
          withdrawalsQuery = withdrawalsQuery.gte('withdrawn_at', dateFilter);
        }

        const { data: withdrawalsData, error: withdrawalsError } = await withdrawalsQuery;
        if (withdrawalsError) {
          console.error('Withdrawals query error:', withdrawalsError);
          throw withdrawalsError;
        }

        if (withdrawalsData && withdrawalsData.length) {
          const wIds = withdrawalsData.map((w: any) => w.id);

          const [wRolesRes, wDomainsRes, wKeyRelsRes, wNotesRes] = await Promise.all([
            supabase
              .from('0008-ap-universal-roles-join')
              .select('parent_id, role_id, role:0008-ap-roles(id,label)')
              .in('parent_id', wIds)
              .eq('parent_type', 'withdrawal'),
            supabase
              .from('0008-ap-universal-domains-join')
              .select('parent_id, domain_id, domain:0008-ap-domains(id,name)')
              .in('parent_id', wIds)
              .eq('parent_type', 'withdrawal'),
            supabase
              .from('0008-ap-universal-key-relationships-join')
              .select('parent_id, key_relationship_id, key_relationship:0008-ap-key-relationships(id,name)')
              .in('parent_id', wIds)
              .eq('parent_type', 'withdrawal'),
            supabase
              .from('0008-ap-universal-notes-join')
              .select('parent_id, note:0008-ap-notes(id,content,created_at)')
              .in('parent_id', wIds)
              .eq('parent_type', 'withdrawal'),
          ]);

          const wRoles = wRolesRes.data ?? [];
          const wDomains = wDomainsRes.data ?? [];
          const wKeyRels = wKeyRelsRes.data ?? [];
          const wNotes = wNotesRes.data ?? [];

          // scope filter for withdrawals
          let allowedWids = new Set(wIds);
          if (scope.type !== 'user' && scope.id) {
            if (scope.type === 'role') {
              allowedWids = new Set(
                wRoles
                  .filter((r: any) => r.role?.id === scope.id || r.role_id === scope.id)
                  .map((r: any) => r.parent_id)
              );
            } else if (scope.type === 'domain') {
              allowedWids = new Set(
                wDomains
                  .filter((d: any) => d.domain?.id === scope.id || d.domain_id === scope.id)
                  .map((d: any) => d.parent_id)
              );
            } else if (scope.type === 'key_relationship') {
              allowedWids = new Set(
                wKeyRels
                  .filter((k: any) => k.key_relationship?.id === scope.id || k.key_relationship_id === scope.id)
                  .map((k: any) => k.parent_id)
              );
            }
          }

          const rolesByW = groupByParentId(wRoles);
          const domainsByW = groupByParentId(wDomains);
          const keyRelsByW = groupByParentId(wKeyRels);
          const notesByW = groupByParentId(wNotes);

          for (const w of withdrawalsData) {
            if (!allowedWids.has(w.id)) continue;

            const roles = (rolesByW.get(w.id) ?? []).map((r: any) => r.role).filter(Boolean);
            const domains = (domainsByW.get(w.id) ?? []).map((d: any) => d.domain).filter(Boolean);
            const keyRelationships = (keyRelsByW.get(w.id) ?? [])
              .map((k: any) => k.key_relationship)
              .filter(Boolean);
            const notes = (notesByW.get(w.id) ?? []).map((n: any) => n.note).filter(Boolean);
            const amountNum = parseFloat(String(w.amount ?? 0)) || 0;

            journalEntries.push({
              id: w.id,
              date: w.withdrawn_at, // <-- withdrawn_at for withdrawals
              description: w.title,
              type: 'withdrawal',
              amount: amountNum,
              balance: 0,
              has_notes: notes.length > 0,
              source_id: w.id,
              source_type: 'withdrawal',
              source_data: { ...w, roles, domains, keyRelationships, notes },
            });
          }
        }
      }

      // ---------------------------------------------------------
      // 3) Sort & compute running balance
      // ---------------------------------------------------------
      journalEntries.sort((a, b) => {
        const ta = new Date(a.date).getTime();
        const tb = new Date(b.date).getTime();
        return tb - ta;
      });

      // compute balance across time (oldest->newest), then assign (newest-first view)
      let runningBalance = 0;
      const chronological = [...journalEntries].reverse();
      chronological.forEach((e) => {
        if (e.type === 'deposit') runningBalance += e.amount;
        else runningBalance -= e.amount;
      });

      let current = runningBalance;
      journalEntries.forEach((e) => {
        e.balance = current;
        if (e.type === 'deposit') current -= e.amount;
        else current += e.amount;
      });

      // Final abort check before setting state
      if (controller.signal.aborted) {
        return;
      }

      setEntries(journalEntries);
      setTotalBalance(runningBalance);
    } catch (err: any) {
      // Don't show errors if request was aborted
      if (controller.signal.aborted) {
        return;
      }
      console.error('Error fetching journal entries:', err);
      Alert.alert('Error loading journal', err?.message ?? String(err));
      setEntries([]);
      setTotalBalance(0);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Create a stable scope key for comparison
    const scopeKey = JSON.stringify(scope);

    // Only fetch if scope actually changed
    if (scopeKey === previousScopeRef.current && !filter && !dateRange) {
      return;
    }

    previousScopeRef.current = scopeKey;

    // Clear any pending fetch timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Debounce the fetch to prevent rapid consecutive calls
    fetchTimeoutRef.current = setTimeout(() => {
      fetchJournalEntries();
    }, 300);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, filter, dateRange]);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const formatBalance = (balance: number) => {
    const prefix = balance >= 0 ? '+' : '';
    return `${prefix}${balance.toFixed(1)}`;
  };

  const getBalanceColor = (balance: number) => (balance >= 0 ? '#16a34a' : '#dc2626');

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
                  style={[styles.filterButton, filter === filterOption && styles.activeFilterButton]}
                  onPress={() => setFilter(filterOption)}
                >
                  <Text style={[styles.filterButtonText, filter === filterOption && styles.activeFilterButtonText]}>
                    {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.filterGroup}>
              {(['week', 'month', 'all'] as const).map((rangeOption) => (
                <TouchableOpacity
                  key={rangeOption}
                  style={[styles.filterButton, dateRange === rangeOption && styles.activeFilterButton]}
                  onPress={() => setDateRange(rangeOption)}
                >
                  <Text style={[styles.filterButtonText, dateRange === rangeOption && styles.activeFilterButtonText]}>
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
              style={[styles.journalRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}
              onPress={() => onEntryPress(entry)}
            >
              <Text style={styles.cellDate}>{formatDate(entry.date)}</Text>
              <Text style={styles.cellDescription} numberOfLines={2}>
                {entry.description}
              </Text>
              <View style={styles.cellNotes}>{entry.has_notes && <FileText size={14} color="#6b7280" />}</View>
              <Text style={styles.cellDeposit}>
                {entry.type === 'deposit' ? `+${entry.amount.toFixed(1)}` : ''}
              </Text>
              <Text style={styles.cellWithdrawal}>
                {entry.type === 'withdrawal' ? entry.amount.toFixed(1) : ''}
              </Text>
              <Text style={[styles.cellBalance, { color: getBalanceColor(entry.balance) }]}>
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
  container: { flex: 1, backgroundColor: '#ffffff' },
  filterContainer: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterRow: { flexDirection: 'column', gap: 12 },
  filterRowContent: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16 },
  filterGroup: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 8, padding: 2 },
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
  addWithdrawalText: { fontSize: 14, fontWeight: '600', color: '#dc2626' },
  filterButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  activeFilterButton: { backgroundColor: '#0078d4' },
  filterButtonText: { fontSize: 12, fontWeight: '500', color: '#6b7280' },
  activeFilterButtonText: { color: '#ffffff' },
  journalHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#d1d5db',
  },
  headerDate: { width: 70, fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'center' },
  headerDescription: { flex: 1, fontSize: 12, fontWeight: '600', color: '#374151', paddingHorizontal: 8 },
  headerNotes: { width: 40, fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'center' },
  headerDeposit: { width: 60, fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'right' },
  headerWithdrawal: { width: 70, fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'right' },
  headerBalance: { width: 70, fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'right' },
  journalContent: { flex: 1 },
  journalRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  evenRow: { backgroundColor: '#ffffff' },
  oddRow: { backgroundColor: '#f1f5f9' },
  cellDate: { width: 70, fontSize: 12, color: '#374151', textAlign: 'center' },
  cellDescription: { flex: 1, fontSize: 14, color: '#1f2937', paddingHorizontal: 8, lineHeight: 18 },
  cellNotes: { width: 40, alignItems: 'center', justifyContent: 'center' },
  cellDeposit: { width: 60, fontSize: 14, fontWeight: '600', color: '#16a34a', textAlign: 'right' },
  cellWithdrawal: { width: 70, fontSize: 14, fontWeight: '600', color: '#dc2626', textAlign: 'right' },
  cellBalance: { width: 70, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: '#6b7280', fontSize: 16 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#6b7280', fontSize: 16, textAlign: 'center' },
});
