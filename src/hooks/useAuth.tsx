import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile, UserRole, AppRole } from '@/types/project';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: AppRole | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isProjectExecutor: boolean;
  isEmailVerified: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resendVerification: (email: string) => Promise<{ error: Error | null }>;
  updateEmail: (newEmail: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer profile and role fetch to avoid deadlocks
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);

          // Send welcome email for new Google OAuth users
          if (event === 'SIGNED_IN' && session.user.app_metadata?.provider === 'google') {
            const createdAt = new Date(session.user.created_at);
            const now = new Date();
            const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;
            // If account was created less than 30 seconds ago, it's a new user
            if (diffSeconds < 30) {
              setTimeout(async () => {
                try {
                  await supabase.functions.invoke('send-welcome-email', {
                    body: {
                      email: session.user.email,
                      name: session.user.user_metadata?.name || session.user.email,
                    },
                  });
                } catch (e) {
                  console.error('Failed to send welcome email:', e);
                }
              }, 0);
            }
          }

          // Sync profile email on user update (e.g. email change confirmed)
          if (event === 'USER_UPDATED' && session.user.email) {
            setTimeout(async () => {
              try {
                await supabase
                  .from('profiles')
                  .update({ email: session.user.email, gmail: session.user.email })
                  .eq('id', session.user.id);
              } catch (error) {
                if (import.meta.env.DEV) {
                  console.error('Error syncing profile email:', error);
                }
              }
            }, 0);
          }
        } else {
          setProfile(null);
          setRole(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as UserProfile);
      }

      // Fetch role - prioritize super_admin > project_executor > user
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);

      if (roleData && roleData.length > 0) {
        const superAdminRole = roleData.find(r => r.role === 'super_admin');
        const executorRole = roleData.find(r => r.role === 'project_executor');
        const adminRole = roleData.find(r => r.role === 'admin');

        if (superAdminRole) {
          setRole('super_admin');
        } else if (executorRole) {
          setRole('project_executor');
        } else if (adminRole) {
          // Legacy admin role - treat as project_executor
          setRole('project_executor');
        } else {
          setRole((roleData[0] as UserRole).role);
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching user data:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { name },
        },
      });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        }
      });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  };

  const resendVerification = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  };

  const updateEmail = async (newEmail: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const isEmailVerified = !!user?.email_confirmed_at;

  const value = {
    user,
    session,
    profile,
    role,
    isAdmin: role === 'super_admin',
    isSuperAdmin: role === 'super_admin',
    isProjectExecutor: role === 'project_executor' || role === 'admin',
    isEmailVerified,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resendVerification,
    updateEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
