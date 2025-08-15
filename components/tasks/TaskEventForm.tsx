import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { Modal, FlatList, Dimensions } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { supabase } from "@/lib/supabase";
import { X } from 'lucide-react-native';

// --- TYPE DEFINITIONS ---
interface TaskEventFormProps {
  mode: "create" | "edit";
  initialData?: Partial<any>;
  onSubmitSuccess: () => void;
  onClose: () => void;
}

interface Role { id: string; label: string; }
interface Domain { id: string; name: string; }
interface KeyRelationship { id: string; name: string; role_id: string; }
interface TwelveWeekGoal { id: string; title: string; }

// --- THE COMPONENT ---
const TaskEventForm: React.FC<TaskEventFormProps> = ({ mode, initialData, onSubmitSuccess, onClose }) => {
  // Helper function to get default time (current time + 1 hour, rounded to nearest 15 min)
  const getDefaultTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const minutes = Math.ceil(now.getMinutes() / 15) * 15;
    now.setMinutes(minutes, 0, 0);
    const hour12 = now.getHours() === 0 ? 12 : now.getHours() > 12 ? now.getHours() - 12 : now.getHours();
    const ampm = now.getHours() < 12 ? 'AM' : 'PM';
    return `${hour12}:${now.getMinutes().toString().padStart(2, '0')} ${ampm}`;
  };

  const [formData, setFormData] = useState({
    title: '',
    notes: '',
    dueDate: new Date(),
    time: getDefaultTime(),
    isAnytime: false,
    is_urgent: false,
    is_important: false,
    is_authentic_deposit: false,
    is_twelve_week_goal: false,
    schedulingType: 'task' as 'task' | 'event' | 'depositIdea',
    selectedRoleIds: [] as string[],
    selectedDomainIds: [] as string[],
    selectedKeyRelationshipIds: [] as string[],
    selectedGoalId: null as string | null,
  });
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [twelveWeekGoals, setTwelveWeekGoals] = useState<TwelveWeekGoal[]>([]);

  const [loading, setLoading] = useState(false);
  
  // Calendar and time picker state
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dateInputValue, setDateInputValue] = useState('');
  
  // Position state for dynamic popover positioning
  const [datePickerPosition, setDatePickerPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [timePickerPosition, setTimePickerPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Initialize date input value
  useEffect(() => {
    setDateInputValue(formatDateForInput(formData.dueDate));
  }, [formData.dueDate]);

  // Generate time options in 15-minute increments
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

  const timeOptions = generateTimeOptions();
  // Fetch all the options for the form selects
  useEffect(() => {
    const fetchOptions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase.from("0007-ap-roles").select("id,label").eq("user_id", user.id).eq("is_active", true);
      const { data: domainData } = await supabase.from("0007-ap-domains").select("id,name");
      const { data: krData } = await supabase.from("0007-ap-key-relationships").select("id,name,role_id").eq("user_id", user.id);
      const { data: goalData } = await supabase.from("0007-ap-goals-12wk").select("id,title").eq("user_id", user.id).eq("status", "active");
      
      setRoles(roleData || []);
      setDomains(domainData || []);
      setKeyRelationships(krData || []);
      setTwelveWeekGoals(goalData || []);
    };
    fetchOptions();
  }, []);

  const handleMultiSelect = (field: 'selectedRoleIds' | 'selectedDomainIds' | 'selectedKeyRelationshipIds', id: string) => {
    setFormData(prev => {
      const currentSelection = prev[field] as string[];
      const newSelection = currentSelection.includes(id)
        ? currentSelection.filter(itemId => itemId !== id)
        : [...currentSelection, id];
      return { ...prev, [field]: newSelection };
    });
  };

  const onCalendarDayPress = (day: any) => {
    const selectedDate = new Date(day.dateString);
    setFormData(prev => ({ ...prev, dueDate: selectedDate }));
    setDateInputValue(formatDateForInput(selectedDate));
    setShowMiniCalendar(false);
  };

  const onTimeSelect = (timeOption: { value: string; label: string }) => {
    setFormData(prev => ({ ...prev, time: timeOption.label }));
    setShowTimePicker(false);
  };

  const formatDateForInput = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleDateInputChange = (text: string) => {
    setDateInputValue(text);
    // Try to parse the entered date
    const parsedDate = new Date(text);
    if (!isNaN(parsedDate.getTime())) {
      setFormData(prev => ({ ...prev, dueDate: parsedDate }));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found");

        // 1. Insert the main task
        const { data: taskData, error: taskError } = await supabase
            .from('0007-ap-tasks')
            .insert({
                user_id: user.id,
                title: formData.title,
                is_urgent: formData.is_urgent,
                is_important: formData.is_important,
                is_authentic_deposit: formData.is_authentic_deposit,
                is_twelve_week_goal: formData.is_twelve_week_goal,
                goal_12wk_id: formData.selectedGoalId,
                due_date: formData.schedulingType !== 'depositIdea' ? formData.dueDate.toISOString() : null,
                status: 'pending',
                type: formData.schedulingType,
            })
            .select()
            .single();

        if (taskError) throw taskError;
        if (!taskData) throw new Error("Failed to create task");

        const taskId = taskData.id;

        // 2. Insert into join tables
        const roleJoins = formData.selectedRoleIds.map(role_id => ({ parent_id: taskId, parent_type: 'task', role_id, user_id: user.id }));
        const domainJoins = formData.selectedDomainIds.map(domain_id => ({ parent_id: taskId, parent_type: 'task', domain_id, user_id: user.id }));
        const krJoins = formData.selectedKeyRelationshipIds.map(key_relationship_id => ({ parent_id: taskId, parent_type: 'task', key_relationship_id, user_id: user.id }));
        
        if (formData.notes) {
            const { data: noteData, error: noteError } = await supabase.from('0007-ap-notes').insert({ user_id: user.id, content: formData.notes }).select().single();
            if (noteError) throw noteError;
            await supabase.from('0007-ap-universal-notes-join').insert({ parent_id: taskId, parent_type: 'task', note_id: noteData.id, user_id: user.id });
        }

        if (roleJoins.length > 0) await supabase.from('0007-ap-universal-roles-join').insert(roleJoins);
        if (domainJoins.length > 0) await supabase.from('0007-ap-universal-domains-join').insert(domainJoins);
        if (krJoins.length > 0) await supabase.from('0007-ap-universal-key-relationships-join').insert(krJoins);

        onSubmitSuccess();
        onClose();

    } catch (error) {
        console.error("Error creating task:", error);
        Alert.alert('Error', 'Failed to create task');
    } finally {
        setLoading(false);
    }
  };

  const filteredKeyRelationships = keyRelationships.filter(kr => formData.selectedRoleIds.includes(kr.role_id));

  return (
    <View style={styles.formContainer}>
        <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{mode === 'create' ? 'New Action' : 'Edit Action'}</Text>
            <TouchableOpacity onPress={onClose}><X size={24} color="#6b7280" /></TouchableOpacity>
        </View>
        <ScrollView style={styles.formContent}>
            <TextInput 
              style={styles.input} 
              placeholder="Action Title" 
              value={formData.title} 
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))} 
            />
            
            <View style={styles.schedulingToggle}>
              {['task', 'event', 'depositIdea'].map(type => (
                <TouchableOpacity 
                  key={type} 
                  style={[styles.toggleChip, formData.schedulingType === type && styles.toggleChipActive]} 
                  onPress={() => setFormData(prev => ({...prev, schedulingType: type as any}))}
                >
                  <Text style={formData.schedulingType === type ? styles.toggleChipTextActive : styles.toggleChipText}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {formData.schedulingType !== 'depositIdea' && (
              <>
                <View style={styles.compactSwitchRow}>
                  <View style={styles.compactSwitchContainer}>
                    <Text style={styles.compactSwitchLabel}>Urgent</Text>
                    <Switch 
                      value={formData.is_urgent} 
                      onValueChange={(val) => setFormData(prev => ({...prev, is_urgent: val}))}
                      trackColor={{ false: '#e5e7eb', true: '#0078d4' }}
                      thumbColor={formData.is_urgent ? '#ffffff' : '#f4f3f4'}
                    />
                  </View>
                  <View style={styles.compactSwitchContainer}>
                    <Text style={styles.compactSwitchLabel}>Important</Text>
                    <Switch 
                      value={formData.is_important} 
                      onValueChange={(val) => setFormData(prev => ({...prev, is_important: val}))}
                      trackColor={{ false: '#e5e7eb', true: '#0078d4' }}
                      thumbColor={formData.is_important ? '#ffffff' : '#f4f3f4'}
                    />
                  </View>
                </View>
                
                <View style={styles.compactSwitchRow}>
                  <View style={styles.compactSwitchContainer}>
                    <Text style={styles.compactSwitchLabel}>Authentic Deposit</Text>
                    <Switch 
                      value={formData.is_authentic_deposit} 
                      onValueChange={(val) => setFormData(prev => ({...prev, is_authentic_deposit: val}))}
                      trackColor={{ false: '#e5e7eb', true: '#0078d4' }}
                      thumbColor={formData.is_authentic_deposit ? '#ffffff' : '#f4f3f4'}
                    />
                  </View>
                  <View style={styles.compactSwitchContainer}>
                    <Text style={styles.compactSwitchLabel}>12-Week Goal</Text>
                    <Switch 
                      value={formData.is_twelve_week_goal} 
                      onValueChange={(val) => setFormData(prev => ({...prev, is_twelve_week_goal: val}))}
                      trackColor={{ false: '#e5e7eb', true: '#0078d4' }}
                      thumbColor={formData.is_twelve_week_goal ? '#ffffff' : '#f4f3f4'}
                    />
                  </View>
                </View>
                
                {formData.schedulingType === 'task' && (
                  <>
                    <Text style={styles.compactSectionTitle}>Schedule</Text>
                    <View style={styles.compactDateTimeRow}>
                      {/* Date Picker Container */}
                      <View style={styles.datePickerContainer}>
                        <TouchableOpacity 
                          style={styles.compactDateButton}
                          onPress={() => setShowMiniCalendar(!showMiniCalendar)}
                          onLayout={(event) => {
                            const { x, y, width, height } = event.nativeEvent.layout;
                            setDatePickerPosition({ x, y, width, height });
                          }}
                        >
                          <Text style={styles.compactInputLabel}>Due Date</Text>
                          <TextInput
                            style={styles.dateTextInput}
                            value={dateInputValue}
                            onChangeText={handleDateInputChange}
                            placeholder="Select date"
                            placeholderTextColor="#9ca3af"
                          />
                        </TouchableOpacity>
                        
                        {/* Pop-up Mini Calendar */}
                        {showMiniCalendar && (
                          <View style={[
                            styles.calendarPopup,
                            {
                              top: datePickerPosition.y,
                              left: datePickerPosition.x + datePickerPosition.width + 5,
                            }
                          ]}>
                            <Calendar
                              onDayPress={onCalendarDayPress}
                              markedDates={{
                                [formData.dueDate.toISOString().split('T')[0]]: {
                                  selected: true,
                                  selectedColor: '#0078d4',
                                },
                              }}
                              // Add this new component right before your TaskEventForm component
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
                              formatWeekDay={(name) => name.charAt(0)}
                              theme={{
                                backgroundColor: '#ffffff',
                                calendarBackground: '#ffffff',
                                textSectionTitleColor: '#b6c1cd',
                                selectedDayBackgroundColor: '#0078d4',
                                selectedDayTextColor: '#ffffff',
                                todayTextColor: '#0078d4',
                                dayTextColor: '#2d4150',
                                textDisabledColor: '#d9e1e8',
                                arrowColor: '#0078d4',
                                monthTextColor: '#0078d4',
                                textDayFontWeight: '300',
                                textMonthFontWeight: 'bold',
                                textDayHeaderFontWeight: '300',
                                textDayFontSize: 9,
                                textMonthFontSize: 11,
                                textDayHeaderFontSize: 8
                              }}
                            />
                          </View>
                        )}
                      </View>
                      
                      {/* Time Picker Container */}
                      <View style={styles.timePickerContainer}>
                        <TouchableOpacity 
                          style={[styles.compactTimeButton, formData.isAnytime && styles.disabledButton]}
                          onPress={() => setShowTimePicker(!showTimePicker)}
                          disabled={formData.isAnytime}
                          onLayout={(event) => {
                            const { x, y, width, height } = event.nativeEvent.layout;
                            setTimePickerPosition({ x, y, width, height });
                          }}
                        >
                          <Text style={[styles.compactInputLabel, formData.isAnytime && styles.disabledText]}>Complete by</Text>
                          <Text style={[styles.compactInputValue, formData.isAnytime && styles.disabledText]}>
                            {formData.time}
                          </Text>
                        </TouchableOpacity>
                        
                        {/* Pop-up Time Picker */}
                        {showTimePicker && (
                          <View style={[
                            styles.timePickerPopup,
                            {
                              top: timePickerPosition.height + 5,
                              left: 0,
                            }
                          ]}>
                            <FlatList
                              data={timeOptions}
                              keyExtractor={(item) => item.value}
                              renderItem={({ item }) => (
                                <TouchableOpacity
                                  style={[
                                    styles.timeOptionPopup,
                                    formData.time === item.label && styles.selectedTimeOptionPopup
                                  ]}
                                  onPress={() => onTimeSelect(item)}
                                >
                                  <Text style={[
                                    styles.timeOptionTextPopup,
                                    formData.time === item.label && styles.selectedTimeOptionTextPopup
                                  ]}>
                                    {item.label}
                                  </Text>
                                </TouchableOpacity>
                              )}
                              showsVerticalScrollIndicator={false}
                              style={styles.timeListPopup}
                            />
                          </View>
                        )}
                      </View>
                      
                      <TouchableOpacity 
                        style={styles.anytimeContainer}
                        onPress={() => setFormData(prev => ({...prev, isAnytime: !prev.isAnytime}))}
                      >
                        <View style={[styles.checkbox, formData.isAnytime && styles.checkedBox]}>
                          {formData.isAnytime && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.anytimeLabel}>Anytime</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            )}

            <Text style={styles.sectionTitle}>Roles</Text>
            <View style={styles.selectionGrid}>
                {roles.map(role => (
                    <TouchableOpacity 
                      key={role.id} 
                      style={[styles.chip, formData.selectedRoleIds.includes(role.id) && styles.chipSelected]} 
                      onPress={() => handleMultiSelect('selectedRoleIds', role.id)}
                    >
                        <Text style={formData.selectedRoleIds.includes(role.id) ? styles.chipTextSelected : styles.chipText}>
                          {role.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {filteredKeyRelationships.length > 0 && (
                <>
                    <Text style={styles.sectionTitle}>Key Relationships</Text>
                    <View style={styles.selectionGrid}>
                        {filteredKeyRelationships.map(kr => (
                            <TouchableOpacity 
                              key={kr.id} 
                              style={[styles.chip, formData.selectedKeyRelationshipIds.includes(kr.id) && styles.chipSelected]} 
                              onPress={() => handleMultiSelect('selectedKeyRelationshipIds', kr.id)}
                            >
                                <Text style={formData.selectedKeyRelationshipIds.includes(kr.id) ? styles.chipTextSelected : styles.chipText}>
                                  {kr.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </>
            )}

            <Text style={styles.sectionTitle}>Domains</Text>
            <View style={styles.selectionGrid}>
                {domains.map(domain => (
                    <TouchableOpacity 
                      key={domain.id} 
                      style={[styles.chip, formData.selectedDomainIds.includes(domain.id) && styles.chipSelected]} 
                      onPress={() => handleMultiSelect('selectedDomainIds', domain.id)}
                    >
                        <Text style={formData.selectedDomainIds.includes(domain.id) ? styles.chipTextSelected : styles.chipText}>
                          {domain.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TextInput
                style={[styles.input, { height: 100 }]}
                placeholder="Notes..."
                value={formData.notes}
                onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                multiline
            />

        </ScrollView>
        
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.submitButtonText}>{loading ? 'Saving...' : 'Save Action'}</Text>
        </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
    formContainer: { flex: 1, backgroundColor: 'white' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    modalTitle: { fontSize: 18, fontWeight: '600' },
    formContent: { padding: 16 },
    input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
    compactSwitchRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
    compactSwitchContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'space-between', paddingHorizontal: 8 },
    compactSwitchLabel: { fontSize: 13, fontWeight: '500', color: '#374151' },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 8 },
    compactSectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 6, marginTop: 12, color: '#1f2937' },
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
    compactDateTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    compactDateButton: { 
      flex: 0, 
      minWidth: 100,
      borderWidth: 1, 
      borderColor: '#d1d5db', 
      borderRadius: 6, 
      padding: 8, 
      backgroundColor: '#f8fafc' 
    },
    dateTextInput: {
      fontSize: 13,
      fontWeight: '600',
      color: '#1f2937',
      padding: 0,
      margin: 0,
    },
    compactTimeButton: { 
      flex: 0, 
      minWidth: 90,
      borderWidth: 1, 
      borderColor: '#d1d5db', 
      borderRadius: 6, 
      padding: 8, 
      backgroundColor: '#f0f9ff' 
    },
    compactInputLabel: { fontSize: 10, fontWeight: '500', color: '#6b7280', marginBottom: 2 },
    compactInputValue: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
    disabledButton: { backgroundColor: '#f3f4f6', opacity: 0.6 },
    disabledText: { color: '#9ca3af' },
    anytimeContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
    checkbox: { 
      width: 16, 
      height: 16, 
      borderWidth: 1, 
      borderColor: '#d1d5db', 
      borderRadius: 3, 
      marginRight: 6,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#ffffff'
    },
    checkedBox: { backgroundColor: '#0078d4', borderColor: '#0078d4' },
    checkmark: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
    anytimeLabel: { fontSize: 12, color: '#374151', fontWeight: '500' },
    datePickerContainer: {
      position: 'relative',
      zIndex: 1000,
    },
    timePickerContainer: {
      position: 'relative',
      zIndex: 999,
    },
    calendarPopup: {
      position: 'absolute',
      width: 220,
      backgroundColor: '#ffffff',
      borderRadius: 8,
      padding: 8,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 1001,
    },
    timePickerPopup: {
      position: 'absolute',
      width: 120,
      maxHeight: 200,
      backgroundColor: '#ffffff',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 1000,
    },
    timeListPopup: {
      maxHeight: 180,
    },
    timeOptionPopup: {
      padding: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#f3f4f6',
    },
    selectedTimeOptionPopup: {
      backgroundColor: '#eff6ff',
    },
    timeOptionTextPopup: {
      fontSize: 13,
      color: '#374151',
      textAlign: 'center',
    },
    selectedTimeOptionTextPopup: {
      color: '#0078d4',
      fontWeight: '600',
    },
});

export default TaskEventForm;