interface RecurrenceRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  byday?: string[]; // ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
  until?: Date;
}

interface EventInstance {
  id: string;
  sourceId: string;
  date: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  is_all_day?: boolean;
  title: string;
  type: string;
  roleColor: string;
  [key: string]: any; // Allow other properties to pass through
}

const WEEKDAY_MAP = {
  'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
};

const WEEKDAY_NAMES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export function parseRRule(rruleString: string): RecurrenceRule | null {
  if (!rruleString || !rruleString.startsWith('RRULE:')) {
    return null;
  }

  const rule = rruleString.substring(6); // Remove 'RRULE:' prefix
  const parts = rule.split(';');
  const parsed: Partial<RecurrenceRule> = {
    interval: 1, // Default interval
  };

  for (const part of parts) {
    const [key, value] = part.split('=');
    
    switch (key) {
      case 'FREQ':
        if (['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(value)) {
          parsed.freq = value as RecurrenceRule['freq'];
        }
        break;
      case 'INTERVAL':
        const interval = parseInt(value, 10);
        if (!isNaN(interval) && interval > 0) {
          parsed.interval = interval;
        }
        break;
      case 'BYDAY':
        parsed.byday = value.split(',').filter(day => 
          Object.keys(WEEKDAY_MAP).includes(day)
        );
        break;
      case 'UNTIL':
        // Parse YYYYMMDD format
        if (value.length === 8) {
          const year = parseInt(value.substring(0, 4), 10);
          const month = parseInt(value.substring(4, 6), 10) - 1; // Month is 0-indexed
          const day = parseInt(value.substring(6, 8), 10);
          parsed.until = new Date(year, month, day);
        }
        break;
    }
  }

  if (!parsed.freq) {
    return null;
  }

  return parsed as RecurrenceRule;
}

export function expandRecurrence(
  event: any,
  startWindow: Date,
  endWindow: Date
): EventInstance[] {
  if (!event.recurrence_rule) {
    return [];
  }

  const rule = parseRRule(event.recurrence_rule);
  if (!rule) {
    return [];
  }

  const instances: EventInstance[] = [];
  const startDate = new Date(event.start_date);
  
  // If no BYDAY specified for weekly, use the weekday of the source event
  if (rule.freq === 'WEEKLY' && (!rule.byday || rule.byday.length === 0)) {
    rule.byday = [WEEKDAY_NAMES[startDate.getDay()]];
  }

  let currentDate = new Date(startDate);
  let iterationCount = 0;
  const maxIterations = 1000; // Safety limit

  while (currentDate <= endWindow && iterationCount < maxIterations) {
    iterationCount++;

    // Check if this occurrence is within our window
    if (currentDate >= startWindow && currentDate <= endWindow) {
      // Check UNTIL constraint
      if (!rule.until || currentDate <= rule.until) {
        // For weekly rules with BYDAY, check if current day matches
        if (rule.freq === 'WEEKLY' && rule.byday && rule.byday.length > 0) {
          const currentWeekday = WEEKDAY_NAMES[currentDate.getDay()];
          if (rule.byday.includes(currentWeekday)) {
            instances.push(createEventInstance(event, currentDate));
          }
        } else if (rule.freq !== 'WEEKLY' || !rule.byday) {
          // For non-weekly or weekly without BYDAY
          instances.push(createEventInstance(event, currentDate));
        }
      }
    }

    // Advance to next occurrence
    switch (rule.freq) {
      case 'DAILY':
        currentDate.setDate(currentDate.getDate() + rule.interval);
        break;
      case 'WEEKLY':
        if (rule.byday && rule.byday.length > 0) {
          // For weekly with BYDAY, we need to check each day of the week
          const nextOccurrence = getNextWeeklyOccurrence(currentDate, rule);
          if (nextOccurrence) {
            currentDate = nextOccurrence;
          } else {
            break; // No more occurrences
          }
        } else {
          currentDate.setDate(currentDate.getDate() + (7 * rule.interval));
        }
        break;
      case 'MONTHLY':
        currentDate.setMonth(currentDate.getMonth() + rule.interval);
        break;
      case 'YEARLY':
        currentDate.setFullYear(currentDate.getFullYear() + rule.interval);
        break;
    }

    // Safety check for infinite loops
    if (currentDate > rule.until && rule.until) {
      break;
    }
  }

  return instances;
}

function getNextWeeklyOccurrence(currentDate: Date, rule: RecurrenceRule): Date | null {
  if (!rule.byday || rule.byday.length === 0) {
    return null;
  }

  const current = new Date(currentDate);
  const currentWeekday = current.getDay();
  
  // Find next occurrence in the same week
  for (const dayCode of rule.byday) {
    const targetWeekday = WEEKDAY_MAP[dayCode];
    if (targetWeekday > currentWeekday) {
      const daysToAdd = targetWeekday - currentWeekday;
      const nextDate = new Date(current);
      nextDate.setDate(nextDate.getDate() + daysToAdd);
      return nextDate;
    }
  }

  // No more occurrences this week, move to next interval week
  const nextWeekStart = new Date(current);
  nextWeekStart.setDate(nextWeekStart.getDate() + (7 * rule.interval) - currentWeekday);
  
  // Find first occurrence in the next interval week
  const sortedDays = rule.byday
    .map(day => WEEKDAY_MAP[day])
    .sort((a, b) => a - b);
  
  if (sortedDays.length > 0) {
    nextWeekStart.setDate(nextWeekStart.getDate() + sortedDays[0]);
    return nextWeekStart;
  }

  return null;
}

function createEventInstance(event: any, occurrenceDate: Date): EventInstance {
  const dateString = toDateString(occurrenceDate);
  
  return {
    id: `${event.id}::${dateString}`,
    sourceId: event.id,
    date: dateString,
    start_date: dateString,
    end_date: event.end_date || dateString,
    start_time: event.start_time,
    end_time: event.end_time,
    is_all_day: event.is_all_day,
    title: event.title,
    type: event.type,
    roleColor: event.roleColor,
    // Pass through other properties
    ...event,
    // Override with instance-specific data
    due_date: dateString,
    is_recurring_instance: true,
    original_event: event,
  };
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getVisibleWindow(viewMode: 'daily' | 'weekly' | 'monthly', currentDate: Date): { start: Date; end: Date } {
  const start = new Date(currentDate);
  const end = new Date(currentDate);

  switch (viewMode) {
    case 'daily':
      // Same day
      break;
    case 'weekly':
      // Start of week (Sunday) to end of week (Saturday)
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      end.setDate(start.getDate() + 6);
      break;
    case 'monthly':
      // First of month minus 7 days to last of month plus 7 days
      start.setDate(1);
      start.setDate(start.getDate() - 7);
      end.setMonth(end.getMonth() + 1, 0); // Last day of current month
      end.setDate(end.getDate() + 7);
      break;
  }

  return { start, end };
}

export function expandEventsWithRecurrence(
  events: any[],
  viewMode: 'daily' | 'weekly' | 'monthly',
  currentDate: Date,
  selectedDate?: string
): any[] {
  const window = getVisibleWindow(viewMode, currentDate);
  const expandedEvents: any[] = [];
  const processedBaseEvents = new Set<string>();

  for (const event of events) {
    if (event.recurrence_rule) {
      // Expand recurring event
      const instances = expandRecurrence(event, window.start, window.end);
      expandedEvents.push(...instances);
      
      // Mark base event as processed to avoid duplication
      processedBaseEvents.add(event.id);
    } else {
      // Non-recurring event - include if it falls within the window
      const eventDate = new Date(event.start_date || event.due_date);
      if (eventDate >= window.start && eventDate <= window.end) {
        expandedEvents.push(event);
      }
    }
  }

  return expandedEvents;
}

export function expandEventsForDate(events: any[], date: string): any[] {
  const targetDate = new Date(date);
  const expandedEvents: any[] = [];
  const processedBaseEvents = new Set<string>();

  for (const event of events) {
    if (event.recurrence_rule) {
      // Expand recurring event for just this date
      const dayStart = new Date(targetDate);
      const dayEnd = new Date(targetDate);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const instances = expandRecurrence(event, dayStart, dayEnd);
      expandedEvents.push(...instances);
      
      processedBaseEvents.add(event.id);
    } else {
      // Non-recurring event - include if it matches the date
      const eventDate = event.start_date || event.due_date;
      if (eventDate === date) {
        expandedEvents.push(event);
      }
    }
  }

  return expandedEvents;
}