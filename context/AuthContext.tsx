
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthService } from '../services/AuthService';
import { Profile } from '../types';

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const authService = AuthService.getInstance();
  const mountedRef = useRef(true);
  const isSigningOut = useRef(false);

  // Carga el perfil con lógica de reintento para evitar race conditions
  const loadUserProfile = async (currentUser: any, retryCount = 0): Promise<Profile | null> => {
    if (!currentUser || !mountedRef.current || isSigningOut.current) return null;
    
    try {
      let userProfile = await authService.fetchProfile(currentUser.id);
      
      // Si no existe, esperamos un momento (el trigger de DB podría estar trabajando)
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
        
        // 1. Verificar sesión persistente (Mock o Real)
        const session = await authService.getSession();
        if (session?.user && mountedRef.current) {
            setUser(session.user);
            const p = await loadUserProfile(session.user);
            setProfile(p);
            setLoading(false);
            // No retornamos aquí, el listener de abajo es el que debe mandar
        }

        if (!client) {
          if (mountedRef.current) setLoading(false);
          return;
        }

        // 2. Listener de cambios de estado
        const { data } = (client.auth as any).onAuthStateChange(async (event, session) => {
          if (!mountedRef.current || isSigningOut.current) return;
          
          const currentUser = session?.user ?? null;
          console.debug(`[AUTH-EVENT] ${event}`, currentUser?.id);
          
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setUser(currentUser);
            if (currentUser) {
              const p = await loadUserProfile(currentUser);
              if (mountedRef.current) setProfile(p);
              
              // Limpiar URL si hay códigos de auth
              if (event === 'SIGNED_IN' && window.location.search.includes('code=')) {
                const url = new URL(window.location.href);
                url.searchParams.delete('code');
                url.searchParams.delete('state');
                window.history.replaceState({}, document.title, url.pathname);
              }
            }
            if (mountedRef.current) setLoading(false);
          }
          
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setProfile(null);
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
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signOut = async () => {
    if (isSigningOut.current) return;
    isSigningOut.current = true;
    setLoading(true);
    
    try {
      // 1. Limpiar estado de React inmediatamente
      setUser(null);
      setProfile(null);
      
      // 2. Llamar al servicio de limpieza profunda
      await authService.signOut();
      
      // 3. Forzar redirección limpia al home (limpia todo el árbol de React)
      window.location.assign('/');
    } catch (e) {
      console.error("Logout error:", e);
      window.location.assign('/');
    } finally {
      // isSigningOut.current se reseteará si la página no se recarga (pero lo hará)
    }
  };

  const refreshProfile = async () => {
    if (user && mountedRef.current && !isSigningOut.current) {
      const p = await loadUserProfile(user);
      setProfile(p);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="w-10 h-10 text-violet-600 animate-spin mb-4" />
        <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Iniciando sesión segura...</span>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
