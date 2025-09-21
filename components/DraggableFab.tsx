import React, { useRef } from 'react';
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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export function DraggableFab({ 
  onPress, 
  children, 
  style, 
  size = 48, 
  backgroundColor = '#0078d4' 
}: DraggableFabProps) {
  // Initial position (bottom-right corner with padding)
  const translateX = useSharedValue(screenWidth - size - 20);
  const translateY = useSharedValue(screenHeight - size - 100); // Account for tab bar
  
  const isPressed = useSharedValue(false);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

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
      
      // Apply boundaries to keep the button on screen
      translateX.value = clamp(newX, 0, screenWidth - size);
      translateY.value = clamp(newY, 0, screenHeight - size - 80); // Account for tab bar
    })
    .onEnd(() => {
      isPressed.value = false;
      
      // Snap to edges for better UX
      const snapThreshold = 50;
      const currentX = translateX.value;
      const currentY = translateY.value;
      
      // Snap to left or right edge
      if (currentX < screenWidth / 2) {
        translateX.value = withSpring(20); // Snap to left with padding
      } else {
        translateX.value = withSpring(screenWidth - size - 20); // Snap to right with padding
      }
      
      // Keep Y position but ensure it's within bounds
      translateY.value = withSpring(
        clamp(currentY, 20, screenHeight - size - 100)
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