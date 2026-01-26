
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
  // CANDADO: Evita que se disparen múltiples correos al mismo tiempo por eventos repetidos de Supabase
  const otpProcessingRef = useRef<string | null>(null);

  const set2FAWaitingStatus = (waiting: boolean) => {
    setIs2FAWaiting(waiting);
    if (waiting) sessionStorage.setItem('donia_2fa_lock', 'true');
    else {
      sessionStorage.removeItem('donia_2fa_lock');
      otpProcessingRef.current = null; // Liberamos el candado al terminar el flujo
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
        if (session?.user && mountedRef.current) {
          const p = await authService.fetchProfile(session.user.id);
          setInternalUser(session.user);
          setProfile(p);
          
          if (p?.two_factor_enabled && sessionStorage.getItem('donia_2fa_verified') !== 'true') {
            setUser(null);
            set2FAWaitingStatus(true);
          } else {
            setUser(session.user);
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

              const isVerifiedInSession = sessionStorage.getItem('donia_2fa_verified') === 'true';

              if (p?.two_factor_enabled && !isVerifiedInSession) {
                set2FAWaitingStatus(true);
                setUser(null);
                
                // CONTROL DE FLUJO: Solo enviar OTP si no hemos enviado uno para este ID de usuario en este ciclo
                if (otpProcessingRef.current !== currentUser.id) {
                  otpProcessingRef.current = currentUser.id;
                  
                  try {
                    await fetch('/api/security-otp', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: currentUser.id, type: 'login_2fa' })
                    });
                    console.log("[AUTH] OTP enviado automáticamente.");
                  } catch (otpErr) {
                    console.error("Error enviando OTP:", otpErr);
                    otpProcessingRef.current = null; // Reintento posible si falló la red
                  }
                }
              } else {
                setUser(currentUser);
                set2FAWaitingStatus(false);
              }
            }
          }
          
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setInternalUser(null);
            setProfile(null);
            set2FAWaitingStatus(false);
            sessionStorage.removeItem('donia_2fa_verified');
            otpProcessingRef.current = null;
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
      setInternalUser(null);
      setProfile(null);
      set2FAWaitingStatus(false);
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
        <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Validando acceso...</span>
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
