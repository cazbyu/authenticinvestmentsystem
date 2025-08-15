import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  ScrollView,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { X, Check } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

// Helper function to generate time options in 15-minute increments
const generateTimeOptions = () => {
  const times = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const time12 = `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
      times.push({ value: time24, label: time12 });
    }
  }
  return times;
};

// Helper function to get default time (current time + 1 hour, rounded to nearest 15 minutes)
const getDefaultTime = () => {
  const now = new Date();
  now.setHours(now.getHours() + 1);
  const minutes = now.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 15) * 15;
  now.setMinutes(roundedMinutes % 60);
  if (roundedMinutes >= 60) {
    now.setHours(now.getHours() + 1);
  }
  return now.toTimeString().slice(0, 5);
};

// Custom day component for the calendar
const CustomDayComponent = ({ date, state, marking, onPress }: any) => {
  const isSelected = marking?.selected;
  const isToday = state === 'today';
  const isDisabled = state === 'disabled';

  return (
    <TouchableOpacity
      style={[
        styles.dayContainer,
        isSelected && styles.selectedDay,
        isToday && !isSelected && styles.todayDay,
      ]}
      onPress={() => onPress && onPress(date)}
      disabled={isDisabled}
    >
      <Text
        style={[
          styles.dayText,
          isSelected && styles.selectedDayText,
          isToday && !isSelected && styles.todayDayText,
          isDisabled && styles.disabledDayText,
        ]}
      >
        {date.day}
      </Text>
    </TouchableOpacity>
  );
};

interface TaskEventFormProps {
  mode: 'create' | 'edit';
  taskId?: string;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

export default function TaskEventForm({ mode, taskId, onSubmitSuccess, onClose }: TaskEventFormProps) {
  const [schedulingType, setSchedulingType] = useState<'task' | 'event'>('task');
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [datePickerPosition, setDatePickerPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [timePickerPosition, setTimePickerPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isAnytime, setIsAnytime] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    time: getDefaultTime(),
    isUrgent: false,
    isImportant: false,
    isAuthenticDeposit: false,
    is12WeekGoal: false,
    type: 'task' as 'task' | 'deposit_idea',
  });

  const timeOptions = generateTimeOptions();

  const handleDateInputLayout = (event: any) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setDatePickerPosition({ x, y, width, height });
  };

  const handleTimeInputLayout = (event: any) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setTimePickerPosition({ x, y, width, height });
  };

  const handleDateSelect = (day: any) => {
    setFormData({ ...formData, dueDate: day.dateString });
    setShowMiniCalendar(false);
  };

  const handleTimeSelect = (time: string) => {
    setFormData({ ...formData, time });
    setShowTimePicker(false);
  };

  const formatDisplayDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDisplayTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in');
        return;
      }

      const taskData = {
        user_id: user.id,
        title: formData.title,
        description: formData.description || null,
        due_date: schedulingType === 'task' ? formData.dueDate : null,
        time: schedulingType === 'task' && !isAnytime ? formData.time : null,
        is_urgent: formData.isUrgent,
        is_important: formData.isImportant,
        type: formData.isAuthenticDeposit ? 'deposit_idea' : 'task',
        status: 'pending',
      };

      if (mode === 'create') {
        const { error } = await supabase
          .from('0007-ap-tasks')
          .insert([taskData]);

        if (error) {
          console.error('Error creating task:', error);
          Alert.alert('Error', 'Failed to create task');
          return;
        }
      } else {
        const { error } = await supabase
          .from('0007-ap-tasks')
          .update(taskData)
          .eq('id', taskId);

        if (error) {
          console.error('Error updating task:', error);
          Alert.alert('Error', 'Failed to update task');
          return;
        }
      }

      onSubmitSuccess();
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === 'create' ? 'New Task' : 'Edit Task'}
        </Text>
        <TouchableOpacity 
          onPress={handleSubmit} 
          style={styles.saveButton}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          {/* Scheduling Type Toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                schedulingType === 'task' && styles.activeToggle
              ]}
              onPress={() => setSchedulingType('task')}
            >
              <Text style={[
                styles.toggleText,
                schedulingType === 'task' && styles.activeToggleText
              ]}>
                Task
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.toggleButton,
                schedulingType === 'event' && styles.activeToggle
              ]}
              onPress={() => setSchedulingType('event')}
            >
              <Text style={[
                styles.toggleText,
                schedulingType === 'event' && styles.activeToggleText
              ]}>
                Event
              </Text>
            </TouchableOpacity>
          </View>

          {/* Title Input */}
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              placeholder="Enter title"
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Description Input */}
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Enter description (optional)"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Date and Time Row for Tasks */}
          {schedulingType === 'task' && (
            <View style={styles.dateTimeContainer}>
              <View style={styles.dateTimeRow}>
                {/* Due Date */}
                <View style={styles.datePickerContainer}>
                  <Text style={styles.smallLabel}>Due Date</Text>
                  <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => setShowMiniCalendar(!showMiniCalendar)}
                    onLayout={handleDateInputLayout}
                  >
                    <TextInput
                      style={styles.dateTextInput}
                      value={formData.dueDate}
                      onChangeText={(text) => setFormData({ ...formData, dueDate: text })}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#9ca3af"
                    />
                  </TouchableOpacity>
                </View>

                {/* Complete by Time */}
                <View style={styles.timePickerContainer}>
                  <Text style={styles.smallLabel}>Complete by</Text>
                  <TouchableOpacity
                    style={[styles.timeInput, isAnytime && styles.disabledInput]}
                    onPress={() => !isAnytime && setShowTimePicker(true)}
                    onLayout={handleTimeInputLayout}
                    disabled={isAnytime}
                  >
                    <Text style={[styles.timeText, isAnytime && styles.disabledText]}>
                      {isAnytime ? 'Anytime' : formatDisplayTime(formData.time)}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Anytime Checkbox */}
                <View style={styles.anytimeContainer}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => setIsAnytime(!isAnytime)}
                  >
                    {isAnytime && <Check size={14} color="#0078d4" />}
                  </TouchableOpacity>
                  <Text style={styles.checkboxLabel}>Anytime</Text>
                </View>
              </View>

              {/* Mini Calendar */}
              {showMiniCalendar && (
                <View style={styles.calendarPopup}>
                  <Calendar
                    current={formData.dueDate}
                    onDayPress={handleDateSelect}
                    markedDates={{
                      [formData.dueDate]: { selected: true, selectedColor: '#0078d4' }
                    }}
                    dayComponent={CustomDayComponent}
                    formatWeekDay={(name) => name.charAt(0)}
                    theme={{
                      backgroundColor: '#ffffff',
                      calendarBackground: '#ffffff',
                      textSectionTitleColor: '#6b7280',
                      selectedDayBackgroundColor: '#0078d4',
                      selectedDayTextColor: '#ffffff',
                      todayTextColor: '#0078d4',
                      dayTextColor: '#1f2937',
                      textDisabledColor: '#d1d5db',
                      arrowColor: '#0078d4',
                      monthTextColor: '#1f2937',
                      textDayFontSize: 9,
                      textMonthFontSize: 11,
                      textDayHeaderFontSize: 8,
                    }}
                  />
                </View>
              )}

              {/* Time Picker Modal */}
              {showTimePicker && (
                <View style={styles.timePickerPopup}>
                  <FlatList
                    data={timeOptions}
                    keyExtractor={(item) => item.value}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.timeOption,
                          item.value === formData.time && styles.selectedTimeOption
                        ]}
                        onPress={() => handleTimeSelect(item.value)}
                      >
                        <Text style={[
                          styles.timeOptionText,
                          item.value === formData.time && styles.selectedTimeOptionText
                        ]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    )}
                    showsVerticalScrollIndicator={false}
                  />
                </View>
              )}
            </View>
          )}

          {/* Priority Switches Row */}
          <View style={styles.switchesRow}>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Urgent</Text>
              <Switch
                value={formData.isUrgent}
                onValueChange={(value) => setFormData({ ...formData, isUrgent: value })}
                trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                thumbColor="#ffffff"
              />
            </View>
            
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Important</Text>
              <Switch
                value={formData.isImportant}
                onValueChange={(value) => setFormData({ ...formData, isImportant: value })}
                trackColor={{ false: '#d1d5db', true: '#0078d4' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          {/* Additional Switches Row */}
          <View style={styles.switchesRow}>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Authentic Deposit</Text>
              <Switch
                value={formData.isAuthenticDeposit}
                onValueChange={(value) => setFormData({ ...formData, isAuthenticDeposit: value })}
                trackColor={{ false: '#d1d5db', true: '#16a34a' }}
                thumbColor="#ffffff"
              />
            </View>
            
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>12-Week Goal</Text>
              <Switch
                value={formData.is12WeekGoal}
                onValueChange={(value) => setFormData({ ...formData, is12WeekGoal: value })}
                trackColor={{ false: '#d1d5db', true: '#7c3aed' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  saveButton: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    padding: 2,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  activeToggle: {
    backgroundColor: '#ffffff',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeToggleText: {
    color: '#0078d4',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 6,
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1f2937',
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  dateTimeContainer: {
    marginBottom: 16,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  datePickerContainer: {
    flex: 0,
    minWidth: 100,
  },
  timePickerContainer: {
    flex: 0,
    minWidth: 90,
  },
  anytimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  dateInput: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dateTextInput: {
    fontSize: 12,
    color: '#1f2937',
    padding: 0,
    margin: 0,
  },
  timeInput: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  disabledInput: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  timeText: {
    fontSize: 12,
    color: '#0078d4',
    fontWeight: '500',
  },
  disabledText: {
    color: '#9ca3af',
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  calendarPopup: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    width: 300,
    alignSelf: 'center',
  },
  timePickerPopup: {
    position: 'absolute',
    top: 60,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    width: 120,
    maxHeight: 200,
  },
  timeOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  selectedTimeOption: {
    backgroundColor: '#eff6ff',
  },
  timeOptionText: {
    fontSize: 12,
    color: '#1f2937',
    textAlign: 'center',
  },
  selectedTimeOptionText: {
    color: '#0078d4',
    fontWeight: '600',
  },
  switchesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  switchContainer: {
    alignItems: 'center',
    gap: 6,
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  dayContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  selectedDay: {
    backgroundColor: '#0078d4',
  },
  todayDay: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#0078d4',
  },
  dayText: {
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '400',
  },
  selectedDayText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  todayDayText: {
    color: '#0078d4',
    fontWeight: '600',
  },
  disabledDayText: {
    color: '#d1d5db',
  },
});