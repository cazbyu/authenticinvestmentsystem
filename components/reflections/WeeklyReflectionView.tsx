import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import {
  getWeekDateRange,
  fetchWeeklyAggregationData,
} from '@/lib/weeklyReflectionData';
import RichTextInput from './RichTextInput';
import RichTextDisplay from './RichTextDisplay';
import { WeeklyAggregationData, Reflection, Role, Domain, UnifiedGoal } from '@/types/reflections';
import { ChevronDown, ChevronUp, Save, Target, Users, Activity, AlertCircle, X } from 'lucide-react-native';

export default function WeeklyReflectionView() {
  const { colors } = useTheme();
  const [weekRange, setWeekRange] = useState(getWeekDateRange());
  const [aggregationData, setAggregationData] = useState<WeeklyAggregationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [questionProud, setQuestionProud] = useState('');
  const [questionImpact, setQuestionImpact] = useState('');
  const [questionProgress, setQuestionProgress] = useState('');
  const [questionWithdrawals, setQuestionWithdrawals] = useState('');

  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [goals, setGoals] = useState<UnifiedGoal[]>([]);

  const [rolesExpanded, setRolesExpanded] = useState(false);
  const [domainsExpanded, setDomainsExpanded] = useState(false);
  const [goalsExpanded, setGoalsExpanded] = useState(false);

  const [previousReflections, setPreviousReflections] = useState<Reflection[]>([]);
  const [selectedReflection, setSelectedReflection] = useState<Reflection | null>(null);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);

  const [currentReflection, setCurrentReflection] = useState<Reflection | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Run archiving in background
      archiveOldReflections();

      await Promise.all([
        fetchWeeklyData(),
        fetchCurrentReflection(),
        fetchRoles(),
        fetchDomains(),
        fetchGoals(),
        fetchPreviousReflections(),
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const fetchWeeklyData = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const data = await fetchWeeklyAggregationData(user.id, weekRange.start, weekRange.end);
    setAggregationData(data);
  };

  const fetchCurrentReflection = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('0008-ap-reflections')
      .select('*')
      .eq('user_id', user.id)
      .eq('reflection_type', 'weekly')
      .eq('week_start_date', weekRange.start)
      .maybeSingle();

    if (!error && data) {
      setCurrentReflection(data);
      setQuestionProud(data.question_proud || '');
      setQuestionImpact(data.question_impact || '');
      setQuestionProgress(data.question_progress || '');
      setQuestionWithdrawals(data.question_withdrawals || '');
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

  const fetchPreviousReflections = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('0008-ap-reflections')
      .select('*')
      .eq('user_id', user.id)
      .eq('reflection_type', 'weekly')
      .eq('archived', false)
      .neq('week_start_date', weekRange.start)
      .order('week_start_date', { ascending: false })
      .limit(12);

    if (!error && data) {
      setPreviousReflections(data);
    }
  };

  const handleSave = async () => {
    if (!questionProud && !questionImpact && !questionProgress && !questionWithdrawals) {
      Alert.alert('Error', 'Please answer at least one reflective question');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      let reflectionId = currentReflection?.id;

      if (currentReflection) {
        // Update existing reflection
        const { error } = await supabase
          .from('0008-ap-reflections')
          .update({
            question_proud: questionProud,
            question_impact: questionImpact,
            question_progress: questionProgress,
            question_withdrawals: questionWithdrawals,
            weekly_target_completion: aggregationData?.totalTargetsHit || 0,
            total_goals_tracked: aggregationData?.totalGoalsTracked || 0,
          })
          .eq('id', currentReflection.id);

        if (error) throw error;
      } else {
        // Create new reflection
        const { data, error } = await supabase
          .from('0008-ap-reflections')
          .insert({
            user_id: user.id,
            reflection_type: 'weekly',
            date: weekRange.start,
            week_start_date: weekRange.start,
            week_end_date: weekRange.end,
            content: '', // Not used for weekly
            question_proud: questionProud,
            question_impact: questionImpact,
            question_progress: questionProgress,
            question_withdrawals: questionWithdrawals,
            weekly_target_completion: aggregationData?.totalTargetsHit || 0,
            total_goals_tracked: aggregationData?.totalGoalsTracked || 0,
            authentic_score: 0,
          })
          .select()
          .single();

        if (error) throw error;
        reflectionId = data.id;
        setCurrentReflection(data);
      }

      // Delete existing associations and re-insert
      if (reflectionId) {
        await supabase
          .from('0008-ap-universal-roles-join')
          .delete()
          .eq('parent_id', reflectionId)
          .eq('parent_type', 'reflection');

        await supabase
          .from('0008-ap-universal-domains-join')
          .delete()
          .eq('parent_id', reflectionId)
          .eq('parent_type', 'reflection');

        await supabase
          .from('0008-ap-universal-goals-join')
          .delete()
          .eq('parent_id', reflectionId)
          .eq('parent_type', 'reflection');

        // Insert role associations
        if (selectedRoleIds.length > 0) {
          const roleInserts = selectedRoleIds.map(roleId => ({
            parent_id: reflectionId,
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
            parent_id: reflectionId,
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
              parent_id: reflectionId,
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
      }

      Alert.alert('Success', 'Weekly reflection saved successfully');
      fetchPreviousReflections();
    } catch (error) {
      console.error('Error saving reflection:', error);
      Alert.alert('Error', 'Failed to save reflection');
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

  const formatWeekRange = () => {
    const start = new Date(weekRange.start);
    const end = new Date(weekRange.end);

    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.content}>
        {/* Week Title */}
        <Text style={[styles.weekTitle, { color: colors.text }]}>
          Weekly Reflection - {formatWeekRange()}
        </Text>

        {/* Leading Indicators */}
        {aggregationData && (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <Target size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Leading Indicators Review</Text>
              </View>

              {aggregationData.totalGoalsTracked === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No active goals tracked this week. Add goals in Goal Bank.
                </Text>
              ) : (
                <>
                  <Text style={[styles.highlightText, { color: colors.primary }]}>
                    You hit {aggregationData.totalTargetsHit} of {aggregationData.totalGoalsTracked} weekly targets
                  </Text>

                  <View style={styles.goalsList}>
                    {aggregationData.goalProgress.map(goal => (
                      <View key={goal.goal_id} style={styles.goalItem}>
                        <Text style={[styles.goalTitle, { color: colors.text }]}>
                          {goal.goal_title}
                        </Text>
                        <View style={styles.goalProgress}>
                          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                            <View
                              style={[
                                styles.progressFill,
                                { backgroundColor: colors.primary, width: `${Math.min(goal.completion_percentage, 100)}%` }
                              ]}
                            />
                          </View>
                          <Text style={[styles.goalStats, { color: colors.textSecondary }]}>
                            {goal.actual_completion} / {goal.weekly_target}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* Role Investment */}
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <Users size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Role Investment Summary</Text>
              </View>

              {aggregationData.roleInvestments.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No role investments tracked this week
                </Text>
              ) : (
                <View style={styles.rolesList}>
                  {aggregationData.roleInvestments.map(role => (
                    <View key={role.role_id} style={styles.roleItem}>
                      <Text style={[styles.roleText, { color: colors.text }]}>
                        {role.role_label} with {role.task_count} {role.task_count === 1 ? 'task' : 'tasks'} or events
                      </Text>
                      {role.deposit_idea_count > 0 && (
                        <Text style={[styles.depositText, { color: colors.textSecondary }]}>
                          You created {role.deposit_idea_count} Deposit {role.deposit_idea_count === 1 ? 'Idea' : 'Ideas'} for this role
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Domain Balance */}
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <Activity size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Wellness Domain Balance</Text>
              </View>

              {aggregationData.domainBalance.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No wellness domain activities tracked this week
                </Text>
              ) : (
                <View style={styles.domainsList}>
                  {aggregationData.domainBalance.map(domain => (
                    <View key={domain.domain_id} style={styles.domainItem}>
                      <Text style={[styles.domainText, { color: colors.text }]}>
                        {domain.domain_name}: {domain.activity_count} {domain.activity_count === 1 ? 'activity' : 'activities'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Withdrawals */}
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <AlertCircle size={24} color={aggregationData.withdrawalAnalysis.length > 0 ? '#f59e0b' : '#10b981'} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Withdrawals and Lessons</Text>
              </View>

              {aggregationData.withdrawalAnalysis.length === 0 ? (
                <Text style={[styles.successText, { color: '#10b981' }]}>
                  You listed no withdrawals this week
                </Text>
              ) : (
                <View>
                  <Text style={[styles.warningText, { color: '#f59e0b' }]}>
                    You had the most withdrawals in the following role(s):
                  </Text>
                  <View style={styles.withdrawalsList}>
                    {aggregationData.withdrawalAnalysis.slice(0, 3).map(withdrawal => (
                      <Text key={withdrawal.role_id} style={[styles.withdrawalText, { color: colors.text }]}>
                        • {withdrawal.role_label} ({withdrawal.withdrawal_count} {withdrawal.withdrawal_count === 1 ? 'withdrawal' : 'withdrawals'})
                      </Text>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {/* Reflective Questions */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Reflective Questions</Text>
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary },
                saving && { backgroundColor: colors.textSecondary }
              ]}
              onPress={handleSave}
              disabled={saving}
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

          <View style={styles.questionsContainer}>
            <View style={styles.questionField}>
              <Text style={[styles.questionLabel, { color: colors.text }]}>
                What were you most proud of this week?
              </Text>
              <RichTextInput
                value={questionProud}
                onChangeText={setQuestionProud}
                placeholder="Reflect on your achievements..."
                minHeight={100}
              />
            </View>

            <View style={styles.questionField}>
              <Text style={[styles.questionLabel, { color: colors.text }]}>
                Which deposits had the biggest impact?
              </Text>
              <RichTextInput
                value={questionImpact}
                onChangeText={setQuestionImpact}
                placeholder="Consider your most meaningful activities..."
                minHeight={100}
              />
            </View>

            <View style={styles.questionField}>
              <Text style={[styles.questionLabel, { color: colors.text }]}>
                What progress did you make towards your goals?
              </Text>
              <RichTextInput
                value={questionProgress}
                onChangeText={setQuestionProgress}
                placeholder="Evaluate your goal progress..."
                minHeight={100}
              />
            </View>

            <View style={styles.questionField}>
              <Text style={[styles.questionLabel, { color: colors.text }]}>
                What were my biggest withdrawals and how can I prevent similar withdrawals next week?
              </Text>
              <RichTextInput
                value={questionWithdrawals}
                onChangeText={setQuestionWithdrawals}
                placeholder="Learn from challenges..."
                minHeight={100}
              />
            </View>
          </View>
        </View>

        {/* Associations */}
        {renderCheckboxGrid(
          'Associated Roles',
          roles,
          selectedRoleIds,
          (id) => toggleSelection(id, selectedRoleIds, setSelectedRoleIds),
          rolesExpanded,
          setRolesExpanded
        )}

        {renderCheckboxGrid(
          'Associated Domains',
          domains,
          selectedDomainIds,
          (id) => toggleSelection(id, selectedDomainIds, setSelectedDomainIds),
          domainsExpanded,
          setDomainsExpanded,
          'name'
        )}

        {renderCheckboxGrid(
          'Associated Goals',
          goals,
          selectedGoalIds,
          (id) => toggleSelection(id, selectedGoalIds, setSelectedGoalIds),
          goalsExpanded,
          setGoalsExpanded,
          'title'
        )}

        {/* Previous Reflections */}
        {previousReflections.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Previous Weekly Reflections</Text>

            <View style={styles.previousList}>
              {previousReflections.map(reflection => (
                <TouchableOpacity
                  key={reflection.id}
                  style={[styles.previousCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => {
                    setSelectedReflection(reflection);
                    setIsViewModalVisible(true);
                  }}
                >
                  <Text style={[styles.previousWeek, { color: colors.text }]}>
                    {new Date(reflection.week_start_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
                    {new Date(reflection.week_end_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={[styles.previousPreview, { color: colors.textSecondary }]} numberOfLines={2}>
                    {reflection.question_proud?.substring(0, 80)}...
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* View Reflection Modal */}
      <Modal visible={isViewModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {selectedReflection &&
                `${new Date(selectedReflection.week_start_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(selectedReflection.week_end_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              }
            </Text>
            <TouchableOpacity onPress={() => setIsViewModalVisible(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedReflection && (
              <View>
                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                    What were you most proud of?
                  </Text>
                  <RichTextDisplay content={selectedReflection.question_proud || 'No response'} />
                </View>

                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                    Which deposits had the biggest impact?
                  </Text>
                  <RichTextDisplay content={selectedReflection.question_impact || 'No response'} />
                </View>

                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                    What progress did you make?
                  </Text>
                  <RichTextDisplay content={selectedReflection.question_progress || 'No response'} />
                </View>

                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                    Withdrawals and lessons learned
                  </Text>
                  <RichTextDisplay content={selectedReflection.question_withdrawals || 'No response'} />
                </View>
              </View>
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
  weekTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
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
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
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
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  highlightText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  goalsList: {
    gap: 12,
  },
  goalItem: {
    gap: 6,
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  goalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalStats: {
    fontSize: 12,
    minWidth: 50,
  },
  rolesList: {
    gap: 12,
  },
  roleItem: {
    gap: 4,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  depositText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  domainsList: {
    gap: 8,
  },
  domainItem: {},
  domainText: {
    fontSize: 14,
  },
  successText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 8,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  withdrawalsList: {
    gap: 6,
    marginTop: 8,
  },
  withdrawalText: {
    fontSize: 14,
  },
  questionsContainer: {
    gap: 24,
  },
  questionField: {
    gap: 8,
  },
  questionLabel: {
    fontSize: 15,
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
  previousList: {
    gap: 12,
    marginTop: 12,
  },
  previousCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: '#0078d4',
  },
  previousWeek: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  previousPreview: {
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
    flex: 1,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
});
