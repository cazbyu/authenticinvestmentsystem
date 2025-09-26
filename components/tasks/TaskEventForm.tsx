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

  const [roles, setRoles] = useState