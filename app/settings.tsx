import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Header } from '@/components/Header';
import { ManageRolesModal } from '@/components/settings/ManageRolesModal'; // <-- Import the new component

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'myapp',
});

export default function SettingsScreen() {
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [isRolesModalVisible, setIsRolesModalVisible] = useState(false); // <-- Add state for the modal

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
    },
    {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    }
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      setGoogleAccessToken(access_token);
      setIsConnectingGoogle(false);
      Alert.alert('Success', 'Connected to Google Calendar!');
    } else if (response?.type === 'error') {
      setIsConnectingGoogle(false);
      Alert.alert('Error', 'Failed to connect to Google Calendar');
    }
  }, [response]);

  const connectToGoogle = async () => {
    setIsConnectingGoogle(true);
    await promptAsync();
  };

  const disconnectGoogle = () => {
    setGoogleAccessToken(null);
    setSyncEnabled(false);
    Alert.alert('Success', 'Disconnected from Google Calendar');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Settings" />
      
      <ScrollView style={styles.content}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          {/* --- ADD THIS BUTTON --- */}
          <TouchableOpacity 
            style={styles.settingButton}
            onPress={() => setIsRolesModalVisible(true)}
          >
            <Text style={styles.settingButtonText}>Manage Roles</Text>
          </TouchableOpacity>
          {/* ----------------------- */}
          
          <TouchableOpacity style={styles.settingButton}>
            <Text style={styles.settingButtonText}>Export Data</Text>
          </TouchableOpacity>
        </View>

        {/* Google Calendar Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Google Calendar Integration</Text>
          {/* ... existing Google Calendar code ... */}
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          {/* ... existing Notifications code ... */}
        </View>
      </ScrollView>

      {/* --- ADD THE MODAL COMPONENT --- */}
      <ManageRolesModal
        visible={isRolesModalVisible}
        onClose={() => setIsRolesModalVisible(false)}
      />
      {/* ----------------------------- */}
    </SafeAreaView>
  );
}

// ... (your existing styles for settings.tsx)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  settingButton: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  settingButtonText: {
    fontSize: 16,
    color: '#0078d4',
  },
  // ... other styles from your settings screen
});