import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { X, CreditCard as Edit, Play, Ban } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { DepositIdea } from './DepositIdeaCard';

interface DepositIdeaDetailModalProps {
  visible: boolean;
  depositIdea: DepositIdea | null;
  onClose: () => void;
  onUpdate: (depositIdea: DepositIdea) => void;
  onActivate: (depositIdea: DepositIdea) => void;
  onCancel: (depositIdea: DepositIdea) => void;
}

export function DepositIdeaDetailModal({ 
  visible, 
  depositIdea, 
  onClose, 
  onUpdate, 
  onActivate, 
  onCancel 
}: DepositIdeaDetailModalProps) {
  const [ideaNotes, setIdeaNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  useEffect(() => {
    if (visible && depositIdea?.id) {
      fetchIdeaNotes();
    }
  }, [visible, depositIdea?.id]);

  const fetchIdeaNotes = async () => {
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

      const notes = data?.map(item => item.note).filter(Boolean) || [];
      setIdeaNotes(notes);
    } catch (error) {
      console.error('Error fetching deposit idea notes:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoadingNotes(false);
    }
  };

  const formatDateTime = (dateTime) => dateTime ? new Date(dateTime).toLocaleString() : 'Not set';

  if (!depositIdea) return null;
  
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.detailContainer}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>Deposit Idea Details</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.detailContent}>
          <Text style={styles.detailIdeaTitle}>{depositIdea.title}</Text>
          
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Created:</Text>
            <Text style={styles.detailValue}>{formatDateTime(depositIdea.created_at)}</Text>
          </View>
          
          {depositIdea.activated_at && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Activated:</Text>
              <Text style={styles.detailValue}>{formatDateTime(depositIdea.activated_at)}</Text>
            </View>
          )}
          
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Status:</Text>
            <Text style={styles.detailValue}>
              {depositIdea.activated_at ? 'Activated' : 'Pending'}
              {depositIdea.archived ? ' (Archived)' : ''}
            </Text>
          </View>
          
          {depositIdea.roles?.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Roles:</Text>
              <View style={styles.detailTagContainer}>
                {depositIdea.roles.map(role => (
                  <View key={role.id} style={[styles.tag, styles.roleTag]}>
                    <Text style={styles.tagText}>{role.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          {depositIdea.domains?.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Domains:</Text>
              <View style={styles.detailTagContainer}>
                {depositIdea.domains.map(domain => (
                  <View key={domain.id} style={[styles.tag, styles.domainTag]}>
                    <Text style={styles.tagText}>{domain.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          {depositIdea.keyRelationships?.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Key Relationships:</Text>
              <View style={styles.detailTagContainer}>
                {depositIdea.keyRelationships.map(kr => (
                  <View key={kr.id} style={[styles.tag, styles.krTag]}>
                    <Text style={styles.tagText}>{kr.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          {ideaNotes.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Notes:</Text>
              {loadingNotes ? (
                <Text style={styles.detailValue}>Loading notes...</Text>
              ) : (
                <View style={styles.notesContainer}>
                  {ideaNotes.map((note, index) => (
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
          
          {depositIdea.goals?.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Goals:</Text>
              <View style={styles.detailTagContainer}>
                {depositIdea.goals.map(goal => (
                  <View key={goal.id} style={[styles.tag, styles.goalTag]}>
                    <Text style={styles.tagText}>{goal.title}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
        
        <View style={styles.detailActions}>
          <TouchableOpacity 
            style={[styles.detailButton, styles.updateButton]} 
            onPress={() => onUpdate(depositIdea)}
          >
            <Edit size={16} color="#ffffff" />
            <Text style={styles.detailButtonText}>Update</Text>
          </TouchableOpacity>
          
          {!depositIdea.activated_at && (
            <TouchableOpacity 
              style={[styles.detailButton, styles.activateButton]} 
              onPress={() => onActivate(depositIdea)}
            >
              <Play size={16} color="#ffffff" />
              <Text style={styles.detailButtonText}>Activate</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[styles.detailButton, styles.cancelButton]} 
            onPress={() => onCancel(depositIdea)}
          >
            <Ban size={16} color="#ffffff" />
            <Text style={styles.detailButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  detailContainer: { 
    flex: 1, 
    backgroundColor: '#f8fafc' 
  },
  detailHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e7eb', 
    backgroundColor: '#ffffff' 
  },
  detailTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#1f2937' 
  },
  detailContent: { 
    flex: 1, 
    padding: 16 
  },
  detailIdeaTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#1f2937', 
    marginBottom: 20 
  },
  detailSection: { 
    marginBottom: 16 
  },
  detailLabel: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#6b7280', 
    marginBottom: 4 
  },
  detailValue: { 
    fontSize: 16, 
    color: '#1f2937' 
  },
  detailTagContainer: { 
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
    backgroundColor: '#e0e7ff' 
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
  detailActions: { 
    flexDirection: 'row', 
    padding: 16, 
    gap: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#e5e7eb', 
    backgroundColor: '#ffffff' 
  },
  detailButton: { 
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
  cancelButton: { 
    backgroundColor: '#dc2626' 
  },
  detailButtonText: { 
    color: '#ffffff', 
    fontSize: 14, 
    fontWeight: '600' 
  },
});