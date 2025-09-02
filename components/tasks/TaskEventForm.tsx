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

interface TwelveWeekGoal {
  id: string;
  title: string;
  description?: string;
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
    recurrence_rule?: string;
    type?: 'task' | 'event' | 'depositIdea' | 'withdrawal';
    is_all_day?: boolean;
    is_anytime?: boolean;
    is_urgent?: boolean;
    is_important?: boolean;
    is_authentic_deposit?: boolean;
    is_twelve_week_goal?: boolean;
    input_kind?: string;
    unit?: string;
    countsTowardWeeklyProgress?: boolean;
    selectedRoleIds?: string[];
    selectedDomainIds?: string[];
    selectedKeyRelationshipIds?: string[];
    selectedGoalIds?: string[];
    roles?: Array<{id: string; label: string}>;
    domains?: Array<{id: string; name: string}>;
    keyRelationships?: Array<{id: string; name: string}>;
    goals?: Array<{id: string; title: string}>;
  };
  onSubmitSuccess: () => void;
  onClose: () => void;
}

const recurrenceFrequencies = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

const weekDays = [
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
  { value: 'SU', label: 'Sun' },
];

export default function TaskEventForm({ mode, initialData, onSubmitSuccess, onClose }: TaskEventFormProps) {
  // Basic form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [type, setType] = useState<'task' | 'event' | 'depositIdea' | 'withdrawal'>('task');
  
  // Task properties
  const [isAllDay, setIsAllDay] = useState(false);
  const [isAnytime, setIsAnytime] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isImportant, setIsImportant] = useState(true);
  const [isAuthenticDeposit, setIsAuthenticDeposit] = useState(true);
  const [isTwelveWeekGoal, setIsTwelveWeekGoal] = useState(false);
  const [inputKind, setInputKind] = useState('boolean');
  const [unit, setUnit] = useState('completion');
  
  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState('WEEKLY');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceByDay, setRecurrenceByDay] = useState<string[]>([]);
  const [recurrenceUntil, setRecurrenceUntil] = useState<Date | null>(null);
  
  // Selection state
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [selectedKeyRelationshipIds, setSelectedKeyRelationshipIds] = useState<string[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  
  // Data state
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [allKeyRelationships, setAllKeyRelationships] = useState<KeyRelationship[]>([]);
  const [allGoals, setAllGoals] = useState<TwelveWeekGoal[]>([]);
  const [currentUserCycle, setCurrentUserCycle] = useState<any>(null);
  
  // UI state
  const [showCalendar, setShowCalendar] = useState(false);
  const [showStartTimeCalendar, setShowStartTimeCalendar] = useState(false);
  const [showEndTimeCalendar, setShowEndTimeCalendar] = useState(false);
  const [showRecurrenceDropdown, setShowRecurrenceDropdown] = useState(false);
  const [showUntilCalendar, setShowUntilCalendar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');

  // Parse RRULE string into component parts
  const parseRRule = (rruleString: string) => {
    if (!rruleString || !rruleString.startsWith('RRULE:')) {
      return null;
    }

    const rule = rruleString.substring(6);
    const parts = rule.split(';');
    const parsed: any = {
      freq: 'WEEKLY',
      interval: 1,
      byday: [],
      until: null,
    };

    for (const part of parts) {
      const [key, value] = part.split('=');
      
      switch (key) {
        case 'FREQ':
          if (['DAILY', 'WEEKLY', 'MONTHLY'].includes(value)) {
            parsed.freq = value;
          }
          break;
        case 'INTERVAL':
          const interval = parseInt(value, 10);
          if (!isNaN(interval) && interval > 0) {
            parsed.interval = interval;
          }
          break;
        case 'BYDAY':
          parsed.byday = value.split(',').filter(day => 
            ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].includes(day)
          );
          break;
        case 'UNTIL':
          if (value.length === 8) {
            const year = parseInt(value.substring(0, 4), 10);
            const month = parseInt(value.substring(4, 6), 10) - 1;
            const day = parseInt(value.substring(6, 8), 10);
            parsed.until = new Date(year, month, day);
          }
          break;
      }
    }

    return parsed;
  };

  // Build RRULE string from component parts
  const buildRRule = () => {
    if (!isRecurring) return null;

    let rrule = `RRULE:FREQ=${recurrenceFreq}`;
    
    if (recurrenceInterval > 1) {
      rrule += `;INTERVAL=${recurrenceInterval}`;
    }
    
    if (recurrenceFreq === 'WEEKLY' && recurrenceByDay.length > 0) {
      rrule += `;BYDAY=${recurrenceByDay.join(',')}`;
    }
    
    if (recurrenceUntil) {
      const year = recurrenceUntil.getFullYear();
      const month = String(recurrenceUntil.getMonth() + 1).padStart(2, '0');
      const day = String(recurrenceUntil.getDate()).padStart(2, '0');
      rrule += `;UNTIL=${year}${month}${day}`;
    }
    
    return rrule;
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (initialData) {
      // Basic fields
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setType(initialData.type || 'task');
      setIsAllDay(initialData.is_all_day || false);
      setIsAnytime(initialData.is_anytime || false);
      setIsUrgent(initialData.is_urgent || false);
      setIsImportant(initialData.is_important !== undefined ? initialData.is_important : true);
      setIsAuthenticDeposit(initialData.is_authentic_deposit !== undefined ? initialData.is_authentic_deposit : true);
      setIsTwelveWeekGoal(initialData.is_twelve_week_goal || false);
      setInputKind(initialData.input_kind || 'boolean');
      setUnit(initialData.unit || 'completion');

      // Handle daily tracking setup for 12-week goal actions
      if (initialData.countsTowardWeeklyProgress) {
        setInputKind('count');
        setUnit('days');
        setIsTwelveWeekGoal(true);
      }

      // Dates
      if (initialData.due_date) {
        setDueDate(new Date(initialData.due_date));
      }
      if (initialData.start_date) {
        setStartDate(new Date(initialData.start_date));
      }
      if (initialData.end_date) {
        setEndDate(new Date(initialData.end_date));
      }
      if (initialData.start_time) {
        setStartTime(new Date(initialData.start_time));
      }
      if (initialData.end_time) {
        setEndTime(new Date(initialData.end_time));
      }

      // Parse recurrence rule
      if (initialData.recurrence_rule) {
        const parsed = parseRRule(initialData.recurrence_rule);
        if (parsed) {
          setIsRecurring(true);
          setRecurrenceFreq(parsed.freq);
          setRecurrenceInterval(parsed.interval);
          setRecurrenceByDay(parsed.byday || []);
          setRecurrenceUntil(parsed.until);
        }
      }

      // Selection arrays - prioritize direct arrays, fallback to object arrays
      setSelectedRoleIds(
        initialData.selectedRoleIds || 
        initialData.roles?.map(r => r.id) || 
        []
      );
      setSelectedDomainIds(
        initialData.selectedDomainIds || 
        initialData.domains?.map(d => d.id) || 
        []
      );
      setSelectedKeyRelationshipIds(
        initialData.selectedKeyRelationshipIds || 
        initialData.keyRelationships?.map(kr => kr.id) || 
        []
      );
      setSelectedGoalIds(
        initialData.selectedGoalIds || 
        initialData.goals?.map(g => g.id) || 
        []
      );
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
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setCurrentUserCycle(cycleData);

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
        supabase.from('0008-ap-goals-12wk').select('id, title, description').eq('user_id', user.id).eq('status', 'active').order('title')
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

  const handleMultiSelect = (field: 'selectedRoleIds' | 'selectedDomainIds' | 'selectedKeyRelationshipIds' | 'selectedGoalIds', id: string) => {
    const setters = {
      selectedRoleIds: setSelectedRoleIds,
      selectedDomainIds: setSelectedDomainIds,
      selectedKeyRelationshipIds: setSelectedKeyRelationshipIds,
      selectedGoalIds: setSelectedGoalIds,
    };

    const currentValues = {
      selectedRoleIds,
      selectedDomainIds,
      selectedKeyRelationshipIds,
      selectedGoalIds,
    };

    const currentSelection = currentValues[field];
    const setter = setters[field];
    
    const newSelection = currentSelection.includes(id)
      ? currentSelection.filter(itemId => itemId !== id)
      : [...currentSelection, id];
    
    setter(newSelection);
  };

  const handleWeekDayToggle = (day: string) => {
    setRecurrenceByDay(prev => 
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

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

  const formatDateForDB = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeForDB = (date: Date) => {
    return date.toISOString();
  };

  const filteredKeyRelationships = allKeyRelationships.filter(kr => 
    selectedRoleIds.includes(kr.role_id)
  );

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Build recurrence rule if applicable
      const recurrenceRule = buildRRule();

      // Prepare task payload
      const taskPayload: any = {
        user_id: user.id,
        user_cycle_id: currentUserCycle?.id || null,
        title: title.trim(),
        description: description.trim() || null,
        type,
        is_all_day: isAllDay,
        is_anytime: isAnytime,
        is_urgent: isUrgent,
        is_important: isImportant,
        is_authentic_deposit: isAuthenticDeposit,
        is_twelve_week_goal: isTwelveWeekGoal,
        input_kind: inputKind,
        unit: unit,
        recurrence_rule: recurrenceRule,
        status: 'active',
        updated_at: new Date().toISOString(),
      };

      // Add dates based on type and settings
      if (type === 'task') {
        taskPayload.due_date = formatDateForDB(dueDate);
        if (!isAnytime && !isAllDay) {
          taskPayload.start_time = formatTimeForDB(startTime);
          taskPayload.end_time = formatTimeForDB(endTime);
        }
      } else if (type === 'event') {
        taskPayload.start_date = formatDateForDB(startDate);
        taskPayload.end_date = formatDateForDB(endDate);
        if (!isAllDay) {
          taskPayload.start_time = formatTimeForDB(startTime);
          taskPayload.end_time = formatTimeForDB(endTime);
        }
      } else if (type === 'depositIdea') {
        // Handle deposit idea creation/update
        const depositIdeaPayload = {
          user_id: user.id,
          title: title.trim(),
          is_active: true,
          archived: false,
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

        // Handle joins for deposit idea
        await handleJoins(depositIdeaData.id, 'depositIdea');
        
        // Handle notes
        if (notes.trim()) {
          await handleNotes(depositIdeaData.id, 'depositIdea');
        }

        Alert.alert('Success', `Deposit idea ${mode === 'edit' ? 'updated' : 'created'} successfully`);
        onSubmitSuccess();
        return;
      } else if (type === 'withdrawal') {
        // Handle withdrawal creation/update - this would need additional fields
        Alert.alert('Info', 'Withdrawal functionality not implemented in this form');
        return;
      }

      // For recurring items, ensure start_date is set (required for DTSTART)
      if (recurrenceRule && !taskPayload.start_date) {
        taskPayload.start_date = taskPayload.due_date || formatDateForDB(startDate);
      }

      // Create or update task/event
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

      // Handle joins
      await handleJoins(taskData.id, 'task');
      
      // Handle notes
      if (notes.trim()) {
        await handleNotes(taskData.id, 'task');
      }

      Alert.alert('Success', `${type === 'task' ? 'Task' : 'Event'} ${mode === 'edit' ? 'updated' : 'created'} successfully`);
      onSubmitSuccess();

    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoins = async (itemId: string, parentType: string) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Delete existing joins if editing
    if (mode === 'edit') {
      await Promise.all([
        supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', itemId).eq('parent_type', parentType),
        supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', itemId).eq('parent_type', parentType),
        supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', itemId).eq('parent_type', parentType),
        supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', itemId).eq('parent_type', parentType),
      ]);
    }

    // Create new joins
    const roleJoins = selectedRoleIds.map(role_id => ({ 
      parent_id: itemId, 
      parent_type: parentType, 
      role_id, 
      user_id: user.id 
    }));
    const domainJoins = selectedDomainIds.map(domain_id => ({ 
      parent_id: itemId, 
      parent_type: parentType, 
      domain_id, 
      user_id: user.id 
    }));
    const krJoins = selectedKeyRelationshipIds.map(key_relationship_id => ({ 
      parent_id: itemId, 
      parent_type: parentType, 
      key_relationship_id, 
      user_id: user.id 
    }));
    const goalJoins = selectedGoalIds.map(goal_id => ({ 
      parent_id: itemId, 
      parent_type: parentType, 
      goal_id, 
      user_id: user.id 
    }));

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
  };

  const handleNotes = async (itemId: string, parentType: string) => {
    if (!notes.trim()) return;

    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Create note
    const { data: noteData, error: noteError } = await supabase
      .from('0008-ap-notes')
      .insert({ user_id: user.id, content: notes.trim() })
      .select()
      .single();
    
    if (noteError) throw noteError;
    
    // Link note to item
    await supabase
      .from('0008-ap-universal-notes-join')
      .insert({ 
        parent_id: itemId, 
        parent_type: parentType, 
        note_id: noteData.id, 
        user_id: user.id 
      });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {mode === 'edit' ? 'Edit' : 'Create'} {type === 'task' ? 'Task' : type === 'event' ? 'Event' : type === 'depositIdea' ? 'Deposit Idea' : 'Item'}
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
              {(['task', 'event', 'depositIdea'] as const).map((typeOption) => (
                <TouchableOpacity
                  key={typeOption}
                  style={[
                    styles.typeButton,
                    type === typeOption && styles.activeTypeButton
                  ]}
                  onPress={() => setType(typeOption)}
                >
                  <Text style={[
                    styles.typeButtonText,
                    type === typeOption && styles.activeTypeButtonText
                  ]}>
                    {typeOption === 'depositIdea' ? 'Idea' : typeOption.charAt(0).toUpperCase() + typeOption.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter title"
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter description"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Date/Time Fields - only for tasks and events */}
          {(type === 'task' || type === 'event') && (
            <>
              {/* Due Date (for tasks) or Start Date (for events) */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  {type === 'task' ? 'Due Date' : 'Start Date'} *
                </Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowCalendar(true)}
                >
                  <CalendarIcon size={16} color="#6b7280" />
                  <Text style={styles.dateButtonText}>
                    {formatDateForInput(type === 'task' ? dueDate : startDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* End Date (for events only) */}
              {type === 'event' && (
                <View style={styles.field}>
                  <Text style={styles.label}>End Date</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowEndTimeCalendar(true)}
                  >
                    <CalendarIcon size={16} color="#6b7280" />
                    <Text style={styles.dateButtonText}>
                      {formatDateForInput(endDate)}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* All Day Toggle */}
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>All Day</Text>
                <Switch
                  value={isAllDay}
                  onValueChange={setIsAllDay}
                  trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                  thumbColor={isAllDay ? '#ffffff' : '#ffffff'}
                />
              </View>

              {/* Anytime Toggle (for tasks only) */}
              {type === 'task' && (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Anytime</Text>
                  <Switch
                    value={isAnytime}
                    onValueChange={setIsAnytime}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor={isAnytime ? '#ffffff' : '#ffffff'}
                  />
                </View>
              )}

              {/* Time Fields - only when not all day or anytime */}
              {!isAllDay && !isAnytime && (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Start Time</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowStartTimeCalendar(true)}
                    >
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.dateButtonText}>
                        {formatTimeForInput(startTime)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>End Time</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowEndTimeCalendar(true)}
                    >
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.dateButtonText}>
                        {formatTimeForInput(endTime)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Recurrence Section */}
              <View style={styles.field}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Repeat</Text>
                  <Switch
                    value={isRecurring}
                    onValueChange={setIsRecurring}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor={isRecurring ? '#ffffff' : '#ffffff'}
                  />
                </View>

                {isRecurring && (
                  <View style={styles.recurrenceSection}>
                    {/* Frequency Dropdown */}
                    <View style={styles.recurrenceField}>
                      <Text style={styles.recurrenceLabel}>Frequency</Text>
                      <TouchableOpacity
                        style={styles.dropdown}
                        onPress={() => setShowRecurrenceDropdown(!showRecurrenceDropdown)}
                      >
                        <Text style={styles.dropdownText}>
                          {recurrenceFrequencies.find(f => f.value === recurrenceFreq)?.label || 'Weekly'}
                        </Text>
                        {showRecurrenceDropdown ? <ChevronUp size={16} color="#6b7280" /> : <ChevronDown size={16} color="#6b7280" />}
                      </TouchableOpacity>
                      
                      {showRecurrenceDropdown && (
                        <View style={styles.dropdownContent}>
                          {recurrenceFrequencies.map(freq => (
                            <TouchableOpacity
                              key={freq.value}
                              style={[styles.dropdownOption, recurrenceFreq === freq.value && styles.selectedDropdownOption]}
                              onPress={() => {
                                setRecurrenceFreq(freq.value);
                                setShowRecurrenceDropdown(false);
                              }}
                            >
                              <Text style={[
                                styles.dropdownOptionText,
                                recurrenceFreq === freq.value && styles.selectedDropdownOptionText
                              ]}>
                                {freq.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    {/* Interval */}
                    <View style={styles.recurrenceField}>
                      <Text style={styles.recurrenceLabel}>Every</Text>
                      <TextInput
                        style={styles.intervalInput}
                        value={recurrenceInterval.toString()}
                        onChangeText={(text) => {
                          const num = parseInt(text, 10);
                          if (!isNaN(num) && num > 0) {
                            setRecurrenceInterval(num);
                          }
                        }}
                        keyboardType="number-pad"
                        placeholder="1"
                      />
                      <Text style={styles.intervalLabel}>
                        {recurrenceFreq === 'DAILY' ? (recurrenceInterval === 1 ? 'day' : 'days') :
                         recurrenceFreq === 'WEEKLY' ? (recurrenceInterval === 1 ? 'week' : 'weeks') :
                         recurrenceInterval === 1 ? 'month' : 'months'}
                      </Text>
                    </View>

                    {/* Days of Week (for weekly recurrence) */}
                    {recurrenceFreq === 'WEEKLY' && (
                      <View style={styles.recurrenceField}>
                        <Text style={styles.recurrenceLabel}>On days</Text>
                        <View style={styles.weekDaysContainer}>
                          {weekDays.map(day => (
                            <TouchableOpacity
                              key={day.value}
                              style={[
                                styles.weekDayButton,
                                recurrenceByDay.includes(day.value) && styles.selectedWeekDayButton
                              ]}
                              onPress={() => handleWeekDayToggle(day.value)}
                            >
                              <Text style={[
                                styles.weekDayButtonText,
                                recurrenceByDay.includes(day.value) && styles.selectedWeekDayButtonText
                              ]}>
                                {day.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Until Date */}
                    <View style={styles.recurrenceField}>
                      <Text style={styles.recurrenceLabel}>Until (optional)</Text>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowUntilCalendar(true)}
                      >
                        <CalendarIcon size={16} color="#6b7280" />
                        <Text style={styles.dateButtonText}>
                          {recurrenceUntil ? formatDateForInput(recurrenceUntil) : 'No end date'}
                        </Text>
                      </TouchableOpacity>
                      {recurrenceUntil && (
                        <TouchableOpacity
                          style={styles.clearButton}
                          onPress={() => setRecurrenceUntil(null)}
                        >
                          <Text style={styles.clearButtonText}>Clear</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Priority Toggles */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Urgent</Text>
            <Switch
              value={isUrgent}
              onValueChange={setIsUrgent}
              trackColor={{ false: '#d1d5db', true: '#0078d4' }}
              thumbColor={isUrgent ? '#ffffff' : '#ffffff'}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Important</Text>
            <Switch
              value={isImportant}
              onValueChange={setIsImportant}
              trackColor={{ false: '#d1d5db', true: '#0078d4' }}
              thumbColor={isImportant ? '#ffffff' : '#ffffff'}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Authentic Deposit</Text>
            <Switch
              value={isAuthenticDeposit}
              onValueChange={setIsAuthenticDeposit}
              trackColor={{ false: '#d1d5db', true: '#0078d4' }}
              thumbColor={isAuthenticDeposit ? '#ffffff' : '#ffffff'}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>12-Week Goal</Text>
            <Switch
              value={isTwelveWeekGoal}
              onValueChange={setIsTwelveWeekGoal}
              trackColor={{ false: '#d1d5db', true: '#0078d4' }}
              thumbColor={isTwelveWeekGoal ? '#ffffff' : '#ffffff'}
            />
          </View>

          {/* 12-Week Goals Selection */}
          {allGoals.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.label}>12-Week Goals</Text>
              <View style={styles.checkboxGrid}>
                {allGoals.map(goal => {
                  const isSelected = selectedGoalIds.includes(goal.id);
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
                  const isSelected = selectedKeyRelationshipIds.includes(kr.id);
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
              {allDomains.map(domain => {
                const isSelected = selectedDomainIds.includes(domain.id);
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

          {/* Notes (for deposit ideas) */}
          {type === 'depositIdea' && (
            <View style={styles.field}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes about this idea..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
              />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.submitButton, (!title.trim() || loading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!title.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {mode === 'edit' ? 'Update' : 'Create'} {type === 'task' ? 'Task' : type === 'event' ? 'Event' : 'Idea'}
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
                {type === 'task' ? 'Select Due Date' : 'Select Start Date'}
              </Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                if (type === 'task') {
                  setDueDate(new Date(day.timestamp));
                } else {
                  setStartDate(new Date(day.timestamp));
                }
                setShowCalendar(false);
              }}
              markedDates={{
                [formatDateForDB(type === 'task' ? dueDate : startDate)]: {
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

      <Modal visible={showEndTimeCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select End Date</Text>
              <TouchableOpacity onPress={() => setShowEndTimeCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                setEndDate(new Date(day.timestamp));
                setShowEndTimeCalendar(false);
              }}
              markedDates={{
                [formatDateForDB(endDate)]: {
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

      <Modal visible={showUntilCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Repeat Until</Text>
              <TouchableOpacity onPress={() => setShowUntilCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                setRecurrenceUntil(new Date(day.timestamp));
                setShowUntilCalendar(false);
              }}
              markedDates={recurrenceUntil ? {
                [formatDateForDB(recurrenceUntil)]: {
                  selected: true,
                  selectedColor: '#0078d4'
                }
              } : {}}
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
    fontWeight: '500',
    color: '#1f2937',
  },
  recurrenceSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  recurrenceField: {
    marginBottom: 16,
  },
  recurrenceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
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
  intervalInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 16,
    color: '#1f2937',
    width: 60,
    textAlign: 'center',
    marginRight: 8,
  },
  intervalLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  weekDaysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekDayButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  selectedWeekDayButton: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  weekDayButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  selectedWeekDayButtonText: {
    color: '#ffffff',
  },
  clearButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  clearButtonText: {
    fontSize: 14,
    color: '#dc2626',
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
});