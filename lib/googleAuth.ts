import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { getSupabaseClient } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  const supabase = getSupabaseClient();

  const redirectTo = Platform.OS === 'web'
    ? `${window.location.origin}/auth/callback`
    : makeRedirectUri({
        path: '/auth/callback',
      });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });

  if (error) {
    throw error;
  }

  if (Platform.OS !== 'web' && data?.url) {
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectTo
    );

    if (result.type === 'success') {
      const url = result.url;
      const params = new URL(url).searchParams;
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }
    } else if (result.type === 'cancel') {
      throw new Error('Sign in was cancelled');
    }
  }

  return data;
}

export async function linkGoogleAccount() {
  const supabase = getSupabaseClient();

  const redirectTo = Platform.OS === 'web'
    ? `${window.location.origin}/settings`
    : makeRedirectUri({
        path: '/settings',
      });

  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });

  if (error) {
    throw error;
  }

  if (Platform.OS !== 'web' && data?.url) {
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectTo
    );

    if (result.type === 'cancel') {
      throw new Error('Account linking was cancelled');
    }
  }

  return data;
}

export async function unlinkGoogleAccount() {
  const supabase = getSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('No user found');
  }

  const googleIdentity = user.identities?.find(
    (identity) => identity.provider === 'google'
  );

  if (!googleIdentity) {
    throw new Error('No Google account linked');
  }

  const { error } = await supabase.auth.unlinkIdentity({
    identity_id: googleIdentity.id,
  });

  if (error) {
    throw error;
  }

  return { success: true };
}

export async function getLinkedProviders() {
  const supabase = getSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  return user.identities?.map((identity) => identity.provider) || [];
}
