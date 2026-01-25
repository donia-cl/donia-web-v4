
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Search, ArrowUpRight, Clock, XCircle } from 'lucide-react';
import { CampaignService } from '../services/CampaignService';
import { CampaignData } from '../types';

const ExploreCard: React.FC<{ campaign: CampaignData }> = ({ campaign }) => {
  const isFinished = campaign.estado === 'finalizada';
  const isCancelled = campaign.estado === 'cancelada';
  const isPausada = campaign.estado === 'pausada';
  const isInactive = isFinished || isCancelled || isPausada;
  
  const progress = Math.min((campaign.recaudado / campaign.monto) * 100, 100);
  
  return (
    <Link 
      to={`/campana/${campaign.id}`} 
      className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-xl transition-all group flex flex-col h-full ${isInactive ? 'opacity-80' : ''}`} 
      aria-label={`Ver detalles de la campaña: ${campaign.titulo}`}
    >
      <div className="relative h-48 overflow-hidden">
        <img 
          src={campaign.imagenUrl} 
          alt={campaign.titulo} 
          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isInactive ? 'grayscale opacity-50' : ''}`} 
        />
        <div className="absolute top-4 left-4 flex gap-2">
          <span className={`${isInactive ? 'bg-slate-600' : 'bg-violet-600'} text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg`}>
            {campaign.categoria}
          </span>
          {isFinished && (
            <span className="bg-white text-slate-900 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1">
              <Clock size={10} /> FINALIZADA
            </span>
          )}
          {isCancelled && (
            <span className="bg-rose-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1">
              <XCircle size={10} /> CANCELADA
            </span>
          )}
          {isPausada && (
            <span className="bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1">
              <Clock size={10} /> PAUSADA
            </span>
          )}
        </div>
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-white p-2 rounded-full shadow-lg">
            <ArrowUpRight className="text-violet-600" />
          </div>
        </div>
      </div>
      <div className="p-6 flex-grow flex flex-col">
        <div className="flex items-center gap-1 text-slate-400 text-xs mb-2 font-medium">
          <MapPin size={12} className="text-violet-400" />
          <span>{campaign.ubicacion}</span>
        </div>
        <h3 className={`text-xl font-bold text-slate-900 mb-3 line-clamp-2 min-h-[3.5rem] group-hover:text-violet-600 transition-colors ${isInactive ? 'text-slate-500' : ''}`}>
          {campaign.titulo}
        </h3>
        
        <div className="mt-auto">
          <div className="flex justify-between text-sm mb-2">
            <span className={`font-bold ${isInactive ? 'text-slate-500' : 'text-violet-600'}`}>
              ${campaign.recaudado.toLocaleString('es-CL')}
            </span>
            <span className="text-slate-400 font-medium">meta: ${campaign.monto.toLocaleString('es-CL')}</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div 
              className={`h-full rounded-full ${
                isCancelled ? 'bg-rose-300' : 
                isFinished ? 'bg-slate-300' : 
                isPausada ? 'bg-amber-300' : 
                'bg-violet-600'
              }`} 
              style={{ width: `${progress}%` }} 
            />
          </div>
          <div className={`w-full py-2.5 text-center font-bold rounded-xl transition-all ${
            isInactive 
            ? 'bg-slate-100 text-slate-500' 
            : 'bg-slate-50 text-slate-700 group-hover:bg-violet-600 group-hover:text-white'
          }`}>
            {isInactive ? 'Ver historia' : 'Ayudar ahora'}
          </div>
        </div>
      </div>
    </Link>
  );
};

const Explore: React.FC = () => {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const service = CampaignService.getInstance();

  useEffect(() => {
    const load = async () => {
      const data = await service.getCampaigns();
      
      // Ordenar: primero las activas, luego las inactivas (finalizadas, canceladas, pausadas)
      const sortedData = [...data].sort((a, b) => {
        const aInactive = a.estado === 'finalizada' || a.estado === 'cancelada' || a.estado === 'pausada';
        const bInactive = b.estado === 'finalizada' || b.estado === 'cancelada' || b.estado === 'pausada';
        if (aInactive && !bInactive) return 1;
        if (!aInactive && bInactive) return -1;
        return 0;
      });

      setCampaigns(sortedData);
      setLoading(false);
    };
    load();
  }, []);

  const filteredCampaigns = campaigns.filter(c => 
    c.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Explorar causas</h1>
          <p className="text-slate-600 font-medium">Apoya una de las {campaigns.length} campañas en Donia.</p>
        </div>
        
        <div className="relative max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} aria-hidden="true" />
          <input 
            type="text" 
            placeholder="Buscar por título o categoría..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-violet-500 outline-none transition-all shadow-sm font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Campo de búsqueda de campañas"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8" role="status" aria-label="Cargando campañas">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-slate-100 h-96 rounded-3xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredCampaigns.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredCampaigns.map(c => <ExploreCard key={c.id} campaign={c} />)}
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200" role="status" aria-live="polite">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-300">
            <Search size={32} aria-hidden="true" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-1">No encontramos resultados</h3>
          <p className="text-slate-500 mb-6 font-medium">Prueba con otros términos de búsqueda.</p>
          <button onClick={() => setSearchTerm('')} className="text-violet-600 font-bold hover:underline" aria-label="Ver todas las campañas">Ver todas las campañas</button>
        </div>
      )}
    </div>
  );
};

export default Explore;
