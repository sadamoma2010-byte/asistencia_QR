'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { api, tokenStorage } from '@/lib/api';
import type { AuthResponse, SessionUser } from '@/types';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Verifica un permiso granular. SUPER_ADMIN siempre lo tiene. */
  can: (...permissions: string[]) => boolean;
  isTeacherOnly: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Restaura la sesión al montar si existe un token vigente
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!tokenStorage.access) {
        setLoading(false);
        return;
      }
      try {
        const profile = await api.get<SessionUser>('/auth/me');
        if (!cancelled) setUser(profile);
      } catch {
        tokenStorage.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<AuthResponse>(
      '/auth/login',
      { email, password },
      { skipAuth: true },
    );
    tokenStorage.save(response.accessToken, response.refreshToken);
    setUser(response.user);
    return response.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // La sesión se cierra en el cliente aunque el servidor no responda
    }
    tokenStorage.clear();
    setUser(null);
    queryClient.clear();
    router.replace('/login');
  }, [queryClient, router]);

  const refreshProfile = useCallback(async () => {
    const profile = await api.get<SessionUser>('/auth/me');
    setUser(profile);
  }, []);

  const can = useCallback(
    (...permissions: string[]) => {
      if (!user) return false;
      if (user.role.name === 'SUPER_ADMIN') return true;
      if (permissions.length === 0) return true;
      return permissions.some((permission) => user.permissions.includes(permission));
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshProfile,
      can,
      // Un docente puro solo tiene acceso al panel de marcación
      isTeacherOnly: Boolean(user) && user!.role.name === 'DOCENTE',
    }),
    [user, loading, login, logout, refreshProfile, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
