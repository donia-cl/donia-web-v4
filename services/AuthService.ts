
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Profile } from '../types';

export interface BankAccount {
  id?: string;
  userId: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  holderName: string;
  holderRut: string;
}

export class AuthService {
  private static instance: AuthService;
  private client: SupabaseClient | null = null;
  private initPromise: Promise<void> | null = null;
  private mockSessionUser: any | null = null;

  private constructor() {
    try {
      const saved = localStorage.getItem('donia_mock_user');
      if (saved) this.mockSessionUser = JSON.parse(saved);
    } catch (e) {}
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) AuthService.instance = new AuthService();
    return AuthService.instance;
  }

  /**
   * Obtiene la URL base para redirecciones de Auth (OAuth, Verificación).
   * Devuelve el origen exacto SIN barra diagonal final para asegurar la coincidencia
   * con la lista de "Additional Redirect URLs" de Supabase.
   */
  private getCanonicalUrl(): string {
    const origin = window.location.origin;
    // Eliminamos cualquier slash final para consistencia con la configuración de Supabase
    return origin.replace(/\/$/, '');
  }

  public async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    // LOGGING
    console.info(JSON.stringify({ event: 'AUTH_SERVICE_INITIALIZE_START', timestamp: new Date().toISOString() }));
    this.initPromise = (async () => {
      try {
        let url = '', key = '';
        try {
          const resp = await fetch('/api/config');
          if (resp.ok) {
            const config = await resp.json();
            url = config.supabaseUrl;
            key = config.supabaseKey;
          }
        } catch (e) {
          // LOGGING
          console.error(JSON.stringify({ event: 'AUTH_CONFIG_FETCH_ERROR', timestamp: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) }));
        }
        if (url && key) {
          this.client = createClient(url, key, {
            auth: { 
              persistSession: true, 
              autoRefreshToken: true, 
              detectSessionInUrl: true, 
              flowType: 'pkce', 
              storageKey: 'donia-auth-token-v2' 
            }
          });
          // LOGGING
          console.info(JSON.stringify({ event: 'AUTH_CLIENT_CREATED', timestamp: new Date().toISOString() }));
        }
      } catch (e) {
        this.client = null;
        // LOGGING
        console.error(JSON.stringify({ event: 'AUTH_INITIALIZE_FATAL', timestamp: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) }));
      }
    })();
    return this.initPromise;
  }

  public getSupabase(): SupabaseClient | null { return this.client; }

  public async getSession(): Promise<any | null> {
    await this.initialize();
    if (this.client) {
      // Fix: Cast auth to any to bypass getSession type error on SupabaseAuthClient
      const { data } = await (this.client.auth as any).getSession();
      return data.session;
    }
    return this.mockSessionUser ? { user: this.mockSessionUser, session: { user: this.mockSessionUser } } : null;
  }

  public async signIn(email: string, password: string): Promise<any> {
    await this.initialize();
    // LOGGING
    console.info(JSON.stringify({ event: 'AUTH_SIGNIN_ATTEMPT', timestamp: new Date().toISOString() }));
    if (this.client) {
      try {
        // Fix: Cast auth to any to bypass signInWithPassword type error on SupabaseAuthClient
        const { data, error } = await (this.client.auth as any).signInWithPassword({ email, password });
        if (error) {
          // LOGGING
          console.warn(JSON.stringify({ event: 'AUTH_SIGNIN_ERROR', timestamp: new Date().toISOString(), errorCode: error.status }));
          throw error;
        }
        // LOGGING
        console.info(JSON.stringify({ event: 'AUTH_SIGNIN_SUCCESS', timestamp: new Date().toISOString(), userId: data.user?.id }));
        return data;
      } catch (e) {
        // LOGGING
        console.error(JSON.stringify({ event: 'AUTH_SIGNIN_EXCEPTION', timestamp: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) }));
        throw e;
      }
    }
    throw new Error('Sin conexión');
  }

  public async signUp(email: string, password: string, fullName: string): Promise<any> {
    await this.initialize();
    // LOGGING
    console.info(JSON.stringify({ event: 'AUTH_SIGNUP_ATTEMPT', timestamp: new Date().toISOString() }));
    if (this.client) {
      try {
        // Fix: Cast auth to any to bypass signUp type error on SupabaseAuthClient
        const { data, error } = await (this.client.auth as any).signUp({ email, password, options: { data: { full_name: fullName } } });
        if (error) {
          // LOGGING
          console.warn(JSON.stringify({ event: 'AUTH_SIGNUP_ERROR', timestamp: new Date().toISOString(), errorCode: error.status }));
          throw error;
        }
        // LOGGING
        console.info(JSON.stringify({ event: 'AUTH_SIGNUP_SUCCESS', timestamp: new Date().toISOString(), userId: data.user?.id }));
        return data;
      } catch (e) {
        // LOGGING
        console.error(JSON.stringify({ event: 'AUTH_SIGNUP_EXCEPTION', timestamp: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) }));
        throw e;
      }
    }
    throw new Error('Sin conexión');
  }

  public async signInWithGoogle(): Promise<any> {
    await this.initialize();
    // LOGGING
    console.info(JSON.stringify({ event: 'AUTH_GOOGLE_ATTEMPT', timestamp: new Date().toISOString() }));
    if (this.client) {
      // Usamos el origen limpio (ej: https://staging.donia.cl)
      const redirectTo = this.getCanonicalUrl();
      
      // Fix: Cast auth to any to bypass signInWithOAuth type error on SupabaseAuthClient
      const { data, error } = await (this.client.auth as any).signInWithOAuth({ 
        provider: 'google', 
        options: { 
          queryParams: { access_type: 'offline', prompt: 'consent' }, 
          redirectTo: redirectTo 
        } 
      });
      if (error) {
        // LOGGING
        console.error(JSON.stringify({ event: 'AUTH_GOOGLE_ERROR', timestamp: new Date().toISOString(), error: error.message }));
        throw error;
      }
      return data;
    }
    throw new Error('Google Sign-In no disponible');
  }

  public async signOut(): Promise<void> {
    await this.initialize();
    // LOGGING
    console.info(JSON.stringify({ event: 'AUTH_SIGNOUT_ATTEMPT', timestamp: new Date().toISOString() }));
    if (this.client) {
      // Fix: Cast auth to any to bypass signOut type error on SupabaseAuthClient
      await (this.client.auth as any).signOut({ scope: 'global' });
    }
    this.mockSessionUser = null;
    localStorage.removeItem('donia_mock_user');
    localStorage.removeItem('donia-auth-token-v2');
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    // LOGGING
    console.info(JSON.stringify({ event: 'AUTH_SIGNOUT_COMPLETE', timestamp: new Date().toISOString() }));
  }

  public async requestPasswordRecovery(email: string): Promise<void> {
    // LOGGING
    console.info(JSON.stringify({ event: 'AUTH_RECOVERY_REQUEST', timestamp: new Date().toISOString() }));
    const resp = await fetch('/api/recover-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request', email })
    });
    const json = await resp.json();
    if (!resp.ok) {
      // LOGGING
      console.warn(JSON.stringify({ event: 'AUTH_RECOVERY_ERROR', timestamp: new Date().toISOString(), error: json.error }));
      throw new Error(json.error || "Error solicitando recuperación");
    }
  }

  public async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    // LOGGING
    console.info(JSON.stringify({ event: 'AUTH_PASSWORD_RESET_START', timestamp: new Date().toISOString() }));
    const resp = await fetch('/api/recover-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', email, code, newPassword })
    });
    const json = await resp.json();
    if (!resp.ok) {
      // LOGGING
      console.error(JSON.stringify({ event: 'AUTH_PASSWORD_RESET_FAIL', timestamp: new Date().toISOString(), error: json.error }));
      throw new Error(json.error || "No se pudo restablecer la contraseña");
    }
    // LOGGING
    console.info(JSON.stringify({ event: 'AUTH_PASSWORD_RESET_SUCCESS', timestamp: new Date().toISOString() }));
  }

  public async requestPasswordOTP(userId: string): Promise<void> {
    // LOGGING
    console.info(JSON.stringify({ event: 'AUTH_OTP_REQUEST', timestamp: new Date().toISOString(), userId, type: 'password' }));
    const resp = await fetch('/api/password-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request', userId })
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || "Error solicitando código");
  }

  public async verifyAndChangePassword(userId: string, code: string, newPassword: string): Promise<void> {
    // LOGGING
    console.info(JSON.stringify({ event: 'AUTH_PASSWORD_CHANGE_ATTEMPT', timestamp: new Date().toISOString(), userId }));
    const resp = await fetch('/api/password-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', userId, code, newPassword })
    });
    const json = await resp.json();
    if (!resp.ok) {
      // LOGGING
      console.warn(JSON.stringify({ event: 'AUTH_PASSWORD_CHANGE_FAIL', timestamp: new Date().toISOString(), userId, error: json.error }));
      throw new Error(json.error || "Código inválido");
    }
    // LOGGING
    console.info(JSON.stringify({ event: 'AUTH_PASSWORD_CHANGE_SUCCESS', timestamp: new Date().toISOString(), userId }));
  }

  public async requestSecurityOTP(userId: string, type: 'bank_account_update' | 'phone_update' | '2fa_toggle' | 'login_2fa' | 'withdrawal_request' | 'cancel_campaign'): Promise<void> {
    // LOGGING
    console.info(JSON.stringify({ event: 'AUTH_SECURITY_OTP_REQUEST', timestamp: new Date().toISOString(), userId, type }));
    const resp = await fetch('/api/security-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, type })
    });
    const json = await resp.json();
    if (!resp.ok) {
      // LOGGING
      console.error(JSON.stringify({ event: 'AUTH_SECURITY_OTP_ERROR', timestamp: new Date().toISOString(), userId, type, error: json.error }));
      throw new Error(json.error || "Error solicitando código");
    }
  }

  public async fetchProfile(userId: string): Promise<Profile | null> {
    await this.initialize();
    if (!this.client) return null;
    const resp = await fetch(`/api/get-profile?userId=${userId}`);
    if (!resp.ok) return null;
    const json = await resp.json();
    return json.data as Profile;
  }

  public async updateProfile(userId: string, updates: Partial<Profile>, otpCode?: string): Promise<Profile> {
    await this.initialize();
    // LOGGING
    console.info(JSON.stringify({ event: 'PROFILE_UPDATE_START', timestamp: new Date().toISOString(), userId, hasOtp: !!otpCode }));
    const resp = await fetch('/api/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, updates, otpCode })
    });
    const json = await resp.json();
    if (!resp.ok) {
      // LOGGING
      console.error(JSON.stringify({ event: 'PROFILE_UPDATE_FAIL', timestamp: new Date().toISOString(), userId, error: json.error }));
      throw new Error(json.error || "Error");
    }
    // LOGGING
    console.info(JSON.stringify({ event: 'PROFILE_UPDATE_SUCCESS', timestamp: new Date().toISOString(), userId }));
    return json.data as Profile;
  }

  public async resendVerificationEmail(email: string): Promise<void> {
    // LOGGING
    console.info(JSON.stringify({ event: 'AUTH_RESEND_VERIFICATION', timestamp: new Date().toISOString() }));
    await fetch('/api/resend-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  }

  public async getBankAccount(userId: string): Promise<BankAccount | null> {
    const resp = await fetch(`/api/bank-account?userId=${userId}`);
    if (!resp.ok) return null;
    const json = await resp.json();
    if (!json.data) return null;
    const b = json.data;
    return { id: b.id, userId: b.user_id, bankName: b.bank_name, accountType: b.account_type, accountNumber: b.account_number, holderName: b.holder_name, holderRut: b.holder_rut };
  }

  public async updateBankAccount(userId: string, accountData: Partial<BankAccount>, otpCode: string): Promise<BankAccount> {
    // LOGGING
    console.info(JSON.stringify({ event: 'BANK_ACCOUNT_UPDATE_START', timestamp: new Date().toISOString(), userId }));
    const resp = await fetch('/api/bank-account', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ userId, ...accountData, otpCode }) 
    });
    const json = await resp.json();
    if (!resp.ok) {
      // LOGGING
      console.error(JSON.stringify({ event: 'BANK_ACCOUNT_UPDATE_FAIL', timestamp: new Date().toISOString(), userId, error: json.error }));
      throw new Error(json.error);
    }
    const b = json.data;
    // LOGGING
    console.info(JSON.stringify({ event: 'BANK_ACCOUNT_UPDATE_SUCCESS', timestamp: new Date().toISOString(), userId }));
    return { id: b.id, userId: b.user_id, bankName: b.bank_name, accountType: b.account_type, accountNumber: b.account_number, holderName: b.holder_name, holderRut: b.holder_rut };
  }
}
