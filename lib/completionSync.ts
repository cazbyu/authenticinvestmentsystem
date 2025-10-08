import { SupabaseClient } from '@supabase/supabase-js';

export interface CompletionCountResult {
  taskId: string;
  completedCount: number;
  targetCount: number;
  completionDates: string[];
  isComplete: boolean;
}

export async function getWeeklyCompletionCount(
  supabase: SupabaseClient,
  taskId: string,
  weekStartDate: string,
  weekEndDate: string
): Promise<CompletionCountResult> {
  console.log('[completionSync] Calculating completion count:', {
    taskId,
    weekStartDate,
    weekEndDate
  });

  const { data: occurrences, error: occError } = await supabase
    .from('0008-ap-tasks')
    .select('id, due_date, completed_at')
    .eq('parent_task_id', taskId)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .gte('due_date', weekStartDate)
    .lte('due_date', weekEndDate)
    .order('due_date', { ascending: true });

  if (occError) {
    console.error('[completionSync] Error fetching occurrences:', occError);
    throw occError;
  }

  const completionDates = (occurrences || []).map(occ => occ.due_date);
  const completedCount = completionDates.length;

  console.log('[completionSync] Completion count calculated:', {
    taskId,
    completedCount,
    completionDates
  });

  return {
    taskId,
    completedCount,
    targetCount: 0,
    completionDates,
    isComplete: false
  };
}

export async function getWeeklyCompletionCountWithTarget(
  supabase: SupabaseClient,
  taskId: string,
  weekNumber: number,
  weekStartDate: string,
  weekEndDate: string,
  timeline: { id: string; source: 'global' | 'custom' }
): Promise<CompletionCountResult> {
  console.log('[completionSync] Calculating completion count with target:', {
    taskId,
    weekNumber,
    weekStartDate,
    weekEndDate,
    timeline
  });

  const countResult = await getWeeklyCompletionCount(
    supabase,
    taskId,
    weekStartDate,
    weekEndDate
  );

  const timelineField = timeline.source === 'global'
    ? 'user_global_timeline_id'
    : 'user_custom_timeline_id';

  const { data: weekPlan, error: planError } = await supabase
    .from('0008-ap-task-week-plan')
    .select('target_days')
    .eq('task_id', taskId)
    .eq('week_number', weekNumber)
    .eq(timelineField, timeline.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (planError) {
    console.error('[completionSync] Error fetching week plan:', planError);
    throw planError;
  }

  const targetCount = weekPlan?.target_days || 0;
  const isComplete = countResult.completedCount >= targetCount;

  const result: CompletionCountResult = {
    ...countResult,
    targetCount,
    isComplete
  };

  console.log('[completionSync] Completion count with target calculated:', result);

  return result;
}

export interface CompletionEvent {
  type: 'completed' | 'uncompleted' | 'week_progress_updated';
  taskId: string;
  goalId?: string;
  weekNumber?: number;
  date?: string;
  completionCount?: CompletionCountResult;
  timestamp: number;
}

class CompletionEventEmitter {
  private listeners: Map<string, Set<(event: CompletionEvent) => void>> = new Map();

  subscribe(eventType: string, callback: (event: CompletionEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const callbacks = this.listeners.get(eventType)!;
    callbacks.add(callback);

    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  emit(event: CompletionEvent): void {
    console.log('[completionSync] Emitting event:', event.type, {
      taskId: event.taskId,
      goalId: event.goalId,
      weekNumber: event.weekNumber
    });

    const allCallbacks = this.listeners.get('*') || new Set();
    const typeCallbacks = this.listeners.get(event.type) || new Set();

    const allListeners = [...allCallbacks, ...typeCallbacks];

    allListeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[completionSync] Error in event listener:', error);
      }
    });
  }

  subscribeToAll(callback: (event: CompletionEvent) => void): () => void {
    return this.subscribe('*', callback);
  }
}

export const completionEvents = new CompletionEventEmitter();

export async function syncCompletionAcrossViews(
  supabase: SupabaseClient,
  taskId: string,
  goalId: string | undefined,
  weekNumber: number,
  weekStartDate: string,
  weekEndDate: string,
  timeline: { id: string; source: 'global' | 'custom' },
  completed: boolean
): Promise<void> {
  console.log('[completionSync] Syncing completion across views:', {
    taskId,
    goalId,
    weekNumber,
    completed
  });

  const countResult = await getWeeklyCompletionCountWithTarget(
    supabase,
    taskId,
    weekNumber,
    weekStartDate,
    weekEndDate,
    timeline
  );

  const event: CompletionEvent = {
    type: completed ? 'completed' : 'uncompleted',
    taskId,
    goalId,
    weekNumber,
    timestamp: Date.now(),
    completionCount: countResult
  };

  completionEvents.emit(event);

  if (countResult.completedCount !== countResult.targetCount) {
    const progressEvent: CompletionEvent = {
      type: 'week_progress_updated',
      taskId,
      goalId,
      weekNumber,
      timestamp: Date.now(),
      completionCount: countResult
    };

    completionEvents.emit(progressEvent);
  }
}
