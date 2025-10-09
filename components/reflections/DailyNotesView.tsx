import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import RichTextInput from './RichTextInput';
import RichTextDisplay from './RichTextDisplay';
import { Reflection, Role, Domain, UnifiedGoal } from '@/types/reflections';
import { X, Save, ChevronDown, ChevronUp } from 'lucide-react-native';

export default function DailyNotesView() {
  const { colors } = useTheme();
  const [content, setContent] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [goals, setGoals] = useState<UnifiedGoal[]>([]);

  const [previousNotes, setPreviousNotes] = useState<Reflection[]>([]);
  const [selectedNote, setSelectedNote] = useState<Reflection | null>(null);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [rolesExpanded, setRolesExpanded] = useState(false);
  const [domainsExpanded, setDomainsExpanded] = useState(false);
  const [goalsExpanded, setGoalsExpanded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Run archiving in background
      archiveOldReflections();

      await Promise.all([
        fetchRoles(),
        fetchDomains(),
        fetchGoals(),
        fetchPreviousNotes(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const archiveOldReflections = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await supabase.rpc('archive_old_reflections', { p_user_id: user.id });
    } catch (error) {
      console.error('Error archiving reflections:', error);
    }
  };

  const fetchRoles = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('0008-ap-roles')
      .select('id, label, color')
      .eq('user_id', user.id)
      .order('label');

    if (!error && data) {
      setRoles(data);
    }
  };

  const fetchDomains = async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('0008-ap-domains')
      .select('id, name, color')
      .order('name');

    if (!error && data) {
      setDomains(data);
    }
  };

  const fetchGoals = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('v_unified_goals')
      .select('id, title, goal_type, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('title');

    if (!error && data) {
      setGoals(data);
    }
  };

  const fetchPreviousNotes = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('0008-ap-reflections')
      .select('*')
      .eq('user_id', user.id)
      .eq('reflection_type', 'daily')
      .eq('archived', false)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(7);

    if (!error && data) {
      setPreviousNotes(data);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Error', 'Please add some content to your note');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const today = new Date().toISOString().split('T')[0];

      // Insert reflection
      const { data: reflection, error: reflectionError } = await supabase
        .from('0008-ap-reflections')
        .insert({
          user_id: user.id,
          reflection_type: 'daily',
          date: today,
          content,
          authentic_score: 0, // Calculate if needed
        })
        .select()
        .single();

      if (reflectionError) throw reflectionError;

      // Insert role associations
      if (selectedRoleIds.length > 0) {
        const roleInserts = selectedRoleIds.map(roleId => ({
          parent_id: reflection.id,
          parent_type: 'reflection',
          role_id: roleId,
        }));

        await supabase
          .from('0008-ap-universal-roles-join')
          .insert(roleInserts);
      }

      // Insert domain associations
      if (selectedDomainIds.length > 0) {
        const domainInserts = selectedDomainIds.map(domainId => ({
          parent_id: reflection.id,
          parent_type: 'reflection',
          domain_id: domainId,
        }));

        await supabase
          .from('0008-ap-universal-domains-join')
          .insert(domainInserts);
      }

      // Insert goal associations
      if (selectedGoalIds.length > 0) {
        const goalInserts = selectedGoalIds.map(goalId => {
          const goal = goals.find(g => g.id === goalId);
          return {
            parent_id: reflection.id,
            parent_type: 'reflection',
            twelve_wk_goal_id: goal?.goal_type === '12week' ? goalId : null,
            custom_goal_id: goal?.goal_type === 'custom' ? goalId : null,
            goal_type: goal?.goal_type === '12week' ? 'twelve_wk_goal' : 'custom_goal',
          };
        });

        await supabase
          .from('0008-ap-universal-goals-join')
          .insert(goalInserts);
      }

      Alert.alert('Success', 'Daily note saved successfully');

      // Reset form
      setContent('');
      setSelectedRoleIds([]);
      setSelectedDomainIds([]);
      setSelectedGoalIds([]);

      // Refresh previous notes
      fetchPreviousNotes();
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelection = (id: string, selected: string[], setter: (ids: string[]) => void) => {
    if (selected.includes(id)) {
      setter(selected.filter(item => item !== id));
    } else {
      setter([...selected, id]);
    }
  };

  const renderCheckboxGrid = (
    title: string,
    items: any[],
    selectedIds: string[],
    onToggle: (id: string) => void,
    expanded: boolean,
    setExpanded: (val: boolean) => void,
    labelKey: string = 'label'
  ) => (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        {expanded ? (
          <ChevronUp size={20} color={colors.textSecondary} />
        ) : (
          <ChevronDown size={20} color={colors.textSecondary} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.checkboxGrid}>
          {items.map(item => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.checkboxItem,
                  { borderColor: colors.border, backgroundColor: colors.background },
                  isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => onToggle(item.id)}
              >
                <Text
                  style={[
                    styles.checkboxText,
                    { color: colors.text },
                    isSelected && { color: '#ffffff' }
                  ]}
                  numberOfLines={1}
                >
                  {item[labelKey] || item.name || item.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Note Input Section */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Daily Note</Text>
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary },
                (!content.trim() || saving) && { backgroundColor: colors.textSecondary }
              ]}
              onPress={handleSave}
              disabled={!content.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Save size={16} color="#ffffff" />
                  <Text style={styles.saveButtonText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <RichTextInput
            value={content}
            onChangeText={setContent}
            placeholder="What happened today? What are you grateful for?"
            minHeight={150}
          />
        </View>

        {/* Associations */}
        {renderCheckboxGrid(
          'Roles',
          roles,
          selectedRoleIds,
          (id) => toggleSelection(id, selectedRoleIds, setSelectedRoleIds),
          rolesExpanded,
          setRolesExpanded
        )}

        {renderCheckboxGrid(
          'Wellness Domains',
          domains,
          selectedDomainIds,
          (id) => toggleSelection(id, selectedDomainIds, setSelectedDomainIds),
          domainsExpanded,
          setDomainsExpanded,
          'name'
        )}

        {renderCheckboxGrid(
          'Active Goals',
          goals,
          selectedGoalIds,
          (id) => toggleSelection(id, selectedGoalIds, setSelectedGoalIds),
          goalsExpanded,
          setGoalsExpanded,
          'title'
        )}

        {/* Previous Notes */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Recent Notes</Text>

          {previousNotes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No notes yet. Start journaling!
              </Text>
            </View>
          ) : (
            <View style={styles.notesList}>
              {previousNotes.map(note => (
                <TouchableOpacity
                  key={note.id}
                  style={[styles.noteCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => {
                    setSelectedNote(note);
                    setIsViewModalVisible(true);
                  }}
                >
                  <View style={styles.noteHeader}>
                    <Text style={[styles.noteDate, { color: colors.text }]}>
                      {formatDate(note.date)}
                    </Text>
                    <Text style={[styles.noteScore, { color: colors.primary }]}>
                      Score: {note.authentic_score}
                    </Text>
                  </View>
                  <Text
                    style={[styles.notePreview, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {note.content.substring(0, 100)}...
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* View Note Modal */}
      <Modal visible={isViewModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {selectedNote && formatDate(selectedNote.date)}
            </Text>
            <TouchableOpacity onPress={() => setIsViewModalVisible(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedNote && (
              <RichTextDisplay content={selectedNote.content} />
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  checkboxItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  checkboxText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  notesList: {
    gap: 12,
    marginTop: 12,
  },
  noteCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: '#0078d4',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  noteScore: {
    fontSize: 12,
    fontWeight: '500',
  },
  notePreview: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
});
