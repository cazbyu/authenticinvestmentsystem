import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Save, FileText, TrendingUp, Circle as HelpCircle } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { OneYearGoalsManager } from './OneYearGoalsManager';

interface NorthStarEditorProps {
  onUpdate?: () => void;
  initialSection?: 'mission' | 'vision' | 'goals';
}

export function NorthStarEditor({ onUpdate, initialSection = 'mission' }: NorthStarEditorProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [missionText, setMissionText] = useState('');
  const [visionText, setVisionText] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showMissionPrompts, setShowMissionPrompts] = useState(false);
  const [showVisionPrompts, setShowVisionPrompts] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const missionSectionRef = useRef<View>(null);
  const visionSectionRef = useRef<View>(null);
  const goalsSectionRef = useRef<View>(null);

  useEffect(() => {
    fetchNorthStarData();
  }, []);

  useEffect(() => {
    if (!loading && initialSection) {
      setTimeout(() => {
        scrollToSection(initialSection);
      }, 300);
    }
  }, [loading, initialSection]);

  const scrollToSection = (section: 'mission' | 'vision' | 'goals') => {
    const refs = {
      mission: missionSectionRef,
      vision: visionSectionRef,
      goals: goalsSectionRef,
    };

    const targetRef = refs[section];
    if (targetRef.current && scrollViewRef.current) {
      targetRef.current.measureLayout(
        scrollViewRef.current as any,
        (x, y) => {
          scrollViewRef.current?.scrollTo({ y: y - 20, animated: true });
        },
        () => {}
      );
    }
  };

  const fetchNorthStarData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-users')
        .select('mission_text, vision_text, updated_at')
        .eq('id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setMissionText(data.mission_text || '');
        setVisionText(data.vision_text || '');
        if (data.updated_at) {
          setLastSaved(new Date(data.updated_at));
        }
      }
    } catch (error) {
      console.error('Error fetching North Star data:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { error } = await supabase
        .from('0008-ap-users')
        .update({
          mission_text: missionText.trim() || null,
          vision_text: visionText.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setLastSaved(new Date());
      Alert.alert('Success', 'North Star updated successfully!');
      onUpdate?.();
    } catch (error) {
      console.error('Error saving North Star:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const missionPrompts = [
    'What are your core values and principles?',
    'What roles do you play in life (parent, leader, friend, etc.)?',
    'What unique contributions do you want to make to the world?',
    'What legacy do you want to leave behind?',
    'How do you want to be remembered by those who matter most?',
  ];

  const visionPrompts = [
    'Where do you see yourself personally in 5 years?',
    'What does your ideal career or business look like?',
    'What relationships do you want to build or strengthen?',
    'What lifestyle do you envision for yourself?',
    'What skills or knowledge do you want to develop?',
    'What does financial freedom mean to you?',
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0078d4" />
        <Text style={styles.loadingText}>Loading North Star...</Text>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollViewRef} style={styles.container}>
      {/* Mission Statement Section */}
      <View ref={missionSectionRef} style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <FileText size={24} color="#0078d4" />
            <Text style={styles.sectionTitle}>Mission Statement</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowMissionPrompts(!showMissionPrompts)}
            style={styles.helpButton}
          >
            <HelpCircle size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionDescription}>
          Your mission statement defines who you are, what you value, and the impact you want to make. It serves as your personal compass.
        </Text>

        {showMissionPrompts && (
          <View style={styles.promptsContainer}>
            <Text style={styles.promptsTitle}>Reflection Questions:</Text>
            {missionPrompts.map((prompt, index) => (
              <Text key={index} style={styles.promptText}>
                • {prompt}
              </Text>
            ))}
          </View>
        )}

        <TextInput
          style={styles.textArea}
          value={missionText}
          onChangeText={setMissionText}
          placeholder="Write your personal mission statement here..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />
        <Text style={styles.characterCount}>
          {missionText.length} characters
        </Text>
      </View>

      {/* 5-Year Vision Section */}
      <View ref={visionSectionRef} style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <TrendingUp size={24} color="#16a34a" />
            <Text style={styles.sectionTitle}>5-Year Vision</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowVisionPrompts(!showVisionPrompts)}
            style={styles.helpButton}
          >
            <HelpCircle size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionDescription}>
          Paint a vivid picture of where you want to be in 5 years. Include personal growth, career, relationships, and lifestyle aspirations.
        </Text>

        {showVisionPrompts && (
          <View style={styles.promptsContainer}>
            <Text style={styles.promptsTitle}>Reflection Questions:</Text>
            {visionPrompts.map((prompt, index) => (
              <Text key={index} style={styles.promptText}>
                • {prompt}
              </Text>
            ))}
          </View>
        )}

        <TextInput
          style={styles.textArea}
          value={visionText}
          onChangeText={setVisionText}
          placeholder="Describe your 5-year vision here..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />
        <Text style={styles.characterCount}>
          {visionText.length} characters
        </Text>
      </View>

      {/* Save Button */}
      <View style={styles.saveSection}>
        {lastSaved && (
          <Text style={styles.lastSavedText}>
            Last saved: {lastSaved.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Save size={20} color="#ffffff" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* 1-Year Goals Section */}
      <View ref={goalsSectionRef} style={styles.goalsSection}>
        <OneYearGoalsManager onUpdate={onUpdate} />
      </View>
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
  section: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  helpButton: {
    padding: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  promptsContainer: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#0078d4',
  },
  promptsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  promptText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 4,
  },
  textArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
    fontSize: 15,
    color: '#1f2937',
    minHeight: 200,
    lineHeight: 22,
  },
  characterCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
  saveSection: {
    margin: 16,
    alignItems: 'center',
  },
  lastSavedText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  goalsSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    borderRadius: 12,
    minHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
