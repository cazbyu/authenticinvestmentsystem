import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { X, Calendar as CalendarIcon, Clock, Repeat } from 'lucide-react-native';
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
    amount?: number;
    withdrawal_date?: string;
    notes?: string;
    roles?: Array<{id: string; label: string}>;
    domains?: Array<{id: string; name: string}>;
    goals?: Array<{id: string; title: string}>;
    keyRelationships?: Array<{id: string; name: string}>;
  };
  onSubmitSuccess: () => void;
  onClose: () => void;
}

// RecurrenceSettingsModal Component
interface RecurrenceSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (settings: {
    isRepeating: boolean;
    frequency: string;
    selectedDays: string[];
    endDate: Date;
  }) => void;
  initialSettings: {
    isRepeating: boolean;
    frequency: string;
    selectedDays: string[];
    endDate: Date;
  };
}

function RecurrenceSettingsModal({ visible, onClose, onSave, initialSettings }: RecurrenceSettingsModalProps) {
  const [isRepeating, setIsRepeating] = useState(initialSettings.isRepeating);
  const [frequency, setFrequency] = useState(initialSettings.frequency);
  const [selectedDays, setSelectedDays] = useState<string[]>(initialSettings.selectedDays);
  const [endDate, setEndDate] = useState(initialSettings.endDate);
  const [showEndDateCalendar, setShowEndDateCalendar] = useState(false);

  const frequencies = ['Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Yearly'];
  const daysOfWeek = [
    { key: 'MO', label: 'Mon' },
    { key: 'TU', label: 'Tue' },
    { key: 'WE', label: 'Wed' },
    { key: 'TH', label: 'Thu' },
    { key: 'FR', label: 'Fri' },
    { key: 'SA', label: 'Sat' },
    { key: 'SU', label: 'Sun' },
  ];

  useEffect(() => {
    setIsRepeating(initialSettings.isRepeating);
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
    onSave({
      isRepeating,
      frequency,
      selectedDays,
      endDate,
    });
    onClose();
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
          <View style={styles.recurrenceField}>
            <View style={styles.switchRow}>
              <Text style={styles.recurrenceLabel}>Repeat Event</Text>
              <Switch
                value={isRepeating}
                onValueChange={setIsRepeating}
                trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                thumbColor={isRepeating ? '#ffffff' : '#f4f3f4'}
              />
            </View>
          </View>

          {isRepeating && (
            <>
              <View style={styles.recurrenceField}>
                <Text style={styles.recurrenceLabel}>Frequency</Text>
                <View style={styles.frequencyContainer}>
                  {frequencies.map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      style={[
                        styles.frequencyButton,
                        frequency === freq && styles.activeFrequencyButton
                      ]}
                      onPress={() => setFrequency(freq)}
                    >
                      <Text style={[
                        styles.frequencyButtonText,
                        frequency === freq && styles.activeFrequencyButtonText
                      ]}>
                        {freq}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {(frequency === 'Weekly' || frequency === 'Bi-weekly') && (
                <View style={styles.recurrenceField}>
                  <Text style={styles.recurrenceLabel}>Days of Week</Text>
                  <View style={styles.daysContainer}>
                    {daysOfWeek.map((day) => (
                      <TouchableOpacity
                        key={day.key}
                        style={[
                          styles.dayButton,
                          selectedDays.includes(day.key) && styles.activeDayButton
                        ]}
                        onPress={() => toggleDay(day.key)}
                      >
                        <Text style={[
                          styles.dayButtonText,
                          selectedDays.includes(day.key) && styles.activeDayButtonText
                        ]}>
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.recurrenceField}>
                <Text style={styles.recurrenceLabel}>Repeat Until</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndDateCalendar(true)}
                >
                  <CalendarIcon size={16} color="#6b7280" />
                  <Text style={styles.dateButtonText}>
                    {endDate.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.recurrenceActions}>
          <TouchableOpacity style={styles.recurrenceCancelButton} onPress={onClose}>
            <Text style={styles.recurrenceCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.recurrenceSaveButton} onPress={handleSave}>
            <Text style={styles.recurrenceSaveButtonText}>Save</Text>
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
                markedDates={{
                  [endDate.toISOString().split('T')[0]]: {
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

export default function TaskEventForm({ mode, initialData, onSubmitSuccess, onClose }: TaskEventFormProps) {
  // Form type state
  const [formType, setFormType] = useState<'task' | 'event' | 'depositIdea' | 'withdrawal'>('task');
  
  // Basic form fields
  const [title, setTitle] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [isAuthenticDeposit, setIsAuthenticDeposit] = useState(false);
  const [isTwelveWeekGoal, setIsTwelveWeekGoal] = useState(false);
  const [notes, setNotes] = useState('');

  // Date and time states
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [eventStartDate, setEventStartDate] = useState(new Date());
  const [eventEndDate, setEventEndDate] = useState(new Date());
  const [schedulingType, setSchedulingType] = useState<'anytime' | 'specific'>('anytime');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);

  // Recurrence states
  const [isRepeating, setIsRepeating] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('Weekly');
  const [selectedRecurrenceDays, setSelectedRecurrenceDays] = useState<string[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(new Date());

  // Withdrawal specific
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalDate, setWithdrawalDate] = useState(new Date());

  // Selection states
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string>(''); // Single goal for tasks/events
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]); // Multiple goals for deposit ideas
  const [selectedKeyRelationshipIds, setSelectedKeyRelationshipIds] = useState<string[]>([]);

  // Options data
  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);

  // Modal states
  const [showCalendar, setShowCalendar] = useState(false);
  const [showEventStartCalendar, setShowEventStartCalendar] = useState(false);
  const [showEventEndCalendar, setShowEventEndCalendar] = useState(false);
  const [showWithdrawalCalendar, setShowWithdrawalCalendar] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [isRecurrenceModalVisible, setIsRecurrenceModalVisible] = useState(false);

  // Loading state
  const [loading, setLoading] = useState(false);

  // Time options for picker
  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? '00' : '30';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour < 12 ? 'AM' : 'PM';
    const value = `${hour.toString().padStart(2, '0')}:${minute}`;
    const label = `${displayHour}:${minute} ${ampm}`;
    return { value, label };
  });

  // Initialize form based on initialData
  useEffect(() => {
    if (initialData) {
      setFormType(initialData.type as any || 'task');
      setTitle(initialData.title || '');
      setIsUrgent(initialData.is_urgent || false);
      setIsImportant(initialData.is_important || false);
      setIsAuthenticDeposit(initialData.is_authentic_deposit || false);
      setIsTwelveWeekGoal(initialData.is_twelve_week_goal || false);
      setNotes(initialData.notes || '');
      setIsAllDay(initialData.is_all_day || false);

      // Date handling
      if (initialData.due_date) {
        setSelectedDate(new Date(initialData.due_date));
      }
      if (initialData.start_date) {
        setEventStartDate(new Date(initialData.start_date));
      }
      if (initialData.end_date) {
        setEventEndDate(new Date(initialData.end_date));
      }
      if (initialData.withdrawal_date) {
        setWithdrawalDate(new Date(initialData.withdrawal_date));
      }

      // Time handling
      if (initialData.start_time || initialData.end_time) {
        setSchedulingType('specific');
        if (initialData.start_time) {
          const startTimeStr = new Date(initialData.start_time).toTimeString().slice(0, 5);
          setStartTime(startTimeStr);
        }
        if (initialData.end_time) {
          const endTimeStr = new Date(initialData.end_time).toTimeString().slice(0, 5);
          setEndTime(endTimeStr);
        }
      }

      // Recurrence handling
      if (initialData.recurrence_rule) {
        const parsed = parseRRULE(initialData.recurrence_rule);
        setIsRepeating(true);
        setRecurrenceFrequency(parsed.frequency);
        setSelectedRecurrenceDays(parsed.selectedDays);
        setRecurrenceEndDate(parsed.endDate);
      }

      // Withdrawal amount
      if (initialData.amount) {
        setWithdrawalAmount(initialData.amount.toString());
      }

      // Selection states
      setSelectedRoleIds(initialData.roles?.map(r => r.id) || []);
      setSelectedDomainIds(initialData.domains?.map(d => d.id) || []);
      setSelectedGoalId(initialData.goals?.[0]?.id || ''); // Single goal for tasks/events
      setSelectedGoalIds(initialData.goals?.map(g => g.id) || []); // Multiple goals for deposit ideas
      setSelectedKeyRelationshipIds(initialData.keyRelationships?.map(kr => kr.id) || []);
    } else {
      // Reset form for new item
      resetForm();
    }
  }, [initialData]);

  const resetForm = () => {
    setTitle('');
    setIsUrgent(false);
    setIsImportant(false);
    setIsAuthenticDeposit(false);
    setIsTwelveWeekGoal(false);
    setNotes('');
    setSelectedDate(new Date());
    setEventStartDate(new Date());
    setEventEndDate(new Date());
    setSchedulingType('anytime');
    setStartTime('09:00');
    setEndTime('10:00');
    setIsAllDay(false);
    setIsRepeating(false);
    setRecurrenceFrequency('Weekly');
    setSelectedRecurrenceDays([]);
    setRecurrenceEndDate(new Date());
    setWithdrawalAmount('');
    setWithdrawalDate(new Date());
    setSelectedRoleIds([]);
    setSelectedDomainIds([]);
    setSelectedGoalId('');
    setSelectedGoalIds([]);
    setSelectedKeyRelationshipIds([]);
  };

  // Parse RRULE string
  const parseRRULE = (rrule: string) => {
    const parts = rrule.split(';');
    let frequency = 'Weekly';
    let selectedDays: string[] = [];
    let endDate = new Date();

    parts.forEach(part => {
      if (part.startsWith('FREQ=')) {
        const freq = part.split('=')[1];
        if (freq === 'DAILY') frequency = 'Daily';
        else if (freq === 'WEEKLY') frequency = 'Weekly';
        else if (freq === 'MONTHLY') frequency = 'Monthly';
        else if (freq === 'YEARLY') frequency = 'Yearly';
      } else if (part.startsWith('INTERVAL=')) {
        const interval = part.split('=')[1];
        if (interval === '2' && frequency === 'Weekly') frequency = 'Bi-weekly';
      } else if (part.startsWith('BYDAY=')) {
        selectedDays = part.split('=')[1].split(',');
      } else if (part.startsWith('UNTIL=')) {
        const untilStr = part.split('=')[1];
        endDate = new Date(untilStr.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'));
      }
    });

    return { frequency, selectedDays, endDate };
  };

  // Build RRULE string
  const buildRRULE = () => {
    if (!isRepeating) return null;

    let rrule = '';
    
    // Frequency
    if (recurrenceFrequency === 'Daily') rrule += 'FREQ=DAILY';
    else if (recurrenceFrequency === 'Weekly') rrule += 'FREQ=WEEKLY';
    else if (recurrenceFrequency === 'Bi-weekly') rrule += 'FREQ=WEEKLY;INTERVAL=2';
    else if (recurrenceFrequency === 'Monthly') rrule += 'FREQ=MONTHLY';
    else if (recurrenceFrequency === 'Yearly') rrule += 'FREQ=YEARLY';

    // Days of week (for weekly/bi-weekly)
    if ((recurrenceFrequency === 'Weekly' || recurrenceFrequency === 'Bi-weekly') && selectedRecurrenceDays.length > 0) {
      rrule += `;BYDAY=${selectedRecurrenceDays.join(',')}`;
    }

    // Until date
    const untilStr = recurrenceEndDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    rrule += `;UNTIL=${untilStr}`;

    return rrule;
  };

  // Fetch options data
  useEffect(() => {
    fetchOptions();
  }, []);

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
    const setterMap = {
      selectedRoleIds: setSelectedRoleIds,
      selectedDomainIds: setSelectedDomainIds,
      selectedGoalIds: setSelectedGoalIds,
      selectedKeyRelationshipIds: setSelectedKeyRelationshipIds,
    };

    const setter = setterMap[field];
    setter(prev => prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]);
  };

  const filteredKeyRelationships = keyRelationships.filter(kr => 
    selectedRoleIds.includes(kr.role_id)
  );

  const formatDateForInput = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTimeForDisplay = (timeStr: string) => {
    const [hour, minute] = timeStr.split(':').map(Number);
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  const calculateDuration = (start: string, end: string) => {
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    let durationMinutes = endMinutes - startMinutes;
    if (durationMinutes < 0) durationMinutes += 24 * 60; // Handle overnight events
    
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const handleRecurrenceSettings = (settings: {
    isRepeating: boolean;
    frequency: string;
    selectedDays: string[];
    endDate: Date;
  }) => {
    setIsRepeating(settings.isRepeating);
    setRecurrenceFrequency(settings.frequency);
    setSelectedRecurrenceDays(settings.selectedDays);
    setRecurrenceEndDate(settings.endDate);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (formType === 'withdrawal' && (!withdrawalAmount || parseFloat(withdrawalAmount) <= 0)) {
      Alert.alert('Error', 'Please enter a valid withdrawal amount');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      if (formType === 'depositIdea') {
        // Handle Deposit Ideas
        const depositIdeaPayload = {
          user_id: user.id,
          title: title.trim(),
          is_active: true,
          follow_up: isTwelveWeekGoal,
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

        const depositIdeaId = depositIdeaData.id;

        // Clear existing joins for edit mode
        if (mode === 'edit' && initialData?.id) {
          await Promise.all([
            supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
            supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
            supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
            supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
            supabase.from('0008-ap-universal-notes-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
          ]);
        }

        // Create joins for deposit ideas (multiple goals allowed)
        const roleJoins = selectedRoleIds.map(role_id => ({ parent_id: depositIdeaId, parent_type: 'depositIdea', role_id, user_id: user.id }));
        const domainJoins = selectedDomainIds.map(domain_id => ({ parent_id: depositIdeaId, parent_type: 'depositIdea', domain_id, user_id: user.id }));
        const goalJoins = selectedGoalIds.map(goal_id => ({ parent_id: depositIdeaId, parent_type: 'depositIdea', goal_id, user_id: user.id }));
        const krJoins = selectedKeyRelationshipIds.map(key_relationship_id => ({ parent_id: depositIdeaId, parent_type: 'depositIdea', key_relationship_id, user_id: user.id }));

        // Add note if provided
        if (notes && notes.trim()) {
          const { data: noteData, error: noteError } = await supabase
            .from('0008-ap-notes')
            .insert({ user_id: user.id, content: notes })
            .select()
            .single();
          
          if (noteError) throw noteError;
          
          await supabase
            .from('0008-ap-universal-notes-join')
            .insert({ parent_id: depositIdeaId, parent_type: 'depositIdea', note_id: noteData.id, user_id: user.id });
        }

        // Insert joins
        if (roleJoins.length > 0) await supabase.from('0008-ap-universal-roles-join').insert(roleJoins);
        if (domainJoins.length > 0) await supabase.from('0008-ap-universal-domains-join').insert(domainJoins);
        if (goalJoins.length > 0) await supabase.from('0008-ap-universal-goals-join').insert(goalJoins);
        if (krJoins.length > 0) await supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins);

      } else if (formType === 'withdrawal') {
        // Handle Withdrawals
        const withdrawalPayload = {
          user_id: user.id,
          title: title.trim(),
          amount: parseFloat(withdrawalAmount),
          withdrawal_date: withdrawalDate.toISOString().split('T')[0],
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

        const withdrawalId = withdrawalData.id;

        // Clear existing joins for edit mode
        if (mode === 'edit' && initialData?.id) {
          await Promise.all([
            supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
            supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
            supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
            supabase.from('0008-ap-universal-notes-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
          ]);
        }

        // Create joins for withdrawals
        const roleJoins = selectedRoleIds.map(role_id => ({ parent_id: withdrawalId, parent_type: 'withdrawal', role_id, user_id: user.id }));
        const domainJoins = selectedDomainIds.map(domain_id => ({ parent_id: withdrawalId, parent_type: 'withdrawal', domain_id, user_id: user.id }));
        const krJoins = selectedKeyRelationshipIds.map(key_relationship_id => ({ parent_id: withdrawalId, parent_type: 'withdrawal', key_relationship_id, user_id: user.id }));

        // Add note if provided
        if (notes && notes.trim()) {
          const { data: noteData, error: noteError } = await supabase
            .from('0008-ap-notes')
            .insert({ user_id: user.id, content: notes })
            .select()
            .single();
          
          if (noteError) throw noteError;
          
          await supabase
            .from('0008-ap-universal-notes-join')
            .insert({ parent_id: withdrawalId, parent_type: 'withdrawal', note_id: noteData.id, user_id: user.id });
        }

        // Insert joins
        if (roleJoins.length > 0) await supabase.from('0008-ap-universal-roles-join').insert(roleJoins);
        if (domainJoins.length > 0) await supabase.from('0008-ap-universal-domains-join').insert(domainJoins);
        if (krJoins.length > 0) await supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins);

      } else {
        // Handle Tasks and Events
        const taskPayload = {
          user_id: user.id,
          title: title.trim(),
          type: formType,
          due_date: formType === 'event' ? eventStartDate.toISOString().split('T')[0] : selectedDate.toISOString().split('T')[0],
          start_date: formType === 'event' ? eventStartDate.toISOString().split('T')[0] : null,
          end_date: formType === 'event' ? eventEndDate.toISOString().split('T')[0] : null,
          start_time: schedulingType === 'specific' && !isAllDay ? 
            new Date(`${formType === 'event' ? eventStartDate.toISOString().split('T')[0] : selectedDate.toISOString().split('T')[0]}T${startTime}:00`).toISOString() : null,
          end_time: schedulingType === 'specific' && !isAllDay ? 
            new Date(`${formType === 'event' ? eventStartDate.toISOString().split('T')[0] : selectedDate.toISOString().split('T')[0]}T${endTime}:00`).toISOString() : null,
          recurrence_rule: formType === 'event' ? buildRRULE() : null,
          is_urgent: isUrgent,
          is_important: isImportant,
          is_authentic_deposit: isAuthenticDeposit,
          is_twelve_week_goal: isTwelveWeekGoal,
          is_all_day: isAllDay,
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

        // Clear existing joins for edit mode
        if (mode === 'edit' && initialData?.id) {
          await Promise.all([
            supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-notes-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
          ]);
        }

        // Create joins for tasks/events (single goal for 12-week goals)
        const roleJoins = selectedRoleIds.map(role_id => ({ parent_id: taskId, parent_type: 'task', role_id, user_id: user.id }));
        const domainJoins = selectedDomainIds.map(domain_id => ({ parent_id: taskId, parent_type: 'task', domain_id, user_id: user.id }));
        const goalJoins = isTwelveWeekGoal && selectedGoalId ? [{ parent_id: taskId, parent_type: 'task', goal_id: selectedGoalId, user_id: user.id }] : [];
        const krJoins = selectedKeyRelationshipIds.map(key_relationship_id => ({ parent_id: taskId, parent_type: 'task', key_relationship_id, user_id: user.id }));

        // Add note if provided
        if (notes && notes.trim()) {
          const { data: noteData, error: noteError } = await supabase
            .from('0008-ap-notes')
            .insert({ user_id: user.id, content: notes })
            .select()
            .single();
          
          if (noteError) throw noteError;
          
          await supabase
            .from('0008-ap-universal-notes-join')
            .insert({ parent_id: taskId, parent_type: 'task', note_id: noteData.id, user_id: user.id });
        }

        // Insert joins
        if (roleJoins.length > 0) await supabase.from('0008-ap-universal-roles-join').insert(roleJoins);
        if (domainJoins.length > 0) await supabase.from('0008-ap-universal-domains-join').insert(domainJoins);
        if (goalJoins.length > 0) await supabase.from('0008-ap-universal-goals-join').insert(goalJoins);
        if (krJoins.length > 0) await supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins);
      }

      Alert.alert('Success', `${formType.charAt(0).toUpperCase() + formType.slice(1)} ${mode === 'edit' ? 'updated' : 'created'} successfully`);
      onSubmitSuccess();
      onClose();

    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {mode === 'edit' ? 'Edit' : 'New'} {formType.charAt(0).toUpperCase() + formType.slice(1)}
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
            <View style={styles.typeContainer}>
              {(['task', 'event', 'depositIdea', 'withdrawal'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    formType === type && styles.activeTypeButton
                  ]}
                  onPress={() => setFormType(type)}
                >
                  <Text style={[
                    styles.typeButtonText,
                    formType === type && styles.activeTypeButtonText
                  ]}>
                    {type === 'depositIdea' ? 'Deposit Idea' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {formType === 'withdrawal' ? 'Reason' : 'Title'} *
            </Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={`Enter ${formType === 'withdrawal' ? 'withdrawal reason' : formType + ' title'}`}
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Withdrawal Amount */}
          {formType === 'withdrawal' && (
            <View style={styles.field}>
              <Text style={styles.label}>Amount *</Text>
              <TextInput
                style={styles.input}
                value={withdrawalAmount}
                onChangeText={setWithdrawalAmount}
                placeholder="0.0"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
          )}

          {/* Date and Time Section */}
          {formType !== 'withdrawal' && (
            <View style={styles.field}>
              <Text style={styles.label}>
                {formType === 'event' ? 'Schedule' : 'Due Date'}
              </Text>
              
              {formType === 'event' ? (
                <View style={styles.eventScheduleContainer}>
                  {/* Start Date */}
                  <View style={styles.dateRow}>
                    <Text style={styles.dateLabel}>Start Date</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowEventStartCalendar(true)}
                    >
                      <CalendarIcon size={16} color="#6b7280" />
                      <Text style={styles.dateButtonText}>
                        {formatDateForInput(eventStartDate)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* End Date */}
                  <View style={styles.dateRow}>
                    <Text style={styles.dateLabel}>End Date</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowEventEndCalendar(true)}
                    >
                      <CalendarIcon size={16} color="#6b7280" />
                      <Text style={styles.dateButtonText}>
                        {formatDateForInput(eventEndDate)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Scheduling Type Toggle */}
                  <View style={styles.schedulingToggle}>
                    <TouchableOpacity
                      style={[
                        styles.schedulingButton,
                        schedulingType === 'anytime' && styles.activeSchedulingButton
                      ]}
                      onPress={() => setSchedulingType('anytime')}
                    >
                      <Text style={[
                        styles.schedulingButtonText,
                        schedulingType === 'anytime' && styles.activeSchedulingButtonText
                      ]}>
                        Anytime
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.schedulingButton,
                        schedulingType === 'specific' && styles.activeSchedulingButton
                      ]}
                      onPress={() => setSchedulingType('specific')}
                    >
                      <Text style={[
                        styles.schedulingButtonText,
                        schedulingType === 'specific' && styles.activeSchedulingButtonText
                      ]}>
                        Specific Time
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Time Controls */}
                  {schedulingType === 'specific' && (
                    <View style={styles.timeContainer}>
                      <View style={styles.allDayRow}>
                        <Text style={styles.allDayLabel}>All Day</Text>
                        <Switch
                          value={isAllDay}
                          onValueChange={setIsAllDay}
                          trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                          thumbColor={isAllDay ? '#ffffff' : '#f4f3f4'}
                        />
                      </View>

                      {!isAllDay && (
                        <View style={styles.timeRow}>
                          <View style={styles.timeField}>
                            <Text style={styles.timeLabel}>Start</Text>
                            <TouchableOpacity
                              style={styles.timeButton}
                              onPress={() => setShowStartTimePicker(true)}
                            >
                              <Clock size={16} color="#6b7280" />
                              <Text style={styles.timeButtonText}>
                                {formatTimeForDisplay(startTime)}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <View style={styles.timeField}>
                            <Text style={styles.timeLabel}>End</Text>
                            <TouchableOpacity
                              style={styles.timeButton}
                              onPress={() => setShowEndTimePicker(true)}
                            >
                              <Clock size={16} color="#6b7280" />
                              <Text style={styles.timeButtonText}>
                                {formatTimeForDisplay(endTime)}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <View style={styles.durationContainer}>
                            <Text style={styles.durationLabel}>Duration</Text>
                            <Text style={styles.durationText}>
                              {calculateDuration(startTime, endTime)}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Repeat Section */}
                  <View style={styles.repeatSection}>
                    <TouchableOpacity
                      style={[
                        styles.repeatButton,
                        isRepeating && styles.activeRepeatButton
                      ]}
                      onPress={() => setIsRecurrenceModalVisible(true)}
                    >
                      <Repeat size={16} color={isRepeating ? "#ffffff" : "#0078d4"} />
                      <Text style={[
                        styles.repeatButtonText,
                        isRepeating && styles.activeRepeatButtonText
                      ]}>
                        {isRepeating ? `Repeats ${recurrenceFrequency}` : 'Repeat'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowCalendar(true)}
                >
                  <CalendarIcon size={16} color="#6b7280" />
                  <Text style={styles.dateButtonText}>
                    {formatDateForInput(selectedDate)}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Withdrawal Date */}
          {formType === 'withdrawal' && (
            <View style={styles.field}>
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowWithdrawalCalendar(true)}
              >
                <CalendarIcon size={16} color="#6b7280" />
                <Text style={styles.dateButtonText}>
                  {formatDateForInput(withdrawalDate)}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Priority Section (Tasks and Events only) */}
          {(formType === 'task' || formType === 'event') && (
            <View style={styles.field}>
              <Text style={styles.label}>Priority</Text>
              <View style={styles.priorityContainer}>
                <View style={styles.priorityRow}>
                  <Text style={styles.priorityLabel}>Urgent</Text>
                  <Switch
                    value={isUrgent}
                    onValueChange={setIsUrgent}
                    trackColor={{ false: '#d1d5db', true: '#dc2626' }}
                    thumbColor={isUrgent ? '#ffffff' : '#f4f3f4'}
                  />
                </View>
                <View style={styles.priorityRow}>
                  <Text style={styles.priorityLabel}>Important</Text>
                  <Switch
                    value={isImportant}
                    onValueChange={setIsImportant}
                    trackColor={{ false: '#d1d5db', true: '#16a34a' }}
                    thumbColor={isImportant ? '#ffffff' : '#f4f3f4'}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Authentic Deposit (Tasks and Events only) */}
          {(formType === 'task' || formType === 'event') && (
            <View style={styles.field}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Authentic Deposit</Text>
                <Switch
                  value={isAuthenticDeposit}
                  onValueChange={setIsAuthenticDeposit}
                  trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                  thumbColor={isAuthenticDeposit ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            </View>
          )}

          {/* 12-Week Goal (Tasks and Events only) */}
          {(formType === 'task' || formType === 'event') && (
            <View style={styles.field}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>12-Week Goal</Text>
                <Switch
                  value={isTwelveWeekGoal}
                  onValueChange={setIsTwelveWeekGoal}
                  trackColor={{ false: '#d1d5db', true: '#7c3aed' }}
                  thumbColor={isTwelveWeekGoal ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            </View>
          )}

          {/* Goal Selection (when 12-week goal is enabled for tasks/events) */}
          {(formType === 'task' || formType === 'event') && isTwelveWeekGoal && (
            <View style={styles.field}>
              <Text style={styles.label}>Select Goal</Text>
              <View style={styles.checkboxGrid}>
                {goals.map(goal => {
                  const isSelected = selectedGoalId === goal.id;
                  return (
                    <TouchableOpacity
                      key={goal.id}
                      style={styles.checkItem}
                      onPress={() => setSelectedGoalId(isSelected ? '' : goal.id)}
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

          {/* Goals (Deposit Ideas only - multi-select) */}
          {formType === 'depositIdea' && (
            <View style={styles.field}>
              <Text style={styles.label}>Goals</Text>
              <View style={styles.checkboxGrid}>
                {goals.map(goal => {
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
              {roles.map(role => {
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

          {/* Key Relationships */}
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
            <Text style={styles.label}>Domains</Text>
            <View style={styles.checkboxGrid}>
              {domains.map(domain => {
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

          {/* Notes */}
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder={`Add notes about this ${formType}...`}
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
            (!title.trim() || (formType === 'withdrawal' && !withdrawalAmount) || loading) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!title.trim() || (formType === 'withdrawal' && !withdrawalAmount) || loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Saving...' : mode === 'edit' ? `Update ${formType.charAt(0).toUpperCase() + formType.slice(1)}` : `Create ${formType.charAt(0).toUpperCase() + formType.slice(1)}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Modals */}
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
                setSelectedDate(new Date(day.timestamp));
                setShowCalendar(false);
              }}
              markedDates={{
                [selectedDate.toISOString().split('T')[0]]: {
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

      <Modal visible={showEventStartCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Start Date</Text>
              <TouchableOpacity onPress={() => setShowEventStartCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                setEventStartDate(new Date(day.timestamp));
                setShowEventStartCalendar(false);
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

      <Modal visible={showEventEndCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select End Date</Text>
              <TouchableOpacity onPress={() => setShowEventEndCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                setEventEndDate(new Date(day.timestamp));
                setShowEventEndCalendar(false);
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

      <Modal visible={showWithdrawalCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowWithdrawalCalendar(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day) => {
                setWithdrawalDate(new Date(day.timestamp));
                setShowWithdrawalCalendar(false);
              }}
              markedDates={{
                [withdrawalDate.toISOString().split('T')[0]]: {
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
      <Modal visible={showStartTimePicker} transparent animationType="fade">
        <View style={styles.timePickerOverlay}>
          <View style={styles.timePickerContainer}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.timePickerTitle}>Select Start Time</Text>
              <TouchableOpacity onPress={() => setShowStartTimePicker(false)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.timePickerList}>
              {timeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.timeOption,
                    startTime === option.value && styles.selectedTimeOption
                  ]}
                  onPress={() => {
                    setStartTime(option.value);
                    setShowStartTimePicker(false);
                  }}
                >
                  <Text style={[
                    styles.timeOptionText,
                    startTime === option.value && styles.selectedTimeOptionText
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
            <ScrollView style={styles.timePickerList}>
              {timeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.timeOption,
                    endTime === option.value && styles.selectedTimeOption
                  ]}
                  onPress={() => {
                    setEndTime(option.value);
                    setShowEndTimePicker(false);
                  }}
                >
                  <Text style={[
                    styles.timeOptionText,
                    endTime === option.value && styles.selectedTimeOptionText
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Recurrence Settings Modal */}
      <RecurrenceSettingsModal
        visible={isRecurrenceModalVisible}
        onClose={() => setIsRecurrenceModalVisible(false)}
        onSave={handleRecurrenceSettings}
        initialSettings={{
          isRepeating,
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
  typeContainer: {
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
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTypeButtonText: {
    color: '#ffffff',
  },
  eventScheduleContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#1f2937',
  },
  schedulingToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    padding: 2,
    marginBottom: 12,
  },
  schedulingButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  activeSchedulingButton: {
    backgroundColor: '#0078d4',
  },
  schedulingButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeSchedulingButtonText: {
    color: '#ffffff',
  },
  timeContainer: {
    marginTop: 8,
  },
  allDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  allDayLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  timeButtonText: {
    fontSize: 12,
    color: '#1f2937',
  },
  durationContainer: {
    alignItems: 'center',
    paddingTop: 16,
  },
  durationLabel: {
    fontSize: 10,
    color: '#9ca3af',
    marginBottom: 2,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0078d4',
  },
  repeatSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  repeatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0078d4',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  activeRepeatButton: {
    backgroundColor: '#0078d4',
  },
  repeatButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0078d4',
  },
  activeRepeatButtonText: {
    color: '#ffffff',
  },
  priorityContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  priorityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priorityLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
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
  timePickerList: {
    maxHeight: 300,
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedTimeOption: {
    backgroundColor: '#eff6ff',
  },
  timeOptionText: {
    fontSize: 14,
    color: '#1f2937',
  },
  selectedTimeOptionText: {
    color: '#0078d4',
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
    marginBottom: 8,
  },
  frequencyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  frequencyButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 45,
    alignItems: 'center',
  },
  activeDayButton: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeDayButtonText: {
    color: '#ffffff',
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  recurrenceCancelButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  recurrenceSaveButton: {
    flex: 1,
    backgroundColor: '#0078d4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  recurrenceSaveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});