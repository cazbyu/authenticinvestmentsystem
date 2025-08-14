import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Menu, Plus, Search } from 'lucide-react-native';

interface HeaderProps {
  title: string;
  onAdd?: () => void;
}

export function Header({ title, onAdd }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.leftSection}>
        <TouchableOpacity style={styles.menuButton}>
          <Menu size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
      </View>
      
      <View style={styles.rightSection}>
        <TouchableOpacity style={styles.iconButton}>
          <Search size={20} color="#ffffff" />
        </TouchableOpacity>
        
        {onAdd && (
          <TouchableOpacity style={styles.iconButton} onPress={onAdd}>
            <Plus size={20} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#0078d4',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuButton: {
    marginRight: 16,
    padding: 4,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});