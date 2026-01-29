import { createClient } from '@supabase/supabase-js';
import { Validator, logger, Mailer } from './_utils.js';
import { ZohoService } from './_zoho.js';

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

    // 1. Obtener campaña y verificar propiedad
    const { data: campaign, error: cError } = await supabase
      .from('campaigns')
      .select('id, owner_id, recaudado, titulo')
      .eq('id', campaignId)
      .single();

    if (cError || !campaign) throw new Error("Campaña no encontrada.");
    if (campaign.owner_id !== userId) return res.status(403).json({ error: "No tienes permisos." });

    // 2. Determinar si se requiere OTP (solo si hay fondos pendientes de retiro)
    const { data: withdrawals } = await supabase
      .from('withdrawals')
      .select('monto')
      .eq('campaign_id', campaignId)
      .in('estado', ['pendiente', 'completado']);
    
    const yaRetirado = (withdrawals || []).reduce((acc, w) => acc + (Number(w.monto) || 0), 0);
    const balance = (Number(campaign.recaudado) || 0) - yaRetirado;

    if (balance > 0) {
      if (!otpCode) return res.status(400).json({ error: "Se requiere código OTP para confirmar la cancelación con fondos recaudados." });
      
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
      
      // Consumir OTP
      await supabase.from('security_otps').update({ used_at: new Date().toISOString() }).eq('id', otp.id);
    }

    // 3. Actualizar estado a 'cancelada'
    const { data: updated, error: uError } = await supabase
      .from('campaigns')
      .update({ estado: 'cancelada' })
      .eq('id', campaignId)
      .select()
      .single();

    if (uError) throw uError;

    // 4. LÓGICA DE ZOHO DESK (Si hay recaudación, notificar para devoluciones)
    if (Number(campaign.recaudado) > 0) {
      try {
        // Obtener todas las donaciones exitosas
        const { data: donations } = await supabase
          .from('donations')
          .select('payment_id, donor_email, amount_cause, nombre_donante')
          .eq('campaign_id', campaignId)
          .eq('status', 'completed');

        if (donations && donations.length > 0) {
          const donationRows = donations.map(d => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.payment_id || 'N/A'}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.donor_email}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">$${d.amount_cause.toLocaleString('es-CL')}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${d.nombre_donante}</td>
            </tr>
          `).join('');

          const htmlDescription = `
            <div style="font-family: sans-serif; color: #333;">
              <h2 style="color: #e11d48;">Alerta de Cancelación con Fondos</h2>
              <p>El usuario ha cancelado manualmente la campaña <strong>"${campaign.titulo}"</strong> (ID: ${campaignId}).</p>
              <p>Dado que la campaña cuenta con recaudación activa ($${Number(campaign.recaudado).toLocaleString('es-CL')}), se requiere revisar el proceso de devoluciones.</p>
              
              <h3 style="margin-top: 20px;">Listado de Donaciones para Reembolso:</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #f8fafc; text-align: left;">
                    <th style="padding: 8px; border-bottom: 2px solid #ddd;">Payment ID</th>
                    <th style="padding: 8px; border-bottom: 2px solid #ddd;">Email Donante</th>
                    <th style="padding: 8px; border-bottom: 2px solid #ddd;">Monto Causa</th>
                    <th style="padding: 8px; border-bottom: 2px solid #ddd;">Nombre</th>
                  </tr>
                </thead>
                <tbody>
                  ${donationRows}
                </tbody>
              </table>
              <p style="margin-top: 20px; font-size: 11px; color: #666;">Ticket generado automáticamente por Donia System.</p>
            </div>
          `;

          const { data: authUser } = await (supabase.auth as any).admin.getUserById(userId);

          await ZohoService.createTicket({
            subject: `[CANCELACIÓN] Campaña con Fondos - ${campaign.titulo}`,
            contactName: authUser?.user?.user_metadata?.full_name || 'Usuario Donia',
            email: authUser?.user?.email || 'soporte@donia.cl',
            description: htmlDescription,
            priority: 'Urgent',
            classification: 'Cancelación'
          });
          
          logger.info('ZOHO_CANCEL_TICKET_CREATED', { campaignId });
        }
      } catch (zohoErr) {
        // Logueamos pero no bloqueamos la respuesta al usuario ya que la campaña ya se canceló en DB
        logger.error('ZOHO_CANCEL_TICKET_FAIL', zohoErr);
      }
    }

    // 5. Notificar al creador por correo
    try {
      const { data: authUser } = await (supabase.auth as any).admin.getUserById(userId);
      const email = authUser?.user?.email;
      if (email) {
        await Mailer.sendCampaignCancelledNotification(
          email,
          authUser.user.user_metadata?.full_name || 'Creador',
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