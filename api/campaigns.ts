
import { createClient } from '@supabase/supabase-js';
import { Validator, logger, calculateEffectiveStatus, Mailer } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ success: false, error: 'Configuración del servidor incompleta.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { id } = req.query;

    if (req.method === 'GET') {
      if (id) {
        Validator.uuid(id, 'id');
        const { data: campaign, error: cError } = await supabase.from('campaigns_with_status').select('*').eq('id', id).single();
        if (cError) return res.status(404).json({ success: false, error: 'Campaña no encontrada.' });
        const { data: donations } = await supabase.from('donations').select('*').eq('campaign_id', id).order('fecha', { ascending: false }).limit(50);
        return res.status(200).json({ success: true, data: { ...campaign, estado: campaign.effective_status, donations: donations || [] } });
      } else {
        const { data, error } = await supabase.from('campaigns_with_status').select('*').order('fecha_creacion', { ascending: false });
        if (error) throw error;
        return res.status(200).json({ success: true, data: (data || []).map(c => ({ ...c, estado: c.effective_status })) });
      }
    }

    if (req.method === 'POST') {
      const { 
        titulo, historia, monto, categoria, 
        imagenUrl, images, beneficiarioNombre, beneficiarioApellido, 
        owner_id, duracionDias, beneficiarioRelacion 
      } = req.body;
      
      Validator.required(owner_id, 'owner_id');
      Validator.string(titulo, 5, 'titulo');
      Validator.number(monto, 1000, 'monto');

      const [{ data: profile }, { data: authUser }] = await Promise.all([
        supabase.from('profiles').select('region, city, full_name').eq('id', owner_id).single(),
        (supabase.auth as any).admin.getUserById(owner_id)
      ]);

      const finalCity = profile?.city || '';
      const finalRegion = profile?.region || '';
      const finalLocation = finalCity && finalRegion ? `${finalCity}, ${finalRegion}` : (finalRegion || 'Chile');
      
      const duracion = Number(duracionDias || 60);
      const fechaCreacion = new Date();
      const fechaTermino = new Date(fechaCreacion);
      fechaTermino.setDate(fechaTermino.getDate() + duracion);

      const finalGallery = Array.isArray(images) && images.length > 0 ? images : (imagenUrl ? [imagenUrl] : []);
      const finalPrimary = imagenUrl || (finalGallery.length > 0 ? finalGallery[0] : '');

      const { data, error } = await supabase.from('campaigns').insert([{ 
        titulo, historia, monto: Number(monto), categoria, ubicacion: finalLocation, ciudad: finalCity,
        imagen_url: finalPrimary, gallery_urls: finalGallery, beneficiario_nombre: beneficiarioNombre, 
        beneficiario_apellido: beneficiarioApellido, beneficiario_relacion: beneficiarioRelacion || 'Yo mismo',
        owner_id, recaudado: 0, donantes_count: 0, estado: 'activa',
        duracion_dias: duracion, fecha_termino: fechaTermino.toISOString()
      }]).select();
      
      if (error) throw error;

      // AWAIT PARA NOTIFICACIÓN DE CREACIÓN
      if (authUser?.user?.email) {
        try {
          await Mailer.sendCampaignCreatedNotification(
            authUser.user.email,
            profile?.full_name || 'Creador',
            titulo,
            data[0].id,
            req
          );
        } catch (e) {
          logger.error('CREATE_CAMPAIGN_MAIL_ERROR', e);
        }
      }

      return res.status(201).json({ success: true, data: data[0] });
    }

    return res.status(405).end();
  } catch (error: any) {
    logger.error('CAMPAIGNS_API_ERROR', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
