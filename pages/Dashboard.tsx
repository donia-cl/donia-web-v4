import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  Heart, Trash2, Edit3, Plus, Loader2, BarChart3, CheckCircle2, Wallet, History, ShieldCheck, 
  User as UserIcon, Users, Copy, Eye, Banknote, ArrowDownToLine, Mail, Check, Info, Lock, 
  ArrowRight, HeartHandshake, Save, X, Timer, MapPin, Building, TrendingUp, Shield, Printer,
  ChevronRight, Calendar, Send, FileText, Landmark, AlertCircle, Key, Fingerprint,
  ShieldAlert, LogOut, ShieldQuestion, Phone, Download, AlertTriangle, XCircle,
  Pause, Play, RefreshCw, Undo2, MailWarning, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthService, BankAccount } from '../services/AuthService';
import { CampaignService } from '../services/CampaignService';
import { CampaignData, FinancialSummary, Withdrawal, Donation, Profile } from '../types';
import { formatRut, validateRut, formatPhone, validateChileanPhone } from '../utils/validation';

const LOCATION_DATA = {
  "regions": [
    { "name": "Arica y Parinacota", "slug": "arica-parinacota", "cities": ["Arica"] },
    { "name": "Tarapacá", "slug": "tarapaca", "cities": ["Iquique", "Alto Hospicio"] },
    { "name": "Antofagasta", "slug": "antofagasta", "cities": ["Antofagasta", "Calama"] },
    { "name": "Atacama", "slug": "atacama", "cities": ["Copiapó", "Vallenar"] },
    { "name": "Coquimbo", "slug": "coquimbo", "cities": ["La Serena", "Coquimbo", "Ovalle"] },
    { "name": "Valparaíso", "slug": "valparaiso", "cities": ["Valparaíso", "Viña del Mar", "San Antonio"] },
    { "name": "Región Metropolitana de Santiago", "slug": "metropolitana", "cities": ["Santiago"] },
    { "name": "Libertador General Bernardo O’Higgins", "slug": "ohiggins", "cities": ["Rancagua", "San Fernando"] },
    { "name": "Maule", "slug": "maule", "cities": ["Talca", "Curicó"] },
    { "name": "Ñuble", "slug": "nuble", "cities": ["Chillán"] },
    { "name": "Biobío", "slug": "biobio", "cities": ["Concepción", "Los Ángeles"] },
    { "name": "La Araucanía", "slug": "araucania", "cities": ["Temuco", "Villarrica"] },
    { "name": "Los Ríos", "slug": "los-rios", "cities": ["Valdivia"] },
    { "name": "Los Lagos", "slug": "los-lagos", "cities": ["Puerto Montt", "Osorno", "Castro"] },
    { "name": "Aysén del General Carlos Ibáñez del Campo", "slug": "aysen", "cities": ["Coyhaique"] },
    { "name": "Magallanes y de la Antártica Chilena", "slug": "magallanes", "cities": ["Punta Arenas"] }
  ]
};

const CHILEAN_BANKS = ["Banco de Chile", "Banco Internacional", "Scotiabank Chile", "Banco de Crédito e Inversiones (BCI)", "Banco BICE", "HSBC Bank Chile", "Banco Santander Chile", "Banco Itaú Chile", "Banco Security", "Banco Falabella", "Banco Ripley", "Banco Consorcio", "BancoEstado", "Mercado Pago", "Tenpo", "Mach", "Chek (BCI)"];
const ACCOUNT_TYPES = ["Cuenta Corriente", "Cuenta Vista / RUT", "Cuenta de Ahorro"];

type TabType = 'resumen' | 'donaciones' | 'finanzas' | 'seguridad' | 'perfil';

const ActionConfirmModal = ({ 
  title, 
  desc, 
  onConfirm, 
  onCancel, 
  confirmText = "Confirmar", 
  variant = "violet",
  loading = false 
}: { 
  title: string, 
  desc: string, 
  onConfirm: () => void, 
  onCancel: () => void, 
  confirmText?: string,
  variant?: 'violet' | 'rose' | 'amber',
  loading?: boolean
}) => {
  const colors = {
    violet: "bg-violet-600 hover:bg-violet-700 shadow-violet-200",
    rose: "bg-rose-600 hover:bg-rose-700 shadow-rose-200",
    amber: "bg-amber-500 hover:bg-amber-600 shadow-amber-200"
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
        <div className="p-8 text-center">
          <h3 className="text-2xl font-black text-slate-900 mb-2">{title}</h3>
          <p className="text-slate-500 font-medium text-sm leading-relaxed mb-8">{desc}</p>
          <div className="space-y-3">
            <button 
              onClick={onConfirm} 
              disabled={loading} 
              className={`w-full py-4 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 ${colors[variant]}`}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : confirmText}
            </button>
            <button 
              onClick={onCancel} 
              disabled={loading} 
              className="w-full py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const RefundDetailsModal = ({ campaign, onClose }: { campaign: CampaignData, onClose: () => void }) => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const service = CampaignService.getInstance();

  useEffect(() => {
    const loadDonations = async () => {
      try {
        const result = await service.getCampaignById(campaign.id);
        if (result?.donations) {
          setDonations(result.donations);
        }
      } catch (e) {
        console.error("Error cargando donaciones para devolución:", e);
      } finally {
        setLoading(false);
      }
    };
    loadDonations();
  }, [campaign.id]);

  const getRefundStatusLabel = (status?: string) => {
    if (status === 'refunded') return { label: 'Realizada', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: CheckCircle2 };
    return { label: 'En proceso', color: 'text-amber-600 bg-amber-50 border-amber-100', icon: Timer };
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shadow-sm">
              <Undo2 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Estado de Devoluciones</h3>
              <p className="text-slate-500 font-medium text-xs line-clamp-1">{campaign.titulo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><X size={24} /></button>
        </div>

        <div className="flex-grow overflow-y-auto p-8 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="animate-spin text-violet-600" size={32} />
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Obteniendo listado de aportes...</p>
            </div>
          ) : donations.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-12 px-4 mb-2">
                <div className="col-span-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Donante / Fecha</div>
                <div className="col-span-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto</div>
                <div className="col-span-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</div>
              </div>
              {donations.map((don) => {
                const refundInfo = getRefundStatusLabel(don.status);
                return (
                  <div key={don.id} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 grid grid-cols-12 items-center hover:bg-white hover:border-violet-100 transition-all">
                    <div className="col-span-6">
                      <p className="font-bold text-slate-900 text-sm truncate">{don.nombreDonante || 'Anónimo'}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{new Date(don.fecha).toLocaleDateString('es-CL')}</p>
                    </div>
                    <div className="col-span-3 text-center">
                      <p className="font-black text-slate-900 text-sm">${don.amountTotal.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${refundInfo.color}`}>
                        <refundInfo.icon size={10} />
                        {refundInfo.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <Info size={40} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-400 font-bold">Esta campaña no registró donaciones.</p>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-slate-100 bg-white shrink-0">
          <p className="text-[11px] text-slate-400 font-medium text-center mb-6 px-4 leading-relaxed">
            Las devoluciones se procesan automáticamente hacia el medio de pago original. Los tiempos dependen de la institución bancaria del donante (entre 5 a 15 días hábiles).
          </p>
          <button 
            onClick={onClose}
            className="w-full py-4 bg-slate-900 text-white rounded-[20px] font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

const NotificationModal = ({ 
  title, 
  desc, 
  type = "success", 
  onClose 
}: { 
  title: string, 
  desc: string, 
  type?: 'success' | 'error' | 'info', 
  onClose: () => void 
}) => {
  const icons = {
    success: <CheckCircle2 size={32} className="text-emerald-600" />,
    error: <XCircle size={32} className="text-rose-600" />,
    info: <Info size={32} className="text-violet-600" />
  };
  const bgColors = {
    success: "bg-emerald-100",
    error: "bg-rose-100",
    info: "bg-violet-100"
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
        <div className="p-8 text-center">
          <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center mx-auto mb-6 ${bgColors[type]}`}>
            {icons[type]}
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">{title}</h3>
          <p className="text-slate-500 font-medium text-sm leading-relaxed mb-8">{desc}</p>
          <button 
            onClick={onClose} 
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 shadow-xl transition-all active:scale-95"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

const PasswordModal = ({ userId, onClose }: { userId: string, onClose: () => void }) => {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authService = AuthService.getInstance();

  const handleRequest = async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.requestPasswordOTP(userId);
      setStep('verify');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authService.verifyAndChangePassword(userId, code, newPassword);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900"><X size={20} /></button>
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-violet-100 text-violet-600 rounded-[24px] flex items-center justify-center mx-auto mb-4"><Lock size={28} /></div>
            <h3 className="text-2xl font-black text-slate-900">Cambiar Contraseña</h3>
          </div>
          {error && <div className="mb-6 p-4 bg-rose-50 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-3"><AlertCircle size={16} />{error}</div>}
          
          {step === 'request' ? (
            <div className="space-y-6">
              <p className="text-slate-500 text-center font-medium">Enviaremos un código de seguridad a tu correo para autorizar el cambio.</p>
              <button onClick={handleRequest} disabled={loading} className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black">{loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Enviar Código'}</button>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-6">
              <input type="text" placeholder="Código de 6 dígitos" maxLength={6} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl font-black text-center text-2xl tracking-[10px]" value={code} onChange={e => setCode(e.target.value)} required />
              <input type="password" placeholder="Nueva contraseña (mín. 6 car.)" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl font-bold" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
              <button type="submit" disabled={loading} className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black">{loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Actualizar Contraseña'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const ReceiptModal = ({ donation, profileName, onClose }: { donation: Donation, profileName?: string, onClose: () => void }) => {
  const formattedDate = new Date(donation.fecha).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto py-10">
      <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
        <div className="p-6 md:p-8">
          {/* Logo Area */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 bg-violet-600 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-violet-100">
              <Heart size={24} className="fill-current" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-1">Comprobante de Donación</h3>
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">Donia Chile SpA • Santiago</p>
          </div>

          {/* Operation Info Box */}
          <div className="bg-slate-50/80 rounded-[24px] p-5 mb-6 border border-slate-100">
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.12em]">ID OPERACIÓN</span>
                <span className="text-xs font-black text-slate-900">{donation.paymentId || donation.id.substring(0, 12)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.12em]">FECHA</span>
                <span className="text-xs font-black text-slate-900 uppercase">{formattedDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.12em]">DONANTE</span>
                <span className="text-xs font-black text-slate-900">{donation.nombreDonante || profileName || 'Anónimo'}</span>
              </div>
            </div>
          </div>

          {/* Destined to Section */}
          <div className="px-1 mb-6">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.12em] mb-2">DESTINADO A LA CAUSA</p>
            <h4 className="text-xl font-black text-slate-900 mb-0.5 line-clamp-2">{donation.campaign?.titulo || 'Campaña'}</h4>
            <p className="text-xs text-slate-500 font-bold">Beneficiario: <span className="text-slate-700">{donation.campaign?.beneficiarioNombre || 'Donia'}</span></p>
          </div>

          {/* Financial Breakdown */}
          <div className="px-1 space-y-2.5 mb-6 pt-5 border-t border-slate-100 border-dashed">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-600">Donación neta</span>
              <span className="text-base font-black text-slate-900">${(donation.amountCause || 0).toLocaleString('es-CL')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-600">Apoyo Donia (Propina)</span>
              <span className="text-base font-black text-slate-900">${(donation.amountTip || 0).toLocaleString('es-CL')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-600">Costos operacionales</span>
              <span className="text-base font-black text-slate-900">${(donation.amountFee || 0).toLocaleString('es-CL')}</span>
            </div>
            <div className="pt-3 border-t-2 border-slate-900 flex justify-between items-center">
              <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest tracking-[0.15em]">TOTAL PAGADO</span>
              <span className="text-3xl font-black text-slate-900 tracking-tighter">${(donation.amountTotal || 0).toLocaleString('es-CL')}</span>
            </div>
          </div>

          {/* Legal Footer Box */}
          <div className="bg-slate-50 rounded-[16px] p-4 mb-8 text-center border border-slate-100/50">
            <p className="text-[9px] text-slate-400 font-bold leading-relaxed uppercase">
              ESTE DOCUMENTO ES UN COMPROBANTE INFORMATIVO Y NO CONSTITUYE UNA BOLETA O FACTURA ELECTRÓNICA PARA FINES TRIBUTARIOS EN CHILE. EL APORTE REALIZADO CORRESPONDE A UNA DONACIÓN VOLUNTARIA PROCESADA A TRAVÉS DE DONIA SPA.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 no-print">
            <button 
              onClick={() => window.print()} 
              className="flex-1 py-4 bg-slate-100 text-slate-900 rounded-[20px] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-all active:scale-95"
            >
              <Download size={16} /> Descargar
            </button>
            <button 
              onClick={onClose} 
              className="flex-1 py-4 bg-slate-900 text-white rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
      
      {/* Estilos para impresión del comprobante */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          .fixed { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; background: white !important; padding: 0 !important; }
          .bg-slate-900\\/60 { background: white !important; backdrop-filter: none !important; }
          .shadow-2xl { shadow: none !important; }
          .animate-in { animation: none !important; }
          .fixed.inset-0.z-\\[150\\].flex.items-center.justify-center { 
            visibility: visible; 
            position: absolute !important;
            display: block !important;
          }
          .fixed.inset-0.z-\\[150\\] * { visibility: visible; }
          .rounded-\\[40px\\] { border-radius: 0 !important; border: none !important; }
          .max-w-md { max-width: 100% !important; }
          .p-6, .p-8 { padding: 20px !important; }
        }
      `}</style>
    </div>
  );
};

const CancelCampaignModal = ({ 
  campaign, 
  onClose, 
  onConfirm, 
  loading 
}: { 
  campaign: CampaignData, 
  onClose: () => void, 
  onConfirm: () => void, 
  loading: boolean 
}) => {
  const [activeCheck, setActiveCheck] = useState(false);
  const hasDonations = campaign.recaudado > 0;
  
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-[24px] flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">¿Cancelar campaña?</h3>
          <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6">
            Esta acción es irreversible. La campaña dejará de recibir donaciones inmediatamente.
          </p>

          {hasDonations && (
            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 mb-6 text-left">
              <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Aviso Importante</p>
              <p className="text-[11px] text-rose-700 font-bold leading-tight">
                Esta campaña ya tiene aportes. La cancelación podría requerir revisiones adicionales por parte de Donia.
              </p>
            </div>
          )}

          {hasDonations && (
            <label className="flex items-start gap-3 cursor-pointer group text-left mb-8">
              <div className="relative mt-0.5">
                <input 
                  type="checkbox" 
                  className="peer hidden" 
                  checked={activeCheck} 
                  onChange={e => setActiveCheck(e.target.checked)} 
                />
                <div className="w-5 h-5 border-2 border-slate-200 rounded-lg bg-white peer-checked:bg-rose-600 peer-checked:border-rose-600 transition-all"></div>
                <div className="absolute inset-0 flex items-center justify-center text-white scale-0 peer-checked:scale-100 transition-transform">
                  <Check size={12} strokeWidth={4} />
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 transition-colors">
                Entiendo que esta acción es irreversible y permanente.
              </span>
            </label>
          )}

          <div className="space-y-3">
            <button 
              onClick={onConfirm} 
              disabled={loading || (hasDonations && !activeCheck)} 
              className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-rose-700 shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar Cancelación'}
            </button>
            <button 
              onClick={onClose} 
              disabled={loading} 
              className="w-full py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600"
            >
              No, volver atrás
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const BankAlertModal = ({ onClose, onConfirm }: { onClose: () => void, onConfirm: () => void }) => (
  <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-[24px] flex items-center justify-center mx-auto mb-6">
          <Landmark size={32} />
        </div>
        <h3 className="text-2xl font-black text-slate-900 mb-2">Faltan datos bancarios</h3>
        <p className="text-slate-500 font-medium text-sm leading-relaxed mb-8">
          Para solicitar un retiro, primero debes configurar la cuenta donde recibiremos el dinero recaudado.
        </p>
        <div className="space-y-3">
          <button 
            onClick={onConfirm} 
            className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-violet-700 shadow-xl transition-all active:scale-95"
          >
            Configurar ahora
          </button>
          <button 
            onClick={onClose} 
            className="w-full py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600"
          >
            Quizás más tarde
          </button>
        </div>
      </div>
    </div>
  </div>
);

const WithdrawalConfirmModal = ({ 
  onClose, 
  onConfirm, 
  amount, 
  loading 
}: { 
  onClose: () => void, 
  onConfirm: () => void, 
  amount: number, 
  loading: boolean 
}) => (
  <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-violet-100 text-violet-600 rounded-[24px] flex items-center justify-center mx-auto mb-6">
          <Banknote size={32} />
        </div>
        <h3 className="text-2xl font-black text-slate-900 mb-2">¿Confirmar solicitud?</h3>
        <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6">
          Estás a punto de solicitar el retiro de los fondos recaudados por un monto de:
        </p>
        
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8">
          <p className="text-3xl font-black text-emerald-600 tracking-tight">${amount.toLocaleString('es-CL')}</p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Saldo Neto a Transferir</p>
        </div>

        <div className="space-y-3">
          <button 
            onClick={onConfirm} 
            disabled={loading} 
            className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-violet-700 shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <><Check size={18} /> Solicitar Retiro</>}
          </button>
          <button 
            onClick={onClose} 
            disabled={loading} 
            className="w-full py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  </div>
);

const WithdrawalSuccessModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-[160] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-[24px] flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={32} />
        </div>
        <h3 className="text-2xl font-black text-slate-900 mb-2">¡Solicitud Enviada!</h3>
        <p className="text-slate-500 font-medium text-sm leading-relaxed mb-8">
          Hemos recibido tu solicitud de retiro. Nuestro equipo de finanzas procesará la transferencia en un plazo de 48 a 72 horas hábiles.
        </p>
        <button 
          onClick={onClose} 
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 shadow-xl transition-all active:scale-95"
        >
          Entendido
        </button>
      </div>
    </div>
  </div>
);

const GenericOTPModal = ({ 
  type, 
  userId, 
  onClose, 
  onVerified 
}: { 
  type: 'bank_account_update' | 'phone_update' | '2fa_toggle' | 'withdrawal_request' | 'cancel_campaign', 
  userId: string, 
  onClose: () => void, 
  onVerified: (code: string) => Promise<void> 
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return setError("El código debe tener 6 dígitos");
    setLoading(true);
    setError(null);
    try {
      await onVerified(code);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const labels = {
    bank_account_update: { title: 'Confirmar Cuenta Bancaria', desc: 'Autoriza el cambio de tus datos para retiros.' },
    phone_update: { title: 'Confirmar Nuevo Teléfono', desc: 'Valida tu nuevo número de contacto.' },
    '2fa_toggle': { title: 'Cambiar Seguridad 2FA', desc: 'Confirma que deseas cambiar la protección de acceso.' },
    withdrawal_request: { title: 'Autorizar Retiro', desc: 'Ingresa el código enviado a tu correo para confirmar el retiro.' },
    cancel_campaign: { title: 'Confirmar Cancelación', desc: 'Ingresa el código enviado a tu correo para autorizar la cancelación de tu campaña con fondos.' }
  };

  const { title, desc } = labels[type];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 transition-colors"><X size={20} /></button>
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-[24px] flex items-center justify-center mx-auto mb-4"><ShieldCheck size={28} /></div>
            <h3 className="text-2xl font-black text-slate-900">{title}</h3>
            <p className="text-slate-500 font-medium text-sm mt-2">{desc}</p>
          </div>
          {error && <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-bold"><AlertCircle size={16} />{error}</div>}
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 text-center">Código de 6 dígitos enviado al correo</label>
              <input type="text" maxLength={6} required autoFocus className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-emerald-200 rounded-2xl font-black text-center text-3xl tracking-[12px] outline-none" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-base hover:bg-emerald-700 shadow-xl flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Validar y Finalizar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { user, profile, setProfile, loading: authLoading, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('resumen');
  const isGoogleUser = user?.app_metadata?.provider === 'google' || user?.app_metadata?.providers?.includes('google');
  
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [financials, setFinancials] = useState<(FinancialSummary & { enCursoNoDisponible: number }) | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', rut: '', phone: '', region: '', city: '' });
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankForm, setBankForm] = useState({ bankName: '', accountType: '', accountNumber: '', holderName: '', holderRut: '' });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showBankAlert, setShowBankAlert] = useState(false);
  
  const [withdrawalDraft, setWithdrawalDraft] = useState<{ campaignId: string, monto: number } | null>(null);
  const [showWithdrawalConfirm, setShowWithdrawalConfirm] = useState(false);
  const [showWithdrawalSuccess, setShowWithdrawalSuccess] = useState(false);
  
  const [campaignToCancel, setCampaignToCancel] = useState<CampaignData | null>(null);
  const [isCancellingLoading, setIsCancellingLoading] = useState(false);
  
  const [otpModal, setOtpModal] = useState<{ type: 'bank_account_update' | 'phone_update' | '2fa_toggle' | 'withdrawal_request' | 'cancel_campaign' } | null>(null);
  
  const [selectedDonationForReceipt, setSelectedDonationForReceipt] = useState<Donation | null>(null);
  const [selectedCampaignForRefund, setSelectedCampaignForRefund] = useState<CampaignData | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [rutError, setRutError] = useState<string | null>(null);
  const [bankRutError, setBankRutError] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState<{show: boolean, msg: string}>({show: false, msg: ''});
  const [profileSaving, setProfileSaving] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [notification, setNotification] = useState<{title: string, desc: string, type: 'success'|'error'|'info'} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{title: string, desc: string, onConfirm: () => void, variant?: 'violet'|'rose'|'amber'} | null>(null);

  // Estados para reenvío de email
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const service = CampaignService.getInstance();
  const authService = AuthService.getInstance();

  const isVerified = profile?.is_verified === true || isGoogleUser;
  const isProfileComplete = profile?.rut && profile?.phone && profile?.region && profile?.city;
  const hasPendingAction = !isVerified || !isProfileComplete;

  useEffect(() => {
    if (!authLoading && !user) { navigate('/login'); return; }
    if (user) {
      loadAllData();
      const params = new URLSearchParams(location.search);
      if (params.get('verified') === 'true') refreshProfile();
      const tabParam = params.get('tab') as TabType;
      if (tabParam) setActiveTab(tabParam);
      if (profile) setProfileForm({ full_name: profile.full_name || '', rut: profile.rut || '', phone: profile.phone || '', region: profile.region || '', city: profile.city || '' });
    }
  }, [user, authLoading, location.search, profile]);

  const loadAllData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (!user?.id) return; 
      const [cData, dData, fData, wData, bData] = await Promise.all([
        service.getUserCampaigns(user.id),
        service.getUserDonations(user.id),
        service.getFinancialSummary(user.id),
        service.getWithdrawals(user.id),
        authService.getBankAccount(user.id)
      ]);
      setCampaigns(cData);
      setDonations(dData);
      setFinancials(fData);
      setWithdrawals(wData);
      setBankAccount(bData);
    } catch (e) { console.error(e); }
    finally { if (!silent) setLoading(false); }
  };

  const handleResendEmail = async () => {
    if (!user?.email) return;
    setResendingEmail(true);
    try {
      await authService.resendVerificationEmail(user.email);
      setResendSent(true);
      displayToast("Correo de activación reenviado.");
      setTimeout(() => setResendSent(false), 10000);
    } catch (e) {
      setNotification({ title: "Error", desc: "No pudimos reenviar el correo. Intenta más tarde.", type: "error" });
    } finally {
      setResendingEmail(false);
    }
  };

  const triggerProfileUpdate = async (otpCode?: string) => {
    if (!user) return;
    setProfileSaving(true);
    try {
      const updated = await authService.updateProfile(user.id, profileForm, otpCode);
      setProfile(updated);
      setIsEditingProfile(false);
      setOtpModal(null);
      displayToast("Cambios guardados con éxito.");
    } catch (e: any) { 
      if (otpCode) throw e; 
      setNotification({ title: "Error", desc: "Hubo un problema actualizando tu perfil.", type: "error" });
    } finally { setProfileSaving(false); }
  };

  const displayToast = (msg: string) => {
    setShowSuccessToast({ show: true, msg });
    setTimeout(() => setShowSuccessToast({ show: false, msg: '' }), 5000);
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    if (profileForm.rut && !validateRut(profileForm.rut)) {
      setRutError("RUT inválido.");
      return;
    } else {
      setRutError(null);
    }
    
    if (profileForm.phone !== (profile?.phone || '')) {
      try {
        await authService.requestSecurityOTP(user.id, 'phone_update');
        setOtpModal({ type: 'phone_update' });
      } catch (e: any) { 
        setNotification({ title: "Error", desc: e.message, type: "error" });
      }
      return;
    }

    await triggerProfileUpdate();
  };

  const handleToggle2FA = async () => {
    if (!user) return;
    try {
      await authService.requestSecurityOTP(user.id, '2fa_toggle');
      setOtpModal({ type: '2fa_toggle' });
    } catch (e: any) { 
      setNotification({ title: "Error", desc: e.message, type: "error" });
    }
  };

  const trigger2FAUpdate = async (otpCode: string) => {
    if (!user || !profile) return;
    const newState = !profile.two_factor_enabled;
    try {
      const updated = await authService.updateProfile(user.id, { two_factor_enabled: newState }, otpCode);
      setProfile(updated);
      setOtpModal(null);
      displayToast(newState ? "Doble factor activado." : "Doble factor desactivado.");
    } catch (e: any) { throw e; }
  };

  const triggerBankUpdate = async (otpCode: string) => {
    if (!user) return;
    setBankSaving(true);
    try {
      const updated = await authService.updateBankAccount(user.id, bankForm, otpCode);
      setBankAccount(updated);
      setIsEditingBank(false);
      setOtpModal(null);
      displayToast("Datos bancarios actualizados.");
    } catch (e: any) {
      throw e; 
    } finally { setBankSaving(false); }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!validateRut(bankForm.holderRut)) {
      setBankRutError("RUT del titular inválido.");
      return;
    } else {
      setBankRutError(null);
    }
    
    try {
      await authService.requestSecurityOTP(user.id, 'bank_account_update');
      setOtpModal({ type: 'bank_account_update' });
    } catch (e: any) { 
      setNotification({ title: "Error", desc: e.message, type: "error" });
    }
  };

  const triggerWithdrawal = async (campaignId: string, monto: number, otpCode: string) => {
    if (!user) return;
    setActionLoading(campaignId);
    try {
      await service.requestWithdrawal(user.id, campaignId, monto, otpCode);
      setOtpModal(null);
      setShowWithdrawalSuccess(true);
      loadAllData(true);
    } catch (e: any) { 
      throw e; 
    } finally { 
      setActionLoading(null); 
    }
  };

  const handleWithdrawalRequest = (campaignId: string, monto: number) => {
    if (!user) return;
    if (!bankAccount) {
      setShowBankAlert(true);
      return;
    }
    setWithdrawalDraft({ campaignId, monto });
    setShowWithdrawalConfirm(true);
  };

  const startWithdrawalOTP = async () => {
    if (!user || !withdrawalDraft) return;
    setActionLoading(withdrawalDraft.campaignId);
    try {
      await authService.requestSecurityOTP(user.id, 'withdrawal_request');
      setShowWithdrawalConfirm(false);
      setOtpModal({ type: 'withdrawal_request' });
    } catch (e: any) {
      setNotification({ title: "Error", desc: e.message, type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const triggerCancelCampaign = async (campaignId: string, otpCode?: string) => {
    if (!user) return;
    setIsCancellingLoading(true);
    try {
      await service.cancelCampaign(campaignId, user.id, otpCode);
      setCampaignToCancel(null);
      setOtpModal(null);
      await loadAllData(true);
      setNotification({ title: "Éxito", desc: "Campaña cancelada con éxito.", type: "success" });
    } catch (e: any) {
      if (otpCode) throw e;
      setNotification({ title: "Error", desc: e.message, type: "error" });
    } finally {
      setIsCancellingLoading(false);
    }
  };

  const handleCancelClick = (c: CampaignData) => {
    setCampaignToCancel(c);
  };

  const handleTogglePause = async (c: CampaignData) => {
    if (!user) return;
    const isPausing = c.estado !== 'pausada';
    
    setConfirmModal({
      title: `¿${isPausing ? 'Pausar' : 'Reanudar'} campaña?`,
      desc: isPausing 
        ? "La campaña dejará de recibir donaciones temporalmente."
        : "La campaña volverá a estar pública de inmediato.",
      variant: isPausing ? 'amber' : 'violet',
      onConfirm: async () => {
        const newStatus = isPausing ? 'pausada' : 'activa';
        setConfirmModal(null);
        setActionLoading(c.id);
        try {
          await service.updateCampaign(c.id, user.id, { estado: newStatus });
          await loadAllData(true);
          displayToast(`Campaña ${isPausing ? 'pausada' : 'reanudada'} correctamente.`);
        } catch (e: any) {
          setNotification({ title: "Error", desc: e.message, type: "error" });
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  const proceedToCancelFlow = async () => {
    if (!user || !campaignToCancel) return;
    
    const withdrawnForThisCampaign = withdrawals
      .filter(w => w.campaignId === campaignToCancel.id && (w.estado === 'pendiente' || w.estado === 'completado'))
      .reduce((acc, w) => acc + Number(w.monto), 0);
    const balance = (Number(campaignToCancel.recaudado) || 0) - withdrawnForThisCampaign;

    if (balance > 0) {
      try {
        setIsCancellingLoading(true);
        await authService.requestSecurityOTP(user.id, 'cancel_campaign');
        setOtpModal({ type: 'cancel_campaign' });
      } catch (e: any) {
        setNotification({ title: "Error", desc: e.message, type: "error" });
      } finally {
        setIsCancellingLoading(false);
      }
    } else {
      await triggerCancelCampaign(campaignToCancel.id);
    }
  };

  const handleRegionChange = (regionName: string) => {
    setProfileForm(prev => ({ ...prev, region: regionName, city: '' }));
  };

  const handlePhoneBlur = () => {
    if (profileForm.phone && !validateChileanPhone(profileForm.phone)) setPhoneError("Teléfono inválido.");
    else setPhoneError(null);
  };

  const handleRutBlur = () => {
    if (profileForm.rut && !validateRut(profileForm.rut)) setRutError("RUT inválido.");
    else setRutError(null);
  };

  const handleBankRutBlur = () => {
    if (bankForm.holderRut && !validateRut(bankForm.holderRut)) setBankRutError("RUT del titular inválido.");
    else setBankRutError(null);
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/campana/${id}`);
    displayToast("¡Enlace copiado al portapapeles!");
  };

  const currentRegionCities = LOCATION_DATA.regions.find(r => r.name === profileForm.region)?.cities || [];

  const collectibleCampaigns = campaigns.filter(c => {
    const isFinished = c.estado === 'finalizada';
    if (!isFinished) return false;
    const withdrawnForThisCampaign = withdrawals
      .filter(w => w.campaignId === c.id && (w.estado === 'pendiente' || w.estado === 'completado'))
      .reduce((acc, w) => acc + Number(w.monto), 0);
    return (c.recaudado - withdrawnForThisCampaign) > 0;
  }).map(c => {
    const withdrawnForThisCampaign = withdrawals
      .filter(w => w.campaignId === c.id && (w.estado === 'pendiente' || w.estado === 'completado'))
      .reduce((acc, w) => acc + Number(w.monto), 0);
    return { ...c, saldoCobrable: c.recaudado - withdrawnForThisCampaign };
  });

  if (authLoading || loading) return <div className="flex flex-col items-center justify-center min-h-[70vh]"><Loader2 className="w-10 h-10 text-violet-600 animate-spin mb-4" /></div>;

  return (
    <div className="bg-slate-50/50 min-h-screen pb-20">
      {notification && (
        <NotificationModal 
          title={notification.title} 
          desc={notification.desc} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}
      
      {confirmModal && (
        <ActionConfirmModal 
          title={confirmModal.title} 
          desc={confirmModal.desc} 
          variant={confirmModal.variant} 
          onConfirm={confirmModal.onConfirm} 
          onCancel={() => setConfirmModal(null)} 
        />
      )}

      {showPasswordModal && <PasswordModal userId={user.id} onClose={() => setShowPasswordModal(false)} />}
      {showBankAlert && <BankAlertModal onClose={() => setShowBankAlert(false)} onConfirm={() => { setActiveTab('finanzas'); setIsEditingBank(true); setShowBankAlert(false); }} />}
      
      {showWithdrawalConfirm && withdrawalDraft && (
        <WithdrawalConfirmModal 
          amount={withdrawalDraft.monto} 
          loading={actionLoading === withdrawalDraft.campaignId} 
          onClose={() => { setShowWithdrawalConfirm(false); setWithdrawalDraft(null); }} 
          onConfirm={startWithdrawalOTP} 
        />
      )}
      
      {campaignToCancel && !otpModal && (
        <CancelCampaignModal 
          campaign={campaignToCancel} 
          loading={isCancellingLoading} 
          onClose={() => setCampaignToCancel(null)} 
          onConfirm={proceedToCancelFlow} 
        />
      )}

      {showWithdrawalSuccess && <WithdrawalSuccessModal onClose={() => setShowWithdrawalSuccess(false)} />}
      
      {otpModal && <GenericOTPModal type={otpModal.type} userId={user.id} onClose={() => setOtpModal(null)} onVerified={async (code) => {
          if (otpModal.type === 'bank_account_update') await triggerBankUpdate(code);
          else if (otpModal.type === 'phone_update') await triggerProfileUpdate(code);
          else if (otpModal.type === '2fa_toggle') await trigger2FAUpdate(code);
          else if (otpModal.type === 'withdrawal_request' && withdrawalDraft) await triggerWithdrawal(withdrawalDraft.campaignId, withdrawalDraft.monto, code);
          else if (otpModal.type === 'cancel_campaign' && campaignToCancel) await triggerCancelCampaign(campaignToCancel.id, code);
      }} />}
      
      {selectedDonationForReceipt && <ReceiptModal donation={selectedDonationForReceipt} profileName={profile?.full_name} onClose={() => setSelectedDonationForReceipt(null)} />}
      {selectedCampaignForRefund && <RefundDetailsModal campaign={selectedCampaignForRefund} onClose={() => setSelectedCampaignForRefund(null)} />}
      
      <div className="bg-white border-b border-slate-100 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-slate-900 text-white rounded-[24px] flex items-center justify-center text-2xl font-black shadow-2xl">{(profile?.full_name || 'U').charAt(0).toUpperCase()}</div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mi Panel de Control</p>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight">Hola, {(profile?.full_name || 'Usuario').split(' ')[0]}</h1>
                  {isVerified && <CheckCircle2 className="text-emerald-500 w-6 h-6" />}
                </div>
              </div>
            </div>
            <Link to="/crear" className="bg-violet-600 text-white px-6 py-4 rounded-2xl font-black hover:bg-violet-700 shadow-xl flex items-center gap-2"><Plus size={20} /> Nueva Campaña</Link>
          </div>
          <nav className="flex gap-8 mt-10 overflow-x-auto no-scrollbar">
            {[ 
              { id: 'resumen', label: 'Mis Campañas', icon: BarChart3 }, 
              { id: 'donaciones', label: 'Mis Donaciones', icon: HeartHandshake }, 
              { id: 'finanzas', label: 'Finanzas', icon: Wallet }, 
              { id: 'seguridad', label: 'Seguridad', icon: ShieldCheck, alert: hasPendingAction }, 
              { id: 'perfil', label: 'Perfil', icon: UserIcon, alert: !isProfileComplete } 
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id as TabType)} 
                className={`flex items-center gap-2 pb-4 text-xs font-black transition-all border-b-2 uppercase tracking-widest relative ${activeTab === tab.id ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <tab.icon size={14} /> {tab.label}
                {tab.alert && <span className="absolute top-0 -right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse border-2 border-white"></span>}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {activeTab === 'resumen' && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 bg-gradient-to-br from-violet-600 to-indigo-700 p-6 rounded-[32px] text-white shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Banknote size={80} /></div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-70">Recaudación Total</p>
                <p className="text-4xl font-black tracking-tight">${financials?.totalRecaudado.toLocaleString('es-CL') || '0'}</p>
              </div>
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Campañas</p><p className="text-3xl font-black text-slate-900">{campaigns.length}</p></div>
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Donaciones</p><p className="text-3xl font-black text-slate-900">{campaigns.reduce((acc, c) => acc + c.donantesCount, 0)}</p></div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {campaigns.length > 0 ? campaigns.map(c => (
                <div key={c.id} className="bg-white p-4 rounded-[32px] border border-slate-100 flex flex-col md:flex-row items-center gap-6 group hover:shadow-lg transition-all duration-300">
                  <div className="w-full md:w-32 h-20 rounded-[24px] overflow-hidden shrink-0 shadow-sm"><img src={c.imagenUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" /></div>
                  <div className="flex-grow w-full space-y-1">
                    <h3 className="text-lg font-black text-slate-900 leading-tight group-hover:text-violet-600 transition-colors">{c.titulo}</h3>
                    <div className="flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <span className={`px-2 py-0.5 rounded-full border ${
                        c.estado === 'activa' ? 'border-emerald-100 text-emerald-600 bg-emerald-50' : 
                        c.estado === 'cancelada' ? 'border-rose-100 text-rose-600 bg-rose-50' :
                        c.estado === 'pausada' ? 'border-amber-100 text-amber-600 bg-amber-50' :
                        'border-slate-100 text-slate-400 bg-slate-50'
                      }`}>{c.estado}</span>
                      
                      {c.estado === 'cancelada' ? (
                        <button 
                          onClick={() => setSelectedCampaignForRefund(c)} 
                          className="flex items-center gap-1.5 text-violet-600 hover:text-violet-700 font-black transition-colors"
                        >
                          <RefreshCw size={10} className="animate-spin-slow" />
                          <span>${c.recaudado.toLocaleString('es-CL')} en devolución</span>
                        </button>
                      ) : (
                        <span>{c.recaudado.toLocaleString('es-CL')} recaudado</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyLink(c.id)} className="w-11 h-11 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl flex items-center justify-center transition-all shadow-sm" title="Copiar enlace"><Copy size={20} /></button>
                    <Link to={`/campana/${c.id}`} className="w-11 h-11 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl flex items-center justify-center transition-all shadow-sm"><Eye size={20} /></Link>
                    {(c.estado === 'activa' || c.estado === 'pausada') && (
                      <>
                        <Link to={`/campana/${c.id}/editar`} className="w-11 h-11 bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white rounded-xl flex items-center justify-center transition-all shadow-sm"><Edit3 size={20} /></Link>
                        
                        <button 
                          onClick={() => handleTogglePause(c)} 
                          disabled={actionLoading === c.id} 
                          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-sm ${
                            c.estado === 'pausada' 
                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white' 
                            : 'bg-amber-50 text-amber-500 hover:bg-amber-600 hover:text-white'
                          }`}
                          title={c.estado === 'pausada' ? "Reanudar Campaña" : "Pausar Campaña"}
                        >
                          {actionLoading === c.id ? <Loader2 className="animate-spin" size={18} /> : (c.estado === 'pausada' ? <Play size={20} /> : <Pause size={20} />)}
                        </button>

                        <button 
                          onClick={() => handleCancelClick(c)} 
                          className="w-11 h-11 bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white rounded-xl flex items-center justify-center transition-all shadow-sm"
                          title="Cancelar Campaña"
                        >
                          <X size={20} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )) : (
                <div className="bg-white p-20 rounded-[40px] border-2 border-dashed border-slate-100 text-center"><Plus className="mx-auto text-slate-200 mb-4" size={48} /><p className="text-slate-400 font-bold">No tienes campañas creadas.</p><Link to="/crear" className="text-violet-600 font-black mt-4 inline-block hover:underline">Crear mi primera campaña</Link></div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'donaciones' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 mb-6"><div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-[14px] flex items-center justify-center"><Heart size={20} className="fill-violet-600" /></div><h2 className="text-2xl font-black text-slate-900 tracking-tight">Mi historial de aportes</h2></div>
            {donations.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {donations.map((don) => (
                  <div key={don.id} className="bg-white p-4 rounded-[32px] border border-slate-100 flex flex-col md:flex-row items-center gap-6 group hover:shadow-lg transition-all duration-300">
                    <div className="w-full md:w-32 h-20 rounded-[24px] overflow-hidden shrink-0 shadow-sm"><img src={don.campaign?.imagenUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" /></div>
                    <div className="flex-grow w-full space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">Donaste a</p><h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-violet-600 transition-colors">{don.campaign?.titulo || 'Campaña'}</h4><div className="flex items-center gap-3"><div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold uppercase tracking-widest"><Calendar size={12} className="text-slate-300" />{new Date(don.fecha).toLocaleDateString('es-CL')}</div><div className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">EXITOSO</div></div></div>
                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end pr-2"><div className="text-right"><p className="text-3xl font-black text-slate-900 tracking-tighter">${(don.amountCause || 0).toLocaleString('es-CL')}</p><p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-0.5">Aporte Solidario</p></div><div className="flex gap-2"><button onClick={() => setSelectedDonationForReceipt(don)} className="w-11 h-11 bg-slate-50 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl flex items-center justify-center transition-all shadow-sm"><FileText size={20} /></button><Link to={`/campana/${don.campaignId}`} className="w-11 h-11 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl flex items-center justify-center transition-all shadow-sm"><Eye size={20} /></Link></div></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white p-20 rounded-[40px] border-2 border-dashed border-slate-100 text-center"><HeartHandshake size={48} className="mx-auto text-slate-200 mb-4" /><p className="text-slate-400 font-bold">Aún no has realizado donaciones.</p><Link to="/explorar" className="text-violet-600 font-black mt-4 inline-block hover:underline">Explorar campañas</Link></div>
            )}
          </div>
        )}

        {activeTab === 'finanzas' && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bg-emerald-50 p-8 rounded-[40px] border border-emerald-100 shadow-sm relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Wallet size={64} /></div>
                 <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest mb-4">DISPONIBLE PARA RETIRO (CAMPAÑAS FINALIZADAS)</p>
                 <p className="text-4xl font-black text-emerald-700">${financials?.disponibleRetiro.toLocaleString('es-CL') || '0'}</p>
                 <div className="bg-emerald-100/50 text-emerald-700 px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-2 w-fit mt-5">
                   <CheckCircle2 size={14} />
                   <span>Fondos liberados para transferencia</span>
                 </div>
               </div>

               <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Timer size={64} /></div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">RECAUDACIÓN EN CURSO (NO RETIRABLE)</p>
                 <p className="text-4xl font-black text-slate-900">${financials?.enCursoNoDisponible.toLocaleString('es-CL') || '0'}</p>
                 <div className="bg-slate-200/50 text-slate-600 px-3 py-1.5 rounded-full text-[10px] font-black flex items-center gap-2 w-fit mt-5">
                   <Info size={14} />
                   <span>Se liberan al finalizar cada campaña</span>
                 </div>
               </div>

               <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><CheckCircle2 size={64} /></div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total Retirado</p>
                 <p className="text-4xl font-black text-white">${financials?.totalRetirado.toLocaleString('es-CL') || '0'}</p>
               </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 ml-2">
                <Download size={24} className="text-violet-600" />
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Campañas con fondos por cobrar</h2>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {collectibleCampaigns.length > 0 ? collectibleCampaigns.map(c => (
                  <div key={c.id} className="bg-white p-6 rounded-[32px] border border-slate-100 flex flex-col md:flex-row items-center gap-8 shadow-sm group hover:shadow-md transition-all">
                    <div className="w-full md:w-20 h-20 rounded-[20px] overflow-hidden shrink-0 shadow-inner">
                      <img src={c.imagenUrl} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-grow w-full">
                      <h3 className="text-lg font-black text-slate-900 mb-1">{c.titulo}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {c.estado.toUpperCase()} • {c.donantesCount} DONANTES
                      </p>
                    </div>
                    <div className="flex flex-col items-end md:items-end text-right w-full md:w-auto">
                      <p className="text-2xl font-black text-slate-900 tracking-tight">${c.saldoCobrable.toLocaleString('es-CL')}</p>
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-0.5">SALDO COBRABLE</p>
                    </div>
                    <div className="w-full md:w-auto">
                      <button 
                        onClick={() => handleWithdrawalRequest(c.id, c.saldoCobrable)} 
                        disabled={actionLoading === c.id} 
                        className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-violet-600 text-white rounded-[24px] font-black text-sm uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                      >
                        {actionLoading === c.id ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                        Cobrar Fondos
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="bg-white p-16 rounded-[40px] border border-slate-100 text-center shadow-sm">
                    <Info size={40} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold text-base">No tienes campañas finalizadas con saldo pendiente de retiro.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight ml-2">Historial de Movimientos</h2>
              
              <div className="bg-white rounded-[40px] border border-slate-100 overflow-hidden shadow-sm">
                {withdrawals.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50/50 border-b border-slate-50">
                        <tr>
                          <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                          <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Campaña</th>
                          <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto</th>
                          <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {withdrawals.map(w => (
                          <tr key={w.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-8 py-6 text-sm font-medium text-slate-500 whitespace-nowrap">{new Date(w.fecha).toLocaleDateString('es-CL')}</td>
                            <td className="px-8 py-6 text-sm font-black text-slate-800 line-clamp-1 max-w-[250px]">{w.campaignTitle}</td>
                            <td className="px-8 py-6 text-sm font-black text-slate-900">${w.monto.toLocaleString('es-CL')}</td>
                            <td className="px-8 py-6 text-right">
                              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                w.estado === 'completado' ? 'bg-emerald-50 text-emerald-600' :
                                w.estado === 'pendiente' ? 'bg-amber-50 text-amber-600' :
                                'bg-rose-50 text-rose-600'
                              }`}>
                                {w.estado}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-24 text-center">
                    <p className="text-slate-300 font-bold text-xl italic">Sin movimientos históricos.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-100 p-10 shadow-sm" id="bank-config">
              <div className="flex justify-between items-start mb-8"><div><h3 className="text-xl font-black text-slate-900 tracking-tight">Cuenta Bancaria</h3><p className="text-sm text-slate-500 font-medium">Configura dónde recibirás los fondos recaudados.</p></div><button onClick={() => { if (!isEditingBank && bankAccount) setBankForm({ bankName: bankAccount.bankName, accountType: bankAccount.accountType, accountNumber: bankAccount.accountNumber, holderName: bankAccount.holderName, holderRut: bankAccount.holderRut }); setIsEditingBank(!isEditingBank); }} className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 hover:text-violet-600 rounded-xl font-bold text-xs transition-all">{isEditingBank ? <X size={16} /> : <Edit3 size={16} />} {isEditingBank ? 'Cancelar' : (bankAccount ? 'Modificar' : 'Configurar')}</button></div>
              {!isEditingBank ? (
                bankAccount ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                     <div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Banco</span><p className="font-bold text-slate-800 flex items-center gap-2"><Landmark size={14} className="text-violet-600" /> {bankAccount.bankName}</p></div>
                     <div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipo / Número</span><p className="font-bold text-slate-800">{bankAccount.accountType} - {bankAccount.accountNumber}</p></div>
                     <div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Titular</span><p className="font-bold text-slate-800">{bankAccount.holderName} ({bankAccount.holderRut})</p></div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200"><Landmark className="text-slate-300 mb-3" size={32} /><p className="text-slate-500 font-bold text-sm">No has configurado una cuenta bancaria aún.</p><button onClick={() => setIsEditingBank(true)} className="mt-4 text-violet-600 font-black text-xs uppercase tracking-widest">Configurar Ahora</button></div>
                )
              ) : (
                <form onSubmit={handleSaveBank} className="space-y-6 animate-in slide-in-from-top-2">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Institución Bancaria</label><select className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl font-bold" value={bankForm.bankName} onChange={e => setBankForm({...bankForm, bankName: e.target.value})} required><option value="">Selecciona Banco</option>{CHILEAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tipo de Cuenta</label><select className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 rounded-2xl font-bold" value={bankForm.accountType} onChange={e => setBankForm({...bankForm, accountType: e.target.value})} required><option value="">Tipo de cuenta</option>{ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Número de Cuenta</label><input type="text" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white rounded-2xl font-bold" placeholder="XXXXXXXXX" value={bankForm.accountNumber} onChange={e => setBankForm({...bankForm, accountNumber: e.target.value.replace(/\D/g, '')})} required /></div>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Titular de la Cuenta</label><input type="text" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white rounded-2xl font-bold" placeholder="Nombre completo" value={bankForm.holderName} onChange={e => setBankForm({...bankForm, holderName: e.target.value})} required /></div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">RUT del Titular</label>
                        <input 
                          type="text" 
                          className={`w-full p-4 bg-slate-50 border-2 ${bankRutError ? 'border-rose-200 bg-rose-50' : 'border-transparent focus:border-violet-200 focus:bg-white'} rounded-[24px] font-bold transition-all`} 
                          placeholder="12.345.678-9" 
                          value={bankForm.holderRut} 
                          onChange={e => setBankForm({...bankForm, holderRut: formatRut(e.target.value)})} 
                          onBlur={handleBankRutBlur} 
                          required 
                        />
                        {bankRutError && <p className="text-[10px] text-rose-600 font-bold mt-1 ml-1">{bankRutError}</p>}
                      </div>
                   </div>
                   <div className="pt-4 flex gap-3"><button type="button" onClick={() => setIsEditingBank(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest">Cancelar</button><button type="submit" disabled={bankSaving || !!bankRutError} className="flex-[2] py-4 bg-violet-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-violet-700 shadow-lg flex items-center justify-center gap-2">{bankSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Guardar Datos Bancarios</button></div>
                </form>
              )}
            </div>
          </div>
        )}

        {activeTab === 'seguridad' && (
          <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
             <div className="bg-white rounded-[48px] border border-slate-100 p-10 md:p-14 shadow-2xl shadow-slate-100 relative overflow-hidden">
               
               {/* BANNER DE ACCIÓN REQUERIDA (Colores Donia - Violetas) */}
               {(!isVerified || !isProfileComplete) && (
                 <div className="mb-10 bg-violet-50 border border-violet-100 p-8 rounded-[32px] flex items-start gap-6 animate-in slide-in-from-top-4">
                    <div className="w-14 h-14 bg-white text-violet-600 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                       <Sparkles size={28} />
                    </div>
                    <div className="flex-grow">
                       <h4 className="text-violet-900 font-black uppercase text-xs tracking-widest mb-1">Acciones Requeridas</h4>
                       <p className="text-violet-800 text-sm font-medium leading-relaxed">
                          Para garantizar la transparencia y seguridad de tus recaudaciones, necesitas completar lo siguiente:
                          <span className={`block mt-2 font-black ${!isVerified ? 'text-rose-600' : 'text-emerald-600 opacity-60'}`}>
                            • {!isVerified ? 'Debes verificar tu correo electrónico.' : 'Correo electrónico verificado.'}
                          </span>
                          <span className={`block font-black ${!isProfileComplete ? 'text-rose-600' : 'text-emerald-600 opacity-60'}`}>
                            • {!isProfileComplete ? 'Debes completar tu perfil (RUT y Teléfono).' : 'Perfil completo.'}
                          </span>
                       </p>
                       {!isVerified && (
                          <button 
                            onClick={handleResendEmail}
                            disabled={resendingEmail || resendSent}
                            className="mt-5 bg-violet-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2"
                          >
                             {resendingEmail ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                             {resendSent ? 'Correo reenviado' : 'Reenviar activación'}
                          </button>
                       )}
                    </div>
                 </div>
               )}

               <div className="mb-12 relative z-10">
                 <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Protección de Cuenta</h3>
                 <p className="text-slate-500 font-medium text-lg">Gestiona la seguridad de tu acceso y las sesiones activas.</p>
                 <div className="absolute top-0 right-0 p-2 opacity-5 -mr-4 -mt-4"><ShieldCheck size={140} /></div>
               </div>

               <div className="space-y-6 relative z-10">
                  <div className="p-8 bg-slate-50/50 rounded-[32px] border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-lg transition-all duration-300">
                     <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400 group-hover:text-violet-600 transition-colors">
                          {isGoogleUser ? <svg className="w-8 h-8" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> : <Mail size={32} />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Principal</p>
                          <p className="text-xl font-black text-slate-900">{user?.email}</p>
                        </div>
                     </div>
                     
                     <div className="flex flex-col items-end gap-2 text-right">
                        <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border transition-colors ${isVerified ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse'}`}>
                           {isGoogleUser ? 'GOOGLE' : isVerified ? 'VERIFICADO' : 'VERIFICACIÓN PENDIENTE'} 
                           {isVerified ? <CheckCircle2 size={12} /> : <MailWarning size={12} />}
                        </div>
                        {!isVerified && !isGoogleUser && (
                           <div className="flex flex-col items-end">
                              <button 
                                onClick={handleResendEmail} 
                                disabled={resendingEmail || resendSent}
                                className="text-[9px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 transition-colors mr-1 underline disabled:opacity-50"
                              >
                                 {resendingEmail ? 'Reenviando...' : resendSent ? 'Correo enviado' : 'Reenviar correo de activación'}
                              </button>
                           </div>
                        )}
                     </div>
                  </div>

                  {!isGoogleUser ? (
                    <>
                      <div className="p-8 bg-slate-50/50 rounded-[32px] border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-lg transition-all duration-300"><div className="flex items-center gap-6"><div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400 group-hover:text-violet-600 transition-colors"><Key size={32} /></div><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contraseña</p><p className="text-xl font-black text-slate-900 tracking-widest">•••••••••••••</p></div></div><button onClick={() => setShowPasswordModal(true)} className="text-xs font-black text-violet-600 uppercase tracking-[0.2em] hover:underline">Cambiar</button></div>
                      
                      <div className={`p-8 rounded-[32px] border border-slate-100 flex items-center justify-between transition-all duration-300 ${profile?.two_factor_enabled ? 'bg-violet-50 border-violet-100' : 'bg-slate-50/30'}`}>
                        <div className="flex items-center gap-6">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm transition-colors ${profile?.two_factor_enabled ? 'bg-white text-violet-600' : 'bg-white text-slate-300'}`}>
                            <Fingerprint size={32} />
                          </div>
                          <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${profile?.two_factor_enabled ? 'text-violet-500' : 'text-slate-400'}`}>Seguridad en el Inicio de Sesión</p>
                            <p className={`text-xl font-black ${profile?.two_factor_enabled ? 'text-violet-900' : 'text-slate-400'}`}>
                              {profile?.two_factor_enabled ? 'Doble Factor (2FA) Activado' : 'Doble Factor (2FA) Desactivado'}
                            </p>
                            <p className="text-[10px] font-medium text-slate-400 mt-1 max-w-xs">
                              {profile?.two_factor_enabled ? 'Se requerirá un código enviado a tu correo al iniciar sesión.' : 'Te recomendamos activar esta opción para proteger tus fondos.'}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={handleToggle2FA} 
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none ${profile?.two_factor_enabled ? 'bg-violet-600' : 'bg-slate-300'}`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-all ${profile?.two_factor_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 bg-violet-50/50 rounded-[32px] border border-violet-100 flex items-center gap-6 animate-in slide-in-from-top-2"><div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-violet-600"><Info size={32} /></div><div><p className="text-lg font-black text-violet-900 mb-1">Cuenta vinculada con Google</p><p className="text-sm text-violet-700/70 font-medium leading-relaxed max-w-lg">Tu seguridad es gestionada externamente por Google. Las funciones de contraseña y 2FA local están deshabilitadas.</p></div></div>
                  )}
               </div>
               <div className="mt-14 pt-10 border-t border-slate-50"><div className="bg-rose-50/50 rounded-[32px] border border-rose-100 p-8 shadow-sm relative overflow-hidden group"><div className="flex items-start gap-6 relative z-10"><div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shadow-sm shrink-0"><ShieldAlert size={32} /></div><div className="space-y-4"><div><h4 className="text-2xl font-black text-rose-900 mb-1">Zona Crítica</h4><p className="text-base text-rose-700 font-medium leading-relaxed">Si sospechas acceso no autorizado, solicita el cierre global.</p></div><button onClick={() => setNotification({ title: "Acción en desarrollo", desc: "El cierre global de sesiones es una función administrativa. Nuestro equipo de soporte procesará tu solicitud en breve si confirmas mediante correo.", type: "info" })} className="text-sm font-black text-rose-600 uppercase tracking-[0.15em] hover:underline">Solicitar cierre de sesiones globales</button></div></div></div></div>
             </div>
          </div>
        )}

        {activeTab === 'perfil' && (
          <div className="animate-in fade-in duration-500 max-w-3xl mx-auto">
             <div className="bg-white rounded-[48px] border border-slate-100 p-10 md:p-14 shadow-2xl shadow-slate-100 relative overflow-hidden">
               {!isEditingProfile ? (
                 <>
                   <div className="flex justify-between items-center mb-12"><h3 className="text-4xl font-black text-slate-900 tracking-tighter">Tu Perfil</h3><button onClick={() => setIsEditingProfile(true)} className="flex items-center gap-2 px-6 py-2.5 bg-slate-50 text-slate-600 hover:text-violet-600 rounded-2xl font-black text-sm transition-all shadow-sm"><Edit3 size={18} /> Editar</button></div>
                   <div className="space-y-10">
                     <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Nombre Registrado</label><div className="p-6 bg-slate-50/50 border border-slate-100 rounded-[24px] font-black text-slate-900 text-lg">{profile?.full_name || 'Sin registro'}</div></div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">RUT</label><div className="p-6 bg-slate-50/50 border border-slate-100 rounded-[24px] font-black text-slate-900 text-lg">{profile?.rut || 'Sin registro'}</div></div><div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Teléfono</label><div className="p-6 bg-slate-50/50 border border-slate-100 rounded-[24px] font-black text-slate-900 text-lg flex items-center gap-2"><Phone size={16} className="text-violet-600" /> {profile?.phone || 'Sin registro'}</div></div></div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Región</label><div className="p-6 bg-slate-50/50 border border-slate-100 rounded-[24px] font-black text-slate-900 text-lg truncate">{profile?.region || 'Sin registro'}</div></div><div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Ciudad</label><div className="p-6 bg-slate-50/50 border border-slate-100 rounded-[24px] font-black text-slate-900 text-lg truncate">{profile?.city || 'Sin registro'}</div></div></div>
                     <div className="pb-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Email de contacto</label><div className="p-6 bg-slate-50/50 border border-slate-100 rounded-[24px] font-black text-slate-900 text-lg flex justify-between items-center group cursor-not-allowed">{user?.email}<Lock size={18} className="text-slate-200" /></div></div>
                     <div className="pt-6 border-t border-slate-50">
                        <button 
                          onClick={() => setConfirmModal({
                            title: "¿Cerrar sesión?",
                            desc: "Deberás volver a ingresar tus credenciales para acceder a tu panel.",
                            variant: 'rose',
                            onConfirm: signOut
                          })} 
                          className="w-full py-5 bg-rose-50 text-rose-600 rounded-[24px] font-black text-lg hover:bg-rose-100 transition-all flex items-center justify-center gap-3 active:scale-95"
                        >
                          Cerrar Sesión
                        </button>
                      </div>
                   </div>
                 </>
               ) : (
                  <form onSubmit={(e) => { e.preventDefault(); handleUpdateProfile(); }} className="space-y-8">
                    <div className="flex justify-between items-center mb-10"><h3 className="text-4xl font-black text-slate-900 tracking-tighter">Editar Perfil</h3><button type="button" onClick={() => setIsEditingProfile(false)} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-all"><X size={24} /></button></div>
                    <div className="space-y-8">
                       <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Nombre Completo</label><input type="text" className="w-full p-6 bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white rounded-[24px] outline-none font-black text-slate-900 text-lg transition-all" value={profileForm.full_name} onChange={(e) => setProfileForm({...profileForm, full_name: e.target.value})} required /></div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">RUT</label>
                            <input 
                              type="text" 
                              className={`w-full p-6 bg-slate-50 border-2 ${rutError ? 'border-rose-200 bg-rose-50' : 'border-transparent focus:border-violet-200 focus:bg-white'} rounded-[24px] font-black text-lg transition-all`} 
                              value={profileForm.rut} 
                              onChange={e => setProfileForm({...profileForm, rut: formatRut(e.target.value)})} 
                              onBlur={handleRutBlur} 
                              placeholder="12.345.678-9" 
                            />
                            {rutError && <p className="text-[11px] text-rose-600 font-bold mt-2 ml-1">{rutError}</p>}
                         </div>
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Teléfono</label>
                            <input 
                              type="text" 
                              className={`w-full p-6 bg-slate-50 border-2 ${phoneError ? 'border-rose-200 bg-rose-50' : 'border-transparent focus:border-violet-200 focus:bg-white'} rounded-[24px] font-black text-lg transition-all`} 
                              value={profileForm.phone} 
                              onChange={e => setProfileForm({...profileForm, phone: formatPhone(e.target.value)})} 
                              onBlur={handlePhoneBlur} 
                              placeholder="+56 9 XXXX XXXX" 
                            />
                            {phoneError && <p className="text-[11px] text-rose-600 font-bold mt-2 ml-1">{phoneError}</p>}
                         </div>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Región</label><select className="w-full p-6 bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white rounded-[24px] font-black text-lg outline-none appearance-none cursor-pointer" value={profileForm.region} onChange={e => handleRegionChange(e.target.value)} required><option value="">Selecciona Región</option>{LOCATION_DATA.regions.map(r => <option key={r.slug} value={r.name}>{r.name}</option>)}</select></div><div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Ciudad</label><select className="w-full p-6 bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white rounded-[24px] font-black text-lg outline-none appearance-none disabled:opacity-50 cursor-pointer" value={profileForm.city} onChange={e => setProfileForm({...profileForm, city: e.target.value})} disabled={!profileForm.region} required><option value="">Selecciona Ciudad</option>{currentRegionCities.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div>
                    </div>
                    <div className="pt-10 flex gap-4"><button type="button" onClick={() => setIsEditingProfile(false)} className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-[24px] font-black text-base uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button><button type="submit" disabled={profileSaving || !!rutError || !!phoneError} className="flex-[2] py-5 bg-violet-600 text-white rounded-[24px] font-black text-base uppercase tracking-widest hover:bg-violet-700 shadow-xl flex items-center justify-center gap-3 transition-all">{profileSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Guardar Perfil</button></div>
                  </form>
               )}
               {showSuccessToast.show && <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-8 py-3.5 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-8 duration-500 z-50 border border-emerald-400"><CheckCircle2 size={20} /><span className="text-sm font-black uppercase tracking-widest">{showSuccessToast.msg}</span></div>}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
