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
import { X, Calendar as CalendarIcon, Users, ChevronDown, ChevronUp } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { getAvailableWeekStarts, formatDateRange } from '@/lib/dateUtils';

interface GlobalCycle {
  id: string;
  title?: string;
  cycle_label?: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface CycleSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any; // UserCycle data for editing
  createCustomTimeline?: (timelineData: {
    title: string;
    description?: string;
    start_date: string;
    end_date: string;
    timeline_type?: string;
  }) => Promise<any>;
  mode?: 'cycle' | 'timeline';
}

export function CycleSetupModal({ 
  visible, 
  onClose, 
  onSuccess, 
  initialData, 
  createCustomTimeline,
  mode = 'cycle' 
}: CycleSetupModalProps) {
  const [activeTab, setActiveTab] = useState<'custom' | 'global'>('custom');
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [timelineType, setTimelineType] = useState<'cycle' | 'project' | 'challenge' | 'custom'>('custom');
  const [weekStartDay, setWeekStartDay] = useState<'sunday' | 'monday'>('sunday');
  const [selectedWeekStart, setSelectedWeekStart] = useState('');
  const [customStartDate, setCustomStartDate] = useState(formatLocalDate(new Date()));
  const [customEndDate, setCustomEndDate] = useState(formatLocalDate(new Date(Date.now() + 84 * 24 * 60 * 60 * 1000)));
  const [showWeekDropdown, setShowWeekDropdown] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [globalCycles, setGlobalCycles] = useState<GlobalCycle[]>([]);
  const [selectedGlobalCycle, setSelectedGlobalCycle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingGlobal, setFetchingGlobal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalCycleSource, setOriginalCycleSource] = useState<'custom' | 'global'>('custom');

  const timelineTypeOptions = [
    { value: 'custom', label: 'Custom Timeline', description: 'Flexible timeline for any purpose' },
    { value: 'project', label: 'Project Timeline', description: 'Focused timeline for specific projects' },
    { value: 'challenge', label: 'Challenge Timeline', description: 'Timeline for personal challenges' },
    { value: 'cycle', label: 'Custom Cycle', description: 'Structured cycle with regular patterns' },
  ];

  // Generate available weeks based on current settings
  const availableWeeks = getAvailableWeekStarts(weekStartDay);

  useEffect(() => {
    if (visible) {
      // Check if we're in edit mode
      if (initialData) {
        console.log('=== Edit mode detected ===');
        console.log('initialData:', initialData);
        
        setIsEditMode(true);
        setOriginalCycleSource(initialData.source);
        setActiveTab(initialData.source);
        setCustomTitle(initialData.title || '');
        setCustomDescription(initialData.description || '');
        setTimelineType(initialData.timeline_type || 'custom');
        setWeekStartDay(initialData.week_start_day || 'sunday');
        setSelectedWeekStart(initialData.start_date || '');
        setCustomStartDate(initialData.start_date || formatLocalDate(new Date()));
        setCustomEndDate(initialData.end_date || formatLocalDate(new Date(Date.now() + 84 * 24 * 60 * 60 * 1000)));
        setSelectedGlobalCycle(initialData.global_cycle_id || null);
      } else {
        console.log('=== Create mode detected ===');
        setIsEditMode(false);
        setOriginalCycleSource('custom');
        setActiveTab('custom');
        setCustomTitle('');
        setCustomDescription('');
        setTimelineType('custom');
        setWeekStartDay('sunday');
        setSelectedWeekStart('');
        setCustomStartDate(formatLocalDate(new Date()));
        setCustomEndDate(formatLocalDate(new Date(Date.now() + 84 * 24 * 60 * 60 * 1000)));
        setSelectedGlobalCycle(null);
      }
    }
  }, [visible, initialData]);

  useEffect(() => {
    if (visible && activeTab === 'global') {
      fetchGlobalCycles();
    }
  }, [visible, activeTab]);

  useEffect(() => {
    // Auto-select first week when week start day changes
    if (availableWeeks.length > 0) {
      setSelectedWeekStart(availableWeeks[0].start);
    }
  }, [weekStartDay, availableWeeks]);

  const fetchGlobalCycles = async () => {
    setFetchingGlobal(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-global-cycles')
        .select('*')
        .eq('is_active', true)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setGlobalCycles(data || []);
      // Auto-select the latest active cycle if none is selected
if ((data && data.length > 0) && !selectedGlobalCycle) {
  setSelectedGlobalCycle(data[0].id);
}

    } catch (error) {
      console.error('Error fetching global cycles:', error);
      Alert.alert('Error', 'Failed to fetch global cycles');
    } finally {
      setFetchingGlobal(false);
    }
  };

    const handleSaveCustomCycle = async () => {
  // Validation based on mode
  if (mode === 'timeline') {
    if (!customTitle.trim()) {
      Alert.alert('Error', 'Please enter a timeline title');
      return;
    }
  } else if (!isEditMode && !selectedWeekStart) {
    Alert.alert('Error', 'Please select a start date');
    return;
  }

  setLoading(true);
  try {
    if (mode === 'timeline' && createCustomTimeline) {
      // Create custom timeline using the provided function
      await createCustomTimeline({
        title: customTitle.trim(),
        description: customDescription.trim() || undefined,
        start_date: customStartDate,
        end_date: customEndDate,
        timeline_type: timelineType,
      });
    } else {
      // Handle 12-week cycle creation/editing
      const supabase = getSupabaseClient();

      if (!isEditMode) {
        // CREATE new 12-week cycle via RPC
        const { error } = await supabase.rpc('ap_create_user_cycle', {
          p_source: 'custom',
          p_start_date: selectedWeekStart,
          p_end_date: null, // Will be calculated as start_date + 83 days
          p_title: (customTitle || '').trim() || null,
          p_week_start_day: weekStartDay,
          p_timeline_type: 'cycle',
        });
        if (error) throw error;
      } else {
        // Update existing cycle
        const { error } = await supabase
          .from('0008-ap-user-cycles')
          .update({
            title: (customTitle || '').trim() || null,
            week_start_day: weekStartDay,
            updated_at: new Date().toISOString(),
          })
          .eq('id', initialData.id);
        if (error) throw error;
      }
    }

    onSuccess();
    onClose();

    // Reset local form state
    setSelectedWeekStart('');
    setCustomTitle('');
    setCustomDescription('');
    setCustomStartDate(formatLocalDate(new Date()));
    setCustomEndDate(formatLocalDate(new Date(Date.now() + 84 * 24 * 60 * 60 * 1000)));
  } catch (err) {
    console.error('Error saving:', err);
    Alert.alert('Error', (err as Error).message || `Failed to save ${mode}`);
  } finally {
    setLoading(false);
  }
};

  const handleSyncToGlobal = async () => {
  if (!selectedGlobalCycle) {
    Alert.alert('Error', 'Please select a global cycle');
    return;
  }

  setLoading(true);
  try {
    const supabase = getSupabaseClient();

    // Are we switching source or picking a different global cycle?
    const sourceChanged = isEditMode && initialData && originalCycleSource !== 'global';
    const globalChanged = isEditMode && initialData && initialData.global_cycle_id !== selectedGlobalCycle;

    if (!isEditMode) {
      // CREATE new global-linked cycle via RPC
      const { error } = await supabase.rpc('ap_create_user_cycle', {
        p_source: 'global',
        p_global_cycle_id: selectedGlobalCycle,
        p_week_start_day: weekStartDay,
      });
      if (error) throw error;

// Verify which cycle is now active (debug + ensure parent sees it)
const { data: activeCycle } = await supabase
  .from('0008-ap-user-cycles')
  .select('id, source, global_cycle_id, status, created_at')
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
console.log('Active cycle after global sync:', activeCycle);
      
    } else if (sourceChanged || globalChanged) {
      // SWITCHING: create a fresh global-linked cycle (old one auto-completes)
      const { error } = await supabase.rpc('ap_create_user_cycle', {
        p_source: 'global',
        p_global_cycle_id: selectedGlobalCycle,
        p_week_start_day: weekStartDay,
      });
      if (error) throw error;
    } else {
      // Same global cycle, just metadata change → update in place
      const { error } = await supabase
        .from('0008-ap-user-cycles')
        .update({
          week_start_day: weekStartDay,
          updated_at: new Date().toISOString(),
        })
        .eq('id', initialData.id);
      if (error) throw error;
    }

    onSuccess();
    onClose();

    // Reset local state
    setSelectedGlobalCycle(null);
  } catch (err) {
    console.error('Error syncing to global cycle:', err);
    Alert.alert('Error', (err as Error).message || 'Failed to sync to global cycle');
  } finally {
    setLoading(false);
  }
};

  const getMarkedDates = () => {
    const marked: any = {};
    
    if (selectedDate) {
      marked[selectedDate] = {
        selected: true,
        selectedColor: isValidStartDay(selectedDate) ? '#16a34a' : '#dc2626',
      };
    }

    // Mark all Sundays and Mondays as selectable
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Mark days for current and next 3 months
    for (let monthOffset = 0; monthOffset < 4; monthOffset++) {
      const month = (currentMonth + monthOffset) % 12;
      const year = currentYear + Math.floor((currentMonth + monthOffset) / 12);
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      // Check if today is the target start day
      const currentDay = today.getDay();
      const targetDay = weekStartDay === 'sunday' ? 0 : 1;
      const includeToday = currentDay === targetDay;
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        
        // Generate next 8 weeks, including today if it's the target day
        for (let i = 0; i < 8; i++) {
          const dateString = date.toISOString().split('T')[0];
          
          if (i === 0 && includeToday) {
            if ((weekStartDay === 'sunday' && dayOfWeek === 0) || 
                (weekStartDay === 'monday' && dayOfWeek === 1)) {
              // Calculate days to the next occurrence of target day
              let daysToAdd = targetDay - currentDay;
              if (daysToAdd <= 0) {
                daysToAdd += 7; // Move to next week if target day has passed or is today
              }
              
              // Add additional weeks for subsequent options
              const weekOffset = includeToday ? i : i - 1;
              if (weekOffset > 0) {
                daysToAdd += weekOffset * 7;
              }
              
              marked[dateString] = {
                marked: true,
                dotColor: '#16a34a',
              };
            }
          }
        }
      }
    }

    return marked;
  };

  const renderCustomTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {mode === 'timeline' 
            ? (isEditMode ? 'Edit Custom Timeline' : 'Create Custom Timeline')
            : (isEditMode ? 'Edit Custom Cycle' : 'Custom Cycle')
          }
        </Text>
        <Text style={styles.sectionDescription}>
          {mode === 'timeline'
            ? 'Create a custom timeline with your own start and end dates'
            : (isEditMode 
                ? 'Update your cycle title and week start day preference'
                : 'Choose when your 12-week cycle begins and whether weeks start on Sunday or Monday')
          }
        </Text>
        
        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>
            {mode === 'timeline' ? 'Timeline Title *' : 'Cycle Title'}
          </Text>
          <TextInput
            style={styles.input}
            value={customTitle}
            onChangeText={setCustomTitle}
            placeholder={mode === 'timeline' 
              ? "e.g., Summer 2025 Project, Q2 Business Goals"
              : "Enter cycle title (optional)"
            }
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Description (for timelines) */}
        {mode === 'timeline' && (
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={customDescription}
              onChangeText={setCustomDescription}
              placeholder="Describe the purpose and focus of this timeline..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>
        )}

        {/* Timeline Type (for timelines) */}
        {mode === 'timeline' && (
          <View style={styles.field}>
            <Text style={styles.label}>Timeline Type</Text>
            <View style={styles.timelineTypeGrid}>
              {timelineTypeOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.timelineTypeOption,
                    timelineType === option.value && styles.selectedTimelineTypeOption
                  ]}
                  onPress={() => setTimelineType(option.value as any)}
                >
                  <Text style={[
                    styles.timelineTypeLabel,
                    timelineType === option.value && styles.selectedTimelineTypeLabel
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={[
                    styles.timelineTypeDescription,
                    timelineType === option.value && styles.selectedTimelineTypeDescription
                  ]}>
                    {option.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Date Selection (for timelines) */}
        {mode === 'timeline' && (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Start Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowStartCalendar(true)}
              >
                <Text style={styles.dateButtonText}>
                  {parseLocalDate(customStartDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>End Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowEndCalendar(true)}
              >
                <Text style={styles.dateButtonText}>
                  {parseLocalDate(customEndDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.durationInfo}>
              <Text style={styles.durationText}>
                Duration: {(() => {
                  const start = parseLocalDate(customStartDate);
                  const end = parseLocalDate(customEndDate);
                  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                  const weeks = Math.ceil(days / 7);
                  return `${days} days (${weeks} weeks)`;
                })()}
              </Text>
            </View>
          </>
        )}

        {/* Week Start Day Toggle */}
        <View style={styles.weekStartToggle}>
          <TouchableOpacity
            style={[
              styles.weekStartOption,
              weekStartDay === 'sunday' && styles.activeWeekStartOption
            ]}
            onPress={() => setWeekStartDay('sunday')}
          >
            <Text style={[
              styles.weekStartOptionText,
              weekStartDay === 'sunday' && styles.activeWeekStartOptionText
            ]}>
              Sunday
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.weekStartOption,
              weekStartDay === 'monday' && styles.activeWeekStartOption
            ]}
            onPress={() => setWeekStartDay('monday')}
          >
            <Text style={[
              styles.weekStartOptionText,
              weekStartDay === 'monday' && styles.activeWeekStartOptionText
            ]}>
              Monday
            </Text>
          </TouchableOpacity>
        </View>

        {/* Week Selection Dropdown */}
        {mode === 'cycle' && (
<View style={styles.field}>
  <Text style={styles.label}>Select Start Week</Text>
  <TouchableOpacity
    style={styles.dropdown}
    onPress={() => setShowWeekDropdown(!showWeekDropdown)}
  >
    <Text style={styles.dropdownText}>
      {selectedWeekStart 
        ? availableWeeks.find(w => w.start === selectedWeekStart)?.label || 'Select week...'
        : 'Select week...'
      }
    </Text>
    <Text style={styles.dropdownArrow}>{showWeekDropdown ? '▲' : '▼'}</Text>
  </TouchableOpacity>
  
  {showWeekDropdown && (
    <View style={styles.dropdownContent}>
      {availableWeeks.map((week) => (
        <TouchableOpacity
          key={week.start}
          style={[
            styles.dropdownOption,
            selectedWeekStart === week.start && styles.selectedDropdownOption
          ]}
          onPress={() => {
            setSelectedWeekStart(week.start);
            setShowWeekDropdown(false);
          }}
        >
          <Text style={[
            styles.dropdownOptionText,
            selectedWeekStart === week.start && styles.selectedDropdownOptionText
          ]}>
            {week.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )}
</View>
        )}

        {mode === 'cycle' && selectedWeekStart && !isEditMode && (
          <View style={styles.selectedWeekContainer}>
            <Text style={styles.selectedWeekText}>
              12-week cycle: {
                (() => {
                  const selectedWeek = availableWeeks.find(w => w.start === selectedWeekStart);
                  return selectedWeek ? selectedWeek.label : '';
                })()
              }
            </Text>
            <Text style={styles.weekStartInfo}>
              Weeks start on {weekStartDay === 'sunday' ? 'Sunday' : 'Monday'}
            </Text>
          </View>
        )}
        
      </View>

      <TouchableOpacity
        style={[
          styles.createButton,
          ((mode === 'cycle' && !selectedWeekStart && !isEditMode) || 
           (mode === 'timeline' && !customTitle.trim()) || 
           loading) && styles.createButtonDisabled
        ]}
        onPress={handleSaveCustomCycle}
        disabled={(mode === 'cycle' && !selectedWeekStart && !isEditMode) || 
                 (mode === 'timeline' && !customTitle.trim()) || 
                 loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <CalendarIcon size={20} color="#ffffff" />
            <Text style={styles.createButtonText}>
              {mode === 'timeline' 
                ? (isEditMode ? 'Update Timeline' : 'Create Timeline')
                : (isEditMode ? 'Update Cycle' : 'Create Custom Cycle')
              }
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Calendar Modals for Timeline Mode */}
      {mode === 'timeline' && (
        <>
          <Modal visible={showStartCalendar} transparent animationType="fade">
            <View style={styles.calendarOverlay}>
              <View style={styles.calendarContainer}>
                <View style={styles.calendarHeader}>
                  <Text style={styles.calendarTitle}>Select Start Date</Text>
                  <TouchableOpacity onPress={() => setShowStartCalendar(false)}>
                    <X size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                <RNCalendar
                  onDayPress={(day) => {
                    setCustomStartDate(day.dateString);
                    setShowStartCalendar(false);
                    
                    // Auto-adjust end date if it's before the new start date
                    const newStartDate = parseLocalDate(day.dateString);
                    const currentEndDate = parseLocalDate(customEndDate);
                    if (currentEndDate <= newStartDate) {
                      const newEndDate = new Date(newStartDate);
                      newEndDate.setDate(newEndDate.getDate() + 84); // 12 weeks default
                      setCustomEndDate(formatLocalDate(newEndDate));
                    }
                  }}
                  markedDates={{
                    [customStartDate]: {
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

          <Modal visible={showEndCalendar} transparent animationType="fade">
            <View style={styles.calendarOverlay}>
              <View style={styles.calendarContainer}>
                <View style={styles.calendarHeader}>
                  <Text style={styles.calendarTitle}>Select End Date</Text>
                  <TouchableOpacity onPress={() => setShowEndCalendar(false)}>
                    <X size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                <RNCalendar
                  onDayPress={(day) => {
                    // Validate that end date is after start date
                    const selectedEndDate = parseLocalDate(day.dateString);
                    const currentStartDate = parseLocalDate(customStartDate);
                    
                    if (selectedEndDate <= currentStartDate) {
                      Alert.alert('Invalid Date', 'End date must be after start date');
                      return;
                    }
                    
                    setCustomEndDate(day.dateString);
                    setShowEndCalendar(false);
                  }}
                  markedDates={{
                    [customEndDate]: {
                      selected: true,
                      selectedColor: '#0078d4'
                    },
                    [customStartDate]: {
                      marked: true,
                      dotColor: '#16a34a'
                    }
                  }}
                  minDate={customStartDate}
                  theme={{
                    selectedDayBackgroundColor: '#0078d4',
                    todayTextColor: '#0078d4',
                    arrowColor: '#0078d4',
                  }}
                />
              </View>
            </View>
          </Modal>
        </>
      )}
    </ScrollView>
  );

  const renderGlobalTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Community Cycles</Text>

                {fetchingGlobal ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0078d4" />
            <Text style={styles.loadingText}>Loading community cycles...</Text>
          </View>
        ) : globalCycles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No active community cycles available</Text>
          </View>
        ) : (
          <View style={styles.globalCyclesList}>
            {globalCycles.map((cycle) => (
              <TouchableOpacity
                key={cycle.id}
                style={[
                  styles.globalCycleCard,
                  selectedGlobalCycle === cycle.id && styles.selectedGlobalCycleCard,
                ]}
                onPress={() => {
                  if (isEditMode && originalCycleSource === 'global' && initialData?.global_cycle_id === cycle.id) {
                    // Already selected, just select it
                    setSelectedGlobalCycle(cycle.id);
                  } else if (isEditMode && originalCycleSource === 'global' && initialData?.global_cycle_id !== cycle.id) {
                    Alert.alert(
                      'Switch Global Cycle?',
                      'This will switch you to a different community cycle. Are you sure?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Switch', onPress: () => setSelectedGlobalCycle(cycle.id) }
                      ]
                    );
                  } else {
                    setSelectedGlobalCycle(cycle.id);
                  }
                }}
              >
                <View style={styles.globalCycleContent}>
                  <Text style={styles.globalCycleTitle}>
                    {cycle.title || cycle.cycle_label || 'Community Cycle'}
                  </Text>
                  <Text style={styles.globalCycleDates}>
                    {formatDateRange(cycle.start_date, cycle.end_date)}
                  </Text>
                  <Text style={styles.globalCycleDuration}>
                    12 weeks • {Math.ceil((new Date(cycle.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                  </Text>
                </View>
                {selectedGlobalCycle === cycle.id && (
                  <View style={styles.selectedIndicator}>
                    <Text style={styles.selectedIndicatorText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.createButton,
          (!selectedGlobalCycle || loading) && styles.createButtonDisabled
        ]}
        onPress={handleSyncToGlobal}
        disabled={!selectedGlobalCycle || loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <Users size={20} color="#ffffff" />
            <Text style={styles.createButtonText}>
              {isEditMode ? 'Update Community Sync' : 'Sync to Community'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {mode === 'timeline' 
              ? (isEditMode ? 'Edit Timeline' : 'Create Timeline')
              : (isEditMode ? 'Edit 12-Week Cycle' : 'Start 12-Week Cycle')
            }
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        {/* Tab Selector (only for cycle mode) */}
        {mode === 'cycle' && (
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'custom' && styles.activeTabButton,
            ]}
            onPress={() => {
  // Always switch immediately (works on web/mobile)
  setActiveTab('custom');

  // Optional note for logs—no blocking UI
  if (isEditMode && originalCycleSource !== 'custom') {
    console.log('Switched to Custom tab from Community while editing.');
  }
}}

          >
            <CalendarIcon size={16} color={activeTab === 'custom' ? '#ffffff' : '#6b7280'} />
            <Text style={[
              styles.tabButtonText,
              activeTab === 'custom' && styles.activeTabButtonText
            ]}>
              Custom Cycle
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'global' && styles.activeTabButton,
            ]}
            onPress={() => {
  // Always switch the tab immediately (works on web/mobile)
  setActiveTab('global');

  // Optional heads-up after switching; does not block the tab change
  if (isEditMode && originalCycleSource !== 'global') {
    console.log('Switched to Community tab from Custom while editing.');
  }
}}

          >
            <Users size={16} color={activeTab === 'global' ? '#ffffff' : '#6b7280'} />
            <Text style={[
              styles.tabButtonText,
              activeTab === 'global' && styles.activeTabButtonText
            ]}>
              Sync to Community
            </Text>
          </TouchableOpacity>
        </View>
        )}

        {/* Tab Content */}
        {mode === 'timeline' ? renderCustomTab() : (activeTab === 'custom' ? renderCustomTab() : renderGlobalTab())}
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
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    gap: 8,
  },
  activeTabButton: {
    backgroundColor: '#0078d4',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabButtonText: {
    color: '#ffffff',
  },
  disabledTabButton: {
    opacity: 0.5,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
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
  durationInfo: {
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0078d4',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0078d4',
    textAlign: 'center',
  },
  timelineTypeGrid: {
    gap: 12,
  },
  timelineTypeOption: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  selectedTimelineTypeOption: {
    borderColor: '#0078d4',
    backgroundColor: '#f0f9ff',
  },
  timelineTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  selectedTimelineTypeLabel: {
    color: '#0078d4',
  },
  timelineTypeDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  selectedTimelineTypeDescription: {
    color: '#0078d4',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 8,
  },
  weekStartToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
    marginBottom: 16,
  },
  weekStartOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeWeekStartOption: {
    backgroundColor: '#0078d4',
  },
  weekStartOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeWeekStartOptionText: {
    color: '#ffffff',
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
  dropdownArrow: {
    fontSize: 12,
    color: '#6b7280',
  },
  dropdownContent: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  selectedWeekContainer: {
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  selectedWeekText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#16a34a',
    textAlign: 'center',
    marginBottom: 4,
  },
  weekStartInfo: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  editInfoContainer: {
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#0078d4',
  },
  editInfoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0078d4',
    textAlign: 'center',
    marginBottom: 4,
  },
  editInfoSubtext: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0078d4',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  globalCyclesList: {
    gap: 12,
  },
  globalCycleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedGlobalCycleCard: {
    borderColor: '#0078d4',
    backgroundColor: '#f0f9ff',
  },
  globalCycleContent: {
    flex: 1,
  },
  globalCycleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  globalCycleDates: {
    fontSize: 14,
    color: '#0078d4',
    fontWeight: '500',
    marginBottom: 4,
  },
  globalCycleDuration: {
    fontSize: 12,
    color: '#6b7280',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0078d4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedIndicatorText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});