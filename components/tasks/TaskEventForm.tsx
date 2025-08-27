import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  FlatList,
  Switch,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { X, Calendar as CalendarIcon, Clock, ChevronDown } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

interface TaskEventFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

interface Role { id: string; label: string; }
interface Domain { id: string; name: string; }
interface KeyRelationship { id: string; name: string; role_id: string; }
interface Goal { id: string; title: string; }

export default function TaskEventForm({ 
  mode, 
  initialData, 
  onSubmitSuccess, 
  onClose 
}: TaskEventFormProps) {
  // Refs and constants
  const timeListRef = useRef<FlatList<string>>(null);
  const TIME_ROW_HEIGHT = 44; // px, match your item padding/typography

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    dueDate: new Date(),
    startTime: '09:00 AM',
    endTime: '10:00 AM',
    eventEndDate: new Date(),
    schedulingType: 'task' as 'task' | 'event',
    isAnytime: false,
    isUrgent: false,
    isImportant: false,
    isAuthenticDeposit: false,
    isTwelveWeekGoal: false,
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    selectedKeyRelationshipIds: [] as string[],
    selectedGoalIds: [] as string[],
    notes: '',
    recurrenceRule: '',
  });

  // UI state
  const [dateInputValue, setDateInputValue] = useState('');
  const [endDateInputValue, setEndDateInputValue] = useState('');
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeCalendarField, setActiveCalendarField] = useState<'start' | 'end'>('start');
  const [activeTimeField, setActiveTimeField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Options data
  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  // Time options (15-minute intervals)
  const timeOptions = React.useMemo(() => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const time = new Date();
        time.setHours(hour, minute, 0, 0);
        const timeString = time.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        times.push(timeString);
      }
    }
    return times;
  }, []);

  // Helper functions
  const toDateString = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDateForInput = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDurationLabel = (startTime: string, endTime: string) => {
    try {
      const start = new Date(`2000-01-01 ${startTime}`);
      const end = new Date(`2000-01-01 ${endTime}`);
      const diffMs = end.getTime() - start.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      if (diffHours < 1) {
        const diffMinutes = Math.round(diffMs / (1000 * 60));
        return `${diffMinutes}m`;
      } else if (diffHours === Math.floor(diffHours)) {
        return `${Math.floor(diffHours)}h`;
      } else {
        const hours = Math.floor(diffHours);
        const minutes = Math.round((diffHours - hours) * 60);
        return `${hours}h ${minutes}m`;
      }
    } catch {
      return '';
    }
  };

  // Initialize form data
  useEffect(() => {
    if (initialData) {
      const eventEndDate = initialData.end_date ? new Date(initialData.end_date) : new Date(initialData.due_date || new Date());
      
      setFormData({
        title: initialData.title || '',
        dueDate: new Date(initialData.due_date || initialData.start_date || new Date()),
        startTime: initialData.start_time ? new Date(initialData.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '09:00 AM',
        endTime: initialData.end_time ? new Date(initialData.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '10:00 AM',
        eventEndDate,
        schedulingType: initialData.type === 'event' ? 'event' : 'task',
        isAnytime: initialData.is_anytime || false,
        isUrgent: initialData.is_urgent || false,
        isImportant: initialData.is_important || false,
        isAuthenticDeposit: initialData.is_authentic_deposit || false,
        isTwelveWeekGoal: initialData.is_twelve_week_goal || false,
        selectedRoleIds: initialData.roles?.map((r: any) => r.id) || [],
        selectedDomainIds: initialData.domains?.map((d: any) => d.id) || [],
        selectedKeyRelationshipIds: initialData.keyRelationships?.map((kr: any) => kr.id) || [],
        selectedGoalIds: initialData.goals?.map((g: any) => g.id) || [],
        notes: initialData.notes || '',
        recurrenceRule: initialData.recurrence_rule || '',
      });
    } else {
      // For new items, set end date to match start date
      const today = new Date();
      setFormData(prev => ({
        ...prev,
        dueDate: today,
        eventEndDate: today,
      }));
    }
    
    fetchOptions();
  }, [initialData]);

  // Sync date input values with form data
  useEffect(() => {
    setDateInputValue(formatDateForInput(formData.dueDate));

    // If scheduling an event, ensure end date is never before start date
    if (formData.schedulingType === 'event') {
      const end = (formData as any).eventEndDate as Date | undefined;
      const startStr = toDateString(formData.dueDate);
      const endStr = end ? toDateString(end) : null;

      if (!endStr || endStr < startStr) {
        setFormData(prev => ({ ...prev, eventEndDate: prev.dueDate } as any));
        setEndDateInputValue(formatDateForInput(formData.dueDate));
      }
    }
  }, [formData.dueDate, formData.schedulingType]);

  useEffect(() => {
    if (formData.schedulingType === 'event') {
      setEndDateInputValue(formatDateForInput((formData as any).eventEndDate));
    }
  }, [(formData as any).eventEndDate]);

  // Auto-scroll time picker to current value when opened
  useEffect(() => {
    if (!showTimePicker || !activeTimeField) return;
    const currentValue = (formData as any)[activeTimeField] as string | undefined;
    if (!currentValue) return;
    const idx = timeOptions.indexOf(currentValue);
    if (idx >= 0) {
      // Wait a tick to ensure FlatList laid out
      requestAnimationFrame(() => {
        timeListRef.current?.scrollToIndex({ index: idx, animated: false });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTimePicker, activeTimeField]);

  const fetchOptions = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { data: roleData },
        { data: domainData },
        { data: krData },
        { data: goalData }
      ] = await Promise.all([
        supabase.from('0008-ap-roles').select('id,label').eq('user_id', user.id).eq('is_active', true),
        supabase.from('0008-ap-domains').select('id,name'),
        supabase.from('0008-ap-key-relationships').select('id,name,role_id').eq('user_id', user.id),
        supabase.from('0008-ap-goals-12wk').select('id,title').eq('user_id', user.id).eq('is_active', true)
      ]);

      setRoles(roleData || []);
      setDomains(domainData || []);
      setKeyRelationships(krData || []);
      setGoals(goalData || []);
    } catch (error) {
      console.error('Error fetching options:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const onCalendarDayPress = (day: any) => {
    // Create date using local time components to avoid timezone issues
    const selectedDate = new Date(day.year, day.month - 1, day.day);

    if (activeCalendarField === 'end') {
      // Directly set end date
      setFormData(prev => ({ ...prev, eventEndDate: selectedDate } as any));
      setEndDateInputValue(formatDateForInput(selectedDate));
    } else {
      // Set start date
      setFormData(prev => {
        const next: any = { ...prev, dueDate: selectedDate };
        // If event end date is missing or before new start date, sync it
        if (prev.schedulingType === 'event') {
          const end = (prev as any).eventEndDate as Date | undefined;
          if (!end || toDateString(end) < toDateString(selectedDate)) {
            next.eventEndDate = selectedDate;
            setEndDateInputValue(formatDateForInput(selectedDate));
          }
        }
        return next;
      });
      setDateInputValue(formatDateForInput(selectedDate));
    }
    setShowMiniCalendar(false);
  };

  const onTimeSelect = (time: string) => {
    if (activeTimeField) {
      setFormData(prev => {
        const next: any = { ...prev, [activeTimeField]: time };

        // If we changed startTime, ensure endTime remains after it (same-day)
        if (activeTimeField === 'startTime' && !prev.isAnytime) {
          const startIdx = timeOptions.indexOf(time);
          const endIdx = timeOptions.indexOf(prev.endTime);
          if (startIdx >= 0 && endIdx >= 0 && endIdx <= startIdx) {
            const bump = Math.min(startIdx + 2, timeOptions.length - 1); // +30 minutes (2 slots of 15m)
            next.endTime = timeOptions[bump];
          }
        }
        return next;
      });
    }
    setShowTimePicker(false);
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

      // Prepare task/event data
      const taskPayload: any = {
        user_id: user.id,
        title: formData.title.trim(),
        type: formData.schedulingType,
        due_date: toDateString(formData.dueDate),
        is_urgent: formData.isUrgent,
        is_important: formData.isImportant,
        is_authentic_deposit: formData.isAuthenticDeposit,
        is_twelve_week_goal: formData.isTwelveWeekGoal,
        updated_at: new Date().toISOString(),
      };

      // Add event-specific fields
      if (formData.schedulingType === 'event') {
        taskPayload.start_date = toDateString(formData.dueDate);
        taskPayload.end_date = toDateString((formData as any).eventEndDate);
        
        if (!formData.isAnytime) {
          // Convert time strings to full datetime
          const startDateTime = new Date(formData.dueDate);
          const endDateTime = new Date((formData as any).eventEndDate);
          
          const [startHour, startMinute, startPeriod] = formData.startTime.split(/[:\s]/);
          const [endHour, endMinute, endPeriod] = formData.endTime.split(/[:\s]/);
          
          let startHour24 = parseInt(startHour);
          let endHour24 = parseInt(endHour);
          
          if (startPeriod === 'PM' && startHour24 !== 12) startHour24 += 12;
          if (startPeriod === 'AM' && startHour24 === 12) startHour24 = 0;
          if (endPeriod === 'PM' && endHour24 !== 12) endHour24 += 12;
          if (endPeriod === 'AM' && endHour24 === 12) endHour24 = 0;
          
          startDateTime.setHours(startHour24, parseInt(startMinute), 0, 0);
          endDateTime.setHours(endHour24, parseInt(endMinute), 0, 0);
          
          taskPayload.start_time = startDateTime.toISOString();
          taskPayload.end_time = endDateTime.toISOString();
        }
      }

      // Add recurrence if specified
      if (formData.recurrenceRule) {
        taskPayload.recurrence_rule = formData.recurrenceRule;
      }

      // Save task/event
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

      const taskId = taskData.id;

      // Handle joins
      if (mode === 'edit') {
        // Clear existing joins
        await Promise.all([
          supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
        ]);
      }

      // Create new joins
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
      const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ 
        parent_id: taskId, 
        parent_type: 'task', 
        key_relationship_id, 
        user_id: user.id 
      }));
      const goalJoins = formData.selectedGoalIds.map(goal_id => ({ 
        parent_id: taskId, 
        parent_type: 'task', 
        goal_id, 
        user_id: user.id 
      }));

      // Add note if provided
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

      Alert.alert('Success', `${formData.schedulingType === 'event' ? 'Event' : 'Task'} ${mode === 'edit' ? 'updated' : 'created'} successfully`);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {mode === 'edit' ? 'Edit' : 'New'} {formData.schedulingType === 'event' ? 'Event' : 'Task'}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <X size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          {/* Title */}
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

          {/* Scheduling Type */}
          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, formData.schedulingType === 'task' && styles.activeToggle]}
                onPress={() => setFormData(prev => ({ ...prev, schedulingType: 'task' }))}
              >
                <Text style={[styles.toggleText, formData.schedulingType === 'task' && styles.activeToggleText]}>
                  Task
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, formData.schedulingType === 'event' && styles.activeToggle]}
                onPress={() => setFormData(prev => ({ ...prev, schedulingType: 'event' }))}
              >
                <Text style={[styles.toggleText, formData.schedulingType === 'event' && styles.activeToggleText]}>
                  Event
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Start Date */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {formData.schedulingType === 'event' ? 'Start Date' : 'Due Date'} *
            </Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => {
                setActiveCalendarField('start');
                setShowMiniCalendar(true);
              }}
            >
              <CalendarIcon size={16} color="#6b7280" />
              <Text style={styles.dateButtonText}>{dateInputValue}</Text>
            </TouchableOpacity>
          </View>

          {/* End Date (Events only) */}
          {formData.schedulingType === 'event' && (
            <View style={styles.field}>
              <Text style={styles.label}>End Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  setActiveCalendarField('end');
                  setShowMiniCalendar(true);
                }}
              >
                <CalendarIcon size={16} color="#6b7280" />
                <Text style={styles.dateButtonText}>{endDateInputValue}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Time Settings */}
          {formData.schedulingType === 'event' && (
            <View style={styles.field}>
              <View style={styles.anytimeRow}>
                <Text style={styles.label}>All Day Event</Text>
                <Switch
                  value={formData.isAnytime}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, isAnytime: value }))}
                />
              </View>

              {!formData.isAnytime && (
                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <Text style={styles.timeLabel}>Start Time</Text>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => {
                        setActiveTimeField('startTime');
                        setShowTimePicker(true);
                      }}
                    >
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.timeButtonText}>{formData.startTime}</Text>
                      <ChevronDown size={16} color="#6b7280" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.timeField}>
                    <Text style={styles.timeLabel}>End Time</Text>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => {
                        setActiveTimeField('endTime');
                        setShowTimePicker(true);
                      }}
                    >
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.timeButtonText}>
                        {formData.endTime} ({getDurationLabel(formData.startTime, formData.endTime)})
                      </Text>
                      <ChevronDown size={16} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Priority */}
          <View style={styles.field}>
            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityGrid}>
              <View style={styles.priorityRow}>
                <View style={styles.priorityItem}>
                  <Switch
                    value={formData.isUrgent}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isUrgent: value }))}
                  />
                  <Text style={styles.priorityLabel}>Urgent</Text>
                </View>
                <View style={styles.priorityItem}>
                  <Switch
                    value={formData.isImportant}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isImportant: value }))}
                  />
                  <Text style={styles.priorityLabel}>Important</Text>
                </View>
              </View>
              <View style={styles.priorityRow}>
                <View style={styles.priorityItem}>
                  <Switch
                    value={formData.isAuthenticDeposit}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isAuthenticDeposit: value }))}
                  />
                  <Text style={styles.priorityLabel}>Authentic Deposit</Text>
                </View>
                <View style={styles.priorityItem}>
                  <Switch
                    value={formData.isTwelveWeekGoal}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isTwelveWeekGoal: value }))}
                  />
                  <Text style={styles.priorityLabel}>12-Week Goal</Text>
                </View>
              </View>
            </View>
          </View>

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
            {loading ? 'Saving...' : mode === 'edit' ? 'Update' : 'Create'} {formData.schedulingType === 'event' ? 'Event' : 'Task'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Modal */}
      <Modal visible={showMiniCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>
                Select {activeCalendarField === 'end' ? 'End' : 'Start'} Date
              </Text>
              <TouchableOpacity onPress={() => setShowMiniCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={onCalendarDayPress}
              markedDates={{
                [toDateString(formData.dueDate)]: {
                  selected: activeCalendarField === 'start',
                  selectedColor: '#0078d4'
                },
                ...(formData.schedulingType === 'event' && {
                  [toDateString((formData as any).eventEndDate)]: {
                    selected: activeCalendarField === 'end',
                    selectedColor: '#16a34a'
                  }
                })
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
                Select {activeTimeField === 'startTime' ? 'Start' : 'End'} Time
              </Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              ref={timeListRef}
              data={timeOptions}
              keyExtractor={(item) => item}
              getItemLayout={(_, index) => ({
                length: TIME_ROW_HEIGHT,
                offset: TIME_ROW_HEIGHT * index,
                index,
              })}
              initialScrollIndex={(() => {
                const currentValue = activeTimeField ? (formData as any)[activeTimeField] : null;
                const idx = currentValue ? timeOptions.indexOf(currentValue) : -1;
                return idx >= 0 ? idx : 0;
              })()}
              renderItem={({ item }) => {
                const label = activeTimeField === 'endTime'
                  ? `${item} (${getDurationLabel(formData.startTime, item)})`
                  : item;
                return (
                  <TouchableOpacity
                    style={styles.timeOptionPopup}
                    onPress={() => onTimeSelect(item)}
                    activeOpacity={0.1}
                  >
                    <Text style={styles.timeOptionTextPopup}>{label}</Text>
                  </TouchableOpacity>
                );
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
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeToggle: {
    backgroundColor: '#0078d4',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeToggleText: {
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
  anytimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 6,
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
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
  },
  priorityGrid: {
    gap: 12,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 16,
  },
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  priorityLabel: {
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
    width: 280,
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
  timeOptionPopup: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    height: 44, // Match TIME_ROW_HEIGHT
  },
  timeOptionTextPopup: {
    fontSize: 16,
    color: '#1f2937',
  },
});