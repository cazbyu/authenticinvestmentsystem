import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Calendar as CalendarIcon, Clock, Target, Users, Heart, FileText, Plus } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

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
  initialData?: any;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

export default function TaskEventForm({ mode, initialData, onSubmitSuccess, onClose }: TaskEventFormProps) {
  const { colors } = useTheme();
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    type: 'task' as 'task' | 'event' | 'depositIdea' | 'withdrawal',
    dueDate: new Date(),
    startDate: new Date(),
    endDate: new Date(),
    startTime: '',
    endTime: '',
    isAllDay: false,
    isAnytime: false,
    isUrgent: false,
    isImportant: false,
    isAuthenticDeposit: false,
    twelveWeekGoalChecked: false,
    countsTowardWeeklyProgress: false,
    notes: '',
    amount: '',
    withdrawalDate: new Date(),
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    selectedKeyRelationshipIds: [] as string[],
    selectedGoalIds: [] as string[],
  });

  // Data states
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [allKeyRelationships, setAllKeyRelationships] = useState<KeyRelationship[]>([]);
  const [allTwelveWeekGoals, setAllTwelveWeekGoals] = useState<TwelveWeekGoal[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMode, setCalendarMode] = useState<'due' | 'start' | 'end' | 'withdrawal'>('due');

  useEffect(() => {
    if (initialData) {
      loadInitialData();
    }
    fetchFormData();
  }, [initialData]);

  const loadInitialData = () => {
    if (!initialData) return;

    setFormData({
      title: initialData.title || '',
      type: initialData.type || 'task',
      dueDate: initialData.due_date ? new Date(initialData.due_date) : new Date(),
      startDate: initialData.start_date ? new Date(initialData.start_date) : new Date(),
      endDate: initialData.end_date ? new Date(initialData.end_date) : new Date(),
      startTime: initialData.start_time || '',
      endTime: initialData.end_time || '',
      isAllDay: initialData.is_all_day || false,
      isAnytime: initialData.is_anytime || false,
      isUrgent: initialData.is_urgent || false,
      isImportant: initialData.is_important || false,
      isAuthenticDeposit: initialData.is_authentic_deposit || false,
      twelveWeekGoalChecked: initialData.twelveWeekGoalChecked || false,
      countsTowardWeeklyProgress: initialData.countsTowardWeeklyProgress || false,
      notes: initialData.notes || '',
      amount: initialData.amount?.toString() || '',
      withdrawalDate: initialData.withdrawal_date ? new Date(initialData.withdrawal_date) : new Date(),
      selectedRoleIds: initialData.selectedRoleIds || initialData.roles?.map(r => r.id) || [],
      selectedDomainIds: initialData.selectedDomainIds || initialData.domains?.map(d => d.id) || [],
      selectedKeyRelationshipIds: initialData.selectedKeyRelationshipIds || initialData.keyRelationships?.map(kr => kr.id) || [],
      selectedGoalIds: initialData.selectedGoalIds || initialData.goals?.map(g => g.id) || [],
    });
  };

  const fetchFormData = async () => {
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
        supabase.from('0008-ap-goals-12wk').select('id, title, description').eq('user_id', user.id).eq('status', 'active').order('title')
      ]);

      setAllRoles(rolesData || []);
      setAllDomains(domainsData || []);
      setAllKeyRelationships(krData || []);
      setAllTwelveWeekGoals(goalsData || []);
    } catch (error) {
      console.error('Error fetching form data:', error);
      Alert.alert('Error', 'Failed to load form data');
    } finally {
      setLoading(false);
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

  const handleCalendarSelect = (day: any) => {
    const selectedDate = new Date(day.timestamp);
    
    switch (calendarMode) {
      case 'due':
        setFormData(prev => ({ ...prev, dueDate: selectedDate }));
        break;
      case 'start':
        setFormData(prev => ({ ...prev, startDate: selectedDate }));
        break;
      case 'end':
        setFormData(prev => ({ ...prev, endDate: selectedDate }));
        break;
      case 'withdrawal':
        setFormData(prev => ({ ...prev, withdrawalDate: selectedDate }));
        break;
    }
    setShowCalendar(false);
  };

  const openCalendar = (mode: 'due' | 'start' | 'end' | 'withdrawal') => {
    setCalendarMode(mode);
    setShowCalendar(true);
  };

  const formatDateForDisplay = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (formData.type === 'withdrawal' && (!formData.amount || parseFloat(formData.amount) <= 0)) {
      Alert.alert('Error', 'Please enter a valid withdrawal amount');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      if (formData.type === 'withdrawal') {
        // Handle withdrawal creation/update
        const withdrawalPayload = {
          user_id: user.id,
          title: formData.title.trim(),
          amount: parseFloat(formData.amount),
          withdrawal_date: formData.withdrawalDate.toISOString().split('T')[0],
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
        } else {
          const { data, error } = await supabase
            .from('0008-ap-withdrawals')
            .insert(withdrawalPayload)
            .select()
            .single();
          if (error) throw error;
          withdrawalData = data;
        }

        // Handle joins for withdrawal
        const withdrawalId = withdrawalData.id;
        
        if (mode === 'edit') {
          // Clear existing joins
          await Promise.all([
            supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
            supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
            supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
          ]);
        }

        // Create new joins
        const joinPromises = [];
        
        if (formData.selectedRoleIds.length > 0) {
          const roleJoins = formData.selectedRoleIds.map(role_id => ({ 
            parent_id: withdrawalId, 
            parent_type: 'withdrawal', 
            role_id, 
            user_id: user.id 
          }));
          joinPromises.push(supabase.from('0008-ap-universal-roles-join').insert(roleJoins));
        }

        if (formData.selectedDomainIds.length > 0) {
          const domainJoins = formData.selectedDomainIds.map(domain_id => ({ 
            parent_id: withdrawalId, 
            parent_type: 'withdrawal', 
            domain_id, 
            user_id: user.id 
          }));
          joinPromises.push(supabase.from('0008-ap-universal-domains-join').insert(domainJoins));
        }

        if (formData.selectedKeyRelationshipIds.length > 0) {
          const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ 
            parent_id: withdrawalId, 
            parent_type: 'withdrawal', 
            key_relationship_id, 
            user_id: user.id 
          }));
          joinPromises.push(supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins));
        }

        if (joinPromises.length > 0) {
          await Promise.all(joinPromises);
        }

        Alert.alert('Success', `Withdrawal ${mode === 'edit' ? 'updated' : 'created'} successfully`);
      } else if (formData.type === 'depositIdea') {
        // Handle deposit idea creation/update
        const depositIdeaPayload = {
          user_id: user.id,
          title: formData.title.trim(),
          is_active: true,
          archived: false,
          follow_up: false,
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
        const depositIdeaId = depositIdeaData.id;
        
        if (mode === 'edit') {
          // Clear existing joins
          await Promise.all([
            supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
            supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
            supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
          ]);
        }

        // Create new joins
        const joinPromises = [];
        
        if (formData.selectedRoleIds.length > 0) {
          const roleJoins = formData.selectedRoleIds.map(role_id => ({ 
            parent_id: depositIdeaId, 
            parent_type: 'depositIdea', 
            role_id, 
            user_id: user.id 
          }));
          joinPromises.push(supabase.from('0008-ap-universal-roles-join').insert(roleJoins));
        }

        if (formData.selectedDomainIds.length > 0) {
          const domainJoins = formData.selectedDomainIds.map(domain_id => ({ 
            parent_id: depositIdeaId, 
            parent_type: 'depositIdea', 
            domain_id, 
            user_id: user.id 
          }));
          joinPromises.push(supabase.from('0008-ap-universal-domains-join').insert(domainJoins));
        }

        if (formData.selectedKeyRelationshipIds.length > 0) {
          const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ 
            parent_id: depositIdeaId, 
            parent_type: 'depositIdea', 
            key_relationship_id, 
            user_id: user.id 
          }));
          joinPromises.push(supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins));
        }

        if (joinPromises.length > 0) {
          await Promise.all(joinPromises);
        }

        Alert.alert('Success', `Deposit idea ${mode === 'edit' ? 'updated' : 'created'} successfully`);
      } else {
        // Handle task/event creation/update
        const taskPayload = {
          user_id: user.id,
          title: formData.title.trim(),
          type: formData.type,
          due_date: formData.type === 'task' ? formData.dueDate.toISOString().split('T')[0] : null,
          start_date: formData.type === 'event' ? formData.startDate.toISOString().split('T')[0] : null,
          end_date: formData.type === 'event' ? formData.endDate.toISOString().split('T')[0] : null,
          start_time: formData.startTime || null,
          end_time: formData.endTime || null,
          is_all_day: formData.isAllDay,
          is_anytime: formData.isAnytime,
          is_urgent: formData.isUrgent,
          is_important: formData.isImportant,
          is_authentic_deposit: formData.isAuthenticDeposit,
          is_twelve_week_goal: formData.twelveWeekGoalChecked,
          status: 'pending',
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
        const joinPromises = [];
        
        if (formData.selectedRoleIds.length > 0) {
          const roleJoins = formData.selectedRoleIds.map(role_id => ({ 
            parent_id: taskId, 
            parent_type: 'task', 
            role_id, 
            user_id: user.id 
          }));
          joinPromises.push(supabase.from('0008-ap-universal-roles-join').insert(roleJoins));
        }

        if (formData.selectedDomainIds.length > 0) {
          const domainJoins = formData.selectedDomainIds.map(domain_id => ({ 
            parent_id: taskId, 
            parent_type: 'task', 
            domain_id, 
            user_id: user.id 
          }));
          joinPromises.push(supabase.from('0008-ap-universal-domains-join').insert(domainJoins));
        }

        if (formData.selectedKeyRelationshipIds.length > 0) {
          const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ 
            parent_id: taskId, 
            parent_type: 'task', 
            key_relationship_id, 
            user_id: user.id 
          }));
          joinPromises.push(supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins));
        }

        if (formData.selectedGoalIds.length > 0) {
          const goalJoins = formData.selectedGoalIds.map(goal_id => ({ 
            parent_id: taskId, 
            parent_type: 'task', 
            twelve_wk_goal_id: goal_id,
            goal_type: 'twelve_wk_goal',
            user_id: user.id 
          }));
          joinPromises.push(supabase.from('0008-ap-universal-goals-join').insert(goalJoins));
        }

        if (joinPromises.length > 0) {
          await Promise.all(joinPromises);
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
              parent_type: formData.type === 'depositIdea' ? 'depositIdea' : 'task', 
              note_id: noteData.id, 
              user_id: user.id 
            });
        }

        Alert.alert('Success', `${formData.type === 'task' ? 'Task' : 'Event'} ${mode === 'edit' ? 'updated' : 'created'} successfully`);
      }

      onSubmitSuccess();
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const filteredKeyRelationships = allKeyRelationships.filter(kr => 
    formData.selectedRoleIds.includes(kr.role_id)
  );

  const getSelectedDate = () => {
    switch (calendarMode) {
      case 'due': return formData.dueDate;
      case 'start': return formData.startDate;
      case 'end': return formData.endDate;
      case 'withdrawal': return formData.withdrawalDate;
      default: return new Date();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {mode === 'edit' ? 'Edit' : 'Create'} {formData.type === 'task' ? 'Task' : formData.type === 'event' ? 'Event' : formData.type === 'depositIdea' ? 'Deposit Idea' : 'Withdrawal'}
        </Text>
        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: colors.primary }, (!formData.title.trim() || saving) && styles.saveButtonDisabled]}
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

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading form data...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.form}>
            {/* Type Selector */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Type</Text>
              <View style={styles.typeSelector}>
                {(['task', 'event', 'depositIdea', 'withdrawal'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      { borderColor: colors.border },
                      formData.type === type && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, type }))}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      { color: colors.text },
                      formData.type === type && styles.typeButtonTextSelected
                    ]}>
                      {type === 'depositIdea' ? 'Deposit Idea' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Title */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Title *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={formData.title}
                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                placeholder={`Enter ${formData.type} title`}
                placeholderTextColor={colors.textSecondary}
                maxLength={100}
              />
            </View>

            {/* Date Fields */}
            {formData.type === 'task' && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>Due Date</Text>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => openCalendar('due')}
                >
                  <CalendarIcon size={16} color={colors.textSecondary} />
                  <Text style={[styles.dateButtonText, { color: colors.text }]}>
                    {formatDateForDisplay(formData.dueDate)}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {formData.type === 'event' && (
              <>
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Start Date</Text>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => openCalendar('start')}
                  >
                    <CalendarIcon size={16} color={colors.textSecondary} />
                    <Text style={[styles.dateButtonText, { color: colors.text }]}>
                      {formatDateForDisplay(formData.startDate)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>End Date</Text>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => openCalendar('end')}
                  >
                    <CalendarIcon size={16} color={colors.textSecondary} />
                    <Text style={[styles.dateButtonText, { color: colors.text }]}>
                      {formatDateForDisplay(formData.endDate)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {formData.type === 'withdrawal' && (
              <>
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Amount *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={formData.amount}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, amount: text }))}
                    placeholder="0.0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Date</Text>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => openCalendar('withdrawal')}
                  >
                    <CalendarIcon size={16} color={colors.textSecondary} />
                    <Text style={[styles.dateButtonText, { color: colors.text }]}>
                      {formatDateForDisplay(formData.withdrawalDate)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Time Fields for Events */}
            {formData.type === 'event' && !formData.isAllDay && (
              <>
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Start Time</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={formData.startTime}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, startTime: text }))}
                    placeholder="HH:MM"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>End Time</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={formData.endTime}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, endTime: text }))}
                    placeholder="HH:MM"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </>
            )}

            {/* Event Options */}
            {formData.type === 'event' && (
              <View style={styles.field}>
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>All Day</Text>
                  <Switch
                    value={formData.isAllDay}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isAllDay: value }))}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.surface}
                  />
                </View>
              </View>
            )}

            {/* Task Options */}
            {(formData.type === 'task' || formData.type === 'depositIdea') && (
              <>
                <View style={styles.field}>
                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: colors.text }]}>Anytime</Text>
                    <Switch
                      value={formData.isAnytime}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, isAnytime: value }))}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.surface}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: colors.text }]}>Urgent</Text>
                    <Switch
                      value={formData.isUrgent}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, isUrgent: value }))}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.surface}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: colors.text }]}>Important</Text>
                    <Switch
                      value={formData.isImportant}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, isImportant: value }))}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.surface}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: colors.text }]}>Authentic Deposit</Text>
                    <Switch
                      value={formData.isAuthenticDeposit}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, isAuthenticDeposit: value }))}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.surface}
                    />
                  </View>
                </View>
              </>
            )}

            {/* Roles */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Roles</Text>
              <View style={[styles.checkboxGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {allRoles.map(role => {
                  const isSelected = formData.selectedRoleIds.includes(role.id);
                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={styles.checkItem}
                      onPress={() => handleMultiSelect('selectedRoleIds', role.id)}
                    >
                      <View style={[styles.checkbox, { borderColor: colors.border }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={[styles.checkLabel, { color: colors.text }]}>{role.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Key Relationships */}
            {filteredKeyRelationships.length > 0 && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>Key Relationships</Text>
                <View style={[styles.checkboxGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {filteredKeyRelationships.map(kr => {
                    const isSelected = formData.selectedKeyRelationshipIds.includes(kr.id);
                    return (
                      <TouchableOpacity
                        key={kr.id}
                        style={styles.checkItem}
                        onPress={() => handleMultiSelect('selectedKeyRelationshipIds', kr.id)}
                      >
                        <View style={[styles.checkbox, { borderColor: colors.border }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={[styles.checkLabel, { color: colors.text }]}>{kr.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Domains */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Wellness Domains</Text>
              <View style={[styles.checkboxGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {allDomains.map(domain => {
                  const isSelected = formData.selectedDomainIds.includes(domain.id);
                  return (
                    <TouchableOpacity
                      key={domain.id}
                      style={styles.checkItem}
                      onPress={() => handleMultiSelect('selectedDomainIds', domain.id)}
                    >
                      <View style={[styles.checkbox, { borderColor: colors.border }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={[styles.checkLabel, { color: colors.text }]}>{domain.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 12-Week Goals */}
            {(formData.type === 'task' || formData.type === 'depositIdea') && allTwelveWeekGoals.length > 0 && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>12-Week Goals</Text>
                <View style={[styles.checkboxGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {allTwelveWeekGoals.map(goal => {
                    const isSelected = formData.selectedGoalIds.includes(goal.id);
                    return (
                      <TouchableOpacity
                        key={goal.id}
                        style={styles.checkItem}
                        onPress={() => handleMultiSelect('selectedGoalIds', goal.id)}
                      >
                        <View style={[styles.checkbox, { borderColor: colors.border }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={[styles.checkLabel, { color: colors.text }]}>{goal.title}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Notes */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={formData.notes}
                onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                placeholder="Add notes..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            </View>
          </View>
        </ScrollView>
      )}

      {/* Mini Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={[styles.calendarContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.calendarHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.calendarTitle, { color: colors.text }]}>
                Select {calendarMode === 'due' ? 'Due' : calendarMode === 'start' ? 'Start' : calendarMode === 'end' ? 'End' : 'Withdrawal'} Date
              </Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={handleCalendarSelect}
              markedDates={{
                [getSelectedDate().toISOString().split('T')[0]]: {
                  selected: true,
                  selectedColor: colors.primary
                }
              }}
              theme={{
                backgroundColor: colors.surface,
                calendarBackground: colors.surface,
                textSectionTitleColor: colors.textSecondary,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: '#ffffff',
                todayTextColor: colors.primary,
                dayTextColor: colors.text,
                textDisabledColor: colors.textSecondary,
                dotColor: colors.primary,
                selectedDotColor: '#ffffff',
                arrowColor: colors.primary,
                disabledArrowColor: colors.textSecondary,
                monthTextColor: colors.text,
                indicatorColor: colors.primary,
                textDayFontWeight: '300',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '300',
                textDayFontSize: 16,
                textMonthFontSize: 16,
                textDayHeaderFontSize: 13
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
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
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
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
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  typeButtonTextSelected: {
    color: '#ffffff',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  checkboxGrid: {
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderRadius: 3,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkLabel: {
    fontSize: 14,
    flex: 1,
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarContainer: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
});