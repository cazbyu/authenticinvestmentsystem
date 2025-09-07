import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Calendar, MessageCircle, Settings, LogOut, BookOpen } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

const menuItems = [
  { id: 'calendar', title: 'Calendar View', icon: Calendar, route: '/calendar' },
  { id: 'reflections', title: 'Reflections', icon: BookOpen, route: '/reflections' },
  { id: 'coach', title: 'Coach Chat', icon: MessageCircle, route: '/coach' },
  { id: 'settings', title: 'Settings', icon: Settings, route: '/settings' },
];

export function SideMenu() {
  const router = useRouter();
  const { colors } = useTheme();

  const handleMenuPress = (route: string) => {
    router.push(route as any);
  };

  // --- ADD THIS FUNCTION ---
  const handleSignOut = async () => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert('Error signing out', error.message);
      } else {
        // This will clear the local session and send the user to the login screen
        router.replace('/login');
      }
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };
  // -------------------------

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={styles.headerTitle}>Authentic</Text>
        <Text style={styles.headerSubtitle}>Investments</Text>
      </View>
      
      <ScrollView style={[styles.menuContainer, { backgroundColor: colors.background }]}>
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={() => handleMenuPress(item.route)}
            >
              <IconComponent size={24} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{item.title}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {/* --- UPDATE THIS BUTTON --- */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <LogOut size={20} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
        </TouchableOpacity>
        {/* -------------------------- */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
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
  menuContainerWrapper: {
    flex: 1,
  },
  menuContainer: {
    paddingTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuItemText: {
    marginLeft: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
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
  },
});