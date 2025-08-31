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
import { Calendar } from 'react-native-calendars';
import { X, Calendar as CalendarIcon, Users } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

// Custom Day Component for minicalendar
const CustomDayComponent = ({ date, state, marking, onPress }) => {
  const isSelected = marking?.selected;
  const isToday = state === 'today';
  const isDisabled = state === 'disabled';
  
  return (
    <TouchableOpacity
      style={[
        styles.dayContainer,
        isSelected && styles.selectedDay,
      ]}
      onPress={() => onPress && onPress(date)}
      disabled={isDisabled}
    >
      <Text
        style={[
          styles.dayText,
          isSelected && styles.selectedDayText,
          isToday && !isSelected && styles.todayText,
          isDisabled && styles.disabledDayText,
        ]}
      >
        {date.day}
      </Text>
    </TouchableOpacity>
  );
};

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
  onCycleCreated: () => void;
  initialTab?: 'custom' | 'global';
}

export function CycleSetupModal({ visible, onClose, onCycleCreated, initialTab = 'custom' }: CycleSetupModalProps) {
  const [activeTab, setActiveTab] = useState<'custom' | 'global'>(initialTab);
  const [customTitle, setCustomTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [globalCycles, setGlobalCycles] = useState<GlobalCycle[]>([]);
  const [selectedGlobalCycle, setSelectedGlobalCycle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingGlobal, setFetchingGlobal] = useState(false);

  // Helper to ensure consistent local date parsing
  const toLocalDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // Creates a date in local timezone
  };

  useEffect(() => {
    if (visible && activeTab === 'global') {
      fetchGlobalCycles();
    }
  }, [visible, activeTab]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

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
    } catch (error) {
      console.error('Error fetching global cycles:', error);
      Alert.alert('Error', 'Failed to fetch global cycles');
    } finally {
      setFetchingGlobal(false);
    }
  };

  const isValidStartDay = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00'); // Parse as local date
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 1; // Sunday (0) or Monday (1)
  };

  const getDayName = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00'); // Parse as local date
    const dayOfWeek = date.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[dayOfWeek];
  };

  const formatSelectedDateForDisplay = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00'); // Parse as local date
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return `${start.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })} - ${end.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })}`;
  };

  const handleCreateCustomCycle = async () => {
    if (!selectedDate) {
      Alert.alert('Error', 'Please select a start date');
      return;
    }

    if (!isValidStartDay(selectedDate)) {
      Alert.alert('Error', 'Start date must be a Sunday or Monday');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      
      // Call the RPC function to create a custom user cycle
      const { data, error } = await supabase.rpc('ap_create_user_cycle', {
        p_source: 'custom',
        p_start_date: selectedDate,
        p_title: customTitle.trim() || null
      });

      if (error) throw error;

      Alert.alert('Success', 'Custom 12-week cycle created successfully!');
      onCycleCreated();
      onClose();
      
      // Reset form
      setSelectedDate('');
      setCustomTitle('');
    } catch (error) {
      console.error('Error creating custom cycle:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to create custom cycle');
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
      
      // Call the RPC function to sync to a global cycle
      const { data, error } = await supabase.rpc('ap_create_user_cycle', {
        p_source: 'global',
        p_global_cycle_id: selectedGlobalCycle
      });

      if (error) throw error;

      Alert.alert('Success', 'Successfully synced to community cycle!');
      onCycleCreated();
      onClose();
      
      // Reset form
      setSelectedGlobalCycle(null);
    } catch (error) {
      console.error('Error syncing to global cycle:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to sync to global cycle');
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
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        const dateString = date.toISOString().split('T')[0];
        
        if ((dayOfWeek === 0 || dayOfWeek === 1) && date >= today) {
          if (!marked[dateString]) {
            marked[dateString] = {
              marked: true,
              dotColor: '#0078d4',
            };
          }
        }
      }
    }

    return marked;
  };

  const renderCustomTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Custom Cycle Title (Optional)</Text>
        <TextInput
          style={styles.input}
          value={customTitle}
          onChangeText={setCustomTitle}
          placeholder="e.g., Q1 2025 Focus, Spring Goals..."
          placeholderTextColor="#9ca3af"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Start Date</Text>
        <Text style={styles.sectionDescription}>
          Your 12-week cycle must start on a Sunday or Monday
        </Text>
        
        {selectedDate && (
          <View style={[
            styles.selectedDateContainer,
            { backgroundColor: isValidStartDay(selectedDate) ? '#f0fdf4' : '#fef2f2' }
          ]}>
            <Text style={[ // Changed from `getDayName` to `formatSelectedDateForDisplay`
              styles.selectedDateText,
              { color: isValidStartDay(selectedDate) ? '#16a34a' : '#dc2626' }
            ]}>
              Selected: {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
            {!isValidStartDay(selectedDate) && (
              <Text style={styles.errorText}>
                Please select a Sunday or Monday
              </Text>
            )}
          </View>
        )}

        <Calendar
          dayComponent={CustomDayComponent}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={getMarkedDates()}
          minDate={new Date().toISOString().split('T')[0]}
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            textSectionTitleColor: '#6b7280',
            selectedDayBackgroundColor: '#0078d4',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#0078d4',
            dayTextColor: '#1f2937',
            textDisabledColor: '#d1d5db',
            dotColor: '#0078d4',
            selectedDotColor: '#ffffff',
            arrowColor: '#0078d4',
            monthTextColor: '#1f2937',
            textDayFontWeight: '500',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: 'bold',
            textDayFontSize: 10, // Smaller for minicalendar
            textMonthFontSize: 12,
            textDayHeaderFontSize: 8
          }}
        />
      </View>

      <TouchableOpacity
        style={[
          styles.createButton,
          (!selectedDate || !isValidStartDay(selectedDate) || loading) && styles.createButtonDisabled
        ]}
        onPress={handleCreateCustomCycle}
        disabled={!selectedDate || !isValidStartDay(selectedDate) || loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <CalendarIcon size={20} color="#ffffff" />
            <Text style={styles.createButtonText}>Create Custom Cycle</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderGlobalTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Community Cycles</Text>
        <Text style={styles.sectionDescription}>
          Sync your 12-week cycle with the community to stay aligned with others
        </Text>

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
                  selectedGlobalCycle === cycle.id && styles.selectedGlobalCycleCard
                ]}
                onPress={() => setSelectedGlobalCycle(cycle.id)}
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
            <Text style={styles.createButtonText}>Sync to Community</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Start 12-Week Cycle</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'custom' && styles.activeTabButton
            ]}
            onPress={() => setActiveTab('custom')}
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
              activeTab === 'global' && styles.activeTabButton
            ]}
            onPress={() => setActiveTab('global')}
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

        {/* Tab Content */}
        {activeTab === 'custom' ? renderCustomTab() : renderGlobalTab()}
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
  selectedDateContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedDateText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    fontStyle: 'italic',
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
  // CustomDayComponent styles for minicalendar
  dayContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 8,
    fontWeight: '500',
  },
  selectedDay: {
    backgroundColor: '#0078d4',
    borderRadius: 10,
    width: 20,
    height: 20,
  },
  selectedDayText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  todayText: {
    color: '#0078d4',
    fontWeight: 'bold',
  },
  disabledDayText: {
    color: '#d9e1e8',
  },
  
});