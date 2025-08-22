import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, TextInput, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import { Header } from '@/components/Header';
import { ManageRolesModal } from '@/components/settings/ManageRolesModal'; // <-- Import the new component
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { Camera, Upload, User, Palette } from 'lucide-react-native';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'myapp',
});

export default function SettingsScreen() {
  const { isDarkMode, toggleDarkMode, colors } = useTheme();
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [isRolesModalVisible, setIsRolesModalVisible] = useState(false); // <-- Add state for the modal
  const [authenticScore, setAuthenticScore] = useState(0);
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    profile_image: '',
    primary_color: '#0078d4',
    accent_color: '#16a34a'
  });
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

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

  const colorOptions = [
    '#0078d4', '#16a34a', '#dc2626', '#7c3aed', '#ea580c',
    '#0891b2', '#be185d', '#059669', '#7c2d12', '#4338ca',
    '#9333ea', '#c2410c', '#0f766e', '#b91c1c', '#6366f1'
  ];

  const fetchProfile = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfile(data);
        
        // Get profile image URL if exists
        if (data.profile_image) {
          const { data: signed } = await supabase.storage
  .from('0008-ap-profile-images')
  .createSignedUrl(data.profile_image, 60 * 60); // 1 hour
setProfileImageUrl(signed?.signedUrl ? `${signed.signedUrl}&cb=${Date.now()}` : null);

        } else {
          setProfileImageUrl(null);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const calculateTaskPoints = (task: any, roles: any[] = [], domains: any[] = []) => {
    let points = 0;
    if (roles && roles.length > 0) points += roles.length;
    if (domains && domains.length > 0) points += domains.length;
    if (task.is_authentic_deposit) points += 2;
    if (task.is_urgent && task.is_important) points += 1.5;
    else if (!task.is_urgent && task.is_important) points += 3;
    else if (task.is_urgent && !task.is_important) points += 1;
    else points += 0.5;
    if (task.is_twelve_week_goal) points += 2;
    return Math.round(points * 10) / 10;
  };

  const calculateAuthenticScore = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate deposits from completed tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .not('completed_at', 'is', null);

      if (tasksError) throw tasksError;

      let totalDeposits = 0;
      if (tasksData && tasksData.length > 0) {
        const taskIds = tasksData.map(t => t.id);
        const [
          { data: rolesData },
          { data: domainsData }
        ] = await Promise.all([
          supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds).eq('parent_type', 'task'),
          supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task')
        ]);

        for (const task of tasksData) {
          const taskWithData = {
            ...task,
            roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
            domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
          };
          totalDeposits += calculateTaskPoints(task, taskWithData.roles, taskWithData.domains);
        }
      }

      // Calculate withdrawals
      const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from('0008-ap-withdrawals')
        .select('amount')
        .eq('user_id', user.id);

      if (withdrawalsError) throw withdrawalsError;

      const totalWithdrawals = withdrawalsData?.reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0) || 0;
      
      const balance = totalDeposits - totalWithdrawals;
      setAuthenticScore(Math.round(balance * 10) / 10);
    } catch (error) {
      console.error('Error calculating authentic score:', error);
    }
  };

  useEffect(() => {
    fetchProfile();
    calculateAuthenticScore();
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [saveTimeout]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      setUploading(true);

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Determine file extension and content type
      let fileExt = 'jpg';
      let contentType = 'image/jpeg';
      
      if (uri.startsWith('data:')) {
        const mimeMatch = uri.match(/data:([^;]+)/);
        if (mimeMatch) {
          contentType = mimeMatch[1];
          fileExt = contentType.split('/')[1] || 'jpg';
        }
      } else {
        const uriExt = uri.split('.').pop()?.toLowerCase();
        if (uriExt && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(uriExt)) {
          fileExt = uriExt === 'jpeg' ? 'jpg' : uriExt;
          contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
        }
      }

      // Convert URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Create unique filename
      const fileName = `${user.id}/profile_${Date.now()}.${fileExt}`;

      // Remove old image if exists
      if (profile.profile_image) {
        await supabase.storage
          .from('0008-ap-profile-images')
          .remove([profile.profile_image]);
      }

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('0008-ap-profile-images')
        .upload(fileName, blob, {
          contentType,
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('0008-ap-profile-images')
        .getPublicUrl(fileName);

      // Update profile with new image path
      await updateProfile({ profile_image: fileName });
      setProfileImageUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const updateProfile = async (updates: Partial<typeof profile>) => {
  try {
    setSaving(true);
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user found');

    const { error } = await supabase
      .from('0008-ap-users')
      .upsert(
        {
          id: user.id,
          ...profile,                  // keep existing local state
          ...updates,                  // apply incoming changes
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (error) throw error;

    setProfile(prev => ({ ...prev, ...updates }));
    
    // Update profile image URL if profile_image was updated
    if (updates.profile_image) {
      const { data: imageData } = supabase.storage
        .from('0008-ap-profile-images')
        .getPublicUrl(updates.profile_image);
      setProfileImageUrl(imageData.publicUrl);
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    Alert.alert('Error', 'Failed to update profile');
  } finally {
    setSaving(false);
  }
};


  const debouncedUpdateProfile = (updates: Partial<typeof profile>) => {
    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Set new timeout for auto-save
    const timeout = setTimeout(() => {
      updateProfile(updates);
    }, 1000); // Save after 1 second of no changes

    setSaveTimeout(timeout);
  };

  const handleProfileChange = (field: keyof typeof profile, value: string) => {
    const updatedProfile = { ...profile, [field]: value };
    setProfile(updatedProfile);
    debouncedUpdateProfile({ [field]: value });
  };

  const handleColorChange = (field: 'primary_color' | 'accent_color', color: string) => {
    setProfile(prev => ({ ...prev, [field]: color }));
    updateProfile({ [field]: color }); // Immediate save for color changes
  };

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Settings" authenticScore={authenticScore} />
      
      <ScrollView style={[styles.content, { backgroundColor: colors.background }]}>
        {/* Profile Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile</Text>
          
          {/* Profile Photo */}
          <View style={styles.profilePhotoSection}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Profile Photo</Text>
            <View style={styles.profilePhotoContainer}>
              {profileImageUrl ? (
                <Image source={{ uri: profileImageUrl }} style={styles.profileImage} />
              ) : (
                <View style={[styles.profileImagePlaceholder, { backgroundColor: colors.border }]}>
                  <User size={32} color={colors.textSecondary} />
                </View>
              )}
              
              <View style={styles.profilePhotoButtons}>
                <TouchableOpacity 
                  style={[styles.photoButton, { borderColor: colors.primary }]}
                  onPress={takePhoto}
                  disabled={uploading}
                >
                  <Camera size={16} color={colors.primary} />
                  <Text style={[styles.photoButtonText, { color: colors.primary }]}>Take Photo</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.photoButton, { borderColor: colors.primary }]}
                  onPress={pickImage}
                  disabled={uploading}
                >
                  <Upload size={16} color={colors.primary} />
                  <Text style={[styles.photoButtonText, { color: colors.primary }]}>Choose Photo</Text>
                </TouchableOpacity>
              </View>
              
              {uploading && (
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.uploadingText, { color: colors.textSecondary }]}>Uploading...</Text>
                </View>
              )}
            </View>
          </View>

          {/* Profile Information */}
          <View style={styles.profileField}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>First Name</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={profile.first_name}
              onChangeText={(text) => handleProfileChange('first_name', text)}
              placeholder="Enter first name"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.profileField}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Last Name</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={profile.last_name}
              onChangeText={(text) => handleProfileChange('last_name', text)}
              placeholder="Enter last name"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.profileField}>
          {/* Primary Color */}
          <View style={[styles.colorField, { marginTop: 24 }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Personalization</Text>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Primary Color</Text>
            <View style={styles.colorGrid}>
              {colorOptions.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    profile.primary_color === color && styles.selectedColorOption
                  ]}
                  onPress={() => {
                    handleColorChange('primary_color', color);
                  }}
                >
                  {profile.primary_color === color && (
                    <View style={styles.colorCheckmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Accent Color */}
          <View style={styles.colorField}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Accent Color</Text>
            <View style={styles.colorGrid}>
              {colorOptions.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    profile.accent_color === color && styles.selectedColorOption
                  ]}
                  onPress={() => {
                    handleColorChange('accent_color', color);
                  }}
                >
                  {profile.accent_color === color && (
                    <View style={styles.colorCheckmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
          </View>
        </View>

        {/* Account Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          
          <TouchableOpacity 
            style={styles.settingButton}
            onPress={() => setIsRolesModalVisible(true)}
          >
            <Text style={[styles.settingButtonText, { color: colors.primary }]}>Manage Roles</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingButton}>
            <Text style={[styles.settingButtonText, { color: colors.primary }]}>Export Data</Text>
          </TouchableOpacity>
        </View>

        {/* Appearance Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
            <Switch
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isDarkMode ? colors.surface : colors.surface}
            />
          </View>
        </View>

        {/* Google Calendar Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Google Calendar Integration</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Google Calendar</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                {googleAccessToken ? 'Connected' : 'Not connected'}
              </Text>
            </View>
            {googleAccessToken ? (
              <TouchableOpacity
                style={[styles.connectButton, styles.disconnectButton]}
                onPress={disconnectGoogle}
              >
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.connectButton, { backgroundColor: colors.primary }]}
                onPress={connectToGoogle}
                disabled={isConnectingGoogle}
              >
                <Text style={styles.connectButtonText}>
                  {isConnectingGoogle ? 'Connecting...' : 'Connect'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {googleAccessToken && (
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Sync Events</Text>
              <Switch
                value={syncEnabled}
                onValueChange={setSyncEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={syncEnabled ? colors.surface : colors.surface}
              />
            </View>
          )}
        </View>

        {/* Notifications Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Push Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={notificationsEnabled ? colors.surface : colors.surface}
            />
          </View>
        </View>
      </ScrollView>

      <ManageRolesModal
        visible={isRolesModalVisible}
        onClose={() => setIsRolesModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingButton: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  settingButtonText: {
    fontSize: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  profilePhotoSection: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  profilePhotoContainer: {
    alignItems: 'center',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  profilePhotoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  uploadingText: {
    fontSize: 14,
  },
  profileField: {
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  colorField: {
    marginBottom: 24,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorOption: {
    borderColor: '#1f2937',
    borderWidth: 3,
  },
  colorCheckmark: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#1f2937',
    fontSize: 12,
    fontWeight: 'bold',
  },
  settingInfo: {
    flex: 1,
  },
  settingDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  connectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  connectButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  disconnectButton: {
    backgroundColor: '#dc2626',
  },
  disconnectButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});