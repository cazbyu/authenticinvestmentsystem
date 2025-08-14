import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wyipyiahvjcvnwoxwttd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5aXB5aWFodmpjdm53b3h3dHRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyOTIxOTUsImV4cCI6MjA2Mzg2ODE5NX0.xDXgmmyJ_Hz742DnzW9lcLnjaMU0Die3V0FlxZAyP5Y';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});