import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ChevronLeft, 
  Heart, 
  Loader2, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  Zap, 
  Receipt, 
  Mail, 
  Check, 
  ShieldCheck,
  XCircle,
  Clock,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { CampaignService } from '../services/CampaignService';
import { CampaignData } from '../types';
import { useAuth } from '../context/AuthContext';

const DonatePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [donationAmount, setDonationAmount] = useState<number>(1000);
  const [tipPercentage, setTipPercentage] = useState<number | 'custom'>(10);
  const [customTipAmount, setCustomTipAmount] = useState<number>(0);
  
  const [redirecting, setRedirecting] = useState(false);
  const [donorName, setDonorName] = useState<string>('');
  const [donorEmail, setDonorEmail] = useState<string>('');
  const [donorComment, setDonorComment] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Parámetros de Mercado Pago tras retorno
  const queryParams = new URLSearchParams(location.search);
  const paymentStatus = queryParams.get('status'); 
  const collectionStatus = queryParams.get('collection_status');
  const paymentId = queryParams.get('payment_id') || queryParams.get('collection_id');
  const isApproved = paymentStatus === 'approved' || collectionStatus === 'approved';

  const [verifyingPayment, setVerifyingPayment] = useState(isApproved && !!paymentId);
  const [paymentDetails, setPaymentDetails] = useState<{cause: number, total: number, tip: number, fee: number, email: string} | null>(null);
  
  const service = CampaignService.getInstance();

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (id) {
          const data = await service.getCampaignById(id);
          setCampaign(data);
        }
      } catch (e) {
        console.error("Error cargando causa:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    if (isApproved && paymentId && !paymentDetails) {
      verifyPayment(paymentId);
    }
  }, [isApproved, paymentId]);

  const verifyPayment = async (pId: string) => {
    setVerifyingPayment(true);
    try {
      const resp = await fetch(`/api/preference?action=verify&payment_id=${pId}`);
      const result = await resp.json();
      
      if (result.success) {
        setPaymentDetails({
          cause: result.amount_cause,
          total: result.amount_total,
          tip: result.amount_tip,
          fee: result.amount_fee,
          email: result.donor_email
        });
      } else {
        console.error("Verificación fallida:", result.error);
      }
    } catch (err) {
      console.error("Error confirmando pago:", err);
    } finally {
      setVerifyingPayment(false);
    }
  };

  useEffect(() => {
    if (user || profile) {
      if (profile?.full_name) setDonorName(profile.full_name);
      if (user?.email) setDonorEmail(user.email);
    }
  }, [user, profile]);

  const tipGrossAmount = tipPercentage === 'custom' 
    ? customTipAmount 
    : Math.round(donationAmount * (Number(tipPercentage) / 100));
  
  // Cálculo de comisión estimada (aprox 3.8% + IVA o lo que defina el negocio)
  const commissionAmount = Math.round((donationAmount + tipGrossAmount) * 0.038);
  const totalAmountCalculated = donationAmount + tipGrossAmount + commissionAmount;

  const handleManualTipChange = (strVal: string) => {
    const numVal = parseInt(strVal.replace(/\./g, '').replace(/\D/g, ''), 10) || 0;
    setCustomTipAmount(numVal);
    setTipPercentage('custom');
  };

  const handleDonationChange = (strVal: string) => {
    const numVal = parseInt(strVal.replace(/\./g, '').replace(/\D/g, ''), 10) || 0;
    setDonationAmount(numVal);
  };

  const handlePaymentRedirect = async () => {
    if (donationAmount < 500) {
      setError("Monto mínimo $500 CLP");
      return;
    }
    if (!donorEmail.includes('@')) {
      setError("Email inválido.");
      return;
    }
    
    setError(null);
    setRedirecting(true);

    try {
        const resp = await fetch('/api/preference?action=preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                campaignId: campaign?.id,
                campaignTitle: campaign?.titulo,
                monto: totalAmountCalculated,
                nombre: donorName,
                email: donorEmail,
                comentario: donorComment,
                donorUserId: user?.id || null,
                // Metadatos para el desglose financiero
                base_amount: donationAmount,
                tip_amount: tipGrossAmount,
                fee_amount: commissionAmount
            })
        });
        const data = await resp.json();
        if (data.init_point) window.location.href = data.init_point;
    } catch (err: any) {
        setError("Error conectando con la pasarela.");
        setRedirecting(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="animate-spin text-violet-600" /></div>;

  if (isApproved) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center animate-in zoom-in duration-300">
        {verifyingPayment ? (
          <div className="flex flex-col items-center py-20 gap-4">
             <RefreshCw size={40} className="text-violet-600 animate-spin" />
             <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Confirmando montos con el servidor...</p>
          </div>
        ) : (
          <>
            <div className="relative mb-8">
               <div className="absolute inset-0 bg-emerald-100 rounded-full blur-2xl opacity-40 scale-150 animate-pulse"></div>
               <div className="relative w-24 h-24 bg-emerald-500 text-white rounded-[32px] flex items-center justify-center mx-auto shadow-xl">
                 <Check size={48} strokeWidth={3} />
               </div>
            </div>
            
            <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">¡Muchas gracias! 💜</h1>
            <p className="text-slate-500 mb-8 font-medium leading-relaxed text-lg">
              Tu donación para <br/><span className="text-violet-600 font-black text-xl">"{campaign?.titulo}"</span><br/> se ha procesado con éxito.
            </p>
            
            <div className="bg-white p-8 rounded-[32px] mb-10 border border-slate-100 shadow-xl space-y-4">
               <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comprobante enviado a</span>
                  <span className="text-sm font-bold text-slate-700">{paymentDetails?.email || donorEmail || 'Tu correo'}</span>
               </div>
               
               {paymentDetails ? (
                 <>
                   <div className="space-y-3 py-2">
                      <div className="flex justify-between text-xs font-medium">
                         <span className="text-slate-400 uppercase font-black text-[9px] tracking-widest">DONACIÓN CAUSA</span>
                         <span className="text-slate-900 font-bold">${paymentDetails.cause.toLocaleString('es-CL')}</span>
                      </div>
                      <div className="flex justify-between text-xs font-medium">
                         <span className="text-slate-400 uppercase font-black text-[9px] tracking-widest">APOYO DONIA</span>
                         <span className="text-slate-900 font-bold">${paymentDetails.tip.toLocaleString('es-CL')}</span>
                      </div>
                      <div className="flex justify-between text-xs font-medium">
                         <span className="text-slate-400 uppercase font-black text-[9px] tracking-widest">COMISIÓN PASARELA DE PAGO</span>
                         <span className="text-slate-900 font-bold">${paymentDetails.fee.toLocaleString('es-CL')}</span>
                      </div>
                   </div>
                   <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">TOTAL FINAL</span>
                      <span className="text-3xl font-black text-slate-900">${paymentDetails.total.toLocaleString('es-CL')}</span>
                   </div>
                 </>
               ) : (
                 <div className="py-4 text-slate-400 text-sm font-bold italic">
                   Pago confirmado. Los detalles se reflejarán en tu correo pronto.
                 </div>
               )}
            </div>

            <button onClick={() => navigate(`/campana/${id}`)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl active:scale-95">
              Volver a la campaña
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="max-w-5xl mx-auto px-4 pt-10">
        <button onClick={() => navigate(`/campana/${id}`)} className="flex items-center gap-1.5 text-slate-400 hover:text-violet-600 font-bold mb-8 transition-colors group text-sm">
          <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" /> Volver a la campaña
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-sm border border-slate-100">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600 shadow-sm">
                  <Heart size={24} className="fill-current" />
                </div>
                <div>
                   <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tu donación</h1>
                   <p className="text-slate-500 font-bold text-sm line-clamp-1">Apoyando a: {campaign?.titulo}</p>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Monto para la causa</label>
                  <div className="relative mb-4">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300 text-xl">$</span>
                    <input 
                      type="text" 
                      className="w-full pl-9 pr-4 py-5 bg-slate-50 border border-slate-100 focus:border-violet-200 focus:bg-white rounded-2xl outline-none font-black text-slate-900 transition-all text-xl"
                      placeholder="0"
                      value={donationAmount > 0 ? donationAmount.toLocaleString('es-CL') : ''}
                      onChange={(e) => handleDonationChange(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[1000, 5000, 10000].map(amt => (
                      <button 
                        key={amt}
                        onClick={() => setDonationAmount(amt)}
                        className={`py-3 rounded-xl text-sm font-black border transition-all ${donationAmount === amt ? 'bg-violet-600 border-violet-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-500 hover:border-violet-200 shadow-sm'}`}
                      >
                        ${amt.toLocaleString('es-CL')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Zap size={80} className="text-violet-600" />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-2">
                       Propina opcional para Donia
                    </h3>
                    <p className="text-slate-500 text-xs font-medium leading-relaxed mb-6 pr-10">
                      Donia no cobra al creador. Tu aporte nos ayuda a que ayudar siga siendo gratis para todos.
                    </p>
                    
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[10, 15, 20].map(pct => (
                        <button 
                          key={pct}
                          onClick={() => setTipPercentage(pct)}
                          className={`py-3 rounded-xl text-xs font-black border transition-all ${tipPercentage === pct ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-sm'}`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-300 text-sm">$</span>
                      <input 
                        type="text"
                        className={`w-full pl-8 pr-4 py-3 border rounded-xl outline-none font-bold text-slate-700 text-sm focus:border-violet-300 transition-all ${
                          tipPercentage === 'custom' ? 'bg-white border-violet-200' : 'bg-slate-100 border-transparent text-slate-500'
                        }`}
                        placeholder="Monto personalizado"
                        value={tipGrossAmount > 0 ? tipGrossAmount.toLocaleString('es-CL') : ''}
                        onChange={(e) => handleManualTipChange(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                      type="email" 
                      required
                      className="w-full pl-11 px-5 py-4 bg-slate-50 border border-slate-100 focus:border-violet-200 focus:bg-white rounded-xl outline-none font-bold text-slate-900 transition-all text-sm"
                      placeholder="Correo para el comprobante"
                      value={donorEmail}
                      onChange={(e) => setDonorEmail(e.target.value)}
                    />
                  </div>

                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 focus:border-violet-200 focus:bg-white rounded-xl outline-none font-bold text-slate-900 transition-all text-sm"
                    placeholder="Tu nombre (opcional)"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                  />
                  
                  <textarea 
                    rows={3}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 focus:border-violet-200 focus:bg-white rounded-xl outline-none font-medium text-slate-600 resize-none transition-all text-sm"
                    placeholder="Deja un mensaje de ánimo..."
                    value={donorComment}
                    onChange={(e) => setDonorComment(e.target.value)}
                  />
                </div>

                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 text-rose-700 text-xs font-bold items-center animate-in slide-in-from-top-1">
                    <AlertCircle size={16} />
                    <p>{error}</p>
                  </div>
                )}

                <button 
                  onClick={handlePaymentRedirect}
                  disabled={redirecting}
                  className="w-full py-5 rounded-2xl font-black text-lg bg-violet-600 text-white hover:bg-violet-700 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-70"
                >
                  {redirecting ? <><Loader2 className="animate-spin" size={20} /> Conectando...</> : <>Ir al pago seguro <ArrowRight size={20} /></>}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 h-fit sticky top-24">
            <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-xl border border-violet-100">
              <h2 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
                <Receipt className="text-violet-600" size={24} />
                Resumen del aporte
              </h2>
              
              <div className="space-y-6 mb-10">
                <div className="flex justify-between items-start group">
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">DONACIÓN CAUSA</span>
                    <span className="text-slate-600 text-sm font-bold">100% íntegro para la historia</span>
                  </div>
                  <span className="font-black text-slate-900 text-xl">${donationAmount.toLocaleString('es-CL')}</span>
                </div>
                
                <div className="flex justify-between items-start group">
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">APOYO DONIA</span>
                    <span className="text-slate-600 text-sm font-bold">Operación de la plataforma</span>
                  </div>
                  <span className="font-black text-slate-900 text-xl">${tipGrossAmount.toLocaleString('es-CL')}</span>
                </div>

                <div className="flex justify-between items-start group">
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">COMISIÓN PASARELA DE PAGO</span>
                    <span className="text-slate-600 text-sm font-bold">Mercado Pago</span>
                  </div>
                  <span className="font-black text-slate-900 text-xl">${commissionAmount.toLocaleString('es-CL')}</span>
                </div>
              </div>
              
              <div className="pt-8 border-t-2 border-dashed border-slate-100 mb-2">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="font-black text-slate-400 uppercase text-[11px] tracking-[0.2em] mb-1 block">TOTAL FINAL</span>
                    <span className="text-5xl font-black text-slate-900 tracking-tighter">${totalAmountCalculated.toLocaleString('es-CL')}</span>
                  </div>
                  <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 flex items-center gap-2 mb-2">
                     <ShieldCheck size={14} className="text-emerald-600" />
                     <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">PROTEGIDO</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonatePage;