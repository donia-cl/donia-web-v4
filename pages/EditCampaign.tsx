
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  Save, 
  Wand2, 
  Loader2, 
  Image as ImageIcon, 
  AlertCircle, 
  RefreshCcw,
  CheckCircle,
  Layout,
  FileText,
  ShieldCheck,
  DollarSign,
  UserCheck,
  Settings,
  Sparkles,
  Check,
  Zap,
  Heart,
  X,
  Plus,
  Star
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CampaignService } from '../services/CampaignService';
import { CampaignData } from '../types';

const ComparisonModal = ({ original, polished, onAccept, onClose, isProcessing }: any) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
    <div className="bg-white w-full max-w-5xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 relative">
      <button onClick={onClose} className="absolute top-6 right-6 z-20 w-10 h-10 bg-white/80 backdrop-blur-sm border border-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm">
        <X size={20} />
      </button>

      <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-violet-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><Sparkles size={24} /></div>
          <div className="pr-4 md:pr-0">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Propuesta de optimización</h3>
            <p className="text-slate-500 font-medium text-sm">Mejorando la estructura y el impacto de tu relato.</p>
          </div>
        </div>
        {/* Espacio reservado para el botón X en desktop */}
        <div className="md:pr-12"></div>
      </div>
      <div className="flex-grow overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Versión Actual</span>
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-slate-500 text-sm italic min-h-[300px]">{original}</div>
          </div>
          <div className="space-y-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-violet-500 flex items-center gap-2"><Zap size={12} className="fill-current" /> Propuesta de la IA</span>
            <div className="p-6 bg-violet-50/30 rounded-3xl border border-violet-100 text-slate-800 text-base font-medium leading-relaxed min-h-[300px]">
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
                   <Loader2 size={32} className="text-violet-600 animate-spin" />
                   <p className="text-violet-600 font-black text-xs uppercase tracking-widest">Generando mejoras...</p>
                </div>
              ) : polished}
            </div>
          </div>
        </div>
      </div>
      <div className="p-8 border-t border-slate-100 flex gap-4 justify-end items-center bg-white">
        <button onClick={onClose} className="px-8 py-4 text-slate-400 font-black text-xs uppercase tracking-widest">Cancelar</button>
        <button onClick={onAccept} disabled={isProcessing || !polished} className="bg-violet-600 text-white px-10 py-4 rounded-2xl font-black hover:bg-violet-700 transition-all flex items-center gap-2">Aplicar cambios <Check size={20} /></button>
      </div>
    </div>
  </div>
);

const EditCampaign: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const service = CampaignService.getInstance();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [polishedProposal, setPolishedProposal] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    titulo: '',
    historia: '',
    monto: 0,
    categoria: 'Salud',
    beneficiarioNombre: '',
    beneficiarioRelacion: 'Yo mismo',
    imagenUrl: '',
    images: [] as string[]
  });

  useEffect(() => {
    if (!authLoading && !user) { navigate('/login'); return; }
    if (id && user) loadCampaign();
  }, [id, user, authLoading]);

  const loadCampaign = async () => {
    setLoading(true);
    try {
      const data = await service.getCampaignById(id!);
      if (!data) { setError("Campaña no encontrada"); return; }
      setFormData({
        titulo: data.titulo,
        historia: data.historia,
        monto: data.monto,
        categoria: data.categoria,
        beneficiarioNombre: data.beneficiarioNombre || '',
        beneficiarioRelacion: data.beneficiarioRelacion || 'Yo mismo',
        imagenUrl: data.imagenUrl,
        images: data.images || [data.imagenUrl]
      });
    } catch (e) {
      setError("Error al cargar los datos.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (formData.images.length >= 4) {
      setError("Máximo 4 fotos permitidas.");
      return;
    }

    setUploading(true);
    setError(null);
    const reader = new FileReader();
    reader.readAsDataURL(files[0]);
    reader.onloadend = async () => {
      try {
        const url = await service.uploadImage(reader.result as string, files[0].name);
        const newImages = [...formData.images, url];
        setFormData(prev => ({ 
          ...prev, 
          images: newImages,
          imagenUrl: prev.imagenUrl || url 
        }));
      } catch (err) {
        setError("Error al subir imagen.");
      } finally {
        setUploading(false);
      }
    };
  };

  const removeImage = (idx: number) => {
    const newImages = formData.images.filter((_, i) => i !== idx);
    let newPrimary = formData.imagenUrl;
    if (formData.images[idx] === formData.imagenUrl) {
      newPrimary = newImages.length > 0 ? newImages[0] : '';
    }
    setFormData({ ...formData, images: newImages, imagenUrl: newPrimary });
  };

  const handleSave = async () => {
    if (!id || !user) return;
    setSaving(true);
    setError(null);
    try {
      await service.updateCampaign(id, user.id, {
        ...formData,
        monto: Number(formData.monto)
      });
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 2500);
    } catch (e: any) {
      setError(e.message || "Error al guardar.");
      setSaving(false);
    }
  };

  if (loading) return <div className="flex flex-col items-center justify-center min-h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-violet-600 mb-4" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 relative">
      {showAiModal && (
        <ComparisonModal 
          original={formData.historia} polished={polishedProposal}
          onAccept={() => { setFormData({ ...formData, historia: polishedProposal }); setShowAiModal(false); }}
          onClose={() => setShowAiModal(false)} isProcessing={isAiProcessing}
        />
      )}

      {/* Mensaje de Éxito Flotante */}
      {success && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-8 duration-500">
           <div className="bg-emerald-500 text-white px-8 py-4 rounded-[24px] shadow-2xl flex items-center gap-3 border border-emerald-400">
              <CheckCircle size={24} />
              <div className="text-left">
                <p className="font-black uppercase tracking-widest text-xs">Cambios guardados</p>
                <p className="text-[10px] opacity-90 font-bold">Tu campaña ha sido actualizada correctamente.</p>
              </div>
           </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-12">
        <button onClick={() => navigate('/dashboard')} className="text-slate-400 font-black uppercase text-xs tracking-widest flex items-center gap-2 hover:text-slate-600 transition-colors"><ChevronLeft size={20} /> Descartar</button>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Editar Campaña</h1>
      </div>

      <div className="space-y-8">
        <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm">
           <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Galería de fotos (Hasta 4)</label>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {formData.images.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden group border border-slate-100 shadow-sm">
                  <img src={url} className="w-full h-full object-cover" alt="" />
                  <button onClick={() => removeImage(idx)} className="absolute top-2 right-2 bg-rose-500 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                  {formData.imagenUrl === url ? (
                    <div className="absolute bottom-2 left-2 bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><Star size={8} fill="currentColor" /> Principal</div>
                  ) : (
                    <button onClick={() => setFormData({...formData, imagenUrl: url})} className="absolute bottom-2 left-2 bg-white/90 px-2 py-0.5 rounded-full text-[8px] font-black uppercase opacity-0 group-hover:opacity-100">Principal</button>
                  )}
                </div>
              ))}
              {formData.images.length < 4 && (
                <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:border-violet-300 transition-all">
                  {uploading ? <Loader2 className="animate-spin" /> : <><Plus size={24} /><span className="text-[10px] font-black mt-2">Subir</span></>}
                </button>
              )}
           </div>
           <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
        </div>

        <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm">
           <div className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Título</label>
                <input type="text" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-900" value={formData.titulo} onChange={(e) => setFormData({ ...formData, titulo: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Monto Meta (CLP)</label>
                  <input type="text" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white rounded-2xl outline-none font-bold" value={formData.monto.toLocaleString('es-CL')} onChange={(e) => {
                    const val = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                    setFormData({...formData, monto: val});
                  }} />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Categoría</label>
                  <select className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white rounded-2xl outline-none font-bold" value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}>
                    <option value="Salud">Salud</option>
                    <option value="Emergencias">Emergencias</option>
                    <option value="Mascotas">Mascotas</option>
                    <option value="Educación">Educación</option>
                    <option value="Apoyo familiar">Apoyo familiar</option>
                    <option value="Vivienda">Vivienda</option>
                    <option value="Comunidad">Comunidad</option>
                    <option value="Funerales">Funerales</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-4">
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">La Historia</label>
                   <button onClick={() => { setIsAiProcessing(true); setShowAiModal(true); service.polishStory(formData.historia).then(setPolishedProposal).finally(() => setIsAiProcessing(false)); }} className="text-[10px] font-black text-violet-600 uppercase tracking-widest hover:underline">Pulir con IA</button>
                </div>
                <textarea rows={8} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white rounded-[32px] outline-none font-medium leading-relaxed resize-none" value={formData.historia} onChange={(e) => setFormData({ ...formData, historia: e.target.value })} />
              </div>
           </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in shake duration-300">
            <AlertCircle size={20} />
            <p>{error}</p>
          </div>
        )}

        <div className="flex gap-4 pt-4 pb-20">
           <button 
             disabled={saving || success || !formData.titulo} 
             onClick={handleSave} 
             className={`w-full py-5 rounded-[24px] font-black text-xl transition-all flex items-center justify-center gap-3 shadow-xl ${
               success ? 'bg-emerald-500 text-white cursor-default' : 'bg-violet-600 text-white hover:bg-violet-700 active:scale-95 disabled:opacity-50'
             }`}
           >
             {saving ? <Loader2 className="animate-spin" size={24} /> : success ? <><Check size={24} /> ¡Guardado!</> : <><Save size={24} /> Guardar cambios</>}
           </button>
        </div>
      </div>
    </div>
  );
};

export default EditCampaign;
