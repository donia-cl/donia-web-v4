
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthService } from '../services/AuthService';
import { Profile } from '../types';

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  loading: boolean;
  is2FAWaiting: boolean;
  set2FAWaiting: (waiting: boolean) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // El 'lock' se persiste en sessionStorage para que un F5 no salte el 2FA si la sesión de Supabase ya existe
  const [is2FAWaiting, setIs2FAWaiting] = useState(() => {
    return sessionStorage.getItem('donia_2fa_lock') === 'true';
  });
  
  const authService = AuthService.getInstance();
  const mountedRef = useRef(true);
  const isSigningOut = useRef(false);

  const loadUserProfile = async (currentUser: any, retryCount = 0): Promise<Profile | null> => {
    if (!currentUser || !mountedRef.current || isSigningOut.current) return null;
    try {
      let userProfile = await authService.fetchProfile(currentUser.id);
      if (!userProfile && retryCount < 2 && !currentUser.id.startsWith('mock-')) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return loadUserProfile(currentUser, retryCount + 1);
      }
      return userProfile;
    } catch (err) {
      console.error(`Error loading profile for user ${currentUser.id}:`, err);
      return null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    let subscription: any = null;
    
    const initializeAuth = async () => {
      try {
        await authService.initialize();
        const client = authService.getSupabase();
        
        const session = await authService.getSession();
        if (session?.user && mountedRef.current) {
            setUser(session.user);
            const p = await loadUserProfile(session.user);
            setProfile(p);
            setLoading(false);
        }

        if (!client) {
          if (mountedRef.current) setLoading(false);
          return;
        }

        const { data } = (client.auth as any).onAuthStateChange(async (event, session) => {
          if (!mountedRef.current || isSigningOut.current) return;
          
          const currentUser = session?.user ?? null;
          
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setUser(currentUser);
            if (currentUser) {
              const p = await loadUserProfile(currentUser);
              if (mountedRef.current) setProfile(p);
            }
            if (mountedRef.current) setLoading(false);
          }
          
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setProfile(null);
            set2FAWaitingStatus(false);
            if (mountedRef.current) setLoading(false);
          }
        });

        subscription = data.subscription;

      } catch (error) {
        console.error("[AUTH] Error inicialización:", error);
        if (mountedRef.current) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      mountedRef.current = false;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const set2FAWaitingStatus = (waiting: boolean) => {
    setIs2FAWaiting(waiting);
    if (waiting) sessionStorage.setItem('donia_2fa_lock', 'true');
    else sessionStorage.removeItem('donia_2fa_lock');
  };

  const signOut = async () => {
    if (isSigningOut.current) return;
    isSigningOut.current = true;
    setLoading(true);
    try {
      setUser(null);
      setProfile(null);
      set2FAWaitingStatus(false);
      await authService.signOut();
      window.location.assign('/');
    } catch (e) {
      window.location.assign('/');
    }
  };

  const refreshProfile = async () => {
    if (user && mountedRef.current && !isSigningOut.current) {
      const p = await loadUserProfile(user);
      setProfile(p);
    }
  };

  // SEGURIDAD FRONTEND: Si estamos esperando 2FA, exponemos 'null' como usuario
  // Esto evita que componentes como el Header muestren el nombre o el Dashboard se cargue.
  const exposedUser = is2FAWaiting ? null : user;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="w-10 h-10 text-violet-600 animate-spin mb-4" />
        <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Validando acceso...</span>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user: exposedUser, 
      profile, 
      setProfile, 
      loading, 
      is2FAWaiting, 
      set2FAWaiting: set2FAWaitingStatus,
      signOut, 
      refreshProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
