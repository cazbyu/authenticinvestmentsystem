import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { X, CreditCard as Edit, Play, Ban } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

interface DepositIdea {
  id: string;
  title: string;
  is_active?: boolean;
  created_at?: string;
  activated_at?: string;
  archived?: boolean;
  follow_up?: boolean;
  activated_task_id?: string;
  roles?: Array<{id: string; label: string}>;
  domains?: Array<{id: string; name: string}>;
  goals?: Array<{id: string; title: string}>;
  keyRelationships?: Array<{id: string; name: string}>;
  has_notes?: boolean;
}

interface DepositIdeaDetailModalProps {
  visible: boolean;
  depositIdea: DepositIdea | null;
  onClose: () => void;
  onUpdate: (depositIdea: DepositIdea) => void;
  onCancel: (depositIdea: DepositIdea) => void;
  onActivate: (depositIdea: DepositIdea) => void;
}

export function DepositIdeaDetailModal({ 
  visible, 
  depositIdea, 
  onClose, 
  onUpdate, 
  onCancel,
  onActivate
}: DepositIdeaDetailModalProps) {
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  useEffect(() => {
    if (visible && depositIdea?.id) {
      fetchNotes();
    }
  }, [visible, depositIdea?.id]);

  const fetchNotes = async () => {
    if (!depositIdea?.id) return;

    setLoadingNotes(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-universal-notes-join')
        .select(`
          note:0008-ap-notes(
            id,
            content,
            created_at
          )
        `)
        .eq('parent_id', depositIdea.id)
        .eq('parent_type', 'depositIdea');

      if (error) throw error;

      const notesList = data?.map(item => item.note).filter(Boolean) || [];
      setNotes(notesList);
    } catch (error) {
      console.error('Error fetching deposit idea notes:', error);
            try {
              onActivate(depositIdea);
              onClose();
            } catch (error) {
              console.error('Error in activation:', error);
            try {
              onCancel(depositIdea);
              onClose();
            } catch (error) {
              console.error('Error in deletion:', error);
              onClose();
            }
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoadingNotes(false);
    }
  };

  const formatDateTime = (dateTime) => dateTime ? new Date(dateTime).toLocaleString() : 'Not set';

  if (!depositIdea) return null;
  
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Deposit Idea Details</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.content}>
          <Text style={styles.ideaTitle}>{depositIdea.title}</Text>
          
          <View style={styles.section}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>
              {depositIdea.activated_at ? 'Activated' : depositIdea.is_active ? 'Active' : 'Archived'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Created:</Text>
            <Text style={styles.value}>{formatDateTime(depositIdea.created_at)}</Text>
          </View>

          {depositIdea.activated_at && (
            <View style={styles.section}>
              <Text style={styles.label}>Activated:</Text>
              <Text style={styles.value}>{formatDateTime(depositIdea.activated_at)}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.label}>Follow-up Goal:</Text>
            <Text style={styles.value}>{depositIdea.follow_up ? 'Yes' : 'No'}</Text>
          </View>

          {depositIdea.roles?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Roles:</Text>
              <View style={styles.tagContainer}>
                {depositIdea.roles.map(role => (
                  <View key={role.id} style={[styles.tag, styles.roleTag]}>
                    <Text style={styles.tagText}>{role.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {depositIdea.domains?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Domains:</Text>
              <View style={styles.tagContainer}>
                {depositIdea.domains.map(domain => (
                  <View key={domain.id} style={[styles.tag, styles.domainTag]}>
                    <Text style={styles.tagText}>{domain.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {depositIdea.goals?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Goals:</Text>
              <View style={styles.tagContainer}>
                {depositIdea.goals.map(goal => (
                  <View key={goal.id} style={[styles.tag, styles.goalTag]}>
                    <Text style={styles.tagText}>{goal.title}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {depositIdea.keyRelationships?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Key Relationships:</Text>
              <View style={styles.tagContainer}>
                {depositIdea.keyRelationships.map(kr => (
                  <View key={kr.id} style={[styles.tag, styles.krTag]}>
                    <Text style={styles.tagText}>{kr.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {notes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Notes:</Text>
              {loadingNotes ? (
                <Text style={styles.value}>Loading notes...</Text>
              ) : (
                <View style={styles.notesContainer}>
                  {notes.map((note, index) => (
                    <View key={note.id} style={styles.noteItem}>
                      <Text style={styles.noteContent}>{note.content}</Text>
                      <Text style={styles.noteDate}>
                        {new Date(note.created_at).toLocaleDateString('en-US', { 
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric' 
                        })} ({new Date(note.created_at).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit', 
                          hour12: true 
                        })})
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
        
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.button, styles.updateButton]} 
            onPress={() => onUpdate(depositIdea)}
          >
            <Edit size={16} color="#ffffff" />
            <Text style={styles.buttonText}>Update</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.activateButton]} 
            onPress={() => onActivate(depositIdea)}
          >
            <Play size={16} color="#ffffff" />
            <Text style={styles.buttonText}>Activate as is</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.deleteButton]} 
            onPress={() => handleDelete(depositIdea)}
          >
            <Ban size={16} color="#ffffff" />
            <Text style={styles.buttonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8fafc' 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e7eb', 
    backgroundColor: '#ffffff' 
  },
  title: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#1f2937' 
  },
  contentContainer: {
    flex: 1, 
  },
  content: {
    padding: 16 
  },
  ideaTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#1f2937', 
    marginBottom: 20 
  },
  section: { 
    marginBottom: 16 
  },
  label: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#6b7280', 
    marginBottom: 4 
  },
  value: { 
    fontSize: 16, 
    color: '#1f2937' 
  },
  tagContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 6, 
    marginTop: 4 
  },
  tag: { 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 12 
  },
  roleTag: { 
    backgroundColor: '#fce7f3' 
  },
  domainTag: { 
    backgroundColor: '#fed7aa' 
  },
  goalTag: { 
    backgroundColor: '#bfdbfe' 
  },
  krTag: { 
    backgroundColor: '#e0f2fe' 
  },
  tagText: { 
    fontSize: 10, 
    fontWeight: '500', 
    color: '#374151' 
  },
  notesContainer: {
    marginTop: 8,
  },
  noteItem: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#7c3aed',
  },
  noteContent: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
    marginBottom: 4,
  },
  noteDate: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  actions: { 
    flexDirection: 'row', 
    padding: 16, 
    gap: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#e5e7eb', 
    backgroundColor: '#ffffff' 
  },
  button: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    borderRadius: 8, 
    gap: 6 
  },
  updateButton: { 
    backgroundColor: '#0078d4' 
  },
  activateButton: { 
    backgroundColor: '#16a34a' 
  },
  deleteButton: { 
    backgroundColor: '#dc2626' 
  },
  activateButton: { 
    backgroundColor: '#16a34a' 
  },
  cancelButton: { 
    backgroundColor: '#dc2626' 
  },
  buttonText: { 
    color: '#ffffff', 
    fontSize: 14, 
    fontWeight: '600' 
  },
});