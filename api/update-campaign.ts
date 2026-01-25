
import { createClient } from '@supabase/supabase-js';
import { Mailer, logger, Validator } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, userId, updates } = req.body;
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ success: false, error: 'Configuración del servidor incompleta.' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    Validator.uuid(id, 'campaign_id');
    Validator.required(userId, 'userId');

    // 1. Validar propiedad
    const { data: campaign } = await supabase.from('campaigns').select('owner_id, titulo, estado').eq('id', id).single();
    if (!campaign || campaign.owner_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to edit this campaign' });
    }

    const dbUpdates: any = { ...updates };
    if (updates.imagenUrl) { dbUpdates.imagen_url = updates.imagenUrl; delete dbUpdates.imagenUrl; }
    if (updates.images) { dbUpdates.gallery_urls = updates.images; delete dbUpdates.images; }
    if (updates.beneficiarioNombre) { dbUpdates.beneficiario_nombre = updates.beneficiarioNombre; delete dbUpdates.beneficiarioNombre; }
    if (updates.beneficiarioApellido) { dbUpdates.beneficiario_apellido = updates.beneficiarioApellido; delete dbUpdates.beneficiarioApellido; }
    if (updates.beneficiarioRelacion) { dbUpdates.beneficiario_relacion = updates.beneficiarioRelacion; delete dbUpdates.beneficiarioRelacion; }
    if (updates.duracionDias) { dbUpdates.duracion_dias = updates.duracionDias; delete dbUpdates.duracionDias; }
    if (updates.fechaTermino) { dbUpdates.fecha_termino = updates.fechaTermino; delete dbUpdates.fechaTermino; }
    if (updates.ciudad) { dbUpdates.ciudad = updates.ciudad; }

    // 2. Ejecutar actualización
    const { data: updatedData, error: updateError } = await supabase
      .from('campaigns')
      .update(dbUpdates)
      .eq('id', id)
      .select();

    if (updateError) throw updateError;
    const finalCampaign = updatedData[0];

    // 3. Notificación por Correo Específica según cambio de estado
    try {
      const [{ data: profile }, { data: authUser }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
        (supabase.auth as any).admin.getUserById(userId).catch(() => ({ data: null }))
      ]);

      const email = authUser?.user?.email;
      if (email) {
        const campaignTitle = finalCampaign.titulo || campaign.titulo;
        
        // Lógica de detección de estado
        if (updates.estado === 'pausada') {
          await Mailer.sendCampaignPausedNotification(email, profile?.full_name || 'Creador', campaignTitle);
        } else if (updates.estado === 'activa' && campaign.estado === 'pausada') {
          await Mailer.sendCampaignResumedNotification(email, profile?.full_name || 'Creador', campaignTitle, id, req);
        } else {
          // Notificación genérica para otros cambios
          await Mailer.sendCampaignUpdatedNotification(
            email,
            profile?.full_name || 'Creador',
            campaignTitle,
            id,
            req
          );
        }
        logger.info('UPDATE_CAMPAIGN_MAIL_SENT', { userId, email, campaignId: id, newState: updates.estado });
      }
    } catch (mailProcessError: any) {
      logger.error('UPDATE_CAMPAIGN_MAIL_LOGIC_ERROR', mailProcessError);
    }

    return res.status(200).json({ success: true, data: finalCampaign });
  } catch (error: any) {
    logger.error('UPDATE_CAMPAIGN_API_ERROR', error);
    return res.status(500).json({ error: error.message });
  }
}
