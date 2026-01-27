
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
        } catch (e) {}
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
        }
      } catch (e) {
        this.client = null;
      }
    })();
    return this.initPromise;
  }

  public getSupabase(): SupabaseClient | null { return this.client; }

  public async getSession(): Promise<any | null> {
    await this.initialize();
    if (this.client) {
      const { data } = await this.client.auth.getSession();
      return data.session;
    }
    return this.mockSessionUser ? { user: this.mockSessionUser, session: { user: this.mockSessionUser } } : null;
  }

  public async signIn(email: string, password: string): Promise<any> {
    await this.initialize();
    if (this.client) {
      const { data, error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    }
    throw new Error('Sin conexión');
  }

  public async signUp(email: string, password: string, fullName: string): Promise<any> {
    await this.initialize();
    if (this.client) {
      const { data, error } = await this.client.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
      if (error) throw error;
      return data;
    }
    throw new Error('Sin conexión');
  }

  public async signInWithGoogle(): Promise<any> {
    await this.initialize();
    if (this.client) {
      // Usamos el origen limpio (ej: https://staging.donia.cl)
      const redirectTo = this.getCanonicalUrl();
      
      const { data, error } = await this.client.auth.signInWithOAuth({ 
        provider: 'google', 
        options: { 
          queryParams: { access_type: 'offline', prompt: 'consent' }, 
          redirectTo: redirectTo 
        } 
      });
      if (error) throw error;
      return data;
    }
    throw new Error('Google Sign-In no disponible');
  }

  public async signOut(): Promise<void> {
    await this.initialize();
    if (this.client) {
      await this.client.auth.signOut({ scope: 'global' });
    }
    this.mockSessionUser = null;
    localStorage.removeItem('donia_mock_user');
    localStorage.removeItem('donia-auth-token-v2');
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
  }

  public async requestPasswordRecovery(email: string): Promise<void> {
    const resp = await fetch('/api/recover-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request', email })
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || "Error solicitando recuperación");
  }

  public async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const resp = await fetch('/api/recover-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', email, code, newPassword })
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || "No se pudo restablecer la contraseña");
  }

  public async requestPasswordOTP(userId: string): Promise<void> {
    const resp = await fetch('/api/password-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request', userId })
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || "Error solicitando código");
  }

  public async verifyAndChangePassword(userId: string, code: string, newPassword: string): Promise<void> {
    const resp = await fetch('/api/password-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', userId, code, newPassword })
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || "Código inválido");
  }

  public async requestSecurityOTP(userId: string, type: 'bank_account_update' | 'phone_update' | '2fa_toggle' | 'login_2fa' | 'withdrawal_request' | 'cancel_campaign'): Promise<void> {
    const resp = await fetch('/api/security-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, type })
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || "Error solicitando código");
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
    const resp = await fetch('/api/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, updates, otpCode })
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || "Error");
    return json.data as Profile;
  }

  public async resendVerificationEmail(email: string): Promise<void> {
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
    const resp = await fetch('/api/bank-account', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ userId, ...accountData, otpCode }) 
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error);
    const b = json.data;
    return { id: b.id, userId: b.user_id, bankName: b.bank_name, accountType: b.account_type, accountNumber: b.account_number, holderName: b.holder_name, holderRut: b.holder_rut };
  }
}
