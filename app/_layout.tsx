// app/_layout.tsx
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
// ⬇️ Temporarily comment these until smoke test passes
// import { useFrameworkReady } from '@/hooks/useFrameworkReady';
// import { SideMenu } from '@/components/SideMenu';
// import '@/lib/calendarLocale';

export default function RootLayout() {
  console.log('LAYOUT: rendering'); // 👈 sentinel
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        // drawerContent={() => <SideMenu />} // ⬅️ add back later
        screenOptions={{
          headerShown: false,
          drawerStyle: { width: 280 },
        }}
      >
        {/* Keep only one simple screen for now */}
        <Drawer.Screen name="index" />
      </Drawer>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}
