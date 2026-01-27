
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  MapPin, 
  Users, 
  ShieldCheck, 
  MessageCircle, 
  AlertCircle, 
  Calendar,
  Facebook,
  Twitter,
  Link as LinkIcon,
  Check,
  Loader2, 
  ArrowRight,
  X,
  MessageSquare,
  Heart,
  UserCheck,
  Clock,
  Timer,
  ChevronRight,
  XCircle,
  Instagram,
  User,
  Handshake,
  Building,
  PawPrint,
  Shield
} from 'lucide-react';
import { CampaignService } from '../services/CampaignService';
import { CampaignData, Donation } from '../types';

const InfoCard = ({ icon: Icon, label, value, subValue, colorClass }: any) => (
  <div className={`p-5 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-start gap-4 transition-all hover:border-slate-200`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
      <Icon size={20} />
    </div>
    <div className="overflow-hidden">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-sm font-bold text-slate-700 truncate">{value}</p>
      {subValue && <p className="text-[11px] text-slate-500 font-medium mt-0.5">{subValue}</p>}
    </div>
  </div>
);

const DestinationCard = ({ name, relation }: { name: string, relation: string }) => {
  const getRelationConfig = (rel: string) => {
    switch (rel) {
      case 'Yo mismo':
        return { icon: User, text: 'El creador de esta campaña', color: 'bg-violet-50 text-violet-600' };
      case 'Familiar':
        return { icon: Heart, text: 'Familiar directo del creador', color: 'bg-rose-50 text-rose-600' };
      case 'Amigo':
        return { icon: Handshake, text: 'Persona cercana al creador', color: 'bg-sky-50 text-sky-600' };
      case 'Organización':
        return { icon: Building, text: 'Organización declarada por el creador', color: 'bg-slate-50 text-slate-600' };
      case 'Mascota':
        return { icon: PawPrint, text: 'Fondos destinados a cuidados veterinarios', color: 'bg-emerald-50 text-emerald-600' };
      default:
        return { icon: UserCheck, text: 'Destinatario de los fondos', color: 'bg-slate-50 text-slate-600' };
    }
  };

  const config = getRelationConfig(relation);

  return (
    <div className="space-y-3">
      <div className="p-5 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-start gap-4 transition-all hover:border-slate-200">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${config.color}`}>
          <config.icon size={24} />
        </div>
        <div className="overflow-hidden">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Destino de los Fondos</p>
          <p className="text-lg font-black text-slate-900 truncate leading-tight">{name}</p>
          <p className="text-[11px] text-slate-500 font-bold mt-1 uppercase tracking-tight">{config.text}</p>
        </div>
      </div>
      <div className="px-4 py-3 bg-slate-50/50 rounded-xl border border-slate-100/50">
        <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic flex items-start gap-2">
          <AlertCircle size={12} className="shrink-0 mt-0.5 text-slate-400" />
          El creador de esta campaña declara que los fondos serán utilizados para este beneficiario.
        </p>
        <p className="text-[10px] text-slate-400 font-bold mt-2 flex items-center gap-1.5 uppercase tracking-tighter">
          <Shield size={10} className="text-violet-400" />
          Donia monitorea campañas y actúa ante reportes de uso indebido.
        </p>
      </div>
    </div>
  );
};

const VerifiedBadge = () => (
  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white shadow-sm">
      <ShieldCheck size={18} />
    </div>
    <div>
      <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Causa Verificada</p>
      <p className="text-[11px] font-bold text-emerald-600/80">Fondos protegidos por Donia</p>
    </div>
  </div>
);

const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const service = CampaignService.getInstance();

  const fetchDetail = async () => {
    if (id) {
      try {
        const result = await service.getCampaignById(id);
        setCampaign(result);
      } catch (err) {
        console.error("Error cargando detalle:", err);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const index = Math.round(scrollLeft / clientWidth);
      setCurrentImageIndex(index);
    }
  };

  const scrollToImage = (index: number) => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      scrollRef.current.scrollTo({ left: index * clientWidth, behavior: 'smooth' });
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2000);
    } catch (err) {
      console.error("Error al copiar:", err);
    }
  };

  const handleInstagramShare = async () => {
    if (navigator.share && campaign) {
      try {
        await navigator.share({
          title: campaign.titulo,
          text: `Apoya esta causa en Donia: ${campaign.titulo}`,
          url: window.location.href,
        });
      } catch (err) {
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <Loader2 className="w-10 h-10 text-violet-600 animate-spin mb-3" />
      <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cargando historia...</span>
    </div>
  );

  if (!campaign) return (
    <div className="py-20 text-center max-w-md mx-auto px-6">
      <AlertCircle size={32} className="mx-auto mb-4 text-slate-300" />
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Causa no encontrada</h2>
      <button onClick={() => navigate('/explorar')} className="text-violet-600 font-bold underline">Explorar otras causas</button>
    </div>
  );

  const isFinished = campaign.estado === 'finalizada';
  const isCancelled = campaign.estado === 'cancelada';
  const isPausada = campaign.estado === 'pausada';
  const isInactive = isFinished || isCancelled || isPausada;

  const progress = Math.min((campaign.recaudado / campaign.monto) * 100, 100);
  const totalDonations = campaign.donantesCount || campaign.donations?.length || 0;
  const donationList = campaign.donations || [];
  const limitedDonations = donationList.slice(0, 5);
  
  const campaignImages = Array.isArray(campaign.images) && campaign.images.length > 0 
    ? campaign.images 
    : [campaign.imagenUrl];

  const startDate = new Date(campaign.fechaCreacion);
  let daysLeft = 0;

  if (campaign.fechaTermino) {
    const now = new Date();
    const end = new Date(campaign.fechaTermino);
    const diffTime = end.getTime() - now.getTime();
    daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const monthName = startDate.toLocaleDateString('es-CL', { month: 'long' });

  return (
    <div className="bg-slate-50 min-h-screen pb-16 relative">
      <div className="max-w-6xl mx-auto px-4 pt-8">
        <button onClick={() => navigate('/explorar')} className="flex items-center gap-1.5 text-slate-400 hover:text-violet-600 font-bold mb-6 transition-colors group text-sm">
          <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" /> Volver a explorar
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-6 leading-tight tracking-tight">{campaign.titulo}</h1>
            
            {/* Carrusel de Imágenes */}
            <div className="relative rounded-[32px] overflow-hidden mb-8 shadow-xl bg-white border border-slate-100 group">
              <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
                style={{ scrollSnapType: 'x mandatory' }}
              >
                {campaignImages.map((img, idx) => (
                  <div key={idx} className="w-full shrink-0 snap-center aspect-video bg-slate-100">
                    <img src={img} alt={`Imagen ${idx + 1}`} className={`w-full h-full object-cover ${isInactive ? 'grayscale' : ''}`} />
                  </div>
                ))}
              </div>

              {campaignImages.length > 1 && (
                <>
                  <button 
                    onClick={() => scrollToImage(currentImageIndex - 1)}
                    disabled={currentImageIndex === 0}
                    className={`absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-slate-900 transition-all ${currentImageIndex === 0 ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button 
                    onClick={() => scrollToImage(currentImageIndex + 1)}
                    disabled={currentImageIndex === campaignImages.length - 1}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-slate-900 transition-all ${currentImageIndex === campaignImages.length - 1 ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}

              {campaignImages.length > 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                  {campaignImages.map((_, idx) => (
                    <button 
                      key={idx}
                      onClick={() => scrollToImage(idx)}
                      className={`h-1.5 rounded-full transition-all ${currentImageIndex === idx ? 'w-6 bg-white shadow-md' : 'w-1.5 bg-white/40'}`}
                    />
                  ))}
                </div>
              )}

              <div className="absolute top-4 left-4">
                <span className={`text-white font-black px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest shadow-md ${
                  isCancelled ? 'bg-rose-600' : 
                  isFinished ? 'bg-slate-600' : 
                  isPausada ? 'bg-amber-500' : 
                  'bg-violet-600'
                }`}>
                  {isCancelled ? 'Cancelada' : isFinished ? 'Finalizada' : isPausada ? 'Pausada' : campaign.categoria}
                </span>
              </div>
              
              {isInactive && (
                <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center p-6">
                   <div className="bg-white px-6 py-5 rounded-3xl shadow-2xl flex items-center gap-4 animate-in zoom-in duration-300">
                      {isCancelled ? <XCircle className="text-rose-500 w-10 h-10" /> : <Clock className="text-slate-500 w-10 h-10" />}
                      <div>
                        <p className="font-black text-slate-900 text-lg leading-tight">
                          {isCancelled ? 'Campaña Cancelada' : isPausada ? 'Campaña Pausada' : 'Campaña Finalizada'}
                        </p>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          {isCancelled ? 'El creador ha finalizado esta causa.' : isPausada ? 'Temporalmente no recibe aportes.' : 'Gracias a todos los que apoyaron.'}
                        </p>
                      </div>
                   </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl p-8 md:p-10 shadow-sm border border-slate-100 mb-8">
              <div className="flex flex-wrap gap-4 mb-8">
                 <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                    <Calendar size={16} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-600">
                       Activa desde el {startDate.getDate()} de {monthName}
                    </span>
                 </div>

                 {!isInactive && daysLeft > 0 && (
                   <div className="flex items-center gap-2 bg-violet-50 px-4 py-2 rounded-xl border border-violet-100">
                      <Timer size={16} className="text-violet-500" />
                      <span className="text-xs font-black text-violet-700">
                         {daysLeft === 1 ? '¡Último día!' : `Faltan ${daysLeft} días`}
                      </span>
                   </div>
                 )}
              </div>

              <div className="mb-10">
                <h2 className="text-xl font-black text-slate-900 mb-5 tracking-tight">La historia</h2>
                <div className="text-slate-600 leading-relaxed text-base whitespace-pre-wrap font-medium">
                  {campaign.historia}
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={20} className="text-emerald-500" />
                  <span className="text-slate-500 font-bold text-sm">Donación segura protegida por Donia</span>
                </div>
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200" />
                  ))}
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-violet-600 flex items-center justify-center text-[10px] text-white font-black">
                    +{totalDonations}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 md:p-10 shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <MessageCircle size={22} className="text-violet-600" />
                    Apoyo ({totalDonations})
                  </h2>
                </div>
                
                <div className="space-y-4">
                  {donationList.length > 0 ? (
                    <>
                      {limitedDonations.map((don: Donation) => (
                        <div key={don.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 transition-colors hover:bg-white hover:border-violet-100">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-violet-600 font-black text-xs border border-slate-100 shadow-sm uppercase">
                                {don.nombreDonante ? don.nombreDonante.charAt(0) : 'A'}
                              </div>
                              <div>
                                <p className="font-black text-slate-900 text-sm">{don.nombreDonante || 'Anónimo'}</p>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                  {new Date(don.fecha).toLocaleDateString('es-CL')}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                              +${don.monto?.toLocaleString('es-CL')}
                            </span>
                          </div>
                          {don.comentario && (
                            <p className="text-slate-600 text-base font-medium italic ml-14 border-l-2 border-slate-200 pl-4">
                              "{don.comentario}"
                            </p>
                          )}
                        </div>
                      ))}
                      
                      {totalDonations > 5 && (
                        <button 
                          onClick={() => setShowAllMessages(true)}
                          className="w-full py-5 mt-2 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-black text-xs uppercase tracking-widest hover:border-violet-300 transition-all flex items-center justify-center gap-2"
                        >
                          Ver los {totalDonations} mensajes <ArrowRight size={16} />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <MessageSquare className="mx-auto text-slate-200 mb-3" size={40} />
                      <p className="text-slate-400 font-bold text-base">Aún no hay mensajes.</p>
                    </div>
                  )}
                </div>
            </div>
          </div>

          <div className="lg:sticky lg:top-24 h-fit space-y-6">
            <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-xl shadow-slate-200/50 border border-slate-100">
              <div className="mb-8">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <span className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-1.5 block">Recaudado</span>
                    <span className="text-3xl font-black text-slate-900">${campaign.recaudado.toLocaleString('es-CL')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-1.5 block">Meta</span>
                    <span className="text-base font-bold text-slate-500">${campaign.monto.toLocaleString('es-CL')}</span>
                  </div>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full shadow-inner ${
                    isCancelled ? 'bg-rose-400' : 
                    isFinished ? 'bg-slate-400' : 
                    isPausada ? 'bg-amber-400' :
                    'bg-gradient-to-r from-violet-600 to-sky-400'
                  }`} style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="space-y-6">
                <button 
                  onClick={() => !isInactive && navigate(`/campana/${campaign.id}/donar`)}
                  disabled={isInactive}
                  className={`w-full py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95 ${
                     isInactive 
                     ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                     : 'bg-violet-600 text-white hover:bg-violet-700 shadow-violet-100'
                  }`}
                >
                  {isCancelled ? 'Campaña Cancelada' : isPausada ? 'Campaña Pausada' : isFinished ? 'Campaña Finalizada' : 'Contribuir ahora'}
                </button>

                <div className="pt-8 border-t border-slate-100 space-y-4">
                  <VerifiedBadge />
                  
                  {/* Nueva Card de Destino de los Fondos */}
                  <DestinationCard 
                    name={campaign.beneficiarioNombre + " " + (campaign.beneficiarioApellido || "")}
                    relation={campaign.beneficiarioRelacion || "Yo mismo"}
                  />

                  <InfoCard 
                    icon={MapPin}
                    label="Ubicación"
                    value={campaign.ubicacion}
                    colorClass="bg-sky-50 text-sky-600"
                  />
                  <InfoCard 
                    icon={Users}
                    label="Comunidad"
                    value={`${campaign.donantesCount} donantes`}
                    colorClass="bg-slate-50 text-slate-600"
                  />

                  <div className="pt-4">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Compartir</span>
                    <div className="flex gap-3">
                      <button onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(campaign.titulo + " " + window.location.href)}`, '_blank')} className="flex-1 aspect-square bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all" title="Compartir en WhatsApp"><MessageCircle size={20} /></button>
                      <button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank')} className="flex-1 aspect-square bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all" title="Compartir en Facebook"><Facebook size={20} /></button>
                      <button onClick={handleInstagramShare} className="flex-1 aspect-square bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center hover:bg-pink-600 hover:text-white transition-all" title="Compartir en Instagram"><Instagram size={20} /></button>
                      <button onClick={copyToClipboard} className={`flex-1 aspect-square rounded-xl flex items-center justify-center transition-all ${shareStatus === 'copied' ? 'bg-emerald-600 text-white' : 'bg-violet-50 text-violet-600 hover:bg-violet-600'}`} title="Copiar enlace">{shareStatus === 'copied' ? <Check size={20} /> : <LinkIcon size={20} />}</button>
                    </div>
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

export default CampaignDetail;
