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
import { X, Calendar as CalendarIcon, Clock, ChevronDown, ChevronUp, Target } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { formatLocalDate, parseLocalDate } from '@/lib/dateUtils';

interface UnifiedGoal {
  id: string;
  title: string;
  goal_type: 'twelve_wk_goal' | 'custom_goal';
}

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

interface TaskEventFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

export default function TaskEventForm({ mode, initialData, onSubmitSuccess, onClose }: TaskEventFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
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
    selectedGoalId: null as string | null,
    selectedGoalType: null as 'twelve_wk_goal' | 'custom_goal' | null,
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    selectedKeyRelationshipIds: [] as string[],
    recurrenceType: 'none' as 'none' | 'daily' | 'weekly' | 'monthly',
    recurrenceEndDate: '',
    amount: '',
    withdrawalDate: formatLocalDate(new Date()),
  });

  // Data states
  const [allAvailableGoals, setAllAvailableGoals] = useState<UnifiedGoal[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<UnifiedGoal | null>(null);
  const [showGoalDropdown, setShowGoalDropdown] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Calendar states
  const [showDueDateCalendar, setShowDueDateCalendar] = useState(false);
  const [showStartDateCalendar, setShowStartDateCalendar] = useState(false);
  const [showEndDateCalendar, setShowEndDateCalendar] = useState(false);
  const [showRecurrenceEndCalendar, setShowRecurrenceEndCalendar] = useState(false);
  const [showWithdrawalDateCalendar, setShowWithdrawalDateCalendar] = useState(false);

  useEffect(() => {
    fetchData();
    if (initialData) {
      loadInitialData();
    }
  }, [initialData]);

  const fetchAllAvailableGoals = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch 12-week goals
      const { data: twelveWeekGoals, error: twelveWeekError } = await supabase
        .from('0008-ap-goals-12wk')
        .select('id, title')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('title');

      if (twelveWeekError) throw twelveWeekError;

      // Fetch custom goals
      const { data: customGoals, error: customError } = await supabase
        .from('0008-ap-goals-custom')
        .select('id, title')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('title');

      if (customError) throw customError;

      // Combine and map to unified format
      const allGoals: UnifiedGoal[] = [
        ...(twelveWeekGoals || []).map(goal => ({
          id: goal.id,
          title: goal.title,
          goal_type: 'twelve_wk_goal' as const,
        })),
        ...(customGoals || []).map(goal => ({
          id: goal.id,
          title: goal.title,
          goal_type: 'custom_goal' as const,
        })),
      ];

      setAllAvailableGoals(allGoals);
    } catch (error) {
      console.error('Error fetching available goals:', error);
      Alert.alert('Error', 'Failed to load available goals');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await fetchAllAvailableGoals();

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

  const loadInitialData = () => {
    if (!initialData) return;

    setFormData({
      title: initialData.title || '',
      description: initialData.description || '',
      type: initialData.type || 'task',
      dueDate: initialData.due_date || formatLocalDate(new Date()),
      startDate: initialData.start_date || formatLocalDate(new Date()),
      endDate: initialData.end_date || formatLocalDate(new Date()),
      startTime: initialData.start_time || '',
      endTime: initialData.end_time || '',
      isAllDay: initialData.is_all_day || false,
      isAnytime: initialData.is_anytime || false,
      isUrgent: initialData.is_urgent || false,
      isImportant: initialData.is_important || false,
      isAuthenticDeposit: initialData.is_authentic_deposit || false,
      selectedGoalId: null,
      selectedGoalType: null,
      selectedRoleIds: initialData.selectedRoleIds || initialData.roles?.map(r => r.id) || [],
      selectedDomainIds: initialData.selectedDomainIds || initialData.domains?.map(d => d.id) || [],
      selectedKeyRelationshipIds: initialData.selectedKeyRelationshipIds || initialData.keyRelationships?.map(kr => kr.id) || [],
      recurrenceType: 'none',
      recurrenceEndDate: '',
      amount: initialData.amount?.toString() || '',
      withdrawalDate: initialData.withdrawal_date || formatLocalDate(new Date()),
    });

    // Set selected goal if linked to goals
    if (initialData.goals && initialData.goals.length > 0) {
      const linkedGoal = initialData.goals[0];
      setFormData(prev => ({
        ...prev,
        selectedGoalId: linkedGoal.id,
        selectedGoalType: 'twelve_wk_goal', // Default assumption, will be corrected when goals are loaded
      }));
    }
  };

  // Update selected goal when goals are loaded and we have initial data
  useEffect(() => {
    if (allAvailableGoals.length > 0 && formData.selectedGoalId && !selectedGoal) {
      const goal = allAvailableGoals.find(g => g.id === formData.selectedGoalId);
      if (goal) {
        setSelectedGoal(goal);
        setFormData(prev => ({
          ...prev,
          selectedGoalType: goal.goal_type,
        }));
      }
    }
  }, [allAvailableGoals, formData.selectedGoalId, selectedGoal]);

  const handleMultiSelect = (field: 'selectedRoleIds' | 'selectedDomainIds' | 'selectedKeyRelationshipIds', id: string) => {
    setFormData(prev => {
      const currentSelection = prev[field] as string[];
      const newSelection = currentSelection.includes(id)
        ? currentSelection.filter(itemId => itemId !== id)
        : [...currentSelection, id];
      return { ...prev, [field]: newSelection };
    });
  };

  const handleGoalSelect = (goal: UnifiedGoal) => {
    setSelectedGoal(goal);
    setFormData(prev => ({
      ...prev,
      selectedGoalId: goal.id,
      selectedGoalType: goal.goal_type,
    }));
    setShowGoalDropdown(false);
  };

  const handleGoalClear = () => {
    setSelectedGoal(null);
    setFormData(prev => ({
      ...prev,
      selectedGoalId: null,
      selectedGoalType: null,
    }));
  };

  const generateRecurrenceRule = () => {
    if (formData.recurrenceType === 'none') return null;
    
    let rule = `RRULE:FREQ=${formData.recurrenceType.toUpperCase()}`;
    
    if (formData.recurrenceEndDate) {
      const endDate = parseLocalDate(formData.recurrenceEndDate);
      if (!isNaN(endDate.getTime())) {
        const untilString = endDate.toISOString().split('T')[0].replace(/-/g, '');
        rule += `;UNTIL=${untilString}`;
      }
    }
    
    return rule;
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

      let taskData: any = {
        user_id: user.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        type: formData.type,
        is_urgent: formData.isUrgent,
        is_important: formData.isImportant,
        is_authentic_deposit: formData.isAuthenticDeposit,
        status: 'pending',
      };

      // Add goal linking if selected
      if (formData.selectedGoalId && formData.selectedGoalType) {
        if (formData.selectedGoalType === 'twelve_wk_goal') {
          taskData.twelve_wk_goal_id = formData.selectedGoalId;
        } else if (formData.selectedGoalType === 'custom_goal') {
          taskData.custom_goal_id = formData.selectedGoalId;
        }
      }

      // Handle different form types
      if (formData.type === 'task') {
        taskData.due_date = formData.dueDate;
        if (formData.isAnytime) {
          taskData.is_anytime = true;
        }
      } else if (formData.type === 'event') {
        taskData.start_date = formData.startDate;
        taskData.end_date = formData.endDate;
        taskData.start_time = formData.startTime || null;
        taskData.end_time = formData.endTime || null;
        taskData.is_all_day = formData.isAllDay;
      } else if (formData.type === 'withdrawal') {
        // Handle withdrawal creation
        const withdrawalData = {
          user_id: user.id,
          title: formData.title.trim(),
          amount: parseFloat(formData.amount),
          withdrawal_date: formData.withdrawalDate,
        };

        let withdrawalResult;
        if (mode === 'edit' && initialData?.id) {
          const { data, error } = await supabase
            .from('0008-ap-withdrawals')
            .update(withdrawalData)
            .eq('id', initialData.id)
            .select()
            .single();
          withdrawalResult = { data, error };
        } else {
          const { data, error } = await supabase
            .from('0008-ap-withdrawals')
            .insert(withdrawalData)
            .select()
            .single();
          withdrawalResult = { data, error };
        }

        if (withdrawalResult.error) throw withdrawalResult.error;
        
        const withdrawalId = withdrawalResult.data.id;
        await handleJoins(withdrawalId, 'withdrawal');
        
        Alert.alert('Success', `Withdrawal ${mode === 'edit' ? 'updated' : 'created'} successfully`);
        onSubmitSuccess();
        return;
      } else if (formData.type === 'depositIdea') {
        // Handle deposit idea creation/update
        const depositIdeaData = {
          user_id: user.id,
          title: formData.title.trim(),
          is_active: true,
          archived: false,
        };

        let depositIdeaResult;
        if (mode === 'edit' && initialData?.id) {
          const { data, error } = await supabase
            .from('0008-ap-deposit-ideas')
            .update(depositIdeaData)
            .eq('id', initialData.id)
            .select()
            .single();
          depositIdeaResult = { data, error };
        } else {
          const { data, error } = await supabase
            .from('0008-ap-deposit-ideas')
            .insert(depositIdeaData)
            .select()
            .single();
          depositIdeaResult = { data, error };
        }

        if (depositIdeaResult.error) throw depositIdeaResult.error;
        
        const depositIdeaId = depositIdeaResult.data.id;
        await handleJoins(depositIdeaId, 'depositIdea');
        
        Alert.alert('Success', `Deposit idea ${mode === 'edit' ? 'updated' : 'created'} successfully`);
        onSubmitSuccess();
        return;
      }

      // Add recurrence rule if specified
      const recurrenceRule = generateRecurrenceRule();
      if (recurrenceRule) {
        taskData.recurrence_rule = recurrenceRule;
      }

      // Create or update task/event
      let taskResult;
      if (mode === 'edit' && initialData?.id) {
        const { data, error } = await supabase
          .from('0008-ap-tasks')
          .update(taskData)
          .eq('id', initialData.id)
          .select()
          .single();
        taskResult = { data, error };
      } else {
        const { data, error } = await supabase
          .from('0008-ap-tasks')
          .insert(taskData)
          .select()
          .single();
        taskResult = { data, error };
      }

      if (taskResult.error) throw taskResult.error;
      
      const taskId = taskResult.data.id;
      await handleJoins(taskId, 'task');
      
      Alert.alert('Success', `${formData.type} ${mode === 'edit' ? 'updated' : 'created'} successfully`);
      onSubmitSuccess();
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleJoins = async (parentId: string, parentType: string) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Clear existing joins if editing
    if (mode === 'edit') {
      await Promise.all([
        supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', parentId).eq('parent_type', parentType),
        supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', parentId).eq('parent_type', parentType),
        supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', parentId).eq('parent_type', parentType),
        supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', parentId).eq('parent_type', parentType),
      ]);
    }

    // Create role joins
    if (formData.selectedRoleIds.length > 0) {
      const roleJoins = formData.selectedRoleIds.map(roleId => ({
        parent_id: parentId,
        parent_type: parentType,
        role_id: roleId,
        user_id: user.id,
      }));
      await supabase.from('0008-ap-universal-roles-join').insert(roleJoins);
    }

    // Create domain joins
    if (formData.selectedDomainIds.length > 0) {
      const domainJoins = formData.selectedDomainIds.map(domainId => ({
        parent_id: parentId,
        parent_type: parentType,
        domain_id: domainId,
        user_id: user.id,
      }));
      await supabase.from('0008-ap-universal-domains-join').insert(domainJoins);
    }

    // Create key relationship joins
    if (formData.selectedKeyRelationshipIds.length > 0) {
      const krJoins = formData.selectedKeyRelationshipIds.map(krId => ({
        parent_id: parentId,
        parent_type: parentType,
        key_relationship_id: krId,
        user_id: user.id,
      }));
      await supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins);
    }

    // Create goal join if selected
    if (formData.selectedGoalId && formData.selectedGoalType) {
      const goalJoinData: any = {
        parent_id: parentId,
        parent_type: parentType,
        user_id: user.id,
        goal_type: formData.selectedGoalType,
      };

      if (formData.selectedGoalType === 'twelve_wk_goal') {
        goalJoinData.twelve_wk_goal_id = formData.selectedGoalId;
        goalJoinData.custom_goal_id = null;
      } else {
        goalJoinData.custom_goal_id = formData.selectedGoalId;
        goalJoinData.twelve_wk_goal_id = null;
      }

      await supabase.from('0008-ap-universal-goals-join').insert(goalJoinData);
    }

    // Add description as note if provided
    if (formData.description.trim()) {
      const { data: noteData, error: noteError } = await supabase
        .from('0008-ap-notes')
        .insert({
          user_id: user.id,
          content: formData.description.trim(),
        })
        .select()
        .single();

      if (!noteError && noteData) {
        await supabase.from('0008-ap-universal-notes-join').insert({
          parent_id: parentId,
          parent_type: parentType,
          note_id: noteData.id,
          user_id: user.id,
        });
      }
    }
  };

  const formatTimeForInput = (timeString: string) => {
    if (!timeString) return '';
    try {
      const date = new Date(timeString);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  const formatDateForInput = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const filteredKeyRelationships = keyRelationships.filter(kr =>
    formData.selectedRoleIds.includes(kr.role_id)
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {mode === 'edit' ? 'Edit' : 'Create'} {formData.type === 'depositIdea' ? 'Deposit Idea' : formData.type === 'withdrawal' ? 'Withdrawal' : formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <X size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0078d4" />
          <Text style={styles.loadingText}>Loading form data...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
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

            {/* Type Selector */}
            <View style={styles.field}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeSelector}>
                {['task', 'event', 'depositIdea', 'withdrawal'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      formData.type === type && styles.activeTypeButton
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, type: type as any }))}
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

            {/* Goal Selector */}
            <View style={styles.field}>
              <Text style={styles.label}>Link to Goal (optional)</Text>
              <TouchableOpacity
                style={styles.goalSelector}
                onPress={() => setShowGoalDropdown(!showGoalDropdown)}
              >
                <View style={styles.goalSelectorContent}>
                  <Target size={16} color="#6b7280" />
                  <Text style={styles.goalSelectorText}>
                    {selectedGoal ? selectedGoal.title : 'Select a goal...'}
                  </Text>
                  {showGoalDropdown ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
                </View>
              </TouchableOpacity>

              {selectedGoal && (
                <View style={styles.selectedGoalInfo}>
                  <Text style={styles.selectedGoalTitle}>{selectedGoal.title}</Text>
                  <Text style={styles.selectedGoalType}>
                    {selectedGoal.goal_type === 'twelve_wk_goal' ? '12-Week Goal' : 'Custom Goal'}
                  </Text>
                  <TouchableOpacity style={styles.clearGoalButton} onPress={handleGoalClear}>
                    <Text style={styles.clearGoalButtonText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              )}

              {showGoalDropdown && (
                <View style={styles.goalDropdown}>
                  <ScrollView style={styles.goalDropdownScroll} nestedScrollEnabled>
                    {allAvailableGoals.length === 0 ? (
                      <View style={styles.noGoalsContainer}>
                        <Text style={styles.noGoalsText}>No active goals found</Text>
                      </View>
                    ) : (
                      allAvailableGoals.map(goal => (
                        <TouchableOpacity
                          key={goal.id}
                          style={[
                            styles.goalOption,
                            selectedGoal?.id === goal.id && styles.selectedGoalOption
                          ]}
                          onPress={() => handleGoalSelect(goal)}
                        >
                          <Text style={[
                            styles.goalOptionTitle,
                            selectedGoal?.id === goal.id && styles.selectedGoalOptionTitle
                          ]}>
                            {goal.title}
                          </Text>
                          <Text style={[
                            styles.goalOptionType,
                            selectedGoal?.id === goal.id && styles.selectedGoalOptionType
                          ]}>
                            {goal.goal_type === 'twelve_wk_goal' ? '12-Week Goal' : 'Custom Goal'}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Date/Time Fields based on type */}
            {formData.type === 'task' && (
              <View style={styles.field}>
                <Text style={styles.label}>Due Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDueDateCalendar(true)}
                >
                  <CalendarIcon size={16} color="#6b7280" />
                  <Text style={styles.dateButtonText}>
                    {formatDateForInput(parseLocalDate(formData.dueDate))}
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
                    onPress={() => setShowStartDateCalendar(true)}
                  >
                    <CalendarIcon size={16} color="#6b7280" />
                    <Text style={styles.dateButtonText}>
                      {formatDateForInput(parseLocalDate(formData.startDate))}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>End Date</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowEndDateCalendar(true)}
                  >
                    <CalendarIcon size={16} color="#6b7280" />
                    <Text style={styles.dateButtonText}>
                      {formatDateForInput(parseLocalDate(formData.endDate))}
                    </Text>
                  </TouchableOpacity>
                </View>

                {!formData.isAllDay && (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.label}>Start Time</Text>
                      <TextInput
                        style={styles.input}
                        value={formatTimeForInput(formData.startTime)}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, startTime: text }))}
                        placeholder="HH:MM"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>End Time</Text>
                      <TextInput
                        style={styles.input}
                        value={formatTimeForInput(formData.endTime)}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, endTime: text }))}
                        placeholder="HH:MM"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                  </>
                )}

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>All Day</Text>
                  <Switch
                    value={formData.isAllDay}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isAllDay: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor="#ffffff"
                  />
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
                    onPress={() => setShowWithdrawalDateCalendar(true)}
                  >
                    <CalendarIcon size={16} color="#6b7280" />
                    <Text style={styles.dateButtonText}>
                      {formatDateForInput(parseLocalDate(formData.withdrawalDate))}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Task-specific options */}
            {formData.type === 'task' && (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Anytime Task</Text>
                <Switch
                  value={formData.isAnytime}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, isAnytime: value }))}
                  trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                  thumbColor="#ffffff"
                />
              </View>
            )}

            {/* Priority toggles */}
            {(formData.type === 'task' || formData.type === 'event') && (
              <>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Urgent</Text>
                  <Switch
                    value={formData.isUrgent}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isUrgent: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor="#ffffff"
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Important</Text>
                  <Switch
                    value={formData.isImportant}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isImportant: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor="#ffffff"
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Authentic Deposit</Text>
                  <Switch
                    value={formData.isAuthenticDeposit}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isAuthenticDeposit: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </>
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

            {/* Key Relationships (filtered by selected roles) */}
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

            {/* Recurrence (for tasks and events) */}
            {(formData.type === 'task' || formData.type === 'event') && (
              <View style={styles.field}>
                <Text style={styles.label}>Recurrence</Text>
                <View style={styles.recurrenceSelector}>
                  {['none', 'daily', 'weekly', 'monthly'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.recurrenceButton,
                        formData.recurrenceType === type && styles.activeRecurrenceButton
                      ]}
                      onPress={() => setFormData(prev => ({ ...prev, recurrenceType: type as any }))}
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
                  <View style={styles.field}>
                    <Text style={styles.label}>Recurrence End Date</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowRecurrenceEndCalendar(true)}
                    >
                      <CalendarIcon size={16} color="#6b7280" />
                      <Text style={styles.dateButtonText}>
                        {formData.recurrenceEndDate 
                          ? formatDateForInput(parseLocalDate(formData.recurrenceEndDate))
                          : 'Select end date (optional)'
                        }
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder={`Add details about this ${formData.type}...`}
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        </ScrollView>
      )}

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
              {mode === 'edit' ? 'Update' : 'Create'} {formData.type === 'depositIdea' ? 'Idea' : formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Calendar Modals */}
      <Modal visible={showDueDateCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Due Date</Text>
              <TouchableOpacity onPress={() => setShowDueDateCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                setFormData(prev => ({ ...prev, dueDate: day.dateString }));
                setShowDueDateCalendar(false);
              }}
              markedDates={{
                [formData.dueDate]: {
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

      <Modal visible={showStartDateCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Start Date</Text>
              <TouchableOpacity onPress={() => setShowStartDateCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                setFormData(prev => ({ ...prev, startDate: day.dateString }));
                setShowStartDateCalendar(false);
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
                setFormData(prev => ({ ...prev, endDate: day.dateString }));
                setShowEndDateCalendar(false);
              }}
              markedDates={{
                [formData.endDate]: {
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

      <Modal visible={showWithdrawalDateCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Withdrawal Date</Text>
              <TouchableOpacity onPress={() => setShowWithdrawalDateCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                setFormData(prev => ({ ...prev, withdrawalDate: day.dateString }));
                setShowWithdrawalDateCalendar(false);
              }}
              markedDates={{
                [formData.withdrawalDate]: {
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

      <Modal visible={showRecurrenceEndCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Recurrence End Date</Text>
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
              theme={{
                selectedDayBackgroundColor: '#0078d4',
                todayTextColor: '#0078d4',
                arrowColor: '#0078d4',
              }}
            />
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
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  activeTypeButton: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTypeButtonText: {
    color: '#ffffff',
  },
  goalSelector: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  goalSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalSelectorText: {
    fontSize: 16,
    color: '#1f2937',
    flex: 1,
    marginLeft: 8,
  },
  selectedGoalInfo: {
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#0078d4',
  },
  selectedGoalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  selectedGoalType: {
    fontSize: 12,
    color: '#0078d4',
    marginBottom: 8,
  },
  clearGoalButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  clearGoalButtonText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '500',
  },
  goalDropdown: {
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
  goalDropdownScroll: {
    maxHeight: 180,
  },
  noGoalsContainer: {
    padding: 16,
    alignItems: 'center',
  },
  noGoalsText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  goalOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedGoalOption: {
    backgroundColor: '#f0f9ff',
  },
  goalOptionTitle: {
    fontSize: 14,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  switchLabel: {
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
  recurrenceSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recurrenceButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  activeRecurrenceButton: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  recurrenceButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeRecurrenceButtonText: {
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
});