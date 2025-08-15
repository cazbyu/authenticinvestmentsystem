import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { Modal, FlatList } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  const [formData, setFormData] = useState({
    title: '',
    notes: '',
    dueDate: new Date(),
    time: '9:00 AM',
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
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

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
    setShowCalendar(false);
  };

  const onTimeSelect = (timeOption: { value: string; label: string }) => {
    setFormData(prev => ({ ...prev, time: timeOption.label }));
    setShowTimePicker(false);
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
                <View style={styles.switchRow}>
                  <View style={styles.switchContainer}>
                    <Text style={styles.switchLabel}>Urgent</Text>
                    <Switch value={formData.is_urgent} onValueChange={(val) => setFormData(prev => ({...prev, is_urgent: val}))} />
                  </View>
                  <View style={styles.switchContainer}>
                    <Text style={styles.switchLabel}>Important</Text>
                    <Switch value={formData.is_important} onValueChange={(val) => setFormData(prev => ({...prev, is_important: val}))} />
                  </View>
                </View>
                
                <View style={styles.switchRow}>
                  <View style={styles.switchContainer}>
                    <Text style={styles.switchLabel}>Authentic Deposit</Text>
                    <Switch value={formData.is_authentic_deposit} onValueChange={(val) => setFormData(prev => ({...prev, is_authentic_deposit: val}))} />
                  </View>
                  <View style={styles.switchContainer}>
                    <Text style={styles.switchLabel}>12-Week Goal</Text>
                    <Switch value={formData.is_twelve_week_goal} onValueChange={(val) => setFormData(prev => ({...prev, is_twelve_week_goal: val}))} />
                  </View>
                </View>
                
                {/* Date and Time Row */}
                {formData.schedulingType === 'task' && (
                  <>
                    <Text style={styles.sectionTitle}>Schedule</Text>
                    <View style={styles.dateTimeRow}>
                      <TouchableOpacity 
                        style={[styles.dateTimeButton, styles.dateButton]}
                        onPress={() => setShowCalendar(true)}
                      >
                        <Text style={styles.dateTimeLabel}>Due Date</Text>
                        <Text style={styles.dateTimeValue}>
                          {formData.dueDate.toLocaleDateString()}
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[styles.dateTimeButton, styles.timeButton]}
                        onPress={() => setShowTimePicker(true)}
                      >
                        <Text style={styles.dateTimeLabel}>Complete by</Text>
                        <Text style={styles.dateTimeValue}>
                          {formData.time}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    {/* Inline Calendar */}
                    {showCalendar && (
                      <View style={styles.calendarContainer}>
                        <Calendar
                          onDayPress={onCalendarDayPress}
                          markedDates={{
                            [formData.dueDate.toISOString().split('T')[0]]: {
                              selected: true,
                              selectedColor: '#0078d4',
                            },
                          }}
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
                            textDayFontSize: 16,
                            textMonthFontSize: 16,
                            textDayHeaderFontSize: 13
                          }}
                        />
                      </View>
                    )}
                  </>
                )}
                
                {/* Event Date Picker for Events */}
                {formData.schedulingType === 'event' && (
                  <>
                    <Text style={styles.sectionTitle}>Event Date</Text>
                    <TouchableOpacity 
                      style={styles.dateButton}
                      onPress={() => setShowCalendar(true)}
                    >
                      <Text style={styles.dateButtonText}>
                        {formData.dueDate.toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>
                    
                    {showCalendar && (
                      <View style={styles.calendarContainer}>
                        <Calendar
                          onDayPress={onCalendarDayPress}
                          markedDates={{
                            [formData.dueDate.toISOString().split('T')[0]]: {
                              selected: true,
                              selectedColor: '#0078d4',
                            },
                          }}
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
                            textDayFontSize: 16,
                            textMonthFontSize: 16,
                            textDayHeaderFontSize: 13
                          }}
                        />
                      </View>
                    )}
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
        
        {/* Time Picker Modal */}
        <Modal
          visible={showTimePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.timePickerModal}>
              <View style={styles.timePickerHeader}>
                <Text style={styles.timePickerTitle}>Select Time</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <X size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={timeOptions}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.timeOption,
                      formData.time === item.label && styles.selectedTimeOption
                    ]}
                    onPress={() => onTimeSelect(item)}
                  >
                    <Text style={[
                      styles.timeOptionText,
                      formData.time === item.label && styles.selectedTimeOptionText
                    ]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
                style={styles.timeOptionsList}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        </Modal>
        
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
    switchRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
    switchContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'space-between', paddingHorizontal: 8 },
    switchLabel: { fontSize: 14, fontWeight: '500', color: '#374151' },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 8 },
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
    dateTimeRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    dateTimeButton: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, backgroundColor: '#ffffff' },
    dateButton: { backgroundColor: '#f8fafc' },
    timeButton: { backgroundColor: '#f0f9ff' },
    dateTimeLabel: { fontSize: 12, fontWeight: '500', color: '#6b7280', marginBottom: 4 },
    dateTimeValue: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
    calendarContainer: { marginBottom: 16, backgroundColor: '#ffffff', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#e5e7eb' },
    dateButton: {
      borderWidth: 1,
      borderColor: '#d1d5db',
      borderRadius: 8,
      padding: 12,
      backgroundColor: '#ffffff',
      marginBottom: 16,
    },
    dateButtonText: {
      fontSize: 16,
      color: '#1f2937',
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
    timePickerModal: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
    timePickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    timePickerTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
    timeOptionsList: { maxHeight: 400 },
    timeOption: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    selectedTimeOption: { backgroundColor: '#eff6ff' },
    timeOptionText: { fontSize: 16, color: '#374151' },
    selectedTimeOptionText: { color: '#0078d4', fontWeight: '600' },
});

export default TaskEventForm;