import React, { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, Modal, FlatList } from 'react-native';
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

// --- CUSTOM DAY COMPONENT for CALENDAR ---
// This component gives us precise control over the calendar's appearance
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


// --- MAIN FORM COMPONENT ---
const TaskEventForm: React.FC<TaskEventFormProps> = ({ mode, initialData, onSubmitSuccess, onClose }) => {

const toDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const dateInputRef = useRef<TouchableOpacity>(null);
  const timeInputRef = useRef<TouchableOpacity>(null);
  const startTimeInputRef = useRef<TouchableOpacity>(null);
  const endTimeInputRef = useRef<TouchableOpacity>(null);

  // Helper function to get default time (current time + offset hours, rounded to nearest 15 min)
  const getDefaultTime = (addHours: number = 1) => {
    const now = new Date();
    now.setHours(now.getHours() + addHours);
    const minutes = Math.ceil(now.getMinutes() / 15) * 15;
    now.setMinutes(minutes, 0, 0);
    const hour12 = now.getHours() === 0 ? 12 : now.getHours() > 12 ? now.getHours() - 12 : now.getHours();
    const ampm = now.getHours() < 12 ? 'am' : 'pm';
    return `${hour12}:${now.getMinutes().toString().padStart(2, '0')} ${ampm}`;
  };

  const [formData, setFormData] = useState({
    title: '',
    notes: '',
    dueDate: new Date(),
    time: getDefaultTime(),
    startTime: getDefaultTime(),
    endTime: getDefaultTime(2),
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
  
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dateInputValue, setDateInputValue] = useState('');
  const [activeTimeField, setActiveTimeField] = useState<'time' | 'startTime' | 'endTime' | null>(null);

  const [datePickerPosition, setDatePickerPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [timePickerPosition, setTimePickerPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    setDateInputValue(formatDateForInput(formData.dueDate));
  }, [formData.dueDate]);

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
    const selectedDate = new Date(day.timestamp); // Use timestamp for timezone consistency
    setFormData(prev => ({ ...prev, dueDate: selectedDate }));
    setDateInputValue(formatDateForInput(selectedDate));
    setShowMiniCalendar(false);
  };

  const onTimeSelect = (time: string) => {
    if (activeTimeField) {
      setFormData(prev => ({ ...prev, [activeTimeField]: time }));
    }
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
    const parsedDate = new Date(text);
    if (!isNaN(parsedDate.getTime())) {
      setFormData(prev => ({ ...prev, dueDate: parsedDate }));
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

  const handleSubmit = async () => {
    setLoading(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found");

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
            due_date: formData.schedulingType !== 'depositIdea' ? formData.dueDate.toISOString() : null,
        };

        if (formData.schedulingType === 'event' && !formData.isAnytime) {
            payload.start_time = combineDateAndTime(formData.dueDate, formData.startTime);
            payload.end_time = combineDateAndTime(formData.dueDate, formData.endTime);
        }

        const { data: taskData, error: taskError } = await supabase
            .from('0007-ap-tasks')
            .insert(payload)
            .select()
            .single();

        if (taskError) throw taskError;
        if (!taskData) throw new Error("Failed to create task");

        const taskId = taskData.id;

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
            <TextInput style={styles.input} placeholder="Action Title" value={formData.title} onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))} />
            
            <View style={styles.schedulingToggle}>
              {['task', 'event', 'depositIdea'].map(type => (
                <TouchableOpacity key={type} style={[styles.toggleChip, formData.schedulingType === type && styles.toggleChipActive]} onPress={() => setFormData(prev => ({...prev, schedulingType: type as any}))}>
                  <Text style={formData.schedulingType === type ? styles.toggleChipTextActive : styles.toggleChipText}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {formData.schedulingType !== 'depositIdea' && (
              <>
                <View style={styles.compactSwitchRow}>
                  <View style={styles.compactSwitchContainer}><Text style={styles.compactSwitchLabel}>Urgent</Text><Switch value={formData.is_urgent} onValueChange={(val) => setFormData(prev => ({...prev, is_urgent: val}))} /></View>
                  <View style={styles.compactSwitchContainer}><Text style={styles.compactSwitchLabel}>Important</Text><Switch value={formData.is_important} onValueChange={(val) => setFormData(prev => ({...prev, is_important: val}))} /></View>
                </View>
                <View style={styles.compactSwitchRow}>
                  <View style={styles.compactSwitchContainer}><Text style={styles.compactSwitchLabel}>Authentic Deposit</Text><Switch value={formData.is_authentic_deposit} onValueChange={(val) => setFormData(prev => ({...prev, is_authentic_deposit: val}))} /></View>
                  <View style={styles.compactSwitchContainer}><Text style={styles.compactSwitchLabel}>12-Week Goal</Text><Switch value={formData.is_twelve_week_goal} onValueChange={(val) => setFormData(prev => ({...prev, is_twelve_week_goal: val}))} /></View>
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
                  </>
                )}
              </>
            )}

            <Text style={styles.sectionTitle}>Roles</Text>
            <View style={styles.selectionGrid}>
                {roles.map(role => (<TouchableOpacity key={role.id} style={[styles.chip, formData.selectedRoleIds.includes(role.id) && styles.chipSelected]} onPress={() => handleMultiSelect('selectedRoleIds', role.id)}><Text style={formData.selectedRoleIds.includes(role.id) ? styles.chipTextSelected : styles.chipText}>{role.label}</Text></TouchableOpacity>))}
            </View>

            {filteredKeyRelationships.length > 0 && (
                <><Text style={styles.sectionTitle}>Key Relationships</Text><View style={styles.selectionGrid}>{filteredKeyRelationships.map(kr => (<TouchableOpacity key={kr.id} style={[styles.chip, formData.selectedKeyRelationshipIds.includes(kr.id) && styles.chipSelected]} onPress={() => handleMultiSelect('selectedKeyRelationshipIds', kr.id)}><Text style={formData.selectedKeyRelationshipIds.includes(kr.id) ? styles.chipTextSelected : styles.chipText}>{kr.name}</Text></TouchableOpacity>))}</View></>
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

            <TextInput style={[styles.input, { height: 100 }]} placeholder="Notes..." value={formData.notes} onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))} multiline />
        </ScrollView>
        
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}><Text style={styles.submitButtonText}>{loading ? 'Saving...' : 'Save Action'}</Text></TouchableOpacity>

        {/* Pop-up Mini Calendar Modal */}
        <Modal transparent visible={showMiniCalendar} onRequestClose={() => setShowMiniCalendar(false)}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowMiniCalendar(false)}>
            <View style={[styles.calendarPopup, { top: datePickerPosition.y + datePickerPosition.height, left: datePickerPosition.x }]}> 
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                <Calendar
                  onDayPress={onCalendarDayPress}
                  markedDates={{ [toDateString(formData.dueDate)]: { selected: true } }}
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
                        data={timeOptions}
                        keyExtractor={(item) => item}
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
    </View>
  );
};

const styles = StyleSheet.create({
    formContainer: { flex: 1, backgroundColor: 'white' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    modalTitle: { fontSize: 18, fontWeight: '600' },
    formContent: { padding: 16 },
    input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
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
        width: 160, // Wider to fit time and duration on one line
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
      width: '23%', // Creates four columns
      marginBottom: 12,
    },
    checkLabel: {
      fontSize: 14, // Slightly smaller for a tighter grid
      color: '#374151',
      marginLeft: 8,
      flexShrink: 1, // Allows text to wrap if needed
    }
  
});

export default TaskEventForm;
