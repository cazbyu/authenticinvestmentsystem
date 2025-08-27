import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, WeekCalendar } from 'react-native-calendars';
import { Header } from '@/components/Header';
import { getSupabaseClient } from '@/lib/supabase';
import { Clock, Calendar as CalendarIcon, Users } from 'lucide-react-native';

interface CalendarTask {
  id: string;
  title: string;
  due_date?: string;
  start_time?: string;
  end_time?: string;
  is_urgent?: boolean;
  is_important?: boolean;
  status?: string;
  type?: string;
  is_authentic_deposit?: boolean;
  is_twelve_week_goal?: boolean;
  is_all_day?: boolean;
  roles?: Array<{id: string; label: string; color?: string}>;
  domains?: Array<{id: string; name: string}>;
  color?: string; // Primary role color for display
}

type CalendarView = 'month' | 'week' | 'day';

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentView, setCurrentView] = useState<CalendarView>('month');
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [markedDates, setMarkedDates] = useState({});

  useEffect(() => {
    fetchTasksAndEvents();
  }, []);

  useEffect(() => {
    prepareMarkedDates();
  }, [tasks, selectedDate]);

  const fetchTasksAndEvents = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all active tasks and events
      const { data: tasksData, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', user.id)
        .not('status', 'in', '(completed,cancelled)')
        .in('type', ['task', 'event']);

      if (tasksError) throw tasksError;

      if (!tasksData || tasksData.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const taskIds = tasksData.map(t => t.id);

      // Fetch related data including role colors
      const [
        { data: rolesData, error: rolesError },
        { data: domainsData, error: domainsError }
      ] = await Promise.all([
        supabase
          .from('0008-ap-universal-roles-join')
          .select('parent_id, role:0008-ap-roles(id, label, color)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-domains-join')
          .select('parent_id, domain:0008-ap-domains(id, name)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task')
      ]);

      if (rolesError) throw rolesError;
      if (domainsError) throw domainsError;

      // Transform tasks with role colors
      const transformedTasks: CalendarTask[] = tasksData.map(task => {
        const taskRoles = rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [];
        const taskDomains = domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [];
        
        // Use the first role's color as the primary color for the task
        const primaryColor = taskRoles.length > 0 ? taskRoles[0].color || '#0078d4' : '#0078d4';

        return {
          ...task,
          roles: taskRoles,
          domains: taskDomains,
          color: primaryColor,
        };
      }).filter(task => {
        // Only include tasks with valid due dates to prevent WeekCalendar errors
        return task.due_date && 
               typeof task.due_date === 'string' && 
               task.due_date.trim() !== '' &&
               !isNaN(new Date(task.due_date).getTime());
      });

      setTasks(transformedTasks);
    } catch (error) {
      console.error('Error fetching tasks and events:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const prepareMarkedDates = () => {
    const marked = {};

    // Add selected date
    marked[selectedDate] = {
      selected: true,
      selectedColor: '#0078d4',
      selectedTextColor: '#ffffff',
    };

    // Add tasks and events
    tasks.forEach(task => {
      // Ensure due_date exists and is valid before processing
      if (task.due_date && typeof task.due_date === 'string') {
        const taskDate = task.due_date.split('T')[0];
        if (taskDate && taskDate.length === 10) { // YYYY-MM-DD format
        if (marked[taskDate]) {
          // If date already marked, add dots
          if (!marked[taskDate].dots) {
            marked[taskDate].dots = [];
          }
          marked[taskDate].dots.push({
            color: task.color || '#0078d4',
            selectedDotColor: '#ffffff',
          });
        } else {
          // Create new marking
          marked[taskDate] = {
            dots: [{
              color: task.color || '#0078d4',
              selectedDotColor: '#ffffff',
            }],
          };
        }

        // Preserve selected state if this is the selected date
        if (taskDate === selectedDate) {
          marked[taskDate].selected = true;
          marked[taskDate].selectedColor = '#0078d4';
          marked[taskDate].selectedTextColor = '#ffffff';
        }
        }
      }
    });

    setMarkedDates(marked);
  };

  const onDayPress = (day: any) => {
    setSelectedDate(day.dateString);
    setCurrentView('day');
  };

  const getTasksForDate = (date: string) => {
    return tasks.filter(task => task.due_date?.split('T')[0] === date);
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPriorityColor = (task: CalendarTask) => {
    if (task.is_urgent && task.is_important) return '#ef4444'; // Red
    if (!task.is_urgent && task.is_important) return '#22c55e'; // Green
    if (task.is_urgent && !task.is_important) return '#eab308'; // Yellow
    return '#9ca3af'; // Gray
  };

  const renderViewSelector = () => (
    <View style={styles.viewSelector}>
      {(['month', 'week', 'day'] as CalendarView[]).map((view) => (
        <TouchableOpacity
          key={view}
          style={[
            styles.viewButton,
            currentView === view && styles.activeViewButton
          ]}
          onPress={() => setCurrentView(view)}
        >
          <Text style={[
            styles.viewButtonText,
            currentView === view && styles.activeViewButtonText
          ]}>
            {view.charAt(0).toUpperCase() + view.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderMonthView = () => (
    <Calendar
      onDayPress={onDayPress}
      markedDates={markedDates}
      markingType="multi-dot"
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
        disabledArrowColor: '#d1d5db',
        monthTextColor: '#0078d4',
        indicatorColor: '#0078d4',
        textDayFontWeight: '500',
        textMonthFontWeight: '600',
        textDayHeaderFontWeight: '500',
        textDayFontSize: 16,
        textMonthFontSize: 18,
        textDayHeaderFontSize: 14
      }}
    />
  );

  const renderWeekView = () => (
    <WeekCalendar
      date={selectedDate}
      onDayPress={onDayPress}
      markedDates={markedDates}
      markingType="multi-dot"
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
        disabledArrowColor: '#d1d5db',
        textDayFontWeight: '500',
        textDayHeaderFontWeight: '500',
        textDayFontSize: 16,
        textDayHeaderFontSize: 14
      }}
    />
  );

  const renderDayView = () => {
    const dayTasks = getTasksForDate(selectedDate);
    
    return (
      <View style={styles.dayView}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayHeaderText}>{formatDateHeader(selectedDate)}</Text>
          <Text style={styles.dayTaskCount}>
            {dayTasks.length} {dayTasks.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        <ScrollView 
          style={styles.dayTasksList}
        >
          {dayTasks.length === 0 ? (
            <View style={styles.emptyDay}>
              <CalendarIcon size={48} color="#d1d5db" />
              <Text style={styles.emptyDayText}>No tasks or events scheduled</Text>
            </View>
          ) : (
            dayTasks
              .sort((a, b) => {
                // Sort by time: all-day first, then by start time
                if (a.is_all_day && !b.is_all_day) return -1;
                if (!a.is_all_day && b.is_all_day) return 1;
                if (a.is_all_day && b.is_all_day) return 0;
                
                const aTime = a.start_time || a.due_date;
                const bTime = b.start_time || b.due_date;
                if (!aTime && !bTime) return 0;
                if (!aTime) return 1;
                if (!bTime) return -1;
                
                return new Date(aTime).getTime() - new Date(bTime).getTime();
              })
              .map(task => (
                <View 
                  key={task.id} 
                  style={[
                    styles.dayTaskItem,
                    { borderLeftColor: task.color || '#0078d4' }
                  ]}
                >
                  <View style={styles.taskTimeSection}>
                    {task.is_all_day ? (
                      <View style={styles.allDayBadge}>
                        <Text style={styles.allDayText}>All Day</Text>
                      </View>
                    ) : task.type === 'event' && task.start_time && task.end_time ? (
                      <View style={styles.timeRange}>
                        <Text style={styles.timeText}>{formatTime(task.start_time)}</Text>
                        <Text style={styles.timeSeparator}>-</Text>
                        <Text style={styles.timeText}>{formatTime(task.end_time)}</Text>
                      </View>
                    ) : task.start_time ? (
                      <View style={styles.singleTime}>
                        <Clock size={14} color="#6b7280" />
                        <Text style={styles.timeText}>{formatTime(task.start_time)}</Text>
                      </View>
                    ) : (
                      <View style={styles.singleTime}>
                        <Text style={styles.noTimeText}>No time set</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.taskContent}>
                    <Text style={styles.taskTitle} numberOfLines={2}>
                      {task.title}
                    </Text>
                    
                    <View style={styles.taskMeta}>
                      <View style={styles.taskType}>
                        <Text style={[
                          styles.taskTypeText,
                          { color: task.type === 'event' ? '#7c3aed' : '#0078d4' }
                        ]}>
                          {task.type?.toUpperCase()}
                        </Text>
                      </View>

                      {task.roles && task.roles.length > 0 && (
                        <View style={styles.roleIndicator}>
                          <Users size={12} color="#6b7280" />
                          <Text style={styles.roleText}>
                            {task.roles[0].label}
                            {task.roles.length > 1 && ` +${task.roles.length - 1}`}
                          </Text>
                        </View>
                      )}
                    </View>

                    {(task.is_urgent || task.is_important || task.is_authentic_deposit) && (
                      <View style={styles.taskFlags}>
                        {task.is_urgent && (
                          <View style={styles.flagBadge}>
                            <Text style={styles.flagText}>URGENT</Text>
                          </View>
                        )}
                        {task.is_important && (
                          <View style={[styles.flagBadge, styles.importantBadge]}>
                            <Text style={styles.flagText}>IMPORTANT</Text>
                          </View>
                        )}
                        {task.is_authentic_deposit && (
                          <View style={[styles.flagBadge, styles.authenticBadge]}>
                            <Text style={styles.flagText}>AUTHENTIC</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  <View 
                    style={[
                      styles.priorityIndicator,
                      { backgroundColor: getPriorityColor(task) }
                    ]}
                  />
                </View>
              ))
          )}
        </ScrollView>
      </View>
    );
  };

  const renderCalendarContent = () => {
    switch (currentView) {
      case 'month':
        return renderMonthView();
      case 'week':
        return renderWeekView();
      case 'day':
        return renderDayView();
      default:
        return renderMonthView();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Calendar View" />
      
      <View style={styles.content}>
        {renderViewSelector()}
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading calendar...</Text>
          </View>
        ) : (
          <View style={styles.calendarContainer}>
            {renderCalendarContent()}
          </View>
        )}

        {currentView !== 'day' && (
          <View style={styles.selectedDateContainer}>
            <Text style={styles.selectedDateLabel}>Selected Date:</Text>
            <Text style={styles.selectedDateText}>
              {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
            <TouchableOpacity 
              style={styles.viewDayButton}
              onPress={() => setCurrentView('day')}
            >
              <Text style={styles.viewDayButtonText}>View Day Details</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  viewSelector: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  viewButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeViewButton: {
    backgroundColor: '#0078d4',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeViewButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  calendarContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedDateContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedDateLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
  },
  selectedDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  viewDayButton: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewDayButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 16,
  },
  dayView: {
    flex: 1,
  },
  dayHeader: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  dayHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  dayTaskCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  dayTasksList: {
    flex: 1,
  },
  emptyDay: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyDayText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 12,
    textAlign: 'center',
  },
  dayTaskItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderLeftWidth: 4,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    position: 'relative',
  },
  taskTimeSection: {
    minWidth: 80,
    marginRight: 16,
    alignItems: 'flex-start',
  },
  allDayBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  allDayText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
  timeRange: {
    alignItems: 'center',
  },
  singleTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  timeSeparator: {
    fontSize: 12,
    color: '#9ca3af',
    marginVertical: 2,
  },
  noTimeText: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    lineHeight: 22,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  taskType: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  taskTypeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  roleIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roleText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  taskFlags: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  flagBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  importantBadge: {
    backgroundColor: '#dcfce7',
  },
  authenticBadge: {
    backgroundColor: '#dbeafe',
  },
  flagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.5,
  },
  priorityIndicator: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});