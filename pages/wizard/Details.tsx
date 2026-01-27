
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  DollarSign, 
  Image as ImageIcon, 
  UserCheck, 
  ShieldCheck, 
  Loader2, 
  AlertCircle, 
  RefreshCcw, 
  Calendar, 
  Clock, 
  Plus, 
  X, 
  Star,
  Info,
  User,
  Heart,
  Handshake,
  Building,
  PawPrint
} from 'lucide-react';
import { useCampaign } from '../../context/CampaignContext';
import { ProgressBar } from '../../components/ProgressBar';
import { CampaignService } from '../../services/CampaignService';

const RELATION_HELPERS: Record<string, { text: string, icon: any }> = {
  'Yo mismo': { text: 'Los fondos se transferirán directamente al creador de la campaña.', icon: User },
  'Familiar': { text: 'El creador recibirá los fondos y se compromete a entregarlos al beneficiario.', icon: Heart },
  'Amigo': { text: 'El creador recibirá los fondos y se compromete a entregarlos al beneficiario.', icon: Handshake },
  'Organización': { text: 'El creador recibirá los fondos y se compromete a entregarlos a la organización declarada.', icon: Building },
  'Mascota': { text: 'Los fondos están destinados estrictamente a gastos veterinarios y cuidados.', icon: PawPrint }
};

const CreateDetails: React.FC = () => {
  const navigate = useNavigate();
  const { campaign, updateCampaign } = useCampaign();
  const service = CampaignService.getInstance();
  
  const [formData, setFormData] = useState({
    titulo: campaign.titulo || '',
    monto: campaign.monto || 0,
    categoria: campaign.categoria || 'Salud',
    beneficiarioNombre: campaign.beneficiarioNombre || '',
    beneficiarioApellido: campaign.beneficiarioApellido || '',
    beneficiarioRelacion: campaign.beneficiarioRelacion || 'Yo mismo',
    imagenUrl: campaign.imagenUrl || '',
    images: campaign.images || [],
    duracionDias: campaign.duracionDias || 60
  });

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    updateCampaign({ ...formData });
  }, [formData]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (formData.images.length >= 4) {
      setUploadError("Ya has alcanzado el máximo de 4 imágenes.");
      return;
    }

    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("La imagen es muy pesada. El máximo permitido es 5MB.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;
        const url = await service.uploadImage(base64, file.name);
        
        const newImages = [...formData.images, url];
        setFormData(prev => ({ 
          ...prev, 
          images: newImages,
          imagenUrl: prev.imagenUrl || url 
        }));
      } catch (err: any) {
        setUploadError("No pudimos subir la imagen. Inténtalo de nuevo.");
      } finally {
        setUploading(false);
      }
    };
  };

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    let newPrimary = formData.imagenUrl;
    
    if (formData.images[index] === formData.imagenUrl) {
      newPrimary = newImages.length > 0 ? newImages[0] : '';
    }
    
    setFormData(prev => ({ ...prev, images: newImages, imagenUrl: newPrimary }));
  };

  const setPrimaryImage = (url: string) => {
    setFormData(prev => ({ ...prev, imagenUrl: url }));
  };

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\./g, '').replace(/\D/g, '');
    const numberValue = rawValue === '' ? 0 : parseInt(rawValue, 10);
    setFormData(prev => ({ ...prev, monto: numberValue }));
  };

  const handleNext = () => {
    updateCampaign({ ...formData });
    navigate('/crear/revisar');
  };

  const isValid = formData.titulo.trim().length > 5 && 
                  formData.monto >= 500 && 
                  formData.beneficiarioNombre.trim().length >= 2 &&
                  formData.beneficiarioApellido.trim().length >= 2 &&
                  formData.images.length > 0;

  const currentHelper = RELATION_HELPERS[formData.beneficiarioRelacion] || RELATION_HELPERS['Yo mismo'];

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <ProgressBar currentStep={3} totalSteps={4} />

      <button 
        onClick={() => navigate('/crear/historia')}
        className="flex items-center gap-1 text-slate-400 hover:text-violet-600 mb-8 transition-colors font-black"
      >
        <ChevronLeft size={20} /> Volver
      </button>

      <div className="mb-10">
        <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Fotos y Detalles</h1>
        <p className="text-slate-500 font-medium text-lg">La precisión en los datos genera más confianza en tus donantes.</p>
      </div>

      <div className="space-y-8">
        {/* Galería de Imágenes */}
        <div className="bg-white p-8 rounded-[32px] border-2 border-slate-100 shadow-sm">
          <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Galería de fotos (Hasta 4)</label>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {formData.images.map((url, idx) => (
              <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden group border border-slate-100 shadow-sm">
                <img src={url} className="w-full h-full object-cover" alt={`Foto ${idx + 1}`} />
                <button 
                  onClick={() => removeImage(idx)}
                  className="absolute top-2 right-2 bg-rose-500 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Eliminar foto"
                >
                  <X size={14} />
                </button>
                {formData.imagenUrl === url ? (
                  <div className="absolute bottom-2 left-2 bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                    <Star size={8} fill="currentColor" /> Principal
                  </div>
                ) : (
                  <button 
                    onClick={() => setPrimaryImage(url)}
                    className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm text-slate-900 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Marcar principal
                  </button>
                )}
              </div>
            ))}
            
            {formData.images.length < 4 && (
              <button 
                onClick={() => !uploading && fileInputRef.current?.click()}
                disabled={uploading}
                className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                  uploading ? 'bg-slate-50 border-slate-200' : 'bg-slate-50 border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-400 hover:text-violet-600'
                }`}
              >
                {uploading ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  <>
                    <Plus size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest mt-2">Añadir</span>
                  </>
                )}
              </button>
            )}
          </div>
          
          <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png" onChange={handleImageChange} />
          {uploadError && <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold flex items-center gap-3 border border-rose-100">{uploadError}</div>}
        </div>

        {/* Detalles de la Campaña */}
        <div className="bg-white p-8 rounded-[32px] border-2 border-slate-100 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="md:col-span-2">
              <label htmlFor="campaign-title" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Título de la campaña</label>
              <input
                id="campaign-title"
                type="text"
                className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-900"
                placeholder="Ej: Ayudemos a Juan en su tratamiento"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              />
            </div>
            
            <div className="md:col-span-2">
              <label htmlFor="campaign-category" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Categoría</label>
              <select
                id="campaign-category"
                className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-900"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
              >
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-4">
            <div>
              <label htmlFor="campaign-amount" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Monto objetivo (CLP)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400"><DollarSign size={18} /></div>
                <input
                  id="campaign-amount"
                  type="text"
                  className="w-full pl-10 p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-900"
                  placeholder="0"
                  value={formData.monto > 0 ? formData.monto.toLocaleString('es-CL') : ''}
                  onChange={handleMontoChange}
                />
              </div>
            </div>
             <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Duración de la campaña</label>
                <div className="grid grid-cols-3 gap-3">
                   {[30, 60, 90].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setFormData({ ...formData, duracionDias: days })}
                        className={`py-3 rounded-2xl font-black transition-all border-2 flex flex-col items-center justify-center gap-0.5 ${
                           formData.duracionDias === days ? 'bg-violet-600 border-violet-600 text-white shadow-md' : 'bg-slate-50 border-slate-50 text-slate-400 hover:bg-white'
                        }`}
                      >
                         <span className="text-lg leading-none">{days}</span>
                         <span className="text-[10px] uppercase tracking-widest">Días</span>
                      </button>
                   ))}
                </div>
             </div>
          </div>
        </div>

        {/* Transparencia: Información del Beneficiario */}
        <div className="bg-white p-8 rounded-[32px] border-2 border-slate-100 shadow-sm">
           <div className="flex items-center gap-3 mb-6">
              <ShieldCheck size={24} className="text-violet-600" />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Destino de los Fondos</h2>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
              <div>
                 <label htmlFor="beneficiary-name" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Nombre</label>
                 <div className="relative">
                    <UserCheck size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                       id="beneficiary-name"
                       type="text"
                       className="w-full pl-10 p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-900"
                       placeholder="Nombre"
                       value={formData.beneficiarioNombre}
                       onChange={(e) => setFormData({ ...formData, beneficiarioNombre: e.target.value })}
                    />
                 </div>
              </div>
              <div>
                 <label htmlFor="beneficiary-lastname" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Apellido</label>
                 <input
                    id="beneficiary-lastname"
                    type="text"
                    className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white rounded-2xl outline-none font-bold text-slate-900"
                    placeholder="Apellido"
                    value={formData.beneficiarioApellido}
                    onChange={(e) => setFormData({ ...formData, beneficiarioApellido: e.target.value })}
                 />
              </div>
           </div>
           
           <div>
              <label htmlFor="beneficiary-relation" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Tu relación con el beneficiario</label>
              <select
                 id="beneficiary-relation"
                 className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-violet-200 focus:bg-white rounded-2xl transition-all outline-none font-bold text-slate-900"
                 value={formData.beneficiarioRelacion}
                 onChange={(e) => setFormData({ ...formData, beneficiarioRelacion: e.target.value })}
              >
                 <option value="Yo mismo">Yo mismo</option>
                 <option value="Familiar">Familiar</option>
                 <option value="Amigo">Amigo</option>
                 <option value="Organización">Organización</option>
                 <option value="Mascota">Mascota</option>
              </select>
              
              {/* Helper Dinámico */}
              <div className="mt-4 p-5 bg-violet-50 border border-violet-100 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-1">
                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-violet-600 shadow-sm shrink-0">
                    <currentHelper.icon size={20} />
                 </div>
                 <div className="pt-1">
                    <p className="text-sm font-bold text-violet-900 leading-tight">{currentHelper.text}</p>
                    <p className="text-[10px] text-violet-700/60 font-medium mt-1 uppercase tracking-wider">Aviso de responsabilidad del creador</p>
                 </div>
              </div>
           </div>
        </div>

        <button 
          disabled={!isValid || uploading}
          onClick={handleNext}
          className={`w-full py-5 rounded-[24px] font-black text-xl transition-all flex items-center justify-center gap-3 shadow-2xl ${isValid && !uploading ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-violet-100' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
        >
          Revisar y Publicar <ChevronRight className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default CreateDetails;
