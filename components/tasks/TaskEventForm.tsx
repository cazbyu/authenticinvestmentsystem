import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Switch,
  Platform,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { X, Calendar as CalendarIcon, Clock, Plus } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

interface TaskEventFormProps {
  mode: 'create' | 'edit';
  onSubmitSuccess: () => void;
  onClose: () => void;
  initialData?: {
    id?: string;
    title?: string;
    type?: string;
    due_date?: string;
    start_date?: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    is_urgent?: boolean;
    is_important?: boolean;
    is_authentic_deposit?: boolean;
    is_twelve_week_goal?: boolean;
    is_all_day?: boolean;
    recurrence_rule?: string;
    notes?: string;
    roles?: Array<{id: string; label: string}>;
    domains?: Array<{id: string; name: string}>;
    goals?: Array<{id: string; title: string}>;
    keyRelationships?: Array<{id: string; name: string}>;
    amount?: number;
  };
}

interface Role { id: string; label: string; }
interface Domain { id: string; name: string; }
interface Goal { id: string; title: string; }
interface KeyRelationship { id: string; name: string; role_id: string; }

export default function TaskEventForm({ mode, onSubmitSuccess, onClose, initialData }: TaskEventFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    type: 'task' as 'task' | 'event' | 'depositIdea' | 'withdrawal',
    dueDate: new Date(),
    startDate: new Date(),
    endDate: new Date(),
    startTime: new Date(),
    endTime: new Date(),
    isUrgent: false,
    isImportant: false,
    isAuthenticDeposit: false,
    isTwelveWeekGoal: false,
    isAllDay: false,
    recurrenceRule: '',
    notes: '',
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    selectedGoalIds: [] as string[],
    selectedKeyRelationshipIds: [] as string[],
    withdrawalAmount: '',
  });

  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [showStartDateCalendar, setShowStartDateCalendar] = useState(false);
  const [showEndDateCalendar, setShowEndDateCalendar] = useState(false);
  const [showDueDateCalendar, setShowDueDateCalendar] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  useEffect(() => {
    if (initialData) {
      const startTime = initialData.start_time ? new Date(initialData.start_time) : new Date();
      const endTime = initialData.end_time ? new Date(initialData.end_time) : new Date();
      
      // Set end time to 1 hour after start time if not provided
      if (!initialData.end_time && initialData.start_time) {
        endTime.setTime(startTime.getTime() + 60 * 60 * 1000);
      }

      setFormData({
        title: initialData.title || '',
        type: (initialData.type as any) || 'task',
        dueDate: initialData.due_date ? new Date(initialData.due_date) : new Date(),
        startDate: initialData.start_date ? new Date(initialData.start_date) : new Date(),
        endDate: initialData.end_date ? new Date(initialData.end_date) : new Date(),
        startTime,
        endTime,
        isUrgent: initialData.is_urgent || false,
        isImportant: initialData.is_important || false,
        isAuthenticDeposit: initialData.is_authentic_deposit || false,
        isTwelveWeekGoal: initialData.is_twelve_week_goal || false,
        isAllDay: initialData.is_all_day || false,
        recurrenceRule: initialData.recurrence_rule || '',
        notes: initialData.notes || '',
        selectedRoleIds: initialData.roles?.map(r => r.id) || [],
        selectedDomainIds: initialData.domains?.map(d => d.id) || [],
        selectedGoalIds: initialData.goals?.map(g => g.id) || [],
        selectedKeyRelationshipIds: initialData.keyRelationships?.map(kr => kr.id) || [],
        withdrawalAmount: initialData.amount?.toString() || '',
      });
    }
    fetchOptions();
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

  const handleStartDateSelect = (day: any) => {
    const selectedDate = new Date(day.timestamp);
    setFormData(prev => ({
      ...prev,
      startDate: selectedDate,
      endDate: selectedDate, // Auto-update end date to match start date
    }));
    setShowStartDateCalendar(false);
  };

  const handleEndDateSelect = (day: any) => {
    setFormData(prev => ({ ...prev, endDate: new Date(day.timestamp) }));
    setShowEndDateCalendar(false);
  };

  const handleDueDateSelect = (day: any) => {
    setFormData(prev => ({ ...prev, dueDate: new Date(day.timestamp) }));
    setShowDueDateCalendar(false);
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

  const formatTimeForDisplay = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const formatDateForDisplay = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleStartTimeSelect = (time: Date) => {
    setFormData(prev => ({ ...prev, startTime: time }));
    setShowStartTimePicker(false);
  };

  const handleEndTimeSelect = (time: Date) => {
    setFormData(prev => ({ ...prev, endTime: time }));
    setShowEndTimePicker(false);
  };

  const getCurrentTimeIndex = (currentTime: Date, timeOptions: Date[]) => {
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    
    // Find the closest 15-minute increment
    const roundedMinute = Math.round(currentMinute / 15) * 15;
    
    return timeOptions.findIndex(time => 
      time.getHours() === currentHour && time.getMinutes() === roundedMinute
    );
  };

  const renderTimePicker = (
    visible: boolean,
    onClose: () => void,
    onSelect: (time: Date) => void,
    currentTime: Date,
    title: string
  ) => {
    const timeOptions = generateTimeOptions();
    const currentIndex = getCurrentTimeIndex(currentTime, timeOptions);

    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.timePickerOverlay}>
          <View style={styles.timePickerContainer}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.timePickerTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.timePickerScroll}
              contentOffset={{ x: 0, y: currentIndex * 44 }} // Auto-scroll to current time
              showsVerticalScrollIndicator={true}
            >
              {timeOptions.map((time, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.timeOption,
                    index === currentIndex && styles.selectedTimeOption
                  ]}
                  onPress={() => onSelect(time)}
                >
                  <Text style={[
                    styles.timeOptionText,
                    index === currentIndex && styles.selectedTimeOptionText
                  ]}>
                    {formatTimeForDisplay(time)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (formData.type === 'withdrawal' && (!formData.withdrawalAmount || parseFloat(formData.withdrawalAmount) <= 0)) {
      Alert.alert('Error', 'Please enter a valid withdrawal amount');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      if (formData.type === 'withdrawal') {
        // Handle withdrawal creation/update
        const withdrawalPayload = {
          user_id: user.id,
          title: formData.title.trim(),
          amount: parseFloat(formData.withdrawalAmount),
          withdrawal_date: formData.dueDate.toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        };

        let withdrawalData;
        let withdrawalError;

        if (initialData?.id) {
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

        // Handle joins for withdrawal
        if (initialData?.id) {
          await Promise.all([
            supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
            supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
            supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
          ]);
        }

        const roleJoins = formData.selectedRoleIds.map(role_id => ({ 
          parent_id: withdrawalId, 
          parent_type: 'withdrawal', 
          role_id, 
          user_id: user.id 
        }));
        const domainJoins = formData.selectedDomainIds.map(domain_id => ({ 
          parent_id: withdrawalId, 
          parent_type: 'withdrawal', 
          domain_id, 
          user_id: user.id 
        }));
        const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ 
          parent_id: withdrawalId, 
          parent_type: 'withdrawal', 
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
              parent_id: withdrawalId, 
              parent_type: 'withdrawal', 
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
        if (krJoins.length > 0) {
          await supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins);
        }

        Alert.alert('Success', `Withdrawal ${mode === 'edit' ? 'updated' : 'created'} successfully`);
        onSubmitSuccess();
        return;
      }

      if (formData.type === 'depositIdea') {
        // Handle deposit idea creation/update
        const depositIdeaPayload = {
          user_id: user.id,
          title: formData.title.trim(),
          is_active: true,
          archived: false,
          follow_up: formData.isTwelveWeekGoal,
          updated_at: new Date().toISOString(),
        };

        let depositIdeaData;
        let depositIdeaError;

        if (initialData?.id) {
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

        // Handle joins for deposit idea
        if (initialData?.id) {
          await Promise.all([
            supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
            supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
            supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
            supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
          ]);
        }

        const roleJoins = formData.selectedRoleIds.map(role_id => ({ 
          parent_id: depositIdeaId, 
          parent_type: 'depositIdea', 
          role_id, 
          user_id: user.id 
        }));
        const domainJoins = formData.selectedDomainIds.map(domain_id => ({ 
          parent_id: depositIdeaId, 
          parent_type: 'depositIdea', 
          domain_id, 
          user_id: user.id 
        }));
        const goalJoins = formData.selectedGoalIds.map(goal_id => ({ 
          parent_id: depositIdeaId, 
          parent_type: 'depositIdea', 
          goal_id, 
          user_id: user.id 
        }));
        const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ 
          parent_id: depositIdeaId, 
          parent_type: 'depositIdea', 
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
              parent_id: depositIdeaId, 
              parent_type: 'depositIdea', 
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

        Alert.alert('Success', `Deposit idea ${mode === 'edit' ? 'updated' : 'created'} successfully`);
        onSubmitSuccess();
        return;
      }

      // Handle task/event creation/update
      const taskPayload = {
        user_id: user.id,
        title: formData.title.trim(),
        type: formData.type,
        due_date: formData.type === 'task' ? formData.dueDate.toISOString().split('T')[0] : null,
        start_date: formData.type === 'event' ? formData.startDate.toISOString().split('T')[0] : null,
        end_date: formData.type === 'event' ? formData.endDate.toISOString().split('T')[0] : null,
        start_time: (formData.type === 'event' && !formData.isAllDay) ? formData.startTime.toISOString() : null,
        end_time: (formData.type === 'event' && !formData.isAllDay) ? formData.endTime.toISOString() : null,
        is_urgent: formData.isUrgent,
        is_important: formData.isImportant,
        is_authentic_deposit: formData.isAuthenticDeposit,
        is_twelve_week_goal: formData.isTwelveWeekGoal,
        is_all_day: formData.type === 'event' ? formData.isAllDay : false,
        recurrence_rule: formData.recurrenceRule || null,
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

      // Handle joins
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

      Alert.alert('Success', `${formData.type} ${mode === 'edit' ? 'updated' : 'created'} successfully`);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {mode === 'edit' ? 'Edit' : 'Create'} {formData.type === 'depositIdea' ? 'Deposit Idea' : formData.type === 'withdrawal' ? 'Withdrawal' : formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <X size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          {/* Type Selection */}
          {!initialData?.id && (
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
          )}

          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {formData.type === 'withdrawal' ? 'Reason' : 'Title'} *
            </Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              placeholder={`Enter ${formData.type === 'withdrawal' ? 'withdrawal reason' : formData.type} title`}
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Withdrawal Amount */}
          {formData.type === 'withdrawal' && (
            <View style={styles.field}>
              <Text style={styles.label}>Amount *</Text>
              <TextInput
                style={styles.input}
                value={formData.withdrawalAmount}
                onChangeText={(text) => setFormData(prev => ({ ...prev, withdrawalAmount: text }))}
                placeholder="0.0"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
          )}

          {/* Date Fields */}
          {formData.type === 'task' && (
            <View style={styles.field}>
              <Text style={styles.label}>Due Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDueDateCalendar(true)}
              >
                <CalendarIcon size={16} color="#6b7280" />
                <Text style={styles.dateButtonText}>
                  {formatDateForDisplay(formData.dueDate)}
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
                    {formatDateForDisplay(formData.startDate)}
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
                    {formatDateForDisplay(formData.endDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* All Day Toggle */}
              <View style={styles.field}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>All Day</Text>
                  <Switch
                    value={formData.isAllDay}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isAllDay: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor={formData.isAllDay ? '#ffffff' : '#f4f3f4'}
                  />
                </View>
              </View>

              {/* Time Fields - only show if not all day */}
              {!formData.isAllDay && (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Start Time</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowStartTimePicker(true)}
                    >
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.dateButtonText}>
                        {formatTimeForDisplay(formData.startTime)}
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
                        {formatTimeForDisplay(formData.endTime)}
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
                onPress={() => setShowDueDateCalendar(true)}
              >
                <CalendarIcon size={16} color="#6b7280" />
                <Text style={styles.dateButtonText}>
                  {formatDateForDisplay(formData.dueDate)}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Priority Toggles - not for withdrawals */}
          {formData.type !== 'withdrawal' && (
            <>
              <View style={styles.field}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Urgent</Text>
                  <Switch
                    value={formData.isUrgent}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isUrgent: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor={formData.isUrgent ? '#ffffff' : '#f4f3f4'}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Important</Text>
                  <Switch
                    value={formData.isImportant}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isImportant: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor={formData.isImportant ? '#ffffff' : '#f4f3f4'}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Authentic Deposit</Text>
                  <Switch
                    value={formData.isAuthenticDeposit}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isAuthenticDeposit: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor={formData.isAuthenticDeposit ? '#ffffff' : '#f4f3f4'}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>12-Week Goal</Text>
                  <Switch
                    value={formData.isTwelveWeekGoal}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, isTwelveWeekGoal: value }))}
                    trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                    thumbColor={formData.isTwelveWeekGoal ? '#ffffff' : '#f4f3f4'}
                  />
                </View>
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

          {/* Key Relationships - only show if roles are selected */}
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

          {/* Goals - not for withdrawals */}
          {formData.type !== 'withdrawal' && (
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
          )}

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
            {loading ? 'Saving...' : mode === 'edit' ? 'Update' : 'Create'}
          </Text>
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
              onDayPress={handleDueDateSelect}
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
              onDayPress={handleStartDateSelect}
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
              onDayPress={handleEndDateSelect}
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

      {/* Time Picker Modals */}
      {renderTimePicker(
        showStartTimePicker,
        () => setShowStartTimePicker(false),
        handleStartTimeSelect,
        formData.startTime,
        'Select Start Time'
      )}

      {renderTimePicker(
        showEndTimePicker,
        () => setShowEndTimePicker(false),
        handleEndTimeSelect,
        formData.endTime,
        'Select End Time'
      )}
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedTimeOption: {
    backgroundColor: '#0078d4',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#1f2937',
    textAlign: 'center',
  },
  selectedTimeOptionText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});