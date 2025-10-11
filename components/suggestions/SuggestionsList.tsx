import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSuggestions } from '@/hooks/useSuggestions';
import { CheckCircle, Clock, XCircle, Sparkles } from 'lucide-react-native';

interface SuggestionsListProps {
  refreshTrigger?: number;
}

export function SuggestionsList({ refreshTrigger }: SuggestionsListProps) {
  const { colors } = useTheme();
  const { suggestions, loading, error } = useSuggestions(refreshTrigger);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} color={colors.textSecondary} />;
      case 'reviewed':
        return <CheckCircle size={16} color={colors.primary} />;
      case 'implemented':
        return <Sparkles size={16} color={colors.success} />;
      case 'declined':
        return <XCircle size={16} color={colors.error} />;
      default:
        return <Clock size={16} color={colors.textSecondary} />;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'Pending Review';
      case 'reviewed':
        return 'Under Review';
      case 'implemented':
        return 'Implemented';
      case 'declined':
        return 'Declined';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your suggestions...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.errorText, { color: colors.error }]}>Error: {error}</Text>
      </View>
    );
  }

  if (suggestions.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.surface }]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Suggestions Yet</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Share your first suggestion above to help us improve your experience!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Suggestions</Text>

      <View style={styles.list}>
        {suggestions.map((suggestion) => (
          <View
            key={suggestion.id}
            style={[styles.suggestionCard, { backgroundColor: colors.surface }]}
          >
            <View style={styles.suggestionHeader}>
              <View style={styles.statusBadge}>
                {getStatusIcon(suggestion.status)}
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        suggestion.status === 'implemented'
                          ? colors.success
                          : suggestion.status === 'declined'
                          ? colors.error
                          : colors.textSecondary,
                    },
                  ]}
                >
                  {getStatusLabel(suggestion.status)}
                </Text>
              </View>
              <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                {formatDate(suggestion.created_at)}
              </Text>
            </View>

            <Text style={[styles.suggestionContent, { color: colors.text }]}>
              {suggestion.content}
            </Text>

            {suggestion.admin_notes && (
              <View
                style={[styles.adminNotesContainer, { backgroundColor: colors.background }]}
              >
                <Text style={[styles.adminNotesLabel, { color: colors.primary }]}>
                  Admin Response:
                </Text>
                <Text style={[styles.adminNotesText, { color: colors.text }]}>
                  {suggestion.admin_notes}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  list: {
    gap: 12,
  },
  suggestionCard: {
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
  },
  suggestionContent: {
    fontSize: 15,
    lineHeight: 22,
  },
  adminNotesContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  adminNotesLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  adminNotesText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
