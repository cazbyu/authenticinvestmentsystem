import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface RichTextDisplayProps {
  content: string;
  style?: any;
}

export default function RichTextDisplay({ content, style }: RichTextDisplayProps) {
  const { colors } = useTheme();

  // Simple markdown parser for basic formatting
  const parseMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];

    lines.forEach((line, lineIndex) => {
      if (!line.trim()) {
        elements.push(
          <View key={`space-${lineIndex}`} style={styles.lineSpacing} />
        );
        return;
      }

      // Numbered list: 1. item
      if (/^\d+\.\s/.test(line)) {
        const listText = line.replace(/^\d+\.\s/, '');
        elements.push(
          <View key={lineIndex} style={styles.listItem}>
            <Text style={[styles.listBullet, { color: colors.text }]}>
              {line.match(/^\d+/)?.[0]}.
            </Text>
            <Text style={[styles.listText, { color: colors.text }]}>
              {parseInlineFormatting(listText)}
            </Text>
          </View>
        );
        return;
      }

      // Bullet list: - item or * item
      if (/^[-*]\s/.test(line)) {
        const listText = line.replace(/^[-*]\s/, '');
        elements.push(
          <View key={lineIndex} style={styles.listItem}>
            <Text style={[styles.listBullet, { color: colors.text }]}>•</Text>
            <Text style={[styles.listText, { color: colors.text }]}>
              {parseInlineFormatting(listText)}
            </Text>
          </View>
        );
        return;
      }

      // Regular paragraph
      elements.push(
        <Text key={lineIndex} style={[styles.paragraph, { color: colors.text }]}>
          {parseInlineFormatting(line)}
        </Text>
      );
    });

    return elements;
  };

  // Parse inline formatting like **bold** and *italic*
  const parseInlineFormatting = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let currentIndex = 0;
    let key = 0;

    // Match **bold** and *italic*
    const regex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        parts.push(text.substring(currentIndex, match.index));
      }

      // Add formatted text
      if (match[1]) {
        // Bold: **text**
        parts.push(
          <Text key={key++} style={styles.bold}>
            {match[2]}
          </Text>
        );
      } else if (match[3]) {
        // Italic: *text*
        parts.push(
          <Text key={key++} style={styles.italic}>
            {match[4]}
          </Text>
        );
      }

      currentIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (currentIndex < text.length) {
      parts.push(text.substring(currentIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <View style={[styles.container, style]}>
      {parseMarkdown(content)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  lineSpacing: {
    height: 8,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 8,
  },
  listBullet: {
    fontSize: 15,
    lineHeight: 22,
    marginRight: 8,
    fontWeight: '600',
  },
  listText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '600',
  },
  italic: {
    fontStyle: 'italic',
  },
});
