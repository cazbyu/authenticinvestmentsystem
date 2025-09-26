import React, { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, Modal, FlatList } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { getSupabaseClient } from "@/lib/supabase";
import { X, Repeat} from 'lucide-react-native';

// TYPE DEFINITIONS
interface TaskEventFormProps {
  mode: "create" | "edit";
  initialData?: Partial<any>;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

interface Role { id: string; label: string; }
interface Domain { id: string; name: string; }
interface KeyRelationship { id: string; name: string; role_id: string; }
type UnifiedGoal = {
  id: string;
  title: string;
  goal_type: "twelve_wk_goal" | "custom_goal";
};

interface TwelveWeekGoal { id: string; title: string; }

// CUSTOM DAY COMPONENT for CALENDAR
const CustomDayComponent = ({ date, state, marking, onPress }) => {
  const isSelected = marking?.selected;
  const isToday = state === 'today';

  return (
    <TouchableOpacity
      onPress={() => onPress(date)}
      style={[
        styles.dayContainer,
        isSelected && styles.selectedDay
      ]}
    >
      <Text style={[
        styles.dayText,
        isToday && !isSelected && styles.todayText,
        isSelected && styles.selectedDayText,
        state === 'disabled' && styles.disabledDayText
      ]}>
        {date.day}
      </Text>
    </TouchableOpacity>
  );
};


// MAIN FORM COMPONENT
const TaskEventForm: React.FC<TaskEventFormProps> = ({ mode, initialData, onSubmitSuccess, onClose }) => {


const toDateString = (date: Date) => {
    // Use local date components to avoid timezone conversion
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const dateInputRef = useRef<TouchableOpacity>(null);
  const timeInputRef = useRef<TouchableOpacity>(null);
  const startTimeInputRef = useRef<TouchableOpacity>(null);
  const endTimeInputRef = useRef<TouchableOpacity>(null);
  const endDateInputRef = useRef<TouchableOpacity>(null);

  const getDefaultTime = (addHours: number = 1) => {
    const now = new Date();
    now.setHours(now.getHours() + addHours);
    const minutes = Math.ceil(now.getMinutes() / 15) * 15;
    now.setMinutes(minutes, 0, 0);
    const hour12 = now.getHours() === 0 ? 12 : now.getHours() > 12 ? now.getHours() - 12 : now.getHours();
    const ampm = now.getHours() < 12 ? 'am' : 'pm';
    return `${hour12}:${now.getMinutes().toString().padStart(2, '0')} ${ampm}`;
  };

  const timestampToTimeString = (timestamp?: string) => {
    if (!timestamp) return getDefaultTime();
    const date = new Date(timestamp);
    const hour12 = date.getHours() === 0 ? 12 : date.getHours() > 12 ? date.getHours() - 12 : date.getHours();
    const ampm = date.getHours() < 12 ? 'am' : 'pm';
    return `${hour12}:${date.getMinutes().toString().padStart(2, '0')} ${ampm}`;
  };

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    notes: 
      (initialData?.type === 'depositIdea' || initialData?.sourceDepositIdeaId)
        ? ''
        : (initialData?.notes || ''),
    amount: initialData?.amount?.toString() || '',
    withdrawalDate: initialData?.withdrawn_at ? new Date(initialData.withdrawn_at) : new Date(),
    dueDate: initialData?.due_date ? new Date(initialData.due_date) : new Date(),
    time: initialData?.start_time ? timestampToTimeString(initialData.start_time) : getDefaultTime(),
    startTime: initialData?.start_time ? timestampToTimeString(initialData.start_time) : getDefaultTime(),
    endTime: initialData?.end_time ? timestampToTimeString(initialData.end_time) : getDefaultTime(2),
    isAnytime: initialData?.is_all_day || false,
    is_urgent: initialData?.is_urgent || false,
    is_important: initialData?.is_important || false,
    is_authentic_deposit: initialData?.is_authentic_deposit || false,
    is_twelve_week_goal: initialData?.is_twelve_week_goal || false,
    schedulingType: (initialData?.type as 'task' | 'event' | 'depositIdea' | 'withdrawal') || 'task',
    selectedRoleIds: initialData?.roles?.map(r => r.id) || [] as string[],
    selectedDomainIds: initialData?.domains?.map(d => d.id) || [] as string[],
    selectedKeyRelationshipIds: initialData?.keyRelationships?.map(kr => kr.id) || [] as string[],
    selectedGoalId: initialData?.goal_12wk_id || null as string | null,
    selectedGoalIds: initialData?.goals?.map(g => g.id) || [] as string[],
      });

  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [twelveWeekGoals, setTwelveWeekGoals] = useState<TwelveWeekGoal[]>([]);

  const [loading, setLoading] = useState(false);

  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [showWithdrawalCalendar, setShowWithdrawalCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

// Event End Date & Recurrence state
const [endDateInputValue, setEndDateInputValue] = useState('');
const [isRepeating, setIsRepeating] = useState(false);
const [recurrenceFrequency, setRecurrenceFrequency] = useState<'Daily' | 'Weekly' | 'Bi-weekly' | 'Monthly' | 'Yearly'>('Weekly');
const [selectedRecurrenceDays, setSelectedRecurrenceDays] = useState<string[]>([]);
const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);
const [isRecurrenceModalVisible, setIsRecurrenceModalVisible] = useState(false);
const [activeCalendarField, setActiveCalendarField] = useState<'start' | 'end'>('start');
const [dateInputValue, setDateInputValue] = useState('');
const [withdrawalDateInputValue, setWithdrawalDateInputValue] = useState('');
const [activeTimeField, setActiveTimeField] = useState<'time' | 'startTime' | 'endTime' | null>(null);
const [datePickerPosition, setDatePickerPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
const [withdrawalDatePickerPosition, setWithdrawalDatePickerPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
const [timePickerPosition, setTimePickerPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });

// --- Goal linking (new) ---
const [allAvailableGoals, setAllAvailableGoals] = useState<UnifiedGoal[]>([]);
const [selectedGoal, setSelectedGoal] = useState<UnifiedGoal | null>(null);
const [goalDropdownOpen, setGoalDropdownOpen] = useState(false);
  
  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour < 12 ? 'am' : 'pm';
        const time12 = `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
        times.push(time12);
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  const timeListRef = useRef<FlatList<string>>(null);
  const TIME_ROW_HEIGHT = 44; // px, match your item padding/typography

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        notes: 
          (initialData?.type === 'depositIdea' || initialData?.sourceDepositIdeaId)
            ? ''
            : (initialData?.notes || ''),
        amount: initialData?.amount?.toString() || '',
        withdrawalDate: initialData?.withdrawn_at ? new Date(initialData.withdrawn_at) : new Date(),
        dueDate: initialData?.due_date ? new Date(initialData.due_date) : new Date(),
        time: initialData?.start_time ? timestampToTimeString(initialData.start_time) : getDefaultTime(),
        startTime: initialData?.start_time ? timestampToTimeString(initialData.start_time) : getDefaultTime(),
        endTime: initialData?.end_time ? timestampToTimeString(initialData.end_time) : getDefaultTime(2),
        isAnytime: initialData?.is_all_day || false,
        is_urgent: initialData?.is_urgent || false,
        is_important: initialData?.is_important || false,
        is_authentic_deposit: initialData?.is_authentic_deposit || false,
        is_twelve_week_goal: initialData?.is_twelve_week_goal || false,
        schedulingType: (initialData?.type as 'task' | 'event' | 'depositIdea' | 'withdrawal') || 'task',
        selectedRoleIds: initialData?.roles?.map(r => r.id) || [] as string[],
        selectedDomainIds: initialData?.domains?.map(d => d.id) || [] as string[],
        selectedKeyRelationshipIds: initialData?.keyRelationships?.map(kr => kr.id) || [] as string[],
        selectedGoalId: initialData?.goal_12wk_id || null as string | null,
        selectedGoalIds: initialData?.goals?.map(g => g.id) || [] as string[],
       
      });
    } else {
      // Reset form for new item
      setFormData({
        title: '',
        notes: '',
        amount: '',
        withdrawalDate: new Date(),
        dueDate: new Date(),
        time: getDefaultTime(),
        startTime: getDefaultTime(),
        endTime: getDefaultTime(2),
        isAnytime: false,
        is_urgent: false,
        is_important: false,
        is_authentic_deposit: false,
        is_twelve_week_goal: false,
        schedulingType: 'task',
        selectedRoleIds: [] as string[],
        selectedDomainIds: [] as string[],
        selectedKeyRelationshipIds: [] as string[],
        selectedGoalId: null as string | null,
        selectedGoalIds: [] as string[],
      });
    }

    const fetchOptions = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: roleData } = await supabase.from('0008-ap-roles').select('id,label').eq('user_id', user.id).eq('is_active', true);
        const { data: domainData } = await supabase.from('0008-ap-domains').select('id,name');
        const { data: krData } = await supabase.from('0008-ap-key-relationships').select('id,name,role_id').eq('user_id', user.id);
        const { data: goalData } = await supabase.from('0008-ap-goals-12wk').select('id,title').eq('user_id', user.id).eq('status', 'active');

        // --- NEW: fetch custom goals and build unified list from both sources ---
const { data: customGoals, error: customGoalsError } = await supabase
  .from('0008-ap-goals-custom')
  .select('id, title, status, created_at')
  .eq('user_id', user.id)
  .eq('status', 'active')
  .order('created_at', { ascending: false });

if (customGoalsError) {
  console.error('Error fetching custom goals:', customGoalsError);
}

// Normalize both sets into UnifiedGoal[]
const normalized12wk = (goalData || []).map(g => ({
  id: g.id,
  title: g.title,
  goal_type: 'twelve_wk_goal' as const,
}));

const normalizedCustom = (customGoals || []).map(g => ({
  id: g.id,
  title: g.title,
  goal_type: 'custom_goal' as const,
}));

setAllAvailableGoals([...normalized12wk, ...normalizedCustom]);

        setRoles(roleData || []);
        setDomains(domainData || []);
        setKeyRelationships(krData || []);
        setTwelveWeekGoals(goalData || []);
      } catch (error) {
        console.error('Error fetching options:', error);
        Alert.alert('Error', (error as Error).message || 'Failed to load options');
      }
    };
    fetchOptions();
  }, [initialData]);

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
}, [showTimePicker, activeTimeField]);

// Initialize end date to match start date by default
useEffect(() => {
  setDateInputValue(formatDateForInput(formData.dueDate));
  const endInit = (formData as any).eventEndDate || formData.dueDate;
  setEndDateInputValue(formatDateForInput(endInit));
  if (!(formData as any).eventEndDate) {
    setFormData(prev => ({ ...prev, eventEndDate: prev.dueDate } as any));
  }
}, []);

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
    setWithdrawalDateInputValue(formatDateForInput(formData.withdrawalDate));
  }, [formData.withdrawalDate]);

  const handleMultiSelect = (field: 'selectedRoleIds' | 'selectedDomainIds' | 'selectedKeyRelationshipIds' | 'selectedGoalIds', id: string) => {
    setFormData(prev => {
      const currentSelection = prev[field] as string[];
      const newSelection = currentSelection.includes(id)
        ? currentSelection.filter(itemId => itemId !== id)
        : [...currentSelection, id];
      return { ...prev, [field]: newSelection };
    });
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

  const onWithdrawalCalendarDayPress = (day: any) => {
    // Create date using local time components to avoid timezone issues
    const selectedDate = new Date(day.year, day.month - 1, day.day);
    setFormData(prev => ({ ...prev, withdrawalDate: selectedDate }));
    setWithdrawalDateInputValue(formatDateForInput(selectedDate));
    setShowWithdrawalCalendar(false);
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

  const formatDateForInput = (date: Date) => {
    // Use local date components to avoid timezone conversion
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const handleDateInputChange = (text: string) => {
  setDateInputValue(text);
  const parsedDate = new Date(text);
  if (!isNaN(parsedDate.getTime())) {
    const localDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
    setFormData(prev => ({ ...prev, dueDate: localDate }));
  }
};

const handleEndDateInputChange = (text: string) => {
  setEndDateInputValue(text);
  const parsedDate = new Date(text);
  if (!isNaN(parsedDate.getTime())) {
    const localDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
    setFormData(prev => ({ ...prev, eventEndDate: localDate } as any));
  }
};

  const handleWithdrawalDateInputChange = (text: string) => {
    setWithdrawalDateInputValue(text);
    const parsedDate = new Date(text);
    // Only update if the parsed date is valid and use local time
    if (!isNaN(parsedDate.getTime())) {
      // Create a new date using local time components to avoid timezone issues
      const localDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
      setFormData(prev => ({ ...prev, withdrawalDate: localDate }));
    }
  };

  const combineDateAndTime = (date: Date, time: string) => {
    const [timePart, period] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined.toISOString();
  };

  const timeStringToMinutes = (time: string) => {
    const [timePart, period] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const formatDuration = (totalMinutes: number) => {
    const hours = Math.round((totalMinutes / 60) * 100) / 100;
    return `${hours} hr${hours === 1 ? '' : 's'}`;
  };

  const getDurationLabel = (start: string, end: string) => {
  let diff = timeStringToMinutes(end) - timeStringToMinutes(start);
  if (diff <= 0) diff += 24 * 60;
  return formatDuration(diff);
};

// Recurrence utilities (TOP-LEVEL in TaskEventForm scope)
const getRecurrenceDisplayText = () => {
  let text = recurrenceFrequency;
  if ((recurrenceFrequency === 'Weekly' || recurrenceFrequency === 'Bi-weekly') && selectedRecurrenceDays.length > 0) {
    const map: Record<string, string> = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };
    text += ` on ${selectedRecurrenceDays.map(d => map[d] || d).join(', ')}`;
  }
  if (recurrenceEndDate) {
    text += ` until ${recurrenceEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return text;
};

const constructRecurrenceRule = (): string => {
  const parts: string[] = [];
  let freq = recurrenceFrequency;
  let interval = 1;
  if (freq === 'Bi-weekly') { freq = 'Weekly'; interval = 2; }
  parts.push(`FREQ=${freq.toUpperCase()}`);
  if (interval !== 1) parts.push(`INTERVAL=${interval}`);
  if ((recurrenceFrequency === 'Weekly' || recurrenceFrequency === 'Bi-weekly') && selectedRecurrenceDays.length > 0) {
    parts.push(`BYDAY=${selectedRecurrenceDays.join(',')}`);
  }
  if (recurrenceEndDate) {
    const y = recurrenceEndDate.getFullYear();
    const m = String(recurrenceEndDate.getMonth() + 1).padStart(2, '0');
    const d = String(recurrenceEndDate.getDate()).padStart(2, '0');
    parts.push(`UNTIL=${y}${m}${d}`);
  }
  return `RRULE:${parts.join(';')}`;
};


  const handleSubmit = async () => {
    setLoading(true);
    try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found");

        const isEditingDepositIdea = initialData?.type === 'depositIdea';
        
        if (formData.schedulingType === 'withdrawal') {
            // Handle Withdrawal creation/update
            if (!formData.title.trim() || !formData.amount || parseFloat(formData.amount) <= 0) {
                Alert.alert('Error', 'Please fill in title and a valid amount');
                return;
            }

            const withdrawalPayload = {
                user_id: user.id,
                title: formData.title.trim(),
                amount: parseFloat(formData.amount),
                withdrawn_at: toDateString(formData.withdrawalDate),
                updated_at: new Date().toISOString(),
            };

            let withdrawalData;
            let withdrawalError;

            if (mode === 'edit' && initialData?.id && initialData?.type === 'withdrawal') {
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
            if (!withdrawalData) throw new Error("Failed to save withdrawal");

            const withdrawalId = withdrawalData.id;

            // Handle joins for withdrawal
            if (mode === 'edit' && initialData?.id && initialData?.type === 'withdrawal') {
                await Promise.all([
                    supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
                    supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
                    supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', withdrawalId).eq('parent_type', 'withdrawal'),
                ]);
            }

            const roleJoins = formData.selectedRoleIds.map(role_id => ({ parent_id: withdrawalId, parent_type: 'withdrawal', role_id, user_id: user.id }));
            const domainJoins = formData.selectedDomainIds.map(domain_id => ({ parent_id: withdrawalId, parent_type: 'withdrawal', domain_id, user_id: user.id }));
            const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ parent_id: withdrawalId, parent_type: 'withdrawal', key_relationship_id, user_id: user.id }));

            // Only add a new note if there's content in the notes field
            if (formData.notes && formData.notes.trim()) {
                const { data: noteData, error: noteError } = await supabase.from('0008-ap-notes').insert({ user_id: user.id, content: formData.notes }).select().single();
                if (noteError) throw noteError;
                await supabase.from('0008-ap-universal-notes-join').insert({ parent_id: withdrawalId, parent_type: 'withdrawal', note_id: noteData.id, user_id: user.id });
            }

            if (roleJoins.length > 0) await supabase.from('0008-ap-universal-roles-join').insert(roleJoins);
            if (domainJoins.length > 0) await supabase.from('0008-ap-universal-domains-join').insert(domainJoins);
            if (krJoins.length > 0) await supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins);

            Alert.alert('Success', `Withdrawal ${mode === 'edit' ? 'updated' : 'created'} successfully`);

        } else if (formData.schedulingType === 'depositIdea') {
            // Handle Deposit Idea creation/update
            const diPayload: any = {
                user_id: user.id,
                title: formData.title,
                follow_up: formData.is_twelve_week_goal, // Map follow_up to 12-week goal flag
                updated_at: new Date().toISOString(),
            };

            let depositIdeaData;
            let depositIdeaError;

            if (mode === 'edit' && initialData?.id) {
                const { data, error } = await supabase
                    .from('0008-ap-deposit-ideas')
                    .update(diPayload)
                    .eq('id', initialData.id)
                    .select()
                    .single();
                depositIdeaData = data;
                depositIdeaError = error;
            } else {
                const { data, error } = await supabase
                    .from('0008-ap-deposit-ideas')
                    .insert(diPayload)
                    .select()
                    .single();
                depositIdeaData = data;
                depositIdeaError = error;
            }

            if (depositIdeaError) throw depositIdeaError;
            if (!depositIdeaData) throw new Error("Failed to create deposit idea");

            const depositIdeaId = depositIdeaData.id;

            // Handle joins for deposit idea
            if (mode === 'edit' && initialData?.id) {
                await Promise.all([
                    supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
                    supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
                    supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
                    supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', depositIdeaId).eq('parent_type', 'depositIdea'),
                ]);
            }

            const roleJoins = formData.selectedRoleIds.map(role_id => ({ parent_id: depositIdeaId, parent_type: 'depositIdea', role_id, user_id: user.id }));
            const domainJoins = formData.selectedDomainIds.map(domain_id => ({ parent_id: depositIdeaId, parent_type: 'depositIdea', domain_id, user_id: user.id }));
            const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ parent_id: depositIdeaId, parent_type: 'depositIdea', key_relationship_id, user_id: user.id }));
            const goalJoins = formData.selectedGoalIds.map(goal_id => ({ parent_id: depositIdeaId, parent_type: 'depositIdea', goal_id, user_id: user.id }));

            // Only add a new note if there's content in the notes field
            if (formData.notes && formData.notes.trim()) {
                const { data: noteData, error: noteError } = await supabase.from('0008-ap-notes').insert({ user_id: user.id, content: formData.notes }).select().single();
                if (noteError) throw noteError;
                await supabase.from('0008-ap-universal-notes-join').insert({ parent_id: depositIdeaId, parent_type: 'depositIdea', note_id: noteData.id, user_id: user.id });
            }

            if (roleJoins.length > 0) await supabase.from('0008-ap-universal-roles-join').insert(roleJoins);
            if (domainJoins.length > 0) await supabase.from('0008-ap-universal-domains-join').insert(domainJoins);
            if (krJoins.length > 0) await supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins);
            if (goalJoins.length > 0) await supabase.from('0008-ap-universal-goals-join').insert(goalJoins);

        } else {
            // Handle Task/Event creation/update
            const payload: any = {
                user_id: user.id,
                title: formData.title,
                is_urgent: formData.is_urgent,
                is_important: formData.is_important,
                is_authentic_deposit: formData.is_authentic_deposit,
                is_twelve_week_goal: formData.is_twelve_week_goal,
                goal_12wk_id: formData.selectedGoalId,
                status: 'pending',
                type: formData.schedulingType,
                due_date: toDateString(formData.dueDate),
                deposit_idea: isEditingDepositIdea, // True if converting from DI
                is_all_day: formData.isAnytime,
                updated_at: new Date().toISOString(),
            };

            if (formData.schedulingType === 'event' && !formData.isAnytime) {
                payload.start_time = combineDateAndTime(formData.dueDate, formData.startTime);
                payload.end_time = combineDateAndTime(formData.dueDate, formData.endTime);
            }

// Extended event fields
if (formData.schedulingType === 'event') {
    (payload as any).start_date = toDateString(formData.dueDate);
    (payload as any).end_date = toDateString((formData as any).eventEndDate || formData.dueDate);
    (payload as any).recurrence_rule = isRepeating ? constructRecurrenceRule() : null;
}

// Extended task fields (enable recurrence for tasks too)
if (formData.schedulingType === 'task') {
  (payload as any).start_date = toDateString(formData.dueDate);
  // If an "Ends" date was set in the recurrence modal, use it; otherwise keep dueDate
  (payload as any).end_date = toDateString(recurrenceEndDate || formData.dueDate);
  (payload as any).recurrence_rule = isRepeating ? constructRecurrenceRule() : null;
}
          
            let taskData;
            let taskError;

            if (mode === 'edit' && initialData?.id && !isEditingDepositIdea) {
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
            if (!taskData) throw new Error("Failed to create task");

            const taskId = taskData.id;

            // Handle DI conversion - link DI to new task
            if (isEditingDepositIdea && initialData?.id) {
                // Update the source deposit idea with activation info
                const { error: diUpdateError } = await supabase
                    .from('0008-ap-deposit-ideas')
                    .update({
                        activated_task_id: taskId,
                        activated_at: new Date().toISOString(),
                        is_active: true,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', initialData.id);

                if (diUpdateError) throw diUpdateError;
            }

            // Handle joins for task/event
            if (mode === 'edit' && initialData?.id && !isEditingDepositIdea) {
                await Promise.all([
                    supabase.from('0008-ap-universal-roles-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
                    supabase.from('0008-ap-universal-domains-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
                    supabase.from('0008-ap-universal-key-relationships-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
                    supabase.from('0008-ap-universal-goals-join').delete().eq('parent_id', taskId).eq('parent_type', 'task'),
                ]);
            }

            const roleJoins = formData.selectedRoleIds.map(role_id => ({ parent_id: taskId, parent_type: 'task', role_id, user_id: user.id }));
            const domainJoins = formData.selectedDomainIds.map(domain_id => ({ parent_id: taskId, parent_type: 'task', domain_id, user_id: user.id }));
            const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ parent_id: taskId, parent_type: 'task', key_relationship_id, user_id: user.id }));
            const goalJoins = formData.selectedGoalIds.map(goal_id => ({ parent_id: taskId, parent_type: 'task', goal_id, user_id: user.id }));

            // Only add a new note if there's content in the notes field
            if (formData.notes && formData.notes.trim()) {
                const { data: noteData, error: noteError } = await supabase.from('0008-ap-notes').insert({ user_id: user.id, content: formData.notes }).select().single();
                if (noteError) throw noteError;
                await supabase.from('0008-ap-universal-notes-join').insert({ parent_id: taskId, parent_type: 'task', note_id: noteData.id, user_id: user.id });
            }

            if (roleJoins.length > 0) await supabase.from('0008-ap-universal-roles-join').insert(roleJoins);
            if (domainJoins.length > 0) await supabase.from('0008-ap-universal-domains-join').insert(domainJoins);
            if (krJoins.length > 0) await supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins);
            if (goalJoins.length > 0) await supabase.from('0008-ap-universal-goals-join').insert(goalJoins);
        }

        onSubmitSuccess();
        onClose();

    } catch (error) {
        console.error(`Error ${mode === 'edit' ? 'updating' : 'creating'} ${formData.schedulingType}:`, error);
        Alert.alert('Error', (error as Error).message || `Failed to ${mode === 'edit' ? 'update' : 'create'} ${formData.schedulingType}`);
    } finally {
        setLoading(false);
    }
  };

  const filteredKeyRelationships = keyRelationships.filter(kr => formData.selectedRoleIds.includes(kr.role_id));

  // Dynamic placeholder text based on scheduling type
  const getTitlePlaceholder = () => {
    switch (formData.schedulingType) {
      case 'withdrawal':
        return 'Reason for your Withdrawal';
      case 'depositIdea':
        return 'What is your Deposit Idea?';
      default:
        return 'Action Title';
    }
  };

  const getNotesPlaceholder = () => {
    switch (formData.schedulingType) {
      case 'withdrawal':
        return 'Details that may help you improve';
      case 'depositIdea':
        return 'What is needed to make this idea a success?';
      default:
        return 'Notes...';
    }
  };

  return (
    <View style={styles.formContainer}>
        <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {mode === 'create' ? 'New Action' : 'Edit Action'}
            </Text>
            <TouchableOpacity onPress={onClose}><X size={24} color="#6b7280" /></TouchableOpacity>
        </View>
        <ScrollView style={styles.formContent}>
            <TextInput style={styles.input} placeholder={getTitlePlaceholder()} value={formData.title} onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))} />

            <View style={styles.schedulingToggle}>
              {['task', 'event', 'depositIdea', 'withdrawal'].map(type => (
                <TouchableOpacity key={type} style={[styles.toggleChip, formData.schedulingType === type && styles.toggleChipActive]} onPress={() => setFormData(prev => ({...prev, schedulingType: type as any}))}>
                  <Text style={formData.schedulingType === type ? styles.toggleChipTextActive : styles.toggleChipText}>
                    {type === 'depositIdea' ? 'Deposit Idea' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {formData.schedulingType === 'withdrawal' && (
              <>
                <Text style={styles.compactSectionTitle}>Withdrawal Details</Text>
                <View style={styles.compactDateTimeRow}>
                  <View style={styles.amountContainer}>
                    <Text style={styles.compactInputLabel}>Amount *</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={formData.amount}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, amount: text }))}
                      placeholder="0.0"
                      placeholderTextColor="#9ca3af"
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.withdrawalDateContainer}>
                    <TouchableOpacity
                      ref={dateInputRef}
                      style={styles.compactDateButton}
                      onPress={() => {
                        dateInputRef.current?.measure((fx, fy, width, height, px, py) => {
                          setWithdrawalDatePickerPosition({ x: px, y: py, width, height });
                          setShowWithdrawalCalendar(!showWithdrawalCalendar);
                        });
                      }}
                    >
                      <Text style={styles.compactInputLabel}>Date</Text>
                      <TextInput 
                        style={styles.dateTextInput} 
                        value={withdrawalDateInputValue} 
                        onChangeText={handleWithdrawalDateInputChange}
                        editable={false}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {formData.schedulingType !== 'depositIdea' && formData.schedulingType !== 'withdrawal' && (
              <>
                <View style={styles.compactSwitchRow}>
                  <View style={styles.compactSwitchContainer}><Text style={styles.compactSwitchLabel}>Urgent</Text><Switch value={formData.is_urgent} onValueChange={(val) => setFormData(prev => ({...prev, is_urgent: val}))} /></View>
                  <View style={styles.compactSwitchContainer}><Text style={styles.compactSwitchLabel}>Important</Text><Switch value={formData.is_important} onValueChange={(val) => setFormData(prev => ({...prev, is_important: val}))} /></View>
                </View>
                <View style={styles.compactSwitchRow}>
                  <View style={styles.compactSwitchContainer}><Text style={styles.compactSwitchLabel}>Authentic Deposit</Text><Switch value={formData.is_authentic_deposit} onValueChange={(val) => setFormData(prev => ({...prev, is_authentic_deposit: val}))} /></View>
                  <View style={styles.compactSwitchContainer}><Text style={styles.compactSwitchLabel}>Goals</Text><Switch value={formData.is_twelve_week_goal} onValueChange={(val) => setFormData(prev => ({...prev, is_twelve_week_goal: val}))} /></View>
                </View>

                {formData.schedulingType === 'task' && (
                  <>
                    <Text style={styles.compactSectionTitle}>Schedule</Text>
                    <View style={styles.compactDateTimeRow}>
                      <View>
                        <TouchableOpacity
                          ref={dateInputRef}
                          style={styles.compactDateButton}
                          onPress={() => {
  dateInputRef.current?.measure((fx, fy, width, height, px, py) => {
    setDatePickerPosition({ x: px, y: py, width, height });
    setActiveCalendarField('start');        // <-- add this
    setShowMiniCalendar(!showMiniCalendar);
  });
}}

                        >
                          <Text style={styles.compactInputLabel}>Due Date</Text>
                          <TextInput style={styles.dateTextInput} value={dateInputValue} onChangeText={handleDateInputChange} />
                        </TouchableOpacity>
                      </View>

                      <View>
                        <TouchableOpacity
                          ref={timeInputRef}
                          style={[styles.compactTimeButton, formData.isAnytime && styles.disabledButton]}
                          onPress={() => {
                            timeInputRef.current?.measure((_, __, w, h, px, py) => {
                              setTimePickerPosition({ x: px, y: py, width: w, height: h });
                              setActiveTimeField('time');
                              setShowTimePicker(true);
                            });
                          }}
                          disabled={formData.isAnytime}
                        >
                          <Text style={[styles.compactInputLabel, formData.isAnytime && styles.disabledText]}>Complete by</Text>
                          <Text style={[styles.compactInputValue, formData.isAnytime && styles.disabledText]}>{formData.time}</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity style={styles.anytimeContainer} onPress={() => setFormData(prev => ({...prev, isAnytime: !prev.isAnytime}))}>
                        <View style={[styles.checkbox, formData.isAnytime && styles.checkedBox]}><Text style={styles.checkmark}>{formData.isAnytime ? '✓' : ''}</Text></View>
                        <Text style={styles.anytimeLabel}>Anytime</Text>
                      </TouchableOpacity>
                    </View>

{/* Repeat (Recurrence) controls for TASKS */}
{formData.schedulingType === 'task' && formData.selectedGoalIds.length === 0 && (
<View style={{ marginTop: 12 }}>
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
    <Text style={styles.compactSectionTitle}>Repeat</Text>
    <Switch
      value={isRepeating}
      onValueChange={(value) => {
        setIsRepeating(value);
        if (value) {
          setIsRecurrenceModalVisible(true);
        } else {
          setSelectedRecurrenceDays([]);
          setRecurrenceEndDate(null);
          setRecurrenceFrequency('Weekly');
        }
      }}
    />
  </View>

  {isRepeating && (
    <TouchableOpacity
      style={styles.recurrenceButton}
      onPress={() => setIsRecurrenceModalVisible(true)}
    >
      <Text style={styles.recurrenceButtonText}>
        {getRecurrenceDisplayText()}
      </Text>
    </TouchableOpacity>
  )}
</View>
)}
                    
                  </>
                )}
                {formData.schedulingType === 'event' && (
                  <>
                    <Text style={styles.compactSectionTitle}>Schedule</Text>
                    <View style={styles.compactDateTimeRow}>
                      <View>
                        <TouchableOpacity
                          ref={dateInputRef}
                          style={styles.compactDateButton}
                          onPress={() => {
                            dateInputRef.current?.measure((fx, fy, width, height, px, py) => {
                              setDatePickerPosition({ x: px, y: py, width, height });
                              setShowMiniCalendar(!showMiniCalendar);
                            });
                          }}
                        >
                          <Text style={styles.compactInputLabel}>Date</Text>
                          <TextInput style={styles.dateTextInput} value={dateInputValue} onChangeText={handleDateInputChange} />
                        </TouchableOpacity>

<View>
  <TouchableOpacity
    ref={endDateInputRef}
    style={styles.compactDateButton}
    onPress={() => {
      endDateInputRef.current?.measure((fx, fy, width, height, px, py) => {
        setDatePickerPosition({ x: px, y: py, width, height });
        setActiveCalendarField('end');
        setShowMiniCalendar(true);
      });
    }}
  >
    <Text style={styles.compactInputLabel}>End Date</Text>
    <TextInput
      style={styles.dateTextInput}
      value={endDateInputValue}
      onChangeText={handleEndDateInputChange}
      editable={false}
    />
  </TouchableOpacity>
</View>
                      </View>

                      <View>
                        <TouchableOpacity
                          ref={startTimeInputRef}
                          style={[styles.compactTimeButton, formData.isAnytime && styles.disabledButton]}
                          onPress={() => {
                            startTimeInputRef.current?.measure((_, __, w, h, px, py) => {
                              setTimePickerPosition({ x: px, y: py, width: w, height: h });
                              setActiveTimeField('startTime');
                              setShowTimePicker(true);
                            });
                          }}
                          disabled={formData.isAnytime}
                        >
                          <Text style={[styles.compactInputLabel, formData.isAnytime && styles.disabledText]}>Start</Text>
                          <Text style={[styles.compactInputValue, formData.isAnytime && styles.disabledText]}>{formData.startTime}</Text>
                        </TouchableOpacity>
                      </View>

                      <View>
                        <TouchableOpacity
                          ref={endTimeInputRef}
                          style={[styles.compactTimeButton, formData.isAnytime && styles.disabledButton]}
                          onPress={() => {
                            endTimeInputRef.current?.measure((_, __, w, h, px, py) => {
                              setTimePickerPosition({ x: px, y: py, width: w, height: h });
                              setActiveTimeField('endTime');
                              setShowTimePicker(true);
                            });
                          }}
                          disabled={formData.isAnytime}
                        >
                          <Text style={[styles.compactInputLabel, formData.isAnytime && styles.disabledText]}>End</Text>
                          <Text style={[styles.compactInputValue, formData.isAnytime && styles.disabledText]}>{formData.endTime}</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity style={styles.anytimeContainer} onPress={() => setFormData(prev => ({...prev, isAnytime: !prev.isAnytime}))}>
                        <View style={[styles.checkbox, formData.isAnytime && styles.checkedBox]}><Text style={styles.checkmark}>{formData.isAnytime ? '✓' : ''}</Text></View>
                        <Text style={styles.anytimeLabel}>Anytime</Text>
                      </TouchableOpacity>
                    </View>

{/* Repeat (Recurrence) controls */}
{formData.schedulingType === 'event' && formData.selectedGoalIds.length === 0 && (
<View style={{ marginTop: 12 }}>
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
    <Text style={styles.compactSectionTitle}>Repeat</Text>
    <Switch
      value={isRepeating}
      onValueChange={(value) => {
        setIsRepeating(value);
        if (value) setIsRecurrenceModalVisible(true);
        if (!value) { setSelectedRecurrenceDays([]); setRecurrenceEndDate(null); setRecurrenceFrequency('Weekly'); }
      }}
    />
  </View>
  {isRepeating && (
    <TouchableOpacity
      style={styles.recurrenceButton}
      onPress={() => setIsRecurrenceModalVisible(true)}
    >
      <Text style={styles.recurrenceButtonText}>
        {getRecurrenceDisplayText()}
      </Text>
    </TouchableOpacity>
  )}
</View>
)}
                  </>
                )}

                {formData.is_twelve_week_goal && (
  <View style={styles.fieldGroup}>
    <Text style={styles.subLabel}>Link to one or more goals</Text>
    {allAvailableGoals.length === 0 ? (
      <Text style={styles.hintText}>
        No active goals found. Create one from Goal Bank.
      </Text>
    ) : (
      <View style={styles.checkboxGrid}>
  {allAvailableGoals.map((g) => {
    const isSelected = formData.selectedGoalIds.includes(g.id);
    return (
      <TouchableOpacity
        key={`${g.goal_type}:${g.id}`}
        style={styles.checkItem}
        onPress={() => {
          setFormData((prev) => {
            const next = isSelected
              ? prev.selectedGoalIds.filter((id) => id !== g.id)
              : [...prev.selectedGoalIds, g.id];
            const nextSelectedGoalId =
              g.goal_type === "twelve_wk_goal" && !isSelected
                ? g.id
                : prev.selectedGoalId;
            return {
              ...prev,
              selectedGoalIds: next,
              selectedGoalId: nextSelectedGoalId,
            };
          });
        }}
      >
        <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.checkLabel}>
          {g.title} {g.goal_type === "custom_goal" ? "(Custom)" : "(12-Week)"}
        </Text>
      </TouchableOpacity>
    );
  })}
</View>

    )}
  </View>
)}

              </>
            )}

            {formData.schedulingType === 'depositIdea' && (
              <>
                <Text style={styles.sectionTitle}>Goals</Text>
                <View style={styles.checkboxGrid}>
                  {twelveWeekGoals.map(goal => {
                    const isSelected = formData.selectedGoalIds?.includes(goal.id);
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
              </>
            )}

            <Text style={styles.sectionTitle}>Roles</Text>
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

            {filteredKeyRelationships.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Key Relationships</Text>
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
              </>
            )}

            <Text style={styles.sectionTitle}>Domains</Text>
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

            <TextInput style={[styles.input, { height: 100 }]} placeholder={getNotesPlaceholder()} value={formData.notes} onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))} multiline />
        </ScrollView>

        <View style={styles.actions}>
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}><Text style={styles.submitButtonText}>{loading ? 'Saving...' : mode === 'edit' ? 'Update Action' : 'Save Action'}</Text></TouchableOpacity>
        </View>

        {/* Pop-up Mini Calendar Modal */}
        <Modal transparent visible={showMiniCalendar} onRequestClose={() => setShowMiniCalendar(false)}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowMiniCalendar(false)}>
            <View style={[styles.calendarPopup, { top: datePickerPosition.y + datePickerPosition.height, left: datePickerPosition.x }]}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                <Calendar
  onDayPress={onCalendarDayPress}
  markedDates={{
    [toDateString(
      activeCalendarField === 'end'
        ? ((formData as any).eventEndDate || formData.dueDate)
        : formData.dueDate
    )]: { selected: true }
  }}
  dayComponent={CustomDayComponent}
  hideExtraDays={true}
/>

              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Pop-up Withdrawal Calendar Modal */}
        <Modal transparent visible={showWithdrawalCalendar} onRequestClose={() => setShowWithdrawalCalendar(false)}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowWithdrawalCalendar(false)}>
            <View style={[styles.calendarPopup, { top: withdrawalDatePickerPosition.y + withdrawalDatePickerPosition.height, left: withdrawalDatePickerPosition.x }]}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                <Calendar
                  onDayPress={onWithdrawalCalendarDayPress}
                  markedDates={{ [toDateString(formData.withdrawalDate)]: { selected: true } }}
                  dayComponent={CustomDayComponent}
                  hideExtraDays={true}
                />
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Pop-up Time Picker Modal */}
        <Modal transparent visible={showTimePicker} onRequestClose={() => setShowTimePicker(false)}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowTimePicker(false)}>
                <View style={[styles.timePickerPopup, { top: timePickerPosition.y, left: timePickerPosition.x + timePickerPosition.width + 8 }]}>
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
            </TouchableOpacity>
        </Modal>


{/* Recurrence Settings Modal */}
<RecurrenceSettingsModal
  visible={isRecurrenceModalVisible}
  onClose={() => setIsRecurrenceModalVisible(false)}
  onSave={({ frequency, selectedDays, endDate }) => {
    setRecurrenceFrequency(frequency as any);
    setSelectedRecurrenceDays(selectedDays);
    setRecurrenceEndDate(endDate);
    setIsRecurrenceModalVisible(false);
  }}
  initialSettings={{
    frequency: recurrenceFrequency,
    selectedDays: selectedRecurrenceDays,
    endDate: recurrenceEndDate
  }}
/>
    </View>
  );
};



/** Recurrence Settings Modal (inline) */
interface RecurrenceSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (settings: { frequency: string; selectedDays: string[]; endDate: Date | null }) => void;
  initialSettings: { frequency: string; selectedDays: string[]; endDate: Date | null };
}

const weekdayOptions = ['SU','MO','TU','WE','TH','FR','SA'];
const frequencyOptions = ['Daily','Weekly','Bi-weekly','Monthly','Yearly'];

function RecurrenceSettingsModal({ visible, onClose, onSave, initialSettings }: RecurrenceSettingsModalProps) {
  const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const [frequency, setFrequency] = useState<string>(initialSettings.frequency || 'Weekly');
  const [selectedDays, setSelectedDays] = useState<string[]>(initialSettings.selectedDays || []);
  const [until, setUntil] = useState<Date | null>(initialSettings.endDate || null);
  useEffect(() => {
    setFrequency(initialSettings.frequency || 'Weekly');
    setSelectedDays(initialSettings.selectedDays || []);
    setUntil(initialSettings.endDate || null);
  }, [initialSettings, visible]);

  const toggleDay = (day: string) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.recurrenceContainer}>
        <View style={styles.recurrenceHeader}>
          <Text style={styles.recurrenceTitle}>Recurrence Settings</Text>
          <TouchableOpacity onPress={onClose}><X size={22} color="#111827" /></TouchableOpacity>
        </View>

        <ScrollView style={styles.recurrenceContent}>
          <Text style={styles.recurrenceLabel}>Frequency</Text>
          <View style={styles.frequencyGrid}>
            {frequencyOptions.map((f) => (
              <TouchableOpacity key={f} onPress={() => setFrequency(f)} style={[styles.frequencyButton, frequency === f && styles.frequencyButtonSelected]}>
                <Text style={[styles.frequencyButtonText, frequency === f && styles.frequencyButtonTextSelected]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {(frequency === 'Weekly' || frequency === 'Bi-weekly') && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.recurrenceLabel}>Repeat On</Text>
              <View style={styles.weekdayRow}>
                {weekdayOptions.map((d) => (
                  <TouchableOpacity key={d} onPress={() => toggleDay(d)} style={[styles.weekdayChip, selectedDays.includes(d) && styles.weekdayChipSelected]}>
                    <Text style={[styles.weekdayText, selectedDays.includes(d) && styles.weekdayTextSelected]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={{ marginTop: 16 }}>
            <Text style={styles.recurrenceLabel}>Ends</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => setUntil(null)} style={[styles.endChoice, until === null && styles.endChoiceSelected]}>
                <Text style={[styles.endChoiceText, until === null && styles.endChoiceTextSelected]}>Never</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setUntil(until ?? new Date())} style={[styles.endChoice, until !== null && styles.endChoiceSelected]}>
                <Text style={[styles.endChoiceText, until !== null && styles.endChoiceTextSelected]}>{until ? until.toDateString() : 'On date...'}</Text>
              </TouchableOpacity>
            </View>
            {until !== null && (
              <View style={{ marginTop: 8 }}>
                <Calendar
                  onDayPress={(day: any) => {
                    const d = new Date(day.year, day.month - 1, day.day);
                    setUntil(d);
                  }}
                  markedDates={ until ? { [toISO(until)]: { selected: true } } : {} }
                />
              </View>
            )}
          </View>
        </ScrollView>

        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
          <TouchableOpacity style={[styles.dialogButton, styles.dialogCancel]} onPress={onClose}><Text style={styles.dialogCancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.dialogButton, styles.dialogSave]} onPress={() => onSave({ frequency, selectedDays, endDate: until })}><Text style={styles.dialogSaveText}>Save</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
    formContainer: { flex: 1, backgroundColor: 'white' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    modalTitle: { fontSize: 18, fontWeight: '600' },
    formContentContainer: { flex: 1 },
    formContent: { padding: 16 },
    input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
    field: { marginBottom: 16 },
    label: { fontSize: 16, fontWeight: '500', color: '#1f2937', marginBottom: 8 },
    dateButton: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
    compactSwitchRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
    compactSwitchContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    compactSwitchLabel: { fontSize: 14, fontWeight: '500' },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 8 },
    compactSectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8, marginTop: 12 },
    selectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6' },
    chipSelected: { backgroundColor: '#0078d4' },
    chipText: { color: '#374151' },
    chipTextSelected: { color: 'white' },
    submitButton: { backgroundColor: '#0078d4', padding: 16, alignItems: 'center', margin: 16, borderRadius: 8 },
    submitButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
    schedulingToggle: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 16 },
    toggleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#e5e7eb' },
    toggleChipActive: { backgroundColor: '#0078d4' },
    toggleChipText: { color: '#374151', fontWeight: '500' },
    toggleChipTextActive: { color: 'white', fontWeight: '600' },
    compactDateTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    compactDateButton: { flex: 0, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 8, backgroundColor: '#f8fafc' },
    dateTextInput: { fontSize: 14, fontWeight: '500', padding: 0 },
    compactTimeButton: { flex: 0, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 8, backgroundColor: '#f0f9ff' },
    compactInputLabel: { fontSize: 10, color: '#6b7280', marginBottom: 2 },
    compactInputValue: { fontSize: 14, fontWeight: '500' },
    disabledButton: { backgroundColor: '#f3f4f6' },
    disabledText: { color: '#9ca3af' },
    anytimeContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
    checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 3, marginRight: 6, justifyContent: 'center', alignItems: 'center' },
    checkedBox: { backgroundColor: '#0078d4', borderColor: '#0078d4' },
    checkmark: { color: 'white', fontSize: 12, fontWeight: 'bold' },
    anytimeLabel: { fontSize: 14 },
    calendarPopup: {
        position: 'absolute',
        width: 200,
        maxHeight: 220,
        backgroundColor: '#ffffff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 1000,
    },
    timePickerPopup: {
        position: 'absolute',
        width: 160,
        maxHeight: 160,
        backgroundColor: '#ffffff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 1000,
    },
    dayContainer: { width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
    dayText: { fontSize: 8 },
    selectedDay: { backgroundColor: '#0078d4', borderRadius: 10, width: 20, height: 20 },
    selectedDayText: { color: 'white' },
    todayText: { color: '#0078d4', fontWeight: 'bold' },
    disabledDayText: { color: '#d9e1e8' },
    checkboxGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    checkItem: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '23%',
      marginBottom: 12,
    },
    checkLabel: {
      fontSize: 14,
      color: '#374151',
      marginLeft: 8,
      flexShrink: 1,
    },
    timeOptionPopup: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#f3f4f6',
    },
    timeOptionTextPopup: {
      fontSize: 14,
      color: '#374151',
    },
   amountContainer: {
     flex: 1,
     marginRight: 8,
   },
   amountInput: {
     borderWidth: 1,
     borderColor: '#d1d5db',
     borderRadius: 6,
     padding: 8,
     fontSize: 14,
     backgroundColor: '#f0f9ff',
   },
   withdrawalDateContainer: {
     flex: 1,
     marginLeft: 8,
   },
   actions: {
     padding: 16,
   },
   fieldGroup: {
     marginBottom: 16,
   },
   subLabel: {
     fontSize: 14,
     fontWeight: '500',
     color: '#374151',
     marginBottom: 8,
   },
   hintText: {
     fontSize: 14,
     color: '#6b7280',
     fontStyle: 'italic',
   },
   chipsContainer: {
     flexDirection: 'row',
     flexWrap: 'wrap',
     gap: 8,
   },


// Recurrence styles
recurrenceContainer: { flex: 1, backgroundColor: '#fff' },
recurrenceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
recurrenceTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
recurrenceContent: { paddingHorizontal: 16, paddingTop: 12 },
recurrenceLabel: { fontSize: 14, color: '#374151', marginBottom: 8 },
frequencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
frequencyButton: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
frequencyButtonSelected: { backgroundColor: '#e0f2fe', borderColor: '#93c5fd' },
frequencyButtonText: { color: '#111827' },
frequencyButtonTextSelected: { color: '#1d4ed8', fontWeight: '600' },
weekdayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
weekdayChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#d1d5db' },
weekdayChipSelected: { backgroundColor: '#e0f2fe', borderColor: '#93c5fd' },
weekdayText: { color: '#111827' },
weekdayTextSelected: { color: '#1d4ed8', fontWeight: '600' },
endChoice: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
endChoiceSelected: { backgroundColor: '#e0f2fe', borderColor: '#93c5fd' },
endChoiceText: { color: '#111827' },
endChoiceTextSelected: { color: '#1d4ed8', fontWeight: '600' },
recurrenceButton: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
recurrenceButtonText: { color: '#1d4ed8', fontWeight: '500' },
dialogButton: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
dialogCancel: { backgroundColor: '#f3f4f6' },
dialogCancelText: { color: '#111827' },
dialogSave: { backgroundColor: '#1d4ed8' },
dialogSaveText: { color: 'white', fontWeight: '600' },
});

export default TaskEventForm;