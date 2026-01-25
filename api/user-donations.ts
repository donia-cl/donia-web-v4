import { createClient } from '@supabase/supabase-js';
import { logger } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  const { userId } = req.query;

  if (!userId) {
    // Fix: Use logger.warn for missing user ID in a request, as it might be an expected client behavior.
    logger.warn('GET_USER_DONATIONS_MISSING_USERID', { query: req.query });
    return res.status(400).json({ error: 'User ID is required' });
  }

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    logger.error('GET_USER_DONATIONS_SUPABASE_CONFIG_MISSING', new Error('Configuración incompleta en servidor'));
    return res.status(500).json({ error: 'Configuración incompleta en servidor' });
  }
  
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: authUser, error: authError } = await (supabase.auth as any).admin.getUserById(userId);
    
    // Fix: Ensure logger.error receives an Error object, handling cases where authError might be null/undefined.
    if (authError || !authUser) {
      logger.error('GET_USER_DONATIONS_AUTH_USER_NOT_FOUND', authError || new Error("User not found or authentication error."), { userId });
      throw new Error("No se pudo verificar la identidad del usuario.");
    }

    const userEmail = authUser.user.email;

    let query = supabase.from('donations').select('*');
    
    // Buscar por ID de usuario O por email (para donaciones anónimas con email registrado)
    if (userEmail) {
      query = query.or(`donor_user_id.eq.${userId},donor_email.eq.${userEmail}`);
    } else {
      query = query.eq('donor_user_id', userId);
    }

    const { data: donationsData, error: dError } = await query.order('fecha', { ascending: false });

    if (dError) {
      logger.error('GET_USER_DONATIONS_DB_ERROR', dError, { userId });
      throw dError;
    }

    if (!donationsData || donationsData.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const campaignIds = [...new Set(donationsData.map((d: any) => d.campaign_id).filter(Boolean))];

    let campaignsMap: Record<string, any> = {};

    if (campaignIds.length > 0) {
      const { data: campaignsData, error: cError } = await supabase
        .from('campaigns')
        .select('id, titulo, imagen_url, beneficiario_nombre')
        .in('id', campaignIds);
        
      if (cError) {
        // Fix: Use logger.warn for issues fetching campaign details, as donations might still be valid.
        logger.warn('GET_USER_DONATIONS_CAMPAIGN_DETAILS_FETCH_ERROR', cError, { campaignIds });
      } else if (campaignsData) {
        campaignsData.forEach((c: any) => {
          campaignsMap[c.id] = c;
        });
      }
    }

    const donations = donationsData.map((d: any) => {
      const campaign = campaignsMap[d.campaign_id] || {};
      
      return {
        id: d.id,
        campaignId: d.campaign_id,
        monto: d.monto, // Campo legacy, se mantiene por compatibilidad
        amountCause: d.amount_cause || d.monto,
        amountTip: d.amount_tip || 0,
        amountFee: d.amount_fee || 0,
        amountTotal: d.amount_total || d.monto,
        fecha: d.fecha || d.created_at,
        nombreDonante: d.nombre_donante,
        emailDonante: d.donor_email,
        comentario: d.comentario,
        status: d.status || 'completed',
        paymentId: d.payment_id,
        campaign: {
          titulo: campaign.titulo || 'Campaña no disponible',
          imagenUrl: campaign.imagen_url || 'https://picsum.photos/200/200',
          beneficiarioNombre: campaign.beneficiario_nombre
        }
      };
    });

    return res.status(200).json({ success: true, data: donations });
  } catch (error: any) {
    logger.error("GET_USER_DONATIONS_FATAL_ERROR", error, { userId });
    return res.status(500).json({ success: false, error: error.message, data: [] });
  }
}