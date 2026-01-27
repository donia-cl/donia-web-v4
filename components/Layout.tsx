import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Heart, Database, Cpu, Activity, User, LogOut, ChevronDown, LayoutDashboard, Menu, X, ShieldCheck, MailWarning, RefreshCw, Check } from 'lucide-react';
import { CampaignService } from '../services/CampaignService';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/AuthService';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, is2FAWaiting, signOut } = useAuth();
  const isWizard = location.pathname.startsWith('/crear');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  
  const service = CampaignService.getInstance();
  const [dbStatus, setDbStatus] = useState<'cloud' | 'local'>('local');
  const [aiActive, setAiActive] = useState(false);

  useEffect(() => {
    const updateServiceStatus = async () => {
      await service.initialize();
      setDbStatus(service.getConnectionStatus());
      setAiActive(service.checkAiAvailability());
    };
    updateServiceStatus();
  }, [service]);

  const handleLogout = async () => {
    await signOut();
    setShowUserMenu(false);
    setIsMobileMenuOpen(false);
    navigate('/');
  };

  const handleResendEmail = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      await AuthService.getInstance().resendVerificationEmail(user.email);
      setResendSent(true);
      setTimeout(() => setResendSent(false), 5000);
    } catch (e) {
      alert("Error al reenviar. Intenta más tarde.");
    } finally {
      setResending(false);
    }
  };

  const NavLinks = () => (
    <>
      <Link to="/explorar" onClick={() => setIsMobileMenuOpen(false)} className={`font-bold transition-colors ${location.pathname === '/explorar' ? 'text-violet-600' : 'text-slate-600 hover:text-violet-600'}`}>Explorar</Link>
      <Link to="/acerca" onClick={() => setIsMobileMenuOpen(false)} className={`font-bold transition-colors ${location.pathname === '/acerca' ? 'text-violet-600' : 'text-slate-600 hover:text-violet-600'}`}>Cómo funciona</Link>
    </>
  );

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Mi Perfil';
  const displayInitial = displayName.charAt(0).toUpperCase();

  // Mostrar banner si el usuario está logueado pero no verificado y no es de Google
  const isGoogle = user?.app_metadata?.provider === 'google' || user?.app_metadata?.providers?.includes('google');
  const showVerifyBanner = user && !profile?.email_verified && !isGoogle;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {showVerifyBanner && (
        <div className="bg-amber-500 text-white py-2.5 px-4 animate-in slide-in-from-top duration-500">
           <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
              <div className="flex items-center gap-2">
                <MailWarning size={16} />
                <span className="text-xs font-black uppercase tracking-widest">Cuenta no verificada</span>
              </div>
              <p className="text-[11px] font-bold opacity-90">
                Para publicar campañas y recibir fondos debes validar tu correo electrónico.
              </p>
              <button 
                onClick={handleResendEmail}
                disabled={resending || resendSent}
                className="bg-white/20 hover:bg-white/30 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/20"
              >
                {resending ? <RefreshCw size={12} className="animate-spin" /> : resendSent ? <Check size={12} /> : <RefreshCw size={12} />}
                {resendSent ? 'Correo enviado' : 'Reenviar activación'}
              </button>
           </div>
        </div>
      )}

      <header className="border-b border-slate-100 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-violet-600 p-2 rounded-2xl group-hover:bg-violet-700 transition-colors shadow-sm">
                <Heart size={24} className="text-white fill-current" />
              </div>
              <span className="text-2xl font-black text-slate-900 tracking-tighter">
                Donia
              </span>
            </Link>
            
            {!isWizard && (
              <>
                <nav className="hidden md:flex items-center space-x-8">
                  <NavLinks />
                  <div className="h-6 w-px bg-slate-100 mx-2"></div>
                  
                  {is2FAWaiting ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-600 rounded-2xl border border-violet-100 animate-pulse">
                      <ShieldCheck size={16} />
                      <span className="text-xs font-black uppercase tracking-widest">Seguridad</span>
                    </div>
                  ) : user ? (
                    <div className="relative">
                      <button 
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-2 px-3 py-2 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                      >
                        <div className="w-8 h-8 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center font-black text-xs">
                          {displayInitial}
                        </div>
                        <span className="text-sm font-black text-slate-700 max-w-[120px] truncate">
                          {displayName}
                        </span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                      </button>

                      {showUserMenu && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)}></div>
                          <div className="absolute right-0 mt-3 w-56 bg-white rounded-[24px] shadow-2xl border border-slate-100 py-3 z-20 animate-in fade-in zoom-in-95 duration-100">
                            <Link 
                              to="/dashboard" 
                              onClick={() => setShowUserMenu(false)}
                              className="flex items-center gap-3 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-violet-50 hover:text-violet-600 transition-colors"
                            >
                              <LayoutDashboard size={18} /> Mi Panel
                            </Link>
                            <div className="h-px bg-slate-50 my-2"></div>
                            <button 
                              onClick={handleLogout}
                              className="w-full flex items-center gap-3 px-5 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <LogOut size={18} /> Cerrar sesión
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <Link to="/login" className="text-slate-600 font-black hover:text-violet-600 transition-colors text-sm">
                      Ingresar
                    </Link>
                  )}
                  
                  <Link to="/crear" className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-100 text-sm">
                    Crear campaña
                  </Link>
                </nav>

                <button 
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                </button>
              </>
            )}

            {isWizard && (
              <Link to="/" className="text-slate-400 hover:text-rose-600 text-xs font-black uppercase tracking-widest transition-colors">
                Salir del editor
              </Link>
            )}
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-20 bg-white z-[60] p-6 animate-in slide-in-from-top-4 duration-300">
            <nav className="flex flex-col space-y-6">
              <Link to="/explorar" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-black text-slate-900 py-2 border-b border-slate-50">Explorar causas</Link>
              <Link to="/acerca" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-black text-slate-900 py-2 border-b border-slate-50">Cómo funciona</Link>
              
              {is2FAWaiting ? (
                <div className="text-2xl font-black text-violet-600 py-2 border-b border-slate-50 flex items-center gap-2">
                  <ShieldCheck /> Verificando...
                </div>
              ) : user ? (
                <>
                  <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-black text-violet-600 py-2 border-b border-slate-50">Mi Panel</Link>
                  <button onClick={handleLogout} className="text-2xl font-black text-rose-600 py-2 text-left border-b border-slate-50">Cerrar Sesión</button>
                </>
              ) : (
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-black text-slate-900 py-2 border-b border-slate-50">Ingresar</Link>
              )}
              
              <Link to="/crear" onClick={() => setIsMobileMenuOpen(false)} className="w-full bg-violet-600 text-white py-5 rounded-[24px] font-black text-xl text-center shadow-2xl shadow-violet-100">
                Crear campaña
              </Link>
            </nav>
          </div>
        )}
      </header>
      
      <main className="flex-grow">
        {children}
      </main>

      <footer className="bg-slate-50 border-t border-slate-100 py-16 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="text-center md:text-left">
              <div className="flex justify-center md:justify-start items-center gap-2 mb-4">
                <Heart size={24} className="text-violet-600" />
                <span className="text-xl font-black text-slate-800 flex items-center gap-1.5">
                  Donia <span>🇨🇱</span>
                </span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto md:mx-0 font-medium">
                La plataforma de crowdfunding solidario líder en Chile. Conectando corazones a través de la transparencia.
              </p>
            </div>

            <div className="text-center md:text-left">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Plataforma</h4>
              <ul className="space-y-4">
                <li><Link to="/explorar" className="text-slate-600 font-bold hover:text-violet-600 transition-colors">Explorar causas</Link></li>
                <li><Link to="/crear" className="text-slate-600 font-bold hover:text-violet-600 transition-colors">Crear campaña</Link></li>
                <li><Link to="/acerca" className="text-slate-600 font-bold hover:text-violet-600 transition-colors">Cómo funciona</Link></li>
              </ul>
            </div>

            <div className="text-center md:text-left">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Ayuda</h4>
              <ul className="space-y-4">
                <li><Link to="/ayuda" className="text-slate-600 font-bold hover:text-violet-600 transition-colors">Preguntas Frecuentes</Link></li>
                <li><Link to="/soporte" className="text-slate-600 font-bold hover:text-violet-600 transition-colors">Soporte y Contacto</Link></li>
              </ul>
            </div>

            <div className="text-center md:text-left">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Legal</h4>
              <ul className="space-y-4">
                <li><Link to="/terminos" className="text-slate-600 font-bold hover:text-violet-600 transition-colors">Términos y Condiciones</Link></li>
                <li><Link to="/privacidad" className="text-slate-600 font-bold hover:text-violet-600 transition-colors">Política de Privacidad</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-12 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-8">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest italic">© 2026 Donia SpA. Santiago, Chile.</p>

            <div className="flex flex-col items-center md:items-end gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Activity size={10} /> Estado del Sistema
              </span>
              <div className="flex flex-wrap justify-center md:justify-end gap-3">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[11px] font-bold border transition-all ${
                  dbStatus === 'cloud' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-100' 
                  : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                  <Database size={14} className={dbStatus === 'cloud' ? 'animate-pulse' : ''} />
                  Back-end Services
                </div>

                <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[11px] font-bold border transition-all ${
                  aiActive 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-100' 
                  : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                  <Cpu size={14} />
                  AI Services
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};