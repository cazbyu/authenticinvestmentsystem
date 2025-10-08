import { SupabaseClient } from '@supabase/supabase-js';
import { formatLocalDate } from '@/lib/dateUtils';
import { checkOccurrenceExists } from '@/lib/taskUtils';

interface CompletionResult {
  success: boolean;
  shouldRemoveFromUI: boolean;
  error?: string;
}

export async function handleActionCompletion(
  supabase: SupabaseClient,
  userId: string,
  actionId: string,
  dueDate: string,
  timeline?: { id: string; source: 'global' | 'custom' } | null,
  weeklyTarget?: number
): Promise<CompletionResult> {
  try {
    console.log('[handleActionCompletion] Starting completion:', {
      actionId,
      dueDate,
      timeline: timeline?.id,
      weeklyTarget
    });

    const occurrenceExists = await checkOccurrenceExists(supabase, actionId, dueDate);

    if (occurrenceExists) {
      console.log('[handleActionCompletion] Occurrence already exists for date:', dueDate);
      return { success: true, shouldRemoveFromUI: false };
    }

    const { data: parent, error: parentError } = await supabase
      .from('0008-ap-tasks')
      .select('id, title, user_global_timeline_id, custom_timeline_id')
      .eq('id', actionId)
      .single();

    if (parentError || !parent) {
      throw new Error('Parent task not found');
    }

    const occurrencePayload: any = {
      user_id: userId,
      title: parent.title,
      type: 'task',
      status: 'completed',
      due_date: dueDate,
      completed_at: new Date().toISOString(),
      parent_task_id: actionId,
      is_twelve_week_goal: !!(parent.user_global_timeline_id || (timeline?.source === 'global')),
    };

    if (parent.custom_timeline_id) {
      occurrencePayload.custom_timeline_id = parent.custom_timeline_id;
    } else if (parent.user_global_timeline_id) {
      occurrencePayload.user_global_timeline_id = parent.user_global_timeline_id;
    } else if (timeline) {
      if (timeline.source === 'custom') {
        occurrencePayload.custom_timeline_id = timeline.id;
      } else {
        occurrencePayload.user_global_timeline_id = timeline.id;
      }
    }

    const { data: occ, error: occErr } = await supabase
      .from('0008-ap-tasks')
      .insert(occurrencePayload)
      .select('id')
      .single();

    if (occErr) {
      if (occErr.code === '23505') {
        console.log('[handleActionCompletion] Duplicate occurrence prevented by database constraint');
        return { success: true, shouldRemoveFromUI: false };
      }
      throw occErr;
    }

    if (occ) {
      console.log('[handleActionCompletion] Copying universal joins for occurrence:', occ.id);

      const [rolesResult, domainsResult, goalsResult] = await Promise.all([
        supabase.rpc('ap_copy_universal_roles_to_task', {
          from_parent_id: actionId,
          to_task_id: occ.id,
        }),
        supabase.rpc('ap_copy_universal_domains_to_task', {
          from_parent_id: actionId,
          to_task_id: occ.id,
        }),
        supabase.rpc('ap_copy_universal_goals_to_task', {
          from_parent_id: actionId,
          to_task_id: occ.id,
        }),
      ]);

      if (rolesResult.error) console.error('[handleActionCompletion] Error copying roles:', rolesResult.error);
      if (domainsResult.error) console.error('[handleActionCompletion] Error copying domains:', domainsResult.error);
      if (goalsResult.error) console.error('[handleActionCompletion] Error copying goals:', goalsResult.error);

      console.log('[handleActionCompletion] Universal joins copied successfully', {
        roles: !rolesResult.error,
        domains: !domainsResult.error,
        goals: !goalsResult.error
      });
    }

    if (weeklyTarget && timeline) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + mondayOffset);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekStartStr = formatLocalDate(weekStart);
      const weekEndStr = formatLocalDate(weekEnd);

      const { data: completedCount, error: countError } = await supabase
        .from('0008-ap-tasks')
        .select('id', { count: 'exact' })
        .eq('parent_task_id', actionId)
        .eq('status', 'completed')
        .gte('due_date', weekStartStr)
        .lte('due_date', weekEndStr)
        .is('deleted_at', null);

      if (!countError && completedCount) {
        const currentCompletedCount = completedCount.length;
        console.log('[handleActionCompletion] Weekly progress:', {
          completed: currentCompletedCount,
          target: weeklyTarget,
          shouldRemove: currentCompletedCount >= weeklyTarget
        });

        if (currentCompletedCount >= weeklyTarget) {
          return { success: true, shouldRemoveFromUI: true };
        }
      }
    }

    return { success: true, shouldRemoveFromUI: false };
  } catch (error) {
    console.error('[handleActionCompletion] Error:', error);
    return {
      success: false,
      shouldRemoveFromUI: false,
      error: (error as Error).message || 'Failed to complete action'
    };
  }
}

export async function handleActionUncompletion(
  supabase: SupabaseClient,
  actionId: string,
  dueDate: string
): Promise<CompletionResult> {
  try {
    console.log('[handleActionUncompletion] Starting uncompletion:', {
      actionId,
      dueDate
    });

    const { error: deleteError } = await supabase
      .from('0008-ap-tasks')
      .delete()
      .eq('parent_task_id', actionId)
      .eq('due_date', dueDate)
      .eq('type', 'task');

    if (deleteError) {
      throw deleteError;
    }

    return { success: true, shouldRemoveFromUI: false };
  } catch (error) {
    console.error('[handleActionUncompletion] Error:', error);
    return {
      success: false,
      shouldRemoveFromUI: false,
      error: (error as Error).message || 'Failed to uncomplete action'
    };
  }
}
