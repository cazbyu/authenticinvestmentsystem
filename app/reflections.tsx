import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { getSupabaseClient } from '@/lib/supabase';
import { BookOpen, Calendar, Target, Save, Plus, FileText, CheckSquare } from 'lucide-react-native';

interface ReflectionEntry {
  id: string;
  type: 'daily' | 'weekly' | 'planning';
  content: string;
  created_at: string;
  updated_at: string;
}

const DAILY_TEMPLATE = `# Daily Reflection - {date}

## Deposits Made Today
- What authentic investments did I make in my roles?
- Which domains received attention?
- What progress was made toward my 12-week goals?

## Withdrawals/Obstacles
- What drained my authentic investment account?
- What obstacles did I encounter?
- What would I do differently?

## Current Balance
- How do I feel about my authentic investment balance today?
- What's one thing I'm grateful for?
- What's my focus for tomorrow?

---
Notes:`;

const WEEKLY_TEMPLATE = `# Weekly Reflection - Week of {date}

## Leading Indicators Review
- How many weekly targets did I hit for my 12-week goals?
- Which roles received the most authentic investment?
- What patterns do I notice in my deposits?

## Balance Across Life Domains
- Physical: 
- Emotional: 
- Intellectual: 
- Social: 
- Financial: 
- Spiritual: 
- Community: 
- Recreational: 

## Withdrawals & Lessons
- What were my biggest withdrawals this week?
- What did I learn from challenges?
- How can I prevent similar withdrawals next week?

## Wins & Celebrations
- What am I most proud of this week?
- Which authentic deposits had the biggest impact?
- What progress did I make toward my 12-week goals?

---
Notes:`;

const PLANNING_TEMPLATE = `# Weekly Planning - Week of {date}

## Mission Statement Review
- [ ] Read and reflect on my personal mission statement
- [ ] Does this week's plan align with my mission?
- [ ] Any adjustments needed to stay on track?

## Roles & Responsibilities Review
- [ ] Review each of my active roles
- [ ] Identify key relationships needing attention
- [ ] Plan authentic deposits for each role

## Strategic Documents Review
- [ ] Review my vision and long-term goals
- [ ] Check progress on 12-week goals
- [ ] Assess wellness domain balance
- [ ] Review any strategic documents or plans

## Key Deposits Selection
- [ ] Identify 3-5 high-impact deposits for this week
- [ ] Ensure deposits span multiple roles/domains
- [ ] Prioritize authentic deposit opportunities
- [ ] Plan deposits that advance 12-week goals

## Calendar Scheduling
- [ ] Block time for weekly priorities
- [ ] Schedule important but not urgent tasks
- [ ] Plan key relationship investments
- [ ] Reserve time for reflection and planning

## Weekly Intentions
- Primary focus for this week:
- Key relationships to invest in:
- Main 12-week goal progress target:
- Wellness domain to prioritize:

---
Notes:`;

export default function ReflectionsScreen() {
  const [activeTemplate, setActiveTemplate] = useState<'daily' | 'weekly' | 'planning'>('daily');
  const [reflectionContent, setReflectionContent] = useState('');
  const [previousEntries, setPreviousEntries] = useState<ReflectionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authenticScore, setAuthenticScore] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<ReflectionEntry | null>(null);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);

  useEffect(() => {
    loadTemplate();
    fetchPreviousEntries();
    calculateAuthenticScore();
  }, [activeTemplate]);

  const calculateTaskPoints = (task: any, roles: any[] = [], domains: any[] = []) => {
    let points = 0;
    if (roles && roles.length > 0) points += roles.length;
    if (domains && domains.length > 0) points += domains.length;
    if (task.is_authentic_deposit) points += 2;
    if (task.is_urgent && task.is_important) points += 1.5;
    else if (!task.is_urgent && task.is_important) points += 3;
    else if (task.is_urgent && !task.is_important) points += 1;
    else points += 0.5;
    if (task.is_twelve_week_goal) points += 2;
    return Math.round(points * 10) / 10;
  };

  const calculateAuthenticScore = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate deposits from completed tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .not('completed_at', 'is', null);

      if (tasksError) throw tasksError;

      let totalDeposits = 0;
      if (tasksData && tasksData.length > 0) {
        const taskIds = tasksData.map(t => t.id);
        const [
          { data: rolesData },
          { data: domainsData }
        ] = await Promise.all([
          supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task')
        ]);

        for (const task of tasksData) {
          const taskWithData = {
            ...task,
            roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
            domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
          };
          totalDeposits += calculateTaskPoints(task, taskWithData.roles, taskWithData.domains);
        }
      }

      // Calculate withdrawals
      const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from('0008-ap-withdrawals')
        .select('amount')
        .eq('user_id', user.id);

      if (withdrawalsError) throw withdrawalsError;

      const totalWithdrawals = withdrawalsData?.reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0) || 0;
      
      const balance = totalDeposits - totalWithdrawals;
      setAuthenticScore(Math.round(balance * 10) / 10);
    } catch (error) {
      console.error('Error calculating authentic score:', error);
    }
  };

  const loadTemplate = () => {
    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let template = '';
    switch (activeTemplate) {
      case 'daily':
        template = DAILY_TEMPLATE.replace('{date}', today);
        break;
      case 'weekly':
        template = WEEKLY_TEMPLATE.replace('{date}', today);
        break;
      case 'planning':
        template = PLANNING_TEMPLATE.replace('{date}', today);
        break;
    }
    setReflectionContent(template);
  };

  const fetchPreviousEntries = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-notes')
        .select('*')
        .eq('user_id', user.id)
        .like('content', `[${activeTemplate.toUpperCase()}_REFLECTION]%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const entries: ReflectionEntry[] = (data || []).map(note => ({
        id: note.id,
        type: activeTemplate,
        content: note.content,
        created_at: note.created_at,
        updated_at: note.updated_at,
      }));

      setPreviousEntries(entries);
    } catch (error) {
      console.error('Error fetching previous entries:', error);
    }
  };

  const handleSave = async () => {
    if (!reflectionContent.trim()) {
      Alert.alert('Error', 'Please add some content before saving');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Add a tag to identify the type of reflection
      const taggedContent = `[${activeTemplate.toUpperCase()}_REFLECTION]\n\n${reflectionContent}`;

      const { error } = await supabase
        .from('0008-ap-notes')
        .insert({
          user_id: user.id,
          content: taggedContent,
        });

      if (error) throw error;

      Alert.alert('Success', 'Reflection saved successfully');
      loadTemplate(); // Reset to fresh template
      fetchPreviousEntries(); // Refresh the list
    } catch (error) {
      console.error('Error saving reflection:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const formatEntryTitle = (entry: ReflectionEntry) => {
    const date = new Date(entry.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    const typeLabel = {
      daily: 'Daily',
      weekly: 'Weekly',
      planning: 'Planning'
    }[entry.type];

    return `${typeLabel} - ${date}`;
  };

  const getEntryPreview = (content: string) => {
    // Remove the tag and get first few lines
    const cleanContent = content.replace(/^\[.*?\]\s*\n\n/, '');
    const lines = cleanContent.split('\n').filter(line => line.trim());
    const preview = lines.slice(0, 3).join(' ').substring(0, 100);
    return preview + (preview.length >= 100 ? '...' : '');
  };

  const handleEntryPress = (entry: ReflectionEntry) => {
    setSelectedEntry(entry);
    setIsViewModalVisible(true);
  };

  const getTemplateIcon = (type: 'daily' | 'weekly' | 'planning') => {
    switch (type) {
      case 'daily':
        return BookOpen;
      case 'weekly':
        return Calendar;
      case 'planning':
        return CheckSquare;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Reflections" authenticScore={authenticScore} />
      
      {/* Template Selector */}
      <View style={styles.templateSelector}>
        {(['daily', 'weekly', 'planning'] as const).map((template) => {
          const IconComponent = getTemplateIcon(template);
          return (
            <TouchableOpacity
              key={template}
              style={[
                styles.templateButton,
                activeTemplate === template && styles.activeTemplateButton
              ]}
              onPress={() => setActiveTemplate(template)}
            >
              <IconComponent 
                size={16} 
                color={activeTemplate === template ? '#ffffff' : '#6b7280'} 
              />
              <Text style={[
                styles.templateButtonText,
                activeTemplate === template && styles.activeTemplateButtonText
              ]}>
                {template.charAt(0).toUpperCase() + template.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.content}>
        {/* Current Template */}
        <View style={styles.templateSection}>
          <View style={styles.templateHeader}>
            <Text style={styles.templateTitle}>
              {activeTemplate === 'daily' && 'Daily Journal Template'}
              {activeTemplate === 'weekly' && 'Weekly Journal Template'}
              {activeTemplate === 'planning' && 'Weekly Planning Checklist'}
            </Text>
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleSave}
              disabled={saving}
            >
              <Save size={16} color="#ffffff" />
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.templateInput}
            value={reflectionContent}
            onChangeText={setReflectionContent}
            multiline
            placeholder="Start writing your reflection..."
            placeholderTextColor="#9ca3af"
            textAlignVertical="top"
          />
        </View>

        {/* Previous Entries */}
        <View style={styles.previousSection}>
          <View style={styles.previousHeader}>
            <FileText size={20} color="#1f2937" />
            <Text style={styles.previousTitle}>Previous Entries</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading entries...</Text>
            </View>
          ) : previousEntries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No previous {activeTemplate} reflections found
              </Text>
            </View>
          ) : (
            <View style={styles.entriesList}>
              {previousEntries.map(entry => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.entryCard}
                  onPress={() => handleEntryPress(entry)}
                >
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryTitle}>
                      {formatEntryTitle(entry)}
                    </Text>
                    <Text style={styles.entryDate}>
                      {new Date(entry.created_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </Text>
                  </View>
                  <Text style={styles.entryPreview} numberOfLines={2}>
                    {getEntryPreview(entry.content)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Entry View Modal */}
      <Modal visible={isViewModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedEntry && formatEntryTitle(selectedEntry)}
            </Text>
            <TouchableOpacity onPress={() => setIsViewModalVisible(false)}>
              <Text style={styles.closeButton}>Done</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {selectedEntry && (
              <Text style={styles.entryContent}>
                {selectedEntry.content.replace(/^\[.*?\]\s*\n\n/, '')}
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  templateSelector: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  templateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  activeTemplateButton: {
    backgroundColor: '#0078d4',
  },
  templateButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTemplateButtonText: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  templateSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  templateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
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
  templateInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
    fontSize: 14,
    color: '#1f2937',
    minHeight: 300,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  previousSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previousHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  previousTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  entriesList: {
    gap: 12,
  },
  entryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#0078d4',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  entryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  entryDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  entryPreview: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#0078d4',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  entryContent: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
    fontFamily: 'monospace',
  },
});