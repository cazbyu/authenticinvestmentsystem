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
import { X, Calendar as CalendarIcon, Repeat } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { formatLocalDate, parseLocalDate } from '@/lib/dateUtils';
import ActionEffortModal from '../goals/ActionEffortModal';

// ------------ Types & Models ------------
type SchedulingType = 'task' | 'event' | 'depositIdea' | 'withdrawal';

interface Role { 
  id: string; 
  label: string; 
  color?: string; 
}

interface Domain { 
  id: string; 
  name: string; 
}

interface KeyRelationship { 
  id: string; 
  name: string; 
  role_id: string; 
}

interface TwelveWeekGoal {
  id: string;
  title: string;
}

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
  type: SchedulingType;
  title: string;
  dueDate: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  withdrawalDate: string;
  amount: string;
  isAnytime: boolean;
  isUrgent: boolean;
  isImportant: boolean;
  isAuthenticDeposit: boolean;
  isGoal: boolean;
  hasRepeat: boolean;
  selectedRoleIds: string[];
  selectedDomainIds: string[];
  selectedKeyRelationshipIds: string[];
  selectedGoalIds: string[];
  notes: string;
  
  // New fields for recurrence and goals
  recurrenceRule?: string;
  selectedGoal?: UnifiedGoal;
}

interface TaskEventFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

export default function TaskEventForm({ mode, initialData, onSubmitSuccess, onClose }: TaskEventFormProps) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  
  // Form state
  const [formData, setFormData] = useState<FormData>({
    type: 'task',
    title: '',
    dueDate: formatLocalDate(new Date()),
    startDate: formatLocalDate(new Date()),
    endDate: formatLocalDate(new Date()),
    startTime: '',
    endTime: '',
    withdrawalDate: formatLocalDate(new Date()),
    amount: '',
    isAnytime: false,
    isUrgent: false,
    isImportant: false,
    isAuthenticDeposit: false,
    isGoal: false,
    hasRepeat: false,
    selectedRoleIds: [],
    selectedDomainIds: [],
    selectedKeyRelationshipIds: [],
    selectedGoalIds: [],
    notes: '',
  });

  // Data state
  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [twelveWeekGoals, setTwelveWeekGoals] = useState<TwelveWeekGoal[]>([]);
  const [availableGoals, setAvailableGoals] = useState<UnifiedGoal[]>([]);
  const [cycleWeeks, setCycleWeeks] = useState<CycleWeek[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingNotes, setExistingNotes] = useState<Array<{id: string; content: string; created_at: string}>>([]);

  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMode, setCalendarMode] = useState<'due' | 'start' | 'end' | 'withdrawal'>('due');

  // Recurrence state
  const [selectedWeeklyDays, setSelectedWeeklyDays] = useState<number[]>([]);
  const [customRecurrenceType, setCustomRecurrenceType] = useState<'biweekly' | 'monthly'>('biweekly');
  const [monthlyOption, setMonthlyOption] = useState<'date' | 'weekday'>('date');
  const [monthlyWeekday, setMonthlyWeekday] = useState<'first' | 'second' | 'third' | 'fourth' | 'last'>('first');
  const [monthlyDayOfWeek, setMonthlyDayOfWeek] = useState<number>(1); // Monday

  // Goal Mode (when a goal is selected + goalToggle true)
  const [goalMode, setGoalMode] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);

  useEffect(() => {
    fetchFormData();
    if (initialData) {
      loadInitialData();
    }
  }, [mode, initialData]);

  // Flip goal mode when a goal is chosen while goal toggle is ON
  useEffect(() => {
    const enabled = !!formData.isGoal && !!formData.selectedGoal && !!formData.hasRepeat;
    setGoalMode(enabled);
    if (enabled) {
      // Prefill from goal
      const g = formData.selectedGoal!;
      setFormData(prev => ({
        ...prev,
        title: prev.title || g.title || '',
        selectedRoleIds: g.roles?.map(r => r.id) ?? prev.selectedRoleIds,
        selectedDomainIds: g.domains?.map(d => d.id) ?? prev.selectedDomainIds,
        selectedKeyRelationshipIds: g.keyRelationships?.map(k => k.id) ?? prev.selectedKeyRelationshipIds,
      }));
      // Open the ActionEffortModal to capture weeks/frequency
      setGoalModalVisible(true);
      // Scroll to bottom to show goal area controls
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [formData.isGoal, formData.selectedGoal, formData.hasRepeat]);

  const fetchFormData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { data: rolesData },
        { data: domainsData },
        { data: krData },
        { data: goalsData }
      ] = await Promise.all([
        supabase.from('0008-ap-roles').select('id, label, color').eq('user_id', user.id).eq('is_active', true).order('label'),
        supabase.from('0008-ap-domains').select('id, name').order('name'),
        supabase.from('0008-ap-key-relationships').select('id, name, role_id').eq('user_id', user.id),
        supabase.from('0008-ap-goals-12wk').select('id, title').eq('user_id', user.id).eq('status', 'active').order('title')
      ]);

      setRoles(rolesData || []);
      setDomains(domainsData || []);
      setKeyRelationships(krData || []);
      setTwelveWeekGoals(goalsData || []);

      // Fetch unified goals
      await fetchGoalsUnified();
      await fetchCycleWeeks();
    } catch (error) {
      console.error('Error fetching form data:', error);
      Alert.alert('Error', 'Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  const fetchGoalsUnified = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 12-week goals
    const { data: tw } = await supabase
      .from('0008-ap-goals-12wk')
      .select('id, title')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('title');

    // Custom goals
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
  };

  const fetchCycleWeeks = async () => {
    // Create 12 numbered weeks for now
    const fakeWeeks: CycleWeek[] = Array.from({ length: 12 }, (_, i) => ({
      week_number: i + 1,
      week_start: '',
      week_end: '',
    }));
    setCycleWeeks(fakeWeeks);
  };

  const loadInitialData = () => {
    if (!initialData) return;

    // Handle notes - can be string or array of note objects
    let notesArray: Array<{id: string; content: string; created_at: string}> = [];
    let notesString = '';

    if (Array.isArray(initialData.notes)) {
      notesArray = initialData.notes;
    } else if (typeof initialData.notes === 'string') {
      notesString = initialData.notes;
    }

    setExistingNotes(notesArray);

    // Build formData, handling both edit mode (with id) and create mode (pre-fill only)
    const newFormData: FormData = {
      type: initialData.type || 'task',
      title: initialData.title || '',
      dueDate: initialData.due_date || formatLocalDate(new Date()),
      startDate: initialData.start_date || formatLocalDate(new Date()),
      endDate: initialData.end_date || formatLocalDate(new Date()),
      startTime: initialData.start_time || '',
      endTime: initialData.end_time || '',
      withdrawalDate: initialData.withdrawn_at || formatLocalDate(new Date()),
      amount: initialData.amount?.toString() || '',
      isAnytime: initialData.is_anytime || false,
      isUrgent: initialData.is_urgent || false,
      isImportant: initialData.is_important || false,
      isAuthenticDeposit: initialData.is_authentic_deposit || false,
      isGoal: initialData.is_twelve_week_goal || false,
      hasRepeat: !!initialData.recurrence_rule,
      selectedRoleIds: initialData.roles?.map((r: any) => r.id) || initialData.selectedRoleIds || [],
      selectedDomainIds: initialData.domains?.map((d: any) => d.id) || initialData.selectedDomainIds || [],
      selectedKeyRelationshipIds: initialData.keyRelationships?.map((kr: any) => kr.id) || initialData.selectedKeyRelationshipIds || [],
      selectedGoalIds: initialData.goals?.map((g: any) => g.id) || initialData.selectedGoalIds || [],
      notes: notesString,
      recurrenceRule: initialData.recurrence_rule || undefined,
    };

    setFormData(newFormData);
  };

  const handleCalendarOpen = (mode: 'due' | 'start' | 'end' | 'withdrawal') => {
    setCalendarMode(mode);
    setShowCalendar(true);
  };

  const handleDateSelect = (day: any) => {
    const selectedDate = day.dateString;
    
    switch (calendarMode) {
      case 'due':
        setFormData(prev => ({ ...prev, dueDate: selectedDate }));
        break;
      case 'start':
        setFormData(prev => ({ ...prev, startDate: selectedDate }));
        break;
      case 'end':
        setFormData(prev => ({ ...prev, endDate: selectedDate }));
        break;
      case 'withdrawal':
        setFormData(prev => ({ ...prev, withdrawalDate: selectedDate }));
        break;
    }
    
    setShowCalendar(false);
  };

  const formatDateForDisplay = (dateString: string) => {
    try {
      const date = parseLocalDate(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getMarkedDates = () => {
    const currentDate = (() => {
      switch (calendarMode) {
        case 'due': return formData.dueDate;
        case 'start': return formData.startDate;
        case 'end': return formData.endDate;
        case 'withdrawal': return formData.withdrawalDate;
        default: return formData.dueDate;
      }
    })();

    return {
      [currentDate]: {
        selected: true,
        selectedColor: colors.primary
      }
    };
  };

  const handleMultiSelect = (field: 'selectedRoleIds' | 'selectedDomainIds' | 'selectedKeyRelationshipIds' | 'selectedGoalIds', id: string) => {
    setFormData(prev => {
      const currentSelection = prev[field] as string[];
      const newSelection = currentSelection.includes(id)
        ? currentSelection.filter(itemId => itemId !== id)
        : [...currentSelection, id];
      return { ...prev, [field]: newSelection };
    });
  };

  const handleGoalPick = async (id: string) => {
    const base = availableGoals.find(g => g.id === id);
    if (!base) return;

    setFormData(prev => ({ ...prev, selectedGoal: base }));
  };

  const defaultEventTimes = () => {
    // Start ~ now (rounded to next 15 minutes), end 1 hour later
    const start = new Date();
    const minutes = start.getMinutes();
    const roundUp = (Math.ceil(minutes / 15) * 15) % 60;
    start.setMinutes(roundUp, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { start, end };
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Create the main record based on type
      let mainRecord;
      let mainRecordId;

      if (formData.type === 'withdrawal') {
        const withdrawalPayload = {
          user_id: user.id,
          title: formData.title.trim(),
          amount: parseFloat(formData.amount) || 0,
          withdrawn_at: new Date(formData.withdrawalDate + 'T12:00:00').toISOString(),
          ...(mode === 'edit' && initialData?.id ? { updated_at: new Date().toISOString() } : {})
        };

        if (mode === 'edit' && initialData?.id) {
          const { data, error } = await supabase
            .from('0008-ap-withdrawals')
            .update(withdrawalPayload)
            .eq('id', initialData.id)
            .select()
            .single();
          if (error) throw error;
          mainRecord = data;
        } else {
          const { data, error } = await supabase
            .from('0008-ap-withdrawals')
            .insert(withdrawalPayload)
            .select()
            .single();
          if (error) throw error;
          mainRecord = data;
        }
        mainRecordId = mainRecord.id;
      } else if (formData.type === 'depositIdea') {
        const depositIdeaPayload = {
          user_id: user.id,
          title: formData.title.trim(),
          is_active: true,
          archived: false,
          follow_up: formData.isGoal,
          ...(mode === 'edit' && initialData?.id ? { updated_at: new Date().toISOString() } : {})
        };

        if (mode === 'edit' && initialData?.id) {
          const { data, error } = await supabase
            .from('0008-ap-deposit-ideas')
            .update(depositIdeaPayload)
            .eq('id', initialData.id)
            .select()
            .single();
          if (error) throw error;
          mainRecord = data;
        } else {
          const { data, error } = await supabase
            .from('0008-ap-deposit-ideas')
            .insert(depositIdeaPayload)
            .select()
            .single();
          if (error) throw error;
          mainRecord = data;
        }
        mainRecordId = mainRecord.id;
      } else {
        // Task or Event
        const taskPayload = {
          user_id: user.id,
          title: formData.title.trim(),
          type: formData.type,
          due_date: formData.type === 'task' ? formData.dueDate : null,
          start_date: formData.type === 'event' ? formData.startDate : null,
          end_date: formData.type === 'event' ? formData.endDate : null,
          start_time: formData.startTime || null,
          end_time: formData.endTime || null,
          is_all_day: formData.isAnytime,
          is_urgent: formData.isUrgent,
          is_important: formData.isImportant,
          is_authentic_deposit: formData.isAuthenticDeposit,
          is_twelve_week_goal: formData.isGoal,
          recurrence_rule: formData.recurrenceRule || null,
          status: 'pending',
          ...(mode === 'edit' && initialData?.id ? { updated_at: new Date().toISOString() } : {})
        };

        if (mode === 'edit' && initialData?.id) {
          const { data, error } = await supabase
            .from('0008-ap-tasks')
            .update(taskPayload)
            .eq('id', initialData.id)
            .select()
            .single();
          if (error) throw error;
          mainRecord = data;
        } else {
          const { data, error } = await supabase
            .from('0008-ap-tasks')
            .insert(taskPayload)
            .select()
            .single();
          if (error) throw error;
          mainRecord = data;
        }
        mainRecordId = mainRecord.id;
      }

      // Handle joins for all types
      const parentType = formData.type === 'depositIdea' ? 'depositIdea' : 
                        formData.type === 'withdrawal' ? 'withdrawal' : 'task';

      // Clear existing joins if editing
      if (mode === 'edit' && initialData?.id) {
        await Promise.all([
          supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', mainRecordId).eq('parent_type', parentType),
          supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', mainRecordId).eq('parent_type', parentType),
          supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', mainRecordId).eq('parent_type', parentType),
          supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', mainRecordId).eq('parent_type', parentType),
        ]);
      }

      // Insert new joins
      const joinPromises = [];

      if (formData.selectedRoleIds.length > 0) {
        const roleJoins = formData.selectedRoleIds.map(role_id => ({
          parent_id: mainRecordId,
          parent_type: parentType,
          role_id,
          user_id: user.id,
        }));
        joinPromises.push(supabase.from('0008-ap-universal-roles-join').insert(roleJoins));
      }

      if (formData.selectedDomainIds.length > 0) {
        const domainJoins = formData.selectedDomainIds.map(domain_id => ({
          parent_id: mainRecordId,
          parent_type: parentType,
          domain_id,
          user_id: user.id,
        }));
        joinPromises.push(supabase.from('0008-ap-universal-domains-join').insert(domainJoins));
      }

      if (formData.selectedKeyRelationshipIds.length > 0) {
        const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({
          parent_id: mainRecordId,
          parent_type: parentType,
          key_relationship_id,
          user_id: user.id,
        }));
        joinPromises.push(supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins));
      }

      if (formData.selectedGoalIds.length > 0 && parentType === 'task') {
        const goalJoins = formData.selectedGoalIds.map(twelve_wk_goal_id => ({
          parent_id: mainRecordId,
          parent_type: parentType,
          goal_type: 'twelve_wk_goal',
          twelve_wk_goal_id,
          user_id: user.id,
        }));
        joinPromises.push(supabase.from('0008-ap-universal-goals-join').insert(goalJoins));
      }

      if (joinPromises.length > 0) {
        const results = await Promise.all(joinPromises);
        for (const result of results) {
          if (result.error) throw result.error;
        }
      }

      // Add note if provided
      if (formData.notes.trim()) {
        const { data: noteData, error: noteError } = await supabase
          .from('0008-ap-notes')
          .insert({
            user_id: user.id,
            content: formData.notes.trim(),
          })
          .select()
          .single();

        if (noteError) throw noteError;

        const { error: noteJoinError } = await supabase
          .from('0008-ap-universal-notes-join')
          .insert({
            parent_id: mainRecordId,
            parent_type: parentType,
            note_id: noteData.id,
            user_id: user.id,
          });

        if (noteJoinError) throw noteJoinError;
      }

      Alert.alert('Success', `${formData.type.charAt(0).toUpperCase() + formData.type.slice(1)} ${mode === 'edit' ? 'updated' : 'created'} successfully!`);
      onSubmitSuccess();
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const filteredKeyRelationships = keyRelationships.filter(kr =>
    formData.selectedRoleIds.includes(kr.role_id)
  );

  const renderTypeSelector = () => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>Type</Text>
      <View style={styles.typeSelector}>
        {(['task', 'event', 'depositIdea', 'withdrawal'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.typeButton,
              { borderColor: colors.border },
              formData.type === type && { backgroundColor: colors.primary }
            ]}
            onPress={() => setFormData(prev => ({ ...prev, type }))}
          >
            <Text style={[
              styles.typeButtonText,
              { color: formData.type === type ? '#ffffff' : colors.text }
            ]}>
              {type === 'depositIdea' ? 'Deposit Idea' : type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderDateField = (
    label: string,
    value: string,
    mode: 'due' | 'start' | 'end' | 'withdrawal'
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => handleCalendarOpen(mode)}
      >
        <CalendarIcon size={16} color={colors.textSecondary} />
        <Text style={[styles.dateButtonText, { color: colors.text }]}>
          {formatDateForDisplay(value)}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderTimeField = (label: string, value: string, onChange: (value: string) => void) => (
    <View style={styles.timeField}>
      <Text style={[styles.timeLabel, { color: colors.text }]}>{label}</Text>
      <TextInput
        style={[styles.timeInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        value={value}
        onChangeText={onChange}
        placeholder="HH:MM"
        placeholderTextColor={colors.textSecondary}
      />
    </View>
  );

  const renderSwitchField = (label: string, value: boolean, onChange: (value: boolean) => void) => (
    <View style={styles.switchField}>
      <Text style={[styles.switchLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );

  const renderCheckboxGrid = (
    title: string,
    items: Array<{ id: string; label?: string; name?: string }>,
    selectedIds: string[],
    onToggle: (id: string) => void
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{title}</Text>
      <View style={styles.checkboxGrid}>
        {items.map(item => {
          const isSelected = selectedIds.includes(item.id);
          const displayName = item.label || item.name || '';
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.checkboxItem}
              onPress={() => onToggle(item.id)}
            >
              <View style={[
                styles.checkbox,
                { borderColor: colors.border },
                isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.checkboxLabel, { color: colors.text }]}>{displayName}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Loading...</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose}>
          <X size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {initialData?.id ? 'Edit' : 'New'} {formData.type === 'depositIdea' ? 'Item' : formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}
        </Text>
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary },
            (!formData.title.trim() || saving) && { backgroundColor: colors.textSecondary }
          ]}
          onPress={handleSubmit}
          disabled={!formData.title.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} style={styles.content}>
        <View style={styles.form}>
          {/* Title */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              placeholder="What do you want to do?"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Type Selector */}
          {renderTypeSelector()}

          {/* Switches Row - Only for task and event types */}
          {(formData.type === 'task' || formData.type === 'event') && (
            <>
              <View style={styles.switchesRow}>
                {renderSwitchField('Urgent', formData.isUrgent, (value) => setFormData(prev => ({ ...prev, isUrgent: value })))}
                {renderSwitchField('Important', formData.isImportant, (value) => setFormData(prev => ({ ...prev, isImportant: value })))}
              </View>

              <View style={styles.switchesRow}>
                {renderSwitchField('Authentic Deposit', formData.isAuthenticDeposit, (value) => setFormData(prev => ({ ...prev, isAuthenticDeposit: value })))}
                {renderSwitchField('Goal', formData.isGoal, (value) => setFormData(prev => ({ ...prev, isGoal: value })))}
              </View>
            </>
          )}

          {/* Goal picker (shows when Goal toggle ON) */}
          {formData.isGoal && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Select Goal</Text>
              <View style={styles.goalPickerRow}>
                {availableGoals.length === 0 ? (
                  <Text style={[styles.emptyGoalsText, { color: colors.textSecondary }]}>No active goals</Text>
                ) : (
                  availableGoals.map(g => {
                    const active = formData.selectedGoal?.id === g.id;
                    return (
                      <TouchableOpacity
                        key={`${g.goal_type}-${g.id}`}
                        style={[
                          styles.goalChip,
                          { borderColor: colors.border, backgroundColor: colors.surface },
                          active && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => handleGoalPick(g.id)}
                      >
                        <Text style={[
                          styles.goalChipText,
                          { color: active ? '#ffffff' : colors.text }
                        ]}>
                          {g.title} {g.goal_type === '12week' ? '• 12wk' : '• Custom'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* Date Fields */}
          {formData.type === 'task' && renderDateField('Due Date', formData.dueDate, 'due')}
          {formData.type === 'event' && (
            <View style={styles.dateRow}>
              {renderDateField('Start Date', formData.startDate, 'start')}
              {renderDateField('End Date', formData.endDate, 'end')}
            </View>
          )}
          {formData.type === 'withdrawal' && renderDateField('Withdrawal Date', formData.withdrawalDate, 'withdrawal')}

          {/* Time Fields for Events */}
          {formData.type === 'event' && (
            <View style={styles.timeRow}>
              {renderTimeField('Start Time', formData.startTime, (value) => setFormData(prev => ({ ...prev, startTime: value })))}
              {renderTimeField('End Time', formData.endTime, (value) => setFormData(prev => ({ ...prev, endTime: value })))}
            </View>
          )}

          {/* Anytime toggle for tasks */}
          {formData.type === 'task' && renderSwitchField('Anytime', formData.isAnytime, (value) => setFormData(prev => ({ ...prev, isAnytime: value })))}

          {/* Amount field for withdrawals */}
          {formData.type === 'withdrawal' && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Amount *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={formData.amount}
                onChangeText={(text) => setFormData(prev => ({ ...prev, amount: text }))}
                placeholder="0.0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          )}

          {/* Repeat toggle */}
          {(formData.type === 'task' || formData.type === 'event') && 
            renderSwitchField('Repeat', formData.hasRepeat, (value) => setFormData(prev => ({ ...prev, hasRepeat: value })))
          }

          {/* Inline Recurrence Picker (when Repeat is ON but Goal is OFF) */}
          {formData.hasRepeat && !formData.isGoal && (formData.type === 'task' || formData.type === 'event') && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Repeat Frequency</Text>
              <View style={styles.recurrenceOptions}>
                {(['daily', 'weekly'] as const).map((freq) => (
                  <TouchableOpacity
                    key={freq}
                    style={[
                      styles.recurrenceOption,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      formData.recurrenceRule === `RRULE:FREQ=${freq.toUpperCase()}` && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setFormData(prev => ({ 
                      ...prev, 
                      recurrenceRule: `RRULE:FREQ=${freq.toUpperCase()}` 
                    }))}
                  >
                    <Text style={[
                      styles.recurrenceOptionText,
                      { color: formData.recurrenceRule === `RRULE:FREQ=${freq.toUpperCase()}` ? '#ffffff' : colors.text }
                    ]}>
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.recurrenceOption,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    formData.recurrenceRule?.includes('CUSTOM') && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                  onPress={() => setFormData(prev => ({ 
                    ...prev, 
                    recurrenceRule: 'CUSTOM' 
                  }))}
                >
                  <Text style={[
                    styles.recurrenceOptionText,
                    { color: formData.recurrenceRule?.includes('CUSTOM') ? '#ffffff' : colors.text }
                  ]}>
                    Custom
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Weekly Days Selection */}
              {formData.recurrenceRule?.startsWith('RRULE:FREQ=WEEKLY') && (
                <View style={[styles.weeklyDaysContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.weeklyDaysGrid}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => {
                      const isSelected = selectedWeeklyDays.includes(index);
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.weeklyDayButton,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                            isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
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
                            { color: isSelected ? '#ffffff' : colors.text }
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
                <View style={[styles.customRecurrenceContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.subLabel, { color: colors.text }]}>Custom Frequency</Text>
                  
                  {/* Bi-weekly / Monthly selector */}
                  <View style={[styles.customTypeSelector, { backgroundColor: colors.background }]}>
                    <TouchableOpacity
                      style={[
                        styles.customTypeButton,
                        customRecurrenceType === 'biweekly' && { backgroundColor: colors.primary }
                      ]}
                      onPress={() => setCustomRecurrenceType('biweekly')}
                    >
                      <Text style={[
                        styles.customTypeButtonText,
                        { color: customRecurrenceType === 'biweekly' ? '#ffffff' : colors.textSecondary }
                      ]}>
                        Bi-weekly
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.customTypeButton,
                        customRecurrenceType === 'monthly' && { backgroundColor: colors.primary }
                      ]}
                      onPress={() => setCustomRecurrenceType('monthly')}
                    >
                      <Text style={[
                        styles.customTypeButtonText,
                        { color: customRecurrenceType === 'monthly' ? '#ffffff' : colors.textSecondary }
                      ]}>
                        Monthly
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Bi-weekly options */}
                  {customRecurrenceType === 'biweekly' && (
                    <View style={styles.biweeklyOptions}>
                      <Text style={[styles.subLabel, { color: colors.text }]}>Select Days (every 2 weeks)</Text>
                      <View style={styles.weeklyDaysGrid}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => {
                          const isSelected = selectedWeeklyDays.includes(index);
                          return (
                            <TouchableOpacity
                              key={index}
                              style={[
                                styles.weeklyDayButton,
                                { backgroundColor: colors.surface, borderColor: colors.border },
                                isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
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
                                { color: isSelected ? '#ffffff' : colors.text }
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
                      <Text style={[styles.subLabel, { color: colors.text }]}>Monthly Pattern</Text>
                      
                      {/* Date vs Weekday selector */}
                      <View style={[styles.monthlyTypeSelector, { backgroundColor: colors.background }]}>
                        <TouchableOpacity
                          style={[
                            styles.monthlyTypeButton,
                            monthlyOption === 'date' && { backgroundColor: colors.primary }
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
                            { color: monthlyOption === 'date' ? '#ffffff' : colors.textSecondary }
                          ]}>
                            Same Date
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.monthlyTypeButton,
                            monthlyOption === 'weekday' && { backgroundColor: colors.primary }
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
                            { color: monthlyOption === 'weekday' ? '#ffffff' : colors.textSecondary }
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
                            <Text style={[styles.subLabel, { color: colors.text }]}>Which Week?</Text>
                            <View style={styles.weekSelectorGrid}>
                              {(['first', 'second', 'third', 'fourth', 'last'] as const).map((week) => (
                                <TouchableOpacity
                                  key={week}
                                  style={[
                                    styles.weekSelectorButton,
                                    { backgroundColor: colors.surface, borderColor: colors.border },
                                    monthlyWeekday === week && { backgroundColor: colors.primary, borderColor: colors.primary }
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
                                    { color: monthlyWeekday === week ? '#ffffff' : colors.text }
                                  ]}>
                                    {week.charAt(0).toUpperCase() + week.slice(1)}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>

                          {/* Day of week selector */}
                          <View style={styles.dayOfWeekSelector}>
                            <Text style={[styles.subLabel, { color: colors.text }]}>Which Day?</Text>
                            <View style={styles.weeklyDaysGrid}>
                              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => (
                                <TouchableOpacity
                                  key={index}
                                  style={[
                                    styles.weeklyDayButton,
                                    { backgroundColor: colors.surface, borderColor: colors.border },
                                    monthlyDayOfWeek === index && { backgroundColor: colors.primary, borderColor: colors.primary }
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
                                    { color: monthlyDayOfWeek === index ? '#ffffff' : colors.text }
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

          {/* Roles */}
          {renderCheckboxGrid(
            'Roles',
            roles,
            formData.selectedRoleIds,
            (id) => handleMultiSelect('selectedRoleIds', id)
          )}

          {/* Key Relationships */}
          {filteredKeyRelationships.length > 0 && renderCheckboxGrid(
            'Key Relationships',
            filteredKeyRelationships,
            formData.selectedKeyRelationshipIds,
            (id) => handleMultiSelect('selectedKeyRelationshipIds', id)
          )}

          {/* Domains */}
          {renderCheckboxGrid(
            'Domains',
            domains,
            formData.selectedDomainIds,
            (id) => handleMultiSelect('selectedDomainIds', id)
          )}

          {/* 12-Week Goals */}
          {formData.type === 'task' && formData.isGoal && twelveWeekGoals.length > 0 && renderCheckboxGrid(
            '12-Week Goals',
            twelveWeekGoals,
            formData.selectedGoalIds,
            (id) => handleMultiSelect('selectedGoalIds', id)
          )}

          {/* Notes */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Notes</Text>

            {/* Display existing notes in stacked format */}
            {existingNotes.length > 0 && (
              <View style={styles.existingNotesContainer}>
                {existingNotes.map((note) => (
                  <View key={note.id} style={styles.existingNoteItem}>
                    <Text style={[styles.existingNoteContent, { color: colors.text }]}>{note.content}</Text>
                    <Text style={[styles.existingNoteDate, { color: colors.textSecondary }]}>
                      {new Date(note.created_at).toLocaleDateString('en-US', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })} ({new Date(note.created_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })})
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Add new note */}
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={formData.notes}
              onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
              placeholder={existingNotes.length > 0 ? "Add another note..." : "Add notes..."}
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>
      </ScrollView>

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={[styles.calendarContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.calendarHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.calendarTitle, { color: colors.text }]}>
                Select {calendarMode === 'due' ? 'Due' : calendarMode === 'start' ? 'Start' : calendarMode === 'end' ? 'End' : 'Withdrawal'} Date
              </Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={handleDateSelect}
              markedDates={getMarkedDates()}
              theme={{
                backgroundColor: colors.surface,
                calendarBackground: colors.surface,
                textSectionTitleColor: colors.textSecondary,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: '#ffffff',
                todayTextColor: colors.primary,
                dayTextColor: colors.text,
                textDisabledColor: colors.textSecondary,
                dotColor: colors.primary,
                selectedDotColor: '#ffffff',
                arrowColor: colors.primary,
                disabledArrowColor: colors.textSecondary,
                monthTextColor: colors.text,
                indicatorColor: colors.primary,
                textDayFontWeight: '400',
                textMonthFontWeight: '600',
                textDayHeaderFontWeight: '400',
                textDayFontSize: 16,
                textMonthFontSize: 16,
                textDayHeaderFontSize: 13
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
          createTaskWithWeekPlan={async (payload) => {
            // Store parts on formData and wait for the main Save button
            setFormData(prev => ({
              ...prev,
              title: payload.title ?? prev.title,
              notes: payload.description ?? prev.notes,
              selectedRoleIds: payload.selectedRoleIds ?? prev.selectedRoleIds,
              selectedDomainIds: payload.selectedDomainIds ?? prev.selectedDomainIds,
              selectedKeyRelationshipIds: payload.selectedKeyRelationshipIds ?? prev.selectedKeyRelationshipIds,
              recurrenceRule: payload.recurrenceRule ?? prev.recurrenceRule,
            }));
            return { id: 'temp' };
          }}
          onDelete={undefined}
          initialData={undefined}
          mode="create"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    height: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  switchesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  switchField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    marginHorizontal: 4,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 16,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  timeField: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderRadius: 3,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarContainer: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 350,
    width: '100%',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  goalPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  goalChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyGoalsText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  recurrenceOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  recurrenceOption: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recurrenceOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  weeklyDaysContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
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
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weeklyDayButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  customRecurrenceContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  customTypeSelector: {
    flexDirection: 'row',
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
  customTypeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  biweeklyOptions: {
    marginTop: 12,
  },
  monthlyOptions: {
    marginTop: 12,
  },
  monthlyTypeSelector: {
    flexDirection: 'row',
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
  monthlyTypeButtonText: {
    fontSize: 14,
    fontWeight: '500',
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
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  weekSelectorButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dayOfWeekSelector: {
    alignItems: 'center',
  },
  existingNotesContainer: {
    marginBottom: 12,
  },
  existingNoteItem: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0078d4',
  },
  existingNoteContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  existingNoteDate: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});