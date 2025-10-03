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
import { X, TriangleAlert as AlertTriangle, Calendar, TrendingUp, ChevronRight } from 'lucide-react-native';
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
  title?: string;
  start_date: string;
  end_date: string;
  status: string;
  week_start_day: string;
  timezone: string;
  created_at: string;
  updated_at: string;
  global_cycle?: GlobalCycle;
  goals?: Array<{ id: string; status: string }>;
}

interface ManageGlobalTimelinesModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function ManageGlobalTimelinesModal({ visible, onClose, onUpdate }: ManageGlobalTimelinesModalProps) {
  const [activeTimeline, setActiveTimeline] = useState<UserGlobalTimeline | null>(null);
  const [availableCycles, setAvailableCycles] = useState<GlobalCycle[]>([]);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const [showActivationWarning, setShowActivationWarning] = useState(false);
  const [selectedCycleForActivation, setSelectedCycleForActivation] = useState<GlobalCycle | null>(null);
  const [selectedWeekStartDay, setSelectedWeekStartDay] = useState<'sunday' | 'monday'>('sunday');

  const [showDeactivationWarning, setShowDeactivationWarning] = useState(false);

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
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-user-global-timelines')
        .select(`
          *,
          global_cycle:0008-ap-global-cycles(
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
        .maybeSingle();

      if (error) throw error;
      setActiveTimeline(data);
    } catch (error) {
      console.error('Error fetching active timeline:', error);
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
        .order('start_date', { ascending: true })
        .limit(10);

      if (error) throw error;

      const currentDate = new Date().toISOString().split('T')[0];
      const nextCycles: GlobalCycle[] = [];

      if (cycleData) {
        const futureCycles = cycleData
          .filter(cycle => cycle.start_date > currentDate)
          .slice(0, 2);

        nextCycles.push(...futureCycles);
      }

      setAvailableCycles(nextCycles);
    } catch (error) {
      console.error('Error fetching available cycles:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleActivateCycle = (cycle: GlobalCycle, weekStartDay: 'sunday' | 'monday') => {
    setSelectedCycleForActivation(cycle);
    setSelectedWeekStartDay(weekStartDay);

    if (activeTimeline && activeTimeline.goals && activeTimeline.goals.length > 0) {
      setShowActivationWarning(true);
    } else {
      confirmActivation();
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

  const handleDeactivateTimeline = () => {
    if (!activeTimeline) return;
    setShowDeactivationWarning(true);
  };

  const confirmDeactivation = async () => {
    if (!activeTimeline) return;

    setDeactivating(true);
    setShowDeactivationWarning(false);

    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase.rpc('fn_deactivate_user_global_timeline', {
        p_user_global_timeline_id: activeTimeline.id
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
    }
  };

  const renderActiveTimeline = () => {
    if (!activeTimeline) {
      return (
        <View style={styles.emptySection}>
          <Calendar size={48} color="#6b7280" />
          <Text style={styles.emptyTitle}>No Active Global Timeline</Text>
          <Text style={styles.emptyText}>
            Activate a global timeline below to start tracking your 12-week goals
          </Text>
        </View>
      );
    }

    const startDate = activeTimeline.start_date ? new Date(activeTimeline.start_date) : null;
    const endDate = activeTimeline.end_date ? new Date(activeTimeline.end_date) : null;
    let daysRemaining = 0;
    let progress = 0;

    if (startDate && endDate) {
      const now = new Date();
      daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      progress = Math.min(100, Math.max(0, ((now.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100));
    }

    const displayTitle = activeTimeline.title || activeTimeline.global_cycle?.title || activeTimeline.global_cycle?.cycle_label || 'Global Timeline';
    const goalCount = activeTimeline.goals?.filter(g => g.status === 'active').length || 0;

    return (
      <View style={styles.activeTimelineCard}>
        <View style={styles.activeTimelineHeader}>
          <View style={styles.activeTimelineInfo}>
            <Text style={styles.activeTimelineTitle}>{displayTitle}</Text>
            <Text style={styles.activeTimelineDates}>
              {activeTimeline.start_date && activeTimeline.end_date
                ? formatDateRange(activeTimeline.start_date, activeTimeline.end_date)
                : 'Invalid date'}
            </Text>
            <Text style={styles.activeTimelineStats}>
              {goalCount} active goals • {daysRemaining} days remaining
            </Text>
            <Text style={styles.weekStartInfo}>
              Week starts: {activeTimeline.week_start_day === 'sunday' ? 'Sunday' : 'Monday'}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        <TouchableOpacity
          style={styles.deactivateButton}
          onPress={handleDeactivateTimeline}
          disabled={deactivating}
        >
          {deactivating ? (
            <ActivityIndicator size="small" color="#dc2626" />
          ) : (
            <>
              <X size={16} color="#dc2626" />
              <Text style={styles.deactivateButtonText}>Deactivate Timeline</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
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
          const displayTitle = cycle.title || cycle.cycle_label || 'Global 12-Week Cycle';

          return (
            <View key={cycle.id} style={styles.availableCycleCard}>
              <View style={styles.cycleCardHeader}>
                <Text style={styles.cycleTitle}>{displayTitle}</Text>
                <Text style={styles.cycleDates}>
                  {formatDateRange(cycle.start_date, cycle.end_date)}
                </Text>
              </View>

              <Text style={styles.weekStartLabel}>Choose your week start day:</Text>
              <View style={styles.weekStartOptions}>
                <TouchableOpacity
                  style={styles.activateOptionButton}
                  onPress={() => handleActivateCycle(cycle, 'sunday')}
                  disabled={activating}
                >
                  <Text style={styles.activateOptionText}>Sunday</Text>
                  <ChevronRight size={16} color="#0078d4" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.activateOptionButton}
                  onPress={() => handleActivateCycle(cycle, 'monday')}
                  disabled={activating}
                >
                  <Text style={styles.activateOptionText}>Monday</Text>
                  <ChevronRight size={16} color="#0078d4" />
                </TouchableOpacity>
              </View>
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
          <Text style={styles.modalTitle}>Manage Global Timelines</Text>
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
              <Text style={styles.sectionTitle}>Active Timeline</Text>
              <Text style={styles.sectionSubtitle}>
                Your currently active global 12-week timeline
              </Text>
              {renderActiveTimeline()}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Manage Global</Text>
              <Text style={styles.sectionSubtitle}>
                Upcoming global 12-week cycles available for activation
              </Text>
              {renderAvailableCycles()}
            </View>
          </ScrollView>
        )}

        {/* Activation Warning Modal */}
        <Modal
          visible={showActivationWarning}
          transparent
          animationType="fade"
          onRequestClose={() => setShowActivationWarning(false)}
        >
          <View style={styles.warningOverlay}>
            <View style={styles.warningModal}>
              <View style={styles.warningHeader}>
                <AlertTriangle size={32} color="#dc2626" />
                <Text style={styles.warningTitle}>Warning: Data Loss</Text>
              </View>

              <Text style={styles.warningMessage}>
                Activating a new global timeline will deactivate your current timeline and delete all associated goals and actions.
              </Text>

              <Text style={styles.warningDetails}>
                Current timeline has {activeTimeline?.goals?.length || 0} active goals that will be permanently deleted.
              </Text>

              <View style={styles.warningButtons}>
                <TouchableOpacity
                  style={styles.warningCancelButton}
                  onPress={() => {
                    setShowActivationWarning(false);
                    setSelectedCycleForActivation(null);
                  }}
                >
                  <Text style={styles.warningCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.warningConfirmButton}
                  onPress={confirmActivation}
                  disabled={activating}
                >
                  {activating ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.warningConfirmText}>Activate Anyway</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
                This timeline has {activeTimeline?.goals?.length || 0} active goals that will be permanently deleted.
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
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
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
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
  deactivateButton: {
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
  deactivateButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
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
  cycleCardHeader: {
    marginBottom: 12,
  },
  cycleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  cycleDates: {
    fontSize: 14,
    color: '#0078d4',
    fontWeight: '500',
  },
  weekStartLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  weekStartOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  activateOptionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0078d4',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  activateOptionText: {
    color: '#0078d4',
    fontSize: 14,
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
});
