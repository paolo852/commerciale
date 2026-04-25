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
    let unsub: (() => void) | undefined;

    if (isDemoMode) {
      setUser(toAuthUser(demoAuth.getUser()));
      setLoading(false);
      return;
    }

    supabase!.auth.getSession().then(({ data }) => {
      setUser(toAuthUser(data.session?.user ?? null));
      setLoading(false);
    });

    const { data: sub } = supabase!.auth.onAuthStateChange((_event, session) => {
      setUser(toAuthUser(session?.user ?? null));
    });
    unsub = () => sub.subscription.unsubscribe();

    return () => unsub?.();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (isDemoMode) {
      const u = demoAuth.signIn(email);
      setUser(toAuthUser(u));
      return;
    }
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error) throw error;
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
