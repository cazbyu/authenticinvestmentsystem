import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get environment variables
const supabaseUrl = (Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = (Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
  console.error('Required variables: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

// Validate URL format
let isValidUrl = false;
if (supabaseUrl && supabaseAnonKey) {
  try {
    new URL(supabaseUrl);
    isValidUrl = true;
    console.log('Supabase URL being used:', supabaseUrl);
    console.log('Supabase connection initialized successfully');
  } catch (error) {
    console.error('Invalid Supabase URL format:', supabaseUrl);
    console.error('URL validation error:', error);
  }
}

// Use appropriate storage for each platform
const getStorage = () => {
  if (Platform.OS === 'web') {
    return {
      getItem: (key: string) => {
        if (typeof localStorage === 'undefined') {
          return null;
        }
        return localStorage.getItem(key);
      },
      setItem: (key: string, value: string) => {
        if (typeof localStorage === 'undefined') {
          return;
        }
        localStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        if (typeof localStorage === 'undefined') {
          return;
        }
        localStorage.removeItem(key);
      },
    };
  }
  return AsyncStorage;
};

export const supabase = isValidUrl ? (() => {
  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: getStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    return null;
  }
})() : null;

export function getSupabaseClient() {
  if (!supabase) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Supabase client is not initialized. Missing environment variables: EXPO_PUBLIC_SUPABASE_URL and/or EXPO_PUBLIC_SUPABASE_ANON_KEY.'
      );
    }
    if (!isValidUrl) {
      throw new Error(
        'Supabase client is not initialized. Invalid URL format: ' + supabaseUrl
      );
    }
    throw new Error(
      'Supabase client failed to initialize. Check your configuration and network connection.'
    );
  }
  return supabase;
}
