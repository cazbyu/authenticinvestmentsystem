import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Agenda } from 'react-native-calendars';
import { Header } from '@/components/Header';
import { getSupabaseClient } from '@/lib/supabase';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon } from 'lucide-react-native';

interface Task {
  id: string;
  title: string;
  due_date?: string;
  start_time?: string;
  end_time?: string;
  type: 'task' | 'event';
  is_all_day?: boolean;
  roles?: Array<{id: string; label: string; color?: string}>;
  roleColor?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  endTime?: string;
  type: 'task' | 'event';
  color: string;
  isAllDay?: boolean;
}

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTasksAndEvents();
  }, []);

  const fetchTasksAndEvents = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch tasks and events
      const { data: tasksData, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', user.id)
        .not('status', 'in', '(completed,cancelled)')
        .in('type', ['task', 'event'])
        .not('due_date', 'is', null);

      if (tasksError) throw tasksError;

      if (!tasksData || tasksData.length === 0) {
        setTasks([]);
        setEvents([]);
        setLoading(false);
        return;
      }

      const taskIds = tasksData.map(t => t.id);

      // Fetch role information for color coding
      const { data: rolesData, error: rolesError } = await supabase
        .from('0008-ap-universal-roles-join')
        .select('parent_id, role:0008-ap-roles(id, label, color)')
        .in('parent_id', taskIds)
        .eq('parent_type', 'task');

      if (rolesError) throw rolesError;

      // Transform tasks with role colors
      const transformedTasks = tasksData.map(task => {
        const taskRoles = rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [];
        const primaryRole = taskRoles[0];
        
        return {
          ...task,
          roles: taskRoles,
          roleColor: primaryRole?.color || '#0078d4',
        };
      });

      setTasks(transformedTasks);

      // Convert to calendar events
      const calendarEvents: CalendarEvent[] = transformedTasks.map(task => ({
        id: task.id,
        title: task.title,
        date: task.due_date!,
        time: task.start_time ? formatTime(task.start_time) : undefined,
        endTime: task.end_time ? formatTime(task.end_time) : undefined,
        type: task.type as 'task' | 'event',
        color: task.roleColor,
        isAllDay: task.is_all_day,
      }));

      setEvents(calendarEvents);
    } catch (error) {
      console.error('Error fetching tasks and events:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const getMarkedDates = () => {
    const marked: any = {};
    
    // Mark selected date
    marked[selectedDate] = {
      selected: true,
      selectedColor: '#0078d4',
    };

    // Mark dates with events
    events.forEach(event => {
      if (marked[event.date]) {
        marked[event.date] = {
          ...marked[event.date],
          marked: true,
          dotColor: event.color,
        };
      } else {
        marked[event.date] = {
          marked: true,
          dotColor: event.color,
        };
      }
    });

    return marked;
  };

  const getEventsForDate = (date: string) => {
    return events.filter(event => event.date === date);
  };

  const getWeekDates = (date: Date) => {
    const week = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);

    for (let i = 0; i < 7; i++) {
      const weekDate = new Date(startOfWeek);
      weekDate.setDate(startOfWeek.getDate() + i);
      week.push(weekDate);
    }
    return week;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    if (viewMode === 'daily') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'weekly') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    
    setCurrentDate(newDate);
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  const renderDailyView = () => {
    const dayEvents = getEventsForDate(selectedDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <View style={styles.dailyView}>
        <View style={styles.dailyHeader}>
          <TouchableOpacity onPress={() => navigateDate('prev')}>
            <ChevronLeft size={24} color="#0078d4" />
          </TouchableOpacity>
          <Text style={styles.dailyTitle}>
            {currentDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
          <TouchableOpacity onPress={() => navigateDate('next')}>
            <ChevronRight size={24} color="#0078d4" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.dailyContent}>
          {hours.map(hour => {
            const hourEvents = dayEvents.filter(event => {
              if (event.isAllDay) return hour === 0; // Show all-day events at top
              if (!event.time) return hour === 0; // Show tasks without time at top
              const eventHour = new Date(`2000-01-01 ${event.time}`).getHours();
              return eventHour === hour;
            });

            return (
              <View key={hour} style={styles.hourSlot}>
                <Text style={styles.hourLabel}>
                  {hour === 0 ? '12 AM' : hour <= 12 ? `${hour} AM` : `${hour - 12} PM`}
                </Text>
                <View style={styles.hourEvents}>
                  {hourEvents.map(event => (
                    <View 
                      key={event.id} 
                      style={[styles.eventItem, { borderLeftColor: event.color }]}
                    >
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                      {event.time && !event.isAllDay && (
                        <Text style={styles.eventTime}>
                          {event.time}{event.endTime ? ` - ${event.endTime}` : ''}
                        </Text>
                      )}
                      {event.isAllDay && (
                        <Text style={styles.eventTime}>All day</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderWeeklyView = () => {
    const weekDates = getWeekDates(currentDate);

    return (
      <View style={styles.weeklyView}>
        <View style={styles.weeklyHeader}>
          <TouchableOpacity onPress={() => navigateDate('prev')}>
            <ChevronLeft size={24} color="#0078d4" />
          </TouchableOpacity>
          <Text style={styles.weeklyTitle}>
            {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {' '}
            {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => navigateDate('next')}>
            <ChevronRight size={24} color="#0078d4" />
          </TouchableOpacity>
        </View>

        <View style={styles.weekGrid}>
          {weekDates.map((date, index) => {
            const dateString = date.toISOString().split('T')[0];
            const dayEvents = getEventsForDate(dateString);
            const isToday = dateString === new Date().toISOString().split('T')[0];
            const isSelected = dateString === selectedDate;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.weekDay,
                  isSelected && styles.selectedWeekDay,
                  isToday && styles.todayWeekDay
                ]}
                onPress={() => setSelectedDate(dateString)}
              >
                <Text style={[
                  styles.weekDayLabel,
                  isSelected && styles.selectedWeekDayLabel
                ]}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index]}
                </Text>
                <Text style={[
                  styles.weekDayNumber,
                  isSelected && styles.selectedWeekDayNumber,
                  isToday && styles.todayWeekDayNumber
                ]}>
                  {date.getDate()}
                </Text>
                
                <ScrollView style={styles.weekDayEvents}>
                  {dayEvents.slice(0, 3).map(event => (
                    <View 
                      key={event.id} 
                      style={[styles.weekEventDot, { backgroundColor: event.color }]}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <Text style={styles.moreEventsText}>+{dayEvents.length - 3}</Text>
                  )}
                </ScrollView>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected day details */}
        <View style={styles.selectedDayDetails}>
          <Text style={styles.selectedDayTitle}>
            {new Date(selectedDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
          <ScrollView style={styles.selectedDayEvents}>
            {getEventsForDate(selectedDate).map(event => (
              <View 
                key={event.id} 
                style={[styles.eventItem, { borderLeftColor: event.color }]}
              >
                <Text style={styles.eventTitle}>{event.title}</Text>
                {event.time && !event.isAllDay && (
                  <Text style={styles.eventTime}>
                    {event.time}{event.endTime ? ` - ${event.endTime}` : ''}
                  </Text>
                )}
                {event.isAllDay && (
                  <Text style={styles.eventTime}>All day</Text>
                )}
                <Text style={styles.eventType}>
                  {event.type === 'task' ? 'Task' : 'Event'}
                </Text>
              </View>
            ))}
            {getEventsForDate(selectedDate).length === 0 && (
              <Text style={styles.noEventsText}>No events for this day</Text>
            )}
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderMonthlyView = () => {
    return (
      <View style={styles.monthlyView}>
        <Calendar
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={getMarkedDates()}
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
        
        <View style={styles.selectedDateContainer}>
          <Text style={styles.selectedDateLabel}>
            {new Date(selectedDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
          
          <ScrollView style={styles.dayEventsList}>
            {getEventsForDate(selectedDate).map(event => (
              <View 
                key={event.id} 
                style={[styles.eventItem, { borderLeftColor: event.color }]}
              >
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <View style={[styles.eventTypeBadge, { backgroundColor: event.color }]}>
                    <Text style={styles.eventTypeBadgeText}>
                      {event.type === 'task' ? 'Task' : 'Event'}
                    </Text>
                  </View>
                </View>
                {event.time && !event.isAllDay && (
                  <View style={styles.eventTimeContainer}>
                    <Clock size={12} color="#6b7280" />
                    <Text style={styles.eventTime}>
                      {event.time}{event.endTime ? ` - ${event.endTime}` : ''}
                    </Text>
                  </View>
                )}
                {event.isAllDay && (
                  <View style={styles.eventTimeContainer}>
                    <CalendarIcon size={12} color="#6b7280" />
                    <Text style={styles.eventTime}>All day</Text>
                  </View>
                )}
              </View>
            ))}
            {getEventsForDate(selectedDate).length === 0 && (
              <Text style={styles.noEventsText}>No events for this day</Text>
            )}
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    switch (viewMode) {
      case 'daily':
        return renderDailyView();
      case 'weekly':
        return renderWeeklyView();
      case 'monthly':
      default:
        return renderMonthlyView();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Calendar View" />
      
      {/* View Mode Toggle */}
      <View style={styles.viewToggleContainer}>
        {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.viewToggleButton,
              viewMode === mode && styles.activeViewToggleButton
            ]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[
              styles.viewToggleText,
              viewMode === mode && styles.activeViewToggleText
            ]}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollViewBase} contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading calendar...</Text>
          </View>
        ) : (
          renderContent()
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollViewBase: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  viewToggleContainer: {
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
  viewToggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeViewToggleButton: {
    backgroundColor: '#0078d4',
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeViewToggleText: {
    color: '#ffffff',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 16,
  },
  
  // Monthly View Styles
  monthlyView: {
    flex: 1,
    padding: 16,
  },
  selectedDateContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedDateLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  dayEventsList: {
    maxHeight: 200,
  },
  
  // Daily View Styles
  dailyView: {
    flex: 1,
    padding: 16,
  },
  dailyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
  },
  dailyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  dailyContent: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  hourSlot: {
    flexDirection: 'row',
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  hourLabel: {
    width: 60,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    paddingRight: 8,
    paddingTop: 4,
  },
  hourEvents: {
    flex: 1,
    paddingLeft: 8,
    paddingVertical: 4,
  },
  
  // Weekly View Styles
  weeklyView: {
    flex: 1,
    padding: 16,
  },
  weeklyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
  },
  weeklyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  weekGrid: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    marginHorizontal: 2,
  },
  selectedWeekDay: {
    backgroundColor: '#0078d4',
  },
  todayWeekDay: {
    backgroundColor: '#f0f9ff',
  },
  weekDayLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  selectedWeekDayLabel: {
    color: '#ffffff',
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  selectedWeekDayNumber: {
    color: '#ffffff',
  },
  todayWeekDayNumber: {
    color: '#0078d4',
  },
  weekDayEvents: {
    alignItems: 'center',
    minHeight: 40,
  },
  weekEventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 2,
  },
  moreEventsText: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  selectedDayDetails: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
  },
  selectedDayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  selectedDayEvents: {
    maxHeight: 200,
  },
  
  // Event Item Styles
  eventItem: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 4,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  eventTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  eventTypeBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
  },
  eventTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  eventType: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '500',
    marginTop: 2,
  },
  noEventsText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
});