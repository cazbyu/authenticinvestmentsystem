import React, { useState, useEffect, useCallback } from 'react';
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
import { X, ChevronDown, ChevronUp, Calendar as CalendarIcon, Clock } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { parseRRule } from '@/lib/recurrenceUtils';
import { formatLocalDate, parseLocalDate, formatDateRange } from '@/lib/dateUtils';

interface UnifiedGoal {
  id: string;
  title: string;
  goal_type: '12week' | 'custom';
  timeline_id: string;
  timeline_source: 'global' | 'custom';
}

interface TwelveWeekGoal {
  id: string;
  title: string;
  description?: string;
  status: string;
  progress: number;
  weekly_target: number;
  total_target: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
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
    selectedGoalId: '',
    selectedGoalType: '' as '12week' | 'custom' | '',
    countsTowardWeeklyProgress: false,
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    selectedKeyRelationshipIds: [] as string[],
    selectedWeeks: [] as number[],
    recurrenceType: 'none' as 'none' | 'daily' | 'weekly' | 'custom',
    customDays: [] as number[],
    notes: '',
    amount: '',
    withdrawalDate: new Date(),
  });

  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [twelveWeekGoals, setTwelveWeekGoals] = useState<TwelveWeekGoal[]>([]);
  const [allAvailableGoals, setAllAvailableGoals] = useState<UnifiedGoal[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<UnifiedGoal | null>(null);
  const [showGoalDropdown, setShowGoalDropdown] = useState(false);
  
  // Goal recurrence information state
  const [goalActionEfforts, setGoalActionEfforts] = useState<any[]>([]);
  const [goalCycleWeeks, setGoalCycleWeeks] = useState<any[]>([]);
  const [loadingGoalRecurrenceInfo, setLoadingGoalRecurrenceInfo] = useState(false);

  const [loading, setLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [showStartTimeCalendar, setShowStartTimeCalendar] = useState(false);
  const [showEndTimeCalendar, setShowEndTimeCalendar] = useState(false);
  const [showWithdrawalCalendar, setShowWithdrawalCalendar] = useState(false);

  useEffect(() => {
    fetchOptions();
    if (mode === 'edit' && initialData) {
      loadInitialData();
    }
  }, [mode, initialData]);

  // Fetch goal action efforts and weeks when a goal is selected
  const fetchGoalActionEffortsAndWeeks = useCallback(async (goal: UnifiedGoal) => {
    if (!goal) return;

    setLoadingGoalRecurrenceInfo(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch tasks linked to this goal
      const goalTypeField = goal.goal_type === '12week' ? 'twelve_wk_goal_id' : 'custom_goal_id';
      const { data: goalJoins, error: joinsError } = await supabase
        .from('0008-ap-universal-goals-join')
        .select('parent_id')
        .eq(goalTypeField, goal.id)
        .eq('parent_type', 'task');

      if (joinsError) throw joinsError;

      const taskIds = (goalJoins || []).map(j => j.parent_id);
      
      if (taskIds.length === 0) {
        setGoalActionEfforts([]);
        setGoalCycleWeeks([]);
        setLoadingGoalRecurrenceInfo(false);
        return;
      }

      // Fetch action effort tasks (input_kind = 'count')
      const { data: tasksData, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .in('id', taskIds)
        .eq('input_kind', 'count')
        .not('status', 'in', '(completed,cancelled)');

      if (tasksError) throw tasksError;

      if (!tasksData || tasksData.length === 0) {
        setGoalActionEfforts([]);
        setGoalCycleWeeks([]);
        setLoadingGoalRecurrenceInfo(false);
        return;
      }

      // Fetch week plans for these tasks
      const actionTaskIds = tasksData.map(t => t.id);
      const timelineColumn = goal.timeline_source === 'global' ? 'user_global_timeline_id' : 'user_custom_timeline_id';
      
      const { data: weekPlansData, error: weekPlansError } = await supabase
        .from('0008-ap-task-week-plan')
        .select('*')
        .in('task_id', actionTaskIds)
        .eq(timelineColumn, goal.timeline_id);

      if (weekPlansError) throw weekPlansError;

      // Combine tasks with their week plans
      const actionsWithWeeks = tasksData.map(task => ({
        ...task,
        weekPlans: (weekPlansData || []).filter(wp => wp.task_id === task.id)
      }));

      setGoalActionEfforts(actionsWithWeeks);

      // Fetch cycle weeks for the timeline
      const { data: cycleWeeksData, error: cycleWeeksError } = await supabase
        .from('v_unified_timeline_weeks')
        .select('*')
        .eq('timeline_id', goal.timeline_id)
        .eq('source', goal.timeline_source)
        .order('week_number');

      if (cycleWeeksError) throw cycleWeeksError;

      setGoalCycleWeeks(cycleWeeksData || []);

    } catch (error) {
      console.error('Error fetching goal action efforts:', error);
      setGoalActionEfforts([]);
      setGoalCycleWeeks([]);
    } finally {
      setLoadingGoalRecurrenceInfo(false);
    }
  }, []);

  // Effect to fetch goal recurrence info when goal selection changes
  useEffect(() => {
    if (formData.selectedGoalId && selectedGoal) {
      fetchGoalActionEffortsAndWeeks(selectedGoal);
    } else {
      setGoalActionEfforts([]);
      setGoalCycleWeeks([]);
      setLoadingGoalRecurrenceInfo(false);
    }
  }, [formData.selectedGoalId, selectedGoal, fetchGoalActionEffortsAndWeeks]);

  const fetchOptions = async () => {
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

      // Fetch goals for deposit ideas
      if (formData.type === 'depositIdea') {
        const { data: twelveWeekGoalsData } = await supabase
          .from('0008-ap-goals-12wk')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('title');

        setTwelveWeekGoals(twelveWeekGoalsData || []);
      }

      // Fetch all available goals for unified selector
      await fetchAllAvailableGoals();

    } catch (error) {
      console.error('Error fetching options:', error);
      Alert.alert('Error', 'Failed to load form options');
    }
  };

  const fetchAllAvailableGoals = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { data: twelveWeekGoalsData },
        { data: customGoalsData }
      ] = await Promise.all([
        supabase
          .from('0008-ap-goals-12wk')
          .select('id, title, user_global_timeline_id, custom_timeline_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('title'),
        supabase
          .from('0008-ap-goals-custom')
          .select('id, title, custom_timeline_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('title')
      ]);

      const unifiedGoals: UnifiedGoal[] = [
        ...(twelveWeekGoalsData || []).map(goal => ({
          id: goal.id,
          title: goal.title,
          goal_type: '12week' as const,
          timeline_id: goal.user_global_timeline_id || goal.custom_timeline_id,
          timeline_source: goal.user_global_timeline_id ? 'global' as const : 'custom' as const,
        })),
        ...(customGoalsData || []).map(goal => ({
          id: goal.id,
          title: goal.title,
          goal_type: 'custom' as const,
          timeline_id: goal.custom_timeline_id,
          timeline_source: 'custom' as const,
        }))
      ];

      setAllAvailableGoals(unifiedGoals);
    } catch (error) {
      console.error('Error fetching all available goals:', error);
    }
  };

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
      selectedGoalId: '',
      selectedGoalType: '',
      countsTowardWeeklyProgress: initialData.countsTowardWeeklyProgress || false,
      selectedRoleIds: initialData.selectedRoleIds || initialData.roles?.map(r => r.id) || [],
      selectedDomainIds: initialData.selectedDomainIds || initialData.domains?.map(d => d.id) || [],
      selectedKeyRelationshipIds: initialData.selectedKeyRelationshipIds || initialData.keyRelationships?.map(kr => kr.id) || [],
      selectedWeeks: initialData.selectedWeeks || [],
      recurrenceType: initialData.recurrence_rule ? 'daily' : 'none',
      customDays: [],
      notes: initialData.description || initialData.notes || '',
      amount: initialData.amount?.toString() || '',
      withdrawalDate: initialData.withdrawal_date ? new Date(initialData.withdrawal_date) : new Date(),
    });

    // Load existing goal selection
    if (initialData.goals && initialData.goals.length > 0) {
      const firstGoal = initialData.goals[0];
      setFormData(prev => ({
        ...prev,
        selectedGoalId: firstGoal.id,
        selectedGoalType: '12week', // Assume 12week for now, will be corrected when goals load
      }));
    }
  };

  // Helper functions for goal recurrence display
  const summarizeWeeks = (weeks: { week_number: number }[]): string => {
    if (weeks.length === 0) return 'No weeks';
    
    const weekNumbers = weeks.map(w => w.week_number).sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = weekNumbers[0];
    let end = weekNumbers[0];

    for (let i = 1; i < weekNumbers.length; i++) {
      if (weekNumbers[i] === end + 1) {
        end = weekNumbers[i];
      } else {
        if (start === end) {
          ranges.push(start.toString());
        } else {
          ranges.push(`${start}-${end}`);
        }
        start = end = weekNumbers[i];
      }
    }

    if (start === end) {
      ranges.push(start.toString());
    } else {
      ranges.push(`${start}-${end}`);
    }

    return ranges.join(', ');
  };

  const getRecurrenceSummary = (actions: any[]): string => {
    if (actions.length === 0) return 'No actions';

    const recurrenceTypes = new Set<string>();
    
    actions.forEach(action => {
      if (action.recurrence_rule) {
        const rule = parseRRule(action.recurrence_rule);
        if (rule) {
          if (rule.freq === 'DAILY') {
            recurrenceTypes.add('Daily');
          } else if (rule.freq === 'WEEKLY' && rule.byday) {
            if (rule.byday.length === 7) {
              recurrenceTypes.add('Daily');
            } else if (rule.byday.length === 5 && rule.byday.every(day => ['MO', 'TU', 'WE', 'TH', 'FR'].includes(day))) {
              recurrenceTypes.add('Weekdays');
            } else {
              recurrenceTypes.add(`Custom (${rule.byday.join(', ')})`);
            }
          } else {
            recurrenceTypes.add('Custom');
          }
        }
      } else {
        recurrenceTypes.add('One-time');
      }
    });

    return Array.from(recurrenceTypes).join(', ');
  };

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
    setFormData(prev => ({
      ...prev,
      selectedGoalId: goal.id,
      selectedGoalType: goal.goal_type,
    }));
    setSelectedGoal(goal);
    setShowGoalDropdown(false);
  };

  const handleGoalClear = () => {
    setFormData(prev => ({
      ...prev,
      selectedGoalId: '',
      selectedGoalType: '',
    }));
    setSelectedGoal(null);
    setShowGoalDropdown(false);
  };

  const handleWeekToggle = (weekNumber: number) => {
    setFormData(prev => ({
      ...prev,
      selectedWeeks: prev.selectedWeeks.includes(weekNumber)
        ? prev.selectedWeeks.filter(w => w !== weekNumber)
        : [...prev.selectedWeeks, weekNumber]
    }));
  };

  const handleCustomDayToggle = (dayIndex: number) => {
    setFormData(prev => ({
      ...prev,
      customDays: prev.customDays.includes(dayIndex)
        ? prev.customDays.filter(d => d !== dayIndex)
        : [...prev.customDays, dayIndex]
    }));
  };

  const generateRecurrenceRule = () => {
    if (formData.recurrenceType === 'daily') {
      return 'RRULE:FREQ=DAILY';
    } else if (formData.recurrenceType === 'weekly') {
      return 'RRULE:FREQ=WEEKLY';
    } else if (formData.recurrenceType === 'custom' && formData.customDays.length > 0) {
      const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const byDays = formData.customDays.map(dayIndex => dayNames[dayIndex]).join(',');
      return `RRULE:FREQ=WEEKLY;BYDAY=${byDays}`;
    }
    return null;
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

      let result;
      let entityId: string;

      if (formData.type === 'withdrawal') {
        const withdrawalPayload = {
          user_id: user.id,
          title: formData.title,
          amount: parseFloat(formData.amount),
          withdrawal_date: formatLocalDate(formData.withdrawalDate),
          updated_at: new Date().toISOString(),
        };

        if (mode === 'edit' && initialData?.id) {
          const { data, error } = await supabase
            .from('0008-ap-withdrawals')
            .update(withdrawalPayload)
            .eq('id', initialData.id)
            .select()
            .single();
          if (error) throw error;
          result = data;
        } else {
          const { data, error } = await supabase
            .from('0008-ap-withdrawals')
            .insert(withdrawalPayload)
            .select()
            .single();
          if (error) throw error;
          result = data;
        }
        entityId = result.id;

      } else if (formData.type === 'depositIdea') {
        const depositIdeaPayload = {
          user_id: user.id,
          title: formData.title,
          is_active: true,
          archived: false,
          follow_up: false,
          updated_at: new Date().toISOString(),
        };

        if (mode === 'edit' && initialData?.id) {
          const { data, error } = await supabase
            .from('0008-ap-deposit-ideas')
            .update(depositIdeaPayload)
            .eq('id', initialData.id)
            .select()
            .single();
          if (error) throw error;
          result = data;
        } else {
          const { data, error } = await supabase
            .from('0008-ap-deposit-ideas')
            .insert(depositIdeaPayload)
            .select()
            .single();
          if (error) throw error;
          result = data;
        }
        entityId = result.id;

      } else {
        // Task or Event
        const taskPayload: any = {
          user_id: user.id,
          title: formData.title,
          type: formData.type,
          status: 'pending',
          is_urgent: formData.isUrgent,
          is_important: formData.isImportant,
          is_authentic_deposit: formData.isAuthenticDeposit,
          is_twelve_week_goal: formData.selectedGoalId && formData.selectedGoalType === '12week',
          updated_at: new Date().toISOString(),
        };

        // Set dates based on type
        if (formData.type === 'task') {
          if (formData.isAnytime) {
            taskPayload.is_anytime = true;
            taskPayload.due_date = formatLocalDate(formData.dueDate);
          } else {
            taskPayload.due_date = formatLocalDate(formData.dueDate);
          }
        } else if (formData.type === 'event') {
          taskPayload.start_date = formatLocalDate(formData.startDate);
          taskPayload.end_date = formatLocalDate(formData.endDate);
          
          if (!formData.isAllDay) {
            taskPayload.start_time = formData.startTime.toISOString();
            taskPayload.end_time = formData.endTime.toISOString();
          } else {
            taskPayload.is_all_day = true;
          }
        }

        // Only set recurrence if no goal is selected
        if (!formData.selectedGoalId) {
          const recurrenceRule = generateRecurrenceRule();
          if (recurrenceRule) {
            taskPayload.recurrence_rule = recurrenceRule;
          }
        }

        if (mode === 'edit' && initialData?.id) {
          const { data, error } = await supabase
            .from('0008-ap-tasks')
            .update(taskPayload)
            .eq('id', initialData.id)
            .select()
            .single();
          if (error) throw error;
          result = data;
        } else {
          const { data, error } = await supabase
            .from('0008-ap-tasks')
            .insert(taskPayload)
            .select()
            .single();
          if (error) throw error;
          result = data;
        }
        entityId = result.id;
      }

      // Handle joins for all entity types
      if (mode === 'edit' && initialData?.id) {
        const parentType = formData.type === 'depositIdea' ? 'depositIdea' : 
                          formData.type === 'withdrawal' ? 'withdrawal' : 'task';
        
        await Promise.all([
          supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', initialData.id).eq('parent_type', parentType),
          supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', initialData.id).eq('parent_type', parentType),
          supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', initialData.id).eq('parent_type', parentType),
          formData.selectedGoalId ? supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', initialData.id).eq('parent_type', parentType) : Promise.resolve()
        ]);
      }

      const parentType = formData.type === 'depositIdea' ? 'depositIdea' : 
                        formData.type === 'withdrawal' ? 'withdrawal' : 'task';

      const joinPromises = [];

      if (formData.selectedRoleIds.length > 0) {
        const roleJoins = formData.selectedRoleIds.map(role_id => ({
          parent_id: entityId,
          parent_type: parentType,
          role_id,
          user_id: user.id,
        }));
        joinPromises.push(supabase.from('0008-ap-universal-roles-join').insert(roleJoins));
      }

      if (formData.selectedDomainIds.length > 0) {
        const domainJoins = formData.selectedDomainIds.map(domain_id => ({
          parent_id: entityId,
          parent_type: parentType,
          domain_id,
          user_id: user.id,
        }));
        joinPromises.push(supabase.from('0008-ap-universal-domains-join').insert(domainJoins));
      }

      if (formData.selectedKeyRelationshipIds.length > 0) {
        const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({
          parent_id: entityId,
          parent_type: parentType,
          key_relationship_id,
          user_id: user.id,
        }));
        joinPromises.push(supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins));
      }

      // Handle goal linking
      if (formData.selectedGoalId && formData.selectedGoalType) {
        const goalJoinPayload: any = {
          parent_id: entityId,
          parent_type: parentType,
          user_id: user.id,
          goal_type: formData.selectedGoalType === '12week' ? 'twelve_wk_goal' : 'custom_goal',
        };

        if (formData.selectedGoalType === '12week') {
          goalJoinPayload.twelve_wk_goal_id = formData.selectedGoalId;
          goalJoinPayload.custom_goal_id = null;
        } else {
          goalJoinPayload.custom_goal_id = formData.selectedGoalId;
          goalJoinPayload.twelve_wk_goal_id = null;
        }

        joinPromises.push(supabase.from('0008-ap-universal-goals-join').insert(goalJoinPayload));
      }

      if (formData.notes.trim()) {
        const { data: noteData, error: noteError } = await supabase
          .from('0008-ap-notes')
          .insert({ user_id: user.id, content: formData.notes })
          .select()
          .single();
        
        if (noteError) throw noteError;
        
        joinPromises.push(
          supabase.from('0008-ap-universal-notes-join').insert({
            parent_id: entityId,
            parent_type: parentType,
            note_id: noteData.id,
            user_id: user.id,
          })
        );
      }

      if (joinPromises.length > 0) {
        const joinResults = await Promise.all(joinPromises);
        for (const joinResult of joinResults) {
          if (joinResult.error) throw joinResult.error;
        }
      }

      Alert.alert('Success', `${formData.type.charAt(0).toUpperCase() + formData.type.slice(1)} ${mode === 'edit' ? 'updated' : 'created'} successfully`);
      onSubmitSuccess();

    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const filteredKeyRelationships = keyRelationships.filter(kr => 
    formData.selectedRoleIds.includes(kr.role_id)
  );

  const getNotesPlaceholder = () => {
    switch (formData.type) {
      case 'task': return 'Add notes about this task...';
      case 'event': return 'Add notes about this event...';
      case 'depositIdea': return 'Add notes about this deposit idea...';
      case 'withdrawal': return 'Add notes about this withdrawal...';
      default: return 'Add notes...';
    }
  };

  const formatTimeForInput = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const formatDateForInput = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {mode === 'edit' ? 'Edit' : 'Create'} {formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}
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
                {formData.type === 'withdrawal' ? 'Reason' : 'Title'} *
              </Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                placeholder={`Enter ${formData.type} ${formData.type === 'withdrawal' ? 'reason' : 'title'}`}
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Amount (for withdrawals) */}
            {formData.type === 'withdrawal' && (
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
            )}

            {/* Date fields based on type */}
            {formData.type === 'task' && (
              <View style={styles.field}>
                <Text style={styles.label}>Due Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowCalendar(true)}
                >
                  <Text style={styles.dateButtonText}>
                    {formatDateForInput(formData.dueDate)}
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
                    <Text style={styles.dateButtonText}>
                      {formatDateForInput(formData.endDate)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.toggleField}>
                  <Text style={styles.label}>All Day</Text>
                  <Switch
                    value={formData.isAllDay}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isAllDay: value }))}
                  />
                </View>

                {!formData.isAllDay && (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.label}>Start Time</Text>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowStartTimeCalendar(true)}
                      >
                        <Text style={styles.dateButtonText}>
                          {formatTimeForInput(formData.startTime)}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>End Time</Text>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowEndTimeCalendar(true)}
                      >
                        <Text style={styles.dateButtonText}>
                          {formatTimeForInput(formData.endTime)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            )}

            {formData.type === 'withdrawal' && (
              <View style={styles.field}>
                <Text style={styles.label}>Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowWithdrawalCalendar(true)}
                >
                  <Text style={styles.dateButtonText}>
                    {formatDateForInput(formData.withdrawalDate)}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Task-specific toggles */}
            {formData.type === 'task' && (
              <>
                <View style={styles.toggleField}>
                  <Text style={styles.label}>Anytime</Text>
                  <Switch
                    value={formData.isAnytime}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isAnytime: value }))}
                  />
                </View>

                <View style={styles.toggleField}>
                  <Text style={styles.label}>Urgent</Text>
                  <Switch
                    value={formData.isUrgent}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isUrgent: value }))}
                  />
                </View>

                <View style={styles.toggleField}>
                  <Text style={styles.label}>Important</Text>
                  <Switch
                    value={formData.isImportant}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isImportant: value }))}
                  />
                </View>
              </>
            )}

            {/* Authentic Deposit toggle */}
            {(formData.type === 'task' || formData.type === 'event') && (
              <View style={styles.toggleField}>
                <Text style={styles.label}>Authentic Deposit</Text>
                <Switch
                  value={formData.isAuthenticDeposit}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, isAuthenticDeposit: value }))}
                />
              </View>
            )}

            {/* Goal Toggle and Selector */}
            {(formData.type === 'task' || formData.type === 'event') && (
              <>
                <View style={styles.toggleField}>
                  <Text style={styles.label}>Goal</Text>
                  <Switch
                    value={!!formData.selectedGoalId}
                    onValueChange={(value) => {
                      if (!value) {
                        handleGoalClear();
                      }
                    }}
                  />
                </View>

                {/* Goal Selector Dropdown */}
                {!!formData.selectedGoalId && (
                  <View style={styles.field}>
                    <Text style={styles.label}>Select Goal</Text>
                    <TouchableOpacity
                      style={styles.dropdown}
                      onPress={() => setShowGoalDropdown(!showGoalDropdown)}
                    >
                      <Text style={styles.dropdownText}>
                        {selectedGoal 
                          ? `${selectedGoal.title} (${selectedGoal.goal_type === '12week' ? '12-Week Goal' : 'Custom Goal'})`
                          : 'Select a goal...'
                        }
                      </Text>
                      {showGoalDropdown ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
                    </TouchableOpacity>
                    
                    {showGoalDropdown && (
                      <View style={styles.dropdownContent}>
                        <TouchableOpacity
                          style={styles.dropdownOption}
                          onPress={handleGoalClear}
                        >
                          <Text style={styles.clearOptionText}>Clear Selection</Text>
                        </TouchableOpacity>
                        {allAvailableGoals.map(goal => (
                          <TouchableOpacity
                            key={goal.id}
                            style={[
                              styles.dropdownOption,
                              formData.selectedGoalId === goal.id && styles.selectedDropdownOption
                            ]}
                            onPress={() => handleGoalSelect(goal)}
                          >
                            <View style={styles.goalOptionContent}>
                              <Text style={[
                                styles.goalOptionTitle,
                                formData.selectedGoalId === goal.id && styles.selectedGoalOptionTitle
                              ]}>
                                {goal.title}
                              </Text>
                              <Text style={[
                                styles.goalOptionType,
                                formData.selectedGoalId === goal.id && styles.selectedGoalOptionType
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

                {/* Goal Recurrence Information */}
                {formData.selectedGoalId && (
                  <View style={styles.goalRecurrenceContainer}>
                    <Text style={styles.goalRecurrenceTitle}>Goal Action Plan</Text>
                    {loadingGoalRecurrenceInfo ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#0078d4" />
                        <Text style={styles.loadingText}>Loading action plan...</Text>
                      </View>
                    ) : goalActionEfforts.length > 0 ? (
                      <View style={styles.goalRecurrenceInfo}>
                        <View style={styles.goalRecurrenceRow}>
                          <Text style={styles.goalRecurrenceLabel}>Actions:</Text>
                          <Text style={styles.goalRecurrenceValue}>{goalActionEfforts.length}</Text>
                        </View>
                        <View style={styles.goalRecurrenceRow}>
                          <Text style={styles.goalRecurrenceLabel}>Frequency:</Text>
                          <Text style={styles.goalRecurrenceValue}>{getRecurrenceSummary(goalActionEfforts)}</Text>
                        </View>
                        <View style={styles.goalRecurrenceRow}>
                          <Text style={styles.goalRecurrenceLabel}>Weeks:</Text>
                          <Text style={styles.goalRecurrenceValue}>
                            {summarizeWeeks(goalActionEfforts.flatMap(action => action.weekPlans || []))}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.noActionsText}>No action efforts defined for this goal</Text>
                    )}
                  </View>
                )}
              </>
            )}

            {/* Repeat section - only show when no goal is selected */}
            {(formData.type === 'task' || formData.type === 'event') && !formData.selectedGoalId && (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Repeat</Text>
                  <View style={styles.repeatOptions}>
                    {(['none', 'daily', 'weekly', 'custom'] as const).map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.repeatOption,
                          formData.recurrenceType === option && styles.activeRepeatOption
                        ]}
                        onPress={() => setFormData(prev => ({ ...prev, recurrenceType: option }))}
                      >
                        <Text style={[
                          styles.repeatOptionText,
                          formData.recurrenceType === option && styles.activeRepeatOptionText
                        ]}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {formData.recurrenceType === 'custom' && (
                  <View style={styles.field}>
                    <Text style={styles.label}>Select Days</Text>
                    <View style={styles.customDaysSelector}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.customDayButton,
                            formData.customDays.includes(index) && styles.customDayButtonSelected
                          ]}
                          onPress={() => handleCustomDayToggle(index)}
                        >
                          <Text style={[
                            styles.customDayButtonText,
                            formData.customDays.includes(index) && styles.customDayButtonTextSelected
                          ]}>
                            {dayName}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
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

            {/* Domains */}
            <View style={styles.field}>
              <Text style={styles.label}>Domains</Text>
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

            {/* 12-Week Goals (for deposit ideas only) */}
            {formData.type === 'depositIdea' && (
              <View style={styles.field}>
                <Text style={styles.label}>12-Week Goals</Text>
                <View style={styles.checkboxGrid}>
                  {twelveWeekGoals.map(goal => {
                    const isSelected = formData.selectedRoleIds.includes(goal.id);
                    return (
                      <TouchableOpacity
                        key={goal.id}
                        style={styles.checkItem}
                        onPress={() => handleMultiSelect('selectedRoleIds', goal.id)}
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

            {/* Goal chips for tasks/events when is_twelve_week_goal is true */}
            {(formData.type === 'task' || formData.type === 'event') && formData.selectedGoalId && (
              <View style={styles.field}>
                <Text style={styles.label}>Linked Goals</Text>
                <View style={styles.goalChips}>
                  {allAvailableGoals
                    .filter(goal => goal.id === formData.selectedGoalId)
                    .map(goal => (
                      <View key={goal.id} style={styles.goalChip}>
                        <Text style={styles.goalChipText}>{goal.title}</Text>
                      </View>
                    ))}
                </View>
              </View>
            )}

            {/* Notes */}
            <View style={styles.field}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, { height: 100 }]}
                placeholder={getNotesPlaceholder()}
                value={formData.notes}
                onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                multiline
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Saving...' : mode === 'edit' ? 'Update Action' : 'Save Action'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Calendar Modals */}
        <Modal visible={showCalendar} transparent animationType="fade">
          <View style={styles.calendarOverlay}>
            <View style={styles.calendarContainer}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarTitle}>Select Due Date</Text>
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
                  [formatLocalDate(formData.dueDate)]: {
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
                  setFormData(prev => ({ ...prev, startDate: new Date(day.timestamp) }));
                  setShowStartCalendar(false);
                }}
                markedDates={{
                  [formatLocalDate(formData.startDate)]: {
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
                  setFormData(prev => ({ ...prev, endDate: new Date(day.timestamp) }));
                  setShowEndCalendar(false);
                }}
                markedDates={{
                  [formatLocalDate(formData.endDate)]: {
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

        <Modal visible={showWithdrawalCalendar} transparent animationType="fade">
          <View style={styles.calendarOverlay}>
            <View style={styles.calendarContainer}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarTitle}>Select Withdrawal Date</Text>
                <TouchableOpacity onPress={() => setShowWithdrawalCalendar(false)}>
                  <X size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <Calendar
                onDayPress={(day) => {
                  setFormData(prev => ({ ...prev, withdrawalDate: new Date(day.timestamp) }));
                  setShowWithdrawalCalendar(false);
                }}
                markedDates={{
                  [formatLocalDate(formData.withdrawalDate)]: {
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
      </View>
    </Modal>
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
  toggleField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  dateButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1f2937',
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
    flex: 1,
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
  clearOptionText: {
    fontSize: 16,
    color: '#dc2626',
    fontWeight: '500',
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
  goalRecurrenceContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  goalRecurrenceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  goalRecurrenceInfo: {
    gap: 4,
  },
  goalRecurrenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalRecurrenceLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  goalRecurrenceValue: {
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '600',
  },
  noActionsText: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  repeatOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  repeatOption: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  activeRepeatOption: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  repeatOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeRepeatOptionText: {
    color: '#ffffff',
  },
  customDaysSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customDayButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  customDayButtonSelected: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  customDayButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  customDayButtonTextSelected: {
    color: '#ffffff',
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
  goalChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalChip: {
    backgroundColor: '#bfdbfe',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  goalChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1e40af',
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
});