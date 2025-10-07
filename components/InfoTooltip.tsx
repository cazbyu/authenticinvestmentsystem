import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { HelpCircle } from 'lucide-react-native';

interface InfoTooltipProps {
  content: string;
  iconSize?: number;
  iconColor?: string;
  maxWidth?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function InfoTooltip({
  content,
  iconSize = 18,
  iconColor = '#6b7280',
  maxWidth = 300,
  position = 'bottom',
}: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [iconLayout, setIconLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const handleIconPress = (event: any) => {
    if (Platform.OS === 'web') {
      const target = event.currentTarget;
      if (target) {
        const rect = target.getBoundingClientRect();
        setIconLayout({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });
      }
    }
    setVisible(true);
  };

  const handleClose = () => {
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleIconPress}
        style={styles.iconButton}
        accessibilityLabel="Show information"
        accessibilityRole="button"
        accessibilityHint="Tap to view additional information"
      >
        <HelpCircle size={iconSize} color={iconColor} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable
          style={styles.overlay}
          onPress={handleClose}
          accessibilityLabel="Close tooltip"
          accessibilityRole="button"
        >
          <View style={styles.tooltipContainer}>
            <Pressable
              style={[styles.tooltip, { maxWidth }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.tooltipContent}>
                <Text style={styles.tooltipText}>{content}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Text style={styles.closeButtonText}>Got it</Text>
              </TouchableOpacity>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltip: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tooltipContent: {
    marginBottom: 16,
  },
  tooltipText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1f2937',
    textAlign: 'left',
  },
  closeButton: {
    backgroundColor: '#0078d4',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
