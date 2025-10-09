import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInputProps,
} from 'react-native';
import { Bold, Italic, List, ListOrdered } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface RichTextInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  minHeight?: number;
}

export default function RichTextInput({
  value,
  onChangeText,
  minHeight = 120,
  placeholder = 'Write your note...',
  ...textInputProps
}: RichTextInputProps) {
  const { colors } = useTheme();
  const textInputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const insertFormatting = (prefix: string, suffix: string = '') => {
    const start = selection.start;
    const end = selection.end;

    const selectedText = value.substring(start, end);
    const beforeText = value.substring(0, start);
    const afterText = value.substring(end);

    const newText = beforeText + prefix + selectedText + suffix + afterText;
    onChangeText(newText);

    // Move cursor after inserted formatting
    const newCursorPosition = start + prefix.length + selectedText.length + suffix.length;
    setTimeout(() => {
      textInputRef.current?.setNativeProps({
        selection: { start: newCursorPosition, end: newCursorPosition }
      });
    }, 0);
  };

  const handleBold = () => {
    insertFormatting('**', '**');
  };

  const handleItalic = () => {
    insertFormatting('*', '*');
  };

  const handleBulletList = () => {
    const start = selection.start;
    const beforeText = value.substring(0, start);
    const afterText = value.substring(start);

    // Check if we're at the start of a line
    const needsNewline = beforeText.length > 0 && !beforeText.endsWith('\n');
    const prefix = needsNewline ? '\n- ' : '- ';

    onChangeText(beforeText + prefix + afterText);

    const newCursorPosition = start + prefix.length;
    setTimeout(() => {
      textInputRef.current?.setNativeProps({
        selection: { start: newCursorPosition, end: newCursorPosition }
      });
    }, 0);
  };

  const handleNumberedList = () => {
    const start = selection.start;
    const beforeText = value.substring(0, start);
    const afterText = value.substring(start);

    // Count existing numbered items to get next number
    const matches = beforeText.match(/^\d+\.\s/gm);
    const nextNumber = matches ? matches.length + 1 : 1;

    const needsNewline = beforeText.length > 0 && !beforeText.endsWith('\n');
    const prefix = needsNewline ? `\n${nextNumber}. ` : `${nextNumber}. `;

    onChangeText(beforeText + prefix + afterText);

    const newCursorPosition = start + prefix.length;
    setTimeout(() => {
      textInputRef.current?.setNativeProps({
        selection: { start: newCursorPosition, end: newCursorPosition }
      });
    }, 0);
  };

  return (
    <View style={styles.container}>
      <TextInput
        ref={textInputRef}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
            minHeight,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline
        textAlignVertical="top"
        {...textInputProps}
      />

      <View style={[styles.toolbar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.toolbarButton, { borderColor: colors.border }]}
          onPress={handleBold}
        >
          <Bold size={18} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolbarButton, { borderColor: colors.border }]}
          onPress={handleItalic}
        >
          <Italic size={18} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolbarButton, { borderColor: colors.border }]}
          onPress={handleBulletList}
        >
          <List size={18} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolbarButton, { borderColor: colors.border }]}
          onPress={handleNumberedList}
        >
          <ListOrdered size={18} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.toolbarHint}>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            Markdown supported
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    gap: 8,
  },
  toolbarButton: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarHint: {
    flex: 1,
    alignItems: 'flex-end',
  },
  hintText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
});
