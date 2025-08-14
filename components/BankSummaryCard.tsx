import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { User, Heart, Target, TrendingUp } from 'lucide-react-native';

interface BankSummaryCardProps {
  title: string;
  balance: number;
  color: string;
  icon: 'user' | 'heart' | 'target';
  subtitle: string;
}

export function BankSummaryCard({ title, balance, color, icon, subtitle }: BankSummaryCardProps) {
  const getIcon = () => {
    switch (icon) {
      case 'user':
        return User;
      case 'heart':
        return Heart;
      case 'target':
        return Target;
      default:
        return User;
    }
  };

  const Icon = getIcon();

  return (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.leftSection}>
          <View style={[styles.iconContainer, { backgroundColor: color }]}>
            <Icon size={24} color="#ffffff" />
          </View>
          <View style={styles.textContent}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>
        
        <View style={styles.rightSection}>
          <View style={styles.balanceContainer}>
            <TrendingUp size={16} color={color} />
            <Text style={[styles.balance, { color }]}>{balance}%</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balance: {
    fontSize: 18,
    fontWeight: '700',
  },
});