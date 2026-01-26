
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthService } from '../services/AuthService';
import { Profile } from '../types';

interface AuthContextType {
  user: any | null;
  internalUser: any | null; // Usuario real de Supabase, incluso si está bloqueado por 2FA
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

        // Cargar sesión inicial
        const { data: { session } } = await client.auth.getSession();
        if (session?.user && mountedRef.current) {
          const p = await authService.fetchProfile(session.user.id);
          setInternalUser(session.user);
          setProfile(p);
          
          // Si el 2FA está activo en el perfil y no hemos liberado el lock de sesión
          if (p?.two_factor_enabled && sessionStorage.getItem('donia_2fa_lock') === 'true') {
            setUser(null);
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

              // LOGICA CRITICA: Si es un login nuevo (SIGNED_IN) y tiene 2FA activado
              if (event === 'SIGNED_IN' && p?.two_factor_enabled) {
                // Solo activamos si no veníamos ya de un estado de espera (evitar loops)
                if (sessionStorage.getItem('donia_2fa_lock') !== 'true') {
                  set2FAWaitingStatus(true);
                  setUser(null); // Ocultamos el usuario al resto de la app
                  
                  // Disparamos el envío del código automáticamente para el flujo Google
                  try {
                    await fetch('/api/security-otp', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: currentUser.id, type: 'login_2fa' })
                    });
                  } catch (otpErr) {
                    console.error("Error enviando OTP automático:", otpErr);
                  }
                } else {
                  setUser(null);
                }
              } else {
                // Si no tiene 2FA o ya está verificado
                if (sessionStorage.getItem('donia_2fa_lock') !== 'true') {
                  setUser(currentUser);
                }
              }
            }
          }
          
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setInternalUser(null);
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
      setInternalUser(null);
      setProfile(null);
      set2FAWaitingStatus(false);
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
