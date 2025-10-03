import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
  clamp,
} from 'react-native-reanimated';

interface DraggableFabProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
  size?: number;
  backgroundColor?: string;
}

export function DraggableFab({
  onPress,
  children,
  style,
  size = 48,
  backgroundColor = '#0078d4'
}: DraggableFabProps) {
  const screenDimensions = useRef(Dimensions.get('window'));
  const hasInitialized = useRef(false);

  // Initial position (bottom-right corner with padding)
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const isPressed = useSharedValue(false);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Initialize position on mount to right side
  useEffect(() => {
    if (!hasInitialized.current) {
      const { width, height } = screenDimensions.current;
      translateX.value = width - size - 20;
      translateY.value = height - size - 100;
      hasInitialized.current = true;
    }
  }, []);

  const handlePress = () => {
    onPress();
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isPressed.value = true;
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      // Calculate new position
      const newX = startX.value + event.translationX;
      const newY = startY.value + event.translationY;

      const { width, height } = screenDimensions.current;

      // Apply boundaries to keep the button on screen
      translateX.value = clamp(newX, 0, width - size);
      translateY.value = clamp(newY, 0, height - size - 80); // Account for tab bar
    })
    .onEnd(() => {
      isPressed.value = false;
      
      // Snap to edges for better UX
      const currentX = translateX.value;
      const currentY = translateY.value;

      const { width, height } = screenDimensions.current;

      // Snap to left or right edge
      if (currentX < width / 2) {
        translateX.value = withSpring(20); // Snap to left with padding
      } else {
        translateX.value = withSpring(width - size - 20); // Snap to right with padding
      }

      // Keep Y position but ensure it's within bounds
      translateY.value = withSpring(
        clamp(currentY, 20, height - size - 100)
      );
    });

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      runOnJS(handlePress)();
    });

  const composedGesture = Gesture.Simultaneous(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: withSpring(isPressed.value ? 1.1 : 1) },
      ],
    };
  });

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          styles.fab,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor,
          },
          animatedStyle,
          style,
        ]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
});