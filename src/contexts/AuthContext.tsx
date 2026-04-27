import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { isDemoMode, supabase } from '../lib/supabase';
import { demoAuth, type DemoUser } from '../lib/demoStorage';
import { allowedUsersService } from '../lib/dataService';

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toAuthUser(u: { id: string; email?: string | null } | DemoUser | null): AuthUser | null {
  if (!u) return null;
  return { id: u.id, email: u.email ?? '' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) {
      setUser(toAuthUser(demoAuth.getUser()));
      setLoading(false);
      return;
    }

    const { data: sub } = supabase!.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user ?? null;
      try {
        if (sessionUser?.email) {
          const allowed = await allowedUsersService.isAllowed(sessionUser.email);
          if (!allowed) {
            await supabase!.auth.signOut();
            setUser(null);
            setLoading(false);
            return;
          }
        }
      } catch {
        // fail open: non bloccare il caricamento per errori del whitelist
      }
      setUser(toAuthUser(sessionUser));
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (isDemoMode) {
      const u = demoAuth.signIn(email);
      setUser(toAuthUser(u));
      return;
    }
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const allowed = await allowedUsersService.isAllowed(email);
    if (!allowed) {
      await supabase!.auth.signOut();
      throw new Error('Accesso non autorizzato. Contatta l\'amministratore per essere aggiunto al registro utenti.');
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (isDemoMode) {
      const u = demoAuth.signIn(email);
      setUser(toAuthUser(u));
      return;
    }
    const { error } = await supabase!.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (isDemoMode) {
      demoAuth.signOut();
      setUser(null);
      return;
    }
    const { error } = await supabase!.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isDemoMode, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>');
  return ctx;
}
