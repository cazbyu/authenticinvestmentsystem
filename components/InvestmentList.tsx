import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { TrendingUp, TrendingDown, MoveHorizontal as MoreHorizontal } from 'lucide-react-native';

interface InvestmentItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  categoryColor: string;
  balance: number;
  lastActivity: string;
}

interface InvestmentListProps {
  items: InvestmentItem[];
  type: 'role' | 'wellness' | 'goal';
  onItemPress: (item: InvestmentItem) => void;
}

export function InvestmentList({ items, type, onItemPress }: InvestmentListProps) {
  const getBalanceColor = (balance: number) => {
    if (balance >= 80) return '#16a34a';
    if (balance >= 60) return '#eab308';
    return '#dc2626';
  };

  const getBalanceIcon = (balance: number) => {
    return balance >= 70 ? TrendingUp : TrendingDown;
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {items.map((item, index) => {
        const BalanceIcon = getBalanceIcon(item.balance);
        const balanceColor = getBalanceColor(item.balance);
        
        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.item,
              index === 0 && styles.firstItem,
              index === items.length - 1 && styles.lastItem,
            ]}
            onPress={() => onItemPress(item)}
          >
            <View style={styles.itemContent}>
              <View style={styles.mainContent}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.balanceContainer}>
                    <BalanceIcon size={16} color={balanceColor} />
                    <Text style={[styles.balance, { color: balanceColor }]}>
                      {item.balance}%
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.subtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
                
                <View style={styles.bottomRow}>
                  <View style={styles.categoryContainer}>
                    <View
                      style={[
                        styles.categoryDot,
                        { backgroundColor: item.categoryColor },
                      ]}
                    />
                    <Text style={styles.categoryText}>{item.category}</Text>
                  </View>
                  
                  <Text style={styles.lastActivity}>{item.lastActivity}</Text>
                </View>
              </View>
              
              <TouchableOpacity style={styles.moreButton}>
                <MoreHorizontal size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  containerWrapper: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
  },
  item: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  firstItem: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  lastItem: {
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderBottomWidth: 0,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  mainContent: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balance: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4b5563',
  },
  lastActivity: {
    fontSize: 12,
    color: '#9ca3af',
  },
  moreButton: {
    padding: 4,
  },
});