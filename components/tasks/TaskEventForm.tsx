import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { supabase } from "@/lib/supabase";
import { X } from 'lucide-react-native';
import { Calendar } from 'react-native-calendars';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Complete the auth session
WebBrowser.maybeCompleteAuthSession();

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

// Google OAuth configuration
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // Replace with your actual client ID
const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'your-app-scheme', // Replace with your app scheme
});

// --- THE COMPONENT ---
const TaskEventForm: React.FC<TaskEventFormProps> = ({ mode, initialData, onSubmitSuccess, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    notes: '',
    dueDate: new Date(),
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
  
  // Google Calendar integration state
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [addToGoogleCalendar, setAddToGoogleCalendar] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  // Google OAuth request
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
    },
    {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    }
  );

  // Handle Google OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      setGoogleAccessToken(access_token);
      setIsConnectingGoogle(false);
      Alert.alert('Success', 'Connected to Google Calendar!');
    } else if (response?.type === 'error') {
      setIsConnectingGoogle(false);
      Alert.alert('Error', 'Failed to connect to Google Calendar');
    }
  }, [response]);

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

  const connectToGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      await promptAsync();
    } catch (error) {
      setIsConnectingGoogle(false);
      Alert.alert('Error', 'Failed to connect to Google Calendar');
    }
  };

  const pushToGoogleCalendar = async (taskData: any) => {
    if (!googleAccessToken) return;

    try {
      const startDateTime = new Date(formData.dueDate);
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration

      const event = {
        summary: formData.title,
        description: formData.notes,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error('Failed to create Google Calendar event');
      }

      Alert.alert('Success', 'Event added to Google Calendar!');
    } catch (error) {
      console.error('Error adding to Google Calendar:', error);
      Alert.alert('Error', 'Failed to add event to Google Calendar');
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

        // 3. Push to Google Calendar if enabled
        if (addToGoogleCalendar && googleAccessToken) {
          await pushToGoogleCalendar(taskData);
        }

        onSubmitSuccess();
        onClose();

    } catch (error) {
        console.error("Error creating task:", error);
        Alert.alert('Error', 'Failed to create task');
    } finally {
        setLoading(false);
    }
  };

  const onDayPress = (day: any) => {
    const selectedDate = new Date(day.dateString);
    setFormData(prev => ({ ...prev, dueDate: selectedDate }));
  };

  const filteredKeyRelationships = keyRelationships.filter(kr => formData.selectedRoleIds.includes(kr.role_id));

  // Format date for calendar marking
  const markedDates = {
    [formData.dueDate.toISOString().split('T')[0]]: {
      selected: true,
      selectedColor: '#0078d4',
    },
  };

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

            {/* Google Calendar Connection */}
            <View style={styles.googleSection}>
              {!googleAccessToken ? (
                <TouchableOpacity 
                  style={styles.googleConnectButton} 
                  onPress={connectToGoogle}
                  disabled={isConnectingGoogle}
                >
                  <Text style={styles.googleConnectButtonText}>
                    {isConnectingGoogle ? 'Connecting...' : 'Connect to Google Calendar'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.googleConnectedContainer}>
                  <Text style={styles.googleConnectedText}>✓ Connected to Google Calendar</Text>
                  <View style={styles.switchContainer}>
                    <Text>Add to Google Calendar</Text>
                    <Switch 
                      value={addToGoogleCalendar} 
                      onValueChange={setAddToGoogleCalendar} 
                    />
                  </View>
                </View>
              )}
            </View>

            {formData.schedulingType !== 'depositIdea' && (
              <>
                <View style={styles.switchContainer}>
                    <Text>Urgent</Text>
                    <Switch value={formData.is_urgent} onValueChange={(val) => setFormData(prev => ({...prev, is_urgent: val}))} />
                </View>
                <View style={styles.switchContainer}>
                    <Text>Important</Text>
                    <Switch value={formData.is_important} onValueChange={(val) => setFormData(prev => ({...prev, is_important: val}))} />
                </View>
                <View style={styles.switchContainer}>
                    <Text>Authentic Deposit</Text>
                    <Switch value={formData.is_authentic_deposit} onValueChange={(val) => setFormData(prev => ({...prev, is_authentic_deposit: val}))} />
                </View>
                <View style={styles.switchContainer}>
                    <Text>12-Week Goal</Text>
                    <Switch value={formData.is_twelve_week_goal} onValueChange={(val) => setFormData(prev => ({...prev, is_twelve_week_goal: val}))} />
                </View>
                
                {/* Calendar View */}
                <Text style={styles.sectionTitle}>Select Due Date</Text>
                <Calendar
                  onDayPress={onDayPress}
                  markedDates={markedDates}
                  theme={{
                    backgroundColor: '#ffffff',
                    calendarBackground: '#ffffff',
                    textSectionTitleColor: '#b6c1cd',
                    selectedDayBackgroundColor: '#0078d4',
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: '#0078d4',
                    dayTextColor: '#2d4150',
                    textDisabledColor: '#d9e1e8',
                    dotColor: '#00adf5',
                    selectedDotColor: '#ffffff',
                    arrowColor: '#0078d4',
                    disabledArrowColor: '#d9e1e8',
                    monthTextColor: '#0078d4',
                    indicatorColor: '#0078d4',
                    textDayFontWeight: '300',
                    textMonthFontWeight: 'bold',
                    textDayHeaderFontWeight: '300',
                    textDayFontSize: 16,
                    textMonthFontSize: 16,
                    textDayHeaderFontSize: 13
                  }}
                />
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
    switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
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
    googleSection: { marginBottom: 16 },
    googleConnectButton: { 
      backgroundColor: '#4285f4', 
      padding: 12, 
      borderRadius: 8, 
      alignItems: 'center' 
    },
    googleConnectButtonText: { 
      color: 'white', 
      fontSize: 16, 
      fontWeight: '600' 
    },
    googleConnectedContainer: { 
      backgroundColor: '#f0f9ff', 
      padding: 12, 
      borderRadius: 8, 
      borderWidth: 1, 
      borderColor: '#0078d4' 
    },
    googleConnectedText: { 
      color: '#0078d4', 
      fontSize: 14, 
      fontWeight: '600', 
      marginBottom: 8 
    },
});

export default TaskEventForm;