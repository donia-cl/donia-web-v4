
import { createClient } from '@supabase/supabase-js';
import { Validator, logger, Mailer } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, campaignId, otpCode } = req.body;

    Validator.required(userId, 'userId');
    Validator.uuid(campaignId, 'campaignId');

    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl!, serviceRoleKey!);

    // 1. Fetch campaign and check ownership
    const { data: campaign, error: cError } = await supabase
      .from('campaigns')
      .select('id, owner_id, recaudado, titulo')
      .eq('id', campaignId)
      .single();

    if (cError || !campaign) throw new Error("Campaña no encontrada.");
    if (campaign.owner_id !== userId) return res.status(403).json({ error: "No tienes permisos." });

    // 2. Determine if security OTP is required
    const { data: withdrawals } = await supabase.from('withdrawals').select('monto').eq('campaign_id', campaignId).in('estado', ['pendiente', 'completado']);
    const yaRetirado = (withdrawals || []).reduce((acc, w) => acc + (Number(w.monto) || 0), 0);
    const balance = (Number(campaign.recaudado) || 0) - yaRetirado;

    // If balance > 0, OTP is absolutely required
    if (balance > 0) {
      if (!otpCode) return res.status(400).json({ error: "Se requiere código OTP para confirmar la cancelación con fondos pendientes." });
      
      const { data: otp, error: otpError } = await supabase
        .from('security_otps')
        .select('*')
        .eq('user_id', userId)
        .eq('code', otpCode)
        .eq('type', 'cancel_campaign')
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (otpError || !otp) return res.status(401).json({ error: "Código de seguridad inválido o expirado." });
      
      // Consume OTP
      await supabase.from('security_otps').update({ used_at: new Date().toISOString() }).eq('id', otp.id);
    }

    // 3. Update status to 'cancelada'
    const { data: updated, error: uError } = await supabase
      .from('campaigns')
      .update({ estado: 'cancelada' })
      .eq('id', campaignId)
      .select()
      .single();

    if (uError) throw uError;

    // 4. Notificar por correo
    try {
      const [{ data: profile }, { data: authUser }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
        (supabase.auth as any).admin.getUserById(userId).catch(() => ({ data: null }))
      ]);

      const email = authUser?.user?.email;
      if (email) {
        await Mailer.sendCampaignCancelledNotification(
          email,
          profile?.full_name || 'Creador',
          campaign.titulo
        );
      }
    } catch (mailErr) {
      logger.error('CANCEL_CAMPAIGN_MAIL_ERROR', mailErr);
    }

    logger.audit(userId, 'CAMPAIGN_CANCELLED_MANUALLY', campaignId, { balance });

    return res.status(200).json({ success: true, data: updated });

  } catch (error: any) {
    logger.error('CANCEL_CAMPAIGN_API_ERROR', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
