import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { calculateAuthenticScore, calculateAuthenticScoreForRole, calculateAuthenticScoreForDomain } from '@/lib/taskUtils';

interface AuthenticScoreContextType {
  authenticScore: number;
  refreshScore: (force?: boolean) => Promise<void>;
  refreshScoreForRole: (roleId: string, force?: boolean) => Promise<number>;
  refreshScoreForDomain: (domainId: string, force?: boolean) => Promise<number>;
  isLoading: boolean;
}

const AuthenticScoreContext = createContext<AuthenticScoreContextType | undefined>(undefined);

const CACHE_TTL = 30000;

export function AuthenticScoreProvider({ children }: { children: React.ReactNode }) {
  const [authenticScore, setAuthenticScore] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const lastFetchTime = useRef<number>(0);
  const roleCache = useRef<Map<string, { score: number; timestamp: number }>>(new Map());
  const domainCache = useRef<Map<string, { score: number; timestamp: number }>>(new Map());

  const refreshScore = useCallback(async (force: boolean = false) => {
    const now = Date.now();

    if (!force && now - lastFetchTime.current < CACHE_TTL) {
      console.log('[AuthenticScoreContext] Using cached score:', authenticScore);
      return;
    }

    console.log('[AuthenticScoreContext] Refreshing score, force:', force);
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        console.log('[AuthenticScoreContext] No authenticated user');
        setAuthenticScore(0);
        return;
      }

      console.log('[AuthenticScoreContext] Fetching fresh score for user:', user.id);
      const score = await calculateAuthenticScore(supabase, user.id);

      setAuthenticScore(score);
      lastFetchTime.current = now;

      console.log('[AuthenticScoreContext] Score updated:', score);
    } catch (error) {
      console.error('[AuthenticScoreContext] Error refreshing score:', error);
    } finally {
      setIsLoading(false);
    }
  }, [authenticScore]);

  const refreshScoreForRole = useCallback(async (roleId: string, force: boolean = false): Promise<number> => {
    const now = Date.now();
    const cached = roleCache.current.get(roleId);

    if (!force && cached && now - cached.timestamp < CACHE_TTL) {
      console.log('[AuthenticScoreContext] Using cached role score:', roleId, cached.score);
      return cached.score;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        console.log('[AuthenticScoreContext] No authenticated user for role score');
        return 0;
      }

      console.log('[AuthenticScoreContext] Fetching fresh role score:', roleId);
      const score = await calculateAuthenticScoreForRole(supabase, user.id, roleId);

      roleCache.current.set(roleId, { score, timestamp: now });

      console.log('[AuthenticScoreContext] Role score updated:', roleId, score);
      return score;
    } catch (error) {
      console.error('[AuthenticScoreContext] Error refreshing role score:', error);
      return 0;
    }
  }, []);

  const refreshScoreForDomain = useCallback(async (domainId: string, force: boolean = false): Promise<number> => {
    const now = Date.now();
    const cached = domainCache.current.get(domainId);

    if (!force && cached && now - cached.timestamp < CACHE_TTL) {
      console.log('[AuthenticScoreContext] Using cached domain score:', domainId, cached.score);
      return cached.score;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        console.log('[AuthenticScoreContext] No authenticated user for domain score');
        return 0;
      }

      console.log('[AuthenticScoreContext] Fetching fresh domain score:', domainId);
      const score = await calculateAuthenticScoreForDomain(supabase, user.id, domainId);

      domainCache.current.set(domainId, { score, timestamp: now });

      console.log('[AuthenticScoreContext] Domain score updated:', domainId, score);
      return score;
    } catch (error) {
      console.error('[AuthenticScoreContext] Error refreshing domain score:', error);
      return 0;
    }
  }, []);

  return (
    <AuthenticScoreContext.Provider
      value={{
        authenticScore,
        refreshScore,
        refreshScoreForRole,
        refreshScoreForDomain,
        isLoading,
      }}
    >
      {children}
    </AuthenticScoreContext.Provider>
  );
}

export function useAuthenticScore() {
  const context = useContext(AuthenticScoreContext);
  if (context === undefined) {
    throw new Error('useAuthenticScore must be used within an AuthenticScoreProvider');
  }
  return context;
}
