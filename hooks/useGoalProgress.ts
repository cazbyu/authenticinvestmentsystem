      const supabase = getSupabaseClient();

      const weekNumber = getCurrentWeekNumber();
      const currentDateISO = formatLocalDate(new Date());

      const wk = cycleWeeks.find(w => w.week_number === weekNumber);
      if (!wk) return [];
      const weekStartISO = wk.week_start;
      const weekEndISO = wk.week_end;

      // Get task plans for this week with conditional FK
      let planQuery = supabase
        .from('0008-ap-task-week-plan')
        .select('task_id, target_days')
        .eq('week_number', weekNumber);

      // Apply conditional timeline FK filter
      if (selectedTimeline.source === 'global') {
        planQuery = planQuery.eq('user_global_timeline_id', selectedTimeline.id);
      } else {
        planQuery = planQuery.eq('user_custom_timeline_id', selectedTimeline.id);
      }

      const { data: planned, error: planErr } = await planQuery;
      if (planErr) throw planErr;

      const parentIds = (planned ?? []).map(p => p.task_id);
      if (parentIds.length === 0) return [];

      // fetch completed task occurrences for this week
      const { data: weekOcc, error: occErr } = await supabase
        .from('0008-ap-tasks')
        .select('parent_task_id, due_date')
        .in('parent_task_id', parentIds)
        .gte('due_date', weekStartISO)
        .lte('due_date', weekEndISO)
        .eq('status', 'completed');

      if (occErr) throw occErr;

      const completedByParent: Record<string, number> = {};
      for (const row of weekOcc ?? []) {
        completedByParent[row.parent_task_id] =
          (completedByParent[row.parent_task_id] ?? 0) + 1;
      }

      const out: Array<{
        suggested: true;
        parent_task_id: string;
        timeline_id: string;
        timeline_source: 'global' | 'custom';
        date: string;
        remainingThisWeek: number;
      }> = [];

      for (const p of planned ?? []) {
        const actual = completedByParent[p.task_id] ?? 0;
        const remaining = (p.target_days ?? 0) - actual;
        if (remaining > 0) {
          out.push({
            suggested: true as const,
            parent_task_id: p.task_id,
            timeline_id: selectedTimeline.id,
            timeline_source: selectedTimeline.source,
            date: currentDateISO,
            remainingThisWeek: remaining,
          });
        }
      }

      return out;
    } catch (e) {
      console.error('Error computing today suggestions:', e);
      return [];
    }
  };

  const toggleTaskDay = async (taskId: string, date: string): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.rpc('ap_toggle_task_day', {
        p_task_id: taskId,
        p_date: date
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error toggling task day:', error);
      throw error;
    }
  };

  const completeActionSuggestion = async ({
    parentTaskId,
    whenISO,
  }: {
    parentTaskId: string;
    whenISO: string;
  }): Promise<string> => {
    const supabase = getSupabaseClient();

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user || !selectedTimeline) throw new Error('Missing user or selected timeline');

    const { data: parent, error: pErr } = await supabase
      .from('0008-ap-tasks')
      .select('id, title')
      .eq('id', parentTaskId)
      .single();
    if (pErr || !parent) throw pErr ?? new Error('Parent task not found');

    // Create occurrence with conditional timeline FK
    const occurrencePayload: any = {
      user_id: user.id,
      title: parent.title,
      type: 'task',
      status: 'completed',
      due_date: whenISO,
      completed_at: new Date().toISOString(),
      parent_task_id: parentTaskId,
      is_twelve_week_goal: selectedTimeline.source === 'global',
      // Only set custom_timeline_id for custom timelines
      ...(selectedTimeline.source === 'custom' ? { custom_timeline_id: selectedTimeline.id } : {}),
    };

    const { data: occ, error: oErr } = await supabase
      .from('0008-ap-tasks')
      .insert(occurrencePayload)
      .select('id')
      .single();
    if (oErr || !occ) throw oErr ?? new Error('Failed to insert occurrence');

    const occId = occ.id as string;

    // Copy universal joins from parent task
    await Promise.all([
      supabase.rpc('ap_copy_universal_roles_to_task', {
        from_parent_id: parentTaskId,
        to_task_id: occId,
      }),
      supabase.rpc('ap_copy_universal_domains_to_task', {
        from_parent_id: parentTaskId,
        to_task_id: occId,
      }),
      supabase.rpc('ap_copy_universal_goals_to_task', {
        from_parent_id: parentTaskId,
        to_task_id: occId,
      }),
    ]);

    return occId;
  };

  const undoActionOccurrence = async ({
    parentTaskId,
    whenISO,
  }: {
    parentTaskId: string;
    whenISO: string;
  }): Promise<number> => {
    const supabase = getSupabaseClient();

    const { error, count } = await supabase
      .from('0008-ap-tasks')
      .delete({ count: 'exact' })
      .eq('parent_task_id', parentTaskId)
      .eq('due_date', whenISO)
      .eq('status', 'completed');

    if (error) throw error;
    return typeof count === 'number' ? count : 0;
  };

  /* --------------------------------
   * WEEK UTILITIES (progress-specific)
   * -------------------------------- */
  const getCurrentWeekNumber = () => {
    if (!cycleWeeks || cycleWeeks.length === 0) return null;

    const now = new Date();
    const currentDateString = formatLocalDate(now);

    const currentWeekData = cycleWeeks.find(
      week =>
        week.week_start &&
        week.week_end &&
        currentDateString >= week.week_start &&
        currentDateString <= week.week_end
    );

    if (currentWeekData) return currentWeekData.week_number;

    const lastWeek = cycleWeeks[cycleWeeks.length - 1];
    if (currentDateString > lastWeek.week_end) return lastWeek.week_number;

    const firstWeek = cycleWeeks[0];
    if (currentDateString < firstWeek.week_start) return firstWeek.week_number;

    return 1;
  };

  const getCurrentWeekIndex = (): number => {
    const n = getCurrentWeekNumber();
    return typeof n === 'number' && !Number.isNaN(n) ? Math.max(0, n - 1) : 0;
  };

  const getWeekData = (weekIndex: number): WeekData | null => {
    const weekNumber = weekIndex + 1;
    const weekData = cycleWeeks.find(w => w.week_number === weekNumber);
    if (!weekData) return null;

    return {
      weekNumber,
      startDate: weekData.week_start,
      endDate: weekData.week_end,
    };
  };

  const getWeekDateRange = (weekNumber: number): { start: string; end: string } | null => {
    const weekData = cycleWeeks.find(w => w.week_number === weekNumber);
    return weekData ? { start: weekData.week_start, end: weekData.week_end } : null;
  };

  /* --------------------------------
   * REFRESH ORCHESTRATION (progress-specific)
   * -------------------------------- */
  const refreshAllData = async () => {
    try {
      const timeline = await fetchAvailableTimelines();
      console.log('Timeline returned from fetchAvailableTimelines:', timeline);

      if (!timeline) {
        console.log('No active timeline found, clearing all data');
        setCycleWeeks([]);
        setDaysLeftData(null);
        setGoals([]);
        setGoalProgress({});
        setCycleEffortData({ totalActual: 0, totalTarget: 0, overallPercentage: 0 });
        return;
      }

      console.log('Using timeline ID for data fetching:', timeline.id);

      const [weeks, daysLeft] = await Promise.all([
        fetchCycleWeeks(timeline),
        fetchDaysLeftData(timeline)
      ]);

      console.log('Fetched weeks:', weeks?.length || 0);
      console.log('Fetched days left data:', daysLeft);

      await fetchGoalsForTimeline(timeline);
    } catch (error) {
      console.error('Error refreshing all data:', error);
    }
  };

  const refreshGoals = async () => {
    if (selectedTimeline) {
      await fetchGoalsForTimeline(selectedTimeline);
    } else {
      // Also refresh the useGoals data
      await refreshGoalsFromUseGoals();
    }
  };

  /* --------------------------------
   * Effects
   * -------------------------------- */
  useEffect(() => {
    refreshAllData();
  }, [options.scope]);

  useEffect(() => {
    if (!selectedTimeline) return;

    const updateDaysLeft = () => {
      fetchDaysLeftData(selectedTimeline);
    };

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    const midnightTimeout = setTimeout(() => {
      updateDaysLeft();
      const dailyInterval = setInterval(updateDaysLeft, 24 * 60 * 60 * 1000);
      return () => clearInterval(dailyInterval);
    }, msUntilMidnight);

    return () => clearTimeout(midnightTimeout);
  }, [selectedTimeline]);

  /* --------------------------------
   * Return API - PROGRESS + ANALYTICS ONLY
   * -------------------------------- */
  return {
    // State
    goals,
    selectedTimeline,
    availableTimelines,
    setSelectedTimeline,
    cycleWeeks,
    daysLeftData,
    goalProgress,
    cycleEffortData,
    loading,
    loadingWeekActions,
    setLoadingWeekActions,

    // Data refresh
    refreshGoals,
    refreshAllData,

    // Timeline & week utilities
    fetchTasksAndPlansForWeek,
    fetchGoalActionsForWeek,
    getCurrentWeekNumber,
    getCurrentWeekIndex,
    getWeekData,
    getWeekDateRange,

    // Action execution
    toggleTaskDay,
    completeActionSuggestion,
    undoActionOccurrence,
    getTodayActionSuggestions,

    // CRUD operations (imported from useGoals)
    createTwelveWeekGoal,
    createCustomGoal,
    createTaskWithWeekPlan,
    deleteTask,

    // Week actions state
    weekGoalActions,
    setWeekGoalActions,
  };
}