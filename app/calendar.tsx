import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, FlatList, Modal, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Header } from '@/components/Header';
import { TaskCard, Task } from '@/components/tasks/TaskCard';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { CalendarEventDisplay } from '@/components/calendar/CalendarEventDisplay';
import { getSupabaseClient } from '@/lib/supabase';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, Plus } from 'lucide-react-native';
import { expandEventsWithRecurrence, expandEventsForDate } from '@/lib/recurrenceUtils';
import { getVisibleWindow } from '@/lib/recurrenceUtils';

// Constants
const MINUTE_HEIGHT = 1.5;

const ymdLocal = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Ensure no duplicate instances when merging arrays (e.g., expanded events + "Anytime" tasks)
const uniqByIdAndDate = <T extends { id: string; start_date?: string; due_date?: string; occurrence_date?: string }>(arr: T[]) => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const dateKey = (item as any).occurrence_date || (item as any).date || item.start_date || item.due_date || '';
    const k = `${item.id}::${dateKey}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
};

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
  const [selectedDate, setSelectedDate] = useState(ymdLocal());
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [authenticScore, setAuthenticScore] = useState(0);
  const hoursScrollRef = React.useRef<ScrollView>(null);
  const [hoursViewportH, setHoursViewportH] = useState(0);
  const [hasScrolledToNow, setHasScrolledToNow] = useState(false);
  const [currentTimePosition, setCurrentTimePosition] = useState(0);
  const timeGridRef = useRef<View>(null);
  const [timeGridWidth, setTimeGridWidth] = useState(0);
  const [allDayHeight, setAllDayHeight] = useState(0);
  
  // Modal states
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Layout measurements for proper centering

  useEffect(() => {
    fetchTasksAndEvents();
    calculateAuthenticScore();
    
    // Set up current time tracking
    const updateCurrentTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      setCurrentTimePosition(totalMinutes * MINUTE_HEIGHT);
    };

    updateCurrentTime();
    const timeInterval = setInterval(updateCurrentTime, 60000); // Update every minute

    return () => clearInterval(timeInterval);
  }, []);

  // Auto-scroll to current time when viewing today in daily mode
  useEffect(() => {
    const isDaily = viewMode === 'daily';
    const isToday = selectedDate === ymdLocal();

    if (!isDaily || !isToday || hasScrolledToNow) return;
    if (!hoursScrollRef.current || hoursViewportH <= 0) return;

    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const currentTimeY = minutes * MINUTE_HEIGHT;
    const contentH = 24 * 60 * MINUTE_HEIGHT;

    let targetY = currentTimeY - hoursViewportH / 2;
    if (targetY < 0) targetY = 0;
    if (targetY > contentH - hoursViewportH) targetY = Math.max(0, contentH - hoursViewportH);

    const cancel = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        hoursScrollRef.current?.scrollTo({ y: targetY, animated: false });
        setHasScrolledToNow(true);
      });
    });

    return () => cancel && (cancel as any).done === false && (cancel as any).cancel?.();
  }, [viewMode, selectedDate, hoursViewportH, hasScrolledToNow]);

  useEffect(() => {
    setHasScrolledToNow(false);
  }, [viewMode, selectedDate]);

  const calculateTaskPoints = (task: any, roles: any[] = [], domains: any[] = []) => {
    let points = 0;
    if (roles && roles.length > 0) points += roles.length;
    if (domains && domains.length > 0) points += domains.length;
    if (task.is_authentic_deposit) points += 2;
    if (task.is_urgent && task.is_important) points += 1.5;
    else if (!task.is_urgent && task.is_important) points += 3;
    else if (task.is_urgent && !task.is_important) points += 1;
    else points += 0.5;
    if (task.is_twelve_week_goal) points += 2;
    return Math.round(points * 10) / 10;
  };

  const calculateAuthenticScore = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const score = await calculateAuthenticScore(supabase, user.id);
      setAuthenticScore(score);
    } catch (error) {
      console.error('Error calculating authentic score:', error);
    }
  };

  const fetchTasksAndEvents = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch tasks and events
      const { data: tasksData, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*, recurrence_rule')
        .eq('user_id', user.id)
        .not('status', 'in', '(completed,cancelled)')
        .in('type', ['task', 'event'])
        .or('due_date.not.is.null,start_date.not.is.null');

      if (tasksError) throw tasksError;

      if (!tasksData || tasksData.length === 0) {
        setTasks([]);
        setEvents([]);
        setLoading(false);
        return;
      }

      const taskIds = tasksData.map(t => t.id);

      // Fetch comprehensive task data
      const [
        { data: rolesData, error: rolesError },
        { data: domainsData, error: domainsError },
        { data: goalsData, error: goalsError },
        { data: notesData, error: notesError },
        { data: delegatesData, error: delegatesError },
        { data: keyRelationshipsData, error: keyRelationshipsError }
      ] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label, color)').in('parent_id', taskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-goals-join').select('parent_id, goal:0008-ap-goals-12wk(id, title)').in('parent_id', taskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-delegates-join').select('parent_id, delegate_id').in('parent_id', taskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', taskIds).eq('parent_type', 'task')
      ]);

      if (rolesError) throw rolesError;
      if (domainsError) throw domainsError;
      if (goalsError) throw goalsError;
      if (notesError) throw notesError;
      if (delegatesError) throw delegatesError;
      if (keyRelationshipsError) throw keyRelationshipsError;

      // Transform tasks with role colors
      const transformedTasks = tasksData.map(task => {
        const taskRoles = rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [];
        const primaryRole = taskRoles[0];
        
        return {
          ...task,
          roles: taskRoles,
          domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
          goals: goalsData?.filter(g => g.parent_id === task.id).map(g => g.goal).filter(Boolean) || [],
          keyRelationships: keyRelationshipsData?.filter(kr => kr.parent_id === task.id).map(kr => kr.key_relationship).filter(Boolean) || [],
          has_notes: notesData?.some(n => n.parent_id === task.id),
          has_delegates: delegatesData?.some(d => d.parent_id === task.id),
          has_attachments: false,
          roleColor: primaryRole?.color || '#0078d4',
        };
      });

      setTasks(transformedTasks);

      // Convert to calendar events
      const calendarEvents: CalendarEvent[] = transformedTasks.map(task => ({
        id: task.id,
        title: task.title,
        date: task.start_date || task.due_date!,
        time: task.start_time ? formatTime(task.start_time) : undefined,
        endTime: task.end_time ? formatTime(task.end_time) : undefined,
        type: task.type as 'task' | 'event',
        color: task.roleColor,
        isAllDay: task.is_all_day || task.is_anytime || (!task.start_time && !task.end_time),
      }));

      setEvents(calendarEvents);
    } catch (error) {
      console.error('Error fetching tasks and events:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;
      fetchTasksAndEvents();
      calculateAuthenticScore();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleTaskDoublePress = (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalVisible(true);
  };

  const handleUpdateTask = (task: Task) => {
    setEditingTask(task);
    setIsDetailModalVisible(false);
    setTimeout(() => setIsFormModalVisible(true), 100);
  };

  const handleDelegateTask = (task: Task) => {
    Alert.alert('Delegate', 'Delegation functionality coming soon!');
    setIsDetailModalVisible(false);
  };

  const handleCancelTask = async (task: Task) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ status: 'cancelled' })
        .eq('id', task.id);

      if (error) throw error;
      Alert.alert('Success', 'Task has been cancelled');
      setIsDetailModalVisible(false);
      fetchTasksAndEvents();
      calculateAuthenticScore();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleFormSubmitSuccess = () => {
    setIsFormModalVisible(false);
    setEditingTask(null);
    fetchTasksAndEvents();
    calculateAuthenticScore();
  };

  const handleFormClose = () => {
    setIsFormModalVisible(false);
    setEditingTask(null);
  };

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const formatDateForDisplay = (dateString: string) => {
    // Parse date-only strings (YYYY-MM-DD) as local dates to avoid timezone shifts
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return localDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getMarkedDates = () => {
    const marked: any = {};
    
    // Mark selected date
    marked[selectedDate] = {
      selected: true,
      selectedColor: '#0078d4',
    };

    // Mark dates with events (including recurring instances)
    const window = getVisibleWindow('monthly', currentDate);
    const expandedRecurring = expandEventsWithRecurrence(tasks, 'monthly', currentDate);
const { start, end } = getVisibleWindow('monthly', currentDate);
const anytimeMonthly = tasks.filter(t => {
  const d = t.start_date || t.due_date;
  return (t.type === 'task') &&
         d &&
         (d >= start && d <= end) &&
         (t.is_all_day || t.is_anytime || (!t.start_time && !t.end_time));
});
const expandedTasks = uniqByIdAndDate([...expandedRecurring, ...anytimeMonthly]);
    
    // Count events per date for proper dot display
    const eventCounts: Record<string, { count: number; color: string }> = {};
    
    expandedTasks.forEach(task => {
      const taskDate = task.start_date || task.due_date;
      if (taskDate) {
        if (!eventCounts[taskDate]) {
          eventCounts[taskDate] = { count: 0, color: task.roleColor };
        }
        eventCounts[taskDate].count++;
      }
    });
    
    // Apply marks based on event counts
    Object.entries(eventCounts).forEach(([date, { count, color }]) => {
      if (marked[date]) {
        marked[date] = {
          ...marked[date],
          marked: true,
          dotColor: color,
        };
      } else {
        marked[date] = {
          marked: true,
          dotColor: color,
        };
      }
    });

    return marked;
  };

  const getEventsForDate = (date: string) => {
    // Use the new recurrence expansion for the specific date
    const expandedEvents = expandEventsForDate(tasks, date);
    return expandedEvents.map(task => ({
      id: task.id,
      title: task.title,
      date: task.start_date || task.due_date,
      time: task.start_time ? formatTime(task.start_time) : undefined,
      endTime: task.end_time ? formatTime(task.end_time) : undefined,
      type: task.type as 'task' | 'event',
      color: task.roleColor,
      isAllDay: task.is_all_day || task.is_anytime || (!task.start_time && !task.end_time),
    }));
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

  // Overlap detection and column assignment algorithm
  const calculateEventLayout = (events: Task[]) => {
    if (events.length === 0) return [];

    // Sort events by start time
    const sortedEvents = [...events].sort((a, b) => {
      const aStart = getTimeInMinutes(a.start_time!);
      const bStart = getTimeInMinutes(b.start_time!);
      return aStart - bStart;
    });

    const eventsWithLayout = sortedEvents.map(event => ({
      ...event,
      startMinutes: getTimeInMinutes(event.start_time!),
      endMinutes: getTimeInMinutes(event.end_time!),
      column: 0,
      maxColumns: 1,
    }));

    // Assign columns using greedy algorithm
    const columns: number[] = []; // Track end time of last event in each column

    for (const event of eventsWithLayout) {
      // Find first available column
      let assignedColumn = -1;
      for (let i = 0; i < columns.length; i++) {
        if (columns[i] <= event.startMinutes) {
          assignedColumn = i;
          break;
        }
      }

      if (assignedColumn === -1) {
        // Create new column
        assignedColumn = columns.length;
        columns.push(event.endMinutes);
      } else {
        // Use existing column
        columns[assignedColumn] = event.endMinutes;
      }

      event.column = assignedColumn;
    }

    // Calculate max overlapping columns for each event
    for (const event of eventsWithLayout) {
      let maxOverlaps = 1;
      
      // Find all events that overlap with this event
      const overlappingEvents = eventsWithLayout.filter(other => 
        other !== event &&
        other.startMinutes < event.endMinutes &&
        other.endMinutes > event.startMinutes
      );

      // Include the current event in the count
      const allOverlappingEvents = [event, ...overlappingEvents];
      
      // Find the maximum column number among overlapping events + 1
      maxOverlaps = Math.max(...allOverlappingEvents.map(e => e.column)) + 1;
      
      event.maxColumns = maxOverlaps;
    }

    return eventsWithLayout;
  };

  // Helper function to convert time string to minutes from midnight
  const getTimeInMinutes = (timeString: string) => {
    const date = new Date(timeString);
    return date.getHours() * 60 + date.getMinutes();
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
    setSelectedDate(ymdLocal(newDate));
  };

  // Mini daily view used inside Weekly/Monthly: tasks/all-day on top, time grid below.
  const DailySlice: React.FC<{ date: string; height?: number; viewMode?: 'daily' | 'weekly' | 'monthly' }> =
({ date, height = 0.5, viewMode }) => {
    // Local ref/height for this embedded grid so it scrolls independently
    const sliceScrollRef = useRef<ScrollView>(null);
const [sliceViewportH, setSliceViewportH] = useState(0);
const [sliceHasScrolledToNow, setSliceHasScrolledToNow] = useState(false);


    // Constants consistent with main daily grid
    const HOUR_HEIGHT = 60 * MINUTE_HEIGHT;
    const COLUMN_GUTTER = 4;

    // Get expanded events for this specific date (includes recurring instances)
    const expandedTasks = expandEventsForDate(tasks, date);
    
    // All-day / untimed for the given date
    const allDayItems = expandedTasks.filter(task => 
      !task.start_time || !task.end_time || task.is_all_day
    );

    // Timed events for absolute positioning
    const timedEvents = expandedTasks.filter(task => 
      task.start_time && task.end_time && !task.is_all_day
    );

    const eventsWithLayout = calculateEventLayout(timedEvents);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <View style={{ flex: 1, minHeight: 240, height: `${height * 100}%` }}>
        {/* All-day header */}
        {allDayItems.length > 0 && (
          <View style={styles.allDaySection}>
            <Text style={styles.allDayLabel}>All Day</Text>
            <View style={styles.allDayEvents}>
              {uniqByIdAndDate(allDayItems).map((task, idx) => (
  <TaskCard
    key={`${task.id}-${task.start_date || task.due_date || date}-${task.type || 'task'}-${idx}`}
    task={task}
    onComplete={handleCompleteTask}
    onDoublePress={handleTaskDoublePress}
  />
))}

            </View>
          </View>
        )}

        {/* Time grid */}
        <ScrollView
          ref={sliceScrollRef}
          onLayout={(e) => setSliceViewportH(e.nativeEvent.layout.height)}
          style={styles.hoursScrollView}
          showsVerticalScrollIndicator
        >
          <View
            style={[styles.timeGrid, { height: 24 * HOUR_HEIGHT }]}
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;
              setTimeGridWidth(width - 70); // re-use same label width logic
            }}
          >
            {/* Hour markers */}
            {hours.map(hour => (
              <View key={hour} style={[styles.hourSlot, { height: HOUR_HEIGHT }]}>
                <Text style={styles.hourLabel}>
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </Text>
                <View style={styles.hourLine} />
                <View style={[styles.quarterHourLine, { top: HOUR_HEIGHT * 0.25 }]} />
                <View style={[styles.halfHourLine, { top: HOUR_HEIGHT * 0.5 }]} />
                <View style={[styles.quarterHourLine, { top: HOUR_HEIGHT * 0.75 }]} />
              </View>
            ))}

            {/* Timed events with overlap layout */}
            {eventsWithLayout.map((event, idx) => {
              const top = event.startMinutes * MINUTE_HEIGHT;
              const heightPx = Math.max((event.endMinutes - event.startMinutes) * MINUTE_HEIGHT, 30);
              const availableWidth = timeGridWidth > 0 ? timeGridWidth - 16 : 200;
              const colWidth = (availableWidth - (event.maxColumns - 1) * COLUMN_GUTTER) / event.maxColumns;
              const leftOffset = event.column * (colWidth + COLUMN_GUTTER);

              return (
                <CalendarEventDisplay
      key={`${event.id}-${event.start_time || ''}-${event.end_time || ''}-${date}-${event.type}-${idx}`}
      task={event}
      onDoublePress={handleTaskDoublePress}
                  style={{
                    position: 'absolute',
                    top,
                    height: heightPx,
                    left: 70 + leftOffset,
                    width: colWidth,
                    zIndex: 1,
                  }}
                />
              );
            })}

            {/* Optional: show now-line only if this slice is "today" */}
            {date === ymdLocal() && (
              <View style={[styles.currentTimeLine, { top: currentTimePosition }]}>
                <View style={styles.currentTimeDot} />
                <View style={styles.currentTimeLineBar} />
                <View style={styles.currentTimeLabel}>
                  <Text style={styles.currentTimeLabelText}>
                    {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderDailyView = () => {
    // Get expanded tasks for the selected date (includes recurring instances)
    // Expand events (recurring) AND include same-day "Anytime" tasks
const expandedEvents = expandEventsForDate(tasks, selectedDate);
const anytimeTasks = tasks.filter(t =>
  (t.type === 'task') &&
  (t.due_date === selectedDate) &&
  (t.is_all_day || t.is_anytime || (!t.start_time && !t.end_time))
);
const expandedTasks = uniqByIdAndDate([...expandedEvents, ...anytimeTasks]);
    
    // Constants for time grid layout
    const HOUR_HEIGHT = 60 * MINUTE_HEIGHT; // 90 pixels per hour
    const COLUMN_GUTTER = 4; // pixels between columns
    
    // Get events with specific times for absolute positioning
    const timedEvents = expandedTasks.filter(task => 
      task.start_time && task.end_time && !task.is_all_day
    );
    
    // Calculate layout for overlapping events
    const eventsWithLayout = calculateEventLayout(timedEvents);
    
    // Get all-day events and tasks without specific times
    const allDayItems = expandedTasks.filter(task => 
      !task.start_time || !task.end_time || task.is_all_day
    );

    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <View style={styles.dailyViewContainer}>
        <View style={styles.dailyHeader}>
          <TouchableOpacity onPress={() => navigateDate('prev')}>
            <ChevronLeft size={24} color="#0078d4" />
          </TouchableOpacity>
          <Text style={styles.dailyTitle}>
            {formatDateForDisplay(currentDate.toISOString().split('T')[0])}
          </Text>
          <TouchableOpacity onPress={() => navigateDate('next')}>
            <ChevronRight size={24} color="#0078d4" />
          </TouchableOpacity>
        </View>

        <View style={styles.dailyContent}>
          {/* All-day events and tasks without specific times */}
          {allDayItems.length > 0 && (
            <View 
              style={styles.allDaySection}
              onLayout={(event) => {
                const { height } = event.nativeEvent.layout;
                setAllDayHeight(height);
              }}
            >
              <Text style={styles.allDayLabel}>All Day</Text>
              <View style={styles.allDayEvents}>
                {allDayItems.map((task, idx) => (
  <TaskCard
    key={`${task.id}-${task.start_date || task.due_date || selectedDate}-${idx}`}
                    task={task}
                    onComplete={handleCompleteTask}
                    onDoublePress={handleTaskDoublePress}
                  />
                ))}
              </View>
            </View>
          )}
          
          {/* Time grid with hour slots */}
          <ScrollView
            ref={hoursScrollRef}
            onLayout={(e) => setHoursViewportH(e.nativeEvent.layout.height)}
            style={styles.hoursScrollView}
            showsVerticalScrollIndicator={true}
          >
            <View 
              ref={timeGridRef}
              style={[styles.timeGrid, { height: 24 * HOUR_HEIGHT }]}
              onLayout={(event) => {
                const { width } = event.nativeEvent.layout;
                setTimeGridWidth(width - 70); // Subtract hour label width
              }}
            >
              {/* Hour markers */}
              {hours.map(hour => (
                <View key={hour} style={[styles.hourSlot, { height: HOUR_HEIGHT }]}>
                  <Text style={styles.hourLabel}>
                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                  </Text>
                  <View style={styles.hourLine} />
                  
                  {/* 15-minute increment lines - more visible */}
                  <View style={[styles.quarterHourLine, { top: HOUR_HEIGHT * 0.25 }]} />
                  <View style={[styles.halfHourLine, { top: HOUR_HEIGHT * 0.5 }]} />
                  <View style={[styles.quarterHourLine, { top: HOUR_HEIGHT * 0.75 }]} />
                </View>
              ))}
              
              {/* Timed events with absolute positioning */}
              {eventsWithLayout.map((event, idx) => {
  const top = event.startMinutes * MINUTE_HEIGHT;
  const height = Math.max((event.endMinutes - event.startMinutes) * MINUTE_HEIGHT, 30); // Minimum 30px height
                
                // Calculate width and left position for overlapping events
                const availableWidth = timeGridWidth > 0 ? timeGridWidth - 16 : 200; // Fallback width
                const columnWidth = (availableWidth - (event.maxColumns - 1) * COLUMN_GUTTER) / event.maxColumns;
                const leftOffset = event.column * (columnWidth + COLUMN_GUTTER);
                
                return (
                  <CalendarEventDisplay
      key={`${event.id}-${event.start_time || ''}-${event.end_time || ''}-${selectedDate}-${idx}`}
      task={event}
      onDoublePress={handleTaskDoublePress}
                    style={{
                      position: 'absolute',
                      top,
                      height,
                      left: 70 + leftOffset, // Account for hour label width + column offset
                      width: columnWidth,
                      zIndex: 1,
                    }}
                  />
                );
              })}
              
              {/* Current time indicator - only show for today */}
              {selectedDate === ymdLocal() && (
                <View 
                  style={[
                    styles.currentTimeLine,
                    { top: currentTimePosition }
                  ]}
                >
                  <View style={styles.currentTimeDot} />
                  <View style={styles.currentTimeLineBar} />
                  <View style={styles.currentTimeLabel}>
                    <Text style={styles.currentTimeLabelText}>
                      {new Date().toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit', 
                        hour12: true 
                      })}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
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
            const dateString = ymdLocal(date);
            const expandedEvents = expandEventsForDate(tasks, dateString);
const anytimeTasks = tasks.filter(t =>
  (t.type === 'task') &&
  (t.due_date === dateString) &&
  (t.is_all_day || t.is_anytime || (!t.start_time && !t.end_time))
);
const expandedTasks = uniqByIdAndDate([...expandedEvents, ...anytimeTasks]);

const dayEvents = expandedTasks.map(task => ({

              id: task.id,
              title: task.title,
              date: task.start_date || task.due_date,
              time: task.start_time ? formatTime(task.start_time) : undefined,
              endTime: task.end_time ? formatTime(task.end_time) : undefined,
              type: task.type as 'task' | 'event',
              color: task.roleColor,
              isAllDay: task.is_all_day || task.is_anytime || (!task.start_time && !task.end_time),
            }));
            const isToday = dateString === ymdLocal();
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
                <View>
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
                  <View style={styles.weekDayEvents}>
                    {uniqByIdAndDate(dayEvents).slice(0, 3).map((event, idx) => (
  <View
    key={`${event.id}-${event.date}-${event.type}-${idx}`}
    style={[styles.weekEventDot, { backgroundColor: event.color }]}
  />
))}
                    {dayEvents.length > 3 && (
                      <Text style={styles.moreEventsText}>+{dayEvents.length - 3}</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected day details */}
        <View style={styles.selectedDayDetails}>
          <Text style={styles.selectedDayTitle}>
            {formatDateForDisplay(selectedDate)}
          </Text>
          {/* Bottom half: embedded daily slice for the selected day */}
          <DailySlice date={selectedDate} height={0.5} viewMode="weekly" />
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
            {formatDateForDisplay(selectedDate)}
          </Text>
          {/* Bottom half: embedded daily slice for the selected date */}
          <DailySlice date={selectedDate} height={0.5} viewMode="monthly" />
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (viewMode === 'weekly') {
      return renderWeeklyView();
    } else {
      return renderMonthlyView();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Calendar View" authenticScore={authenticScore} />
      
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

      {viewMode === 'daily' ? (
        <View style={styles.dailyViewContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading calendar...</Text>
            </View>
          ) : (
            renderDailyView()
          )}
        </View>
      ) : (
        <ScrollView style={styles.scrollViewBase} contentContainerStyle={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading calendar...</Text>
            </View>
          ) : (
            renderContent()
          )}
        </ScrollView>
      )}

      {/* Modals */}
      <TaskDetailModal
        visible={isDetailModalVisible}
        task={selectedTask}
        onClose={() => setIsDetailModalVisible(false)}
        onUpdate={handleUpdateTask}
        onDelegate={handleDelegateTask}
        onCancel={handleCancelTask}
      />

      <Modal visible={isFormModalVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode={editingTask ? "edit" : "create"}
          initialData={editingTask || undefined}
          onSubmitSuccess={handleFormSubmitSuccess}
          onClose={handleFormClose}
        />
      </Modal>

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setIsFormModalVisible(true)}
      >
        <Plus size={24} color="#ffffff" />
      </TouchableOpacity>
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
    minHeight: 320,
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
  dayEventsListScroll: {
    flex: 1,
  },
  dayEventsList: {
    flexGrow: 1,
  },
  
  // Daily View Styles
  dailyViewContainer: {
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
  allDaySection: {
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    padding: 12,
  },
  allDayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  allDayEvents: {
    gap: 8,
  },
  timeGrid: {
    position: 'relative',
    paddingLeft: 8,
  },
  hourSlot: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourLabel: {
    width: 60,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    paddingRight: 8,
    paddingTop: 4,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  hourLine: {
    position: 'absolute',
    left: 70,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  quarterHourLine: {
    position: 'absolute',
    left: 70,
    right: 0,
    height: 1,
    backgroundColor: '#e5e7eb',
    opacity: 0.8,
  },
  halfHourLine: {
    position: 'absolute',
    left: 70,
    right: 0,
    height: 1,
    backgroundColor: '#d1d5db',
    opacity: 0.9,
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
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
    flex: 1,
    minHeight: 320,
  },
  selectedDayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  selectedDayEventsScroll: {
    flex: 1,
  },
  selectedDayEvents: {
    flexGrow: 1,
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
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0078d4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  hoursScrollView: {
    flex: 1,
  },
  currentTimeLine: {
    position: 'absolute',
    left: 70,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
    marginRight: 4,
  },
  currentTimeLineBar: {
    flex: 1,
    height: 2,
    backgroundColor: '#dc2626',
    marginRight: 8,
  },
  currentTimeLabel: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  currentTimeLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#dc2626',
  },
});