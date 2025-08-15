import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Calendar, MessageCircle, Settings, User, Heart, Target, ChartBar as BarChart3, LogOut } from 'lucide-react-native';

const menuItems = [
  { id: 'dashboard', title: 'Actions & Ideas', icon: BarChart3, route: '/(tabs)/dashboard' },
  { id: 'calendar', title: 'Calendar View', icon: Calendar, route: '/calendar' },
  { id: 'roles', title: 'Role Bank', icon: User, route: '/(tabs)/roles' },
  { id: 'wellness', title: 'Wellness Bank', icon: Heart, route: '/(tabs)/wellness' },
  { id: 'goals', title: 'Goal Bank', icon: Target, route: '/(tabs)/goals' },
  { id: 'coach', title: 'Coach Chat', icon: MessageCircle, route: '/coach' },
  { id: 'settings', title: 'Settings', icon: Settings, route: '/settings' },
];

export function SideMenu() {
  const router = useRouter();

  const handleMenuPress = (route: string) => {
    router.push(route as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Authentic</Text>
        <Text style={styles.headerSubtitle}>Investments</Text>
      </View>
      
      <ScrollView style={styles.menuContainer}>
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => handleMenuPress(item.route)}
            >
              <IconComponent size={24} color="#0078d4" />
              <Text style={styles.menuItemText}>{item.title}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton}>
          <LogOut size={20} color="#dc2626" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#0078d4',
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
    opacity: 0.9,
  },
  menuContainer: {
    flex: 1,
    paddingTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  menuItemText: {
    marginLeft: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#dc2626',
  },
});