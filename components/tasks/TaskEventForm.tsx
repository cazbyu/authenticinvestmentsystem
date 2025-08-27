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
import { X, Clock, Calendar as CalendarIcon } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

interface TaskEventFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

interface Role { id: string; label: string; }
interface Domain { id: string; name: string; }
interface Goal { id: string; title: string; }
interface KeyRelationship { id: string; name: string; role_id: string; }

export default function TaskEventForm({ mode, initialData, onSubmitSuccess, onClose }: TaskEventFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    type: 'task' as 'task' | 'event' | 'depositIdea' | 'withdrawal',
    dueDate: new Date(),
    eventStartDate: new Date(),
    eventEndDate: new Date(),
    startTime: null as Date | null,
    endTime: null as Date | null,
    isAllDay: false,
    isUrgent: false,
    isImportant: false,
    isAuthenticDeposit: false,
    isTwelveWeekGoal: false,
    notes: '',
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    selectedGoalIds: [] as string[],
    selectedKeyRelationshipIds: [] as string[],
    isRepeating: false,
    recurrenceFrequency: 'Weekly' as 'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly' | 'Yearly',
    selectedRecurrenceDays: [] as string[],
  });

  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMode, setCalendarMode] = useState<'due' | 'start' | 'end'>('due');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<'start' | 'end'>('start');

  const dayAbbreviations = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (initialData) {
      const isWithdrawal = initialData.type === 'withdrawal';
      const isDepositIdea = initialData.type === 'depositIdea';
      
      if (isWithdrawal) {
        setFormData({
          title: initialData.title || '',
          type: 'withdrawal',
          dueDate: initialData.withdrawal_date ? new Date(initialData.withdrawal_date) : new Date(),
          eventStartDate: new Date(),
          eventEndDate: new Date(),
          startTime: null,
          endTime: null,
          isAllDay: false,
          isUrgent: false,
          isImportant: false,
          isAuthenticDeposit: false,
          isTwelveWeekGoal: false,
          notes: initialData.notes || '',
          selectedRoleIds: initialData.roles?.map(r => r.id) || [],
          selectedDomainIds: initialData.domains?.map(d => d.id) || [],
          selectedGoalIds: [],
          selectedKeyRelationshipIds: initialData.keyRelationships?.map(kr => kr.id) || [],
          isRepeating: false,
          recurrenceFrequency: 'Weekly',
          selectedRecurrenceDays: [],
        });
      } else if (isDepositIdea) {
        setFormData({
          title: initialData.title || '',
          type: 'depositIdea',
          dueDate: new Date(),
          eventStartDate: new Date(),
          eventEndDate: new Date(),
          startTime: null,
          endTime: null,
          isAllDay: false,
          isUrgent: false,
          isImportant: false,
          isAuthenticDeposit: false,
          isTwelveWeekGoal: false,
          notes: '',
          selectedRoleIds: initialData.roles?.map(r => r.id) || [],
          selectedDomainIds: initialData.domains?.map(d => d.id) || [],
          selectedGoalIds: initialData.goals?.map(g => g.id) || [],
          selectedKeyRelationshipIds: initialData.keyRelationships?.map(kr => kr.id) || [],
          isRepeating: false,
          recurrenceFrequency: 'Weekly',
          selectedRecurrenceDays: [],
        });
      } else {
        // Parse recurrence rule if it exists
        let parsedRecurrence = {
          isRepeating: false,
          frequency: 'Weekly' as 'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly' | 'Yearly',
          selectedDays: [] as string[]
        };

        if (initialData.recurrence_rule) {
          parsedRecurrence = parseRRULE(initialData.recurrence_rule);
        }

        setFormData({
          title: initialData.title || '',
          type: initialData.type || 'task',
          dueDate: initialData.due_date ? new Date(initialData.due_date) : new Date(),
          eventStartDate: initialData.start_date ? new Date(initialData.start_date) : new Date(),
          eventEndDate: initialData.end_date ? new Date(initialData.end_date) : new Date(),
          startTime: initialData.start_time ? new Date(initialData.start_time) : null,
          endTime: initialData.end_time ? new Date(initialData.end_time) : null,
          isAllDay: initialData.is_all_day || false,
          isUrgent: initialData.is_urgent || false,
          isImportant: initialData.is_important || false,
          isAuthenticDeposit: initialData.is_authentic_deposit || false,
          isTwelveWeekGoal: initialData.is_twelve_week_goal || false,
          notes: '',
          selectedRoleIds: initialData.roles?.map(r => r.id) || [],
          selectedDomainIds: initialData.domains?.map(d => d.id) || [],
          selectedGoalIds: initialData.goals?.map(g => g.id) || [],
          selectedKeyRelationshipIds: initialData.keyRelationships?.map(kr => kr.id) || [],
          isRepeating: parsedRecurrence.isRepeating,
          recurrenceFrequency: parsedRecurrence.frequency,
          selectedRecurrenceDays: parsedRecurrence.selectedDays,
        });
      }
    }
    fetchOptions();
  }, [initialData]);

  const parseRRULE = (rrule: string) => {
    const result = {
      isRepeating: true,
      frequency: 'Weekly' as 'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly' | 'Yearly',
      selectedDays: [] as string[]
    };

    if (!rrule) return { ...result, isRepeating: false };

    // Parse FREQ
    const freqMatch = rrule.match(/FREQ=(\w+)/);
    if (freqMatch) {
      const freq = freqMatch[1];
      const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
      const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;

      if (freq === 'DAILY') result.frequency = 'Daily';
      else if (freq === 'WEEKLY' && interval === 2) result.frequency = 'Bi-weekly';
      else if (freq === 'WEEKLY') result.frequency = 'Weekly';
      else if (freq === 'MONTHLY') result.frequency = 'Monthly';
      else if (freq === 'YEARLY') result.frequency = 'Yearly';
    }

    // Parse BYDAY for weekly/bi-weekly
    const bydayMatch = rrule.match(/BYDAY=([^;]+)/);
    if (bydayMatch) {
      result.selectedDays = bydayMatch[1].split(',');
    }

    return result;
  };

  const formatToRRULEUntil = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const fetchOptions = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { data: roleData },
        { data: domainData },
        { data: goalData },
        { data: krData }
      ] = await Promise.all([
        supabase.from('0008-ap-roles').select('id,label').eq('user_id', user.id).eq('is_active', true),
        supabase.from('0008-ap-domains').select('id,name'),
        supabase.from('0008-ap-goals-12wk').select('id,title').eq('user_id', user.id),
        supabase.from('0008-ap-key-relationships').select('id,name,role_id').eq('user_id', user.id)
      ]);

      setRoles(roleData || []);
      setDomains(domainData || []);
      setGoals(goalData || []);
      setKeyRelationships(krData || []);
    } catch (error) {
      console.error('Error fetching options:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleMultiSelect = (field: 'selectedRoleIds' | 'selectedDomainIds' | 'selectedGoalIds' | 'selectedKeyRelationshipIds', id: string) => {
    setFormData(prev => {
      const currentSelection = prev[field] as string[];
      const newSelection = currentSelection.includes(id)
        ? currentSelection.filter(itemId => itemId !== id)
        : [...currentSelection, id];
      return { ...prev, [field]: newSelection };
    });
  };

  const handleRecurrenceDayToggle = (day: string) => {
    setFormData(prev => {
      const newDays = prev.selectedRecurrenceDays.includes(day)
        ? prev.selectedRecurrenceDays.filter(d => d !== day)
        : [...prev.selectedRecurrenceDays, day];
      return { ...prev, selectedRecurrenceDays: newDays };
    });
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (formData.type === 'withdrawal') {
      // Handle withdrawal submission (existing logic)
      return;
    }

    if (formData.type === 'depositIdea') {
      // Handle deposit idea submission (existing logic)
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Construct recurrence rule
      let recurrenceRule = null;
      if (formData.isRepeating) {
        let rrule = '';
        
        switch (formData.recurrenceFrequency) {
          case 'Daily':
            rrule = 'FREQ=DAILY';
            break;
          case 'Weekly':
            rrule = 'FREQ=WEEKLY';
            if (formData.selectedRecurrenceDays.length > 0) {
              rrule += `;BYDAY=${formData.selectedRecurrenceDays.join(',')}`;
            }
            break;
          case 'Bi-weekly':
            rrule = 'FREQ=WEEKLY;INTERVAL=2';
            if (formData.selectedRecurrenceDays.length > 0) {
              rrule += `;BYDAY=${formData.selectedRecurrenceDays.join(',')}`;
            }
            break;
          case 'Monthly':
            rrule = 'FREQ=MONTHLY';
            break;
          case 'Yearly':
            rrule = 'FREQ=YEARLY';
            break;
        }

        // Add UNTIL date if end date is set
        if (formData.eventEndDate) {
          rrule += `;UNTIL=${formatToRRULEUntil(formData.eventEndDate)}`;
        }

        recurrenceRule = rrule;
      }

      const taskPayload = {
        user_id: user.id,
        title: formData.title.trim(),
        type: formData.type,
        due_date: formData.type === 'event' ? formData.eventStartDate.toISOString().split('T')[0] : formData.dueDate.toISOString().split('T')[0],
        start_date: formData.type === 'event' ? formData.eventStartDate.toISOString().split('T')[0] : null,
        end_date: formData.type === 'event' ? formData.eventEndDate.toISOString().split('T')[0] : null,
        start_time: formData.startTime && !formData.isAllDay ? formData.startTime.toISOString() : null,
        end_time: formData.endTime && !formData.isAllDay ? formData.endTime.toISOString() : null,
        is_all_day: formData.isAllDay,
        is_urgent: formData.isUrgent,
        is_important: formData.isImportant,
        is_authentic_deposit: formData.isAuthenticDeposit,
        is_twelve_week_goal: formData.isTwelveWeekGoal,
        recurrence_rule: recurrenceRule,
        status: 'pending',
        updated_at: new Date().toISOString(),
      };

      let taskData;
      let taskError;

      if (mode === 'edit' && initialData?.id) {
        const { data, error } = await supabase
          .from('0008-ap-tasks')
          .update(taskPayload)
          .eq('id', initialData.id)
          .select()
          .single();
        taskData = data;
        taskError = error;
      } else {
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

      // Handle joins for task
      if (mode === 'edit' && initialData?.id) {
        await Promise.all([
          supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
        ]);
      }

      const roleJoins = formData.selectedRoleIds.map(role_id => ({ 
        parent_id: taskId, 
        parent_type: 'task', 
        role_id, 
        user_id: user.id 
      }));
      const domainJoins = formData.selectedDomainIds.map(domain_id => ({ 
        parent_id: taskId, 
        parent_type: 'task', 
        domain_id, 
        user_id: user.id 
      }));
      const goalJoins = formData.selectedGoalIds.map(goal_id => ({ 
        parent_id: taskId, 
        parent_type: 'task', 
        goal_id, 
        user_id: user.id 
      }));
      const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ 
        parent_id: taskId, 
        parent_type: 'task', 
        key_relationship_id, 
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
            parent_id: taskId, 
            parent_type: 'task', 
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
      if (goalJoins.length > 0) {
        await supabase.from('0008-ap-universal-goals-join').insert(goalJoins);
      }
      if (krJoins.length > 0) {
        await supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins);
      }

      Alert.alert('Success', `${formData.type === 'event' ? 'Event' : 'Task'} ${mode === 'edit' ? 'updated' : 'created'} successfully`);
      onSubmitSuccess();

    } catch (error) {
      console.error('Error saving task:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const filteredKeyRelationships = keyRelationships.filter(kr => 
    formData.selectedRoleIds.includes(kr.role_id)
  );

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

  const formatDuration = () => {
    if (!formData.startTime || !formData.endTime || formData.isAllDay) return '';
    
    const start = formData.startTime;
    const end = formData.endTime;
    const durationMs = end.getTime() - start.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const time = new Date();
        time.setHours(hour, minute, 0, 0);
        times.push(time);
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {mode === 'edit' ? 'Edit' : 'Create'} {formData.type === 'event' ? 'Event' : formData.type === 'depositIdea' ? 'Deposit Idea' : formData.type === 'withdrawal' ? 'Withdrawal' : 'Task'}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <X size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          {/* Type Selection */}
          {mode === 'create' && (
            <View style={styles.field}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeSelector}>
                {(['task', 'event', 'depositIdea'] as const).map((type) => (
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
          )}

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

          {/* Date Fields */}
          {formData.type === 'event' ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Start Date *</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    setCalendarMode('start');
                    setShowCalendar(true);
                  }}
                >
                  <CalendarIcon size={16} color="#6b7280" />
                  <Text style={styles.dateButtonText}>
                    {formatDateForInput(formData.eventStartDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>End Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    setCalendarMode('end');
                    setShowCalendar(true);
                  }}
                >
                  <CalendarIcon size={16} color="#6b7280" />
                  <Text style={styles.dateButtonText}>
                    {formatDateForInput(formData.eventEndDate)}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : formData.type !== 'depositIdea' && (
            <View style={styles.field}>
              <Text style={styles.label}>Due Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  setCalendarMode('due');
                  setShowCalendar(true);
                }}
              >
                <CalendarIcon size={16} color="#6b7280" />
                <Text style={styles.dateButtonText}>
                  {formatDateForInput(formData.dueDate)}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Time Fields for Events */}
          {formData.type === 'event' && (
            <>
              <View style={styles.field}>
                <View style={styles.allDayContainer}>
                  <Text style={styles.label}>All Day Event</Text>
                  <Switch
                    value={formData.isAllDay}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isAllDay: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor={formData.isAllDay ? '#ffffff' : '#ffffff'}
                  />
                </View>
              </View>

              {!formData.isAllDay && (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Start Time</Text>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => {
                        setTimePickerMode('start');
                        setShowTimePicker(true);
                      }}
                    >
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.timeButtonText}>
                        {formatTimeForInput(formData.startTime)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>End Time</Text>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => {
                        setTimePickerMode('end');
                        setShowTimePicker(true);
                      }}
                    >
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.timeButtonText}>
                        {formatTimeForInput(formData.endTime)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {formData.startTime && formData.endTime && (
                    <View style={styles.durationContainer}>
                      <Text style={styles.durationLabel}>Duration: </Text>
                      <Text style={styles.durationValue}>{formatDuration()}</Text>
                    </View>
                  )}
                </>
              )}

              {/* Repeat Event Section */}
              <View style={styles.field}>
                <View style={styles.repeatContainer}>
                  <Text style={styles.label}>Repeat Event</Text>
                  <Switch
                    value={formData.isRepeating}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isRepeating: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor={formData.isRepeating ? '#ffffff' : '#ffffff'}
                  />
                </View>
              </View>

              {formData.isRepeating && (
                <View style={styles.recurrenceSection}>
                  <Text style={styles.sectionTitle}>Recurrence Options</Text>
                  
                  {/* Frequency Selection */}
                  <View style={styles.field}>
                    <Text style={styles.label}>Frequency</Text>
                    <View style={styles.frequencySelector}>
                      {(['Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Yearly'] as const).map((freq) => (
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
                            {freq}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Day Selection for Weekly/Bi-weekly */}
                  {(formData.recurrenceFrequency === 'Weekly' || formData.recurrenceFrequency === 'Bi-weekly') && (
                    <View style={styles.field}>
                      <Text style={styles.label}>Repeat On</Text>
                      <View style={styles.daySelector}>
                        {dayAbbreviations.map((day, index) => (
                          <TouchableOpacity
                            key={day}
                            style={[
                              styles.dayButton,
                              formData.selectedRecurrenceDays.includes(day) && styles.activeDayButton
                            ]}
                            onPress={() => handleRecurrenceDayToggle(day)}
                          >
                            <Text style={[
                              styles.dayButtonText,
                              formData.selectedRecurrenceDays.includes(day) && styles.activeDayButtonText
                            ]}>
                              {day}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={styles.dayHelperText}>
                        {formData.selectedRecurrenceDays.length === 0 
                          ? 'Select days to repeat on' 
                          : `Repeats ${formData.recurrenceFrequency.toLowerCase()} on ${formData.selectedRecurrenceDays.map(d => dayNames[dayAbbreviations.indexOf(d)]).join(', ')}`
                        }
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* Priority Section */}
          {formData.type !== 'depositIdea' && (
            <View style={styles.field}>
              <Text style={styles.label}>Priority</Text>
              <View style={styles.priorityContainer}>
                <View style={styles.priorityRow}>
                  <Text style={styles.priorityLabel}>Urgent</Text>
                  <Switch
                    value={formData.isUrgent}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isUrgent: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor={formData.isUrgent ? '#ffffff' : '#ffffff'}
                  />
                </View>
                <View style={styles.priorityRow}>
                  <Text style={styles.priorityLabel}>Important</Text>
                  <Switch
                    value={formData.isImportant}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isImportant: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor={formData.isImportant ? '#ffffff' : '#ffffff'}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Special Flags */}
          {formData.type !== 'depositIdea' && (
            <View style={styles.field}>
              <Text style={styles.label}>Special Flags</Text>
              <View style={styles.flagsContainer}>
                <View style={styles.flagRow}>
                  <Text style={styles.flagLabel}>Authentic Deposit</Text>
                  <Switch
                    value={formData.isAuthenticDeposit}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isAuthenticDeposit: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor={formData.isAuthenticDeposit ? '#ffffff' : '#ffffff'}
                  />
                </View>
                <View style={styles.flagRow}>
                  <Text style={styles.flagLabel}>12-Week Goal</Text>
                  <Switch
                    value={formData.isTwelveWeekGoal}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isTwelveWeekGoal: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor={formData.isTwelveWeekGoal ? '#ffffff' : '#ffffff'}
                  />
                </View>
              </View>
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

          {/* Goals */}
          {formData.type !== 'depositIdea' && (
            <View style={styles.field}>
              <Text style={styles.label}>12-Week Goals</Text>
              <View style={styles.checkboxGrid}>
                {goals.map(goal => {
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

          {/* Notes */}
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
              placeholder={`Optional notes about this ${formData.type}...`}
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />
          </View>
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
              {mode === 'edit' ? `Update ${formData.type === 'event' ? 'Event' : formData.type === 'depositIdea' ? 'Idea' : 'Task'}` : `Create ${formData.type === 'event' ? 'Event' : formData.type === 'depositIdea' ? 'Idea' : 'Task'}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>
                Select {calendarMode === 'due' ? 'Due Date' : calendarMode === 'start' ? 'Start Date' : 'End Date'}
              </Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                const selectedDate = new Date(day.timestamp);
                if (calendarMode === 'due') {
                  setFormData(prev => ({ ...prev, dueDate: selectedDate }));
                } else if (calendarMode === 'start') {
                  setFormData(prev => ({ ...prev, eventStartDate: selectedDate }));
                } else if (calendarMode === 'end') {
                  setFormData(prev => ({ ...prev, eventEndDate: selectedDate }));
                }
                setShowCalendar(false);
              }}
              markedDates={{
                [calendarMode === 'due' 
                  ? formData.dueDate.toISOString().split('T')[0]
                  : calendarMode === 'start'
                  ? formData.eventStartDate.toISOString().split('T')[0]
                  : formData.eventEndDate.toISOString().split('T')[0]
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

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker} transparent animationType="fade">
        <View style={styles.timePickerOverlay}>
          <View style={styles.timePickerContainer}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.timePickerTitle}>
                Select {timePickerMode === 'start' ? 'Start' : 'End'} Time
              </Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.timePickerScroll}>
              {timeOptions.map((time, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.timeOption}
                  onPress={() => {
                    if (timePickerMode === 'start') {
                      setFormData(prev => ({ ...prev, startTime: time }));
                    } else {
                      setFormData(prev => ({ ...prev, endTime: time }));
                    }
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={styles.timeOptionText}>
                    {time.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  allDayContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  durationLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  durationValue: {
    fontSize: 14,
    color: '#0078d4',
    fontWeight: '600',
  },
  repeatContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recurrenceSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  frequencySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  frequencyButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  activeFrequencyButton: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeFrequencyButtonText: {
    color: '#ffffff',
  },
  daySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDayButton: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeDayButtonText: {
    color: '#ffffff',
  },
  dayHelperText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  priorityContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
  },
  priorityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  priorityLabel: {
    fontSize: 14,
    color: '#374151',
  },
  flagsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
  },
  flagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  flagLabel: {
    fontSize: 14,
    color: '#374151',
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
    maxHeight: 400,
    width: 250,
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
  timePickerScroll: {
    maxHeight: 300,
  },
  timeOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#1f2937',
    textAlign: 'center',
  },
});