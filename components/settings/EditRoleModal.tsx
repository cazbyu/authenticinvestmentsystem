import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator
} from 'react-native';
import { X, Camera, Upload, Trash2, Palette, Plus, CreditCard as Edit } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { EditKRModal } from './EditKRModal';

interface KeyRelationship {
  id: string;
  name: string;
  description?: string;
  image_path?: string;
  role_id: string;
}

interface EditRoleModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdate: () => void;
  role: {
    id: string;
    label: string;
    category?: string;
    image_path?: string;
    color?: string;
  } | null;
}

const colorOptions = [
  '#0078d4', '#16a34a', '#dc2626', '#7c3aed', '#ea580c',
  '#0891b2', '#be185d', '#059669', '#7c2d12', '#4338ca',
  '#9333ea', '#c2410c', '#0f766e', '#b91c1c', '#6366f1'
];

export function EditRoleModal({ visible, onClose, onUpdate, role }: EditRoleModalProps) {
  const [label, setLabel] = useState('');
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('#0078d4');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (role) {
      setLabel(role.label || '');
      setImagePath(role.image_path || null);
      setSelectedColor(role.color || '#0078d4');

      // Get public URL if image path exists
      if (role.image_path) {
        try {
          const supabase = getSupabaseClient();
          const { data } = supabase.storage
            .from('0008-role-images')
            .getPublicUrl(role.image_path);
          setImageUrl(data.publicUrl);
        } catch (error) {
          console.error('Error loading image URL:', error);
          setImageUrl(null);
        }
      } else {
        setImageUrl(null);
      }
    } else {
      setLabel('');
      setImagePath(null);
      setImageUrl(null);
      setSelectedColor('#0078d4');
    }
  }, [role]);

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
        // Extract MIME type from data URI
        const mimeMatch = uri.match(/data:([^;]+)/);
        if (mimeMatch) {
          contentType = mimeMatch[1];
          fileExt = contentType.split('/')[1] || 'jpg';
        }
      } else {
        // Extract from file URI
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
      const fileName = `${user.id}/${role?.id || 'temp'}_${Date.now()}.${fileExt}`;

      // Remove old image if exists
      if (imagePath) {
        await supabase.storage
          .from('0008-role-images')
          .remove([imagePath]);
      }

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('0008-role-images')
        .upload(fileName, blob, {
          contentType,
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('0008-role-images')
        .getPublicUrl(fileName);

      setImagePath(fileName);
      setImageUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async () => {
    try {
      const supabase = getSupabaseClient();
      if (imagePath) {
        // Delete from storage
        const { error } = await supabase.storage
          .from('0008-role-images')
          .remove([imagePath]);

        if (error) console.error('Error deleting image:', error);
      }

      setImagePath(null);
      setImageUrl(null);
    } catch (error) {
      console.error('Error removing image:', error);
    }
  };

  const handleSave = async () => {
    if (!role || !label.trim()) return;

    try {
      setSaving(true);

      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-roles')
        .update({
          label: label.trim(),
          image_path: imagePath,
          color: selectedColor,
          updated_at: new Date().toISOString()
        })
        .eq('id', role.id);

      if (error) throw error;

      Alert.alert('Success', 'Role updated successfully');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating role:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  if (!role) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Edit Role</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.form}>
            {/* Image Section */}
            <View style={styles.field}>
              <Text style={styles.label}>Profile Picture</Text>
              <View style={styles.imageSection}>
                {imageUrl ? (
                  <View style={styles.imageContainer}>
                    <Image source={{ uri: imageUrl }} style={styles.image} />
                    <TouchableOpacity 
                      style={styles.removeImageButton}
                      onPress={removeImage}
                    >
                      <Trash2 size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Camera size={32} color="#9ca3af" />
                    <Text style={styles.imagePlaceholderText}>No photo</Text>
                  </View>
                )}
                
                <View style={styles.imageButtons}>
                  <TouchableOpacity 
                    style={styles.imageButton}
                    onPress={takePhoto}
                    disabled={uploading}
                  >
                    <Camera size={16} color="#0078d4" />
                    <Text style={styles.imageButtonText}>Take Photo</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.imageButton}
                    onPress={pickImage}
                    disabled={uploading}
                  >
                    <Upload size={16} color="#0078d4" />
                    <Text style={styles.imageButtonText}>Choose Photo</Text>
                  </TouchableOpacity>
                </View>
                
                {uploading && (
                  <View style={styles.uploadingContainer}>
                    <ActivityIndicator size="small" color="#0078d4" />
                    <Text style={styles.uploadingText}>Uploading...</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Name Field */}
            <View style={styles.field}>
              <Text style={styles.label}>Role Name *</Text>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder="Enter role name"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Color Selection */}
            <View style={styles.field}>
              <Text style={styles.label}>Header Color</Text>
              <View style={styles.colorGrid}>
                {colorOptions.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.selectedColorOption
                    ]}
                    onPress={() => setSelectedColor(color)}
                  >
                    {selectedColor === color && (
                      <View style={styles.colorCheckmark}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.saveButton, (!label.trim() || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!label.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  imageSection: {
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f3f4f6',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0078d4',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  imageButtonText: {
    fontSize: 14,
    color: '#0078d4',
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
    color: '#6b7280',
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
  actions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  saveButton: {
    backgroundColor: '#0078d4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});