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
import { Calendar } from 'react-native-calendars';
import { X, Calendar as CalendarIcon, Clock, ChevronDown, ChevronUp } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { formatLocalDate, parseLocalDate } from '@/lib/dateUtils';

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

interface Goal {
  id: string;
  title: string;
  goal_type: '12week' | 'custom';
  timeline_id?: string;
}

interface TaskEventFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

export default function TaskEventForm({ mode, initialData, onSubmitSuccess, onClose }: TaskEventFormProps) {
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    type: 'task' as 'task' | 'event' | 'depositIdea' | 'withdrawal',
    dueDate: formatLocalDate(new Date()),
    startDate: formatLocalDate(new Date()),
    endDate: formatLocalDate(new Date()),
    startTime: '',
    endTime: '',
    isAllDay: false,
    isAnytime: false,
    isUrgent: false,
    isImportant: false,
    isAuthenticDeposit: false,
    isTwelveWeekGoal: false,
    countsTowardWeeklyProgress: false,
    notes: '',
    amount: '',
    withdrawalDate: new Date(),
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    selectedKeyRelationshipIds: [] as string[],
    selectedGoalIds: [] as string[],
    recurrenceType: 'none' as 'none' | 'daily' | 'weekly' | 'monthly',
    recurrenceInterval: 1,
    recurrenceEndDate: '',
    weeklyDays: [] as number[],
  });

  // Data states
  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [availableGoals, setAvailableGoals] = useState<Goal[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [showStartTimeCalendar, setShowStartTimeCalendar] = useState(false);
  const [showEndTimeCalendar, setShowEndTimeCalendar] = useState(false);
  const [showRecurrenceEndCalendar, setShowRecurrenceEndCalendar] = useState(false);
  const [showGoalDropdown, setShowGoalDropdown] = useState(false);

  // Derived state
  const selectedGoalId = formData.selectedGoalIds[0] || null;
  const filteredKeyRelationships = keyRelationships.filter(kr =>
    formData.selectedRoleIds.includes(kr.role_id)
  );

  useEffect(() => {
    fetchData();
    if (initialData) {
      loadInitialData();
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { data: rolesData },
        { data: domainsData },
        { data: krData }
      ] = await Promise.all([
        supabase.from('0008-ap-roles').select('id, label, color').eq('user_id', user.id).eq('is_active', true).order('label'),
        supabase.from('0008-ap-domains').select('id, name').order('name'),
        supabase.from('0008-ap-key-relationships').select('id, name, role_id').eq('user_id', user.id)
      ]);

      setRoles(rolesData || []);
      setDomains(domainsData || []);
      setKeyRelationships(krData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAvailableGoals = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const allGoals: Goal[] = [];

      // Fetch 12-week goals with correct timeline ID
      const { data: twelveWeekGoals, error: twelveWeekError } = await supabase
        .from('0008-ap-goals-12wk')
        .select('id, title, user_global_timeline_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('title');

      if (twelveWeekError) {
        console.error('Error fetching 12-week goals:', twelveWeekError);
      } else if (twelveWeekGoals) {
        console.log('Fetched 12-week goals:', twelveWeekGoals.map(g => ({ id: g.id, title: g.title })));
        
        twelveWeekGoals.forEach(goal => {
          allGoals.push({
            id: goal.id,
            title: goal.title,
            goal_type: '12week',
            timeline_id: goal.user_global_timeline_id,
          });
        });
      }

      // Fetch custom goals with correct timeline ID
      const { data: customGoals, error: customError } = await supabase
        .from('0008-ap-goals-custom')
        .select('id, title, custom_timeline_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('title');

      if (customError) {
        console.error('Error fetching custom goals:', customError);
      } else if (customGoals) {
        console.log('Fetched custom goals:', customGoals.map(g => ({ id: g.id, title: g.title })));
        
        customGoals.forEach(goal => {
          allGoals.push({
            id: goal.id,
            title: goal.title,
            goal_type: 'custom',
            timeline_id: goal.custom_timeline_id,
          });
        });
      }

      console.log('Final combined goals list:', allGoals.map(g => ({ id: g.id, title: g.title, goal_type: g.goal_type })));
      setAvailableGoals(allGoals);
    } catch (error) {
      console.error('Error fetching goals:', error);
      setAvailableGoals([]);
    }
  };

  const loadInitialData = () => {
    if (!initialData) return;

    setFormData({
      title: initialData.title || '',
      type: initialData.type || 'task',
      dueDate: initialData.due_date || formatLocalDate(new Date()),
      startDate: initialData.start_date || formatLocalDate(new Date()),
      endDate: initialData.end_date || formatLocalDate(new Date()),
      startTime: initialData.start_time ? formatTimeForInput(initialData.start_time) : '',
      endTime: initialData.end_time ? formatTimeForInput(initialData.end_time) : '',
      isAllDay: initialData.is_all_day || false,
      isAnytime: initialData.is_anytime || false,
      isUrgent: initialData.is_urgent || false,
      isImportant: initialData.is_important || false,
      isAuthenticDeposit: initialData.is_authentic_deposit || false,
      isTwelveWeekGoal: initialData.is_twelve_week_goal || false,
      countsTowardWeeklyProgress: initialData.counts_toward_weekly_progress || false,
      notes: initialData.notes || '',
      amount: initialData.amount?.toString() || '',
      withdrawalDate: initialData.withdrawal_date ? new Date(initialData.withdrawal_date) : new Date(),
      selectedRoleIds: initialData.selectedRoleIds || initialData.roles?.map(r => r.id) || [],
      selectedDomainIds: initialData.selectedDomainIds || initialData.domains?.map(d => d.id) || [],
      selectedKeyRelationshipIds: initialData.selectedKeyRelationshipIds || initialData.keyRelationships?.map(kr => kr.id) || [],
      selectedGoalIds: initialData.selectedGoalIds || [],
      recurrenceType: parseRecurrenceRule(initialData.recurrence_rule).type,
      recurrenceInterval: parseRecurrenceRule(initialData.recurrence_rule).interval,
      recurrenceEndDate: parseRecurrenceRule(initialData.recurrence_rule).endDate,
      weeklyDays: parseRecurrenceRule(initialData.recurrence_rule).weeklyDays,
    });

    // Fetch goals when editing and goal toggle should be on
    if (initialData.selectedGoalIds?.length > 0 || initialData.is_twelve_week_goal) {
      fetchAllAvailableGoals();
    }
  };

  const parseRecurrenceRule = (rrule?: string) => {
    if (!rrule) {
      return {
        type: 'none' as const,
        interval: 1,
        endDate: '',
        weeklyDays: [] as number[],
      };
    }

    // Parse basic RRULE format
    const parts = rrule.replace('RRULE:', '').split(';');
    const parsed = {
      type: 'none' as 'none' | 'daily' | 'weekly' | 'monthly',
      interval: 1,
      endDate: '',
      weeklyDays: [] as number[],
    };

    for (const part of parts) {
      const [key, value] = part.split('=');
      switch (key) {
        case 'FREQ':
          if (value === 'DAILY') parsed.type = 'daily';
          else if (value === 'WEEKLY') parsed.type = 'weekly';
          else if (value === 'MONTHLY') parsed.type = 'monthly';
          break;
        case 'INTERVAL':
          parsed.interval = parseInt(value) || 1;
          break;
        case 'UNTIL':
          // Convert YYYYMMDD to YYYY-MM-DD
          if (value.length === 8) {
            const year = value.substring(0, 4);
            const month = value.substring(4, 6);
            const day = value.substring(6, 8);
            parsed.endDate = `${year}-${month}-${day}`;
          }
          break;
        case 'BYDAY':
          const dayMap = { 'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6 };
          parsed.weeklyDays = value.split(',').map(day => dayMap[day]).filter(d => d !== undefined);
          break;
      }
    }

    return parsed;
  };

  const formatTimeForInput = (timeString: string) => {
    try {
      const date = new Date(timeString);
      return date.toTimeString().substring(0, 5); // HH:MM format
    } catch {
      return '';
    }
  };

  const handleMultiSelect = (field: string, id: string) => {
    setFormData(prev => {
      const currentSelection = prev[field] as string[];
      const newSelection = currentSelection.includes(id)
        ? currentSelection.filter(itemId => itemId !== id)
        : [...currentSelection, id];
      return { ...prev, [field]: newSelection };
    });
  };

  const handleGoalToggle = (enabled: boolean) => {
    if (enabled) {
      fetchAllAvailableGoals();
    } else {
      setFormData(prev => ({ ...prev, selectedGoalIds: [] }));
      setAvailableGoals([]);
    }
  };

  const handleGoalSelect = (goalId: string) => {
    setFormData(prev => ({ ...prev, selectedGoalIds: [goalId] }));
    setShowGoalDropdown(false);
  };

  const generateRecurrenceRule = () => {
    if (formData.recurrenceType === 'none') return null;

    let rrule = `RRULE:FREQ=${formData.recurrenceType.toUpperCase()}`;
    
    if (formData.recurrenceInterval > 1) {
      rrule += `;INTERVAL=${formData.recurrenceInterval}`;
    }

    if (formData.recurrenceType === 'weekly' && formData.weeklyDays.length > 0) {
      const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const byDays = formData.weeklyDays.map(day => dayNames[day]).join(',');
      rrule += `;BYDAY=${byDays}`;
    }

    if (formData.recurrenceEndDate) {
      // Convert YYYY-MM-DD to YYYYMMDD
      const endDate = formData.recurrenceEndDate.replace(/-/g, '');
      rrule += `;UNTIL=${endDate}`;
    }

    return rrule;
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

      if (formData.type === 'depositIdea') {
        await handleDepositIdeaSubmit(supabase, user);
      } else if (formData.type === 'withdrawal') {
        await handleWithdrawalSubmit(supabase, user);
      } else {
        await handleTaskEventSubmit(supabase, user);
      }

      Alert.alert('Success', `${formData.type} ${mode === 'edit' ? 'updated' : 'created'} successfully`);
      onSubmitSuccess();
    } catch (error) {
      console.error('Error submitting form:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleTaskEventSubmit = async (supabase: any, user: any) => {
    const taskData = {
      user_id: user.id,
      title: formData.title.trim(),
      type: formData.type,
      due_date: formData.type === 'task' ? formData.dueDate : null,
      start_date: formData.type === 'event' ? formData.startDate : null,
      end_date: formData.type === 'event' ? formData.endDate : null,
      start_time: formData.startTime ? `${formData.startDate}T${formData.startTime}:00` : null,
      end_time: formData.endTime ? `${formData.endDate}T${formData.endTime}:00` : null,
      is_all_day: formData.isAllDay,
      is_anytime: formData.isAnytime,
      is_urgent: formData.isUrgent,
      is_important: formData.isImportant,
      is_authentic_deposit: formData.isAuthenticDeposit,
      is_twelve_week_goal: formData.isTwelveWeekGoal,
      status: 'pending',
      recurrence_rule: generateRecurrenceRule(),
      updated_at: new Date().toISOString(),
    };

    let taskId: string;

    if (mode === 'edit' && initialData?.id) {
      // Update existing task
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update(taskData)
        .eq('id', initialData.id);

      if (error) throw error;
      taskId = initialData.id;

      // Clear existing joins for update
      await Promise.all([
        supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
      ]);
    } else {
      // Create new task
      const { data, error } = await supabase
        .from('0008-ap-tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;
      taskId = data.id;
    }

    // Handle joins
    await Promise.all([
      insertJoins(supabase, user.id, taskId, 'task', 'role_id', formData.selectedRoleIds, '0008-ap-universal-roles-join'),
      insertJoins(supabase, user.id, taskId, 'task', 'domain_id', formData.selectedDomainIds, '0008-ap-universal-domains-join'),
      insertJoins(supabase, user.id, taskId, 'task', 'key_relationship_id', formData.selectedKeyRelationshipIds, '0008-ap-universal-key-relationships-join'),
    ]);

    // Handle goal joins
    if (formData.selectedGoalIds.length > 0) {
      const selectedGoal = availableGoals.find(g => g.id === formData.selectedGoalIds[0]);
      if (selectedGoal) {
        const goalJoinData = {
          parent_id: taskId,
          parent_type: 'task',
          user_id: user.id,
          goal_type: selectedGoal.goal_type === '12week' ? 'twelve_wk_goal' : 'custom_goal',
          twelve_wk_goal_id: selectedGoal.goal_type === '12week' ? selectedGoal.id : null,
          custom_goal_id: selectedGoal.goal_type === 'custom' ? selectedGoal.id : null,
        };

        const { error: goalJoinError } = await supabase
          .from('0008-ap-universal-goals-join')
          .insert(goalJoinData);

        if (goalJoinError) throw goalJoinError;
      }
    }

    // Add note if provided
    if (formData.notes.trim()) {
      const { data: noteData, error: noteError } = await supabase
        .from('0008-ap-notes')
        .insert({ user_id: user.id, content: formData.notes.trim() })
        .select()
        .single();

      if (noteError) throw noteError;

      await supabase
        .from('0008-ap-universal-notes-join')
        .insert({
          parent_id: taskId,
          parent_type: 'task',
          note_id: noteData.id,
          user_id: user.id,
        });
    }
  };

  const handleDepositIdeaSubmit = async (supabase: any, user: any) => {
    const depositIdeaData = {
      user_id: user.id,
      title: formData.title.trim(),
      is_active: true,
      archived: false,
      follow_up: false,
      updated_at: new Date().toISOString(),
    };

    let depositIdeaId: string;

    if (mode === 'edit' && initialData?.id) {
      // Update existing deposit idea
      const { error } = await supabase
        .from('0008-ap-deposit-ideas')
        .update(depositIdeaData)
        .eq('id', initialData.id);

      if (error) throw error;
      depositIdeaId = initialData.id;

      // Clear existing joins for update
      await Promise.all([
        supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
        supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
        supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
      ]);
    } else {
      // Create new deposit idea
      const { data, error } = await supabase
        .from('0008-ap-deposit-ideas')
        .insert(depositIdeaData)
        .select()
        .single();

      if (error) throw error;
      depositIdeaId = data.id;
    }

    // Handle joins
    await Promise.all([
      insertJoins(supabase, user.id, depositIdeaId, 'depositIdea', 'role_id', formData.selectedRoleIds, '0008-ap-universal-roles-join'),
      insertJoins(supabase, user.id, depositIdeaId, 'depositIdea', 'domain_id', formData.selectedDomainIds, '0008-ap-universal-domains-join'),
      insertJoins(supabase, user.id, depositIdeaId, 'depositIdea', 'key_relationship_id', formData.selectedKeyRelationshipIds, '0008-ap-universal-key-relationships-join'),
    ]);

    // Add note if provided
    if (formData.notes.trim()) {
      const { data: noteData, error: noteError } = await supabase
        .from('0008-ap-notes')
        .insert({ user_id: user.id, content: formData.notes.trim() })
        .select()
        .single();

      if (noteError) throw noteError;

      await supabase
        .from('0008-ap-universal-notes-join')
        .insert({
          parent_id: depositIdeaId,
          parent_type: 'depositIdea',
          note_id: noteData.id,
          user_id: user.id,
        });
    }
  };

  const handleWithdrawalSubmit = async (supabase: any, user: any) => {
    const withdrawalData = {
      user_id: user.id,
      title: formData.title.trim(),
      amount: parseFloat(formData.amount),
      withdrawal_date: formData.withdrawalDate.toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    };

    let withdrawalId: string;

    if (mode === 'edit' && initialData?.id) {
      // Update existing withdrawal
      const { error } = await supabase
        .from('0008-ap-withdrawals')
        .update(withdrawalData)
        .eq('id', initialData.id);

      if (error) throw error;
      withdrawalId = initialData.id;

      // Clear existing joins for update
      await Promise.all([
        supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
        supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
        supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
      ]);
    } else {
      // Create new withdrawal
      const { data, error } = await supabase
        .from('0008-ap-withdrawals')
        .insert(withdrawalData)
        .select()
        .single();

      if (error) throw error;
      withdrawalId = data.id;
    }

    // Handle joins
    await Promise.all([
      insertJoins(supabase, user.id, withdrawalId, 'withdrawal', 'role_id', formData.selectedRoleIds, '0008-ap-universal-roles-join'),
      insertJoins(supabase, user.id, withdrawalId, 'withdrawal', 'domain_id', formData.selectedDomainIds, '0008-ap-universal-domains-join'),
      insertJoins(supabase, user.id, withdrawalId, 'withdrawal', 'key_relationship_id', formData.selectedKeyRelationshipIds, '0008-ap-universal-key-relationships-join'),
    ]);

    // Add note if provided
    if (formData.notes.trim()) {
      const { data: noteData, error: noteError } = await supabase
        .from('0008-ap-notes')
        .insert({ user_id: user.id, content: formData.notes.trim() })
        .select()
        .single();

      if (noteError) throw noteError;

      await supabase
        .from('0008-ap-universal-notes-join')
        .insert({
          parent_id: withdrawalId,
          parent_type: 'withdrawal',
          note_id: noteData.id,
          user_id: user.id,
        });
    }
  };

  const insertJoins = async (
    supabase: any,
    userId: string,
    parentId: string,
    parentType: string,
    foreignKeyField: string,
    selectedIds: string[],
    tableName: string
  ) => {
    if (selectedIds.length === 0) return;

    const joins = selectedIds.map(id => ({
      parent_id: parentId,
      parent_type: parentType,
      [foreignKeyField]: id,
      user_id: userId,
    }));

    const { error } = await supabase
      .from(tableName)
      .insert(joins);

    if (error) throw error;
  };

  const formatDateForDisplay = (dateString: string) => {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTimeForDisplay = (timeString: string) => {
    if (!timeString) return 'Not set';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getSelectedGoal = () => {
    return availableGoals.find(goal => goal.id === selectedGoalId);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {mode === 'edit' ? 'Edit' : 'Create'} {formData.type === 'depositIdea' ? 'Deposit Idea' : formData.type === 'withdrawal' ? 'Withdrawal' : formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <X size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0078d4" />
            <Text style={styles.loadingText}>Loading form data...</Text>
          </View>
        ) : (
          <View style={styles.form}>
            {/* Title */}
            <View style={styles.field}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                placeholder={`Enter ${formData.type} title`}
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Form Type Pills */}
            <View style={styles.formTypePills}>
              <TouchableOpacity
                style={[
                  styles.formTypePill,
                  formData.type === 'task' && styles.activeFormTypePill
                ]}
                onPress={() => setFormData(prev => ({ ...prev, type: 'task' }))}
              >
                <Text style={[
                  styles.formTypePillText,
                  formData.type === 'task' && styles.activeFormTypePillText
                ]}>
                  Task
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.formTypePill,
                  formData.type === 'event' && styles.activeFormTypePill
                ]}
                onPress={() => setFormData(prev => ({ ...prev, type: 'event' }))}
              >
                <Text style={[
                  styles.formTypePillText,
                  formData.type === 'event' && styles.activeFormTypePillText
                ]}>
                  Event
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.formTypePill,
                  formData.type === 'depositIdea' && styles.activeFormTypePill
                ]}
                onPress={() => setFormData(prev => ({ ...prev, type: 'depositIdea' }))}
              >
                <Text style={[
                  styles.formTypePillText,
                  formData.type === 'depositIdea' && styles.activeFormTypePillText
                ]}>
                  Deposit Idea
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.formTypePill,
                  formData.type === 'withdrawal' && styles.activeFormTypePill
                ]}
                onPress={() => setFormData(prev => ({ ...prev, type: 'withdrawal' }))}
              >
                <Text style={[
                  styles.formTypePillText,
                  formData.type === 'withdrawal' && styles.activeFormTypePillText
                ]}>
                  Withdrawal
                </Text>
              </TouchableOpacity>
            </View>

            {/* Goal Selection */}
            {(formData.type === 'task' || formData.type === 'event') && (
              <View style={styles.field}>
                <View style={styles.toggleRow}>
                  <Text style={styles.label}>Link to Goal</Text>
                  <Switch
                    value={formData.selectedGoalIds.length > 0}
                    onValueChange={handleGoalToggle}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor="#ffffff"
                  />
                </View>

                {formData.selectedGoalIds.length > 0 && (
                  <View style={styles.goalSelection}>
                    <TouchableOpacity
                      style={styles.goalDropdown}
                      onPress={() => setShowGoalDropdown(!showGoalDropdown)}
                    >
                      <Text style={styles.goalDropdownText}>
                        {selectedGoalId 
                          ? getSelectedGoal()?.title || 'Selected Goal'
                          : 'Select a goal...'
                        }
                      </Text>
                      {showGoalDropdown ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
                    </TouchableOpacity>
                    
                    {showGoalDropdown && (
                      <View style={styles.goalDropdownContent}>
                        {availableGoals.map(goal => (
                          <TouchableOpacity
                            key={goal.id}
                            style={[
                              styles.goalDropdownOption,
                              selectedGoalId === goal.id && styles.selectedGoalDropdownOption
                            ]}
                            onPress={() => handleGoalSelect(goal.id)}
                          >
                            <View style={styles.goalOptionContent}>
                              <Text style={[
                                styles.goalOptionTitle,
                                selectedGoalId === goal.id && styles.selectedGoalOptionTitle
                              ]}>
                                {goal.title}
                              </Text>
                              <Text style={[
                                styles.goalOptionType,
                                selectedGoalId === goal.id && styles.selectedGoalOptionType
                              ]}>
                                {goal.goal_type === '12week' ? '12-Week Goal' : 'Custom Goal'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Date/Time Fields */}
            {formData.type === 'task' && (
              <View style={styles.field}>
                <Text style={styles.label}>Due Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowCalendar(true)}
                >
                  <CalendarIcon size={20} color="#6b7280" />
                  <Text style={styles.dateButtonText}>
                    {formatDateForDisplay(formData.dueDate)}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {formData.type === 'event' && (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Start Date</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowStartCalendar(true)}
                  >
                    <CalendarIcon size={20} color="#6b7280" />
                    <Text style={styles.dateButtonText}>
                      {formatDateForDisplay(formData.startDate)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>End Date</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowEndCalendar(true)}
                  >
                    <CalendarIcon size={20} color="#6b7280" />
                    <Text style={styles.dateButtonText}>
                      {formatDateForDisplay(formData.endDate)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {formData.type === 'withdrawal' && (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Amount *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.amount}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, amount: text }))}
                    placeholder="0.0"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Date</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowCalendar(true)}
                  >
                    <CalendarIcon size={20} color="#6b7280" />
                    <Text style={styles.dateButtonText}>
                      {formData.withdrawalDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Time Fields for Events */}
            {formData.type === 'event' && !formData.isAllDay && (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Start Time</Text>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowStartTimeCalendar(true)}
                  >
                    <Clock size={20} color="#6b7280" />
                    <Text style={styles.timeButtonText}>
                      {formatTimeForDisplay(formData.startTime)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>End Time</Text>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowEndTimeCalendar(true)}
                  >
                    <Clock size={20} color="#6b7280" />
                    <Text style={styles.timeButtonText}>
                      {formatTimeForDisplay(formData.endTime)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* All Day Toggle for Events */}
            {formData.type === 'event' && (
              <View style={styles.field}>
                <View style={styles.toggleRow}>
                  <Text style={styles.label}>All Day</Text>
                  <Switch
                    value={formData.isAllDay}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isAllDay: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            )}

            {/* Anytime Toggle for Tasks */}
            {formData.type === 'task' && (
              <View style={styles.field}>
                <View style={styles.toggleRow}>
                  <Text style={styles.label}>Anytime</Text>
                  <Switch
                    value={formData.isAnytime}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isAnytime: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            )}

            {/* Priority Toggles */}
            {(formData.type === 'task' || formData.type === 'event') && (
              <>
                <View style={styles.field}>
                  <View style={styles.toggleRow}>
                    <Text style={styles.label}>Urgent</Text>
                    <Switch
                      value={formData.isUrgent}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, isUrgent: value }))}
                      trackColor={{ false: '#d1d5db', true: '#eab308' }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <View style={styles.toggleRow}>
                    <Text style={styles.label}>Important</Text>
                    <Switch
                      value={formData.isImportant}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, isImportant: value }))}
                      trackColor={{ false: '#d1d5db', true: '#16a34a' }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <View style={styles.toggleRow}>
                    <Text style={styles.label}>Authentic Deposit</Text>
                    <Switch
                      value={formData.isAuthenticDeposit}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, isAuthenticDeposit: value }))}
                      trackColor={{ false: '#d1d5db', true: '#7c3aed' }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>
              </>
            )}

            {/* Repeat Section - Only show when no goal is selected */}
            {(formData.type === 'task' || formData.type === 'event') && !selectedGoalId && (
              <View style={styles.field}>
                <Text style={styles.label}>Repeat</Text>
                <View style={styles.recurrenceSelector}>
                  {(['none', 'daily', 'weekly', 'monthly'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.recurrenceButton,
                        formData.recurrenceType === type && styles.activeRecurrenceButton
                      ]}
                      onPress={() => setFormData(prev => ({ ...prev, recurrenceType: type }))}
                    >
                      <Text style={[
                        styles.recurrenceButtonText,
                        formData.recurrenceType === type && styles.activeRecurrenceButtonText
                      ]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {formData.recurrenceType !== 'none' && (
                  <>
                    <View style={styles.recurrenceOptions}>
                      <Text style={styles.recurrenceLabel}>Every</Text>
                      <TextInput
                        style={styles.intervalInput}
                        value={formData.recurrenceInterval.toString()}
                        onChangeText={(text) => {
                          const interval = parseInt(text) || 1;
                          setFormData(prev => ({ ...prev, recurrenceInterval: interval }));
                        }}
                        keyboardType="numeric"
                      />
                      <Text style={styles.recurrenceLabel}>
                        {formData.recurrenceType === 'daily' ? 'day(s)' :
                         formData.recurrenceType === 'weekly' ? 'week(s)' :
                         formData.recurrenceType === 'monthly' ? 'month(s)' : ''}
                      </Text>
                    </View>

                    {formData.recurrenceType === 'weekly' && (
                      <View style={styles.weeklyDaysSelector}>
                        <Text style={styles.recurrenceLabel}>On days:</Text>
                        <View style={styles.weeklyDaysGrid}>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                            <TouchableOpacity
                              key={index}
                              style={[
                                styles.weeklyDayButton,
                                formData.weeklyDays.includes(index) && styles.activeWeeklyDayButton
                              ]}
                              onPress={() => {
                                const newDays = formData.weeklyDays.includes(index)
                                  ? formData.weeklyDays.filter(d => d !== index)
                                  : [...formData.weeklyDays, index];
                                setFormData(prev => ({ ...prev, weeklyDays: newDays }));
                              }}
                            >
                              <Text style={[
                                styles.weeklyDayButtonText,
                                formData.weeklyDays.includes(index) && styles.activeWeeklyDayButtonText
                              ]}>
                                {day}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    <View style={styles.field}>
                      <Text style={styles.label}>End Repeat</Text>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowRecurrenceEndCalendar(true)}
                      >
                        <CalendarIcon size={20} color="#6b7280" />
                        <Text style={styles.dateButtonText}>
                          {formData.recurrenceEndDate 
                            ? formatDateForDisplay(formData.recurrenceEndDate)
                            : 'Never (tap to set end date)'
                          }
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Roles */}
            <View style={styles.field}>
              <Text style={styles.label}>Roles</Text>
              <View style={styles.checkboxGrid}>
                {roles.map(role => {
                  const isSelected = formData.selectedRoleIds.includes(role.id);
                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={styles.checkItem}
                      onPress={() => handleMultiSelect('selectedRoleIds', role.id)}
                    >
                      <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={styles.checkLabel}>{role.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Key Relationships */}
            {filteredKeyRelationships.length > 0 && (
              <View style={styles.field}>
                <Text style={styles.label}>Key Relationships</Text>
                <View style={styles.checkboxGrid}>
                  {filteredKeyRelationships.map(kr => {
                    const isSelected = formData.selectedKeyRelationshipIds.includes(kr.id);
                    return (
                      <TouchableOpacity
                        key={kr.id}
                        style={styles.checkItem}
                        onPress={() => handleMultiSelect('selectedKeyRelationshipIds', kr.id)}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.checkLabel}>{kr.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Domains */}
            <View style={styles.field}>
              <Text style={styles.label}>Wellness Domains</Text>
              <View style={styles.checkboxGrid}>
                {domains.map(domain => {
                  const isSelected = formData.selectedDomainIds.includes(domain.id);
                  return (
                    <TouchableOpacity
                      key={domain.id}
                      style={styles.checkItem}
                      onPress={() => handleMultiSelect('selectedDomainIds', domain.id)}
                    >
                      <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={styles.checkLabel}>{domain.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.field}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                placeholder="Add notes..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onClose}
          disabled={saving}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!formData.title.trim() || saving) && styles.saveButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!formData.title.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {mode === 'edit' ? 'Update' : 'Create'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Calendar Modals */}
      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>
                {formData.type === 'withdrawal' ? 'Select Withdrawal Date' : 'Select Due Date'}
              </Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                if (formData.type === 'withdrawal') {
                  setFormData(prev => ({ ...prev, withdrawalDate: new Date(day.timestamp) }));
                } else {
                  setFormData(prev => ({ ...prev, dueDate: day.dateString }));
                }
                setShowCalendar(false);
              }}
              markedDates={{
                [formData.type === 'withdrawal' 
                  ? formData.withdrawalDate.toISOString().split('T')[0]
                  : formData.dueDate
                ]: {
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

      <Modal visible={showStartCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Start Date</Text>
              <TouchableOpacity onPress={() => setShowStartCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                setFormData(prev => ({ ...prev, startDate: day.dateString }));
                setShowStartCalendar(false);
              }}
              markedDates={{
                [formData.startDate]: {
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

      <Modal visible={showEndCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select End Date</Text>
              <TouchableOpacity onPress={() => setShowEndCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                setFormData(prev => ({ ...prev, endDate: day.dateString }));
                setShowEndCalendar(false);
              }}
              markedDates={{
                [formData.endDate]: {
                  selected: true,
                  selectedColor: '#0078d4'
                }
              }}
              minDate={formData.startDate}
              theme={{
                selectedDayBackgroundColor: '#0078d4',
                todayTextColor: '#0078d4',
                arrowColor: '#0078d4',
              }}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showRecurrenceEndCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select End Date for Repeat</Text>
              <TouchableOpacity onPress={() => setShowRecurrenceEndCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                setFormData(prev => ({ ...prev, recurrenceEndDate: day.dateString }));
                setShowRecurrenceEndCalendar(false);
              }}
              markedDates={{
                [formData.recurrenceEndDate]: {
                  selected: true,
                  selectedColor: '#0078d4'
                }
              }}
              minDate={formData.type === 'task' ? formData.dueDate : formData.startDate}
              theme={{
                selectedDayBackgroundColor: '#0078d4',
                todayTextColor: '#0078d4',
                arrowColor: '#0078d4',
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  content: {
    flex: 1,
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
    color: '#6b7280',
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
    color: '#1f2937',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTypeButton: {
    backgroundColor: '#0078d4',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTypeButtonText: {
    color: '#ffffff',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalSelection: {
    marginTop: 12,
  },
  goalDropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalDropdownText: {
    fontSize: 16,
    color: '#1f2937',
  },
  goalDropdownContent: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  goalDropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedGoalDropdownOption: {
    backgroundColor: '#f0f9ff',
  },
  goalOptionContent: {
    flex: 1,
  },
  goalOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  selectedGoalOptionTitle: {
    color: '#0078d4',
    fontWeight: '600',
  },
  goalOptionType: {
    fontSize: 12,
    color: '#6b7280',
  },
  selectedGoalOptionType: {
    color: '#0078d4',
  },
  dateButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1f2937',
  },
  timeButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeButtonText: {
    fontSize: 16,
    color: '#1f2937',
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
    borderColor: '#d1d5db',
    borderRadius: 3,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  recurrenceSelector: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  recurrenceButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeRecurrenceButton: {
    backgroundColor: '#0078d4',
  },
  recurrenceButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeRecurrenceButtonText: {
    color: '#ffffff',
  },
  recurrenceOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  recurrenceLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  intervalInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    color: '#1f2937',
    width: 60,
    textAlign: 'center',
  },
  weeklyDaysSelector: {
    marginTop: 12,
  },
  weeklyDaysGrid: {
    flexDirection: 'row',
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
  activeWeeklyDayButton: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  weeklyDayButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeWeeklyDayButtonText: {
    color: '#ffffff',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#0078d4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
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
    backgroundColor: '#ffffff',
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
    borderBottomColor: '#e5e7eb',
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  formTypeSelector: {
    marginBottom: 24,
  },
  formTypePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  formTypePill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  activeFormTypePill: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  formTypePillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeFormTypePillText: {
    color: '#ffffff',
  },
  goalToggleContainer: {
    marginBottom: 24,
  },
});