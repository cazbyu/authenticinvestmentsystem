import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { X, Clock, Calendar as CalendarIcon, MapPin, FileText, Users, Target, Heart, Zap } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

interface Role { id: string; label: string; color?: string; }
interface Domain { id: string; name: string; }
interface KeyRelationship { id: string; name: string; role_id: string; }
interface Goal { id: string; title: string; }

interface TaskEventFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

export default function TaskEventForm({ mode, initialData, onSubmitSuccess, onClose }: TaskEventFormProps) {
  const [formData, setFormData] = useState({
    type: 'task',
    title: '',
    description: '',
    due_date: new Date().toISOString().split('T')[0], // Default to today
    start_date: new Date().toISOString().split('T')[0], // Default to today
    end_date: new Date().toISOString().split('T')[0], // Default to today
    start_time: '',
    end_time: '',
    location: '',
    is_urgent: false,
    is_important: false,
    is_authentic_deposit: false,
    is_all_day: false,
    is_anytime: false,
    is_twelve_week_goal: false,
    counts_toward_weekly_progress: false,
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    selectedKeyRelationshipIds: [] as string[],
    selectedGoalIds: [] as string[],
    notes: '',
    hasRepeat: false,
    repeatFrequency: 'daily' as 'daily' | 'weekly' | 'custom',
    selectedDays: [] as number[], // 0=Sunday, 1=Monday, etc.
    customFrequency: 'biweekly' as 'biweekly' | 'monthly',
    monthlyPattern: 'same_date' as 'same_date' | 'same_weekday',
    monthlyWeek: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
    monthlyDay: 1 as number, // 1=Monday, 0=Sunday, etc.
  });

  // Calendar visibility states
  const [showDueDateCalendar, setShowDueDateCalendar] = useState(false);
  const [showStartDateCalendar, setShowStartDateCalendar] = useState(false);
  const [showEndDateCalendar, setShowEndDateCalendar] = useState(false);

  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchOptions();
    if (mode === 'edit' && initialData) {
      loadInitialData();
    } else {
      resetForm();
    }
  }, [mode, initialData]);

  const resetForm = () => {
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      type: 'task',
      title: '',
      description: '',
      due_date: today,
      start_date: today,
      end_date: today,
      start_time: '',
      end_time: '',
      location: '',
      is_urgent: false,
      is_important: false,
      is_authentic_deposit: false,
      is_all_day: false,
      is_anytime: false,
      is_twelve_week_goal: false,
      counts_toward_weekly_progress: false,
      selectedRoleIds: [],
      selectedDomainIds: [],
      selectedKeyRelationshipIds: [],
      selectedGoalIds: [],
      notes: '',
      hasRepeat: false,
      repeatFrequency: 'daily',
      selectedDays: [],
      customFrequency: 'biweekly',
      monthlyPattern: 'same_date',
      monthlyWeek: 'first',
      monthlyDay: 1,
    });
  };

  const loadInitialData = () => {
    if (!initialData) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    setFormData({
      type: initialData.type || 'task',
      title: initialData.title || '',
      description: initialData.description || '',
      due_date: initialData.due_date || today,
      start_date: initialData.start_date || today,
      end_date: initialData.end_date || today,
      start_time: initialData.start_time || '',
      end_time: initialData.end_time || '',
      location: initialData.location || '',
      is_urgent: initialData.is_urgent || false,
      is_important: initialData.is_important || false,
      is_authentic_deposit: initialData.is_authentic_deposit || false,
      is_all_day: initialData.is_all_day || false,
      is_anytime: initialData.is_anytime || false,
      is_twelve_week_goal: initialData.is_twelve_week_goal || false,
      counts_toward_weekly_progress: initialData.counts_toward_weekly_progress || false,
      selectedRoleIds: initialData.selectedRoleIds || initialData.roles?.map(r => r.id) || [],
      selectedDomainIds: initialData.selectedDomainIds || initialData.domains?.map(d => d.id) || [],
      selectedKeyRelationshipIds: initialData.selectedKeyRelationshipIds || initialData.keyRelationships?.map(kr => kr.id) || [],
      selectedGoalIds: initialData.selectedGoalIds || initialData.goals?.map(g => g.id) || [],
      notes: initialData.notes || '',
      hasRepeat: !!initialData.recurrence_rule,
      repeatFrequency: parseRecurrenceRule(initialData.recurrence_rule).frequency,
      selectedDays: parseRecurrenceRule(initialData.recurrence_rule).selectedDays,
      customFrequency: parseRecurrenceRule(initialData.recurrence_rule).customFrequency,
      monthlyPattern: parseRecurrenceRule(initialData.recurrence_rule).monthlyPattern,
      monthlyWeek: parseRecurrenceRule(initialData.recurrence_rule).monthlyWeek,
      monthlyDay: parseRecurrenceRule(initialData.recurrence_rule).monthlyDay,
    });
  };

  const parseRecurrenceRule = (rrule?: string) => {
    const defaults = {
      frequency: 'daily' as 'daily' | 'weekly' | 'custom',
      selectedDays: [] as number[],
      customFrequency: 'biweekly' as 'biweekly' | 'monthly',
      monthlyPattern: 'same_date' as 'same_date' | 'same_weekday',
      monthlyWeek: 'first' as 'first' | 'second' | 'third' | 'fourth' | 'last',
      monthlyDay: 1 as number,
    };

    if (!rrule) return defaults;

    if (rrule.includes('FREQ=DAILY')) {
      return { ...defaults, frequency: 'daily' as const };
    }

    if (rrule.includes('FREQ=WEEKLY')) {
      const byDayMatch = rrule.match(/BYDAY=([^;]+)/);
      if (byDayMatch) {
        const days = byDayMatch[1].split(',');
        const dayMap = { 'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6 };
        const selectedDays = days.map(day => dayMap[day]).filter(d => d !== undefined);
        
        const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
        const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;
        
        if (interval === 2) {
          return { ...defaults, frequency: 'custom' as const, customFrequency: 'biweekly' as const, selectedDays };
        } else {
          return { ...defaults, frequency: 'weekly' as const, selectedDays };
        }
      }
    }

    if (rrule.includes('FREQ=MONTHLY')) {
      const byDayMatch = rrule.match(/BYDAY=([^;]+)/);
      if (byDayMatch) {
        const byDay = byDayMatch[1];
        const weekMatch = byDay.match(/^(-?\d+)([A-Z]{2})$/);
        if (weekMatch) {
          const weekNum = parseInt(weekMatch[1]);
          const dayCode = weekMatch[2];
          const dayMap = { 'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6 };
          const monthlyDay = dayMap[dayCode] || 1;
          
          let monthlyWeek: 'first' | 'second' | 'third' | 'fourth' | 'last';
          if (weekNum === -1) monthlyWeek = 'last';
          else if (weekNum === 1) monthlyWeek = 'first';
          else if (weekNum === 2) monthlyWeek = 'second';
          else if (weekNum === 3) monthlyWeek = 'third';
          else if (weekNum === 4) monthlyWeek = 'fourth';
          else monthlyWeek = 'first';
          
          return {
            ...defaults,
            frequency: 'custom' as const,
            customFrequency: 'monthly' as const,
            monthlyPattern: 'same_weekday' as const,
            monthlyWeek,
            monthlyDay,
          };
        }
      } else {
        return {
          ...defaults,
          frequency: 'custom' as const,
          customFrequency: 'monthly' as const,
          monthlyPattern: 'same_date' as const,
        };
      }
    }

    return defaults;
  };

  const fetchOptions = async () => {
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
        supabase.from('0008-ap-roles').select('id, label, color').eq('user_id', user.id).eq('is_active', true).order('label'),
        supabase.from('0008-ap-domains').select('id, name').order('name'),
        supabase.from('0008-ap-key-relationships').select('id, name, role_id').eq('user_id', user.id),
        supabase.from('0008-ap-goals-12wk').select('id, title').eq('user_id', user.id).eq('status', 'active').order('title')
      ]);

      setRoles(rolesData || []);
      setDomains(domainsData || []);
      setKeyRelationships(krData || []);
      setGoals(goalsData || []);
    } catch (error) {
      console.error('Error fetching options:', error);
      Alert.alert('Error', 'Failed to load form options');
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

  const handleDayToggle = (dayIndex: number) => {
    setFormData(prev => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(dayIndex)
        ? prev.selectedDays.filter(d => d !== dayIndex)
        : [...prev.selectedDays, dayIndex]
    }));
  };

  const handleRepeatFrequencyChange = (frequency: 'daily' | 'weekly' | 'custom') => {
    setFormData(prev => ({
      ...prev,
      repeatFrequency: frequency,
      // Only clear selected days when switching to Daily
      selectedDays: frequency === 'daily' ? [] : prev.selectedDays,
    }));
  };

  const generateRecurrenceRule = () => {
    if (!formData.hasRepeat) return null;

    if (formData.repeatFrequency === 'daily') {
      return 'RRULE:FREQ=DAILY';
    }

    if (formData.repeatFrequency === 'weekly') {
      if (formData.selectedDays.length === 0) {
        return 'RRULE:FREQ=WEEKLY';
      }
      const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const byDays = formData.selectedDays.map(dayIndex => dayNames[dayIndex]).join(',');
      return `RRULE:FREQ=WEEKLY;BYDAY=${byDays}`;
    }

    if (formData.repeatFrequency === 'custom') {
      if (formData.customFrequency === 'biweekly') {
        if (formData.selectedDays.length === 0) {
          return 'RRULE:FREQ=WEEKLY;INTERVAL=2';
        }
        const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        const byDays = formData.selectedDays.map(dayIndex => dayNames[dayIndex]).join(',');
        return `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${byDays}`;
      }

      if (formData.customFrequency === 'monthly') {
        if (formData.monthlyPattern === 'same_date') {
          return 'RRULE:FREQ=MONTHLY';
        } else {
          const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
          const dayCode = dayNames[formData.monthlyDay];
          const weekMap = { 'first': '1', 'second': '2', 'third': '3', 'fourth': '4', 'last': '-1' };
          const weekNum = weekMap[formData.monthlyWeek];
          return `RRULE:FREQ=MONTHLY;BYDAY=${weekNum}${dayCode}`;
        }
      }
    }

    return 'RRULE:FREQ=DAILY';
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

      const recurrenceRule = generateRecurrenceRule();

      const taskPayload = {
        user_id: user.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        type: formData.type,
        due_date: formData.type === 'task' ? formData.due_date : null,
        start_date: formData.type === 'event' ? formData.start_date : null,
        end_date: formData.type === 'event' ? formData.end_date : null,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        location: formData.location.trim() || null,
        is_urgent: formData.is_urgent,
        is_important: formData.is_important,
        is_authentic_deposit: formData.is_authentic_deposit,
        is_all_day: formData.is_all_day,
        is_anytime: formData.is_anytime,
        is_twelve_week_goal: formData.is_twelve_week_goal,
        status: 'pending',
        recurrence_rule: recurrenceRule,
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

      if (mode === 'edit') {
        await Promise.all([
          supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
        ]);
      }

      const insertPromises = [];

      if (formData.selectedRoleIds.length > 0) {
        const roleJoins = formData.selectedRoleIds.map(role_id => ({
          parent_id: taskId,
          parent_type: 'task',
          role_id,
          user_id: user.id,
        }));
        insertPromises.push(supabase.from('0008-ap-universal-roles-join').insert(roleJoins));
      }

      if (formData.selectedDomainIds.length > 0) {
        const domainJoins = formData.selectedDomainIds.map(domain_id => ({
          parent_id: taskId,
          parent_type: 'task',
          domain_id,
          user_id: user.id,
        }));
        insertPromises.push(supabase.from('0008-ap-universal-domains-join').insert(domainJoins));
      }

      if (formData.selectedKeyRelationshipIds.length > 0) {
        const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({
          parent_id: taskId,
          parent_type: 'task',
          key_relationship_id,
          user_id: user.id,
        }));
        insertPromises.push(supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins));
      }

      if (formData.selectedGoalIds.length > 0) {
        const goalJoins = formData.selectedGoalIds.map(goal_id => ({
          parent_id: taskId,
          parent_type: 'task',
          twelve_wk_goal_id: goal_id,
          goal_type: 'twelve_wk_goal',
          user_id: user.id,
        }));
        insertPromises.push(supabase.from('0008-ap-universal-goals-join').insert(goalJoins));
      }

      if (formData.notes.trim()) {
        const { data: noteData, error: noteError } = await supabase
          .from('0008-ap-notes')
          .insert({ user_id: user.id, content: formData.notes.trim() })
          .select()
          .single();
        
        if (noteError) throw noteError;
        
        insertPromises.push(
          supabase.from('0008-ap-universal-notes-join').insert({
            parent_id: taskId,
            parent_type: 'task',
            note_id: noteData.id,
            user_id: user.id,
          })
        );
      }

      if (insertPromises.length > 0) {
        const results = await Promise.all(insertPromises);
        for (const result of results) {
          if (result.error) throw result.error;
        }
      }

      Alert.alert('Success', `${formData.type === 'task' ? 'Task' : 'Event'} ${mode === 'edit' ? 'updated' : 'created'} successfully!`);
      onSubmitSuccess();
    } catch (error) {
      console.error('Error saving task/event:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const filteredKeyRelationships = keyRelationships.filter(kr => 
    formData.selectedRoleIds.includes(kr.role_id)
  );

  const formatDateForDisplay = (dateString: string) => {
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  return (
    <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {mode === 'edit' ? 'Edit' : 'Create'} {formData.type === 'task' ? 'Task' : 'Event'}
          </Text>
          <TouchableOpacity 
            style={[styles.saveButton, (!formData.title.trim() || saving) && styles.saveButtonDisabled]}
            onPress={handleSubmit}
            disabled={!formData.title.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.form}>
            {/* Type Toggle */}
            <View style={styles.field}>
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
            {formData.type === 'task' ? (
              <View style={styles.field}>
                <Text style={styles.label}>Due Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDueDateCalendar(true)}
                >
                  <CalendarIcon size={16} color="#6b7280" />
                  <Text style={styles.dateButtonText}>
                    {formatDateForDisplay(formData.due_date)}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Start Date</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowStartDateCalendar(true)}
                  >
                    <CalendarIcon size={16} color="#6b7280" />
                    <Text style={styles.dateButtonText}>
                      {formatDateForDisplay(formData.start_date)}
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
                      {formatDateForDisplay(formData.end_date)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Time Fields */}
            <View style={styles.timeSection}>
              <View style={styles.timeToggleRow}>
                <View style={styles.toggleItem}>
                  <Text style={styles.toggleLabel}>All Day</Text>
                  <Switch
                    value={formData.is_all_day}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, is_all_day: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor="#ffffff"
                  />
                </View>
                
                {formData.type === 'task' && (
                  <View style={styles.toggleItem}>
                    <Text style={styles.toggleLabel}>Anytime</Text>
                    <Switch
                      value={formData.is_anytime}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, is_anytime: value }))}
                      trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                      thumbColor="#ffffff"
                    />
                  </View>
                )}
              </View>

              {!formData.is_all_day && !formData.is_anytime && (
                <View style={styles.timeInputsRow}>
                  <View style={styles.timeField}>
                    <Text style={styles.timeLabel}>Start Time</Text>
                    <View style={styles.timeInputContainer}>
                      <Clock size={16} color="#6b7280" />
                      <TextInput
                        style={styles.timeInput}
                        value={formData.start_time}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, start_time: text }))}
                        placeholder="9:00 AM"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                  </View>

                  <View style={styles.timeField}>
                    <Text style={styles.timeLabel}>End Time</Text>
                    <View style={styles.timeInputContainer}>
                      <Clock size={16} color="#6b7280" />
                      <TextInput
                        style={styles.timeInput}
                        value={formData.end_time}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, end_time: text }))}
                        placeholder="10:00 AM"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Location (Events only) */}
            {formData.type === 'event' && (
              <View style={styles.field}>
                <Text style={styles.label}>Location</Text>
                <View style={styles.inputWithIcon}>
                  <MapPin size={16} color="#6b7280" />
                  <TextInput
                    style={styles.inputWithIconText}
                    value={formData.location}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
                    placeholder="Enter location"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>
            )}

            {/* Repeat Section */}
            <View style={styles.field}>
              <View style={styles.repeatToggleRow}>
                <Text style={styles.label}>Repeat</Text>
                <Switch
                  value={formData.hasRepeat}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, hasRepeat: value }))}
                  trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                  thumbColor="#ffffff"
                />
              </View>

              {formData.hasRepeat && (
                <View style={styles.repeatSection}>
                  <View style={styles.repeatToggleContainerLeft}>
                    <TouchableOpacity
                      style={[styles.repeatToggleButton, formData.repeatFrequency === 'daily' && styles.activeRepeatToggleButton]}
                      onPress={() => handleRepeatFrequencyChange('daily')}
                    >
                      <Text style={[styles.repeatToggleText, formData.repeatFrequency === 'daily' && styles.activeRepeatToggleText]}>
                        Daily
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.repeatToggleButton, formData.repeatFrequency === 'weekly' && styles.activeRepeatToggleButton]}
                      onPress={() => handleRepeatFrequencyChange('weekly')}
                    >
                      <Text style={[styles.repeatToggleText, formData.repeatFrequency === 'weekly' && styles.activeRepeatToggleText]}>
                        Weekly
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.repeatToggleButton, formData.repeatFrequency === 'custom' && styles.activeRepeatToggleButton]}
                      onPress={() => handleRepeatFrequencyChange('custom')}
                    >
                      <Text style={[styles.repeatToggleText, formData.repeatFrequency === 'custom' && styles.activeRepeatToggleText]}>
                        Custom
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Weekly Day Selection */}
                  {formData.repeatFrequency === 'weekly' && (
                    <View style={styles.daysContainer}>
                      <View style={styles.daysGrid}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.dayButton,
                              formData.selectedDays.includes(index) && styles.selectedDayButton
                            ]}
                            onPress={() => handleDayToggle(index)}
                          >
                            <Text style={[
                              styles.dayButtonText,
                              formData.selectedDays.includes(index) && styles.selectedDayButtonText
                            ]}>
                              {dayName}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Custom Frequency Options */}
                  {formData.repeatFrequency === 'custom' && (
                    <View style={styles.customFrequencySection}>
                      <View style={styles.customFrequencyToggle}>
                        <TouchableOpacity
                          style={[
                            styles.customFrequencyButton,
                            formData.customFrequency === 'biweekly' && styles.activeCustomFrequencyButton
                          ]}
                          onPress={() => setFormData(prev => ({ ...prev, customFrequency: 'biweekly' }))}
                        >
                          <Text style={[
                            styles.customFrequencyButtonText,
                            formData.customFrequency === 'biweekly' && styles.activeCustomFrequencyButtonText
                          ]}>
                            Bi-weekly
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.customFrequencyButton,
                            formData.customFrequency === 'monthly' && styles.activeCustomFrequencyButton
                          ]}
                          onPress={() => setFormData(prev => ({ ...prev, customFrequency: 'monthly' }))}
                        >
                          <Text style={[
                            styles.customFrequencyButtonText,
                            formData.customFrequency === 'monthly' && styles.activeCustomFrequencyButtonText
                          ]}>
                            Monthly
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Bi-weekly Day Selection */}
                      {formData.customFrequency === 'biweekly' && (
                        <View style={styles.daysContainer}>
                          <View style={styles.daysGrid}>
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => (
                              <TouchableOpacity
                                key={index}
                                style={[
                                  styles.dayButton,
                                  formData.selectedDays.includes(index) && styles.selectedDayButton
                                ]}
                                onPress={() => handleDayToggle(index)}
                              >
                                <Text style={[
                                  styles.dayButtonText,
                                  formData.selectedDays.includes(index) && styles.selectedDayButtonText
                                ]}>
                                  {dayName}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Monthly Pattern Selection */}
                      {formData.customFrequency === 'monthly' && (
                        <View style={styles.monthlySection}>
                          <View style={styles.monthlyPatternToggle}>
                            <TouchableOpacity
                              style={[
                                styles.monthlyPatternButton,
                                formData.monthlyPattern === 'same_date' && styles.activeMonthlyPatternButton
                              ]}
                              onPress={() => setFormData(prev => ({ ...prev, monthlyPattern: 'same_date' }))}
                            >
                              <Text style={[
                                styles.monthlyPatternButtonText,
                                formData.monthlyPattern === 'same_date' && styles.activeMonthlyPatternButtonText
                              ]}>
                                Same Date
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.monthlyPatternButton,
                                formData.monthlyPattern === 'same_weekday' && styles.activeMonthlyPatternButton
                              ]}
                              onPress={() => setFormData(prev => ({ ...prev, monthlyPattern: 'same_weekday' }))}
                            >
                              <Text style={[
                                styles.monthlyPatternButtonText,
                                formData.monthlyPattern === 'same_weekday' && styles.activeMonthlyPatternButtonText
                              ]}>
                                Same Weekday
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {formData.monthlyPattern === 'same_weekday' && (
                            <View style={styles.weekdayControls}>
                              <View style={styles.weekSelector}>
                                {(['first', 'second', 'third', 'fourth', 'last'] as const).map((week) => (
                                  <TouchableOpacity
                                    key={week}
                                    style={[
                                      styles.weekButton,
                                      formData.monthlyWeek === week && styles.selectedWeekButton
                                    ]}
                                    onPress={() => setFormData(prev => ({ ...prev, monthlyWeek: week }))}
                                  >
                                    <Text style={[
                                      styles.weekButtonText,
                                      formData.monthlyWeek === week && styles.selectedWeekButtonText
                                    ]}>
                                      {week.charAt(0).toUpperCase() + week.slice(1)}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>

                              <View style={styles.daysGrid}>
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => (
                                  <TouchableOpacity
                                    key={index}
                                    style={[
                                      styles.dayButton,
                                      formData.monthlyDay === index && styles.selectedDayButton
                                    ]}
                                    onPress={() => setFormData(prev => ({ ...prev, monthlyDay: index }))}
                                  >
                                    <Text style={[
                                      styles.dayButtonText,
                                      formData.monthlyDay === index && styles.selectedDayButtonText
                                    ]}>
                                      {dayName}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
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

            {/* Priority Toggles */}
            <View style={styles.field}>
              <Text style={styles.label}>Priority & Features</Text>
              <View style={styles.priorityGrid}>
                <View style={styles.priorityItem}>
                  <Text style={styles.priorityLabel}>Urgent</Text>
                  <Switch
                    value={formData.is_urgent}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, is_urgent: value }))}
                    trackColor={{ false: '#d1d5db', true: '#dc2626' }}
                    thumbColor="#ffffff"
                  />
                </View>
                
                <View style={styles.priorityItem}>
                  <Text style={styles.priorityLabel}>Important</Text>
                  <Switch
                    value={formData.is_important}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, is_important: value }))}
                    trackColor={{ false: '#d1d5db', true: '#16a34a' }}
                    thumbColor="#ffffff"
                  />
                </View>
                
                <View style={styles.priorityItem}>
                  <Text style={styles.priorityLabel}>Authentic Deposit</Text>
                  <Switch
                    value={formData.is_authentic_deposit}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, is_authentic_deposit: value }))}
                    trackColor={{ false: '#d1d5db', true: '#7c3aed' }}
                    thumbColor="#ffffff"
                  />
                </View>
                
                <View style={styles.priorityItem}>
                  <Text style={styles.priorityLabel}>12-Week Goal</Text>
                  <Switch
                    value={formData.is_twelve_week_goal}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, is_twelve_week_goal: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            </View>

            {/* Notes */}
            <View style={styles.field}>
              <Text style={styles.label}>Notes</Text>
              <View style={styles.inputWithIcon}>
                <FileText size={16} color="#6b7280" />
                <TextInput
                  style={[styles.inputWithIconText, styles.textArea]}
                  value={formData.notes}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                  placeholder="Add notes..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </View>
        </ScrollView>

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
                  setFormData(prev => ({ ...prev, due_date: day.dateString }));
                  setShowDueDateCalendar(false);
                }}
                markedDates={{
                  [formData.due_date]: {
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
                  setFormData(prev => ({ ...prev, start_date: day.dateString }));
                  setShowStartDateCalendar(false);
                }}
                markedDates={{
                  [formData.start_date]: {
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
                  setFormData(prev => ({ ...prev, end_date: day.dateString }));
                  setShowEndDateCalendar(false);
                }}
                markedDates={{
                  [formData.end_date]: {
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  saveButton: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
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
    flex: 1,
  },
  timeSection: {
    marginBottom: 24,
  },
  timeToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  toggleItem: {
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  timeInputsRow: {
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
    marginBottom: 8,
  },
  timeInputContainer: {
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
  timeInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  inputWithIcon: {
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
  inputWithIconText: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  repeatToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  repeatSection: {
    marginTop: 16,
  },
  repeatToggleContainerLeft: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  repeatToggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  activeRepeatToggleButton: {
    backgroundColor: '#0078d4',
  },
  repeatToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeRepeatToggleText: {
    color: '#ffffff',
  },
  daysContainer: {
    marginTop: 12,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  dayButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 45,
    alignItems: 'center',
  },
  selectedDayButton: {
    backgroundColor: '#1f2937',
    borderColor: '#1f2937',
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  selectedDayButtonText: {
    color: '#ffffff',
  },
  customFrequencySection: {
    marginTop: 12,
  },
  customFrequencyToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
    marginBottom: 16,
  },
  customFrequencyButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeCustomFrequencyButton: {
    backgroundColor: '#7c3aed',
  },
  customFrequencyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeCustomFrequencyButtonText: {
    color: '#ffffff',
  },
  monthlySection: {
    marginTop: 12,
  },
  monthlyPatternToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
    marginBottom: 16,
  },
  monthlyPatternButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeMonthlyPatternButton: {
    backgroundColor: '#ea580c',
  },
  monthlyPatternButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeMonthlyPatternButtonText: {
    color: '#ffffff',
  },
  weekdayControls: {
    gap: 12,
  },
  weekSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 12,
  },
  weekButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  selectedWeekButton: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  weekButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  selectedWeekButtonText: {
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
  priorityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  priorityLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
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