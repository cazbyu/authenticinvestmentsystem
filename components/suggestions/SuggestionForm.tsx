import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSuggestions } from '@/hooks/useSuggestions';

interface SuggestionFormProps {
  onSubmitSuccess?: () => void;
}

export function SuggestionForm({ onSubmitSuccess }: SuggestionFormProps) {
  const { colors } = useTheme();
  const { submitSuggestion } = useSuggestions();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minChars = 5;
  const maxChars = 1000;

  const handleContentChange = (text: string) => {
    console.log('Content changed:', text, 'Length:', text.length);
    setContent(text);
  };

  const handleSubmit = async () => {
    const trimmedContent = content.trim();

    if (trimmedContent.length < minChars) {
      Alert.alert('Too Short', `Please provide at least ${minChars} characters for your suggestion.`);
      return;
    }

    if (content.length > maxChars) {
      Alert.alert('Too Long', `Suggestion must be less than ${maxChars} characters.`);
      return;
    }

    setIsSubmitting(true);
    const result = await submitSuggestion(trimmedContent);
    setIsSubmitting(false);

    if (result.success) {
      Alert.alert(
        'Thank You!',
        'Your suggestion has been submitted successfully. We appreciate your feedback!',
        [{ text: 'OK' }]
      );
      setContent('');
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } else {
      Alert.alert('Error', result.error || 'Failed to submit suggestion. Please try again.');
    }
  };

  const characterCount = content.length;
  const isValid = characterCount >= minChars && characterCount <= maxChars;

  console.log('Render - Content:', content, 'Length:', characterCount, 'IsValid:', isValid);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.label, { color: colors.text }]}>Your Suggestion</Text>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.background,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        value={content}
        onChangeText={handleContentChange}
        placeholder="Share your ideas, feedback, or suggestions..."
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={6}
        maxLength={maxChars}
        editable={!isSubmitting}
        textAlignVertical="top"
      />

      <View style={styles.footer}>
        <Text
          style={[
            styles.characterCount,
            {
              color:
                characterCount < minChars
                  ? colors.textSecondary
                  : characterCount > maxChars
                  ? colors.error
                  : colors.success,
            },
          ]}
        >
          {characterCount} / {maxChars} characters
          {characterCount < minChars && ` (minimum ${minChars})`}
        </Text>

        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor: isValid && !isSubmitting ? colors.primary : colors.border,
              opacity: isValid && !isSubmitting ? 1 : 0.5,
            },
          ]}
          onPress={handleSubmit}
          disabled={!isValid || isSubmitting}
          activeOpacity={0.7}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Submit</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  characterCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  submitButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
