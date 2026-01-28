import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthService } from '../services/AuthService';
import { Profile } from '../types';

interface AuthContextType {
  user: any | null;
  internalUser: any | null;
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
  const [internalUser, setInternalUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [is2FAWaiting, setIs2FAWaiting] = useState(() => {
    return sessionStorage.getItem('donia_2fa_lock') === 'true';
  });
  
  const authService = AuthService.getInstance();
  const mountedRef = useRef(true);
  const isSigningOut = useRef(false);
  const otpProcessingRef = useRef<string | null>(null);

  // Función para manejar el estado de espera de 2FA
  const set2FAWaitingStatus = (waiting: boolean) => {
    setIs2FAWaiting(waiting);
    if (waiting) {
      sessionStorage.setItem('donia_2fa_lock', 'true');
    } else {
      sessionStorage.removeItem('donia_2fa_lock');
      otpProcessingRef.current = null;
      if (internalUser) {
        setUser(internalUser);
      }
    }
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

        const { data: { session } } = await client.auth.getSession();
        
        // --- GESTIÓN DE PARÁMETROS DE VERIFICACIÓN ---
        const params = new URLSearchParams(window.location.search);
        if (params.get('verified') === 'true') {
          sessionStorage.setItem('donia_2fa_verified', 'true');
          // LIMPIAR URL PARA EVITAR LOOPS: Eliminamos el parámetro 'verified' sin recargar
          const newUrl = window.location.pathname + window.location.search.replace(/[?&]verified=true/, '').replace(/^&/, '?');
          window.history.replaceState({}, '', newUrl || '/');
        }

        if (session?.user && mountedRef.current) {
          const p = await authService.fetchProfile(session.user.id);
          setInternalUser(session.user);
          setProfile(p);
          
          const isGoogle = session.user.app_metadata?.provider === 'google' || session.user.app_metadata?.providers?.includes('google');
          const isVerifiedInSession = sessionStorage.getItem('donia_2fa_verified') === 'true';

          // REGLA: 2FA bloquea solo si NO es Google y NO viene de un link verificado recientemente
          if (p?.two_factor_enabled && !isGoogle && !isVerifiedInSession) {
            setUser(null);
            setIs2FAWaiting(true);
            sessionStorage.setItem('donia_2fa_lock', 'true');
          } else {
            setUser(session.user);
            setIs2FAWaiting(false);
            sessionStorage.removeItem('donia_2fa_lock');
          }
        }
        
        if (mountedRef.current) setLoading(false);

        const { data } = (client.auth as any).onAuthStateChange(async (event, session) => {
          if (!mountedRef.current || isSigningOut.current) return;
          
          const currentUser = session?.user ?? null;
          
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (currentUser) {
              const p = await authService.fetchProfile(currentUser.id);
              setInternalUser(currentUser);
              setProfile(p);

              const isGoogle = currentUser.app_metadata?.provider === 'google' || currentUser.app_metadata?.providers?.includes('google');
              const isVerifiedInSession = sessionStorage.getItem('donia_2fa_verified') === 'true';

              if (p?.two_factor_enabled && !isGoogle && !isVerifiedInSession) {
                setIs2FAWaiting(true);
                sessionStorage.setItem('donia_2fa_lock', 'true');
                setUser(null);
                
                if (otpProcessingRef.current !== currentUser.id) {
                  otpProcessingRef.current = currentUser.id;
                  try {
                    await fetch('/api/security-otp', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        userId: currentUser.id, 
                        type: 'login_2fa',
                        email: currentUser.email 
                      })
                    });
                  } catch (otpErr) {
                    otpProcessingRef.current = null;
                  }
                }
              } else {
                setUser(currentUser);
                setIs2FAWaiting(false);
                sessionStorage.removeItem('donia_2fa_lock');
              }
            }
          }
          
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setInternalUser(null);
            setProfile(null);
            setIs2FAWaiting(false);
            sessionStorage.removeItem('donia_2fa_lock');
            sessionStorage.removeItem('donia_2fa_verified');
            otpProcessingRef.current = null;
          }
        });

        subscription = data.subscription;

      } catch (error) {
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
      setInternalUser(null);
      setProfile(null);
      setIs2FAWaiting(false);
      sessionStorage.removeItem('donia_2fa_lock');
      sessionStorage.removeItem('donia_2fa_verified');
      otpProcessingRef.current = null;
      await authService.signOut();
      window.location.assign('/');
    } catch (e) {
      window.location.assign('/');
    }
  };

  const refreshProfile = async () => {
    if (internalUser && mountedRef.current && !isSigningOut.current) {
      const p = await authService.fetchProfile(internalUser.id);
      setProfile(p);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="w-10 h-10 text-violet-600 animate-spin mb-4" />
        <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Sincronizando sesión...</span>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      internalUser,
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