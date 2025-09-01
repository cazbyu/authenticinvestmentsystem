/**
 * Date utilities for handling local dates without timezone shifts
 */

/**
 * Formats a date as YYYY-MM-DD using local time (no UTC conversion)
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string as a local date (no timezone conversion)
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Gets the start of the week for a given date and week start preference
 */
export function getWeekStart(date: Date, weekStartDay: 'sunday' | 'monday' = 'sunday'): Date {
  const d = new Date(date);
  const currentDay = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const targetDay = weekStartDay === 'sunday' ? 0 : 1;
  
  let daysToSubtract = currentDay - targetDay;
  if (daysToSubtract < 0) {
    daysToSubtract += 7;
  }
  
  d.setDate(d.getDate() - daysToSubtract);
  return d;
}

/**
 * Gets the end of the week for a given date and week start preference
 */
export function getWeekEnd(date: Date, weekStartDay: 'sunday' | 'monday' = 'sunday'): Date {
  const weekStart = getWeekStart(date, weekStartDay);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return weekEnd;
}

/**
 * Generates week windows for a 12-week cycle
 */
export function generateCycleWeeks(
  startDate: string, 
  weekStartDay: 'sunday' | 'monday' = 'sunday'
): Array<{ week_number: number; start_date: string; end_date: string }> {
  const weeks = [];
  const cycleStart = parseLocalDate(startDate);
  
  // Ensure the cycle starts on the correct day of the week
  const alignedStart = getWeekStart(cycleStart, weekStartDay);
  
  for (let i = 0; i < 12; i++) {
    const weekStart = new Date(alignedStart);
    weekStart.setDate(alignedStart.getDate() + (i * 7));
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    weeks.push({
      week_number: i + 1,
      start_date: formatLocalDate(weekStart),
      end_date: formatLocalDate(weekEnd),
    });
  }
  
  return weeks;
}

/**
 * Formats a date range for display
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  
  if (start.getFullYear() === end.getFullYear()) {
    if (start.getMonth() === end.getMonth()) {
      // Same month: "31 Aug - 6 Sep"
      return `${start.getDate()} ${startMonth} - ${end.getDate()} ${endMonth}`;
    } else {
      // Different months, same year: "31 Aug - 6 Sep"
      return `${start.getDate()} ${startMonth} - ${end.getDate()} ${endMonth}`;
    }
  } else {
    // Different years: "31 Aug 2024 - 6 Sep 2025"
    return `${start.getDate()} ${startMonth} ${start.getFullYear()} - ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
  }
}

/**
 * Gets available week start options for the next 8 weeks
 */
export function getAvailableWeekStarts(weekStartDay: 'sunday' | 'monday' = 'sunday'): Array<{
  start: string;
  end: string;
  label: string;
}> {
  const weeks = [];
  const today = new Date();
  const currentDay = today.getDay();
  const targetDay = weekStartDay === 'sunday' ? 0 : 1;
  
  // Check if today is the target start day
  const includeToday = currentDay === targetDay;
  
  // Generate next 8 weeks
  for (let i = 0; i < 8; i++) {
    const weekStart = new Date(today);
    
    if (i === 0 && includeToday) {
      // Use today as the start date
      // weekStart is already today, no changes needed
    } else {
      // Calculate days to next occurrence of target day
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) {
        daysToAdd += 7; // Move to next week if target day has passed
      }
      
      // Add additional weeks for subsequent iterations
      if (includeToday) {
        daysToAdd += (i - 1) * 7; // Skip first iteration since we used today
      } else {
        daysToAdd += i * 7; // Add weeks normally
      }
      
      weekStart.setDate(weekStart.getDate() + daysToAdd);
    }
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 83); // 12 weeks = 84 days, minus 1 = 83
    
    const startStr = formatLocalDate(weekStart);
    const endStr = formatLocalDate(weekEnd);
    
    const label = formatDateRange(startStr, endStr);
    
    weeks.push({
      start: startStr,
      end: endStr,
      label
    });
  }
  
  return weeks;
}