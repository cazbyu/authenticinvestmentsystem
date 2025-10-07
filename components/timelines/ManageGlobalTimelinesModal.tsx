import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, TriangleAlert as AlertTriangle, Calendar, TrendingUp, ChevronRight, Archive, Trash2 } from 'lucide-react-native';
import { InfoTooltip } from '@/components/InfoTooltip';
import { getSupabaseClient } from '@/lib/supabase';
import { formatDateRange } from '@/lib/dateUtils';

interface GlobalCycle {
  id: string;
  title?: string;
  cycle_label?: string;
  start_date: string;
  end_date: string;
  reflection_end: string;
  is_active: boolean;
  status?: string;
}

interface UserGlobalTimeline {
  id: string;
  user_id: string;
  global_cycle_id: string;
  status: string;
  week_start_day: string;
  activated_at: string;
  created_at: string;
  updated_at: string;
  global_cycle: GlobalCycle;
  goals?: Array<{ id: string; status: string }>;
}

interface ActiveTimelineWithCycle extends UserGlobalTimeline {
  isAlreadyActivated?: boolean;
  isCurrent?: boolean;
}

interface ManageGlobalTimelinesModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function ManageGlobalTimelinesModal({ visible, onClose, onUpdate }: ManageGlobalTimelinesModalProps) {
  const [activeTimelines, setActiveTimelines] = useState<UserGlobalTimeline[]>([]);
  const [availableCycles, setAvailableCycles] = useState<ActiveTimelineWithCycle[]>([]);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [activatingCycleId, setActivatingCycleId] = useState<string | null>(null);
  const [activatingWeekDay, setActivatingWeekDay] = useState<'sunday' | 'monday' | null>(null);

  // Archive and Delete states
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveConfirmTimeline, setArchiveConfirmTimeline] = useState<UserGlobalTimeline | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmTimeline, setDeleteConfirmTimeline] = useState<UserGlobalTimeline | null>(null);

  const [showActivationWarning, setShowActivationWarning] = useState(false);
  const [selectedCycleForActivation, setSelectedCycleForActivation] = useState<GlobalCycle | null>(null);
  const [selectedWeekStartDay, setSelectedWeekStartDay] = useState<'sunday' | 'monday'>('sunday');

  const [showDeactivationWarning, setShowDeactivationWarning] = useState(false);
  const [timelineToDeactivate, setTimelineToDeactivate] = useState<UserGlobalTimeline | null>(null);

  const [showWeekStartModal, setShowWeekStartModal] = useState(false);
  const [selectedCycleToActivate, setSelectedCycleToActivate] = useState<GlobalCycle | null>(null);

  useEffect(() => {
    if (visible) {
      fetchData();
    }
  }, [visible]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchActiveTimeline(),
        fetchAvailableCycles()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveTimeline = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[ManageGlobalTimelinesModal] No authenticated user found');
        return;
      }

      console.log('[ManageGlobalTimelinesModal] Fetching active timelines for user:', user.id);

      const { data, error } = await supabase
        .from('0008-ap-user-global-timelines')
        .select(`
          id,
          user_id,
          global_cycle_id,
          status,
          week_start_day,
          activated_at,
          created_at,
          updated_at,
          global_cycle:0008-ap-global-cycles!inner(
            id,
            title,
            cycle_label,
            start_date,
            end_date,
            reflection_end,
            is_active,
            status
          ),
          goals:0008-ap-goals-12wk(id, status)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      console.log('[ManageGlobalTimelinesModal] Active timelines query result:', {
        count: data?.length || 0,
        error: error,
        timelines: data?.map(t => ({ id: t.id, cycle_id: t.global_cycle_id, title: t.global_cycle?.title }))
      });

      if (error) throw error;
      setActiveTimelines(data || []);
    } catch (error) {
      console.error('[ManageGlobalTimelinesModal] Error fetching active timelines:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const fetchAvailableCycles = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];

      const { data: cycleData, error } = await supabase
        .from('0008-ap-global-cycles')
        .select('id, title, cycle_label, start_date, end_date, reflection_end, is_active, status')
        .eq('status', 'active')
        .gte('reflection_end', today)
        .order('start_date', { ascending: true });

      if (error) throw error;

      const currentDate = new Date().toISOString().split('T')[0];
      const availableCyclesWithStatus: ActiveTimelineWithCycle[] = [];

      if (cycleData) {
        const activatedCycleIds = activeTimelines.map(t => t.global_cycle_id);

        const currentCycle = cycleData.find(cycle =>
          cycle.start_date <= currentDate && currentDate <= cycle.end_date
        );

        if (currentCycle) {
          availableCyclesWithStatus.push({
            ...currentCycle,
            isAlreadyActivated: activatedCycleIds.includes(currentCycle.id),
            isCurrent: true,
            id: currentCycle.id,
            user_id: user.id,
            global_cycle_id: currentCycle.id,
            status: 'active',
            week_start_day: 'sunday',
            activated_at: '',
            created_at: '',
            updated_at: '',
            global_cycle: currentCycle
          } as ActiveTimelineWithCycle);
        }

        const futureCycles = cycleData.filter(cycle => cycle.start_date > currentDate);
        const nextTwoUpcoming = futureCycles.slice(0, 2);

        nextTwoUpcoming.forEach(cycle => {
          availableCyclesWithStatus.push({
            ...cycle,
            isAlreadyActivated: activatedCycleIds.includes(cycle.id),
            isCurrent: false,
            id: cycle.id,
            user_id: user.id,
            global_cycle_id: cycle.id,
            status: 'active',
            week_start_day: 'sunday',
            activated_at: '',
            created_at: '',
            updated_at: '',
            global_cycle: cycle
          } as ActiveTimelineWithCycle);
        });
      }

      setAvailableCycles(availableCyclesWithStatus);
    } catch (error) {
      console.error('Error fetching available cycles:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleActivateCycle = async (cycle: GlobalCycle, weekStartDay: 'sunday' | 'monday') => {
    setActivating(true);
    setActivatingCycleId(cycle.id);
    setActivatingWeekDay(weekStartDay);

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.rpc('fn_activate_user_global_timeline', {
        p_global_cycle_id: cycle.id,
        p_week_start_day: weekStartDay
      });

      if (error) throw error;

      Alert.alert('Success', 'Global timeline activated successfully!');
      await fetchData();
      onUpdate?.();
    } catch (error) {
      console.error('Error activating timeline:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setActivating(false);
      setActivatingCycleId(null);
      setActivatingWeekDay(null);
    }
  };

  const confirmActivation = async () => {
    if (!selectedCycleForActivation) return;

    setActivating(true);
    setShowActivationWarning(false);

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.rpc('fn_activate_user_global_timeline', {
        p_global_cycle_id: selectedCycleForActivation.id,
        p_week_start_day: selectedWeekStartDay
      });

      if (error) throw error;

      Alert.alert('Success', 'Global timeline activated successfully!');
      await fetchData();
      onUpdate?.();
    } catch (error) {
      console.error('Error activating timeline:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setActivating(false);
      setSelectedCycleForActivation(null);
    }
  };

  const handleDeactivateTimeline = (timeline: UserGlobalTimeline) => {
    if (!timeline) return;
    setTimelineToDeactivate(timeline);
    setShowDeactivationWarning(true);
  };

  const handleArchiveTimeline = (timeline: UserGlobalTimeline) => {
    const isPastTimeline = timeline.global_cycle?.end_date ? new Date(timeline.global_cycle.end_date) < new Date() : false;

    if (!isPastTimeline) {
      Alert.alert(
        'Cannot Archive',
        'Only timelines that have passed their end date can be archived. This timeline is still active.'
      );
      return;
    }

    setArchiveConfirmTimeline(timeline);
    setShowArchiveConfirm(true);
  };

  const confirmArchive = async () => {
    if (!archiveConfirmTimeline) return;

    setShowArchiveConfirm(false);
    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from('0008-ap-user-global-timelines')
        .update({
          status: 'archived',
          updated_at: new Date().toISOString(),
        })
        .eq('id', archiveConfirmTimeline.id);

      if (error) throw error;

      Alert.alert('Success', 'Timeline archived successfully');
      await fetchData();
      onUpdate?.();
    } catch (error) {
      console.error('Error archiving timeline:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setArchiveConfirmTimeline(null);
    }
  };

  const handleDeleteTimeline = (timeline: UserGlobalTimeline) => {
    setDeleteConfirmTimeline(timeline);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteTimeline = async () => {
    if (!deleteConfirmTimeline) return;

    setShowDeleteConfirm(false);
    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from('0008-ap-user-global-timelines')
        .delete()
        .eq('id', deleteConfirmTimeline.id);

      if (error) throw error;

      Alert.alert('Success', 'Timeline permanently deleted');
      await fetchData();
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting timeline:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setDeleteConfirmTimeline(null);
    }
  };

  const confirmDeactivation = async () => {
    if (!timelineToDeactivate) return;

    setDeactivating(true);
    setShowDeactivationWarning(false);

    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase.rpc('fn_deactivate_user_global_timeline', {
        p_user_global_timeline_id: timelineToDeactivate.id
      });

      if (error) throw error;

      Alert.alert('Success', 'Global timeline deactivated successfully!');
      await fetchData();
      onUpdate?.();
    } catch (error) {
      console.error('Error deactivating timeline:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setDeactivating(false);
      setTimelineToDeactivate(null);
    }
  };

  const renderActiveTimelines = () => {
    if (activeTimelines.length === 0) {
      return (
        <View style={styles.emptySection}>
          <Calendar size={48} color="#6b7280" />
          <Text style={styles.emptyTitle}>No Active Global Timelines</Text>
          <Text style={styles.emptyText}>
            Activate global timelines below to start tracking your 12-week goals
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.activeTimelinesList}>
        {activeTimelines.map((timeline) => {
          const startDate = timeline.global_cycle?.start_date ? new Date(timeline.global_cycle.start_date) : null;
          const endDate = timeline.global_cycle?.end_date ? new Date(timeline.global_cycle.end_date) : null;
          let daysRemaining = 0;
          let progress = 0;

          if (startDate && endDate) {
            const now = new Date();
            daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            progress = Math.min(100, Math.max(0, ((now.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100));
          }

          const displayTitle = timeline.global_cycle?.title || timeline.global_cycle?.cycle_label || 'Global Timeline';
          const goalCount = timeline.goals?.filter(g => g.status === 'active').length || 0;

          return (
            <View key={timeline.id} style={styles.activeTimelineCard}>
              <View style={styles.activeTimelineHeader}>
                <View style={styles.activeTimelineInfo}>
                  <Text style={styles.activeTimelineTitle}>{displayTitle}</Text>
                  <Text style={styles.activeTimelineDates}>
                    {timeline.global_cycle?.start_date && timeline.global_cycle?.end_date
                      ? formatDateRange(timeline.global_cycle.start_date, timeline.global_cycle.end_date)
                      : 'Invalid date'}
                  </Text>
                  <Text style={styles.activeTimelineStats}>
                    {goalCount} active goals • {daysRemaining} days remaining
                  </Text>
                  <Text style={styles.weekStartInfo}>
                    Week starts: {timeline.week_start_day === 'sunday' ? 'Sunday' : 'Monday'}
                  </Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
              </View>

              <View style={styles.timelineButtonsContainer}>
                {timeline.global_cycle?.end_date && new Date(timeline.global_cycle.end_date) < new Date() && (
                  <TouchableOpacity
                    style={styles.archiveButton}
                    onPress={() => handleArchiveTimeline(timeline)}
                    disabled={deactivating}
                  >
                    <Archive size={16} color="#f59e0b" />
                    <Text style={styles.archiveButtonText}>Archive</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteTimeline(timeline)}
                  disabled={deactivating}
                >
                  <Trash2 size={16} color="#dc2626" />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deactivateButton}
                  onPress={() => handleDeactivateTimeline(timeline)}
                  disabled={deactivating}
                >
                  {deactivating ? (
                    <ActivityIndicator size="small" color="#6b7280" />
                  ) : (
                    <>
                      <X size={16} color="#6b7280" />
                      <Text style={styles.deactivateButtonText}>Deactivate</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const handleActivateButtonPress = (cycle: GlobalCycle) => {
    setSelectedCycleToActivate(cycle);
    setShowWeekStartModal(true);
  };

  const handleWeekStartSelection = async (weekStartDay: 'sunday' | 'monday') => {
    if (!selectedCycleToActivate) return;

    console.log('[ManageGlobalTimelinesModal] Starting timeline activation');
    console.log('[ManageGlobalTimelinesModal] Cycle ID:', selectedCycleToActivate.id);
    console.log('[ManageGlobalTimelinesModal] Week start day:', weekStartDay);

    setActivating(true);
    setShowWeekStartModal(false);

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[ManageGlobalTimelinesModal] Current user ID:', user?.id);

      console.log('[ManageGlobalTimelinesModal] Calling fn_activate_user_global_timeline...');
      const { data, error } = await supabase.rpc('fn_activate_user_global_timeline', {
        p_global_cycle_id: selectedCycleToActivate.id,
        p_week_start_day: weekStartDay
      });

      console.log('[ManageGlobalTimelinesModal] RPC Response:', { data, error });

      if (error) {
        console.error('[ManageGlobalTimelinesModal] RPC Error:', error);
        throw error;
      }

      console.log('[ManageGlobalTimelinesModal] Timeline activated successfully. New timeline ID:', data);

      Alert.alert('Success', 'Global timeline activated successfully!');

      console.log('[ManageGlobalTimelinesModal] Refreshing timeline data...');
      await fetchData();
      console.log('[ManageGlobalTimelinesModal] Calling onUpdate callback...');
      onUpdate?.();
      console.log('[ManageGlobalTimelinesModal] Activation complete');
    } catch (error) {
      console.error('[ManageGlobalTimelinesModal] Error activating timeline:', error);
      console.error('[ManageGlobalTimelinesModal] Error details:', JSON.stringify(error, null, 2));
      Alert.alert(
        'Activation Error',
        `Failed to activate timeline: ${(error as Error).message}\n\nPlease try again or contact support if the problem persists.`
      );
    } finally {
      setActivating(false);
      setSelectedCycleToActivate(null);
    }
  };

  const renderAvailableCycles = () => {
    if (availableCycles.length === 0) {
      return (
        <View style={styles.emptySection}>
          <TrendingUp size={48} color="#6b7280" />
          <Text style={styles.emptyTitle}>No Upcoming Cycles</Text>
          <Text style={styles.emptyText}>
            Check back later for new global 12-week cycles
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.availableCyclesList}>
        {availableCycles.map(cycle => {
          const displayTitle = cycle.global_cycle?.title || cycle.global_cycle?.cycle_label || cycle.title || cycle.cycle_label || 'Global 12-Week Cycle';
          const isActivated = cycle.isAlreadyActivated === true;
          const isCurrent = cycle.isCurrent === true;

          return (
            <View key={cycle.global_cycle_id || cycle.id} style={[
              styles.availableCycleCard,
              isActivated && styles.activatedCycleCard
            ]}>
              <View style={styles.cycleCardHeader}>
                <View style={styles.titleRow}>
                  <Text style={styles.cycleTitle}>{displayTitle}</Text>
                  {isCurrent && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>Current</Text>
                    </View>
                  )}
                </View>
                {isActivated && (
                  <View style={styles.activatedBadge}>
                    <Text style={styles.activatedBadgeText}>Activated</Text>
                  </View>
                )}
                <Text style={styles.cycleDates}>
                  {formatDateRange(
                    cycle.global_cycle?.start_date || cycle.start_date,
                    cycle.global_cycle?.end_date || cycle.end_date
                  )}
                </Text>
              </View>

              {!isActivated ? (
                <TouchableOpacity
                  style={styles.activateButton}
                  onPress={() => handleActivateButtonPress(cycle.global_cycle || cycle)}
                  disabled={activating}
                >
                  {activating ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.activateButtonText}>Activate</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.alreadyActivatedMessage}>
                  <Text style={styles.alreadyActivatedText}>
                    This cycle is already activated and appears in your Active Timelines above
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleContainer}>
            <Text style={styles.modalTitle}>Manage Standardized 12 Week Timelines</Text>
            <InfoTooltip
              content="These 12 Week timelines are synchronized to align with the standard year. Each goal-setting period is built with 12 weeks of action and 1 week of reflection and preparation for the next 12 week period."
              iconSize={20}
              iconColor="#6b7280"
              maxWidth={320}
            />
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0078d4" />
            <Text style={styles.loadingText}>Loading timelines...</Text>
          </View>
        ) : (
          <ScrollView style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active Timelines</Text>
              <Text style={styles.sectionSubtitle}>
                Your currently active global 12-week timelines
              </Text>
              {renderActiveTimelines()}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>Available Timelines</Text>
                <InfoTooltip
                  content="To activate a timeline, select your preferred week start day (Sunday or Monday) by tapping one of the buttons below each timeline. You can have multiple active timelines running simultaneously."
                  iconSize={18}
                  iconColor="#6b7280"
                  maxWidth={320}
                />
              </View>
              <Text style={styles.sectionSubtitle}>
                Current and upcoming standardized 12-week cycles available for activation
              </Text>
              {renderAvailableCycles()}
            </View>
          </ScrollView>
        )}

        {/* Deactivation Warning Modal */}
        <Modal
          visible={showDeactivationWarning}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeactivationWarning(false)}
        >
          <View style={styles.warningOverlay}>
            <View style={styles.warningModal}>
              <View style={styles.warningHeader}>
                <AlertTriangle size={32} color="#dc2626" />
                <Text style={styles.warningTitle}>Warning: Data Loss</Text>
              </View>

              <Text style={styles.warningMessage}>
                Deactivating this timeline will permanently delete all associated goals and actions.
              </Text>

              <Text style={styles.warningDetails}>
                This timeline has {timelineToDeactivate?.goals?.length || 0} active goals that will be permanently deleted.
              </Text>

              <View style={styles.warningButtons}>
                <TouchableOpacity
                  style={styles.warningCancelButton}
                  onPress={() => setShowDeactivationWarning(false)}
                >
                  <Text style={styles.warningCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.warningConfirmButton}
                  onPress={confirmDeactivation}
                  disabled={deactivating}
                >
                  {deactivating ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.warningConfirmText}>Deactivate Anyway</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Archive Confirmation Modal */}
        <Modal visible={showArchiveConfirm} transparent animationType="fade">
          <View style={styles.warningOverlay}>
            <View style={styles.warningModal}>
              <View style={styles.warningHeader}>
                <Archive size={32} color="#f59e0b" />
                <Text style={[styles.warningTitle, { color: '#f59e0b' }]}>Archive Timeline</Text>
              </View>

              <Text style={styles.warningMessage}>
                This timeline is past its end date. Archive it to move it out of your active timelines?
              </Text>

              {archiveConfirmTimeline && (
                <Text style={styles.warningDetails}>
                  Timeline: {archiveConfirmTimeline.global_cycle?.title || archiveConfirmTimeline.global_cycle?.cycle_label}
                  {archiveConfirmTimeline.goals?.length ? `\n${archiveConfirmTimeline.goals.length} goals will be archived with this timeline.` : ''}
                </Text>
              )}

              <Text style={styles.warningNote}>
                You can restore this timeline later from Settings → Goal Bank → Timeline Archive.
              </Text>

              <View style={styles.warningButtons}>
                <TouchableOpacity
                  style={styles.warningCancelButton}
                  onPress={() => {
                    setShowArchiveConfirm(false);
                    setArchiveConfirmTimeline(null);
                  }}
                >
                  <Text style={styles.warningCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.warningArchiveButton}
                  onPress={confirmArchive}
                >
                  <Text style={styles.warningArchiveText}>Archive</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal visible={showDeleteConfirm} transparent animationType="fade">
          <View style={styles.warningOverlay}>
            <View style={styles.warningModal}>
              <View style={styles.warningHeader}>
                <AlertTriangle size={32} color="#dc2626" />
                <Text style={styles.warningTitle}>Delete Timeline</Text>
              </View>

              <Text style={styles.warningMessage}>
                Warning: Deleting this timeline will permanently remove all associated goals and actions. This cannot be undone.
              </Text>

              {deleteConfirmTimeline && (
                <Text style={styles.warningDetails}>
                  Timeline: {deleteConfirmTimeline.global_cycle?.title || deleteConfirmTimeline.global_cycle?.cycle_label}
                  {deleteConfirmTimeline.goals?.length ? `\n${deleteConfirmTimeline.goals.length} goals will be permanently deleted.` : ''}
                </Text>
              )}

              <View style={styles.warningButtons}>
                <TouchableOpacity
                  style={styles.warningCancelButton}
                  onPress={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmTimeline(null);
                  }}
                >
                  <Text style={styles.warningCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.warningDeleteButton}
                  onPress={confirmDeleteTimeline}
                >
                  <Text style={styles.warningDeleteText}>Delete Permanently</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Week Start Day Selection Modal */}
        <Modal visible={showWeekStartModal} transparent animationType="fade">
          <View style={styles.weekStartOverlay}>
            <View style={styles.weekStartModal}>
              <Text style={styles.weekStartTitle}>
                Would you like your week start day to be:
              </Text>

              <View style={styles.weekStartButtonsContainer}>
                <TouchableOpacity
                  style={styles.weekStartDayButton}
                  onPress={() => handleWeekStartSelection('sunday')}
                  disabled={activating}
                >
                  {activating ? (
                    <ActivityIndicator size="small" color="#0078d4" />
                  ) : (
                    <Text style={styles.weekStartDayButtonText}>Sunday</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.weekStartDayButton}
                  onPress={() => handleWeekStartSelection('monday')}
                  disabled={activating}
                >
                  {activating ? (
                    <ActivityIndicator size="small" color="#0078d4" />
                  ) : (
                    <Text style={styles.weekStartDayButtonText}>Monday</Text>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.weekStartCancelButton}
                onPress={() => {
                  setShowWeekStartModal(false);
                  setSelectedCycleToActivate(null);
                }}
                disabled={activating}
              >
                <Text style={styles.weekStartCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    overflow: 'visible',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
    overflow: 'visible',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flexShrink: 1,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    marginBottom: 8,
    overflow: 'visible',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    overflow: 'visible',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  emptySection: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  activeTimelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0078d4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeTimelineHeader: {
    marginBottom: 12,
  },
  activeTimelineInfo: {
    flex: 1,
  },
  activeTimelineTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  activeTimelineDates: {
    fontSize: 14,
    color: '#0078d4',
    fontWeight: '500',
    marginBottom: 4,
  },
  activeTimelineStats: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  weekStartInfo: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0078d4',
    borderRadius: 4,
  },
  timelineButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  archiveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  archiveButtonText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#dc2626',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  deleteButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  deactivateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#9ca3af',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  deactivateButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTimelinesList: {
    gap: 12,
  },
  availableCyclesList: {
    gap: 12,
  },
  availableCycleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  activatedCycleCard: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0078d4',
  },
  activatedBadge: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  activatedBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  alreadyActivatedMessage: {
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0078d4',
  },
  alreadyActivatedText: {
    color: '#0078d4',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  cycleCardHeader: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  cycleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  currentBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  currentBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cycleDates: {
    fontSize: 14,
    color: '#0078d4',
    fontWeight: '500',
  },
  activateButton: {
    backgroundColor: '#0078d4',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  activateButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  warningOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  warningModal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  warningHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#dc2626',
    marginTop: 8,
  },
  warningMessage: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  warningDetails: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  warningButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  warningCancelButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningCancelText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  warningConfirmButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningConfirmText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningNote: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 18,
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  warningArchiveButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningArchiveText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningDeleteButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningDeleteText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  weekStartOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  weekStartModal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  weekStartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 26,
  },
  weekStartButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  weekStartDayButton: {
    flex: 1,
    backgroundColor: '#0078d4',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  weekStartDayButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  weekStartCancelButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  weekStartCancelText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
});
