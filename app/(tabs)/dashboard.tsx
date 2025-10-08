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
import { handleActionCompletion } from '@/lib/completionHandler';
import { getWeeklyCompletionCount, syncCompletionAcrossViews, completionEvents, CompletionEvent } from '@/lib/completionSync';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';

// --- Main Dashboard Screen Component ---
export default function Dashboard() {
  const { authenticScore, refreshScore } = useAuthenticScore();
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

          // Get unique timeline IDs
          const globalTimelineIds = [...new Set(timelineBasedTasks.map(t => t.user_global_timeline_id).filter(Boolean))];
          const customTimelineIds = [...new Set(timelineBasedTasks.map(t => t.custom_timeline_id).filter(Boolean))];

          // Fetch timeline start dates
          const timelineStartDates = new Map();

          if (globalTimelineIds.length > 0) {
            const { data: globalTimelines } = await supabase
              .from('0008-ap-user-global-timelines')
              .select('id, start_date')
              .in('id', globalTimelineIds);

            globalTimelines?.forEach(tl => {
              timelineStartDates.set(tl.id, tl.start_date);
            });
          }

          if (customTimelineIds.length > 0) {
            const { data: customTimelines } = await supabase
              .from('0008-ap-user-custom-timelines')
              .select('id, start_date')
              .in('id', customTimelineIds);

            customTimelines?.forEach(tl => {
              timelineStartDates.set(tl.id, tl.start_date);
            });
          }

          // Fetch week plans
          const { data: weekPlans, error: weekPlansError } = await supabase
            .from('0008-ap-task-week-plan')
            .select('task_id, week_number, target_days, user_global_timeline_id, user_custom_timeline_id')
            .in('task_id', timelineTaskIds)
            .is('deleted_at', null);

          if (weekPlansError) throw weekPlansError;

          // Calculate current week number for each task
          const { getCurrentWeekNumber } = await import('@/lib/dateUtils');

          tasksWithCurrentWeek = timelineBasedTasks.map(task => {
            const timelineId = task.user_global_timeline_id || task.custom_timeline_id;
            const startDate = timelineStartDates.get(timelineId);

            if (!startDate) {
              console.warn('[Dashboard] No start date found for timeline:', timelineId);
              return null;
            }

            const currentWeekNum = getCurrentWeekNumber(startDate);

            if (!currentWeekNum) {
              console.warn('[Dashboard] Task is outside timeline range:', task.id);
              return null;
            }

            // Find the week plan for the current week
            const currentWeekPlan = weekPlans?.find(
              wp => wp.task_id === task.id && wp.week_number === currentWeekNum
            );

            if (!currentWeekPlan) {
              return null; // Task not scheduled for current week
            }

            return {
              ...task,
              currentWeekNumber: currentWeekNum,
              currentWeekPlan,
              weekPlans: weekPlans?.filter(wp => wp.task_id === task.id) || []
            };
          }).filter(Boolean);
        }

        // Combine standalone and timeline-based tasks
        const allTasks = [...standaloneTasks, ...tasksWithCurrentWeek];

        if (allTasks.length === 0) {
          setTasks([]);
          setDepositIdeas([]);
          setLoading(false);
          return;
        }

        // Fetch completion counts for timeline-based actions this week using shared function
        const timelineTaskIdsWithWeek = tasksWithCurrentWeek.map(t => t.id);
        let completionCounts = new Map();

        if (timelineTaskIdsWithWeek.length > 0) {
          for (const taskId of timelineTaskIdsWithWeek) {
            try {
              const countResult = await getWeeklyCompletionCount(
                supabase,
                taskId,
                weekStartStr,
                weekEndStr
              );
              completionCounts.set(taskId, countResult.completedCount);
            } catch (error) {
              console.error('[Dashboard] Error fetching completion count for task:', taskId, error);
              completionCounts.set(taskId, 0);
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
      await refreshScore();

    } catch (error) {
      console.error(`Error fetching ${activeView}:`, error);
      Alert.alert('Error', (error as Error).message || `Failed to fetch ${activeView}.`);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchData();
  }, [activeView, sortOption]);

  useEffect(() => {
    console.log('[Dashboard] Setting up completion event listener');
    const unsubscribe = completionEvents.subscribeToAll((event: CompletionEvent) => {
      console.log('[Dashboard] Received completion event:', event.type, event.taskId);

      if (activeView === 'deposits' && event.type === 'week_progress_updated' && event.completionCount) {
        const { taskId, completionCount } = event;

        setTasks(prevTasks => {
          const taskIndex = prevTasks.findIndex(t => t.id === taskId);

          if (taskIndex !== -1) {
            const updatedTasks = [...prevTasks];
            updatedTasks[taskIndex] = {
              ...updatedTasks[taskIndex],
              weeklyCompletedCount: completionCount.completedCount,
              weeklyTargetCount: completionCount.targetCount
            };

            if (completionCount.isComplete) {
              return updatedTasks.filter(t => t.id !== taskId);
            }

            return updatedTasks;
          } else if (!completionCount.isComplete && event.completionCount.completedCount < event.completionCount.targetCount) {
            fetchData();
          }

          return prevTasks;
        });

        refreshScore(true);
      }
    });

    return () => {
      console.log('[Dashboard] Cleaning up completion event listener');
      unsubscribe();
    };
  }, [activeView, refreshScore]);

  const handleCompleteTask = async (task: Task) => {
    try {
      console.log('[Dashboard] Completing task:', task.id, task.title);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (task.recurrence_rule && (task.user_global_timeline_id || task.custom_timeline_id)) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + mondayOffset);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekStartStr = formatLocalDate(weekStart);
        const weekEndStr = formatLocalDate(weekEnd);

        const { getWeekCompletionStatus } = await import('@/lib/taskUtils');
        const completedDates = await getWeekCompletionStatus(supabase, task.id, weekStartStr, weekEndStr);

        const { getMostRecentIncompleteDate } = await import('@/lib/dateUtils');
        const dateToComplete = getMostRecentIncompleteDate(completedDates, weekStartStr, weekEndStr);

        if (!dateToComplete) {
          console.log('[Dashboard] All dates in current week are already complete');
          setTasks(prevTasks => prevTasks.filter(t => t.id !== task.id));
          Alert.alert('Complete', 'All available completions for this week are done!');
          return;
        }

        const timeline = task.custom_timeline_id
          ? { id: task.custom_timeline_id, source: 'custom' as const }
          : task.user_global_timeline_id
            ? { id: task.user_global_timeline_id, source: 'global' as const }
            : null;

        if (!timeline) {
          throw new Error('No timeline found for recurring task');
        }

        const result = await handleActionCompletion(
          supabase,
          user.id,
          task.id,
          dateToComplete,
          timeline,
          task.weeklyTargetCount
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to complete action');
        }

        console.log('[Dashboard] Action completed, recalculating count');
        const countResult = await getWeeklyCompletionCount(
          supabase,
          task.id,
          weekStartStr,
          weekEndStr
        );

        const goalId = task.goals && task.goals.length > 0 ? task.goals[0].id : undefined;

        setTasks(prevTasks => {
          const updatedTasks = prevTasks.map(t => {
            if (t.id === task.id) {
              return {
                ...t,
                weeklyCompletedCount: countResult.completedCount,
                weeklyTargetCount: task.weeklyTargetCount || 0
              };
            }
            return t;
          });

          if (result.shouldRemoveFromUI || countResult.completedCount >= (task.weeklyTargetCount || 0)) {
            return updatedTasks.filter(t => t.id !== task.id);
          }

          return updatedTasks;
        });

        if (timeline && goalId) {
          const currentWeekNumber = Math.ceil((today.getTime() - new Date(weekStartStr).getTime()) / (7 * 24 * 60 * 60 * 1000));
          await syncCompletionAcrossViews(
            supabase,
            task.id,
            goalId,
            currentWeekNumber,
            weekStartStr,
            weekEndStr,
            timeline,
            true
          );
        }
      } else {
        // For standalone tasks, update status first, then remove from UI
        const { error } = await supabase
          .from('0008-ap-tasks')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', task.id);

        if (error) throw error;

        // Only remove from UI after successful database update
        setTasks(prevTasks => prevTasks.filter(t => t.id !== task.id));
      }

      console.log('[Dashboard] Waiting for database commits, then refreshing score');
      // Small delay to ensure all database writes (including RPC joins) complete
      await new Promise(resolve => setTimeout(resolve, 200));
      await refreshScore(true);
    } catch (error) {
      console.error('[Dashboard] Error completing task:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to complete action.');
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