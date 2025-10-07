import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Archive, RotateCcw, Trash2, ChevronDown, ChevronUp, Users, Target } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { formatDateRange } from '@/lib/dateUtils';

interface ArchivedTimeline {
  id: string;
  source: 'custom' | 'global';
  title?: string;
  start_date: string;
  end_date: string;
  updated_at: string;
  goal_count: number;
  global_cycle?: {
    title?: string;
    cycle_label?: string;
    start_date: string;
    end_date: string;
  };
}

interface ArchivedTimelinesViewProps {
  onUpdate?: () => void;
}

export function ArchivedTimelinesView({ onUpdate }: ArchivedTimelinesViewProps) {
  const [loading, setLoading] = useState(false);
  const [customTimelines, setCustomTimelines] = useState<ArchivedTimeline[]>([]);
  const [globalTimelines, setGlobalTimelines] = useState<ArchivedTimeline[]>([]);
  const [expandedTimeline, setExpandedTimeline] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<'custom' | 'global' | null>(null);

  useEffect(() => {
    fetchArchivedTimelines();
  }, []);

  const fetchArchivedTimelines = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch archived custom timelines with goal counts
      const { data: customData, error: customError } = await supabase
        .from('0008-ap-custom-timelines')
        .select(`
          *,
          goals:0008-ap-goals-custom(id, status)
        `)
        .eq('user_id', user.id)
        .eq('status', 'archived')
        .order('updated_at', { ascending: false });

      if (customError) throw customError;

      const customTimelinesData: ArchivedTimeline[] = (customData || []).map(tl => ({
        id: tl.id,
        source: 'custom' as const,
        title: tl.title,
        start_date: tl.start_date,
        end_date: tl.end_date,
        updated_at: tl.updated_at,
        goal_count: tl.goals?.length || 0,
      }));

      // Fetch archived global timelines with goal counts
      const { data: globalData, error: globalError } = await supabase
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
            title,
            cycle_label,
            start_date,
            end_date
          ),
          goals:0008-ap-goals-12wk(id, status)
        `)
        .eq('user_id', user.id)
        .eq('status', 'archived')
        .order('updated_at', { ascending: false });

      if (globalError) throw globalError;

      const globalTimelinesData: ArchivedTimeline[] = (globalData || []).map(tl => ({
        id: tl.id,
        source: 'global' as const,
        title: tl.global_cycle?.title || tl.global_cycle?.cycle_label,
        start_date: tl.global_cycle?.start_date || '',
        end_date: tl.global_cycle?.end_date || '',
        updated_at: tl.updated_at,
        goal_count: tl.goals?.length || 0,
        global_cycle: tl.global_cycle,
      }));

      setCustomTimelines(customTimelinesData);
      setGlobalTimelines(globalTimelinesData);
    } catch (error) {
      console.error('Error fetching archived timelines:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreTimeline = async (timeline: ArchivedTimeline) => {
    const timelineTitle = timeline.title || timeline.global_cycle?.title || timeline.global_cycle?.cycle_label || 'this timeline';

    Alert.alert(
      'Restore Timeline',
      `Are you sure you want to restore "${timelineTitle}" to active status?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              const tableName = timeline.source === 'custom'
                ? '0008-ap-custom-timelines'
                : '0008-ap-user-global-timelines';

              const { error } = await supabase
                .from(tableName)
                .update({
                  status: 'active',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', timeline.id);

              if (error) throw error;

              Alert.alert('Success', 'Timeline restored successfully!');
              fetchArchivedTimelines();
              onUpdate?.();
            } catch (error) {
              console.error('Error restoring timeline:', error);
              Alert.alert('Error', (error as Error).message);
            }
          }
        }
      ]
    );
  };

  const handleDeleteTimeline = async (timeline: ArchivedTimeline) => {
    const timelineTitle = timeline.title || timeline.global_cycle?.title || timeline.global_cycle?.cycle_label || 'this timeline';

    Alert.alert(
      'Permanently Delete Timeline',
      `Are you sure you want to permanently delete "${timelineTitle}"? This action cannot be undone and will remove all associated goals.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              const tableName = timeline.source === 'custom'
                ? '0008-ap-custom-timelines'
                : '0008-ap-user-global-timelines';

              const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('id', timeline.id);

              if (error) throw error;

              Alert.alert('Success', 'Timeline permanently deleted');
              fetchArchivedTimelines();
              onUpdate?.();
            } catch (error) {
              console.error('Error deleting timeline:', error);
              Alert.alert('Error', (error as Error).message);
            }
          }
        }
      ]
    );
  };

  const renderTimelineCard = (timeline: ArchivedTimeline) => {
    const displayTitle = timeline.title || timeline.global_cycle?.title || timeline.global_cycle?.cycle_label || 'Untitled Timeline';
    const isExpanded = expandedTimeline === timeline.id;
    const archivedDate = new Date(timeline.updated_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return (
      <View key={timeline.id} style={styles.timelineCard}>
        <TouchableOpacity
          style={styles.timelineHeader}
          onPress={() => setExpandedTimeline(isExpanded ? null : timeline.id)}
        >
          <View style={styles.timelineHeaderLeft}>
            {timeline.source === 'global' ? (
              <Users size={20} color="#0078d4" />
            ) : (
              <Target size={20} color="#7c3aed" />
            )}
            <View style={styles.timelineInfo}>
              <Text style={styles.timelineTitle} numberOfLines={1}>
                {displayTitle}
              </Text>
              <Text style={styles.timelineMeta}>
                {formatDateRange(timeline.start_date, timeline.end_date)} • {timeline.goal_count} goals
              </Text>
              <Text style={styles.archivedDate}>
                Archived: {archivedDate}
              </Text>
            </View>
          </View>
          {isExpanded ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.timelineActions}>
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={() => handleRestoreTimeline(timeline)}
            >
              <RotateCcw size={16} color="#16a34a" />
              <Text style={styles.restoreButtonText}>Restore</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteTimeline(timeline)}
            >
              <Trash2 size={16} color="#dc2626" />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderSection = (
    type: 'custom' | 'global',
    timelines: ArchivedTimeline[],
    title: string,
    icon: React.ReactNode
  ) => {
    const isExpanded = expandedSection === type;

    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setExpandedSection(isExpanded ? null : type)}
        >
          <View style={styles.sectionHeaderLeft}>
            {icon}
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{timelines.length}</Text>
            </View>
          </View>
          {isExpanded ? <ChevronUp size={24} color="#6b7280" /> : <ChevronDown size={24} color="#6b7280" />}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.sectionContent}>
            {timelines.length === 0 ? (
              <Text style={styles.emptyText}>
                No archived {type} timelines
              </Text>
            ) : (
              timelines.map(renderTimelineCard)
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0078d4" />
        <Text style={styles.loadingText}>Loading archived timelines...</Text>
      </View>
    );
  }

  const totalArchived = customTimelines.length + globalTimelines.length;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Archive size={24} color="#6b7280" />
          <Text style={styles.headerTitle}>Timeline Archive</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          View and manage archived timelines. Restore them to active status or permanently delete them.
        </Text>
        {totalArchived > 0 && (
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>
              {totalArchived} archived timeline{totalArchived !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {totalArchived === 0 ? (
        <View style={styles.emptyContainer}>
          <Archive size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No Archived Timelines</Text>
          <Text style={styles.emptyDescription}>
            Timelines you archive will appear here for future reference or restoration.
          </Text>
        </View>
      ) : (
        <View style={styles.sectionsContainer}>
          {renderSection(
            'global',
            globalTimelines,
            'Global Timelines',
            <Users size={20} color="#0078d4" />
          )}
          {renderSection(
            'custom',
            customTimelines,
            'Custom Timelines',
            <Target size={20} color="#7c3aed" />
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  header: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  totalBadge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  totalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionsContainer: {
    padding: 16,
    gap: 16,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  countBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  sectionContent: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    padding: 16,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
  timelineCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6b7280',
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  timelineHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  timelineInfo: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  timelineMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  archivedDate: {
    fontSize: 11,
    color: '#9ca3af',
  },
  timelineActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 12,
    gap: 12,
  },
  restoreButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    paddingVertical: 10,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    paddingVertical: 10,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
});
