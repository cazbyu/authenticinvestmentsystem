import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { FileText, Paperclip, Users, CreditCard as Edit, Play, Ban } from 'lucide-react-native';

// Interface for a Deposit Idea
export interface DepositIdea {
  id: string;
  title: string;
  is_active?: boolean;
  created_at?: string;
  activated_at?: string;
  archived?: boolean;
  follow_up?: boolean;
  roles?: Array<{id: string; label: string}>;
  domains?: Array<{id: string; name: string}>;
  goals?: Array<{id: string; title: string}>;
  keyRelationships?: Array<{id: string; name: string}>;
  has_notes?: boolean;
  has_attachments?: boolean;
}

// Props for the DepositIdeaCard component
interface DepositIdeaCardProps {
  depositIdea: DepositIdea;
  onUpdate: (depositIdea: DepositIdea) => void;
  onActivate: (depositIdea: DepositIdea) => void;
  onCancel: (depositIdea: DepositIdea) => void;
  onDoublePress?: (depositIdea: DepositIdea) => void;
  isDragging?: boolean;
}

// --- DepositIdeaCard Component ---
// Renders a single deposit idea item in the list
export const DepositIdeaCard = React.forwardRef<View, DepositIdeaCardProps>(
  ({ depositIdea, onUpdate, onActivate, onCancel, onDoublePress, isDragging }, ref) => {
    const [lastTap, setLastTap] = useState(0);

    // Formats the created date string
    const formatCreatedDate = (date?: string) => {
      if (!date) return "";
      const d = new Date(date);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };

    // Handles single and double tap gestures
    const handlePress = () => {
      const now = Date.now();
      const DOUBLE_PRESS_DELAY = 400;
      if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
        setLastTap(0); // Reset to prevent triple-tap issues
        onDoublePress?.(depositIdea);
      } else {
        setLastTap(now);
      }
    };

    const handleActivate = () => {
      onActivate(depositIdea);
    };

    return (
      <TouchableOpacity
        ref={ref}
        style={[styles.ideaCard, isDragging && styles.draggingItem]}
        onPress={handlePress}
        delayLongPress={200}
      >
        <View style={styles.ideaContent}>
          <View style={styles.ideaHeader}>
            <Text style={styles.ideaTitle} numberOfLines={2}>
              {depositIdea.title}
              {depositIdea.created_at && (
                <Text style={styles.createdDate}> ({formatCreatedDate(depositIdea.created_at)})</Text>
              )}
            </Text>
            {depositIdea.activated_at && (
              <View style={styles.activatedBadge}>
                <Text style={styles.activatedBadgeText}>Activated</Text>
              </View>
            )}
          </View>
          
          <View style={styles.ideaBody}>
            <View style={styles.leftSection}>
              {depositIdea.roles && depositIdea.roles.length > 0 && (
                <View style={styles.tagRow}>
                  <Text style={styles.tagRowLabel}>Roles:</Text>
                  <View style={styles.tagContainer}>
                    {depositIdea.roles.slice(0, 3).map((role, index) => (
                      <View key={role.id} style={[styles.pillTag, styles.rolePillTag]}>
                        <Text style={styles.pillTagText}>{role.label}</Text>
                      </View>
                    ))}
                    {depositIdea.roles.length > 3 && (
                      <View style={[styles.pillTag, styles.morePillTag]}>
                        <Text style={styles.pillTagText}>+{depositIdea.roles.length - 3}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
            
            <View style={styles.middleSection}>
              {depositIdea.domains && depositIdea.domains.length > 0 && (
                <View style={styles.tagRow}>
                  <Text style={styles.tagRowLabel}>Domains:</Text>
                  <View style={styles.tagContainer}>
                    {depositIdea.domains.slice(0, 3).map((domain, index) => (
                      <View key={domain.id} style={[styles.pillTag, styles.domainPillTag]}>
                        <Text style={styles.pillTagText}>{domain.name}</Text>
                      </View>
                    ))}
                    {depositIdea.domains.length > 3 && (
                      <View style={[styles.pillTag, styles.morePillTag]}>
                        <Text style={styles.pillTagText}>+{depositIdea.domains.length - 3}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
              
              {depositIdea.goals && depositIdea.goals.length > 0 && (
                <View style={styles.tagRow}>
                  <Text style={styles.tagRowLabel}>Goals:</Text>
                  <View style={styles.tagContainer}>
                    {depositIdea.goals.slice(0, 3).map((goal, index) => (
                      <View key={goal.id} style={[styles.pillTag, styles.goalPillTag]}>
                        <Text style={styles.pillTagText}>{goal.title}</Text>
                      </View>
                    ))}
                    {depositIdea.goals.length > 3 && (
                      <View style={[styles.pillTag, styles.morePillTag]}>
                        <Text style={styles.pillTagText}>+{depositIdea.goals.length - 3}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
        
        <View style={styles.rightSection}>
          <View style={styles.statusIcons}>
            {depositIdea.has_notes && <FileText size={12} color="#6b7280" />}
            {depositIdea.has_attachments && <Paperclip size={12} color="#6b7280" />}
            {depositIdea.keyRelationships && depositIdea.keyRelationships.length > 0 && (
              <Users size={12} color="#6b7280" />
            )}
          </View>
          
          <View style={styles.ideaActions}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => onUpdate(depositIdea)}
            >
              <Edit size={14} color="#0078d4" />
            </TouchableOpacity>
            
            {!depositIdea.activated_at && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.activateButton]} 
                onPress={handleActivate}
              >
                <Play size={14} color="#16a34a" />
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.cancelButton]} 
              onPress={() => onCancel(depositIdea)}
            >
              <Ban size={14} color="#dc2626" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  });

const styles = StyleSheet.create({
  ideaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#7c3aed', // Purple border for ideas
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    position: 'relative',
  },
  ideaContent: {
    flex: 1,
    marginRight: 8,
  },
  ideaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  ideaTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 22,
    flex: 1,
    marginRight: 8,
  },
  createdDate: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '400',
  },
  activatedBadge: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activatedBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
  },
  ideaBody: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  leftSection: {
    flex: 1,
    marginRight: 8,
  },
  middleSection: {
    flex: 1,
    marginRight: 8,
  },
  rightSection: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 80,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  tagRowLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    marginRight: 6,
    flexShrink: 0,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
  },
  pillTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  rolePillTag: {
    backgroundColor: '#fce7f3',
    borderColor: '#f3e8ff',
  },
  domainPillTag: {
    backgroundColor: '#fed7aa',
    borderColor: '#fdba74',
  },
  goalPillTag: {
    backgroundColor: '#bfdbfe',
    borderColor: '#93c5fd',
  },
  morePillTag: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  pillTagText: {
    fontSize: 8,
    fontWeight: '500',
    color: '#374151',
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  ideaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  activateButton: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  cancelButton: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  draggingItem: {
    opacity: 0.8,
    transform: [{ scale: 1.02 }],
  },
});