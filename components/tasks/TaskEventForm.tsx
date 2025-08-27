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
  Platform,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { X, Clock, Calendar as CalendarIcon, Repeat } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

interface Role { id: string; label: string; }
interface Domain { id: string; name: string; }
interface Goal { id: string; title: string; }
interface KeyRelationship { id: string; name: string; role_id: string; }

interface TaskEventFormProps {
  mode: 'create' | 'edit';
  initialData?: {
    id?: string;
    title?: string;
    due_date?: string;
    start_date?: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    recurrence_rule?: string;
    is_urgent?: boolean;
    is_important?: boolean;
    is_authentic_deposit?: boolean;
    is_twelve_week_goal?: boolean;
    is_all_day?: boolean;
    type?: string;
    roles?: Array<{id: string; label: string}>;
    domains?: Array<{id: string; name: string}>;
    goals?: Array<{id: string; title: string}>;
    keyRelationships?: Array<{id: string; name: string}>;
    notes?: string;
  };
  onSubmitSuccess: () => void;
  onClose: () => void;
}

// Recurrence Settings Modal Component
interface RecurrenceSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (settings: {
    frequency: string;
    selectedDays: string[];
    endDate: Date | null;
  }) => void;
  initialSettings: {
    frequency: string;
    selectedDays: string[];
    endDate: Date | null;
  };
}

function RecurrenceSettingsModal({ visible, onClose, onSave, initialSettings }: RecurrenceSettingsModalProps) {
  const [frequency, setFrequency] = useState(initialSettings.frequency);
  const [selectedDays, setSelectedDays] = useState<string[]>(initialSettings.selectedDays);
  const [endDate, setEndDate] = useState<Date | null>(initialSettings.endDate);
  const [showEndDateCalendar, setShowEndDateCalendar] = useState(false);

  const frequencies = ['Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Yearly'];
  const weekDays = [
    { key: 'MO', label: 'Mon' },
    { key: 'TU', label: 'Tue' },
    { key: 'WE', label: 'Wed' },
    { key: 'TH', label: 'Thu' },
    { key: 'FR', label: 'Fri' },
    { key: 'SA', label: 'Sat' },
    { key: 'SU', label: 'Sun' },
  ];

  useEffect(() => {
    setFrequency(initialSettings.frequency);
    setSelectedDays(initialSettings.selectedDays);
    setEndDate(initialSettings.endDate);
  }, [initialSettings]);

  const toggleDay = (dayKey: string) => {
    setSelectedDays(prev => 
      prev.includes(dayKey) 
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey]
    );
  };

  const handleSave = () => {
    onSave({ frequency, selectedDays, endDate });
    onClose();
  };

  const formatDateForDisplay = (date: Date | null) => {
    if (!date) return 'No end date';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.recurrenceContainer}>
        <View style={styles.recurrenceHeader}>
          <Text style={styles.recurrenceTitle}>Recurrence Settings</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.recurrenceContent}>
          {/* Frequency Selection */}
          <View style={styles.recurrenceField}>
            <Text style={styles.recurrenceLabel}>Frequency</Text>
            <View style={styles.frequencyGrid}>
              {frequencies.map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[
                    styles.frequencyButton,
                    frequency === freq && styles.selectedFrequencyButton
                  ]}
                  onPress={() => setFrequency(freq)}
                >
                  <Text style={[
                    styles.frequencyButtonText,
                    frequency === freq && styles.selectedFrequencyButtonText
                  ]}>
                    {freq}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Days Selection for Weekly/Bi-weekly */}
          {(frequency === 'Weekly' || frequency === 'Bi-weekly') && (
            <View style={styles.recurrenceField}>
              <Text style={styles.recurrenceLabel}>Repeat on</Text>
              <View style={styles.daysGrid}>
                {weekDays.map((day) => (
                  <TouchableOpacity
                    key={day.key}
                    style={[
                      styles.dayButton,
                      selectedDays.includes(day.key) && styles.selectedDayButton
                    ]}
                    onPress={() => toggleDay(day.key)}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      selectedDays.includes(day.key) && styles.selectedDayButtonText
                    ]}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* End Date Selection */}
          <View style={styles.recurrenceField}>
            <Text style={styles.recurrenceLabel}>Repeat until</Text>
            <TouchableOpacity
              style={styles.endDateButton}
              onPress={() => setShowEndDateCalendar(true)}
            >
              <CalendarIcon size={16} color="#0078d4" />
              <Text style={styles.endDateButtonText}>
                {formatDateForDisplay(endDate)}
              </Text>
            </TouchableOpacity>
            {endDate && (
              <TouchableOpacity
                style={styles.clearEndDateButton}
                onPress={() => setEndDate(null)}
              >
                <Text style={styles.clearEndDateText}>Clear end date</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        <View style={styles.recurrenceActions}>
          <TouchableOpacity style={styles.recurrenceCancelButton} onPress={onClose}>
            <Text style={styles.recurrenceCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.recurrenceSaveButton} onPress={handleSave}>
            <Text style={styles.recurrenceSaveText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* End Date Calendar Modal */}
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
                  setEndDate(new Date(day.timestamp));
                  setShowEndDateCalendar(false);
                }}
                markedDates={endDate ? {
                  [endDate.toISOString().split('T')[0]]: {
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
    </Modal>
  );
}

export default function TaskEventForm({ mode, initialData, onSubmitSuccess, onClose }: TaskEventFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    type: 'task',
    isUrgent: false,
    isImportant: false,
    isAuthenticDeposit: false,
    isTwelveWeekGoal: false,
    isAllDay: false,
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    selectedGoalIds: [] as string[],
    selectedKeyRelationshipIds: [] as string[],
    notes: '',
  });

  // Date and time states
  const [dueDate, setDueDate] = useState(new Date());
  const [eventStartDate, setEventStartDate] = useState(new Date());
  const [eventEndDate, setEventEndDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());

  // Recurrence states
  const [isRepeating, setIsRepeating] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('Weekly');
  const [selectedRecurrenceDays, setSelectedRecurrenceDays] = useState<string[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);
  const [isRecurrenceModalVisible, setIsRecurrenceModalVisible] = useState(false);

  // Modal states
  const [showDueDateCalendar, setShowDueDateCalendar] = useState(false);
  const [showStartDateCalendar, setShowStartDateCalendar] = useState(false);
  const [showEndDateCalendar, setShowEndDateCalendar] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Data states
  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [loading, setLoading] = useState(false);

  // Helper function to parse RRULE
  const parseRRULE = (rrule: string) => {
    if (!rrule) return { frequency: 'Weekly', selectedDays: [], endDate: null };

    const parts = rrule.split(';');
    let frequency = 'Weekly';
    let selectedDays: string[] = [];
    let endDate: Date | null = null;

    for (const part of parts) {
      const [key, value] = part.split('=');
      switch (key) {
        case 'FREQ':
          if (value === 'DAILY') frequency = 'Daily';
          else if (value === 'WEEKLY') frequency = 'Weekly';
          else if (value === 'MONTHLY') frequency = 'Monthly';
          else if (value === 'YEARLY') frequency = 'Yearly';
          break;
        case 'INTERVAL':
          if (value === '2' && frequency === 'Weekly') frequency = 'Bi-weekly';
          break;
        case 'BYDAY':
          selectedDays = value.split(',');
          break;
        case 'UNTIL':
          endDate = new Date(value);
          break;
      }
    }

    return { frequency, selectedDays, endDate };
  };

  // Helper function to format date for RRULE UNTIL
  const formatToRRULEUntil = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  useEffect(() => {
    fetchOptions();
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        type: initialData.type || 'task',
        isUrgent: initialData.is_urgent || false,
        isImportant: initialData.is_important || false,
        isAuthenticDeposit: initialData.is_authentic_deposit || false,
        isTwelveWeekGoal: initialData.is_twelve_week_goal || false,
        isAllDay: initialData.is_all_day || false,
        selectedRoleIds: initialData.roles?.map(r => r.id) || [],
        selectedDomainIds: initialData.domains?.map(d => d.id) || [],
        selectedGoalIds: initialData.goals?.map(g => g.id) || [],
        selectedKeyRelationshipIds: initialData.keyRelationships?.map(kr => kr.id) || [],
        notes: initialData.notes || '',
      });

      if (initialData.due_date) setDueDate(new Date(initialData.due_date));
      if (initialData.start_date) setEventStartDate(new Date(initialData.start_date));
      if (initialData.end_date) setEventEndDate(new Date(initialData.end_date));
      if (initialData.start_time) setStartTime(new Date(initialData.start_time));
      if (initialData.end_time) setEndTime(new Date(initialData.end_time));

      // Parse recurrence rule if it exists
      if (initialData.recurrence_rule) {
        setIsRepeating(true);
        const parsed = parseRRULE(initialData.recurrence_rule);
        setRecurrenceFrequency(parsed.frequency);
        setSelectedRecurrenceDays(parsed.selectedDays);
        setRecurrenceEndDate(parsed.endDate);
      }
    }
  }, [initialData]);

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
        supabase.from('0008-ap-goals-12wk').select('id,title').eq('user_id', user.id).eq('is_active', true),
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

  const handleRecurrenceToggle = (value: boolean) => {
    setIsRepeating(value);
    if (value) {
      setIsRecurrenceModalVisible(true);
    } else {
      // Clear recurrence settings
      setRecurrenceFrequency('Weekly');
      setSelectedRecurrenceDays([]);
      setRecurrenceEndDate(null);
    }
  };

  const handleRecurrenceSave = (settings: { frequency: string; selectedDays: string[]; endDate: Date | null }) => {
    setRecurrenceFrequency(settings.frequency);
    setSelectedRecurrenceDays(settings.selectedDays);
    setRecurrenceEndDate(settings.endDate);
  };

  const constructRecurrenceRule = () => {
    if (!isRepeating) return null;

    let rrule = '';
    
    // Set frequency
    switch (recurrenceFrequency) {
      case 'Daily':
        rrule = 'FREQ=DAILY';
        break;
      case 'Weekly':
        rrule = 'FREQ=WEEKLY';
        break;
      case 'Bi-weekly':
        rrule = 'FREQ=WEEKLY;INTERVAL=2';
        break;
      case 'Monthly':
        rrule = 'FREQ=MONTHLY';
        break;
      case 'Yearly':
        rrule = 'FREQ=YEARLY';
        break;
    }

    // Add days for weekly/bi-weekly
    if ((recurrenceFrequency === 'Weekly' || recurrenceFrequency === 'Bi-weekly') && selectedRecurrenceDays.length > 0) {
      rrule += `;BYDAY=${selectedRecurrenceDays.join(',')}`;
    }

    // Add end date
    if (recurrenceEndDate) {
      rrule += `;UNTIL=${formatToRRULEUntil(recurrenceEndDate)}`;
    }

    return rrule;
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

      // Construct the recurrence rule
      const recurrenceRule = constructRecurrenceRule();

      // Prepare the payload
      const payload = {
        user_id: user.id,
        title: formData.title.trim(),
        type: formData.type,
        is_urgent: formData.isUrgent,
        is_important: formData.isImportant,
        is_authentic_deposit: formData.isAuthenticDeposit,
        is_twelve_week_goal: formData.isTwelveWeekGoal,
        is_all_day: formData.isAllDay,
        status: 'pending',
        updated_at: new Date().toISOString(),
      };

      // Set dates based on type
      if (formData.type === 'event') {
        payload.due_date = eventStartDate.toISOString().split('T')[0];
        payload.start_date = eventStartDate.toISOString().split('T')[0];
        payload.end_date = eventEndDate.toISOString().split('T')[0];
        payload.recurrence_rule = recurrenceRule;
        
        if (!formData.isAllDay) {
          payload.start_time = startTime.toISOString();
          payload.end_time = endTime.toISOString();
        }
      } else {
        payload.due_date = dueDate.toISOString().split('T')[0];
        
        if (!formData.isAllDay) {
          payload.start_time = startTime.toISOString();
          payload.end_time = endTime.toISOString();
        }
      }

      let taskData;
      let taskError;

      if (mode === 'edit' && initialData?.id) {
        const { data, error } = await supabase
          .from('0008-ap-tasks')
          .update(payload)
          .eq('id', initialData.id)
          .select()
          .single();
        taskData = data;
        taskError = error;
      } else {
        const { data, error } = await supabase
          .from('0008-ap-tasks')
          .insert(payload)
          .select()
          .single();
        taskData = data;
        taskError = error;
      }

      if (taskError) throw taskError;
      if (!taskData) throw new Error('Failed to save task');

      const taskId = taskData.id;

      // Handle joins
      if (mode === 'edit') {
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
      console.error('Error saving task/event:', error);
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

  const formatTimeForInput = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getRecurrenceDisplayText = () => {
    if (!isRepeating) return 'No repeat';
    
    let text = recurrenceFrequency;
    if ((recurrenceFrequency === 'Weekly' || recurrenceFrequency === 'Bi-weekly') && selectedRecurrenceDays.length > 0) {
      const dayLabels = selectedRecurrenceDays.map(day => {
        const dayMap = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };
        return dayMap[day] || day;
      });
      text += ` on ${dayLabels.join(', ')}`;
    }
    if (recurrenceEndDate) {
      text += ` until ${recurrenceEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return text;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {mode === 'edit' ? 'Edit' : 'New'} {formData.type === 'event' ? 'Event' : 'Task'}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <X size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              placeholder="Enter title"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[styles.typeButton, formData.type === 'task' && styles.activeTypeButton]}
                onPress={() => setFormData(prev => ({ ...prev, type: 'task' }))}
              >
                <Text style={[styles.typeButtonText, formData.type === 'task' && styles.activeTypeButtonText]}>
                  Task
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, formData.type === 'event' && styles.activeTypeButton]}
                onPress={() => setFormData(prev => ({ ...prev, type: 'event' }))}
              >
                <Text style={[styles.typeButtonText, formData.type === 'event' && styles.activeTypeButtonText]}>
                  Event
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Fields - Different for Tasks vs Events */}
          {formData.type === 'event' ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Start Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowStartDateCalendar(true)}
                >
                  <CalendarIcon size={16} color="#0078d4" />
                  <Text style={styles.dateButtonText}>
                    {formatDateForInput(eventStartDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>End Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndDateCalendar(true)}
                >
                  <CalendarIcon size={16} color="#0078d4" />
                  <Text style={styles.dateButtonText}>
                    {formatDateForInput(eventEndDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.field}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Repeat Event</Text>
                  <Switch
                    value={isRepeating}
                    onValueChange={handleRecurrenceToggle}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor={isRepeating ? '#ffffff' : '#ffffff'}
                  />
                </View>
                {isRepeating && (
                  <TouchableOpacity
                    style={styles.recurrenceButton}
                    onPress={() => setIsRecurrenceModalVisible(true)}
                  >
                    <Repeat size={16} color="#0078d4" />
                    <Text style={styles.recurrenceButtonText}>
                      {getRecurrenceDisplayText()}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <View style={styles.field}>
              <Text style={styles.label}>Due Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDueDateCalendar(true)}
              >
                <CalendarIcon size={16} color="#0078d4" />
                <Text style={styles.dateButtonText}>
                  {formatDateForInput(dueDate)}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.field}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>All Day</Text>
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
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Clock size={16} color="#0078d4" />
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
                  <Clock size={16} color="#0078d4" />
                  <Text style={styles.timeButtonText}>
                    {formatTimeForInput(endTime)}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityGrid}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Urgent</Text>
                <Switch
                  value={formData.isUrgent}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, isUrgent: value }))}
                  trackColor={{ false: '#d1d5db', true: '#ef4444' }}
                  thumbColor={formData.isUrgent ? '#ffffff' : '#ffffff'}
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Important</Text>
                <Switch
                  value={formData.isImportant}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, isImportant: value }))}
                  trackColor={{ false: '#d1d5db', true: '#22c55e' }}
                  thumbColor={formData.isImportant ? '#ffffff' : '#ffffff'}
                />
              </View>
            </View>
          </View>

          <View style={styles.field}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Authentic Deposit</Text>
              <Switch
                value={formData.isAuthenticDeposit}
                onValueChange={(value) => setFormData(prev => ({ ...prev, isAuthenticDeposit: value }))}
                trackColor={{ false: '#d1d5db', true: '#7c3aed' }}
                thumbColor={formData.isAuthenticDeposit ? '#ffffff' : '#ffffff'}
              />
            </View>
          </View>

          <View style={styles.field}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>12-Week Goal</Text>
              <Switch
                value={formData.isTwelveWeekGoal}
                onValueChange={(value) => setFormData(prev => ({ ...prev, isTwelveWeekGoal: value }))}
                trackColor={{ false: '#d1d5db', true: '#0891b2' }}
                thumbColor={formData.isTwelveWeekGoal ? '#ffffff' : '#ffffff'}
              />
            </View>
          </View>

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

          <View style={styles.field}>
            <Text style={styles.label}>Goals</Text>
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
          <Text style={styles.submitButtonText}>
            {loading ? 'Saving...' : mode === 'edit' ? 'Update' : 'Create'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Due Date Calendar Modal */}
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
                setDueDate(new Date(day.timestamp));
                setShowDueDateCalendar(false);
              }}
              markedDates={{
                [dueDate.toISOString().split('T')[0]]: {
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
                setEventStartDate(new Date(day.timestamp));
                setShowStartDateCalendar(false);
              }}
              markedDates={{
                [eventStartDate.toISOString().split('T')[0]]: {
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
                setEventEndDate(new Date(day.timestamp));
                setShowEndDateCalendar(false);
              }}
              markedDates={{
                [eventEndDate.toISOString().split('T')[0]]: {
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

      {/* Time Picker Modals */}
      {Platform.OS === 'web' ? (
        <>
          <Modal visible={showStartTimePicker} transparent animationType="fade">
            <View style={styles.timePickerOverlay}>
              <View style={styles.timePickerContainer}>
                <View style={styles.timePickerHeader}>
                  <Text style={styles.timePickerTitle}>Select Start Time</Text>
                  <TouchableOpacity onPress={() => setShowStartTimePicker(false)}>
                    <X size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                <View style={styles.timePickerContent}>
                  <input
                    type="time"
                    value={startTime.toTimeString().slice(0, 5)}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':');
                      const newTime = new Date(startTime);
                      newTime.setHours(parseInt(hours), parseInt(minutes));
                      setStartTime(newTime);
                    }}
                    style={{
                      padding: '12px',
                      fontSize: '16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      color: '#1f2937',
                    }}
                  />
                  <TouchableOpacity
                    style={styles.timePickerSaveButton}
                    onPress={() => setShowStartTimePicker(false)}
                  >
                    <Text style={styles.timePickerSaveText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <Modal visible={showEndTimePicker} transparent animationType="fade">
            <View style={styles.timePickerOverlay}>
              <View style={styles.timePickerContainer}>
                <View style={styles.timePickerHeader}>
                  <Text style={styles.timePickerTitle}>Select End Time</Text>
                  <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
                    <X size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                <View style={styles.timePickerContent}>
                  <input
                    type="time"
                    value={endTime.toTimeString().slice(0, 5)}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':');
                      const newTime = new Date(endTime);
                      newTime.setHours(parseInt(hours), parseInt(minutes));
                      setEndTime(newTime);
                    }}
                    style={{
                      padding: '12px',
                      fontSize: '16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      color: '#1f2937',
                    }}
                  />
                  <TouchableOpacity
                    style={styles.timePickerSaveButton}
                    onPress={() => setShowEndTimePicker(false)}
                  >
                    <Text style={styles.timePickerSaveText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </>
      ) : null}

      {/* Recurrence Settings Modal */}
      <RecurrenceSettingsModal
        visible={isRecurrenceModalVisible}
        onClose={() => setIsRecurrenceModalVisible(false)}
        onSave={handleRecurrenceSave}
        initialSettings={{
          frequency: recurrenceFrequency,
          selectedDays: selectedRecurrenceDays,
          endDate: recurrenceEndDate,
        }}
      />
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
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
    color: '#374151',
  },
  priorityGrid: {
    gap: 12,
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
  recurrenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0078d4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    gap: 8,
  },
  recurrenceButtonText: {
    fontSize: 14,
    color: '#0078d4',
    fontWeight: '500',
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
    minWidth: 300,
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
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  timePickerSaveButton: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  timePickerSaveText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  
  // Recurrence Modal Styles
  recurrenceContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  recurrenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  recurrenceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  recurrenceContent: {
    flex: 1,
    padding: 16,
  },
  recurrenceField: {
    marginBottom: 24,
  },
  recurrenceLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 12,
  },
  frequencyGrid: {
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
  selectedFrequencyButton: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  selectedFrequencyButtonText: {
    color: '#ffffff',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  selectedDayButton: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  selectedDayButtonText: {
    color: '#ffffff',
  },
  endDateButton: {
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
  endDateButtonText: {
    fontSize: 16,
    color: '#1f2937',
  },
  clearEndDateButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  clearEndDateText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '500',
  },
  recurrenceActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  recurrenceCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  recurrenceCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  recurrenceSaveButton: {
    flex: 1,
    backgroundColor: '#0078d4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  recurrenceSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});