import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { ChartBar as BarChart3, Heart, Target, User } from 'lucide-react-native';
import { SideMenu } from '@/components/SideMenu';

export default function TabLayout() {
  return (
    <Drawer
      drawerContent={() => <SideMenu />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: 280,
        },
      }}
    >
      <Drawer.Screen name="main-tabs">
        {() => (
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: '#0078d4',
              tabBarInactiveTintColor: '#6b7280',
              tabBarStyle: {
                backgroundColor: '#ffffff',
                borderTopWidth: 1,
                borderTopColor: '#e5e7eb',
                height: 80,
                paddingBottom: 20,
                paddingTop: 10,
              },
              tabBarLabelStyle: {
                fontSize: 12,
                fontWeight: '500',
              },
            }}>
            <Tabs.Screen
              name="dashboard"
              options={{
                title: 'Actions & Ideas',
                tabBarIcon: ({ size, color }) => (
                  <BarChart3 size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="roles"
              options={{
                title: 'Role Bank',
                tabBarIcon: ({ size, color }) => (
                  <User size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="wellness"
              options={{
                title: 'Wellness Bank',
                tabBarIcon: ({ size, color }) => (
                  <Heart size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="goals"
              options={{
                title: 'Goal Bank',
                tabBarIcon: ({ size, color }) => (
                  <Target size={size} color={color} />
                ),
              }}
            />
          </Tabs>
        )}
      </Drawer.Screen>
      <Drawer.Screen name="../calendar" />
      <Drawer.Screen name="../settings" />
      <Drawer.Screen name="../coach" />
    </Drawer>
  );
}