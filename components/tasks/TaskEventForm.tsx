import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { X, Calendar as CalendarIcon, Clock, ChevronDown, ChevronUp } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

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
}

interface TaskEventFormProps {
  mode: 'create' | 'edit';
  initialData?: {
    id?: string;
    title?: string;
    description?: string;
    due_date?: string;
    start_date?: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    type?: 'task' | 'event' | 'withdrawal' | 'depositIdea';
    is_all_day?: boolean;
    is_anytime?: boolean;
    is_urgent?: boolean;
    is_important?: boolean;
    is_authentic_deposit?: boolean;
    is_twelve_week_goal?: boolean;
    countsTowardWeeklyProgress?: boolean;
    input_kind?: string;
    unit?: string;
    recurrence_rule?: string;
    selectedRoleIds?: string[];
    selectedDomainIds?: string[];
    selectedKeyRelationshipIds?: string[];
    selectedGoalIds?: string[];
    roles?: Array<{id: string; label: string}>;
    domains?: Array<{id: string; name: string}>;
    keyRelationships?: Array<{id: string; name: string}>;
    goals?: Array<{id: string; title: string}>;
    amount?: number;
    withdrawal_date?: string;
    notes?: string;
  };
  onSubmitSuccess: () => void;
  onClose: () => void;
}

const recurrenceOptions = [
  { value: '', label: 'No Repeat' },
  { value: 'RRULE:FREQ=DAILY', label: 'Daily' },
  { value: 'RRULE:FREQ=WEEKLY', label: 'Weekly' },
  { value: 'RRULE:FREQ=MONTHLY', label: 'Monthly' },
];

export default function TaskEventForm({ mode, initialData, onSubmitSuccess, onClose }: TaskEventFormProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [isAllDay, setIsAllDay] = useState(false);
  const [isAnytime, setIsAnytime] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [isAuthenticDeposit, setIsAuthenticDeposit] = useState(false);
  const [isTwelveWeekGoal, setIsTwelveWeekGoal] = useState(false);
  const [countsTowardWeeklyProgress, setCountsTowardWeeklyProgress] = useState(false);
  const [inputKind, setInputKind] = useState('boolean');
  const [unit, setUnit] = useState('completion');
  const [recurrenceRule, setRecurrenceRule] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [selectedKeyRelationshipIds, setSelectedKeyRelationshipIds] = useState<string[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  
  // Withdrawal-specific state
  const [amount, setAmount] = useState('');
  const [withdrawalDate, setWithdrawalDate] = useState(new Date());
  const [notes, setNotes] = useState('');

  // Data fetching state
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [allKeyRelationships, setAllKeyRelationships] = useState<KeyRelationship[]>([]);
  const [allGoals, setAllGoals] = useState<Goal[]>([]);
  const [currentUserCycleId, setCurrentUserCycleId] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showRecurrenceDropdown, setShowRecurrenceDropdown] = useState(false);

  // Determine form type
  const formType = initialData?.type || 'task';

  useEffect(() => {
    fetchData();
  }, []);

  // Handle initialData changes for pre-filling
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      
      if (initialData.due_date) {
        setDueDate(new Date(initialData.due_date));
      }
      if (initialData.start_date) {
        setDueDate(new Date(initialData.start_date));
      }
      if (initialData.withdrawal_date) {
        setWithdrawalDate(new Date(initialData.withdrawal_date));
      }
      
      if (initialData.start_time) {
        setStartTime(new Date(initialData.start_time));
      }
      if (initialData.end_time) {
        setEndTime(new Date(initialData.end_time));
      }
      
      setIsAllDay(initialData.is_all_day || false);
      setIsAnytime(initialData.is_anytime || false);
      setIsUrgent(initialData.is_urgent || false);
      setIsImportant(initialData.is_important || false);
      setIsAuthenticDeposit(initialData.is_authentic_deposit || false);
      setIsTwelveWeekGoal(initialData.is_twelve_week_goal || false);
      setCountsTowardWeeklyProgress(initialData.countsTowardWeeklyProgress || false);
      setRecurrenceRule(initialData.recurrence_rule || '');
      setAmount(initialData.amount?.toString() || '');
      setNotes(initialData.notes || '');

      // Handle input_kind and unit based on countsTowardWeeklyProgress
      if (initialData.countsTowardWeeklyProgress) {
        setInputKind('count');
        setUnit('days');
      } else {
        setInputKind(initialData.input_kind || 'boolean');
        setUnit(initialData.unit || 'completion');
      }

      // Pre-fill associations from initialData
      setSelectedRoleIds(initialData.selectedRoleIds || initialData.roles?.map(r => r.id) || []);
      setSelectedDomainIds(initialData.selectedDomainIds || initialData.domains?.map(d => d.id) || []);
      setSelectedKeyRelationshipIds(initialData.selectedKeyRelationshipIds || initialData.keyRelationships?.map(kr => kr.id) || []);
      setSelectedGoalIds(initialData.selectedGoalIds || initialData.goals?.map(g => g.id) || []);
    }
  }, [initialData]);

  const fetchData = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch current user cycle
      const { data: cycleData } = await supabase
        .from('0008-ap-user-cycles')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setCurrentUserCycleId(cycleData?.id || null);

      // Fetch all data in parallel
      const [
        { data: rolesData },
        { data: domainsData },
        { data: keyRelationshipsData },
        { data: goalsData }
      ] = await Promise.all([
        supabase.from('0008-ap-roles').select('id, label, color').eq('user_id', user.id).eq('is_active', true).order('label'),
        supabase.from('0008-ap-domains').select('id, name').order('name'),
        supabase.from('0008-ap-key-relationships').select('id, name, role_id').eq('user_id', user.id).order('name'),
        supabase.from('0008-ap-goals-12wk').select('id, title').eq('user_id', user.id).eq('status', 'active').order('title')
      ]);

      setAllRoles(rolesData || []);
      setAllDomains(domainsData || []);
      setAllKeyRelationships(keyRelationshipsData || []);
      setAllGoals(goalsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load form data');
    }
  };

  const handleMultiSelect = (field: 'roles' | 'domains' | 'keyRelationships' | 'goals', id: string) => {
    const setterMap = {
      roles: setSelectedRoleIds,
      domains: setSelectedDomainIds,
      keyRelationships: setSelectedKeyRelationshipIds,
      goals: setSelectedGoalIds,
    };

    const getterMap = {
      roles: selectedRoleIds,
      domains: selectedDomainIds,
      keyRelationships: selectedKeyRelationshipIds,
      goals: selectedGoalIds,
    };

    const currentSelection = getterMap[field];
    const setter = setterMap[field];

    const newSelection = currentSelection.includes(id)
      ? currentSelection.filter(itemId => itemId !== id)
      : [...currentSelection, id];

    setter(newSelection);
  };

  const formatDateForInput = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTimeForInput = (time: Date | null) => {
    if (!time) return 'Not set';
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (formType === 'withdrawal') {
      await handleWithdrawalSubmit();
      return;
    }

    if (formType === 'depositIdea') {
      await handleDepositIdeaSubmit();
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Prepare task payload
      const taskPayload = {
        user_id: user.id,
        user_cycle_id: currentUserCycleId,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate.toISOString().split('T')[0],
        start_date: dueDate.toISOString().split('T')[0],
        start_time: startTime ? startTime.toISOString() : null,
        end_time: endTime ? endTime.toISOString() : null,
        type: formType,
        is_all_day: isAllDay,
        is_anytime: isAnytime,
        is_urgent: isUrgent,
        is_important: isImportant,
        is_authentic_deposit: isAuthenticDeposit,
        is_twelve_week_goal: isTwelveWeekGoal,
        input_kind: inputKind,
        unit: unit,
        recurrence_rule: recurrenceRule || null,
        status: 'active',
        updated_at: new Date().toISOString(),
      };

      let taskData;
      let taskError;

      if (mode === 'edit' && initialData?.id) {
        // Update existing task
        const { data, error } = await supabase
          .from('0008-ap-tasks')
          .update(taskPayload)
          .eq('id', initialData.id)
          .select()
          .single();
        taskData = data;
        taskError = error;
      } else {
        // Create new task
        const { data, error } = await supabase
          .from('0008-ap-tasks')
          .insert(taskPayload)
          .select()
          .single();
        taskData = data;
        taskError = error;
      }

      if (taskError) throw taskError;
      if (!taskData) throw new Error('Failed to save task');

      const taskId = taskData.id;

      // Clear existing joins for edit mode
      if (mode === 'edit' && initialData?.id) {
        await Promise.all([
          supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
        ]);
      }

      // Create new joins
      const roleJoins = selectedRoleIds.map(role_id => ({ 
        parent_id: taskId, 
        parent_type: 'task', 
        role_id, 
        user_id: user.id 
      }));
      const domainJoins = selectedDomainIds.map(domain_id => ({ 
        parent_id: taskId, 
        parent_type: 'task', 
        domain_id, 
        user_id: user.id 
      }));
      const krJoins = selectedKeyRelationshipIds.map(key_relationship_id => ({ 
        parent_id: taskId, 
        parent_type: 'task', 
        key_relationship_id, 
        user_id: user.id 
      }));
      const goalJoins = selectedGoalIds.map(goal_id => ({ 
        parent_id: taskId, 
        parent_type: 'task', 
        goal_id, 
        user_id: user.id 
      }));

      // Add note if provided
      if (description && description.trim()) {
        const { data: noteData, error: noteError } = await supabase
          .from('0008-ap-notes')
          .insert({ user_id: user.id, content: description })
          .select()
          .single();
        
        if (noteError) throw noteError;
        
        await supabase
          .from('0008-ap-universal-notes-join')
          .insert({ 
            parent_id: taskId, 
            parent_type: 'task', 
            note_id: noteData.id, 
            user_id: user.id 
          });
      }

      // Insert joins
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

      Alert.alert('Success', `${formType === 'event' ? 'Event' : 'Task'} ${mode === 'edit' ? 'updated' : 'created'} successfully`);
      onSubmitSuccess();

    } catch (error) {
      console.error('Error saving task/event:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawalSubmit = async () => {
    if (!title.trim() || !amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please fill in title and a valid amount');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const withdrawalPayload = {
        user_id: user.id,
        title: title.trim(),
        amount: parseFloat(amount),
        withdrawal_date: withdrawalDate.toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      };

      let withdrawalData;
      let withdrawalError;

      if (mode === 'edit' && initialData?.id) {
        const { data, error } = await supabase
          .from('0008-ap-withdrawals')
          .update(withdrawalPayload)
          .eq('id', initialData.id)
          .select()
          .single();
        withdrawalData = data;
        withdrawalError = error;
      } else {
        const { data, error } = await supabase
          .from('0008-ap-withdrawals')
          .insert(withdrawalPayload)
          .select()
          .single();
        withdrawalData = data;
        withdrawalError = error;
      }

      if (withdrawalError) throw withdrawalError;
      if (!withdrawalData) throw new Error('Failed to save withdrawal');

      const withdrawalId = withdrawalData.id;

      // Clear existing joins for edit mode
      if (mode === 'edit' && initialData?.id) {
        await Promise.all([
          supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
          supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
          supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
        ]);
      }

      // Create new joins
      const roleJoins = selectedRoleIds.map(role_id => ({ 
        parent_id: withdrawalId, 
        parent_type: 'withdrawal', 
        role_id, 
        user_id: user.id 
      }));
      const domainJoins = selectedDomainIds.map(domain_id => ({ 
        parent_id: withdrawalId, 
        parent_type: 'withdrawal', 
        domain_id, 
        user_id: user.id 
      }));
      const krJoins = selectedKeyRelationshipIds.map(key_relationship_id => ({ 
        parent_id: withdrawalId, 
        parent_type: 'withdrawal', 
        key_relationship_id, 
        user_id: user.id 
      }));

      // Add note if provided
      if (notes && notes.trim()) {
        const { data: noteData, error: noteError } = await supabase
          .from('0008-ap-notes')
          .insert({ user_id: user.id, content: notes })
          .select()
          .single();
        
        if (noteError) throw noteError;
        
        await supabase
          .from('0008-ap-universal-notes-join')
          .insert({ 
            parent_id: withdrawalId, 
            parent_type: 'withdrawal', 
            note_id: noteData.id, 
            user_id: user.id 
          });
      }

      // Insert joins
      if (roleJoins.length > 0) {
        await supabase.from('0008-ap-universal-roles-join').insert(roleJoins);
      }
      if (domainJoins.length > 0) {
        await supabase.from('0008-ap-universal-domains-join').insert(domainJoins);
      }
      if (krJoins.length > 0) {
        await supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins);
      }

      Alert.alert('Success', `Withdrawal ${mode === 'edit' ? 'updated' : 'created'} successfully`);
      onSubmitSuccess();

    } catch (error) {
      console.error('Error saving withdrawal:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDepositIdeaSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const depositIdeaPayload = {
        user_id: user.id,
        title: title.trim(),
        is_active: true,
        archived: false,
        updated_at: new Date().toISOString(),
      };

      let depositIdeaData;
      let depositIdeaError;

      if (mode === 'edit' && initialData?.id) {
        const { data, error } = await supabase
          .from('0008-ap-deposit-ideas')
          .update(depositIdeaPayload)
          .eq('id', initialData.id)
          .select()
          .single();
        depositIdeaData = data;
        depositIdeaError = error;
      } else {
        const { data, error } = await supabase
          .from('0008-ap-deposit-ideas')
          .insert(depositIdeaPayload)
          .select()
          .single();
        depositIdeaData = data;
        depositIdeaError = error;
      }

      if (depositIdeaError) throw depositIdeaError;
      if (!depositIdeaData) throw new Error('Failed to save deposit idea');

      const depositIdeaId = depositIdeaData.id;

      // Clear existing joins for edit mode
      if (mode === 'edit' && initialData?.id) {
        await Promise.all([
          supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
          supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
          supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
          supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
        ]);
      }

      // Create new joins
      const roleJoins = selectedRoleIds.map(role_id => ({ 
        parent_id: depositIdeaId, 
        parent_type: 'depositIdea', 
        role_id, 
        user_id: user.id 
      }));
      const domainJoins = selectedDomainIds.map(domain_id => ({ 
        parent_id: depositIdeaId, 
        parent_type: 'depositIdea', 
        domain_id, 
        user_id: user.id 
      }));
      const krJoins = selectedKeyRelationshipIds.map(key_relationship_id => ({ 
        parent_id: depositIdeaId, 
        parent_type: 'depositIdea', 
        key_relationship_id, 
        user_id: user.id 
      }));
      const goalJoins = selectedGoalIds.map(goal_id => ({ 
        parent_id: depositIdeaId, 
        parent_type: 'depositIdea', 
        goal_id, 
        user_id: user.id 
      }));

      // Add note if provided
      if (description && description.trim()) {
        const { data: noteData, error: noteError } = await supabase
          .from('0008-ap-notes')
          .insert({ user_id: user.id, content: description })
          .select()
          .single();
        
        if (noteError) throw noteError;
        
        await supabase
          .from('0008-ap-universal-notes-join')
          .insert({ 
            parent_id: depositIdeaId, 
            parent_type: 'depositIdea', 
            note_id: noteData.id, 
            user_id: user.id 
          });
      }

      // Insert joins
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

      Alert.alert('Success', `Deposit idea ${mode === 'edit' ? 'updated' : 'created'} successfully`);
      onSubmitSuccess();

    } catch (error) {
      console.error('Error saving deposit idea:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const filteredKeyRelationships = allKeyRelationships.filter(kr => 
    selectedRoleIds.includes(kr.role_id)
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {mode === 'edit' ? 'Edit' : 'New'} {
            formType === 'event' ? 'Event' : 
            formType === 'withdrawal' ? 'Withdrawal' : 
            formType === 'depositIdea' ? 'Deposit Idea' : 
            'Task'
          }
        </Text>
        <TouchableOpacity onPress={onClose}>
          <X size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {formType === 'withdrawal' ? 'Reason' : 'Title'} *
            </Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={
                formType === 'withdrawal' ? 'Enter withdrawal reason' : 
                formType === 'depositIdea' ? 'Enter idea title' : 
                'Enter title'
              }
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Amount (Withdrawal only) */}
          {formType === 'withdrawal' && (
            <View style={styles.field}>
              <Text style={styles.label}>Amount *</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.0"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
          )}

          {/* Description/Notes */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {formType === 'withdrawal' ? 'Notes' : 'Description'}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formType === 'withdrawal' ? notes : description}
              onChangeText={formType === 'withdrawal' ? setNotes : setDescription}
              placeholder={
                formType === 'withdrawal' ? 'Optional notes...' : 
                formType === 'depositIdea' ? 'Describe your idea...' : 
                'Optional description...'
              }
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Date */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {formType === 'withdrawal' ? 'Date' : formType === 'event' ? 'Event Date' : 'Due Date'}
            </Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowCalendar(true)}
            >
              <CalendarIcon size={16} color="#6b7280" />
              <Text style={styles.dateButtonText}>
                {formatDateForInput(formType === 'withdrawal' ? withdrawalDate : dueDate)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Time fields (not for withdrawals or deposit ideas) */}
          {formType !== 'withdrawal' && formType !== 'depositIdea' && (
            <>
              {/* All Day Toggle */}
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>All Day</Text>
                <Switch
                  value={isAllDay}
                  onValueChange={(value) => {
                    setIsAllDay(value);
                    if (value) {
                      setStartTime(null);
                      setEndTime(null);
                      setIsAnytime(false);
                    }
                  }}
                  trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                  thumbColor={isAllDay ? '#ffffff' : '#ffffff'}
                />
              </View>

              {/* Anytime Toggle */}
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Anytime</Text>
                <Switch
                  value={isAnytime}
                  onValueChange={(value) => {
                    setIsAnytime(value);
                    if (value) {
                      setStartTime(null);
                      setEndTime(null);
                      setIsAllDay(false);
                    }
                  }}
                  trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                  thumbColor={isAnytime ? '#ffffff' : '#ffffff'}
                />
              </View>

              {/* Time fields (only if not all day and not anytime) */}
              {!isAllDay && !isAnytime && (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Start Time</Text>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => setShowStartTimePicker(true)}
                    >
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.timeButtonText}>
                        {formatTimeForInput(startTime)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>End Time</Text>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => setShowEndTimePicker(true)}
                    >
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.timeButtonText}>
                        {formatTimeForInput(endTime)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Recurrence (Events only) */}
              {formType === 'event' && (
                <View style={styles.field}>
                  <Text style={styles.label}>Repeat</Text>
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() => setShowRecurrenceDropdown(!showRecurrenceDropdown)}
                  >
                    <Text style={styles.dropdownText}>
                      {recurrenceOptions.find(opt => opt.value === recurrenceRule)?.label || 'No Repeat'}
                    </Text>
                    {showRecurrenceDropdown ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
                  </TouchableOpacity>
                  
                  {showRecurrenceDropdown && (
                    <View style={styles.dropdownContent}>
                      {recurrenceOptions.map(option => (
                        <TouchableOpacity
                          key={option.value}
                          style={[styles.dropdownOption, recurrenceRule === option.value && styles.selectedDropdownOption]}
                          onPress={() => {
                            setRecurrenceRule(option.value);
                            setShowRecurrenceDropdown(false);
                          }}
                        >
                          <Text style={[
                            styles.dropdownOptionText,
                            recurrenceRule === option.value && styles.selectedDropdownOptionText
                          ]}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* Priority toggles (not for withdrawals or deposit ideas) */}
          {formType !== 'withdrawal' && formType !== 'depositIdea' && (
            <>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Urgent</Text>
                <Switch
                  value={isUrgent}
                  onValueChange={setIsUrgent}
                  trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                  thumbColor={isUrgent ? '#ffffff' : '#ffffff'}
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Important</Text>
                <Switch
                  value={isImportant}
                  onValueChange={setIsImportant}
                  trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                  thumbColor={isImportant ? '#ffffff' : '#ffffff'}
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Authentic Deposit</Text>
                <Switch
                  value={isAuthenticDeposit}
                  onValueChange={setIsAuthenticDeposit}
                  trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                  thumbColor={isAuthenticDeposit ? '#ffffff' : '#ffffff'}
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>12-Week Goal</Text>
                <Switch
                  value={isTwelveWeekGoal}
                  onValueChange={setIsTwelveWeekGoal}
                  trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                  thumbColor={isTwelveWeekGoal ? '#ffffff' : '#ffffff'}
                />
              </View>
            </>
          )}

          {/* Roles */}
          <View style={styles.field}>
            <Text style={styles.label}>Roles</Text>
            <View style={styles.checkboxGrid}>
              {allRoles.map(role => {
                const isSelected = selectedRoleIds.includes(role.id);
                return (
                  <TouchableOpacity
                    key={role.id}
                    style={styles.checkItem}
                    onPress={() => handleMultiSelect('roles', role.id)}
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

          {/* Key Relationships (only show if roles are selected) */}
          {filteredKeyRelationships.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.label}>Key Relationships</Text>
              <View style={styles.checkboxGrid}>
                {filteredKeyRelationships.map(kr => {
                  const isSelected = selectedKeyRelationshipIds.includes(kr.id);
                  return (
                    <TouchableOpacity
                      key={kr.id}
                      style={styles.checkItem}
                      onPress={() => handleMultiSelect('keyRelationships', kr.id)}
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
              {allDomains.map(domain => {
                const isSelected = selectedDomainIds.includes(domain.id);
                return (
                  <TouchableOpacity
                    key={domain.id}
                    style={styles.checkItem}
                    onPress={() => handleMultiSelect('domains', domain.id)}
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

          {/* 12-Week Goals (only show if not a withdrawal or deposit idea) */}
          {formType !== 'withdrawal' && formType !== 'depositIdea' && allGoals.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.label}>12-Week Goals</Text>
              <View style={styles.checkboxGrid}>
                {allGoals.map(goal => {
                  const isSelected = selectedGoalIds.includes(goal.id);
                  return (
                    <TouchableOpacity
                      key={goal.id}
                      style={styles.checkItem}
                      onPress={() => handleMultiSelect('goals', goal.id)}
                    >
                      <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={styles.checkLabel}>{goal.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={[
            styles.submitButton,
            (!title.trim() || (formType === 'withdrawal' && (!amount || parseFloat(amount) <= 0)) || loading) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!title.trim() || (formType === 'withdrawal' && (!amount || parseFloat(amount) <= 0)) || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {mode === 'edit' ? 'Update' : 'Create'} {
                formType === 'event' ? 'Event' : 
                formType === 'withdrawal' ? 'Withdrawal' : 
                formType === 'depositIdea' ? 'Idea' : 
                'Task'
              }
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                if (formType === 'withdrawal') {
                  setWithdrawalDate(new Date(day.timestamp));
                } else {
                  setDueDate(new Date(day.timestamp));
                }
                setShowCalendar(false);
              }}
              markedDates={{
                [(formType === 'withdrawal' ? withdrawalDate : dueDate).toISOString().split('T')[0]]: {
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

      {/* Start Time Picker Modal */}
      <Modal visible={showStartTimePicker} transparent animationType="fade">
        <View style={styles.timePickerOverlay}>
          <View style={styles.timePickerContainer}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.timePickerTitle}>Start Time</Text>
              <TouchableOpacity onPress={() => setShowStartTimePicker(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.timePickerContent}>
              <TouchableOpacity
                style={styles.timeOption}
                onPress={() => {
                  setStartTime(new Date());
                  setShowStartTimePicker(false);
                }}
              >
                <Text style={styles.timeOptionText}>Set to current time</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.timeOption}
                onPress={() => {
                  setStartTime(null);
                  setShowStartTimePicker(false);
                }}
              >
                <Text style={styles.timeOptionText}>Clear time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* End Time Picker Modal */}
      <Modal visible={showEndTimePicker} transparent animationType="fade">
        <View style={styles.timePickerOverlay}>
          <View style={styles.timePickerContainer}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.timePickerTitle}>End Time</Text>
              <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.timePickerContent}>
              <TouchableOpacity
                style={styles.timeOption}
                onPress={() => {
                  const endTime = new Date();
                  endTime.setHours(endTime.getHours() + 1);
                  setEndTime(endTime);
                  setShowEndTimePicker(false);
                }}
              >
                <Text style={styles.timeOptionText}>Set to 1 hour from now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.timeOption}
                onPress={() => {
                  setEndTime(null);
                  setShowEndTimePicker(false);
                }}
              >
                <Text style={styles.timeOptionText}>Clear time</Text>
              </TouchableOpacity>
            </View>
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
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1f2937',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  timeButtonText: {
    fontSize: 16,
    color: '#1f2937',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
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
  dropdown: {
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
  dropdownText: {
    fontSize: 16,
    color: '#1f2937',
  },
  dropdownContent: {
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
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedDropdownOption: {
    backgroundColor: '#f0f9ff',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#1f2937',
  },
  selectedDropdownOptionText: {
    color: '#0078d4',
    fontWeight: '600',
  },
  actions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  submitButton: {
    backgroundColor: '#0078d4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
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
  },
  calendarContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 20,
    minWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  timePickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  timePickerContent: {
    padding: 16,
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    marginBottom: 8,
  },
  timeOptionText: {
    fontSize: 16,
    color: '#1f2937',
    textAlign: 'center',
  },
});