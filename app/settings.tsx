import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Header } from '@/components/Header';

// Complete the auth session
WebBrowser.maybeCompleteAuthSession();

// Google OAuth configuration
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // Replace with your actual client ID
const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'your-app-scheme', // Replace with your app scheme
});

export default function SettingsScreen() {
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(false);

  // Google OAuth request
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

  // Handle Google OAuth response
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
    try {
      await promptAsync();
    } catch (error) {
      setIsConnectingGoogle(false);
      Alert.alert('Error', 'Failed to connect to Google Calendar');
    }
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
        {/* Google Calendar Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Google Calendar Integration</Text>
          
          {!googleAccessToken ? (
            <TouchableOpacity 
              style={styles.googleConnectButton} 
              onPress={connectToGoogle}
              disabled={isConnectingGoogle}
            >
              <Text style={styles.googleConnectButtonText}>
                {isConnectingGoogle ? 'Connecting...' : 'Connect to Google Calendar'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.googleConnectedContainer}>
              <Text style={styles.googleConnectedText}>✓ Connected to Google Calendar</Text>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Auto-sync events</Text>
                <Switch 
                  value={syncEnabled} 
                  onValueChange={setSyncEnabled} 
                />
              </View>
              
              <TouchableOpacity 
                style={styles.disconnectButton} 
                onPress={disconnectGoogle}
              >
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Push notifications</Text>
            <Switch 
              value={notificationsEnabled} 
              onValueChange={setNotificationsEnabled} 
            />
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity style={styles.settingButton}>
            <Text style={styles.settingButtonText}>Export Data</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingButton}>
            <Text style={styles.settingButtonText}>Privacy Policy</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingButton}>
            <Text style={styles.settingButtonText}>Terms of Service</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  googleConnectButton: {
    backgroundColor: '#4285f4',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  googleConnectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  googleConnectedContainer: {
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0078d4',
  },
  googleConnectedText: {
    color: '#0078d4',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: '#1f2937',
  },
  disconnectButton: {
    backgroundColor: '#dc2626',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  disconnectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
});