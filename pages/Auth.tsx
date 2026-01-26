
// Import React to resolve namespace errors for FC and FormEvent
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Loader2, AlertCircle, Heart, RefreshCw, Send, CheckCircle2, ArrowLeft, ShieldCheck, Fingerprint, Key, Sparkles, Check } from 'lucide-react';
import { AuthService } from '../services/AuthService';
import { useAuth } from '../context/AuthContext';

const Auth: React.FC = () => {
  const { is2FAWaiting, set2FAWaiting, signOut, internalUser } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false); 
  const [resendingInNotice, setResendingInNotice] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  
  // Estados para el flujo 2FA
  const [is2FAStep, setIs2FAStep] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  // Estados para Recuperación de Contraseña
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<'email' | 'otp' | 'new_password'>('email');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryOTP, setRecoveryOTP] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  const authService = AuthService.getInstance();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: ''
  });

  // EFECTO CRÍTICO: Si el contexto global dice que estamos esperando 2FA, 
  // activamos la vista de OTP automáticamente (incluso tras redirect de Google)
  useEffect(() => {
    if (is2FAWaiting && !is2FAStep) {
      setIs2FAStep(true);
      setGoogleLoading(false);
      setLoading(false);
    }
  }, [is2FAWaiting, is2FAStep]);

  useEffect(() => {
    const resetLoading = () => {
      setLoading(false);
      setGoogleLoading(false);
    };
    resetLoading();
    window.addEventListener('pageshow', resetLoading);
    return () => window.removeEventListener('pageshow', resetLoading);
  }, []);

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (twoFactorCode.length !== 6) return;
    
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: internalUser?.id, code: twoFactorCode })
      });
      const result = await resp.json();
      if (!result.success) throw new Error(result.error);
      
      // Código correcto: Liberamos el bloqueo en el contexto global
      set2FAWaiting(false);
      
      // Proceder al dashboard
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || "Código incorrecto.");
      setLoading(false);
    }
  };

  const cancel2FALogin = async () => {
    setLoading(true);
    try {
      // Si cancela, cerramos la sesión parcial de Supabase para limpiar todo
      await signOut(); 
      setIs2FAStep(false);
      setTwoFactorCode('');
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authService.requestPasswordRecovery(recoveryEmail);
      setRecoveryStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryOTPVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (recoveryOTP.length === 6) {
      setRecoveryStep('new_password');
    } else {
      setError("Ingresa el código de 6 dígitos.");
    }
  };

  const handleRecoveryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authService.resetPassword(recoveryEmail, recoveryOTP, recoveryNewPassword);
      setIsRecoveryMode(false);
      setRecoveryStep('email');
      setIsLogin(true);
      setFormData(prev => ({ ...prev, email: recoveryEmail }));
      alert("¡Tu contraseña ha sido restablecida! Ya puedes ingresar.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin && !acceptTerms) {
      setError("Debes aceptar los Términos y Condiciones para continuar.");
      return;
    }

    setLoading(true);
    setError(null);

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // En el flujo Email/Password, el onAuthStateChange del contexto se encargará 
        // de detectar el 2FA y activar el modo espera. Solo necesitamos llamar al sign-in.
        await authService.signIn(formData.email, formData.password);
        
        // Si no hay 2FA, el contexto pondrá el usuario y navegaremos vía este efecto o manualmente si falla la navegación automática
      } else {
        await authService.signUp(formData.email, formData.password, formData.fullName);
        setIsRegistered(true);
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let msg = err.message || "Ocurrió un error inesperado.";
      if (msg.includes("already registered")) msg = "Este correo ya está registrado.";
      if (msg.includes("Invalid login credentials")) msg = "Email o contraseña incorrectos.";
      if (msg.includes("Email not confirmed")) msg = "Debes confirmar tu correo electrónico antes de ingresar.";
      
      setError(msg);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      // El redirect se encargará del resto, y el AuthContext atrapará el evento SIGNED_IN
      await authService.signInWithGoogle();
    } catch (err: any) {
      setError(err.message || "No pudimos conectar con Google.");
      setGoogleLoading(false);
    }
  };

  const handleResendFromNotice = async () => {
    setResendingInNotice(true);
    try {
      await authService.resendVerificationEmail(formData.email);
      alert("¡Correo de activación reenviado!");
    } catch (e) {
      alert("Error al reenviar.");
    } finally {
      setResendingInNotice(false);
    }
  };

  if (is2FAStep) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50/30">
        <div className="max-w-md w-full bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-300">
          <div className="mb-8">
            <div className="w-20 h-20 bg-violet-100 text-violet-600 rounded-[28px] flex items-center justify-center mx-auto mb-6">
              <Fingerprint size={40} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">Paso de Seguridad</h1>
            <p className="text-slate-500 font-medium text-sm">Tu cuenta está protegida con verificación adicional. Ingresa el código enviado a <strong className="text-slate-900">{internalUser?.email}</strong>.</p>
          </div>
          {error && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-bold"><AlertCircle size={16} />{error}</div>}
          <form onSubmit={handle2FAVerify} className="space-y-6">
            <input type="text" maxLength={6} autoFocus className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl font-black text-center text-4xl tracking-[15px] outline-none" value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
            <button type="submit" disabled={loading || twoFactorCode.length !== 6} className="w-full py-5 bg-violet-600 text-white rounded-2xl font-black text-lg hover:bg-violet-700 shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={24} /> : 'Verificar y Entrar'}</button>
            <button type="button" onClick={cancel2FALogin} className="text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600">Cancelar inicio de sesión</button>
          </form>
        </div>
      </div>
    );
  }

  if (isRecoveryMode) {
    // ... (sin cambios en recuperación de contraseña)
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50/30">
        <div className="max-w-md w-full bg-white p-8 md:p-12 rounded-[40px] shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
          <div className="text-center mb-10">
             <div className="w-16 h-16 bg-violet-100 text-violet-600 rounded-[24px] flex items-center justify-center mx-auto mb-4 shadow-sm"><Key size={28} /></div>
             <h1 className="text-2xl font-black text-slate-900">Recuperar Acceso</h1>
             <p className="text-slate-500 font-medium text-sm mt-2">
               {recoveryStep === 'email' && 'Ingresa tu email para recibir un código.'}
               {recoveryStep === 'otp' && 'Ingresa el código enviado a tu correo.'}
               {recoveryStep === 'new_password' && 'Crea una contraseña segura para tu cuenta.'}
             </p>
          </div>

          {error && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-3"><AlertCircle size={16} /><p>{error}</p></div>}

          {recoveryStep === 'email' && (
            <form onSubmit={handleRecoveryRequest} className="space-y-6">
               <div className="relative">
                 <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                 <input type="email" required className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl font-bold outline-none" placeholder="tu@email.com" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} />
               </div>
               <button type="submit" disabled={loading} className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black hover:bg-violet-700 transition-all flex items-center justify-center gap-2">
                 {loading ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /> Enviar código</>}
               </button>
            </form>
          )}

          {recoveryStep === 'otp' && (
            <form onSubmit={handleRecoveryOTPVerify} className="space-y-6">
               <input type="text" maxLength={6} required autoFocus className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl font-black text-center text-4xl tracking-[12px] outline-none" value={recoveryOTP} onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
               <button type="submit" className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black hover:bg-violet-700 transition-all">Validar código</button>
               <button type="button" onClick={() => setRecoveryStep('email')} className="w-full text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">Volver a intentar con otro email</button>
            </form>
          )}

          {recoveryStep === 'new_password' && (
            <form onSubmit={handleRecoveryReset} className="space-y-6">
               <div className="relative">
                 <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                 <input type="password" required autoFocus className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl font-bold outline-none" placeholder="Nueva contraseña (mín. 6 car.)" value={recoveryNewPassword} onChange={e => setRecoveryNewPassword(e.target.value)} />
               </div>
               <button type="submit" disabled={loading} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-3">
                 {loading ? <Loader2 className="animate-spin" size={20} /> : <><Check size={18} /> Restablecer Contraseña</>}
               </button>
            </form>
          )}

          <div className="mt-8 pt-8 border-t border-slate-50 text-center">
            <button onClick={() => { setIsRecoveryMode(false); setRecoveryStep('email'); setError(null); }} className="text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-violet-600 transition-colors flex items-center justify-center gap-2 mx-auto">
               <ArrowLeft size={14} /> Volver al ingreso
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isRegistered) {
    // ... (sin cambios en registro exitoso)
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50/30">
        <div className="max-w-md w-full bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-300">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-violet-100 rounded-full blur-2xl opacity-40 scale-150"></div>
            <div className="relative w-24 h-24 bg-violet-600 text-white rounded-[32px] flex items-center justify-center mx-auto shadow-xl">
              <Send size={40} className="animate-bounce duration-[3000ms]" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">¡Revisa tu correo!</h1>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed">Hemos enviado un enlace de activación a:<br/><strong className="text-slate-900">{formData.email}</strong></p>
          <div className="space-y-4">
            <button onClick={() => { setIsLogin(true); setIsRegistered(false); setError(null); }} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2">Ir al inicio de sesión</button>
            <button onClick={handleResendFromNotice} disabled={resendingInNotice} className="w-full py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-violet-600 transition-colors flex items-center justify-center gap-2">{resendingInNotice ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Reenviar código</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50/30">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-600 text-white rounded-[24px] shadow-xl mb-6 transition-transform hover:scale-110 duration-500">
            <Heart size={32} className="fill-current" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{isLogin ? 'Bienvenido a Donia' : 'Únete a la comunidad'}</h1>
          <p className="text-slate-500 font-medium mt-2">{isLogin ? 'Ingresa para gestionar tus campañas.' : 'Crea tu cuenta y comienza a ayudar.'}</p>
        </div>
        <div className="bg-white p-8 md:p-10 rounded-[40px] shadow-2xl border border-slate-100">
          {error && <div className={`mb-6 p-5 rounded-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 bg-rose-50 border border-rose-100 text-rose-700`}><div className="flex items-start gap-3 text-sm font-bold"><AlertCircle size={18} className="shrink-0 mt-0.5" /><p>{error}</p></div></div>}
          <button onClick={handleGoogleSignIn} disabled={googleLoading || loading} className="w-full py-4 px-6 bg-white border-2 border-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-3 mb-6 disabled:opacity-50 group">
            {googleLoading ? <Loader2 className="animate-spin text-violet-600" size={20} /> : <><svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Continuar con Google</>}
          </button>
          <div className="relative mb-8"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div><div className="relative flex justify-center text-xs uppercase font-black tracking-widest text-slate-300"><span className="bg-white px-4">o con tu email</span></div></div>
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (<div><label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nombre Completo</label><div className="relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" required className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl outline-none font-bold text-slate-900" placeholder="Tu nombre" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} /></div></div>)}
            <div><label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email</label><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="email" required className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl outline-none font-bold text-slate-900" placeholder="ejemplo@correo.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div></div>
            <div className="relative">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="password" required className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl outline-none font-bold text-slate-900" placeholder="••••••••" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              {isLogin && (
                <div className="text-right mt-2">
                   <button type="button" onClick={() => setIsRecoveryMode(true)} className="text-[10px] font-black text-violet-600 uppercase tracking-widest hover:underline transition-all">¿Olvidaste tu contraseña?</button>
                </div>
              )}
            </div>
            {!isLogin && (<div className="pt-2"><label className="flex items-start gap-3 cursor-pointer group"><div className="relative mt-0.5"><input type="checkbox" className="peer hidden" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} /><div className="w-5 h-5 border-2 border-slate-200 rounded-lg bg-white peer-checked:bg-violet-600 peer-checked:border-violet-600 transition-all"></div><div className="absolute inset-0 flex items-center justify-center text-white scale-0 peer-checked:scale-100 transition-transform"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg></div></div><span className="text-xs font-medium text-slate-500 leading-tight">Acepto los <Link to="/terminos" target="_blank" className="text-violet-600 font-bold hover:underline">Términos y Condiciones</Link> de Donia.</span></label></div>)}
            <button type="submit" disabled={loading || googleLoading || (!isLogin && !acceptTerms)} className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black text-lg hover:bg-violet-700 shadow-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={24} /> : <>{isLogin ? 'Ingresar' : 'Crear Cuenta'} <ArrowRight className="group-hover:translate-x-1 transition-transform" /></>}
            </button>
          </form>
          <div className="mt-8 pt-8 border-t border-slate-50 text-center"><p className="text-slate-500 font-medium">{isLogin ? '¿No tienes cuenta?' : '¿Ya eres parte de Donia?'}<button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="ml-2 text-violet-600 font-black hover:underline">{isLogin ? 'Regístrate aquí' : 'Inicia sesión'}</button></p></div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
