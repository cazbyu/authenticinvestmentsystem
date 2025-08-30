import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, Target } from 'lucide-react-native';

interface CreateGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
  createGoal: (goalData: {
    title: string;
    description?: string;
    weekly_target?: number;
    total_target?: number;
  }) => Promise<any>;
}

export function CreateGoalModal({ 
  visible, 
  onClose, 
  onSubmitSuccess, 
  createGoal 
}: CreateGoalModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    weeklyTarget: '3',
    totalTarget: '36',
  });
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      weeklyTarget: '3',
      totalTarget: '36',
    });
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a goal title');
      return false;
    }

    const weeklyTarget = parseInt(formData.weeklyTarget);
    const totalTarget = parseInt(formData.totalTarget);

    if (isNaN(weeklyTarget) || weeklyTarget < 1) {
      Alert.alert('Error', 'Weekly target must be a positive number');
      return false;
    }

    if (isNaN(totalTarget) || totalTarget < 1) {
      Alert.alert('Error', 'Total target must be a positive number');
      return false;
    }

    // Check if total target makes sense with weekly target
    const expectedTotal = weeklyTarget * 12;
    if (totalTarget > expectedTotal * 2) {
      Alert.alert(
        'Warning', 
        `Your total target (${totalTarget}) seems high for a weekly target of ${weeklyTarget}. Expected range: ${expectedTotal} - ${expectedTotal * 2}. Continue anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => handleSubmit() }
        ]
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const goalData = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        weekly_target: parseInt(formData.weeklyTarget),
        total_target: parseInt(formData.totalTarget),
      };

      await createGoal(goalData);
      
      Alert.alert('Success', 'Goal created successfully!');
      resetForm();
      onSubmitSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating goal:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to create goal');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create 12-Week Goal</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.form}>
            {/* Goal Title */}
            <View style={styles.field}>
              <Text style={styles.label}>Goal Title *</Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                placeholder="Enter your 12-week goal"
                placeholderTextColor="#9ca3af"
                maxLength={100}
              />
            </View>

            {/* Goal Description */}
            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder="Describe your goal and why it matters to you..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            </View>

            {/* Targets Section */}
            <View style={styles.targetsSection}>
              <Text style={styles.sectionTitle}>Leading & Lagging Indicators</Text>
              <Text style={styles.sectionDescription}>
                Set targets for both weekly progress (leading) and overall achievement (lagging)
              </Text>

              <View style={styles.targetsRow}>
                {/* Weekly Target */}
                <View style={styles.targetField}>
                  <Text style={styles.label}>Weekly Target</Text>
                  <Text style={styles.fieldDescription}>Leading indicator</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={formData.weeklyTarget}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, weeklyTarget: text }))}
                    placeholder="3"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    maxLength={2}
                  />
                  <Text style={styles.unitText}>per week</Text>
                </View>

                {/* Total Target */}
                <View style={styles.targetField}>
                  <Text style={styles.label}>Total Target</Text>
                  <Text style={styles.fieldDescription}>Lagging indicator</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={formData.totalTarget}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, totalTarget: text }))}
                    placeholder="36"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    maxLength={3}
                  />
                  <Text style={styles.unitText}>total</Text>
                </View>
              </View>

              {/* Target Guidance */}
              <View style={styles.guidanceContainer}>
                <Text style={styles.guidanceTitle}>💡 Target Guidance</Text>
                <Text style={styles.guidanceText}>
                  • Weekly targets help you stay on track (leading indicator)
                </Text>
                <Text style={styles.guidanceText}>
                  • Total targets measure overall achievement (lagging indicator)
                </Text>
                <Text style={styles.guidanceText}>
                  • Typical range: 2-5 weekly, 24-60 total
                </Text>
              </View>
            </View>

            {/* Examples Section */}
            <View style={styles.examplesSection}>
              <Text style={styles.sectionTitle}>Examples</Text>
              <View style={styles.exampleCard}>
                <Text style={styles.exampleTitle}>Exercise Consistency</Text>
                <Text style={styles.exampleDescription}>
                  Weekly: 4 workout days • Total: 48 workouts
                </Text>
              </View>
              <View style={styles.exampleCard}>
                <Text style={styles.exampleTitle}>Learning New Skill</Text>
                <Text style={styles.exampleDescription}>
                  Weekly: 3 practice sessions • Total: 36 sessions
                </Text>
              </View>
              <View style={styles.exampleCard}>
                <Text style={styles.exampleTitle}>Relationship Building</Text>
                <Text style={styles.exampleDescription}>
                  Weekly: 2 meaningful conversations • Total: 24 conversations
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={[
              styles.createButton,
              (!formData.title.trim() || loading) && styles.createButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!formData.title.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Target size={20} color="#ffffff" />
                <Text style={styles.createButtonText}>Create Goal</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 8,
  },
  fieldDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  targetsSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  targetsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  targetField: {
    flex: 1,
    alignItems: 'center',
  },
  numberInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    minWidth: 80,
    marginBottom: 4,
  },
  unitText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  guidanceContainer: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  guidanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  guidanceText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
    marginBottom: 2,
  },
  examplesSection: {
    marginBottom: 24,
  },
  exampleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0078d4',
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  exampleDescription: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  actions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0078d4',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});