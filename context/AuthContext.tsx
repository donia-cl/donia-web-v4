
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
  
  // Inicializamos el estado desde sessionStorage para mantener el bloqueo en F5
  const [is2FAWaiting, setIs2FAWaiting] = useState(() => {
    return sessionStorage.getItem('donia_2fa_lock') === 'true';
  });
  
  const authService = AuthService.getInstance();
  const mountedRef = useRef(true);
  const isSigningOut = useRef(false);

  const set2FAWaitingStatus = (waiting: boolean) => {
    setIs2FAWaiting(waiting);
    if (waiting) sessionStorage.setItem('donia_2fa_lock', 'true');
    else sessionStorage.removeItem('donia_2fa_lock');
  };

  useEffect(() => {
    mountedRef.current = true;
    let subscription: any = null;
    
    const initializeAuth = async () => {
      try {
        await authService.initialize();
        const client = authService.getSupabase();
        
        if (!client) {
          if (mountedRef.current) setLoading(false);
          return;
        }

        // Cargar sesión inicial de forma silenciosa
        const { data: { session } } = await client.auth.getSession();
        if (session?.user && mountedRef.current) {
          const p = await authService.fetchProfile(session.user.id);
          setUser(session.user);
          setProfile(p);
        }
        if (mountedRef.current) setLoading(false);

        const { data } = (client.auth as any).onAuthStateChange(async (event, session) => {
          if (!mountedRef.current || isSigningOut.current) return;
          
          const currentUser = session?.user ?? null;
          
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (currentUser) {
              // IMPORTANTE: No activamos el bloqueo aquí automáticamente.
              // El bloqueo solo se activa desde el componente Auth.tsx durante el flujo de login.
              // Aquí solo actualizamos los datos de identidad.
              const p = await authService.fetchProfile(currentUser.id);
              setUser(currentUser);
              setProfile(p);
            }
          }
          
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setProfile(null);
            set2FAWaitingStatus(false);
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
      const p = await authService.fetchProfile(user.id);
      setProfile(p);
    }
  };

  // El usuario expuesto es null si estamos esperando el 2FA, 
  // lo que protege las vistas privadas y el Header.
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
