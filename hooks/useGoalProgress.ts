status='completed')
   * Returns the number of rows deleted.
   */
  const undoActionOccurrence = async ({
    parentTaskId,
    whenISO,   // 'YYYY-MM-DD'
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

    if (error) {
      throw error;
    }

    // count can be null depending on PostgREST settings; normalize to number
    const deletedCount = typeof count === 'number' ? count : 0;
    return deletedCount;
  };

  const createTwelveWeekGoal = async (goalData: {
    title: string;
    description?: string;
    weekly_target?: number;
    total_target?: number;
  }): Promise<UnifiedGoal | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedTimeline) return null;

      const { data, error } = await supabase
        .from('0008-ap-goals-12wk')
        .insert({
          user_id: user.id,
          user_cycle_id: selectedTimeline.id,
          title: goalData.title,
          description: goalData.description,
          weekly_target: goalData.weekly_target || 3,
          total_target: goalData.total_target || 36,
          status: 'active',
          progress: 0,
          start_date: selectedTimeline.start_date,
          end_date: selectedTimeline.end_date,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Refresh goals to include the new one
      await fetchGoals(selectedTimeline);
      
      return { ...data, goal_type: 'twelve_wk_goal' };
    } catch (error) {
      console.error('Error creating 12-week goal:', error);
      throw error;
    }
  };

  const createCustomGoal = async (goalData: {
    title: string;
    description?: string;
  }): Promise<UnifiedGoal | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedTimeline) return null;
      
      const { data, error } = await supabase
        .from('0008-ap-goals-custom')
        .insert({
          user_id: user.id,
          custom_timeline_id: selectedTimeline.id,
          title: goalData.title,
          description: goalData.description,
          start_date: selectedTimeline.start_date,
          end_date: selectedTimeline.end_date,
          status: 'active',
          progress: 0,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Refresh goals to include the new one
      await fetchGoals(selectedTimeline);
      
      return { ...data, goal_type: 'custom_goal', weekly_target: 3, total_target: 36 };
    } catch (error) {
      console.error('Error creating custom goal:', error);
      throw error;
    }
  };

  const createTaskWithWeekPlan = async (taskData: {
    title: string;
    description?: string;
    twelve_wk_goal_id?: string;
    custom_goal_id?: string;
    recurrenceRule?: string;
    selectedRoleIds?: string[];
    selectedDomainIds?: string[];
    selectedKeyRelationshipIds?: string[];
    selectedWeeks: Array<{ weekNumber: number; targetDays: number }>;
  }): Promise<any> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedTimeline) return null;

      // Create the task
      const { data: insertedTask, error: taskError } = await supabase
        .from('0008-ap-tasks')
        .insert({
          user_id: user.id,
          user_cycle_id: selectedTimeline.id,
          title: taskData.title,
          type: 'task',
          input_kind: 'count',
          unit: 'days',
          status: 'pending',
          is_twelve_week_goal: true,
          recurrence_rule: taskData.recurrenceRule,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Handle notes/description via the notes join table
      if (taskData.description && taskData.description.trim()) {
        // Insert the note into the notes table
        const { data: insertedNote, error: noteError } = await supabase
          .from('0008-ap-notes')
          .insert({
            user_id: user.id,
            content: taskData.description.trim(),
          })
          .select()
          .single();

        if (noteError) throw noteError;

        // Link the note to the task
        const { error: noteJoinError } = await supabase
          .from('0008-ap-universal-notes-join')
          .insert({
            parent_id: insertedTask.id,
            parent_type: 'task',
            note_id: insertedNote.id,
            user_id: user.id,
          });

        if (noteJoinError) throw noteJoinError;
      }

      // Create week plans
      const weekPlanInserts = taskData.selectedWeeks.map(week => ({
        task_id: insertedTask.id,
        user_cycle_id: selectedTimeline.id,
        week_number: week.weekNumber,
        target_days: week.targetDays,
      }));

      const { error: weekPlanError } = await supabase
        .from('0008-ap-task-week-plan')
        .insert(weekPlanInserts);

      if (weekPlanError) throw weekPlanError;

      // Link to goal if specified
     if (taskData.twelve_wk_goal_id) {
        const { error: goalJoinError } = await supabase
          .from('0008-ap-universal-goals-join')
          .insert({
            parent_id: insertedTask.id,
            parent_type: 'task',
            twelve_wk_goal_id: taskData.twelve_wk_goal_id,
           goal_type: 'twelve_wk_goal',
            user_id: user.id,
          });

        if (goalJoinError) throw goalJoinError;
      } else if (taskData.custom_goal_id) {
        const { error: goalJoinError } = await supabase
          .from('0008-ap-universal-goals-join')
          .insert({
            parent_id: insertedTask.id,
            parent_type: 'task',
            custom_goal_id: taskData.custom_goal_id,
            goal_type: 'custom_goal',
            user_id: user.id,
          });

        if (goalJoinError) throw goalJoinError;
      }

      // Link roles to task
      if (taskData.selectedRoleIds && taskData.selectedRoleIds.length > 0) {
        const roleJoins = taskData.selectedRoleIds.map(roleId => ({
          parent_id: insertedTask.id,
          parent_type: 'task',
          role_id: roleId,
          user_id: user.id,
        }));

        const { error: roleJoinError } = await supabase
          .from('0008-ap-universal-roles-join')
          .insert(roleJoins);

        if (roleJoinError) throw roleJoinError;
      }

      // Link domains to task
      if (taskData.selectedDomainIds && taskData.selectedDomainIds.length > 0) {
        const domainJoins = taskData.selectedDomainIds.map(domainId => ({
          parent_id: insertedTask.id,
          parent_type: 'task',
          domain_id: domainId,
          user_id: user.id,
        }));

        const { error: domainJoinError } = await supabase
          .from('0008-ap-universal-domains-join')
          .insert(domainJoins);

        if (domainJoinError) throw domainJoinError;
      }

      // Link key relationships to task
      if (taskData.selectedKeyRelationshipIds && taskData.selectedKeyRelationshipIds.length > 0) {
        const krJoins = taskData.selectedKeyRelationshipIds.map(krId => ({
          parent_id: insertedTask.id,
          parent_type: 'task',
          key_relationship_id: krId,
          user_id: user.id,
        }));

        const { error: krJoinError } = await supabase
          .from('0008-ap-universal-key-relationships-join')
          .insert(krJoins);

        if (krJoinError) throw krJoinError;
      }

      return { id: insertedTask.id };
    } catch (error) {
      console.error('Error creating task with week plan:', error);
      throw error;
    }
  };

  const getWeekDateRange = (weekNumber: number): { start: string; end: string } | null => {
    const weekData = cycleWeeks.find(w => w.week_number === weekNumber);
    return weekData ? { start: weekData.start_date, end: weekData.end_date } : null;
  };

  const refreshGoals = async () => {
    if (selectedTimeline) {
      await fetchGoals(selectedTimeline);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, [options.scope]);

  // Auto-refresh days left data at midnight
  useEffect(() => {
    if (!selectedTimeline) return;

    const updateDaysLeft = () => {
      fetchDaysLeftData(selectedTimeline);
    };

    // Calculate milliseconds until next midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Set timeout for midnight, then interval for every 24 hours
    const midnightTimeout = setTimeout(() => {
      updateDaysLeft();
      const dailyInterval = setInterval(updateDaysLeft, 24 * 60 * 60 * 1000);
      return () => clearInterval(dailyInterval);
    }, msUntilMidnight);

    return () => clearTimeout(midnightTimeout);
  }, [selectedTimeline]);

  return {
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
    refreshGoals,
    refreshAllData,
    fetchTasksAndPlansForWeek,
    fetchGoalActionsForWeek,
    toggleTaskDay,
    completeActionSuggestion,
    undoActionOccurrence,       // <-- add this export
    getTodayActionSuggestions,  // <-- add this line
    createTwelveWeekGoal,
    createCustomGoal,
    createTaskWithWeekPlan,
    getWeekDateRange,
    getCurrentWeekNumber,
    getCurrentWeekIndex,
    getWeekData,
    weekGoalActions,
    setWeekGoalActions,
  };
}