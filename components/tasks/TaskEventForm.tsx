import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  FlatList,
} from 'react-native';

/***************************
 * SANDBOX‑SAFE STUBS
 * (So the canvas preview builds without alias modules.)
 * In production, REPLACE these with real imports:
 *   import { Calendar } from 'react-native-calendars'
 *   import { X } from 'lucide-react-native'
 *   import { getSupabaseClient } from '@/lib/supabase'
 *   import { useGoalProgress } from '@/hooks/useGoalProgress'
 ***************************/
const X: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#6b7280' }) => (
  <Text style={{ fontSize: size, color }}>×</Text>
);

// Tiny clickable calendar stub (weeks of current month)
const Calendar: React.FC<{ onDayPress: (d: any) => void } & Record<string, any>> = ({ onDayPress }) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days = Array.from({ length: last.getDate() }, (_, i) => i + 1);
  return (
    <View style={{ padding: 12 }}>
      <Text style={{ fontWeight: '600', marginBottom: 8 }}>
        {now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {days.map((d) => (
          <TouchableOpacity
            key={d}
            onPress={() => onDayPress({ year, month: month + 1, day: d })}
            style={{ width: '14.28%', paddingVertical: 8, alignItems: 'center' }}
          >
            <Text>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Supabase mock – no network in canvas. Always returns empty payloads.
function getSupabaseClient(): any {
  const makeResp = (data: any = [], error: any = null) => Promise.resolve({ data, error });
  const builder = () => ({
    select: () => ({ eq: () => ({ eq: () => makeResp([]) }) }),
    update: () => ({ eq: () => ({ select: () => ({ single: () => makeResp({}) }) }) }),
    insert: () => ({ select: () => ({ single: () => makeResp({ id: 'mock-id' }) }) }),
    in: () => ({ gte: () => ({ lte: () => makeResp([]) }) }),
    eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => makeResp(null) }) }) }),
  });
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'sandbox-user' } } }) },
    from: (_table: string) => builder(),
    rpc: async () => ({ data: true, error: null }),
  };
}

function useGoalProgress() {
  // 12 static weeks, today as start for preview
  const start = new Date();
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const s = new Date(start);
    s.setDate(s.getDate() + i * 7);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { week_number: i + 1, start_date: iso(s), end_date: iso(e) };
  });
  return {
    currentCycle: { id: 'mock-cycle', start_date: weeks[0].start_date, end_date: weeks[11].end_date },
    cycleWeeks: weeks,
    createTaskWithWeekPlan: async () => ({ ok: true }),
  } as any;
}

/***************************
 * Types
 ***************************/
interface TaskEventFormProps {
  mode: 'create' | 'edit';
  initialData?: Partial<any>;
  onSubmitSuccess: () => void;
  onClose: () => void;
}
interface Role { id: string; label: string }
interface Domain { id: string; name: string }
interface KeyRelationship { id: string; name: string; role_id: string }
interface TwelveWeekGoal { id: string; title: string }

/***************************
 * Pure utilities (unit-testable)
 ***************************/
export const toDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
export const formatDateForInput = (date: Date) => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};
export const getDefaultTime = (addHours = 1) => {
  const now = new Date();
  now.setHours(now.getHours() + addHours);
  const minutes = Math.ceil(now.getMinutes() / 15) * 15;
  now.setMinutes(minutes, 0, 0);
  const h = now.getHours();
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? 'am' : 'pm';
  return `${hour12}:${String(now.getMinutes()).padStart(2,'0')} ${ampm}`;
};
export const timestampToTimeString = (ts?: string) => {
  if (!ts) return getDefaultTime();
  const d = new Date(ts);
  const h = d.getHours();
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? 'am' : 'pm';
  return `${hour12}:${String(d.getMinutes()).padStart(2,'0')} ${ampm}`;
};
export const timeStringToMinutes = (time: string) => {
  const [tp, period] = time.split(' ');
  let [h, m] = tp.split(':').map(Number);
  if (period === 'pm' && h < 12) h += 12;
  if (period === 'am' && h === 12) h = 0;
  return h * 60 + m;
};
export const combineDateAndTime = (date: Date, time: string) => {
  const [tp, period] = time.split(' ');
  let [hours, minutes] = tp.split(':').map(Number);
  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};
export const getDurationLabel = (start: string, end: string) => {
  let diff = timeStringToMinutes(end) - timeStringToMinutes(start);
  if (diff <= 0) diff += 24 * 60;
  const hours = Math.round((diff / 60) * 100) / 100;
  return `${hours} hr${hours === 1 ? '' : 's'}`;
};

/***************************
 * Calendar day renderer (valid style arrays)
 ***************************/
const CustomDayComponent: React.FC<{
  date: any; state: string; marking?: any; onPress: (d: any) => void;
}> = ({ date, state, marking, onPress }) => {
  const isSelected = Boolean(marking?.selected);
  const isToday = state === 'today';
  return (
    <TouchableOpacity
      onPress={() => onPress(date)}
      style={[styles.dayContainer, isSelected ? styles.selectedDay : {}]}
    >
      <Text
        style={[
          styles.dayText,
          isToday && !isSelected ? styles.todayText : {},
          isSelected ? styles.selectedDayText : {},
          state === 'disabled' ? styles.disabledDayText : {},
        ]}
      >
        {date.day}
      </Text>
    </TouchableOpacity>
  );
};

/***************************
 * Main component
 ***************************/
const TaskEventForm: React.FC<TaskEventFormProps> = ({ mode, initialData, onSubmitSuccess, onClose }) => {
  const { currentCycle, cycleWeeks, createTaskWithWeekPlan } = useGoalProgress();

  // Refs & lists
  const dateInputRef = useRef<TouchableOpacity>(null);
  const endDateInputRef = useRef<TouchableOpacity>(null);
  const timeListRef = useRef<FlatList<string>>(null);
  const TIME_ROW_HEIGHT = 44;
  const timeOptions = useMemo(() => {
    const t: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const ampm = h < 12 ? 'am' : 'pm';
        t.push(`${hour12}:${String(m).padStart(2, '0')} ${ampm}`);
      }
    }
    return t;
  }, []);

  // Form state
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    notes: (initialData?.type === 'depositIdea' || (initialData as any)?.sourceDepositIdeaId) ? '' : (initialData?.notes || ''),
    amount: initialData?.amount?.toString() || '',
    withdrawalDate: initialData?.withdrawn_at ? new Date(initialData.withdrawn_at) : new Date(),
    dueDate: initialData?.due_date ? new Date(initialData.due_date) : new Date(),
    time: initialData?.start_time ? timestampToTimeString(initialData.start_time) : getDefaultTime(),
    startTime: initialData?.start_time ? timestampToTimeString(initialData.start_time) : getDefaultTime(),
    endTime: initialData?.end_time ? timestampToTimeString(initialData.end_time) : getDefaultTime(2),
    isAnytime: initialData?.is_all_day || false,
    is_urgent: initialData?.is_urgent || false,
    is_important: initialData?.is_important || false,
    is_authentic_deposit: initialData?.is_authentic_deposit || false,
    is_twelve_week_goal: initialData?.is_twelve_week_goal || false,
    countsTowardWeeklyProgress: (initialData as any)?.counts_toward_weekly_progress || false,
    inputKind: ((initialData as any)?.input_kind || 'count') as 'count' | 'duration',
    unit: ((initialData as any)?.unit || 'days') as 'days' | 'hours' | 'sessions',
    schedulingType: (initialData?.type as 'task' | 'event' | 'depositIdea' | 'withdrawal') || 'task',
    selectedRoleIds: (initialData?.roles || []).map((r: any) => r.id) as string[],
    selectedDomainIds: (initialData?.domains || []).map((d: any) => d.id) as string[],
    selectedKeyRelationshipIds: (initialData?.keyRelationships || []).map((kr: any) => kr.id) as string[],
    selectedGoalId: (initialData as any)?.goal_12wk_id || null as string | null,
    selectedGoalIds: (initialData?.goals || []).map((g: any) => g.id) as string[],
    weeklyTargets: {} as Record<number, number>,
  });

  // Local option lists
  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [twelveWeekGoals, setTwelveWeekGoals] = useState<TwelveWeekGoal[]>([]);
  const [loading, setLoading] = useState(false);

  // UI state
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [showWithdrawalCalendar, setShowWithdrawalCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeCalendarField, setActiveCalendarField] = useState<'start' | 'end'>('start');
  const [activeTimeField, setActiveTimeField] = useState<'time' | 'startTime' | 'endTime' | null>(null);
  const [dateInputValue, setDateInputValue] = useState('');
  const [endDateInputValue, setEndDateInputValue] = useState('');
  const [withdrawalDateInputValue, setWithdrawalDateInputValue] = useState('');
  const [datePickerPosition, setDatePickerPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [withdrawalDatePickerPosition, setWithdrawalDatePickerPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [timePickerPosition, setTimePickerPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Sync input strings
  useEffect(() => {
    setDateInputValue(formatDateForInput(formData.dueDate));
    setEndDateInputValue(formatDateForInput((formData as any).eventEndDate || formData.dueDate));
    setWithdrawalDateInputValue(formatDateForInput(formData.withdrawalDate));
  }, []);
  useEffect(() => { setDateInputValue(formatDateForInput(formData.dueDate)); }, [formData.dueDate]);
  useEffect(() => { setWithdrawalDateInputValue(formatDateForInput(formData.withdrawalDate)); }, [formData.withdrawalDate]);

  // Prefill lists via mock supabase (kept to preserve semantics)
  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: roleData } = await supabase.from('0008-ap-roles').select('id,label').eq('user_id', user.id).eq('is_active', true);
        const { data: domainData } = await supabase.from('0008-ap-domains').select('id,name');
        const { data: krData } = await supabase.from('0008-ap-key-relationships').select('id,name,role_id').eq('user_id', user.id);
        const { data: goalData } = await supabase.from('0008-ap-goals-12wk').select('id,title').eq('user_id', user.id).eq('status', 'active');
        setRoles(roleData || []);
        setDomains(domainData || []);
        setKeyRelationships(krData || []);
        setTwelveWeekGoals(goalData || []);
      } catch (e) { console.error(e); }
    })();
  }, []);

  // Time list autoscroll
  useEffect(() => {
    if (!showTimePicker || !activeTimeField) return;
    const val = (formData as any)[activeTimeField] as string | undefined;
    if (!val) return;
    const idx = timeOptions.indexOf(val);
    if (idx >= 0) requestAnimationFrame(() => timeListRef.current?.scrollToIndex({ index: idx, animated: false }));
  }, [showTimePicker, activeTimeField]);

  // Handlers
  const handleDateInputChange = (text: string) => {
    setDateInputValue(text);
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) {
      const local = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      setFormData(prev => ({ ...prev, dueDate: local }));
    }
  };
  const handleEndDateInputChange = (text: string) => {
    setEndDateInputValue(text);
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) {
      const local = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      setFormData(prev => ({ ...prev, eventEndDate: local } as any));
    }
  };
  const handleWithdrawalDateInputChange = (text: string) => {
    setWithdrawalDateInputValue(text);
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) {
      const local = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      setFormData(prev => ({ ...prev, withdrawalDate: local }));
    }
  };

  const onCalendarDayPress = (day: any) => {
    const selected = new Date(day.year, day.month - 1, day.day);
    if (activeCalendarField === 'end') {
      setFormData(prev => ({ ...prev, eventEndDate: selected } as any));
      setEndDateInputValue(formatDateForInput(selected));
    } else {
      setFormData(prev => ({ ...prev, dueDate: selected }));
      setDateInputValue(formatDateForInput(selected));
    }
    setShowMiniCalendar(false);
  };
  const onWithdrawalCalendarDayPress = (day: any) => {
    const selected = new Date(day.year, day.month - 1, day.day);
    setFormData(prev => ({ ...prev, withdrawalDate: selected }));
    setWithdrawalDateInputValue(formatDateForInput(selected));
    setShowWithdrawalCalendar(false);
  };
  const onTimeSelect = (time: string) => {
    if (activeTimeField) setFormData(prev => ({ ...prev, [activeTimeField]: time } as any));
    setShowTimePicker(false);
  };

  // Recurrence (display + rule)
  const [isRepeating, setIsRepeating] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly' | 'Yearly'>('Weekly');
  const [selectedRecurrenceDays, setSelectedRecurrenceDays] = useState<string[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);
  const getRecurrenceDisplayText = () => {
    let text = recurrenceFrequency;
    if ((recurrenceFrequency === 'Weekly' || recurrenceFrequency === 'Bi-weekly') && selectedRecurrenceDays.length) {
      const map: Record<string,string> = { MO:'Mon',TU:'Tue',WE:'Wed',TH:'Thu',FR:'Fri',SA:'Sat',SU:'Sun' };
      text += ` on ${selectedRecurrenceDays.map(d => map[d] || d).join(', ')}`;
    }
    if (recurrenceEndDate) {
      text += ` until ${recurrenceEndDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
    }
    return text;
  };
  const constructRecurrenceRule = () => {
    const parts: string[] = [];
    let freq = recurrenceFrequency;
    let interval = 1;
    if (freq === 'Bi-weekly') { freq = 'Weekly'; interval = 2; }
    parts.push(`FREQ=${freq.toUpperCase()}`);
    if (interval !== 1) parts.push(`INTERVAL=${interval}`);
    if ((recurrenceFrequency === 'Weekly' || recurrenceFrequency === 'Bi-weekly') && selectedRecurrenceDays.length) parts.push(`BYDAY=${selectedRecurrenceDays.join(',')}`);
    if (recurrenceEndDate) {
      const y = recurrenceEndDate.getFullYear();
      const m = String(recurrenceEndDate.getMonth() + 1).padStart(2,'0');
      const d = String(recurrenceEndDate.getDate()).padStart(2,'0');
      parts.push(`UNTIL=${y}${m}${d}`);
    }
    return `RRULE:${parts.join(';')}`;
  };

  // Weekly targets
  const handleWeeklyTargetChange = (weekNumber: number, target: string) => {
    const v = parseInt(target) || 0;
    setFormData(prev => ({ ...prev, weeklyTargets: { ...prev.weeklyTargets, [weekNumber]: v } }));
  };

  const renderWeeklyPlanningSection = () => {
    if (!formData.is_twelve_week_goal || !formData.countsTowardWeeklyProgress || !currentCycle || cycleWeeks.length === 0) return null;
    return (
      <View style={styles.sectionBox}>
        <Text style={styles.compactSectionTitle}>Weekly Planning</Text>
        <Text style={styles.sectionHint}>Set target days per week across your 12‑week cycle</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.weeklyPlanningGrid}>
            {cycleWeeks.map((w: any) => (
              <View key={w.week_number} style={styles.weekCard}>
                <Text style={styles.weekLabel}>Week {w.week_number}</Text>
                <Text style={styles.weekDates}>{new Date(w.start_date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</Text>
                <TextInput
                  style={styles.weekTargetInput}
                  value={String(formData.weeklyTargets[w.week_number] ?? 0)}
                  onChangeText={(t) => handleWeeklyTargetChange(w.week_number, t)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                />
                <Text style={styles.weekUnit}>days</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  // Submit (core path; mocks still return success)
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const payload: any = {
        user_id: user.id,
        title: formData.title,
        is_urgent: formData.is_urgent,
        is_important: formData.is_important,
        is_authentic_deposit: formData.is_authentic_deposit,
        is_twelve_week_goal: formData.is_twelve_week_goal,
        goal_12wk_id: formData.selectedGoalId,
        status: 'pending',
        type: formData.schedulingType,
        due_date: toDateString(formData.dueDate),
        is_all_day: formData.isAnytime,
        updated_at: new Date().toISOString(),
        counts_toward_weekly_progress: formData.countsTowardWeeklyProgress,
        input_kind: formData.inputKind,
        unit: formData.unit,
      };
      if (formData.schedulingType === 'event') {
        payload.start_date = toDateString(formData.dueDate);
        payload.end_date = toDateString((formData as any).eventEndDate || formData.dueDate);
        payload.recurrence_rule = isRepeating ? constructRecurrenceRule() : null;
        if (!formData.isAnytime) {
          payload.start_time = combineDateAndTime(formData.dueDate, formData.startTime);
          payload.end_time = combineDateAndTime(formData.dueDate, formData.endTime);
        }
      } else if (!formData.isAnytime) {
        payload.start_time = combineDateAndTime(formData.dueDate, formData.time);
      }

      const { data, error } = await getSupabaseClient().from('0008-ap-tasks').insert(payload).select().single();
      if (error) throw error;

      onSubmitSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', (e as Error).message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  // Derived
  const getTitlePlaceholder = () => formData.schedulingType === 'withdrawal' ? 'Reason for your Withdrawal' : formData.schedulingType === 'depositIdea' ? 'What is your Deposit Idea?' : 'Action Title';
  const getNotesPlaceholder = () => formData.schedulingType === 'withdrawal' ? 'Details that may help you improve' : formData.schedulingType === 'depositIdea' ? 'What is needed to make this idea a success?' : 'Notes...';

  // Render
  return (
    <View style={styles.formContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{mode === 'create' ? 'New Action' : 'Edit Action'}</Text>
        <TouchableOpacity onPress={onClose}><X size={20} color="#6b7280" /></TouchableOpacity>
      </View>

      <ScrollView style={styles.formContent}>
        <TextInput
          style={styles.input}
          placeholder={getTitlePlaceholder()}
          value={formData.title}
          onChangeText={(t) => setFormData(prev => ({ ...prev, title: t }))}
        />

        {/* Scheduling toggle */}
        <View style={styles.schedulingToggle}>
          {(['task','event','depositIdea','withdrawal'] as const).map(type => (
            <TouchableOpacity key={type} style={[styles.toggleChip, formData.schedulingType === type ? styles.toggleChipActive : {}]} onPress={() => setFormData(prev => ({ ...prev, schedulingType: type }))}>
              <Text style={formData.schedulingType === type ? styles.toggleChipTextActive : styles.toggleChipText}>
                {type === 'depositIdea' ? 'Deposit Idea' : type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Withdrawal section */}
        {formData.schedulingType === 'withdrawal' && (
          <>
            <Text style={styles.compactSectionTitle}>Withdrawal Details</Text>
            <View style={styles.compactDateTimeRow}>
              <View style={styles.amountContainer}>
                <Text style={styles.compactInputLabel}>Amount *</Text>
                <TextInput
                  style={styles.amountInput}
                  value={formData.amount}
                  onChangeText={(t) => setFormData(prev => ({ ...prev, amount: t }))}
                  placeholder="0.0"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.withdrawalDateContainer}>
                <TouchableOpacity
                  ref={dateInputRef}
                  style={styles.compactDateButton}
                  onPress={() => {
                    dateInputRef.current?.measure((fx, fy, w, h, px, py) => {
                      setWithdrawalDatePickerPosition({ x: px, y: py, width: w, height: h });
                      setShowWithdrawalCalendar(!showWithdrawalCalendar);
                    });
                  }}
                >
                  <Text style={styles.compactInputLabel}>Date</Text>
                  <TextInput
                    style={styles.dateTextInput}
                    value={withdrawalDateInputValue}
                    onChangeText={handleWithdrawalDateInputChange}
                    editable={false}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Task/Event common date row */}
        {formData.schedulingType !== 'withdrawal' && (
          <>
            <Text style={styles.compactSectionTitle}>When</Text>
            <View style={styles.compactDateTimeRow}>
              <TouchableOpacity
                ref={dateInputRef}
                style={styles.compactDateButton}
                onPress={() => {
                  dateInputRef.current?.measure((fx, fy, w, h, px, py) => {
                    setDatePickerPosition({ x: px, y: py, width: w, height: h });
                    setActiveCalendarField('start');
                    setShowMiniCalendar(!showMiniCalendar);
                  });
                }}
              >
                <Text style={styles.compactInputLabel}>Start</Text>
                <TextInput
                  style={styles.dateTextInput}
                  value={dateInputValue}
                  onChangeText={handleDateInputChange}
                  editable={false}
                />
              </TouchableOpacity>

              {formData.schedulingType === 'event' && (
                <TouchableOpacity
                  ref={endDateInputRef}
                  style={styles.compactDateButton}
                  onPress={() => {
                    endDateInputRef.current?.measure((fx, fy, w, h, px, py) => {
                      setDatePickerPosition({ x: px, y: py, width: w, height: h });
                      setActiveCalendarField('end');
                      setShowMiniCalendar(!showMiniCalendar);
                    });
                  }}
                >
                  <Text style={styles.compactInputLabel}>End</Text>
                  <TextInput
                    style={styles.dateTextInput}
                    value={endDateInputValue}
                    onChangeText={handleEndDateInputChange}
                    editable={false}
                  />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Notes */}
        <Text style={styles.compactInputLabel}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          placeholder={getNotesPlaceholder()}
          value={formData.notes}
          onChangeText={(t) => setFormData(prev => ({ ...prev, notes: t }))}
          multiline
        />

        {/* 12-week goal toggles */}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>12‑Week Goal</Text>
          <Switch value={formData.is_twelve_week_goal} onValueChange={(v) => setFormData(prev => ({ ...prev, is_twelve_week_goal: v }))} />
        </View>
        {formData.is_twelve_week_goal && (
          <>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Counts Toward Weekly Progress</Text>
              <Switch value={formData.countsTowardWeeklyProgress} onValueChange={(v) => setFormData(prev => ({ ...prev, countsTowardWeeklyProgress: v }))} />
            </View>
            {renderWeeklyPlanningSection()}
          </>
        )}

        {/* Submit */}
        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? 'Saving…' : (mode === 'create' ? 'Create' : 'Save')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Mini calendar popover */}
      {showMiniCalendar && (
        <View style={[styles.miniCalendarContainer, { top: datePickerPosition.y + datePickerPosition.height + 8, left: datePickerPosition.x }]}>          
          <Calendar onDayPress={onCalendarDayPress} />
        </View>
      )}

      {/* Withdrawal mini calendar */}
      {showWithdrawalCalendar && (
        <View style={[styles.miniCalendarContainer, { top: withdrawalDatePickerPosition.y + withdrawalDatePickerPosition.height + 8, left: withdrawalDatePickerPosition.x }]}>          
          <Calendar onDayPress={onWithdrawalCalendarDayPress} />
        </View>
      )}

      {/* Time picker popover */}
      {showTimePicker && (
        <View style={[styles.timePickerContainer, { top: timePickerPosition.y + timePickerPosition.height + 8, left: timePickerPosition.x, width: 220 }]}>          
          <FlatList
            ref={timeListRef}
            data={timeOptions}
            keyExtractor={(item) => item}
            getItemLayout={(_, index) => ({ length: TIME_ROW_HEIGHT, offset: TIME_ROW_HEIGHT * index, index })}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.timeOption} onPress={() => onTimeSelect(item)}>
                <Text style={styles.timeOptionText}>{item}</Text>
              </TouchableOpacity>
            )}
            style={{ maxHeight: TIME_ROW_HEIGHT * 6 }}
          />
        </View>
      )}
    </View>
  );
};

export default TaskEventForm;

/***************************
 * Unit tests (run in preview via console.assert)
 ***************************/
(() => {
  // timeStringToMinutes
  console.assert(timeStringToMinutes('12:00 am') === 0, '12:00 am should be 0');
  console.assert(timeStringToMinutes('12:00 pm') === 12 * 60, '12:00 pm should be 720');
  console.assert(timeStringToMinutes('1:15 pm') === 13 * 60 + 15, '1:15 pm should be 795');
  // combineDateAndTime round-trip hour
  const dt = new Date('2024-01-01T00:00:00.000Z');
  const iso = combineDateAndTime(dt, '3:30 pm');
  const isoH = new Date(iso).getHours();
  console.assert(isoH === 15, '3:30 pm should yield 15 hours');
})();

/***************************
 * Styles
 ***************************/
const styles = StyleSheet.create({
  formContainer: { padding: 16, backgroundColor: '#fff', flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  formContent: {},
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12 },
  schedulingToggle: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggleChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: '#d1d5db' },
  toggleChipActive: { backgroundColor: '#111827' },
  toggleChipText: { color: '#111827' },
  toggleChipTextActive: { color: 'white' },

  compactSectionTitle: { fontSize: 14, fontWeight: '600', marginTop: 8, marginBottom: 6 },
  compactDateTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },

  amountContainer: { flex: 1 },
  amountInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12 },
  compactInputLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },

  withdrawalDateContainer: { flex: 1 },
  compactDateButton: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10 },
  dateTextInput: { color: '#111827' },

  notesInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top' },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  switchLabel: { fontSize: 14, color: '#111827' },

  sectionBox: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, marginTop: 8 },
  sectionHint: { color: '#6b7280', fontSize: 12, marginBottom: 8 },
  weeklyPlanningGrid: { flexDirection: 'row', gap: 8 },
  weekCard: { width: 100, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, alignItems: 'center' },
  weekLabel: { fontWeight: '600' },
  weekDates: { color: '#6b7280', marginBottom: 6 },
  weekTargetInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 6, width: 56, textAlign: 'center' },
  weekUnit: { color: '#6b7280', fontSize: 12, marginTop: 2 },

  primaryButton: { backgroundColor: '#111827', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: 'white', fontWeight: '600' },

  miniCalendarContainer: { position: 'absolute', zIndex: 50, backgroundColor: '#fff', elevation: 4, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  timePickerContainer: { position: 'absolute', zIndex: 50, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden', elevation: 4 },
  timeOption: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  timeOptionText: { fontSize: 14, color: '#111827' },

  // Calendar day styles
  dayContainer: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  selectedDay: { backgroundColor: '#111827' },
  dayText: { color: '#111827' },
  todayText: { color: '#2563eb' },
  selectedDayText: { color: '#fff' },
  disabledDayText: { color: '#9ca3af' },
});
