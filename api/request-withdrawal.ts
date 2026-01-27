
import { createClient } from '@supabase/supabase-js';
import { Validator, logger, Mailer, calculateEffectiveStatus } from './_utils.js';
import { ZohoService } from './_zoho.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, campaignId, monto, otpCode } = req.body;

    Validator.required(userId, 'userId');
    Validator.uuid(campaignId, 'campaignId');
    Validator.number(monto, 1000, 'monto');
    Validator.required(otpCode, 'otpCode');

    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl!, serviceRoleKey!);

    // 1. Validar OTP
    const { data: otp, error: otpError } = await supabase
      .from('security_otps')
      .select('*')
      .eq('user_id', userId)
      .eq('code', otpCode)
      .eq('type', 'withdrawal_request')
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (otpError || !otp) {
      return res.status(401).json({ success: false, error: "Código de seguridad inválido o expirado." });
    }

    // 2. Validar Datos de Perfil
    const { data: profile } = await supabase.from('profiles').select('full_name, rut, phone').eq('id', userId).single();
    if (!profile?.rut || !profile?.phone) {
      return res.status(400).json({ success: false, error: "Completa tu RUT y Teléfono antes de solicitar un retiro." });
    }

    // 3. Validar Datos Bancarios
    const { data: bankAccount } = await supabase.from('bank_accounts').select('*').eq('user_id', userId).maybeSingle();
    if (!bankAccount) {
      return res.status(400).json({ success: false, error: "Configura tus datos bancarios en la pestaña de Finanzas." });
    }

    // 4. Validar Campaña y Estado Retirable
    const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', campaignId).single();
    if (!campaign || campaign.owner_id !== userId) {
      return res.status(403).json({ success: false, error: "No tienes permisos sobre esta campaña." });
    }

    const effectiveStatus = calculateEffectiveStatus(campaign);
    if (effectiveStatus !== 'finalizada') {
      return res.status(400).json({ 
        success: false, 
        error: "Esta campaña no ha finalizado. Solo puedes retirar fondos de campañas finalizadas." 
      });
    }

    // 5. Validar Saldo Disponible
    const { data: withdrawals } = await supabase.from('withdrawals').select('monto').eq('campaign_id', campaignId).in('estado', ['pendiente', 'completado']);
    const yaRetirado = (withdrawals || []).reduce((acc, w) => acc + Number(w.monto), 0);
    const disponible = Number(campaign.recaudado) - yaRetirado;

    if (monto > disponible) {
      return res.status(400).json({ success: false, error: `Monto excede el disponible ($${disponible.toLocaleString('es-CL')}).` });
    }

    // 6. Registrar Solicitud y consumir OTP
    await supabase.from('security_otps').update({ used_at: new Date().toISOString() }).eq('id', otp.id);
    
    const { data: withdrawal, error: wError } = await supabase.from('withdrawals').insert([{
      user_id: userId,
      campaign_id: campaignId,
      monto: Number(monto),
      estado: 'pendiente',
      fecha: new Date().toISOString()
    }]).select().single();

    if (wError) throw wError;

    // 7. Notificar por email
    const { data: authUser } = await (supabase.auth as any).admin.getUserById(userId);
    if (authUser?.user?.email) {
      await Mailer.sendWithdrawalConfirmation(authUser.user.email, profile.full_name, Number(monto), campaign.titulo, req);
    }

    // 8. Registro en Zoho Desk con Formato HTML
    try {
      const formattedMonto = `$${Number(monto).toLocaleString('es-CL')}`;
      
      const htmlDescription = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; line-height: 1.6; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #7c3aed; padding: 20px; color: white;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 800;">Solicitud de Retiro de Fondos</h2>
          </div>
          <div style="padding: 25px;">
            <p style="margin-bottom: 20px; font-size: 16px;">Se ha generado una nueva solicitud de retiro que requiere procesarse.</p>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; width: 180px; color: #64748b; text-transform: uppercase; font-size: 11px;">Monto a Transferir</td>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 22px; font-weight: 900; color: #059669;">${formattedMonto}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 11px;">Beneficiario</td>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #1e293b;">${profile.full_name}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 11px;">RUT</td>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #1e293b;">${profile.rut}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 11px;">Banco</td>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #1e293b;">${bankAccount.bank_name}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 11px;">Tipo de Cuenta</td>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #1e293b;">${bankAccount.account_type}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 11px;">N° de Cuenta</td>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 900; color: #1e293b; letter-spacing: 1px;">${bankAccount.account_number}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 11px;">Campaña Origen</td>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 500; color: #475569; font-style: italic;">"${campaign.titulo}"</td>
              </tr>
            </table>
            
            <div style="margin-top: 25px; padding: 15px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Acción Requerida</p>
              <p style="margin: 5px 0 0 0; font-size: 13px; color: #475569;">Verificar fondos en recaudación y realizar transferencia.</p>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 15px; text-align: center; border-top: 1px solid #f1f5f9;">
            <span style="font-size: 11px; color: #cbd5e1; font-weight: 800; letter-spacing: 2px;">DONIA CHILE SPA</span>
          </div>
        </div>
      `;
      
      await ZohoService.createTicket({
        subject: `[RETIRO] ${formattedMonto} - RUT: ${profile.rut}`,
        contactName: profile.full_name,
        email: authUser?.user?.email || 'soporte@donia.cl',
        description: htmlDescription,
        priority: 'High',
        classification: 'Finanzas'
      });
    } catch (zohoError) {
      logger.error('ZOHO_WITHDRAWAL_TICKET_FAIL', zohoError);
    }

    return res.status(200).json({ success: true, data: withdrawal });

  } catch (error: any) {
    logger.error('WITHDRAWAL_API_ERROR', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
