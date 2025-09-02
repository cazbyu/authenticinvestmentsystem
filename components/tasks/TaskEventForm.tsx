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
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Calendar as CalendarIcon, Clock, Target, Users, Heart, FileText, Repeat } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { useGoalProgress } from '@/hooks/useGoalProgress';

interface Role { id: string; label: string; color?: string; }
interface Domain { id: string; name: string; }
interface KeyRelationship { id: string; name: string; role_id: string; }
interface TwelveWeekGoal { id: string; title: string; }

interface TaskEventFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

const RECURRENCE_OPTIONS = [
  { label: 'None', value: null },
  { label: 'Daily', value: 'RRULE:FREQ=DAILY;INTERVAL=1' },
  { label: 'Weekly', value: 'RRULE:FREQ=WEEKLY;INTERVAL=1' },
  { label: 'Monthly', value: 'RRULE:FREQ=MONTHLY;INTERVAL=1' },
];

export default function TaskEventForm({ mode, initialData, onSubmitSuccess, onClose }: TaskEventFormProps) {
  const { 
    goals: availableGoals, 
    currentCycle, 
    cycleWeeks, 
    createTaskWithWeekPlan 
  } = useGoalProgress();

  const [formData, setFormData] = useState({
    title: '',
    type: 'task' as 'task' | 'event' | 'depositIdea' | 'withdrawal',
    dueDate: new Date(),
    startDate: new Date(),
    endDate: new Date(),
    startTime: null as Date | null,
    endTime: null as Date | null,
    isAllDay: false,
    isAnytime: false,
    isUrgent: false,
    isImportant: false,
    isAuthenticDeposit: false,
    isTwelveWeekGoal: false,
    countsTowardWeeklyProgress: false,
    inputKind: 'count' as 'count' | 'duration',
    unit: 'days' as 'days' | 'hours' | 'sessions',
    recurrenceRule: null as string | null,
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    selectedKeyRelationshipIds: [] as string[],
    selectedGoalIds: [] as string[],
    notes: '',
    // Weekly planning for goal-linked tasks
    weeklyTargets: {} as Record<number, number>, // week_number -> target_days
  });

  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [calendarType, setCalendarType] = useState<'due' | 'start' | 'end'>('due');
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);

  useEffect(() => {
    fetchOptions();
    if (initialData) {
      populateForm();
    }
  }, [initialData]);

  const populateForm = () => {
    if (!initialData) return;

    const data = initialData;
    setFormData({
      title: data.title || '',
      type: data.type || 'task',
      dueDate: data.due_date ? new Date(data.due_date) : new Date(),
      startDate: data.start_date ? new Date(data.start_date) : new Date(),
      endDate: data.end_date ? new Date(data.end_date) : new Date(),
      startTime: data.start_time ? new Date(data.start_time) : null,
      endTime: data.end_time ? new Date(data.end_time) : null,
      isAllDay: data.is_all_day || false,
      isAnytime: data.is_anytime || false,
      isUrgent: data.is_urgent || false,
      isImportant: data.is_important || false,
      isAuthenticDeposit: data.is_authentic_deposit || false,
      isTwelveWeekGoal: data.is_twelve_week_goal || false,
      countsTowardWeeklyProgress: data.counts_toward_weekly_progress || false,
      inputKind: data.input_kind || 'count',
      unit: data.unit || 'days',
      recurrenceRule: data.recurrence_rule || null,
      selectedRoleIds: data.selectedRoleIds || data.roles?.map((r: any) => r.id) || [],
      selectedDomainIds: data.selectedDomainIds || data.domains?.map((d: any) => d.id) || [],
      selectedKeyRelationshipIds: data.selectedKeyRelationshipIds || data.keyRelationships?.map((kr: any) => kr.id) || [],
      selectedGoalIds: data.selectedGoalIds || data.goals?.map((g: any) => g.id) || [],
      notes: data.notes || '',
      weeklyTargets: data.weeklyTargets || {},
    });
  };

  const fetchOptions = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { data: roleData },
        { data: domainData },
        { data: krData }
      ] = await Promise.all([
        supabase.from('0008-ap-roles').select('id,label,color').eq('user_id', user.id).eq('is_active', true),
        supabase.from('0008-ap-domains').select('id,name'),
        supabase.from('0008-ap-key-relationships').select('id,name,role_id').eq('user_id', user.id)
      ]);

      setRoles(roleData || []);
      setDomains(domainData || []);
      setKeyRelationships(krData || []);
    } catch (error) {
      console.error('Error fetching options:', error);
      Alert.alert('Error', (error as Error).message);
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

  const handleWeeklyTargetChange = (weekNumber: number, target: string) => {
    const targetValue = parseInt(target) || 0;
    setFormData(prev => ({
      ...prev,
      weeklyTargets: {
        ...prev.weeklyTargets,
        [weekNumber]: targetValue
      }
    }));
  };

  const formatDateForInput = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTimeForInput = (date: Date | null) => {
    if (!date) return 'Not set';
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Handle different form types
      if (formData.type === 'depositIdea') {
        await handleDepositIdeaSubmit(user.id);
      } else if (formData.type === 'withdrawal') {
        await handleWithdrawalSubmit(user.id);
      } else {
        // Handle task/event submission
        await handleTaskEventSubmit(user.id);
      }

      onSubmitSuccess();
      onClose();

    } catch (error) {
      console.error('Error submitting form:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskEventSubmit = async (userId: string) => {
    const supabase = getSupabaseClient();

    // Check if this is a goal-linked task with weekly planning
    const isGoalLinkedTask = formData.selectedGoalIds.length > 0 && 
                            formData.isTwelveWeekGoal && 
                            formData.countsTowardWeeklyProgress &&
                            currentCycle;

    if (isGoalLinkedTask && mode === 'create') {
      // Use the specialized function for goal-linked tasks with weekly planning
      const selectedWeeks = Object.entries(formData.weeklyTargets)
        .filter(([_, target]) => target > 0)
        .map(([weekNumber, target]) => ({
          weekNumber: parseInt(weekNumber),
          targetDays: target
        }));

      if (selectedWeeks.length === 0) {
        Alert.alert('Error', 'Please set weekly targets for at least one week');
        return;
      }

      const taskData = await createTaskWithWeekPlan({
        title: formData.title.trim(),
        description: formData.notes.trim() || undefined,
        goal_id: formData.selectedGoalIds[0], // Use first selected goal
        selectedWeeks
      });

      if (!taskData) throw new Error('Failed to create goal-linked task');

      // Handle additional associations (roles, domains, KRs, additional goals)
      await handleTaskAssociations(taskData.id, userId);

    } else {
      // Standard task/event creation or editing
      const taskPayload = {
        user_id: userId,
        user_cycle_id: currentCycle?.id || null,
        title: formData.title.trim(),
        type: formData.type,
        due_date: formData.dueDate.toISOString().split('T')[0],
        start_date: formData.type === 'event' ? formData.startDate.toISOString().split('T')[0] : null,
        end_date: formData.type === 'event' ? formData.endDate.toISOString().split('T')[0] : null,
        start_time: formData.startTime ? formData.startTime.toISOString() : null,
        end_time: formData.endTime ? formData.endTime.toISOString() : null,
        is_all_day: formData.isAllDay,
        is_anytime: formData.isAnytime,
        is_urgent: formData.isUrgent,
        is_important: formData.isImportant,
        is_authentic_deposit: formData.isAuthenticDeposit,
        is_twelve_week_goal: formData.isTwelveWeekGoal,
        counts_toward_weekly_progress: formData.countsTowardWeeklyProgress,
        input_kind: formData.inputKind,
        unit: formData.unit,
        recurrence_rule: formData.recurrenceRule,
        status: 'active',
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

        // Clear existing associations for edit mode
        await Promise.all([
          supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', initialData.id).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', initialData.id).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', initialData.id).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', initialData.id).eq('parent_type', 'task'),
        ]);
      } else {
        const { data, error } = await supabase
          .from('0008-ap-tasks')
          .insert(taskPayload)
          .select()
          .single();
        if (error) throw error;
        taskData = data;
      }

      await handleTaskAssociations(taskData.id, userId);
    }
  };

  const handleTaskAssociations = async (taskId: string, userId: string) => {
    const supabase = getSupabaseClient();

    // Create role joins
    const roleJoins = formData.selectedRoleIds.map(role_id => ({ 
      parent_id: taskId, 
      parent_type: 'task', 
      role_id, 
      user_id: userId 
    }));

    // Create domain joins
    const domainJoins = formData.selectedDomainIds.map(domain_id => ({ 
      parent_id: taskId, 
      parent_type: 'task', 
      domain_id, 
      user_id: userId 
    }));

    // Create key relationship joins
    const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ 
      parent_id: taskId, 
      parent_type: 'task', 
      key_relationship_id, 
      user_id: userId 
    }));

    // Create goal joins
    const goalJoins = formData.selectedGoalIds.map(goal_id => ({ 
      parent_id: taskId, 
      parent_type: 'task', 
      goal_id, 
      user_id: userId 
    }));

    // Add note if provided
    if (formData.notes && formData.notes.trim()) {
      const { data: noteData, error: noteError } = await supabase
        .from('0008-ap-notes')
        .insert({ user_id: userId, content: formData.notes })
        .select()
        .single();
      
      if (noteError) throw noteError;
      
      await supabase
        .from('0008-ap-universal-notes-join')
        .insert({ 
          parent_id: taskId, 
          parent_type: 'task', 
          note_id: noteData.id, 
          user_id: userId 
        });
    }

    // Insert all joins
    const joinPromises = [];
    if (roleJoins.length > 0) {
      joinPromises.push(supabase.from('0008-ap-universal-roles-join').insert(roleJoins));
    }
    if (domainJoins.length > 0) {
      joinPromises.push(supabase.from('0008-ap-universal-domains-join').insert(domainJoins));
    }
    if (krJoins.length > 0) {
      joinPromises.push(supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins));
    }
    if (goalJoins.length > 0) {
      joinPromises.push(supabase.from('0008-ap-universal-goals-join').insert(goalJoins));
    }

    await Promise.all(joinPromises);
  };

  const handleDepositIdeaSubmit = async (userId: string) => {
    const supabase = getSupabaseClient();

    const depositIdeaPayload = {
      user_id: userId,
      title: formData.title.trim(),
      is_active: true,
      archived: false,
      follow_up: formData.isTwelveWeekGoal,
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

      // Clear existing associations
      await Promise.all([
        supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', initialData.id).eq('parent_type', 'depositIdea'),
        supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', initialData.id).eq('parent_type', 'depositIdea'),
        supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', initialData.id).eq('parent_type', 'depositIdea'),
        supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', initialData.id).eq('parent_type', 'depositIdea'),
      ]);
    } else {
      const { data, error } = await supabase
        .from('0008-ap-deposit-ideas')
        .insert(depositIdeaPayload)
        .select()
        .single();
      if (error) throw error;
      depositIdeaData = data;
    }

    await handleDepositIdeaAssociations(depositIdeaData.id, userId);
  };

  const handleDepositIdeaAssociations = async (depositIdeaId: string, userId: string) => {
    const supabase = getSupabaseClient();

    const roleJoins = formData.selectedRoleIds.map(role_id => ({ 
      parent_id: depositIdeaId, 
      parent_type: 'depositIdea', 
      role_id, 
      user_id: userId 
    }));
    const domainJoins = formData.selectedDomainIds.map(domain_id => ({ 
      parent_id: depositIdeaId, 
      parent_type: 'depositIdea', 
      domain_id, 
      user_id: userId 
    }));
    const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ 
      parent_id: depositIdeaId, 
      parent_type: 'depositIdea', 
      key_relationship_id, 
      user_id: userId 
    }));
    const goalJoins = formData.selectedGoalIds.map(goal_id => ({ 
      parent_id: depositIdeaId, 
      parent_type: 'depositIdea', 
      goal_id, 
      user_id: userId 
    }));

    if (formData.notes && formData.notes.trim()) {
      const { data: noteData, error: noteError } = await supabase
        .from('0008-ap-notes')
        .insert({ user_id: userId, content: formData.notes })
        .select()
        .single();
      
      if (noteError) throw noteError;
      
      await supabase
        .from('0008-ap-universal-notes-join')
        .insert({ 
          parent_id: depositIdeaId, 
          parent_type: 'depositIdea', 
          note_id: noteData.id, 
          user_id: userId 
        });
    }

    const joinPromises = [];
    if (roleJoins.length > 0) {
      joinPromises.push(supabase.from('0008-ap-universal-roles-join').insert(roleJoins));
    }
    if (domainJoins.length > 0) {
      joinPromises.push(supabase.from('0008-ap-universal-domains-join').insert(domainJoins));
    }
    if (krJoins.length > 0) {
      joinPromises.push(supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins));
    }
    if (goalJoins.length > 0) {
      joinPromises.push(supabase.from('0008-ap-universal-goals-join').insert(goalJoins));
    }

    await Promise.all(joinPromises);
  };

  const handleWithdrawalSubmit = async (userId: string) => {
    const supabase = getSupabaseClient();

    const withdrawalPayload = {
      user_id: userId,
      title: formData.title.trim(),
      amount: parseFloat(formData.notes) || 0, // Use notes field for amount in withdrawal mode
      withdrawal_date: formData.dueDate.toISOString().split('T')[0],
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

      // Clear existing associations
      await Promise.all([
        supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', initialData.id).eq('parent_type', 'withdrawal'),
        supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', initialData.id).eq('parent_type', 'withdrawal'),
        supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', initialData.id).eq('parent_type', 'withdrawal'),
      ]);
    } else {
      const { data, error } = await supabase
        .from('0008-ap-withdrawals')
        .insert(withdrawalPayload)
        .select()
        .single();
      if (error) throw error;
      withdrawalData = data;
    }

    // Handle withdrawal associations (no goals for withdrawals)
    const roleJoins = formData.selectedRoleIds.map(role_id => ({ 
      parent_id: withdrawalData.id, 
      parent_type: 'withdrawal', 
      role_id, 
      user_id: userId 
    }));
    const domainJoins = formData.selectedDomainIds.map(domain_id => ({ 
      parent_id: withdrawalData.id, 
      parent_type: 'withdrawal', 
      domain_id, 
      user_id: userId 
    }));
    const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ 
      parent_id: withdrawalData.id, 
      parent_type: 'withdrawal', 
      key_relationship_id, 
      user_id: userId 
    }));

    const joinPromises = [];
    if (roleJoins.length > 0) {
      joinPromises.push(supabase.from('0008-ap-universal-roles-join').insert(roleJoins));
    }
    if (domainJoins.length > 0) {
      joinPromises.push(supabase.from('0008-ap-universal-domains-join').insert(domainJoins));
    }
    if (krJoins.length > 0) {
      joinPromises.push(supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins));
    }

    await Promise.all(joinPromises);
  };

  const filteredKeyRelationships = keyRelationships.filter(kr => 
    formData.selectedRoleIds.includes(kr.role_id)
  );

  const getRecurrenceLabel = (rule: string | null) => {
    if (!rule) return 'None';
    const option = RECURRENCE_OPTIONS.find(opt => opt.value === rule);
    return option?.label || 'Custom';
  };

  const renderWeeklyPlanningSection = () => {
    if (!formData.isTwelveWeekGoal || !formData.countsTowardWeeklyProgress || !currentCycle || cycleWeeks.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Planning</Text>
        <Text style={styles.sectionDescription}>
          Set target days per week for this task across your 12-week cycle
        </Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.weeklyPlanningGrid}>
            {cycleWeeks.map(week => (
              <View key={week.week_number} style={styles.weekCard}>
                <Text style={styles.weekLabel}>Week {week.week_number}</Text>
                <Text style={styles.weekDates}>
                  {new Date(week.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <TextInput
                  style={styles.weekTargetInput}
                  value={formData.weeklyTargets[week.week_number]?.toString() || '0'}
                  onChangeText={(text) => handleWeeklyTargetChange(week.week_number, text)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                />
                <Text style={styles.weekUnit}>days</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        
        <View style={styles.planningTips}>
          <Text style={styles.tipsTitle}>💡 Planning Tips</Text>
          <Text style={styles.tipsText}>• Set realistic daily targets (1-7 days per week)</Text>
          <Text style={styles.tipsText}>• Consider your schedule and other commitments</Text>
          <Text style={styles.tipsText}>• You can adjust targets for different weeks</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {mode === 'edit' ? 'Edit' : 'Create'} {
            formData.type === 'task' ? 'Task' :
            formData.type === 'event' ? 'Event' :
            formData.type === 'depositIdea' ? 'Deposit Idea' :
            'Withdrawal'
          }
        </Text>
        <TouchableOpacity onPress={onClose}>
          <X size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          {/* Type Selection */}
          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeSelector}>
              {(['task', 'event', 'depositIdea', 'withdrawal'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    formData.type === type && styles.activeTypeButton
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, type }))}
                >
                  <Text style={[
                    styles.typeButtonText,
                    formData.type === type && styles.activeTypeButtonText
                  ]}>
                    {type === 'depositIdea' ? 'Idea' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {formData.type === 'withdrawal' ? 'Reason' : 'Title'} *
            </Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              placeholder={
                formData.type === 'withdrawal' ? 'Enter withdrawal reason' :
                formData.type === 'depositIdea' ? 'Enter deposit idea' :
                'Enter title'
              }
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Amount field for withdrawals */}
          {formData.type === 'withdrawal' && (
            <View style={styles.field}>
              <Text style={styles.label}>Amount *</Text>
              <TextInput
                style={styles.input}
                value={formData.notes}
                onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                placeholder="0.0"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
          )}

          {/* Date Fields */}
          {formData.type !== 'depositIdea' && (
            <>
              {formData.type === 'task' || formData.type === 'withdrawal' ? (
                <View style={styles.field}>
                  <Text style={styles.label}>
                    {formData.type === 'withdrawal' ? 'Date' : 'Due Date'}
                  </Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => {
                      setCalendarType('due');
                      setShowCalendar(true);
                    }}
                  >
                    <CalendarIcon size={16} color="#6b7280" />
                    <Text style={styles.dateButtonText}>
                      {formatDateForInput(formData.dueDate)}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Start Date</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowStartCalendar(true)}
                    >
                      <CalendarIcon size={16} color="#6b7280" />
                      <Text style={styles.dateButtonText}>
                        {formatDateForInput(formData.startDate)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>End Date</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowEndCalendar(true)}
                    >
                      <CalendarIcon size={16} color="#6b7280" />
                      <Text style={styles.dateButtonText}>
                        {formatDateForInput(formData.endDate)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}

          {/* Time Fields */}
          {(formData.type === 'task' || formData.type === 'event') && !formData.isAllDay && !formData.isAnytime && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Start Time</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Clock size={16} color="#6b7280" />
                  <Text style={styles.dateButtonText}>
                    {formatTimeForInput(formData.startTime)}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>End Time</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndTimePicker(true)}
                >
                  <Clock size={16} color="#6b7280" />
                  <Text style={styles.dateButtonText}>
                    {formatTimeForInput(formData.endTime)}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Time Options */}
          {(formData.type === 'task' || formData.type === 'event') && (
            <View style={styles.field}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>All Day</Text>
                <Switch
                  value={formData.isAllDay}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    isAllDay: value,
                    isAnytime: value ? false : prev.isAnytime 
                  }))}
                />
              </View>
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Anytime</Text>
                <Switch
                  value={formData.isAnytime}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    isAnytime: value,
                    isAllDay: value ? false : prev.isAllDay 
                  }))}
                />
              </View>
            </View>
          )}

          {/* Recurrence */}
          {formData.type === 'event' && (
            <View style={styles.field}>
              <Text style={styles.label}>Recurrence</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowRecurrenceModal(true)}
              >
                <Repeat size={16} color="#6b7280" />
                <Text style={styles.dateButtonText}>
                  {getRecurrenceLabel(formData.recurrenceRule)}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Priority */}
          {(formData.type === 'task' || formData.type === 'event') && (
            <View style={styles.field}>
              <Text style={styles.label}>Priority</Text>
              <View style={styles.priorityGrid}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Urgent</Text>
                  <Switch
                    value={formData.isUrgent}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isUrgent: value }))}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Important</Text>
                  <Switch
                    value={formData.isImportant}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isImportant: value }))}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Special Flags */}
          {formData.type !== 'withdrawal' && (
            <View style={styles.field}>
              <Text style={styles.label}>Special Properties</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Authentic Deposit</Text>
                <Switch
                  value={formData.isAuthenticDeposit}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, isAuthenticDeposit: value }))}
                />
              </View>
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>12-Week Goal</Text>
                <Switch
                  value={formData.isTwelveWeekGoal}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, isTwelveWeekGoal: value }))}
                />
              </View>

              {formData.isTwelveWeekGoal && (
                <>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Counts Toward Weekly Progress</Text>
                    <Switch
                      value={formData.countsTowardWeeklyProgress}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, countsTowardWeeklyProgress: value }))}
                    />
                  </View>

                  {formData.countsTowardWeeklyProgress && (
                    <View style={styles.inputKindSection}>
                      <Text style={styles.subLabel}>Input Kind</Text>
                      <View style={styles.inputKindSelector}>
                        {(['count', 'duration'] as const).map((kind) => (
                          <TouchableOpacity
                            key={kind}
                            style={[
                              styles.inputKindButton,
                              formData.inputKind === kind && styles.activeInputKindButton
                            ]}
                            onPress={() => setFormData(prev => ({ ...prev, inputKind: kind }))}
                          >
                            <Text style={[
                              styles.inputKindButtonText,
                              formData.inputKind === kind && styles.activeInputKindButtonText
                            ]}>
                              {kind.charAt(0).toUpperCase() + kind.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={styles.subLabel}>Unit</Text>
                      <View style={styles.unitSelector}>
                        {(['days', 'hours', 'sessions'] as const).map((unit) => (
                          <TouchableOpacity
                            key={unit}
                            style={[
                              styles.unitButton,
                              formData.unit === unit && styles.activeUnitButton
                            ]}
                            onPress={() => setFormData(prev => ({ ...prev, unit }))}
                          >
                            <Text style={[
                              styles.unitButtonText,
                              formData.unit === unit && styles.activeUnitButtonText
                            ]}>
                              {unit.charAt(0).toUpperCase() + unit.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* 12-Week Goals Selection */}
          {formData.type !== 'withdrawal' && availableGoals.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.label}>12-Week Goals</Text>
              <View style={styles.checkboxGrid}>
                {availableGoals.map(goal => {
                  const isSelected = formData.selectedGoalIds.includes(goal.id);
                  return (
                    <TouchableOpacity
                      key={goal.id}
                      style={styles.checkItem}
                      onPress={() => handleMultiSelect('selectedGoalIds', goal.id)}
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

          {/* Weekly Planning Section */}
          {renderWeeklyPlanningSection()}

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
          {formData.type !== 'withdrawal' && (
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
          )}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={[
            styles.submitButton,
            (!formData.title.trim() || loading) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!formData.title.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {mode === 'edit' ? 'Update' : 'Create'} {
                formData.type === 'task' ? 'Task' :
                formData.type === 'event' ? 'Event' :
                formData.type === 'depositIdea' ? 'Idea' :
                'Withdrawal'
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
                setFormData(prev => ({ ...prev, dueDate: new Date(day.timestamp) }));
                setShowCalendar(false);
              }}
              markedDates={{
                [formData.dueDate.toISOString().split('T')[0]]: {
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

      {/* Start Date Calendar Modal */}
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
                setFormData(prev => ({ ...prev, startDate: new Date(day.timestamp) }));
                setShowStartCalendar(false);
              }}
              markedDates={{
                [formData.startDate.toISOString().split('T')[0]]: {
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

      {/* End Date Calendar Modal */}
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
                setFormData(prev => ({ ...prev, endDate: new Date(day.timestamp) }));
                setShowEndCalendar(false);
              }}
              markedDates={{
                [formData.endDate.toISOString().split('T')[0]]: {
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

      {/* Recurrence Modal */}
      <Modal visible={showRecurrenceModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recurrence</Text>
              <TouchableOpacity onPress={() => setShowRecurrenceModal(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.recurrenceOptions}>
              {RECURRENCE_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.recurrenceOption,
                    formData.recurrenceRule === option.value && styles.activeRecurrenceOption
                  ]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, recurrenceRule: option.value }));
                    setShowRecurrenceModal(false);
                  }}
                >
                  <Text style={[
                    styles.recurrenceOptionText,
                    formData.recurrenceRule === option.value && styles.activeRecurrenceOptionText
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  subLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 8,
    marginTop: 12,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: '#374151',
  },
  priorityGrid: {
    gap: 8,
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
  inputKindSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  inputKindSelector: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 2,
    marginBottom: 8,
  },
  inputKindButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  activeInputKindButton: {
    backgroundColor: '#0078d4',
  },
  inputKindButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeInputKindButtonText: {
    color: '#ffffff',
  },
  unitSelector: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 2,
  },
  unitButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  activeUnitButton: {
    backgroundColor: '#0078d4',
  },
  unitButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeUnitButtonText: {
    color: '#ffffff',
  },
  section: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  weeklyPlanningGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
  },
  weekCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  weekDates: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 8,
  },
  weekTargetInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    width: 50,
    marginBottom: 4,
  },
  weekUnit: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  planningTips: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
    marginBottom: 2,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 20,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  recurrenceOptions: {
    padding: 8,
  },
  recurrenceOption: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 2,
  },
  activeRecurrenceOption: {
    backgroundColor: '#eff6ff',
  },
  recurrenceOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  activeRecurrenceOptionText: {
    color: '#0078d4',
    fontWeight: '600',
  },
});