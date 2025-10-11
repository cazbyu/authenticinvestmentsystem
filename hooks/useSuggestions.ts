import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

export interface Suggestion {
  id: string;
  user_id: string;
  content: string;
  status: 'pending' | 'reviewed' | 'implemented' | 'declined';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UseSuggestionsResult {
  suggestions: Suggestion[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  submitSuggestion: (content: string) => Promise<{ success: boolean; error?: string }>;
}

export function useSuggestions(refreshTrigger?: number): UseSuggestionsResult {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('0008-ap-suggestions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching suggestions:', fetchError);
        setError(fetchError.message);
      } else {
        setSuggestions(data || []);
      }
    } catch (err) {
      console.error('Exception fetching suggestions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const submitSuggestion = async (content: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      if (!content || content.trim().length < 5) {
        return { success: false, error: 'Suggestion must be at least 5 characters' };
      }

      if (content.length > 1000) {
        return { success: false, error: 'Suggestion must be less than 1000 characters' };
      }

      const { error: insertError } = await supabase
        .from('0008-ap-suggestions')
        .insert({
          user_id: user.id,
          content: content.trim(),
          status: 'pending',
        });

      if (insertError) {
        console.error('Error submitting suggestion:', insertError);
        return { success: false, error: insertError.message };
      }

      await fetchSuggestions();
      return { success: true };
    } catch (err) {
      console.error('Exception submitting suggestion:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [refreshTrigger]);

  return {
    suggestions,
    loading,
    error,
    refetch: fetchSuggestions,
    submitSuggestion,
  };
}
