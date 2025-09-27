import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Calendar } from 'react-native-calendars'; // Optional: keep only if you want full calendar UI here
import { X, Repeat } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

// ⬇️ If your ActionEffortModal lives elsewhere, update this path
import ActionEffortModal from './ActionEffortModal';

// ------------ Types & Models ------------
type SchedulingType = 'task' | 'event' | 'depositIdea' | 'withdrawal';

interface Role { id: string; label: string; color?: string; }
interface Domain { id: string; name: string; }
interface KeyRelationship { id: string; name: string; role_id: string; }

interface UnifiedGoal {
  id: string;
  title: string;
  description?: string;
  roles?: Role[];
  domains?: Domain[];
  keyRelationships?: KeyRelationship[];
  goal_type: '12week' | 'custom';
}

interface CycleWeek {
  week_number: number;
  week_start: string;
  week_end: string;
  user_global_timeline_id?: string;
  user_custom_timeline_id?: string;
}

interface FormData {
  schedulingType: SchedulingType;

  // Common
  title: string;
  notes?: string;

  // Toggles (Task)
  urgent: boolean;
  important: boolean;
  authenticDeposit: boolean;
  goalToggle: boolean;

  // Dates / Times (Task & Event)
  dueDate?: Date;            // Task
  completeBy?: Date;         // Task
  startDate?: Date;          // Event
  endDate?: Date;            // Event

  // Links
  roles: string[];           // ids
  domains: string[];         // ids
  keyRelationships: string[];// ids

  // Goal selection
  selectedGoal?: UnifiedGoal;

  // Recurrence (stored as RRULE when saving)
  recurrenceRule?: string;

  // Withdrawal
  withdrawalDate?: Date;
  withdrawalScore?: number;
}

// ------------ Component ------------
export default function TaskEventForm({ mode = 'create', initialData }: { mode?: 'create' | 'edit'; initialData?: any }) {
  // UI & refs
  const scrollRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Options fetched from DB
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [availableDomains, setAvailableDomains] = useState<Domain[]>([]);
  const [availableKeyRelationships, setAvailableKeyRelationships] = useState<KeyRelationship[]>([]);
  const [availableGoals, setAvailableGoals] = useState<UnifiedGoal[]>([]);
  const [cycleWeeks, setCycleWeeks] = useState<CycleWeek[]>([]); // if you want to show weeks like the modal

  // Goal Mode (when a goal is selected + goalToggle true)
  const [goalMode, setGoalMode] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    schedulingType: 'task',
    title: '',
    notes: '',
    urgent: false,
    important: false,
    authenticDeposit: false,
    goalToggle: false,
    roles: [],
    domains: [],
    keyRelationships: [],
  });

  // ------------ Effects ------------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await Promise.all([
          fetchRoles(),
          fetchDomains(),
          fetchKeyRelationships(),
          fetchGoalsUnified(),
          fetchCycleWeeks(), // optional: only if you plan to show week planning inline or in modal
        ]);
        if (mode === 'edit' && initialData) {
          preloadForm(initialData);
        }
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Failed to load form data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, initialData]);

  // Flip goal mode when a goal is chosen while goal toggle is ON
  useEffect(() => {
    const enabled = !!formData.goalToggle && !!formData.selectedGoal;
    setGoalMode(enabled);
    if (enabled) {
      // Prefill from goal
      const g = formData.selectedGoal!;
      setFormData(prev => ({
        ...prev,
        title: prev.title || g.title || '',
        roles: g.roles?.map(r => r.id) ?? prev.roles,
        domains: g.domains?.map(d => d.id) ?? prev.domains,
        keyRelationships: g.keyRelationships?.map(k => k.id) ?? prev.keyRelationships,
      }));
      // Open the ActionEffortModal to capture weeks/frequency (reusing proven logic)
      setGoalModalVisible(true);
      // Optionally scroll to bottom to show goal area controls
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [formData.goalToggle, formData.selectedGoal]);

  // ------------ Fetchers ------------
  async function fetchRoles() {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('0008-ap-roles')
      .select('id, label, color')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('label');
    setAvailableRoles(data || []);
  }

  async function fetchDomains() {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('0008-ap-domains')
      .select('id, name')
      .order('name');
    setAvailableDomains(data || []);
  }

  async function fetchKeyRelationships() {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('0008-ap-key-relationships')
      .select('id, name, role_id')
      .eq('user_id', user.id);
    setAvailableKeyRelationships(data || []);
  }

  async function fetchGoalsUnified() {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 12-week
    const { data: tw } = await supabase
      .from('0008-ap-goals-12wk')
      .select('id, title')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('title');

    // Custom
    const { data: cg } = await supabase
      .from('0008-ap-goals-custom')
      .select('id, title')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('title');

    const unified: UnifiedGoal[] = [
      ...(tw || []).map(g => ({ ...g, goal_type: '12week' as const })),
      ...(cg || []).map(g => ({ ...g, goal_type: 'custom' as const })),
    ];
    setAvailableGoals(unified);
  }

  // If you want to show/select weeks like ActionEffortModal
  async function fetchCycleWeeks() {
    // TODO: Replace with your real timeline fetch
    // For now we’ll just create 12 numbered weeks.
    const fakeWeeks: CycleWeek[] = Array.from({ length: 12 }, (_, i) => ({
      week_number: i + 1,
      week_start: '',
      week_end: '',
    }));
    setCycleWeeks(fakeWeeks);
  }

  // ------------ Preload (Edit Mode) ------------
  function preloadForm(data: any) {
    // TODO: map your incoming record to FormData if editing
    setFormData(prev => ({
      ...prev,
      title: data.title || '',
      notes: data.notes || '',
      // set other fields...
    }));
  }

  // ------------ Helpers ------------
  function defaultEventTimes() {
    // Start ~ now (rounded to next 15 minutes), end 1 hour later
    const start = new Date();
    const minutes = start.getMinutes();
    const roundUp = (Math.ceil(minutes / 15) * 15) % 60;
    start.setMinutes(roundUp, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { start, end };
  }

  function toggleArraySelection(arr: string[], id: string) {
    return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
  }

  const filteredKeyRelationships = availableKeyRelationships.filter(kr =>
    formData.roles.includes(kr.role_id)
  );

  // ------------ Goal selection ------------
  async function handleGoalPick(id: string) {
    const base = availableGoals.find(g => g.id === id);
    if (!base) return;

    // Fetch full goal detail (roles/domains/keyRelationships) if not already present
    const supabase = getSupabaseClient();
    const table = base.goal_type === '12week' ? '0008-ap-goals-12wk' : '0008-ap-goals-custom';

    // NOTE: Adjust to your schema if join views differ.
    // Minimal fetch (id, title) shown above; here we assume you have join helpers or can stitch manually later.
    // For now, we’ll just set the base (title) and let ActionEffortModal handle associations visually.
    setFormData(prev => ({ ...prev, selectedGoal: base }));
  }

  // ------------ Save ------------
  async function handleSave() {
    try {
      setSaving(true);
      // Validate minimal fields
      if (!formData.title?.trim()) {
        Alert.alert('Validation', 'Please enter a title.');
        return;
      }

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'No user.');
        return;
      }

      // Branch by type
      if (formData.schedulingType === 'task') {
        // TODO: Insert into your tasks table
        // Example:
        // const { data: task, error } = await supabase
        //   .from('0007-ap-tasks')
        //   .insert({
        //     user_id: user.id,
        //     title: formData.title.trim(),
        //     notes: formData.notes || null,
        //     urgent: formData.urgent,
        //     important: formData.important,
        //     authentic_deposit: formData.authenticDeposit,
        //     due_at: formData.dueDate ?? null,
        //     complete_by: formData.completeBy ?? null,
        //     recurrence_rule: formData.recurrenceRule ?? null,
        //     twelve_wk_goal_id: formData.selectedGoal?.goal_type === '12week' ? formData.selectedGoal.id : null,
        //     custom_goal_id: formData.selectedGoal?.goal_type === 'custom' ? formData.selectedGoal.id : null,
        //   })
        //   .select()
        //   .single();

        // TODO: insert role/domain/keyRelationship join rows for the new task
        // TODO: add to calendar if you store tasks on calendar

      } else if (formData.schedulingType === 'event') {
        // Default event times if missing
        const { start, end } = defaultEventTimes();
        const startAt = formData.startDate ?? start;
        const endAt = formData.endDate ?? end;

        // TODO: Insert into your events table and calendar
        // TODO: Insert joins

      } else if (formData.schedulingType === 'depositIdea') {
        // TODO: Insert into 0008-ap-deposit-ideas (title, notes, roles/domains/notes join)
      } else if (formData.schedulingType === 'withdrawal') {
        // TODO: Insert into withdrawals table with date + score + joins
      }

      Alert.alert('Success', 'Saved successfully.');
      // TODO: navigate back or close modal
    } catch (e) {
      console.error(e);
      Alert.alert('Error', (e as Error).message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  // ------------ Render ------------
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{mode === 'edit' ? 'Edit' : 'New'} Item</Text>
        <TouchableOpacity onPress={() => {/* TODO: close navigation */}} style={{ padding: 8 }}>
          <X size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {/* Type Selector */}
        <View style={styles.typeRow}>
          {(['task','event','depositIdea','withdrawal'] as SchedulingType[]).map(type => {
            const active = formData.schedulingType === type;
            return (
              <TouchableOpacity
                key={type}
                onPress={() => setFormData(prev => ({ ...prev, schedulingType: type }))}
                style={[styles.typeChip, active && styles.typeChipActive]}
              >
                <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                  {type === 'depositIdea' ? 'Deposit Idea' : type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={(t) => setFormData(prev => ({ ...prev, title: t }))}
            placeholder="What do you want to do?"
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Task-only Toggles */}
        {formData.schedulingType === 'task' && (
          <View style={styles.field}>
            <Text style={styles.label}>Task Toggles</Text>
            <View style={styles.toggleRow}>
              <Toggle label="Urgent" value={formData.urgent} onChange={(v) => setFormData(p => ({ ...p, urgent: v }))} />
              <Toggle label="Important" value={formData.important} onChange={(v) => setFormData(p => ({ ...p, important: v }))} />
              <Toggle label="Authentic Deposit" value={formData.authenticDeposit} onChange={(v) => setFormData(p => ({ ...p, authenticDeposit: v }))} />
              <Toggle label="Goal" value={formData.goalToggle} onChange={(v) => setFormData(p => ({ ...p, goalToggle: v }))} />
            </View>

            {/* Goal picker (shows when Goal toggle ON) */}
            {formData.goalToggle && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.subLabel}>Select Goal</Text>
                <View style={styles.goalPickerRow}>
                  {availableGoals.length === 0 ? (
                    <Text style={{ color: '#6b7280' }}>No active goals</Text>
                  ) : (
                    availableGoals.map(g => {
                      const active = formData.selectedGoal?.id === g.id;
                      return (
                        <TouchableOpacity
                          key={`${g.goal_type}-${g.id}`}
                          style={[styles.goalChip, active && styles.goalChipActive]}
                          onPress={() => handleGoalPick(g.id)}
                        >
                          <Text style={[styles.goalChipText, active && styles.goalChipTextActive]}>
                            {g.title} {g.goal_type === '12week' ? '• 12wk' : '• Custom'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Dates & Recurrence */}
        {formData.schedulingType === 'task' && (
          <>
            <View style={styles.fieldRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Due Date</Text>
                {/* TODO: replace with your date picker */}
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={formData.dueDate ? formData.dueDate.toISOString().slice(0,10) : ''}
                  onChangeText={() => {}}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Complete By</Text>
                {/* TODO: time picker */}
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM"
                  value={formData.completeBy ? formData.completeBy.toLocaleTimeString() : ''}
                  onChangeText={() => {}}
                />
              </View>
            </View>

            {/* Recurrence (simple placeholder; ActionEffortModal handles advanced) */}
            <View style={styles.field}>
              <Text style={styles.label}>Repeat</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Repeat size={18} color="#4b5563" />
                <Text style={{ color: '#4b5563' }}>Set in Action Effort (opens when a goal is selected)</Text>
              </View>
            </View>
          </>
        )}

        {formData.schedulingType === 'event' && (
          <View style={{ gap: 12 }}>
            <Text style={styles.label}>Event Timing</Text>
            {/* TODO: Replace placeholders with proper pickers */}
            <TextInput
              style={styles.input}
              placeholder="Start (YYYY-MM-DD HH:mm)"
              value={formData.startDate ? formData.startDate.toISOString() : ''}
              onChangeText={() => {}}
            />
            <TextInput
              style={styles.input}
              placeholder="End (YYYY-MM-DD HH:mm)"
              value={formData.endDate ? formData.endDate.toISOString() : ''}
              onChangeText={() => {}}
            />
          </View>
        )}

        {formData.schedulingType === 'depositIdea' && (
          <View style={styles.field}>
            <Text style={styles.label}>Idea (no time)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(t) => setFormData(prev => ({ ...prev, notes: t }))}
              placeholder="Describe your deposit idea"
              multiline
            />
          </View>
        )}

        {formData.schedulingType === 'withdrawal' && (
          <View style={{ gap: 12 }}>
            <Text style={styles.label}>Withdrawal</Text>
            {/* Date */}
            <TextInput
              style={styles.input}
              placeholder="Date (YYYY-MM-DD)"
              value={formData.withdrawalDate ? formData.withdrawalDate.toISOString().slice(0,10) : ''}
              onChangeText={() => {}}
            />
            {/* Score */}
            <TextInput
              style={styles.input}
              placeholder="Score"
              keyboardType="numeric"
              value={formData.withdrawalScore ? String(formData.withdrawalScore) : ''}
              onChangeText={(t) => setFormData(prev => ({ ...prev, withdrawalScore: Number(t) || undefined }))}
            />
          </View>
        )}

        {/* Roles */}
        <View style={styles.field}>
          <Text style={styles.label}>Roles</Text>
          <View style={styles.checkboxGrid}>
            {availableRoles.map(role => {
              const selected = formData.roles.includes(role.id);
              return (
                <TouchableOpacity
                  key={role.id}
                  style={styles.checkItem}
                  onPress={() => setFormData(prev => ({ ...prev, roles: toggleArraySelection(prev.roles, role.id) }))}
                >
                  <View style={[styles.checkbox, selected && styles.checkedBox]}>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkLabel}>{role.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Domains */}
        <View style={styles.field}>
          <Text style={styles.label}>Domains</Text>
          <View style={styles.checkboxGrid}>
            {availableDomains.map(d => {
              const selected = formData.domains.includes(d.id);
              return (
                <TouchableOpacity
                  key={d.id}
                  style={styles.checkItem}
                  onPress={() => setFormData(prev => ({ ...prev, domains: toggleArraySelection(prev.domains, d.id) }))}
                >
                  <View style={[styles.checkbox, selected && styles.checkedBox]}>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkLabel}>{d.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Key Relationships (filtered by roles) */}
        {filteredKeyRelationships.length > 0 && (
          <View style={styles.field}>
            <Text style={styles.label}>Key Relationships</Text>
            <View style={styles.checkboxGrid}>
              {filteredKeyRelationships.map(kr => {
                const selected = formData.keyRelationships.includes(kr.id);
                return (
                  <TouchableOpacity
                    key={kr.id}
                    style={styles.checkItem}
                    onPress={() => setFormData(prev => ({ ...prev, keyRelationships: toggleArraySelection(prev.keyRelationships, kr.id) }))}
                  >
                    <View style={[styles.checkbox, selected && styles.checkedBox]}>
                      {selected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkLabel}>{kr.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Notes */}
        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.notes}
            onChangeText={(t) => setFormData(prev => ({ ...prev, notes: t }))}
            placeholder="Add details…"
            multiline
          />
        </View>

        {/* Footer */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => {/* TODO: close */}} disabled={saving}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* GOAL MODE — Reuse ActionEffortModal */}
      {goalMode && formData.selectedGoal && (
        <ActionEffortModal
          visible={goalModalVisible}
          onClose={() => setGoalModalVisible(false)}
          goal={formData.selectedGoal}
          cycleWeeks={cycleWeeks}
          // This function comes from your modal contract: create a task + week plan from the modal’s collected fields
          createTaskWithWeekPlan={async (payload) => {
            // 🔗 You can either:
            //  A) create a task immediately here (modal-driven flow), OR
            //  B) store parts on formData and wait for the main Save button.
            // For A), insert your Supabase logic here:
            // - Use payload.title / description / recurrenceRule
            // - Link goal using goal_type in payload
            // - Insert joins for roles/domains/keyRelationships
            // - Insert week plans with selectedWeeks & targetDays
            // Then refresh UI or close.
            // For B), do setFormData(prev => ({ ...prev, recurrenceRule: payload.recurrenceRule, ... })) etc.
            setFormData(prev => ({
              ...prev,
              title: payload.title ?? prev.title,
              notes: payload.description ?? prev.notes,
              roles: payload.selectedRoleIds ?? prev.roles,
              domains: payload.selectedDomainIds ?? prev.domains,
              keyRelationships: payload.selectedKeyRelationshipIds ?? prev.keyRelationships,
              recurrenceRule: payload.recurrenceRule ?? prev.recurrenceRule,
            }));
            return true;
          }}
          // Optional: if you support editing/deleting actions from here
          onDelete={undefined}
          initialData={undefined}
          mode="create"
        />
      )}
    </View>
  );
}

// ------------ Small Presentational Toggle ------------
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleItem}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

// ------------ Styles ------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  content: { padding: 16 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 8, color: '#6b7280' },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff',
  },
  typeChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  typeChipText: { color: '#374151', fontWeight: '500' },
  typeChipTextActive: { color: '#fff' },

  field: { marginBottom: 20 },
  subLabel: { fontSize: 14, color: '#374151', marginBottom: 6 },
  label: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, color: '#111827',
  },
  textArea: { height: 100, textAlignVertical: 'top' },

  fieldRow: { flexDirection: 'row', gap: 12 },

  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  toggleItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
  },
  toggleLabel: { color: '#111827', fontWeight: '500' },

  goalPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9999,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff',
  },
  goalChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  goalChipText: { color: '#374151', fontWeight: '500' },
  goalChipTextActive: { color: '#fff' },

  checkboxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  checkItem: { flexDirection: 'row', alignItems: 'center', width: '48%' },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 3, marginRight: 8,
    justifyContent: 'center', alignItems: 'center' },
  checkedBox: { backgroundColor: '#0078d4', borderColor: '#0078d4' },
  checkmark: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  checkLabel: { color: '#111827' },

  actions: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 24 },
  cancelButton: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db',
    paddingVertical: 12, borderRadius: 8, alignItems: 'center',
  },
  cancelButtonText: { color: '#374151', fontWeight: '600' },
  saveButton: { flex: 1, backgroundColor: '#0078d4', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveButtonDisabled: { backgroundColor: '#9ca3af' },
  saveButtonText: { color: '#fff', fontWeight: '700', paddingVertical: 12 },
});
