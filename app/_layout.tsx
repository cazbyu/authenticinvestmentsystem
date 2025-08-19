
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { SideMenu } from '@/components/SideMenu';
import '@/lib/calendarLocale';

console.log('ENTRY: file loaded');

export default function RootLayout() {
  useFrameworkReady();

  return (
    <>
      <Drawer
        drawerContent={() => <SideMenu />}
        screenOptions={{
          headerShown: false,
          drawerStyle: {
            width: 280,
          },
        }}
      >
        <Drawer.Screen name="(tabs)" />
        <Drawer.Screen name="calendar" />
        <Drawer.Screen name="settings" />
        <Drawer.Screen name="coach" />
        <Drawer.Screen name="+not-found" />
      </Drawer>
      <StatusBar style="auto" />
    </>
  );
}