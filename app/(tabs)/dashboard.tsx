import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Animated, Platform, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DepositIdeaCard } from '@/components/depositIdeas/DepositIdeaCard';
import { X, Plus, CreditCard as Edit, UserX, Ban } from 'lucide-react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { Header } from '@/components/Header';
import { Task, TaskCard } from '@/components/tasks/TaskCard';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { getSupabaseClient } from '@/lib/supabase';
import { DepositIdeaDetailModal } from '@/components/depositIdeas/DepositIdeaDetailModal';
import { JournalView } from '@/components/journal/JournalView';
import { calculateTaskPoints, calculateAuthenticScore as calculateScoreUtil } from '@/lib/taskUtils';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { DraggableFab } from '@/components/DraggableFab';
import { formatLocalDate } from '@/lib/dateUtils';
import { useGoalProgress } from '@/hooks/useGoalProgress';

// --- Main Dashboard Screen Component ---
export default function Dashboard() {
  const [activeView, setActiveView] = useState<'deposits' | 'ideas' | 'journal' | 'analytics'>('deposits');
  const [sortOption, setSortOption] = useState('due_date');
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [depositIdeas, setDepositIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [authenticScore, setAuthenticScore] = useState(0);

  // Import functions from useGoalProgress hook
  const {
    deleteTask,
  } = useGoalProgress();
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (activeView === 'deposits') {
        // Calculate current week boundaries
        const today = new Date();
        const todayStr = formatLocalDate(today);
        const dayOfWeek = today.getDay(); // 0=Sunday, 6=Saturday
        const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + mondayOffset);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekStartStr = formatLocalDate(weekStart);
        const weekEndStr = formatLocalDate(weekEnd);

        // Fetch parent tasks (both standalone and timeline-based actions)
        const { data: tasksData, error: tasksError } = await supabase
          .from('0008-ap-tasks')
          .select('*, user_global_timeline_id, custom_timeline_id')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .is('parent_task_id', null)
          .neq('status', 'completed')
          .neq('status', 'cancelled')
          .in('type', ['task', 'event']);

        if (tasksError) throw tasksError;
        if (!tasksData || tasksData.length === 0) {
          setTasks([]);
          setDepositIdeas([]);
          setLoading(false);
          return;
        }

        // Separate standalone tasks from timeline-based actions
        const standaloneTasks = tasksData.filter(task =>
          !task.user_global_timeline_id && !task.custom_timeline_id
        );

        const timelineBasedTasks = tasksData.filter(task =>
          task.user_global_timeline_id || task.custom_timeline_id
        );

        // For timeline-based tasks, check if they have week plans for current week
        let tasksWithCurrentWeek: any[] = [];
        if (timelineBasedTasks.length > 0) {
          const timelineTaskIds = timelineBasedTasks.map(t => t.id);

          // Fetch week plans and find current week number
          const { data: weekPlans, error: weekPlansError } = await supabase
            .from('0008-ap-task-week-plan')
            .select('task_id, week_number, target_days, user_global_timeline_id, user_custom_timeline_id')
            .in('task_id', timelineTaskIds);

          if (weekPlansError) throw weekPlansError;

          // Map task IDs to their current week plans
          const taskWeekData = new Map();
          for (const plan of weekPlans || []) {
            if (!taskWeekData.has(plan.task_id)) {
              taskWeekData.set(plan.task_id, []);
            }
            taskWeekData.get(plan.task_id).push(plan);
          }

          // TODO: Calculate current week number based on timeline start date
          // For now, include all timeline-based tasks with week plans
          tasksWithCurrentWeek = timelineBasedTasks.filter(task =>
            taskWeekData.has(task.id) && taskWeekData.get(task.id).length > 0
          ).map(task => ({
            ...task,
            weekPlans: taskWeekData.get(task.id),
            currentWeekPlan: taskWeekData.get(task.id)[0], // Use first plan for now
          }));
        }

        // Combine standalone and timeline-based tasks
        const allTasks = [...standaloneTasks, ...tasksWithCurrentWeek];

        if (allTasks.length === 0) {
          setTasks([]);
          setDepositIdeas([]);
          setLoading(false);
          return;
        }

        // Fetch completion counts for timeline-based actions this week
        const timelineTaskIdsWithWeek = tasksWithCurrentWeek.map(t => t.id);
        let completionCounts = new Map();

        if (timelineTaskIdsWithWeek.length > 0) {
          const { data: completions, error: completionsError } = await supabase
            .from('0008-ap-tasks')
            .select('parent_task_id')
            .in('parent_task_id', timelineTaskIdsWithWeek)
            .gte('due_date', weekStartStr)
            .lte('due_date', weekEndStr)
            .eq('status', 'completed');

          if (!completionsError && completions) {
            for (const completion of completions) {
              const count = completionCounts.get(completion.parent_task_id) || 0;
              completionCounts.set(completion.parent_task_id, count + 1);
            }
          }
        }

        // Filter out timeline-based actions that have reached weekly target
        const currentTasks = allTasks.filter(task => {
          if (!task.currentWeekPlan) return true; // Keep standalone tasks

          const completedCount = completionCounts.get(task.id) || 0;
          const targetDays = task.currentWeekPlan.target_days;

          // Only show if not yet complete for the week
          return completedCount < targetDays;
        }).map(task => ({
          ...task,
          weeklyCompletedCount: completionCounts.get(task.id) || 0,
          weeklyTargetCount: task.currentWeekPlan?.target_days || 0,
        }));

        if (currentTasks.length === 0) {
          setTasks([]);
          setDepositIdeas([]);
          setLoading(false);
          return;
        }
        const taskIds = currentTasks.map(t => t.id);

        const [
          { data: rolesData, error: rolesError },
          { data: domainsData, error: domainsError },
          { data: goalsData, error: goalsError },
          { data: notesData, error: notesError },
          { data: delegatesData, error: delegatesError },
          { data: keyRelationshipsData, error: keyRelationshipsError }
        ] = await Promise.all([
          supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-goals-join').select('parent_id, goal_type, twelve_wk_goal:0008-ap-goals-12wk(id, title, status), custom_goal:0008-ap-goals-custom(id, title, status)').in('parent_id', taskIds).eq('parent_type', 'task'),
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

        const transformedTasks = currentTasks.map(task => {
          // Derive timeline information for recurring tasks
          const timeline_id = task.custom_timeline_id || task.user_global_timeline_id || null;
          const timeline_source = task.user_global_timeline_id ? 'global' : 'custom';

          // Transform polymorphic goals
          const taskGoals = goalsData?.filter(g => g.parent_id === task.id).map(g => {
            if (g.goal_type === 'twelve_wk_goal' && g.twelve_wk_goal) {
              const goal = g.twelve_wk_goal;
              if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
                return { id: 'deleted', title: 'Goal no longer available', goal_type: 'deleted', status: 'deleted' };
              }
              return { ...goal, goal_type: '12week' };
            } else if (g.goal_type === 'custom_goal' && g.custom_goal) {
              const goal = g.custom_goal;
              if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
                return { id: 'deleted', title: 'Goal no longer available', goal_type: 'deleted', status: 'deleted' };
              }
              return { ...goal, goal_type: 'custom' };
            } else if (g.goal_type === 'twelve_wk_goal' && !g.twelve_wk_goal) {
              return { id: 'deleted', title: 'Goal no longer available', goal_type: 'deleted', status: 'deleted' };
            } else if (g.goal_type === 'custom_goal' && !g.custom_goal) {
              return { id: 'deleted', title: 'Goal no longer available', goal_type: 'deleted', status: 'deleted' };
            }
            return null;
          }).filter(Boolean) || [];

          return {
            ...task,
            timeline_id,
            timeline_source,
            roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
            domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
            goals: taskGoals,
            keyRelationships: keyRelationshipsData?.filter(kr => kr.parent_id === task.id).map(kr => kr.key_relationship).filter(Boolean) || [],
            has_notes: notesData?.some(n => n.parent_id === task.id),
            has_delegates: delegatesData?.some(d => d.parent_id === task.id),
            has_attachments: false,
          };
        });

        let sortedTasks = [...transformedTasks];
        if (sortOption === 'due_date') sortedTasks.sort((a, b) => (new Date(a.due_date).getTime() || 0) - (new Date(b.due_date).getTime() || 0));
        else if (sortOption === 'priority') sortedTasks.sort((a, b) => ((b.is_urgent ? 2 : 0) + (b.is_important ? 1 : 0)) - ((a.is_urgent ? 2 : 0) + (a.is_important ? 1 : 0)));
        else if (sortOption === 'title') sortedTasks.sort((a, b) => a.title.localeCompare(b.title));
        else if (sortOption === 'authentic_points') {
          sortedTasks.sort((a, b) => {
            const pointsA = calculateTaskPoints(a, a.roles, a.domains, a.goals);
            const pointsB = calculateTaskPoints(b, b.roles, b.domains, b.goals);
            return pointsB - pointsA; // Highest points first
          });
        }
        else if (sortOption === 'roles') sortedTasks.sort((a, b) => (b.roles?.length || 0) - (a.roles?.length || 0));
        else if (sortOption === 'domains') sortedTasks.sort((a, b) => (b.domains?.length || 0) - (a.domains?.length || 0));
        else if (sortOption === 'goals') sortedTasks.sort((a, b) => (b.goals?.length || 0) - (a.goals?.length || 0));
        else if (sortOption === 'delegated') sortedTasks.sort((a, b) => (b.has_delegates ? 1 : 0) - (a.has_delegates ? 1 : 0));

        setTasks(sortedTasks);
        setDepositIdeas([]);

      } else {
        // Fetch deposit ideas
        const { data: depositIdeasData, error: depositIdeasError } = await supabase
          .from('0008-ap-deposit-ideas')
          .select('*')
          .eq('user_id', user.id)
          .eq('archived', false)
          .is('activated_task_id', null);

        if (depositIdeasError) throw depositIdeasError;
        if (!depositIdeasData || depositIdeasData.length === 0) {
          setDepositIdeas([]);
          setTasks([]);
          setLoading(false);
          return;
        }

        const depositIdeaIds = depositIdeasData.map(di => di.id);

        const [
          { data: rolesData, error: rolesError },
          { data: domainsData, error: domainsError },
          { data: krData, error: krError },
          { data: notesData, error: notesError }
        ] = await Promise.all([
          supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
          supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
          supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
          supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea')
        ]);

        if (rolesError) throw rolesError;
        if (domainsError) throw domainsError;
        if (krError) throw krError;
        if (notesError) throw notesError;

        const transformedDepositIdeas = depositIdeasData.map(di => ({
          ...di,
          roles: rolesData?.filter(r => r.parent_id === di.id).map(r => r.role).filter(Boolean) || [],
          domains: domainsData?.filter(d => d.parent_id === di.id).map(d => d.domain).filter(Boolean) || [],
          keyRelationships: krData?.filter(kr => kr.parent_id === di.id).map(kr => kr.key_relationship).filter(Boolean) || [],
          has_notes: notesData?.some(n => n.parent_id === di.id),
          has_attachments: false,
        }));

        setDepositIdeas(transformedDepositIdeas);
        setTasks([]);
      }

      // Calculate authentic score (total balance) for header
      await refreshAuthenticScore();

    } catch (error) {
      console.error(`Error fetching ${activeView}:`, error);
      Alert.alert('Error', (error as Error).message || `Failed to fetch ${activeView}.`);
    } finally {
      setLoading(false);
    }
  };

 const refreshAuthenticScore = async () => {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const score = await calculateScoreUtil(supabase, user.id);
    setAuthenticScore(score);
  } catch (error) {
    console.error('Error calculating authentic score:', error);
  }
 };

  useEffect(() => {
    fetchData();
  }, [activeView, sortOption]);

  const handleCompleteTask = async (task: Task) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check if this is a recurring task linked to a timeline
      if (task.recurrence_rule && (task.user_global_timeline_id || task.custom_timeline_id)) {
        // Calculate current week boundaries
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + mondayOffset);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekStartStr = formatLocalDate(weekStart);
        const weekEndStr = formatLocalDate(weekEnd);

        // Get all completed dates for this task in the current week
        const { getWeekCompletionStatus } = await import('@/lib/taskUtils');
        const completedDates = await getWeekCompletionStatus(supabase, task.id, weekStartStr, weekEndStr);

        // Use backward-fill logic to find the next date to complete
        const { getMostRecentIncompleteDate } = await import('@/lib/dateUtils');
        const dateToComplete = getMostRecentIncompleteDate(completedDates, weekStartStr, weekEndStr);

        if (!dateToComplete) {
          // All dates up to today are already complete
          console.log('[handleCompleteTask] All dates in current week are already complete');
          // Optimistically remove the task from the list
          setTasks(prevTasks => prevTasks.filter(t => t.id !== task.id));
          Alert.alert('Complete', 'All available completions for this week are done!');
          return;
        }

        // Check if occurrence already exists for this date (safety check)
        const { checkOccurrenceExists } = await import('@/lib/taskUtils');
        const occurrenceExists = await checkOccurrenceExists(supabase, task.id, dateToComplete);

        if (occurrenceExists) {
          console.log('[handleCompleteTask] Occurrence already exists for date:', dateToComplete);
          // Optimistically remove the task from the list if weekly target reached
          const weeklyCompleted = completedDates.length;
          const weeklyTarget = task.weeklyTargetCount || 0;
          if (weeklyCompleted >= weeklyTarget) {
            setTasks(prevTasks => prevTasks.filter(t => t.id !== task.id));
          }
          return;
        }

        // Create occurrence for the backward-fill date
        const occurrencePayload: any = {
          user_id: user.id,
          title: task.title,
          type: 'task',
          status: 'completed',
          due_date: dateToComplete,
          completed_at: new Date().toISOString(),
          parent_task_id: task.id,
          is_twelve_week_goal: !!task.user_global_timeline_id,
        };

        if (task.custom_timeline_id) {
          occurrencePayload.custom_timeline_id = task.custom_timeline_id;
        } else if (task.user_global_timeline_id) {
          occurrencePayload.user_global_timeline_id = task.user_global_timeline_id;
        }

        const { data: occ, error: occErr } = await supabase
          .from('0008-ap-tasks')
          .insert(occurrencePayload)
          .select('id')
          .single();

        if (occErr) {
          // Handle duplicate key constraint error
          if (occErr.code === '23505') {
            console.log('[handleCompleteTask] Duplicate occurrence prevented by database constraint');
            // Refresh data to sync UI
            fetchData();
            return;
          }
          throw occErr;
        }

        // Copy universal joins from parent task
        if (occ) {
          await Promise.all([
            supabase.rpc('ap_copy_universal_roles_to_task', {
              from_parent_id: task.id,
              to_task_id: occ.id,
            }),
            supabase.rpc('ap_copy_universal_domains_to_task', {
              from_parent_id: task.id,
              to_task_id: occ.id,
            }),
            supabase.rpc('ap_copy_universal_goals_to_task', {
              from_parent_id: task.id,
              to_task_id: occ.id,
            }),
          ]);
        }

        // Check if we've reached the weekly target and should remove from dashboard
        const newCompletedCount = completedDates.length + 1;
        const weeklyTarget = task.weeklyTargetCount || 0;

        if (newCompletedCount >= weeklyTarget) {
          // Optimistically remove the task from the list
          setTasks(prevTasks => prevTasks.filter(t => t.id !== task.id));
        } else {
          // Just refresh to update the counter
          fetchData();
        }
      } else {
        // For non-recurring tasks or tasks not linked to timelines, mark as completed
        // Optimistically remove the task from the list immediately
        setTasks(prevTasks => prevTasks.filter(t => t.id !== task.id));

        const { error } = await supabase
          .from('0008-ap-tasks')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', task.id);
        if (error) throw error;
      }

      // Refresh authentic score in background
      refreshAuthenticScore();
    } catch (error) {
      console.error('Error completing task:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to complete action.');
      // Revert optimistic update on error
      fetchData();
    }
  };

  const handleDeleteTask = async (task: Task) => {
    try {
      // Optimistically remove the task from the list immediately
      setTasks(prevTasks => prevTasks.filter(t => t.id !== task.id));

      // Use the soft delete function from useGoals hook
      await deleteTask(task.id);
    } catch (error) {
      console.error('Error deleting task:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to delete task');
      // Revert optimistic update on error
      fetchData();
    }
  };
  const handleCancelTask = async (task: Task) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('0008-ap-tasks').update({ status: 'cancelled' }).eq('id', task.id);
      if (error) throw error;
      Alert.alert('Success', 'Task has been cancelled');
      setIsDetailModalVisible(false);
      fetchData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to cancel task.');
    }
  };

  const handleTaskDoublePress = (task: Task) => { setSelectedTask(task); setIsDetailModalVisible(true); };
  const [selectedDepositIdea, setSelectedDepositIdea] = useState<any>(null);
  const [isDepositIdeaDetailVisible, setIsDepositIdeaDetailVisible] = useState(false);

  const handleDepositIdeaDoublePress = (depositIdea: any) => { 
    setSelectedDepositIdea(depositIdea);
    setIsDepositIdeaDetailVisible(true);
  };
  const handleUpdateDepositIdea = async (depositIdea: any) => {
    const editData = {
      ...depositIdea,
      type: 'depositIdea'
    };
    setEditingTask(editData);
    setIsDepositIdeaDetailVisible(false);
    setIsFormModalVisible(true);
  };
  const handleCancelDepositIdea = async (depositIdea: any) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-deposit-ideas')
        .update({
          is_active: false,
          archived: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', depositIdea.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to cancel deposit idea.');
    }
  };

  const handleActivateDepositIdea = async (depositIdea: any) => {
    try {
      setIsDepositIdeaDetailVisible(false); // Close modal immediately
      
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Create a new task based on the deposit idea
      const { data: newTask, error: taskError } = await supabase
        .from('0008-ap-tasks')
        .insert({
          user_id: user.id,
          title: depositIdea.title,
          type: 'task',
          status: 'pending',
          due_date: formatLocalDate(new Date()),
          is_authentic_deposit: true,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      const taskId = newTask.id;

      // Copy all the joins from the deposit idea to the new task
      const joinPromises = [];

      // Copy role joins
      if (depositIdea.roles && depositIdea.roles.length > 0) {
        const roleJoins = depositIdea.roles.map(role => ({
          parent_id: taskId,
          parent_type: 'task',
          role_id: role.id,
          user_id: user.id,
        }));
        joinPromises.push(
          supabase.from('0008-ap-universal-roles-join').insert(roleJoins)
        );
      }

      // Copy domain joins
      if (depositIdea.domains && depositIdea.domains.length > 0) {
        const domainJoins = depositIdea.domains.map(domain => ({
          parent_id: taskId,
          parent_type: 'task',
          domain_id: domain.id,
          user_id: user.id,
        }));
        joinPromises.push(
          supabase.from('0008-ap-universal-domains-join').insert(domainJoins)
        );
      }

      // Copy key relationship joins
      if (depositIdea.keyRelationships && depositIdea.keyRelationships.length > 0) {
        const krJoins = depositIdea.keyRelationships.map(kr => ({
          parent_id: taskId,
          parent_type: 'task',
          key_relationship_id: kr.id,
          user_id: user.id,
        }));
        joinPromises.push(
          supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins)
        );
      }

      // Execute all join insertions
      if (joinPromises.length > 0) {
        const joinResults = await Promise.all(joinPromises);
        for (const result of joinResults) {
          if (result.error) throw result.error;
        }
      }

      // Mark the deposit idea as activated
      const { error: updateError } = await supabase
        .from('0008-ap-deposit-ideas')
        .update({
          is_active: false,
          archived: true,
          activated_at: new Date().toISOString(),
          activated_task_id: taskId,
          updated_at: new Date().toISOString()
        })
        .eq('id', depositIdea.id);

      if (updateError) throw updateError;

      Alert.alert('Success', 'Deposit idea has been activated as a task!');
      fetchData(); // Refresh the task list
    } catch (error) {
      console.error('Error activating deposit idea:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to activate deposit idea.');
    }
  };
  const handleUpdateTask = (task: Task) => {
    setEditingTask(task);
    setIsDetailModalVisible(false);
    setTimeout(() => setIsFormModalVisible(true), 100); // Small delay to ensure modal transition
  };
  const handleDelegateTask = (task: Task) => { Alert.alert('Delegate', 'Delegation functionality coming soon!'); setIsDetailModalVisible(false); };
  const handleFormSubmitSuccess = () => {
    setIsFormModalVisible(false);
    setEditingTask(null);
    fetchData();
  };

  const handleFormClose = () => {
    setIsFormModalVisible(false);
    setEditingTask(null);
  };

  const handleJournalEntryPress = (entry: any) => {
    if (entry.source_type === 'task') {
      setSelectedTask(entry.source_data);
      setIsDetailModalVisible(true);
    } else if (entry.source_type === 'withdrawal') {
      // Open TaskEventForm in withdrawal mode for editing
      const editData = {
        ...entry.source_data,
        type: 'withdrawal'
      };
      setEditingTask(editData);
      setIsFormModalVisible(true);
    }
  };
  const handleDragEnd = ({ data }: { data: Task[] }) => setTasks(data);
  const sortOptions = [
    { value: 'due_date', label: 'Due Date' }, 
    { value: 'priority', label: 'Priority' }, 
    { value: 'title', label: 'Title' },
    { value: 'authentic_points', label: 'Authentic Points' },
    { value: 'roles', label: 'Roles' },
    { value: 'domains', label: 'Domains' },
    { value: 'goals', label: 'Goals' },
    { value: 'delegated', label: 'Delegated' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Header activeView={activeView} onViewChange={setActiveView} onSortPress={() => setIsSortModalVisible(true)} authenticScore={authenticScore} />
      <View style={styles.content}>
        
        {activeView === 'journal' ? (
          <JournalView
            scope={{ type: 'user' }}
            onEntryPress={handleJournalEntryPress}
          />
        ) : activeView === 'analytics' ? (
          <AnalyticsView
            scope={{ type: 'user' }}
          />
        ) : loading ? null
          : (activeView === 'deposits' && tasks.length === 0) || (activeView === 'ideas' && depositIdeas.length === 0) ? 
            <View style={styles.emptyContainer}><Text style={styles.emptyText}>No {activeView} found</Text></View>
          : activeView === 'deposits' ? 
            Platform.OS === 'web' ? (
              <FlatList
                data={tasks}
                renderItem={({ item }) => (
                  <TaskCard 
                    task={item} 
                    onComplete={handleCompleteTask} 
                    onDelete={handleDeleteTask} 
                    onLongPress={() => {}} 
                    onDoublePress={handleTaskDoublePress} 
                    isDragging={false} 
                  />
                )}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.taskList}
                showsVerticalScrollIndicator={true}
                style={styles.draggableList}
              />
            ) : (
              <DraggableFlatList 
                data={tasks} 
                renderItem={({ item, drag, isActive }) => (
                  <TaskCard 
                    task={item} 
                    onComplete={handleCompleteTask} 
                    onDelete={handleDeleteTask} 
                    onLongPress={drag} 
                    onDoublePress={handleTaskDoublePress} 
                    isDragging={isActive} 
                  />
                )}
                keyExtractor={(item) => item.id} 
                onDragEnd={handleDragEnd} 
                contentContainerStyle={styles.taskList} 
                showsVerticalScrollIndicator={true}
                scrollEnabled={true}
                style={styles.draggableList}
              />
            )
          : <ScrollView 
              style={styles.scrollContent} 
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              contentContainerStyle={styles.scrollContentContainer}
            >
              <View style={styles.taskList}>
                {depositIdeas.map(depositIdea => 
                  <DepositIdeaCard 
                    key={depositIdea.id} 
                    depositIdea={depositIdea} 
                    onUpdate={handleUpdateDepositIdea}
                    onCancel={handleCancelDepositIdea}
                    onDoublePress={handleDepositIdeaDoublePress} 
                  />
                )}
              </View>
            </ScrollView>
        }
      </View>
      <DraggableFab onPress={() => setIsFormModalVisible(true)}>
        <Plus size={24} color="#ffffff" />
      </DraggableFab>
      <Modal visible={isFormModalVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode={editingTask ? "edit" : "create"}
          initialData={editingTask || undefined}
          onSubmitSuccess={handleFormSubmitSuccess}
          onClose={handleFormClose}
        />
      </Modal>
      <TaskDetailModal visible={isDetailModalVisible} task={selectedTask} onClose={() => setIsDetailModalVisible(false)} onUpdate={handleUpdateTask} onDelegate={handleDelegateTask} onCancel={handleCancelTask} />
      <DepositIdeaDetailModal 
        visible={isDepositIdeaDetailVisible} 
        depositIdea={selectedDepositIdea} 
        onClose={() => setIsDepositIdeaDetailVisible(false)} 
        onUpdate={handleUpdateDepositIdea}
        onCancel={handleCancelDepositIdea}
        onActivate={handleActivateDepositIdea}
      />
      <Modal visible={isSortModalVisible} transparent animationType="fade" onRequestClose={() => setIsSortModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Sort by</Text><TouchableOpacity onPress={() => setIsSortModalVisible(false)} style={styles.closeButton}><X size={20} color="#6b7280" /></TouchableOpacity></View>
            <View style={styles.sortOptions}>{sortOptions.map(option => <TouchableOpacity key={option.value} style={[styles.sortOption, sortOption === option.value && styles.activeSortOption]} onPress={() => { setSortOption(option.value); setIsSortModalVisible(false); }}><Text style={[styles.sortOptionText, sortOption === option.value && styles.activeSortOptionText]}>{option.label}</Text></TouchableOpacity>)}</View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    content: { flex: 1 },
    draggableList: { flex: 1 },
    scrollContent: { flex: 1 },
    scrollContentContainer: { flexGrow: 1, paddingBottom: 100 },
    taskList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
    tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    roleTag: { backgroundColor: '#fce7f3' },
    domainTag: { backgroundColor: '#fed7aa' },
    goalTag: { backgroundColor: '#bfdbfe' },
    tagText: { fontSize: 10, fontWeight: '500', color: '#374151' },
    loadingContainer: { padding: 40, alignItems: 'center' },
    loadingText: { color: '#6b7280', fontSize: 16 },
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#6b7280', fontSize: 16, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#ffffff', borderRadius: 12, margin: 20, minWidth: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    modalTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
    closeButton: { padding: 4 },
    sortOptions: { padding: 8 },
    sortOption: { padding: 12, borderRadius: 8, marginVertical: 2 },
    activeSortOption: { backgroundColor: '#eff6ff' },
    sortOptionText: { fontSize: 14, color: '#374151' },
    activeSortOptionText: { color: '#0078d4', fontWeight: '600' },
    goalsSection: {
      backgroundColor: '#ffffff',
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    goalsSectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#1f2937',
      marginBottom: 12,
    },
    goalsList: {
      gap: 12,
    },
});