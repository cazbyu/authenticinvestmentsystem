import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';
import { X, Calendar as CalendarIcon, Clock, Plus, Minus } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { formatLocalDate } from '@/lib/dateUtils';
import { useTheme } from '@/contexts/ThemeContext';

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
  description?: string;
}

interface TaskEventFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

export default function TaskEventForm({ mode, initialData, onSubmitSuccess, onClose }: TaskEventFormProps) {
  const { colors } = useTheme();
  
  const { colors } = useTheme();
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    type: 'task' as 'task' | 'event' | 'depositIdea' | 'withdrawal',
    dueDate: new Date(),
    startDate: new Date(),
    endDate: new Date(),
    startTime: new Date(),
    endTime: new Date(),
    isAllDay: false,
    isAnytime: false,
    isUrgent: false,
    isImportant: false,
    isAuthenticDeposit: false,
    twelveWeekGoalChecked: false,
    countsTowardWeeklyProgress: false,
    recurrenceType: 'none' as 'none' | 'daily' | 'weekly' | 'monthly',
    notes: '',
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    selectedKeyRelationshipIds: [] as string[],
    selectedGoalIds: [] as string[],
    withdrawalAmount: '',
  });

  // Data states
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [allKeyRelationships, setAllKeyRelationships] = useState<KeyRelationship[]>([]);
  const [allTwelveWeekGoals, setAllTwelveWeekGoals] = useState<TwelveWeekGoal[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // UI states
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<'start' | 'end'>('start');
  const [calendarMode, setCalendarMode] = useState<'due' | 'start' | 'end'>('due');

  useEffect(() => {
    if (initialData) {
      loadInitialData();
    }
    fetchData();
  }, [initialData]);

  const loadInitialData = () => {
    if (!initialData) return;

    setFormData({
      title: initialData.title || '',
      type: initialData.type || 'task',
      dueDate: initialData.due_date ? new Date(initialData.due_date) : new Date(),
      startDate: initialData.start_date ? new Date(initialData.start_date) : new Date(),
      endDate: initialData.end_date ? new Date(initialData.end_date) : new Date(),
      startTime: initialData.start_time ? new Date(initialData.start_time) : new Date(),
      endTime: initialData.end_time ? new Date(initialData.end_time) : new Date(),
      isAllDay: initialData.is_all_day || false,
      isAnytime: initialData.is_anytime || false,
      isUrgent: initialData.is_urgent || false,
      isImportant: initialData.is_important || false,
      isAuthenticDeposit: initialData.is_authentic_deposit || false,
      twelveWeekGoalChecked: initialData.twelveWeekGoalChecked || false,
      countsTowardWeeklyProgress: initialData.countsTowardWeeklyProgress || false,
      recurrenceType: initialData.recurrence_rule ? parseRecurrenceRule(initialData.recurrence_rule) : 'none',
      notes: '',
      selectedRoleIds: initialData.selectedRoleIds || initialData.roles?.map(r => r.id) || [],
      selectedDomainIds: initialData.selectedDomainIds || initialData.domains?.map(d => d.id) || [],
      selectedKeyRelationshipIds: initialData.selectedKeyRelationshipIds || initialData.keyRelationships?.map(kr => kr.id) || [],
      selectedGoalIds: initialData.selectedGoalIds || initialData.goals?.map(g => g.id) || [],
      withdrawalAmount: initialData.amount?.toString() || '',
    });
  };

  const parseRecurrenceRule = (rule: string): 'none' | 'daily' | 'weekly' | 'monthly' => {
    if (!rule) return 'none';
    if (rule.includes('FREQ=DAILY')) return 'daily';
    if (rule.includes('FREQ=WEEKLY')) return 'weekly';
    if (rule.includes('FREQ=MONTHLY')) return 'monthly';
    return 'none';
  };

  const fetchData = async () => {
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
        supabase.from('0008-ap-roles').select('id, label, color').eq('user_id', user.id).eq('is_active', true),
        supabase.from('0008-ap-domains').select('id, name'),
        supabase.from('0008-ap-key-relationships').select('id, name, role_id').eq('user_id', user.id),
        supabase.from('0008-ap-goals-12wk').select('id, title, description').eq('user_id', user.id).eq('status', 'active')
      ]);

      setAllRoles(rolesData || []);
      setAllDomains(domainsData || []);
      setAllKeyRelationships(krData || []);
      setAllTwelveWeekGoals(goalsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
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

  const generateRecurrenceRule = () => {
    switch (formData.recurrenceType) {
      case 'daily':
        return 'RRULE:FREQ=DAILY';
      case 'weekly':
        return 'RRULE:FREQ=WEEKLY';
      case 'monthly':
        return 'RRULE:FREQ=MONTHLY';
      default:
        return null;
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (formData.type === 'withdrawal' && (!formData.withdrawalAmount || parseFloat(formData.withdrawalAmount) <= 0)) {
      Alert.alert('Error', 'Please enter a valid withdrawal amount');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      if (formData.type === 'withdrawal') {
        await handleWithdrawalSubmit(supabase, user);
      } else if (formData.type === 'depositIdea') {
        await handleDepositIdeaSubmit(supabase, user);
      } else {
        await handleTaskEventSubmit(supabase, user);
      }

      Alert.alert('Success', `${formData.type === 'withdrawal' ? 'Withdrawal' : formData.type === 'depositIdea' ? 'Deposit idea' : formData.type} ${mode === 'edit' ? 'updated' : 'created'} successfully!`);
      onSubmitSuccess();
    } catch (error) {
      console.error('Error submitting form:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleWithdrawalSubmit = async (supabase: any, user: any) => {
    const withdrawalPayload = {
      user_id: user.id,
      title: formData.title.trim(),
      amount: parseFloat(formData.withdrawalAmount),
      withdrawal_date: formatLocalDate(formData.dueDate),
      updated_at: new Date().toISOString(),
    };

    let withdrawalData;
    if (mode === 'edit' && initialData?.id) {
      const { data, error } = await supabase
        .from('0008-ap-withdrawals')
        .update(withdrawalPayload)
        .eq('id', initialData.id)
        .select()
        .single();
      if (error) throw error;
      withdrawalData = data;
    } else {
      const { data, error } = await supabase
        .from('0008-ap-withdrawals')
        .insert(withdrawalPayload)
        .select()
        .single();
      if (error) throw error;
      withdrawalData = data;
    }

    await insertJoins(supabase, user, withdrawalData.id, 'withdrawal');
  };

  const handleDepositIdeaSubmit = async (supabase: any, user: any) => {
    const depositIdeaPayload = {
      user_id: user.id,
      title: formData.title.trim(),
      is_active: true,
      archived: false,
      follow_up: formData.twelveWeekGoalChecked,
      updated_at: new Date().toISOString(),
    };

    let depositIdeaData;
    if (mode === 'edit' && initialData?.id) {
      const { data, error } = await supabase
        .from('0008-ap-deposit-ideas')
        .update(depositIdeaPayload)
        .eq('id', initialData.id)
        .select()
        .single();
      if (error) throw error;
      depositIdeaData = data;
    } else {
      const { data, error } = await supabase
        .from('0008-ap-deposit-ideas')
        .insert(depositIdeaPayload)
        .select()
        .single();
      if (error) throw error;
      depositIdeaData = data;
    }

    await insertJoins(supabase, user, depositIdeaData.id, 'depositIdea');
  };

  const handleTaskEventSubmit = async (supabase: any, user: any) => {
    const taskPayload = {
      user_id: user.id,
      title: formData.title.trim(),
      type: formData.type,
      due_date: formData.type === 'task' ? formatLocalDate(formData.dueDate) : null,
      start_date: formData.type === 'event' ? formatLocalDate(formData.startDate) : null,
      end_date: formData.type === 'event' ? formatLocalDate(formData.endDate) : null,
      start_time: (formData.type === 'event' && !formData.isAllDay) ? formData.startTime.toISOString() : null,
      end_time: (formData.type === 'event' && !formData.isAllDay) ? formData.endTime.toISOString() : null,
      is_all_day: formData.isAllDay,
      is_anytime: formData.isAnytime,
      is_urgent: formData.isUrgent,
      is_important: formData.isImportant,
      is_authentic_deposit: formData.isAuthenticDeposit,
      is_twelve_week_goal: formData.twelveWeekGoalChecked,
      recurrence_rule: generateRecurrenceRule(),
      status: 'pending',
      updated_at: new Date().toISOString(),
    };

    let taskData;
    if (mode === 'edit' && initialData?.id) {
      const { data, error } = await supabase
        .from('0008-ap-tasks')
        .update(taskPayload)
        .eq('id', initialData.id)
        .select()
        .single();
      if (error) throw error;
      taskData = data;
    } else {
      const { data, error } = await supabase
        .from('0008-ap-tasks')
        .insert(taskPayload)
        .select()
        .single();
      if (error) throw error;
      taskData = data;
    }

    await insertJoins(supabase, user, taskData.id, 'task');
  };

  const insertJoins = async (supabase: any, user: any, parentId: string, parentType: string) => {
    if (mode === 'edit') {
      await Promise.all([
        supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', parentId).eq('parent_type', parentType),
        supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', parentId).eq('parent_type', parentType),
        supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', parentId).eq('parent_type', parentType),
        supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', parentId).eq('parent_type', parentType),
      ]);
    }

    const roleJoins = formData.selectedRoleIds.map(role_id => ({ 
      parent_id: parentId, 
      parent_type: parentType, 
      role_id, 
      user_id: user.id 
    }));
    const domainJoins = formData.selectedDomainIds.map(domain_id => ({ 
      parent_id: parentId, 
      parent_type: parentType, 
      domain_id, 
      user_id: user.id 
    }));
    const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ 
      parent_id: parentId, 
      parent_type: parentType, 
      key_relationship_id, 
      user_id: user.id 
    }));
    const goalJoins = formData.selectedGoalIds.map(goal_id => ({ 
      parent_id: parentId, 
      parent_type: parentType, 
      goal_id, 
      user_id: user.id 
    }));

    if (formData.notes && formData.notes.trim()) {
      const { data: noteData, error: noteError } = await supabase
        .from('0008-ap-notes')
        .insert({ user_id: user.id, content: formData.notes })
        .select()
        .single();
      
      if (noteError) throw noteError;
      
      await supabase
        .from('0008-ap-universal-notes-join')
        .insert({ 
          parent_id: parentId, 
          parent_type: parentType, 
          note_id: noteData.id, 
          user_id: user.id 
        });
    }

    if (roleJoins.length > 0) {
      await supabase.from('0008-ap-universal-roles-join').insert(roleJoins);
    }
    if (domainJoins.length > 0) {
      await supabase.from('0008-ap-universal-domains-join').insert(domainJoins);
    }
    if (krJoins.length > 0) {
      await supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins);
    }
    if (goalJoins.length > 0) {
      await supabase.from('0008-ap-universal-goals-join').insert(goalJoins);
    }
  };

  const filteredKeyRelationships = allKeyRelationships.filter(kr => 
    formData.selectedRoleIds.includes(kr.role_id)
  );

  const formatDateForInput = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTimeForInput = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleDateChange = (selectedDate: any) => {
    const date = new Date(selectedDate.timestamp);
    
    if (calendarMode === 'due') {
      setFormData(prev => ({ ...prev, dueDate: date }));
    } else if (calendarMode === 'start') {
      setFormData(prev => ({ ...prev, startDate: date }));
    } else if (calendarMode === 'end') {
      setFormData(prev => ({ ...prev, endDate: date }));
    }
    
    setShowCalendar(false);
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (selectedTime) {
      if (timePickerMode === 'start') {
        setFormData(prev => ({ ...prev, startTime: selectedTime }));
      } else {
        setFormData(prev => ({ ...prev, endTime: selectedTime }));
      }
    }
    setShowTimePicker(false);
  };

  const getFormTitle = () => {
    if (formData.type === 'withdrawal') {
      return mode === 'edit' ? 'Edit Withdrawal' : 'New Withdrawal';
    } else if (formData.type === 'depositIdea') {
      return mode === 'edit' ? 'Edit Deposit Idea' : 'New Deposit Idea';
    } else {
      return mode === 'edit' ? `Edit ${formData.type}` : `New ${formData.type}`;
    }
  };

  return (
    <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{getFormTitle()}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading form data...</Text>
          </View>
        ) : (
          <ScrollView style={[styles.content, { backgroundColor: colors.background }]}>
            <View style={styles.form}>
              {/* Type Selector */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>Type</Text>
                <View style={styles.typeSelector}>
                  {(['task', 'event', 'depositIdea', 'withdrawal'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        { borderColor: colors.border },
                        formData.type === type && { backgroundColor: colors.primary, borderColor: colors.primary }
                      ]}
                      onPress={() => setFormData(prev => ({ ...prev, type }))}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        { color: colors.text },
                        formData.type === type && { color: '#ffffff' }
                      ]}>
                        {type === 'depositIdea' ? 'Deposit Idea' : type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Title */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {formData.type === 'withdrawal' ? 'Reason' : 'Title'} *
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={formData.title}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                  placeholder={formData.type === 'withdrawal' ? 'Enter withdrawal reason' : 'Enter title'}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* Withdrawal Amount */}
              {formData.type === 'withdrawal' && (
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Amount *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={formData.withdrawalAmount}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, withdrawalAmount: text }))}
                    placeholder="0.0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}

              {/* Date Fields */}
              {formData.type === 'task' && (
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Due Date</Text>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => {
                      setCalendarMode('due');
                      setShowCalendar(true);
                    }}
                  >
                    <CalendarIcon size={16} color={colors.primary} />
                    <Text style={[styles.dateButtonText, { color: colors.text }]}>
                      {formatDateForInput(formData.dueDate)}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {formData.type === 'event' && (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.text }]}>Start Date</Text>
                    <TouchableOpacity
                      style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => {
                        setCalendarMode('start');
                        setShowCalendar(true);
                      }}
                    >
                      <CalendarIcon size={16} color={colors.primary} />
                      <Text style={[styles.dateButtonText, { color: colors.text }]}>
                        {formatDateForInput(formData.startDate)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.text }]}>End Date</Text>
                    <TouchableOpacity
                      style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => {
                        setCalendarMode('end');
                        setShowCalendar(true);
                      }}
                    >
                      <CalendarIcon size={16} color={colors.primary} />
                      <Text style={[styles.dateButtonText, { color: colors.text }]}>
                        {formatDateForInput(formData.endDate)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Time Fields for Events */}
              {formData.type === 'event' && !formData.isAllDay && (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.text }]}>Start Time</Text>
                    <TouchableOpacity
                      style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => {
                        setTimePickerMode('start');
                        setShowTimePicker(true);
                      }}
                    >
                      <Clock size={16} color={colors.primary} />
                      <Text style={[styles.dateButtonText, { color: colors.text }]}>
                        {formatTimeForInput(formData.startTime)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.text }]}>End Time</Text>
                    <TouchableOpacity
                      style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => {
                        setTimePickerMode('end');
                        setShowTimePicker(true);
                      }}
                    >
                      <Clock size={16} color={colors.primary} />
                      <Text style={[styles.dateButtonText, { color: colors.text }]}>
                        {formatTimeForInput(formData.endTime)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* All Day Toggle for Events */}
              {formData.type === 'event' && (
                <View style={styles.field}>
                  <View style={styles.switchRow}>
                    <Text style={[styles.label, { color: colors.text }]}>All Day</Text>
                    <Switch
                      value={formData.isAllDay}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, isAllDay: value }))}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.surface}
                    />
                  </View>
                </View>
              )}

              {/* Anytime Toggle for Tasks */}
              {formData.type === 'task' && (
                <View style={styles.field}>
                  <View style={styles.switchRow}>
                    <Text style={[styles.label, { color: colors.text }]}>Anytime</Text>
                    <Switch
                      value={formData.isAnytime}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, isAnytime: value }))}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.surface}
                    />
                  </View>
                </View>
              )}

              {/* Priority Toggles */}
              {(formData.type === 'task' || formData.type === 'event') && (
                <>
                  <View style={styles.field}>
                    <View style={styles.switchRow}>
                      <Text style={[styles.label, { color: colors.text }]}>Urgent</Text>
                      <Switch
                        value={formData.isUrgent}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, isUrgent: value }))}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={colors.surface}
                      />
                    </View>
                  </View>

                  <View style={styles.field}>
                    <View style={styles.switchRow}>
                      <Text style={[styles.label, { color: colors.text }]}>Important</Text>
                      <Switch
                        value={formData.isImportant}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, isImportant: value }))}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={colors.surface}
                      />
                    </View>
                  </View>

                  <View style={styles.field}>
                    <View style={styles.switchRow}>
                      <Text style={[styles.label, { color: colors.text }]}>Authentic Deposit</Text>
                      <Switch
                        value={formData.isAuthenticDeposit}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, isAuthenticDeposit: value }))}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={colors.surface}
                      />
                    </View>
                  </View>
                </>
              )}

              {/* 12-Week Goal Toggle */}
              {(formData.type === 'task' || formData.type === 'depositIdea') && (
                <View style={styles.field}>
                  <View style={styles.switchRow}>
                    <Text style={[styles.label, { color: colors.text }]}>12-Week Goal</Text>
                    <Switch
                      value={formData.twelveWeekGoalChecked}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, twelveWeekGoalChecked: value }))}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.surface}
                    />
                  </View>
                </View>
              )}

              {/* Recurrence */}
              {(formData.type === 'task' || formData.type === 'event') && (
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Recurrence</Text>
                  <View style={styles.recurrenceSelector}>
                    {(['none', 'daily', 'weekly', 'monthly'] as const).map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.recurrenceButton,
                          { borderColor: colors.border },
                          formData.recurrenceType === type && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setFormData(prev => ({ ...prev, recurrenceType: type }))}
                      >
                        <Text style={[
                          styles.recurrenceButtonText,
                          { color: colors.text },
                          formData.recurrenceType === type && { color: '#ffffff' }
                        ]}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Roles */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>Roles</Text>
                <View style={styles.checkboxGrid}>
                  {allRoles.map(role => {
                    const isSelected = formData.selectedRoleIds.includes(role.id);
                    return (
                      <TouchableOpacity
                        key={role.id}
                        style={styles.checkItem}
                        onPress={() => handleMultiSelect('selectedRoleIds', role.id)}
                      >
                        <View style={[styles.checkbox, { borderColor: colors.border }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={[styles.checkLabel, { color: colors.text }]}>{role.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Key Relationships */}
              {filteredKeyRelationships.length > 0 && (
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Key Relationships</Text>
                  <View style={styles.checkboxGrid}>
                    {filteredKeyRelationships.map(kr => {
                      const isSelected = formData.selectedKeyRelationshipIds.includes(kr.id);
                      return (
                        <TouchableOpacity
                          key={kr.id}
                          style={styles.checkItem}
                          onPress={() => handleMultiSelect('selectedKeyRelationshipIds', kr.id)}
                        >
                          <View style={[styles.checkbox, { borderColor: colors.border }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <Text style={[styles.checkLabel, { color: colors.text }]}>{kr.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Domains */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>Domains</Text>
                <View style={styles.checkboxGrid}>
                  {allDomains.map(domain => {
                    const isSelected = formData.selectedDomainIds.includes(domain.id);
                    return (
                      <TouchableOpacity
                        key={domain.id}
                        style={styles.checkItem}
                        onPress={() => handleMultiSelect('selectedDomainIds', domain.id)}
                      >
                        <View style={[styles.checkbox, { borderColor: colors.border }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={[styles.checkLabel, { color: colors.text }]}>{domain.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 12-Week Goals */}
              {formData.twelveWeekGoalChecked && allTwelveWeekGoals.length > 0 && (
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>12-Week Goals</Text>
                  <View style={styles.checkboxGrid}>
                    {allTwelveWeekGoals.map(goal => {
                      const isSelected = formData.selectedGoalIds.includes(goal.id);
                      return (
                        <TouchableOpacity
                          key={goal.id}
                          style={styles.checkItem}
                          onPress={() => handleMultiSelect('selectedGoalIds', goal.id)}
                        >
                          <View style={[styles.checkbox, { borderColor: colors.border }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <Text style={[styles.checkLabel, { color: colors.text }]}>{goal.title}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Notes */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={formData.notes}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                  placeholder="Add notes..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </ScrollView>
        )}

        <View style={[styles.actions, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity 
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary },
              (!formData.title.trim() || saving) && { backgroundColor: colors.textSecondary }
            ]}
            onPress={handleSubmit}
            disabled={!formData.title.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === 'edit' ? 'Update' : 'Create'} {formData.type === 'depositIdea' ? 'Deposit Idea' : formData.type}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Calendar Modal */}
        <Modal visible={showCalendar} transparent animationType="fade">
          <View style={styles.calendarOverlay}>
            <View style={[styles.calendarContainer, { backgroundColor: colors.surface }]}>
              <View style={[styles.calendarHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.calendarTitle, { color: colors.text }]}>
                  Select {calendarMode === 'due' ? 'Due' : calendarMode === 'start' ? 'Start' : 'End'} Date
                </Text>
                <TouchableOpacity onPress={() => setShowCalendar(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Calendar
                onDayPress={handleDateChange}
                markedDates={{
                  [formatLocalDate(
                    calendarMode === 'due' ? formData.dueDate :
                    calendarMode === 'start' ? formData.startDate :
                    formData.endDate
                  )]: {
                    selected: true,
                    selectedColor: colors.primary
                  }
                }}
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
                }}
              />
            </View>
          </View>
        </Modal>

        {/* Time Picker Modal */}
        <Modal visible={showTimePicker} transparent animationType="fade">
          <View style={styles.timePickerOverlay}>
            <View style={[styles.timePickerContainer, { backgroundColor: colors.surface }]}>
              <View style={[styles.timePickerHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.timePickerTitle, { color: colors.text }]}>
                  Select {timePickerMode === 'start' ? 'Start' : 'End'} Time
                </Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={timePickerMode === 'start' ? formData.startTime : formData.endTime}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                style={styles.timePicker}
              />
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
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
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
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
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recurrenceSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recurrenceButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  recurrenceButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  checkItem: {
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
  checkLabel: {
    fontSize: 14,
    flex: 1,
  },
  actions: {
    padding: 16,
    borderTopWidth: 1,
  },
  submitButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  timePickerContainer: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 300,
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  timePickerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  timePicker: {
    padding: 20,
  },
});