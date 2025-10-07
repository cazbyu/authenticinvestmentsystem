import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'lucide-react-native';
import { getLinkedProviders, linkGoogleAccount, unlinkGoogleAccount } from '@/lib/googleAuth';

export function LinkedAccountsManager() {
  const [providers, setProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const linkedProviders = await getLinkedProviders();
      setProviders(linkedProviders);
    } catch (error) {
      console.error('Failed to load linked providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkGoogle = async () => {
    setActionLoading(true);
    try {
      await linkGoogleAccount();
      Alert.alert('Success', 'Google account linked successfully');
      await loadProviders();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to link Google account';
      if (errorMessage !== 'Account linking was cancelled') {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlinkGoogle = () => {
    const hasPasswordAuth = providers.includes('email');

    if (!hasPasswordAuth && providers.length === 1) {
      Alert.alert(
        'Cannot Unlink',
        'You must have at least one authentication method. Please set up email/password authentication before unlinking your Google account.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Unlink Google Account',
      'Are you sure you want to unlink your Google account? You will need to use your email and password to sign in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await unlinkGoogleAccount();
              Alert.alert('Success', 'Google account unlinked successfully');
              await loadProviders();
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to unlink Google account';
              Alert.alert('Error', errorMessage);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Linked Accounts</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#0078d4" />
        </View>
      </View>
    );
  }

  const isGoogleLinked = providers.includes('google');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Linked Accounts</Text>
      <Text style={styles.description}>
        Connect your accounts to sign in with multiple methods
      </Text>

      <View style={styles.accountCard}>
        <View style={styles.accountHeader}>
          <View style={styles.providerInfo}>
            <View style={styles.googleIconContainer}>
              <Text style={styles.googleIcon}>G</Text>
            </View>
            <View style={styles.providerTextContainer}>
              <Text style={styles.providerName}>Google</Text>
              <Text style={styles.providerStatus}>
                {isGoogleLinked ? 'Connected' : 'Not connected'}
              </Text>
            </View>
          </View>

          {actionLoading ? (
            <ActivityIndicator size="small" color="#0078d4" />
          ) : isGoogleLinked ? (
            <TouchableOpacity
              style={styles.unlinkButton}
              onPress={handleUnlinkGoogle}
            >
              <Text style={styles.unlinkButtonText}>Unlink</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleLinkGoogle}
            >
              <Link size={16} color="#ffffff" style={styles.linkIcon} />
              <Text style={styles.linkButtonText}>Link</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.accountCard}>
        <View style={styles.accountHeader}>
          <View style={styles.providerInfo}>
            <View style={styles.emailIconContainer}>
              <Text style={styles.emailIcon}>@</Text>
            </View>
            <View style={styles.providerTextContainer}>
              <Text style={styles.providerName}>Email & Password</Text>
              <Text style={styles.providerStatus}>
                {providers.includes('email') ? 'Connected' : 'Not connected'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  accountCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  googleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleIcon: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  emailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emailIcon: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  providerTextContainer: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  providerStatus: {
    fontSize: 13,
    color: '#6b7280',
  },
  linkButton: {
    backgroundColor: '#0078d4',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkIcon: {
    marginRight: 6,
  },
  linkButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  unlinkButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  unlinkButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
