import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, Target, Calendar, Users, Plus, FileText, ChevronDown, ChevronUp, Clock } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { formatLocalDate, parseLocalDate, formatDateRange } from '@/lib/dateUtils';
import { Calendar as RNCalendar } from 'react-native-calendars';

interface Timeline {
  id: string;
  source: 'custom' | 'global';
  title?: string;
  start_date: string | null;
  end_date: string | null;
  timeline_type?: 'cycle' | 'project' | 'challenge' | 'custom';
}

interface Role {
  id: string;
  label: string;
  color?: string;
}

interface Domain {
  id: string;
  name: string;
}

interface CycleWeek {
  week_number: number;
  week_start: string;
  week_end: string;
}

interface CreateGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
  createTwelveWeekGoal: (goalData: {
    title: string;
    description?: string;
    weekly_target?: number;
    total_target?: number;
  }) => Promise<any>;
  createCustomGoal: (goalData: {
    title: string;
    description?: string;
    start_date?: string;
    end_date?: string;
  }, selectedTimeline?: { id: string; start_date?: string | null; end_date?: string | null }) => Promise<any>;
  selectedTimeline: Timeline | null;
}

const recurrenceOptions = [
  { value: 'daily', label: 'Daily' },
  { value: '6days', label: '6 days' },
  { value: '5days', label: '5 days' },
  { value: '4days', label: '4 days' },
  { value: '3days', label: '3 days' },
  { value: '2days', label: '2 days' },
  { value: '1day', label: '1 day' },
];

export function CreateGoalModal({ 
  visible, 
  onClose, 
  onSubmitSuccess, 
  createTwelveWeekGoal,
  createCustomGoal,
  selectedTimeline
}: CreateGoalModalProps) {
  // Determine goal type based on selected timeline
  const goalType = selectedTimeline?.source === 'global' || selectedTimeline?.timeline_type === 'cycle' ? '12week' : 'custom';
  
  const [formData, setFormData] = useState({
  title: '',
  description: '',
  selectedRoleIds: [] as string[],
  selectedDomainIds: [] as string[],
  selectedKeyRelationshipIds: [] as string[], 
  noteText: '',  
});

  // Data fetching states
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [allKeyRelationships, setAllKeyRelationships] = useState<{ id: string; name: string; role_id: string }[]>([]);
  const [roleKeyRelationships, setRoleKeyRelationships] = useState<{ parent_id: string; key_relationship_id: string }[]>([]);
  const [cycleWeeks, setCycleWeeks] = useState<CycleWeek[]>([]);
  const [currentCycle, setCurrentCycle] = useState<any>(null);
  const [availableCycles, setAvailableCycles] = useState<any[]>([]);

  // Sub-form states
  const [activeSubForm, setActiveSubForm] = useState<'none' | 'action' | 'idea'>('none');
  
  // Action form states
  const [actionTitle, setActionTitle] = useState('');
  const [selectedActionWeeks, setSelectedActionWeeks] = useState<number[]>([]);
  const [recurrenceType, setRecurrenceType] = useState('daily');
  const [actionNotes, setActionNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [showWeeksDropdown, setShowWeeksDropdown] = useState(false);
  const [showRecurrenceDropdown, setShowRecurrenceDropdown] = useState(false);

  // Idea form states
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaNotes, setIdeaNotes] = useState('');
  const [submittingIdea, setSubmittingIdea] = useState(false);

  // Main form states
  const [loading, setLoading] = useState(false);
  const [createdGoalId, setCreatedGoalId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      fetchData();
    }
  }, [visible]);

  const fetchData = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch current cycle
      const today = new Date().toISOString().split("T")[0];

const { data: cycles, error } = await supabase
  .from("0008-ap-global-cycles")
  .select("id, title, cycle_label, start_date, end_date, reflection_end, is_active, status")
  .gte("reflection_end", today)            // current + future
  .order("start_date", { ascending: true })
  .limit(3);                                // current + next 2

if (error) {
  console.error("Error fetching cycles:", error);
} else {
  setAvailableCycles(cycles || []);
  setCurrentCycle(cycles?.[0] || null);     // default to the first option
}

      // Fetch cycle weeks if we have a cycle
      if (cycleData) {
        const { data: weeksData } = await supabase
          .from('v_user_global_timeline_weeks')
          .select('week_number, week_start, week_end')
          .eq('timeline_id', cycleData.id)
          .order('week_number', { ascending: true });

        setCycleWeeks(weeksData || []);
      }

      // Fetch all roles
      const { data: rolesData } = await supabase
        .from('0008-ap-roles')
        .select('id, label, color')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('label');

      setAllRoles(rolesData || []);

          // Fetch role → key relationship mappings
      // ✅ Use universal KR join table instead
const { data: roleKRData, error: roleKRError } = await supabase
  .from('0008-ap-universal-key-relationships-join')
  .select('parent_id, key_relationship_id')
  .eq('parent_type', 'role');

      setRoleKeyRelationships(roleKRData || []);
  
      // Fetch all domains
      const { data: domainsData } = await supabase
        .from('0008-ap-domains')
        .select('id, name')
        .order('name');

      setAllDomains(domainsData || []);

            // Fetch all key relationships
      const { data: krData } = await supabase
        .from('0008-ap-key-relationships')
        .select('id, name, role_id')
        .eq('user_id', user.id);

      setAllKeyRelationships(krData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load form data');
    }
  };

  const resetForm = () => {
  setFormData({
    title: '',
    description: '',
    selectedRoleIds: [],
    selectedDomainIds: [],
    selectedKeyRelationshipIds: [], // ✅ added so KR's don't go undefined
    noteText: '',
  });
  setActiveSubForm('none');
  setCreatedGoalId(null);
  resetActionForm();
  resetIdeaForm();
};

  const resetActionForm = () => {
    setActionTitle('');
    setSelectedActionWeeks([]);
    setRecurrenceType('daily');
    setActionNotes('');
    setShowWeeksDropdown(false);
    setShowRecurrenceDropdown(false);
  };

  const resetIdeaForm = () => {
    setIdeaTitle('');
    setIdeaNotes('');
  };

  const validateMainForm = () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a goal title');
      return false;
    }
    return true;
  };

  const handleMultiSelect = (field: 'selectedRoleIds' | 'selectedDomainIds', id: string) => {
    setFormData(prev => {
      const currentSelection = prev[field] as string[];
      const newSelection = currentSelection.includes(id)
        ? currentSelection.filter(itemId => itemId !== id)
        : [...currentSelection, id];
      return { ...prev, [field]: newSelection };
    });
  };
  
  const handleWeekSelect = (weekNumber: number) => {
    setSelectedActionWeeks(prev => 
      prev.includes(weekNumber)
        ? prev.filter(w => w !== weekNumber)
        : [...prev, weekNumber]
    );
  };

  const getDatesForRecurrence = (startDate: string, endDate: string, recurrenceType: string): string[] => {
    const dates: string[] = [];
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.warn('Invalid dates provided to getDatesForRecurrence:', { startDate, endDate });
      return dates;
    }

    // Calculate how many days per week based on recurrence type
    const daysPerWeek =
      recurrenceType === 'daily' ? 7 : parseInt(recurrenceType.replace('days', '').replace('day', ''));

    // Generate dates for the week
    const current = new Date(start);
    let dayCount = 0;
    
    while (current <= end && dayCount < daysPerWeek) {
      dates.push(formatLocalDate(current));
      current.setDate(current.getDate() + 1);
      dayCount++;
    }
    
    return dates;
  };

  const handleCreateGoal = async () => {
  setLoading(true);

  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not found');

    let goalData;
    
    if (goalType === '12week') {
      // Create 12-week goal
      goalData = await createTwelveWeekGoal({
        title: formData.title,
        description: formData.description,
      });
    } else {
      // Create custom goal
      console.log("🚨 DEBUG handleCreateGoal selectedTimeline:", selectedTimeline);

      goalData = await createCustomGoal({
        title: formData.title,
        description: formData.description,
      }, selectedTimeline);

    }

    if (!goalData) throw new Error('Failed to create goal');

    setCreatedGoalId(goalData.id);

    // Insert role joins
    if (formData.selectedRoleIds?.length) {
      const roleJoins = formData.selectedRoleIds.map(roleId => ({
        parent_id: goalData.id,
        parent_type: goalType === '12week' ? 'goal' : 'custom_goal',
        role_id: roleId,
        user_id: user.id,
      }));
      const { error: roleError } = await supabase
        .from('0008-ap-universal-roles-join')
        .upsert(roleJoins, { onConflict: 'parent_id,parent_type,role_id' });
      if (roleError) throw roleError;
    }

    // Insert domain joins
    if (formData.selectedDomainIds?.length) {
      const domainJoins = formData.selectedDomainIds.map(domainId => ({
        parent_id: goalData.id,
        parent_type: goalType === '12week' ? 'goal' : 'custom_goal',
        domain_id: domainId,
        user_id: user.id,
      }));
      const { error: domainError } = await supabase
        .from('0008-ap-universal-domains-join')
        .upsert(domainJoins, { onConflict: 'parent_id,parent_type,domain_id' });
      if (domainError) throw domainError;
    }

    // Insert note if provided
    if (formData.noteText && formData.noteText.trim()) {
      const { data: newNote, error: noteError } = await supabase
        .from('0008-ap-notes')
        .insert({
          user_id: user.id,
          content: formData.noteText.trim(),
        })
        .select()
        .single();
      if (noteError) throw noteError;

      const { error: noteJoinError } = await supabase
        .from('0008-ap-universal-notes-join')
        .insert({
          parent_id: goalData.id,
          parent_type: goalType === '12week' ? 'goal' : 'custom_goal',
          note_id: newNote.id,
          user_id: user.id,
        });
      if (noteJoinError) throw noteJoinError;
    }
    
    // Insert key relationship joins
if (formData.selectedKeyRelationshipIds?.length) {
  const krJoins = formData.selectedKeyRelationshipIds.map(krId => ({
    parent_id: goalData.id,
    parent_type: goalType === '12week' ? 'goal' : 'custom_goal',
    key_relationship_id: krId,
    user_id: user.id,
  }));
  const { error: krError } = await supabase
    .from('0008-ap-universal-key-relationships-join')
    .upsert(krJoins, { onConflict: 'parent_id,parent_type,key_relationship_id' });
  if (krError) throw krError;
}

    Alert.alert('Success', 'Goal created successfully! You can now add actions and ideas.');

  } catch (error) {
    console.error('Error creating goal:', error);
    Alert.alert('Error', (error as Error).message || 'Failed to create goal');

  } finally {
    setLoading(false);
  }
};

  const handleCreateIdea = async () => {
  if (!createdGoalId) {
    Alert.alert('Error', 'Please create the goal first');
    return;
  }

  if (!ideaTitle.trim()) {
    Alert.alert('Error', 'Please enter an idea title');
    return;
  }

  setSubmittingIdea(true);
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not found');

    // 1. Create deposit idea (use actual schema fields: is_active, archived, follow_up)
    const { data: createdIdea, error: ideaError } = await supabase
      .from('0008-ap-deposit-ideas')
      .insert({
        user_id: user.id,
        user_cycle_id: currentCycle.id,
        title: ideaTitle.trim(),
        is_active: true,
        archived: false,
        follow_up: false,
      })
      .select()
      .single();

    if (ideaError) throw ideaError;

    // 2. Add notes if provided
    if (ideaNotes.trim()) {
      const { data: noteData, error: noteError } = await supabase
        .from('0008-ap-notes')
        .insert({
          user_id: user.id,
          content: ideaNotes.trim(),
        })
        .select()
        .single();

      if (noteError) throw noteError;

      await supabase
        .from('0008-ap-universal-notes-join')
        .insert({
          parent_id: createdIdea.id,
          parent_type: 'depositIdea',
          note_id: noteData.id,
          user_id: user.id,
        });
    }

    // 3. Link deposit idea → goal
    await supabase
      .from('0008-ap-universal-goals-join')
      .insert({
        parent_id: createdIdea.id,
        parent_type: 'depositIdea',
        twelve_wk_goal_id: createdGoalId,
        goal_type: 'twelve_wk_goal',
        user_id: user.id,
      });

    // 4. Link to roles
    if (formData.selectedRoleIds.length > 0) {
      const roleJoins = formData.selectedRoleIds.map(roleId => ({
        parent_id: createdIdea.id,
        parent_type: 'depositIdea',
        role_id: roleId,
        user_id: user.id,
      }));
      await supabase.from('0008-ap-universal-roles-join').insert(roleJoins);
    }

    // 5. Link to domains
    if (formData.selectedDomainIds.length > 0) {
      const domainJoins = formData.selectedDomainIds.map(domainId => ({
        parent_id: createdIdea.id,
        parent_type: 'depositIdea',
        domain_id: domainId,
        user_id: user.id,
      }));
      await supabase.from('0008-ap-universal-domains-join').insert(domainJoins);
    }

    Alert.alert('Success', 'Deposit idea created successfully!');
    resetIdeaForm();
    setActiveSubForm('none');

  } catch (error) {
    console.error('Error creating idea:', error);
    Alert.alert('Error', (error as Error).message || 'Failed to create idea');
  } finally {
    setSubmittingIdea(false);
  }
};

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFinish = () => {
    resetForm();
    onSubmitSuccess();
    onClose();
  };

  // Derive Key Relationships based on selected roles
  const filteredKeyRelationships = allKeyRelationships.filter(kr =>
      formData.selectedRoleIds.includes(kr.role_id) 
  );
  
  const renderMainForm = () => (
    <ScrollView style={styles.content}>
      <View style={styles.form}>
        {/* Timeline Context */}
        <View style={styles.field}>
          <Text style={styles.label}>Timeline</Text>
          <View style={styles.timelineInfo}>
            <Text style={styles.timelineTitle}>
              {selectedTimeline?.title || 'No Timeline Selected'}
            </Text>
            <Text style={styles.timelineSubtitle}>
              {selectedTimeline?.source === 'global' ? '12-Week Cycle' : 
               selectedTimeline?.timeline_type === 'cycle' ? 'Custom Cycle' :
               selectedTimeline?.timeline_type === 'project' ? 'Project Timeline' :
               selectedTimeline?.timeline_type === 'challenge' ? 'Challenge Timeline' :
               'Custom Timeline'}
            </Text>
            {selectedTimeline?.start_date && selectedTimeline?.end_date && (
              <Text style={styles.timelineDates}>
                {formatDateRange(selectedTimeline.start_date, selectedTimeline.end_date)}
              </Text>
            )}
          </View>
        </View>

{/* Global Cycle Picker */}
{availableCycles.length > 0 && (
  <View style={styles.field}>
    <Text style={styles.label}>Select Global Cycle</Text>
    <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8 }}>
      {availableCycles.map((c) => {
        const isSelected = currentCycle?.id === c.id;
        return (
          <TouchableOpacity
            key={c.id}
            onPress={() => setCurrentCycle(c)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: isSelected ? '#eef2ff' : '#ffffff',
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb'
            }}
          >
            <Text style={{ fontSize: 16, color: '#111827', fontWeight: isSelected ? '600' : '400' }}>
              {c.title} ({c.cycle_label}) — {c.start_date} → {c.end_date}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
)}
        
        {/* Goal Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Goal Title *</Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
            placeholder={goalType === '12week' 
              ? "This should be a Lagging Indicator, or something you aspire for within your timeline"
              : "Enter your custom goal title"
            }
            placeholderTextColor="#9ca3af"
            maxLength={100}
          />
        </View>

        {/* Goal Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
            placeholder={goalType === '12week'
              ? "Describe your goal and why it matters to you..."
              : "Describe your custom goal and timeline..."
            }
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            maxLength={500}
          />
        </View>

        {/* Wellness Domains */}
        <View style={styles.field}>
          <Text style={styles.label}>Wellness Domains</Text>
          <View style={styles.checkboxGrid}>
            {allDomains.map(domain => {
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

        {/* Active Roles */}
        <View style={styles.field}>
          <Text style={styles.label}>Active Roles</Text>
          <View style={styles.checkboxGrid}>
            {allRoles.map(role => {
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

       {/* Key Relationships (filtered by selected Roles) */}
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
            onPress={() =>
              setFormData(prev => ({
                ...prev,
                selectedKeyRelationshipIds: isSelected
                  ? prev.selectedKeyRelationshipIds.filter(kid => kid !== kr.id)
                  : [...prev.selectedKeyRelationshipIds, kr.id],
              }))
            }
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
        
        {/* Action Buttons */}
        <View style={styles.actionButtonsSection}>
          <TouchableOpacity
            style={[
              styles.createButton,
              (!formData.title.trim() || loading) && styles.createButtonDisabled
            ]}
            onPress={handleCreateGoal}
            disabled={!formData.title.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Target size={20} color="#ffffff" />
                <Text style={styles.createButtonText}>
                  Create {goalType === '12week' ? '12-Week' : 'Custom'} Goal
                </Text>
              </>
            )}
          </TouchableOpacity>

          {createdGoalId && (
            <View style={styles.subActionButtons}>
              <TouchableOpacity
                style={styles.subActionButton}
                onPress={() => setActiveSubForm('action')}
              >
                <Calendar size={20} color="#0078d4" />
                <Text style={styles.subActionButtonText}>Add Actions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.subActionButton}
                onPress={() => setActiveSubForm('idea')}
              >
                <FileText size={20} color="#0078d4" />
                <Text style={styles.subActionButtonText}>Add Ideas</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

    </ScrollView>
  );

  const renderActionForm = () => (
    <ScrollView style={styles.content}>
      <View style={styles.form}>
        <View style={styles.subFormHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setActiveSubForm('none')}
          >
            <Text style={styles.backButtonText}>← Back to Goal</Text>
          </TouchableOpacity>
          <Text style={styles.subFormTitle}>Add Leading Indicators (Actions)</Text>
        </View>

        {/* Action Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={actionTitle}
            onChangeText={setActionTitle}
            placeholder="Leading Indicators"
            placeholderTextColor="#9ca3af"
            maxLength={100}
          />
        </View>

        {/* Week Selection */}
        <View style={styles.field}>
          <Text style={styles.label}>Select Weeks *</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowWeeksDropdown(!showWeeksDropdown)}
          >
            <Text style={styles.dropdownText}>
              {selectedActionWeeks.length === 0 
                ? 'Select weeks...' 
                : `${selectedActionWeeks.length} week(s) selected`
              }
            </Text>
            {showWeeksDropdown ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </TouchableOpacity>
          
          {showWeeksDropdown && (
            <View style={styles.dropdownContent}>
              <View style={styles.weekGrid}>
                {cycleWeeks.map(week => {
                  const isSelected = selectedActionWeeks.includes(week.week_number);
                  return (
                    <TouchableOpacity
                      key={week.week_number}
                      style={[styles.weekOption, isSelected && styles.selectedWeekOption]}
                      onPress={() => handleWeekSelect(week.week_number)}
                    >
                      <Text style={[styles.weekOptionText, isSelected && styles.selectedWeekOptionText]}>
                        Week {week.week_number}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Recurrence Type */}
        <View style={styles.field}>
          <Text style={styles.label}>Frequency per Week *</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowRecurrenceDropdown(!showRecurrenceDropdown)}
          >
            <Text style={styles.dropdownText}>
              {recurrenceOptions.find(opt => opt.value === recurrenceType)?.label || 'Select frequency...'}
            </Text>
            {showRecurrenceDropdown ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
          </TouchableOpacity>
          
          {showRecurrenceDropdown && (
            <View style={styles.dropdownContent}>
              {recurrenceOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.dropdownOption, recurrenceType === option.value && styles.selectedDropdownOption]}
                  onPress={() => {
                    setRecurrenceType(option.value);
                    setShowRecurrenceDropdown(false);
                  }}
                >
                  <Text style={[
  styles.dropdownOptionText,
  recurrenceType === option.value && styles.selectedDropdownOptionText
]}>
  {option.label}
</Text>

                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Pre-filled Domains and Roles */}
        <View style={styles.field}>
          <Text style={styles.label}>Linked to Goal</Text>
          <View style={styles.prefilledTags}>
            {formData.selectedDomainIds.map(domainId => {
              const domain = allDomains.find(d => d.id === domainId);
              return domain ? (
                <View key={domain.id} style={[styles.tag, styles.domainTag]}>
                  <Text style={styles.tagText}>{domain.name}</Text>
                </View>
              ) : null;
            })}
            {formData.selectedRoleIds.map(roleId => {
              const role = allRoles.find(r => r.id === roleId);
              return role ? (
                <View key={role.id} style={[styles.tag, styles.roleTag]}>
                  <Text style={styles.tagText}>{role.label}</Text>
                </View>
              ) : null;
            })}
          </View>
        </View>

        {/* Action Notes */}
        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={actionNotes}
            onChangeText={setActionNotes}
            placeholder="Additional notes for these actions..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.createButton,
            (!actionTitle.trim() || selectedActionWeeks.length === 0 || submittingAction) && styles.createButtonDisabled
          ]}
          onPress={handleCreateAction}
          disabled={!actionTitle.trim() || selectedActionWeeks.length === 0 || submittingAction}
        >
          {submittingAction ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Calendar size={20} color="#ffffff" />
              <Text style={styles.createButtonText}>Create Action Tasks</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderIdeaForm = () => (
    <ScrollView style={styles.content}>
      <View style={styles.form}>
        <View style={styles.subFormHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setActiveSubForm('none')}
          >
            <Text style={styles.backButtonText}>← Back to Goal</Text>
          </TouchableOpacity>
          <Text style={styles.subFormTitle}>Add Deposit Ideas</Text>
        </View>

        {/* Idea Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={ideaTitle}
            onChangeText={setIdeaTitle}
            placeholder="Enter idea title..."
            placeholderTextColor="#9ca3af"
            maxLength={100}
          />
        </View>

        {/* Pre-filled Domains and Roles */}
        <View style={styles.field}>
          <Text style={styles.label}>Linked to Goal</Text>
          <View style={styles.prefilledTags}>
            {formData.selectedDomainIds.map(domainId => {
              const domain = allDomains.find(d => d.id === domainId);
              return domain ? (
                <View key={domain.id} style={[styles.tag, styles.domainTag]}>
                  <Text style={styles.tagText}>{domain.name}</Text>
                </View>
              ) : null;
            })}
            {formData.selectedRoleIds.map(roleId => {
              const role = allRoles.find(r => r.id === roleId);
              return role ? (
                <View key={role.id} style={[styles.tag, styles.roleTag]}>
                  <Text style={styles.tagText}>{role.label}</Text>
                </View>
              ) : null;
            })}
          </View>
        </View>

        {/* Idea Notes */}
        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={ideaNotes}
            onChangeText={setIdeaNotes}
            placeholder="Describe your idea in detail..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.createButton,
            (!ideaTitle.trim() || submittingIdea) && styles.createButtonDisabled
          ]}
          onPress={handleCreateIdea}
          disabled={!ideaTitle.trim() || submittingIdea}
        >
          {submittingIdea ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <FileText size={20} color="#ffffff" />
              <Text style={styles.createButtonText}>Create Deposit Idea</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeSubForm) {
      case 'action':
        return renderActionForm();
      case 'idea':
        return renderIdeaForm();
      default:
        return renderMainForm();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {activeSubForm === 'action' ? 'Add Actions' : 
             activeSubForm === 'idea' ? 'Add Ideas' : 
             'Create 12-Week Goal'}
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        {renderContent()}

        {createdGoalId && activeSubForm === 'none' && (
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.finishButton}
              onPress={handleFinish}
            >
              <Text style={styles.finishButtonText}>Finish</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
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
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  subFormHeader: {
    marginBottom: 24,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 14,
    color: '#0078d4',
    fontWeight: '500',
  },
  subFormTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
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
  dropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 16,
    color: '#1f2937',
  },
  dropdownContent: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
  },
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 8,
  },
  weekOption: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  selectedWeekOption: {
    backgroundColor: '#0078d4',
    borderColor: '#0078d4',
  },
  weekOptionText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  selectedWeekOptionText: {
    color: '#ffffff',
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedDropdownOption: {
    backgroundColor: '#f0f9ff',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#1f2937',
  },
  selectedDropdownOptionText: {
    color: '#0078d4',
    fontWeight: '600',
  },
  prefilledTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleTag: {
    backgroundColor: '#fce7f3',
    borderColor: '#f3e8ff',
  },
  domainTag: {
    backgroundColor: '#fed7aa',
    borderColor: '#fdba74',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#374151',
  },
  actionButtonsSection: {
    marginTop: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0078d4',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  createButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  subActionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  subActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#0078d4',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  subActionButtonText: {
    color: '#0078d4',
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  finishButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  goalTypeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  goalTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    gap: 8,
  },
  activeGoalTypeButton: {
    backgroundColor: '#0078d4',
  },
  goalTypeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeGoalTypeButtonText: {
    color: '#ffffff',
  },
  dateButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1f2937',
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
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
});