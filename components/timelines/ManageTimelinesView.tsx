import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ArchivedTimelinesView } from '@/components/settings/ArchivedTimelinesView';
import { ManageCustomTimelinesModal } from './ManageCustomTimelinesModal';
import { ManageGlobalTimelinesModal } from './ManageGlobalTimelinesModal';

export type ManageTimelinesSubTab = 'custom' | 'global' | 'archive';

interface ManageTimelinesViewProps {
  onUpdate?: () => void;
}

export function ManageTimelinesView({ onUpdate }: ManageTimelinesViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<ManageTimelinesSubTab>('custom');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showGlobalModal, setShowGlobalModal] = useState(false);

  const handleUpdate = () => {
    onUpdate?.();
  };

  const renderSubTabButtons = () => (
    <View style={styles.subTabsContainer}>
      <TouchableOpacity
        style={[
          styles.subTab,
          activeSubTab === 'custom' && styles.activeSubTab,
        ]}
        onPress={() => {
          setActiveSubTab('custom');
          setShowCustomModal(true);
          setShowGlobalModal(false);
        }}
        accessibilityLabel="Manage Custom Timelines"
        accessibilityRole="tab"
        accessibilityState={{ selected: activeSubTab === 'custom' }}
      >
        <Text
          style={[
            styles.subTabText,
            activeSubTab === 'custom' && styles.activeSubTabText,
          ]}
        >
          Manage Custom
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.subTab,
          activeSubTab === 'global' && styles.activeSubTab,
        ]}
        onPress={() => {
          setActiveSubTab('global');
          setShowGlobalModal(true);
          setShowCustomModal(false);
        }}
        accessibilityLabel="Manage Standardized 12 Week Timelines"
        accessibilityRole="tab"
        accessibilityState={{ selected: activeSubTab === 'global' }}
      >
        <Text
          style={[
            styles.subTabText,
            activeSubTab === 'global' && styles.activeSubTabText,
          ]}
        >
          12 Week Timelines
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.subTab,
          activeSubTab === 'archive' && styles.activeSubTab,
        ]}
        onPress={() => {
          setActiveSubTab('archive');
          setShowCustomModal(false);
          setShowGlobalModal(false);
        }}
        accessibilityLabel="View Timeline Archive"
        accessibilityRole="tab"
        accessibilityState={{ selected: activeSubTab === 'archive' }}
      >
        <Text
          style={[
            styles.subTabText,
            activeSubTab === 'archive' && styles.activeSubTabText,
          ]}
        >
          Timeline Archive
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    if (activeSubTab === 'archive') {
      return <ArchivedTimelinesView onUpdate={handleUpdate} />;
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {renderSubTabButtons()}
      <View style={styles.content}>
        {renderContent()}
      </View>

      <ManageCustomTimelinesModal
        visible={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onUpdate={handleUpdate}
      />

      <ManageGlobalTimelinesModal
        visible={showGlobalModal}
        onClose={() => setShowGlobalModal(false)}
        onUpdate={handleUpdate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  subTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  subTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeSubTab: {
    borderBottomColor: '#0078d4',
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  activeSubTabText: {
    color: '#0078d4',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
});
