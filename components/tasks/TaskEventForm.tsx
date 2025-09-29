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
import { Calendar } from 'react-native-calendars';
import { Calendar } from 'react-native-calendars'; // Optional: keep only if you want full calendar UI here
import { X, Repeat } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

// ⬇️ If your ActionEffortModal lives elsewhere, update this path
import ActionEffortModal from '../goals/ActionEffortModal';

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
  repeat: boolean;

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
export default function TaskEventForm({ 
  mode = 'create', 
  initialData, 
  onClose, 
  onSubmitSuccess 
}: { 
  mode?: 'create' | 'edit'; 
  initialData?: any;
  onClose?: () => void;
  onSubmitSuccess?: () => void;
}) {

  // UI & refs
  const scrollRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDueDateCalendar, setShowDueDateCalendar] = useState(false);
  const [showStartDateCalendar, setShowStartDateCalendar] = useState(false);
  const [showEndDateCalendar, setShowEndDateCalendar] = useState(false);
  const [showEndDateCalendar, setShowEndDateCalendar] = useState(false);

  // Recurrence state
  const [selectedWeeklyDays, setSelectedWeeklyDays] = useState<number[]>([]);
  const [customRecurrenceType, setCustomRecurrenceType] = useState<'biweekly' | 'monthly'>('biweekly');
  const [monthlyOption, setMonthlyOption] = useState<'date' | 'weekday'>('date');
  const [monthlyWeekday, setMonthlyWeekday] = useState<'first' | 'second' | 'third' | 'fourth' | 'last'>('first');
  const [monthlyDayOfWeek, setMonthlyDayOfWeek] = useState<number>(1); // Monday

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
    repeat: false,
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
    const enabled = !!formData.goalToggle && !!formData.selectedGoal && !!formData.repeat;
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
  }, [formData.goalToggle, formData.selectedGoal, formData.repeat]);

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
    // For now we'll just create 12 numbered weeks.
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
    // For now, we'll just set the base (title) and let ActionEffortModal handle associations visually.
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
        <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
          <X size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
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

        {/* Type Selector Pills - Centered below Title */}
        <View style={styles.pillContainer}>
          {(['task', 'event', 'depositIdea', 'withdrawal'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typePill,
                formData.schedulingType === type && styles.typePillActive
              ]}
              onPress={() => setFormData(prev => ({ ...prev, schedulingType: type }))}
            >
              <Text style={[
                styles.typePillText,
                formData.schedulingType === type && styles.typePillTextActive
              ]}>
                {type === 'depositIdea' ? 'Deposit Idea' : type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Toggle switches - 2x2 grid, centered */}
        <View style={styles.toggleSection}>
          <View style={styles.toggleGrid}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleItem}>
                <Text style={styles.toggleLabel}>Urgent</Text>
                <Switch value={formData.urgent} onValueChange={(v) => setFormData(p => ({ ...p, urgent: v }))} />
              </View>
              <View style={styles.toggleItem}>
                <Text style={styles.toggleLabel}>Important</Text>
                <Switch value={formData.important} onValueChange={(v) => setFormData(p => ({ ...p, important: v }))} />
              </View>
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleItem}>
                <Text style={styles.toggleLabel}>Authentic Deposit</Text>
                <Switch value={formData.authenticDeposit} onValueChange={(v) => setFormData(p => ({ ...p, authenticDeposit: v }))} />
              </View>
              <View style={styles.toggleItem}>
                <Text style={styles.toggleLabel}>Goal</Text>
                <Switch value={formData.goalToggle} onValueChange={(v) => setFormData(p => ({ ...p, goalToggle: v }))} />
              </View>
            </View>
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
          {/* Repeat Section for Events */}
          {formData.type === 'event' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Repeat</Text>
                <Switch
                  value={formData.isRecurring}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, isRecurring: value }))}
                  trackColor={{ false: '#f3f4f6', true: '#0078d4' }}
                  thumbColor={formData.isRecurring ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              {formData.isRecurring && (
                <View style={styles.recurringOptions}>
                  {/* Frequency Selection */}
                  <View style={styles.field}>
                    <Text style={styles.label}>Frequency</Text>
                    <View style={styles.frequencyButtons}>
                      {['daily', 'weekly', 'monthly', 'custom'].map((freq) => (
                        <TouchableOpacity
                          key={freq}
                          style={[
                            styles.frequencyButton,
                            formData.recurrenceFrequency === freq && styles.activeFrequencyButton
                          ]}
                          onPress={() => setFormData(prev => ({ ...prev, recurrenceFrequency: freq }))}
                        >
                          <Text style={[
                            styles.frequencyButtonText,
                            formData.recurrenceFrequency === freq && styles.activeFrequencyButtonText
                          ]}>
                            {freq.charAt(0).toUpperCase() + freq.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Weekly Day Selection */}
                  {formData.recurrenceFrequency === 'weekly' && (
                    <View style={styles.field}>
                      <Text style={styles.label}>Days of the week</Text>
                      <View style={styles.dayButtons}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                          <TouchableOpacity
                            key={day}
                            style={[
                              styles.dayButton,
                              formData.selectedDays.includes(index) && styles.activeDayButton
                            ]}
                            onPress={() => handleDayToggle(index)}
                          >
                            <Text style={[
                              styles.dayButtonText,
                              formData.selectedDays.includes(index) && styles.activeDayButtonText
                            ]}>
                              {day}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Custom Options */}
                  {formData.recurrenceFrequency === 'custom' && (
                    <View style={styles.field}>
                      <Text style={styles.label}>Custom Pattern</Text>
                      <View style={styles.customOptions}>
                        <TouchableOpacity
                          style={[
                            styles.customOption,
                            formData.customPattern === 'biweekly' && styles.activeCustomOption
                          ]}
                          onPress={() => setFormData(prev => ({ ...prev, customPattern: 'biweekly' }))}
                        >
                          <Text style={[
                            styles.customOptionText,
                            formData.customPattern === 'biweekly' && styles.activeCustomOptionText
                          ]}>
                            Bi-weekly
                          </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={[
                            styles.customOption,
                            formData.customPattern === 'monthly' && styles.activeCustomOption
                          ]}
                          onPress={() => setFormData(prev => ({ ...prev, customPattern: 'monthly' }))}
                        >
                          <Text style={[
                            styles.customOptionText,
                            formData.customPattern === 'monthly' && styles.activeCustomOptionText
                          ]}>
                            Monthly
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Bi-weekly Day Selection */}
                      {formData.customPattern === 'biweekly' && (
                        <View style={styles.subField}>
                          <Text style={styles.subLabel}>Select days</Text>
                          <View style={styles.dayButtons}>
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                              <TouchableOpacity
                                key={day}
                                style={[
                                  styles.dayButton,
                                  formData.selectedDays.includes(index) && styles.activeDayButton
                                ]}
                                onPress={() => handleDayToggle(index)}
                              >
                                <Text style={[
                                  styles.dayButtonText,
                                  formData.selectedDays.includes(index) && styles.activeDayButtonText
                                ]}>
                                  {day}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Monthly Options */}
                      {formData.customPattern === 'monthly' && (
                        <View style={styles.subField}>
                          <Text style={styles.subLabel}>Monthly pattern</Text>
                          <View style={styles.monthlyOptions}>
                            <TouchableOpacity
                              style={[
                                styles.monthlyOption,
                                formData.monthlyPattern === 'date' && styles.activeMonthlyOption
                              ]}
                              onPress={() => setFormData(prev => ({ ...prev, monthlyPattern: 'date' }))}
                            >
                              <Text style={[
                                styles.monthlyOptionText,
                                formData.monthlyPattern === 'date' && styles.activeMonthlyOptionText
                              ]}>
                                Same Date
                              </Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                              style={[
                                styles.monthlyOption,
                                formData.monthlyPattern === 'weekday' && styles.activeMonthlyOption
                              ]}
                              onPress={() => setFormData(prev => ({ ...prev, monthlyPattern: 'weekday' }))}
                            >
                              <Text style={[
                                styles.monthlyOptionText,
                                formData.monthlyPattern === 'weekday' && styles.activeMonthlyOptionText
                              ]}>
                                Same Weekday
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {formData.monthlyPattern === 'weekday' && (
                            <View style={styles.weekdayOptions}>
                              <View style={styles.weekdayRow}>
                                <Text style={styles.weekdayLabel}>Which occurrence?</Text>
                                <View style={styles.occurrenceButtons}>
                                  {['First', 'Second', 'Third', 'Fourth', 'Last'].map((occurrence) => (
                                    <TouchableOpacity
                                      key={occurrence}
                                      style={[
                                        styles.occurrenceButton,
                                        formData.weekdayOccurrence === occurrence.toLowerCase() && styles.activeOccurrenceButton
                                      ]}
                                      onPress={() => setFormData(prev => ({ ...prev, weekdayOccurrence: occurrence.toLowerCase() }))}
                                    >
                                      <Text style={[
                                        styles.occurrenceButtonText,
                                        formData.weekdayOccurrence === occurrence.toLowerCase() && styles.activeOccurrenceButtonText
                                      ]}>
                                        {occurrence}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                              
                              <View style={styles.weekdayRow}>
                                <Text style={styles.weekdayLabel}>Which day?</Text>
                                <View style={styles.dayButtons}>
                                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                                    <TouchableOpacity
                                      key={day}
                                      style={[
                                        styles.dayButton,
                                        formData.selectedWeekday === index && styles.activeDayButton
                                      ]}
                                      onPress={() => setFormData(prev => ({ ...prev, selectedWeekday: index }))}
                                    >
              <Calendar
                onDayPress={(day) => {
                  setFormData(prev => ({ ...prev, start_date: day.dateString }));
                  setShowStartDateCalendar(false);
                }}
                markedDates={{
                  [formData.start_date]: {
                    selected: true,
                    selectedColor: '#0078d4'
                  }
                }}
                theme={{
                  selectedDayBackgroundColor: '#0078d4',
                  todayTextColor: '#0078d4',
                  arrowColor: '#0078d4',
                }}
              />
              )}
            </View>
          )}

        {/* End Date Calendar Modal */}
        <Modal visible={showEndDateCalendar} transparent animationType="fade">
          <View style={styles.calendarOverlay}>
            <View style={styles.calendarContainer}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarTitle}>Select End Date</Text>
                <TouchableOpacity onPress={() => setShowEndDateCalendar(false)}>
                  <X size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <Calendar
                onDayPress={(day) => {
                  setFormData(prev => ({ ...prev, end_date: day.dateString }));
                  setShowEndDateCalendar(false);
                }}
                markedDates={{
                  [formData.end_date]: {
                    selected: true,
                    selectedColor: '#0078d4'
                  }
                }}
                theme={{
                  selectedDayBackgroundColor: '#0078d4',
                  todayTextColor: '#0078d4',
                  arrowColor: '#0078d4',
                }}
              />
            </View>
          </View>
        </Modal>

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

            {/* Repeat toggle */}
            <View style={styles.repeatToggleContainerLeft}>
              <View style={styles.toggleItem}>
                <Text style={styles.toggleLabel}>Repeat</Text>
                <Switch value={formData.repeat} onValueChange={(v) => setFormData(p => ({ ...p, repeat: v }))} />
              </View>
            </View>

            {/* Inline Recurrence Picker (when Repeat is ON but Goal is OFF) */}
            {formData.repeat && !formData.goalToggle && (
              <View style={styles.field}>
                <Text style={styles.label}>Repeat Frequency</Text>
                <View style={styles.recurrenceOptions}>
                  {(['daily', 'weekly'] as const).map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      style={[
                        styles.recurrenceOption,
                        formData.recurrenceRule === `RRULE:FREQ=${freq.toUpperCase()}` && styles.recurrenceOptionActive
                      ]}
                      onPress={() => setFormData(prev => ({ 
                        ...prev, 
                        recurrenceRule: `RRULE:FREQ=${freq.toUpperCase()}` 
                      }))}
                    >
                      <Text style={[
                        styles.recurrenceOptionText,
                        formData.recurrenceRule === `RRULE:FREQ=${freq.toUpperCase()}` && styles.recurrenceOptionTextActive
                      ]}>
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[
                      styles.recurrenceOption,
                      formData.recurrenceRule?.includes('CUSTOM') && styles.recurrenceOptionActive
                    ]}
                    onPress={() => setFormData(prev => ({ 
                      ...prev, 
                      recurrenceRule: 'CUSTOM' 
                    }))}
                  >
                    <Text style={[
                      styles.recurrenceOptionText,
                      formData.recurrenceRule?.includes('CUSTOM') && styles.recurrenceOptionTextActive
                    ]}>
                      Custom
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Weekly Days Selection */}
                {formData.recurrenceRule?.startsWith('RRULE:FREQ=WEEKLY') && (
                  <View style={styles.weeklyDaysContainer}>
                    <View style={styles.weeklyDaysGrid}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => {
                        const isSelected = selectedWeeklyDays.includes(index);
                        return (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.weeklyDayButton,
                              isSelected && styles.weeklyDayButtonSelected
                            ]}
                            onPress={() => {
                              const newDays = isSelected
                                ? selectedWeeklyDays.filter(d => d !== index)
                                : [...selectedWeeklyDays, index];
                              setSelectedWeeklyDays(newDays);
                              
                              // Update recurrence rule with selected days
                              if (newDays.length > 0) {
                                const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
                                const byDays = newDays.map(dayIndex => dayNames[dayIndex]).join(',');
                                setFormData(prev => ({ 
                                  ...prev, 
                                  recurrenceRule: `RRULE:FREQ=WEEKLY;BYDAY=${byDays}` 
                                }));
                              } else {
                                setFormData(prev => ({ 
                                  ...prev, 
                                  recurrenceRule: 'RRULE:FREQ=WEEKLY' 
                                }));
                              }
                            }}
                          >
                            <Text style={[
                              styles.weeklyDayButtonText,
                              isSelected && styles.weeklyDayButtonTextSelected
                            ]}>
                              {dayName}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Custom Recurrence Options */}
                {formData.recurrenceRule?.includes('CUSTOM') && (
                  <View style={styles.customRecurrenceContainer}>
                    <Text style={styles.subLabel}>Custom Frequency</Text>
                    
                    {/* Bi-weekly / Monthly selector */}
                    <View style={styles.customTypeSelector}>
                      <TouchableOpacity
                        style={[
                          styles.customTypeButton,
                          customRecurrenceType === 'biweekly' && styles.customTypeButtonActive
                        ]}
                        onPress={() => setCustomRecurrenceType('biweekly')}
                      >
                        <Text style={[
                          styles.customTypeButtonText,
                          customRecurrenceType === 'biweekly' && styles.customTypeButtonTextActive
                        ]}>
                          Bi-weekly
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.customTypeButton,
                          customRecurrenceType === 'monthly' && styles.customTypeButtonActive
                        ]}
                        onPress={() => setCustomRecurrenceType('monthly')}
                      >
                        <Text style={[
                          styles.customTypeButtonText,
                          customRecurrenceType === 'monthly' && styles.customTypeButtonTextActive
                        ]}>
                          Monthly
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Bi-weekly options */}
                    {customRecurrenceType === 'biweekly' && (
                      <View style={styles.biweeklyOptions}>
                        <Text style={styles.subLabel}>Select Days (every 2 weeks)</Text>
                        <View style={styles.weeklyDaysGrid}>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => {
                            const isSelected = selectedWeeklyDays.includes(index);
                            return (
                              <TouchableOpacity
                                key={index}
                                style={[
                                  styles.weeklyDayButton,
                                  isSelected && styles.weeklyDayButtonSelected
                                ]}
                                onPress={() => {
                                  const newDays = isSelected
                                    ? selectedWeeklyDays.filter(d => d !== index)
                                    : [...selectedWeeklyDays, index];
                                  setSelectedWeeklyDays(newDays);
                                  
                                  // Update recurrence rule for bi-weekly
                                  if (newDays.length > 0) {
                                    const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
                                    const byDays = newDays.map(dayIndex => dayNames[dayIndex]).join(',');
                                    setFormData(prev => ({ 
                                      ...prev, 
                                      recurrenceRule: `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${byDays}` 
                                    }));
                                  } else {
                                    setFormData(prev => ({ 
                                      ...prev, 
                                      recurrenceRule: 'RRULE:FREQ=WEEKLY;INTERVAL=2' 
                                    }));
                                  }
                                }}
                              >
                                <Text style={[
                                  styles.weeklyDayButtonText,
                                  isSelected && styles.weeklyDayButtonTextSelected
                                ]}>
                                  {dayName}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Monthly options */}
                    {customRecurrenceType === 'monthly' && (
                      <View style={styles.monthlyOptions}>
                        <Text style={styles.subLabel}>Monthly Pattern</Text>
                        
                        {/* Date vs Weekday selector */}
                        <View style={styles.monthlyTypeSelector}>
                          <TouchableOpacity
                            style={[
                              styles.monthlyTypeButton,
                              monthlyOption === 'date' && styles.monthlyTypeButtonActive
                            ]}
                            onPress={() => {
                              setMonthlyOption('date');
                              setFormData(prev => ({ 
                                ...prev, 
                                recurrenceRule: 'RRULE:FREQ=MONTHLY' 
                              }));
                            }}
                          >
                            <Text style={[
                              styles.monthlyTypeButtonText,
                              monthlyOption === 'date' && styles.monthlyTypeButtonTextActive
                            ]}>
                              Same Date
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.monthlyTypeButton,
                              monthlyOption === 'weekday' && styles.monthlyTypeButtonActive
                            ]}
                            onPress={() => {
                              setMonthlyOption('weekday');
                              const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
                              const byDay = dayNames[monthlyDayOfWeek];
                              const setPos = monthlyWeekday === 'last' ? '-1' : 
                                           monthlyWeekday === 'first' ? '1' :
                                           monthlyWeekday === 'second' ? '2' :
                                           monthlyWeekday === 'third' ? '3' : '4';
                              setFormData(prev => ({ 
                                ...prev, 
                                recurrenceRule: `RRULE:FREQ=MONTHLY;BYDAY=${setPos}${byDay}` 
                              }));
                            }}
                          >
                            <Text style={[
                              styles.monthlyTypeButtonText,
                              monthlyOption === 'weekday' && styles.monthlyTypeButtonTextActive
                            ]}>
                              Same Weekday
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Weekday-specific options */}
                        {monthlyOption === 'weekday' && (
                          <View style={styles.weekdayOptions}>
                            {/* Week selector */}
                            <View style={styles.weekSelector}>
                              <Text style={styles.subLabel}>Which Week?</Text>
                              <View style={styles.weekSelectorGrid}>
                                {(['first', 'second', 'third', 'fourth', 'last'] as const).map((week) => (
                                  <TouchableOpacity
                                    key={week}
                                    style={[
                                      styles.weekSelectorButton,
                                      monthlyWeekday === week && styles.weekSelectorButtonActive
                                    ]}
                                    onPress={() => {
                                      setMonthlyWeekday(week);
                                      const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
                                      const byDay = dayNames[monthlyDayOfWeek];
                                      const setPos = week === 'last' ? '-1' : 
                                                   week === 'first' ? '1' :
                                                   week === 'second' ? '2' :
                                                   week === 'third' ? '3' : '4';
                                      setFormData(prev => ({ 
                                        ...prev, 
                                        recurrenceRule: `RRULE:FREQ=MONTHLY;BYDAY=${setPos}${byDay}` 
                                      }));
                                    }}
                                  >
                                    <Text style={[
                                      styles.weekSelectorButtonText,
                                      monthlyWeekday === week && styles.weekSelectorButtonTextActive
                                    ]}>
                                      {week.charAt(0).toUpperCase() + week.slice(1)}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>

                            {/* Day of week selector */}
                            <View style={styles.dayOfWeekSelector}>
                              <Text style={styles.subLabel}>Which Day?</Text>
                              <View style={styles.weeklyDaysGrid}>
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => (
                                  <TouchableOpacity
                                    key={index}
                                    style={[
                                      styles.weeklyDayButton,
                                      monthlyDayOfWeek === index && styles.weeklyDayButtonSelected
                                    ]}
                                    onPress={() => {
                                      setMonthlyDayOfWeek(index);
                                      const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
                                      const byDay = dayNames[index];
                                      const setPos = monthlyWeekday === 'last' ? '-1' : 
                                                   monthlyWeekday === 'first' ? '1' :
                                                   monthlyWeekday === 'second' ? '2' :
                                                   monthlyWeekday === 'third' ? '3' : '4';
                                      setFormData(prev => ({ 
                                        ...prev, 
                                        recurrenceRule: `RRULE:FREQ=MONTHLY;BYDAY=${setPos}${byDay}` 
                                      }));
                                    }}
                                  >
                                    <Text style={[
                                      styles.weeklyDayButtonText,
                                      monthlyDayOfWeek === index && styles.weeklyDayButtonTextSelected
                                    ]}>
                                      {dayName}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {formData.schedulingType === 'event' && (
          <>
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

            {/* Repeat Toggle - Below Time Features for Events */}
            <View style={styles.repeatToggleContainerLeft}>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Repeat</Text>
                <Switch
                  value={formData.repeatEnabled}
                  onValueChange={(value) => {
                    setFormData(prev => ({ 
                      ...prev, 
                      repeatEnabled: value,
                      // Clear recurrence data when disabling
                      ...(value ? {} : {
                        recurrenceFrequency: 'daily',
                        selectedWeekDays: [],
                        customRecurrenceType: 'biweekly',
                        customInterval: 1,
                        monthlyPattern: 'date',
                        monthlyWeekOccurrence: 'first',
                        monthlyWeekDay: 'monday'
                      })
                    }));
                  }}
                  trackColor={{ false: '#d1d5db', true: colors.primary }}
                  thumbColor={colors.surface}
                />
              </View>
            </View>

            {/* Inline Recurrence Picker for Events */}
            {formData.repeatEnabled && (
              <View style={styles.inlineRecurrencePicker}>
                {/* Repeat Frequency */}
                <View style={styles.recurrenceSection}>
                  <Text style={styles.recurrenceLabel}>Repeat Frequency</Text>
                  <View style={styles.frequencyButtons}>
                    {(['daily', 'weekly', 'custom'] as const).map((freq) => (
                      <TouchableOpacity
                        key={freq}
                        style={[
                          styles.frequencyButton,
                          formData.recurrenceFrequency === freq && styles.selectedFrequencyButton
                        ]}
                        onPress={() => {
                          setFormData(prev => ({ 
                            ...prev, 
                            recurrenceFrequency: freq,
                            // Only clear days when switching to Daily
                            ...(freq === 'daily' ? { selectedWeekDays: [] } : {})
                          }));
                        }}
                      >
                        <Text style={[
                          styles.frequencyButtonText,
                          formData.recurrenceFrequency === freq && styles.selectedFrequencyButtonText
                        ]}>
                          {freq.charAt(0).toUpperCase() + freq.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Weekly Day Selection */}
                {formData.recurrenceFrequency === 'weekly' && (
                  <View style={styles.recurrenceSection}>
                    <View style={styles.weekDaysContainer}>
                      {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => (
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.weekDayButton,
                            formData.selectedWeekDays.includes(day) && styles.selectedWeekDayButton
                          ]}
                          onPress={() => {
                            setFormData(prev => ({
                              ...prev,
                              selectedWeekDays: prev.selectedWeekDays.includes(day)
                                ? prev.selectedWeekDays.filter(d => d !== day)
                                : [...prev.selectedWeekDays, day]
                            }));
                          }}
                        >
                          <Text style={[
                            styles.weekDayButtonText,
                            formData.selectedWeekDays.includes(day) && styles.selectedWeekDayButtonText
                          ]}>
                            {day.slice(0, 3).toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Custom Recurrence Options */}
                {formData.recurrenceFrequency === 'custom' && (
                  <View style={styles.recurrenceSection}>
                    <Text style={styles.recurrenceLabel}>Custom Pattern</Text>
                    <View style={styles.customRecurrenceButtons}>
                      {(['biweekly', 'monthly'] as const).map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.customRecurrenceButton,
                            formData.customRecurrenceType === type && styles.selectedCustomRecurrenceButton
                          ]}
                          onPress={() => {
                            setFormData(prev => ({ 
                              ...prev, 
                              customRecurrenceType: type 
                            }));
                          }}
                        >
                          <Text style={[
                            styles.customRecurrenceButtonText,
                            formData.customRecurrenceType === type && styles.selectedCustomRecurrenceButtonText
                          ]}>
                            {type === 'biweekly' ? 'Bi-weekly' : 'Monthly'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Bi-weekly Day Selection */}
                    {formData.customRecurrenceType === 'biweekly' && (
                      <View style={styles.biweeklySection}>
                        <Text style={styles.subLabel}>Select Days (every 2 weeks)</Text>
                        <View style={styles.weekDaysContainer}>
                          {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => (
                            <TouchableOpacity
                              key={day}
                              style={[
                                styles.weekDayButton,
                                formData.selectedWeekDays.includes(day) && styles.selectedWeekDayButton
                              ]}
                              onPress={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  selectedWeekDays: prev.selectedWeekDays.includes(day)
                                    ? prev.selectedWeekDays.filter(d => d !== day)
                                    : [...prev.selectedWeekDays, day]
                                }));
                              }}
                            >
                              <Text style={[
                                styles.weekDayButtonText,
                                formData.selectedWeekDays.includes(day) && styles.selectedWeekDayButtonText
                              ]}>
                                {day.slice(0, 3).toUpperCase()}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Monthly Pattern Selection */}
                    {formData.customRecurrenceType === 'monthly' && (
                      <View style={styles.monthlySection}>
                        <Text style={styles.subLabel}>Monthly Pattern</Text>
                        <View style={styles.monthlyPatternButtons}>
                          <TouchableOpacity
                            style={[
                              styles.monthlyPatternButton,
                              formData.monthlyPattern === 'date' && styles.selectedMonthlyPatternButton
                            ]}
                            onPress={() => setFormData(prev => ({ ...prev, monthlyPattern: 'date' }))}
                          >
                            <Text style={[
                              styles.monthlyPatternButtonText,
                              formData.monthlyPattern === 'date' && styles.selectedMonthlyPatternButtonText
                            ]}>
                              Same Date
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.monthlyPatternButton,
                              formData.monthlyPattern === 'weekday' && styles.selectedMonthlyPatternButton
                            ]}
                            onPress={() => setFormData(prev => ({ ...prev, monthlyPattern: 'weekday' }))}
                          >
                            <Text style={[
                              styles.monthlyPatternButtonText,
                              formData.monthlyPattern === 'weekday' && styles.selectedMonthlyPatternButtonText
                            ]}>
                              Same Weekday
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Monthly Weekday Pattern */}
                        {formData.monthlyPattern === 'weekday' && (
                          <View style={styles.monthlyWeekdaySection}>
                            <Text style={styles.subLabel}>Week Occurrence</Text>
                            <View style={styles.weekOccurrenceButtons}>
                              {(['first', 'second', 'third', 'fourth', 'last'] as const).map((occurrence) => (
                                <TouchableOpacity
                                  key={occurrence}
                                  style={[
                                    styles.weekOccurrenceButton,
                                    formData.monthlyWeekOccurrence === occurrence && styles.selectedWeekOccurrenceButton
                                  ]}
                                  onPress={() => setFormData(prev => ({ ...prev, monthlyWeekOccurrence: occurrence }))}
                                >
                                  <Text style={[
                                    styles.weekOccurrenceButtonText,
                                    formData.monthlyWeekOccurrence === occurrence && styles.selectedWeekOccurrenceButtonText
                                  ]}>
                                    {occurrence.charAt(0).toUpperCase() + occurrence.slice(1)}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>

                            <Text style={styles.subLabel}>Day of Week</Text>
                            <View style={styles.weekDaysContainer}>
                              {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => (
                                <TouchableOpacity
                                  key={day}
                                  style={[
                                    styles.weekDayButton,
                                    formData.monthlyWeekDay === day && styles.selectedWeekDayButton
                                  ]}
                                  onPress={() => setFormData(prev => ({ ...prev, monthlyWeekDay: day }))}
                                >
                                  <Text style={[
                                    styles.weekDayButtonText,
                                    formData.monthlyWeekDay === day && styles.selectedWeekDayButtonText
                                  ]}>
                                    {day.slice(0, 3).toUpperCase()}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </>
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
          <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={saving}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* End Date Calendar Modal */}
      <Modal visible={showEndDateCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select End Date</Text>
              <TouchableOpacity onPress={() => setShowEndDateCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                setFormData(prev => ({ ...prev, end_date: day.dateString }));
                setShowEndDateCalendar(false);
              }}
                onPress={() => setShowEndDateCalendar(true)}
                [formData.end_date || formatLocalDate(new Date())]: {
                  selected: true,
                  selectedColor: '#0078d4'
                }
              }}
              theme={{
                selectedDayBackgroundColor: '#0078d4',
                todayTextColor: '#0078d4',
                arrowColor: '#0078d4',
              }}
            />
          </View>
        </View>
      </Modal>

      {/* GOAL MODE — Reuse ActionEffortModal */}
      {goalMode && formData.selectedGoal && (
        <ActionEffortModal
          visible={goalModalVisible}
          onClose={() => setGoalModalVisible(false)}
          goal={formData.selectedGoal}
          cycleWeeks={cycleWeeks}
          // This function comes from your modal contract: create a task + week plan from the modal's collected fields
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

  pillContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  typePill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typePillActive: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  typePillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  typePillTextActive: {
    color: '#ffffff',
  },
  toggleSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  toggleGrid: {
    gap: 12,
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 120,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },

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

  dateSection: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  dateField: {
    marginBottom: 12,
    maxWidth: 300,
  },
  dateButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  actions: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 24 },
  cancelButton: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db',
    paddingVertical: 12, borderRadius: 8, alignItems: 'center',
  },
  cancelButtonText: { color: '#374151', fontWeight: '600' },
  saveButton: { flex: 1, backgroundColor: '#0078d4', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveButtonDisabled: { backgroundColor: '#9ca3af' },
  saveButtonText: { color: '#fff', fontWeight: '700', paddingVertical: 12 },
  repeatToggleContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  repeatToggleContainerLeft: {
    marginTop: 16,
    alignItems: 'flex-start',
  },
  recurrenceOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  recurrenceOption: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recurrenceOptionActive: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  recurrenceOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  recurrenceOptionTextActive: {
    color: '#ffffff',
  },
  weeklyDaysContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  weeklyDaysGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  weeklyDayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weeklyDayButtonSelected: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  weeklyDayButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  weeklyDayButtonTextSelected: {
    color: '#ffffff',
  },
  customRecurrenceContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  customTypeSelector: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 2,
    marginTop: 8,
  },
  customTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  customTypeButtonActive: {
    backgroundColor: '#0078d4',
  },
  customTypeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  customTypeButtonTextActive: {
    color: '#ffffff',
  },
  biweeklyOptions: {
    marginTop: 12,
  },
  monthlyOptions: {
    marginTop: 12,
  },
  monthlyTypeSelector: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 2,
    marginTop: 8,
  },
  monthlyTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  monthlyTypeButtonActive: {
    backgroundColor: '#0078d4',
  },
  monthlyTypeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  monthlyTypeButtonTextActive: {
    color: '#ffffff',
  },
  weekdayOptions: {
    marginTop: 12,
    gap: 12,
  },
  weekSelector: {
    alignItems: 'center',
  },
  weekSelectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  weekSelectorButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  weekSelectorButtonActive: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  weekSelectorButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  weekSelectorButtonTextActive: {
    color: '#ffffff',
  },
  dayOfWeekSelector: {
    alignItems: 'center',
  },
  weekDaysSection: {
    marginTop: 12,
  },
  recurrenceSection: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  recurrenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  inlineRecurrencePicker: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  frequencyButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  frequencyButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectedFrequencyButton: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  selectedFrequencyButtonText: {
    color: '#ffffff',
  },
  weekDaysContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  weekDayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedWeekDayButton: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  weekDayButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  selectedWeekDayButtonText: {
    color: '#ffffff',
  },
  customRecurrenceButtons: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 2,
    marginTop: 8,
  },
  customRecurrenceButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  selectedCustomRecurrenceButton: {
    backgroundColor: '#0078d4',
  },
  customRecurrenceButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  selectedCustomRecurrenceButtonText: {
    color: '#ffffff',
  },
  biweeklySection: {
    marginTop: 12,
  },
  monthlySection: {
    marginTop: 12,
  },
  monthlyPatternButtons: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 2,
    marginTop: 8,
  },
  monthlyPatternButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  selectedMonthlyPatternButton: {
    backgroundColor: '#0078d4',
  },
  monthlyPatternButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  selectedMonthlyPatternButtonText: {
    color: '#ffffff',
  },
  monthlyWeekdaySection: {
    marginTop: 12,
    gap: 12,
  },
  weekOccurrenceButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  weekOccurrenceButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectedWeekOccurrenceButton: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  weekOccurrenceButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  selectedWeekOccurrenceButtonText: {
    color: '#ffffff',
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 20,
    padding: 16,
    maxWidth: 350,
    width: '90%',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
});