
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

    // REGLA CRÍTICA: Solo 'finalizada' permite retiro.
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

    // 7. Notificar
    const { data: authUser } = await (supabase.auth as any).admin.getUserById(userId);
    if (authUser?.user?.email) {
      await Mailer.sendWithdrawalConfirmation(authUser.user.email, profile.full_name, Number(monto), campaign.titulo, req);
    }

    // 8. Registro en Zoho Desk
    try {
      const description = `SOLICITUD RETIRO\nBeneficiario: ${profile.full_name}\nRUT: ${profile.rut}\nBanco: ${bankAccount.bank_name}\nCuenta: ${bankAccount.account_type} - ${bankAccount.account_number}\nCampaña: ${campaign.titulo}\nMonto: $${Number(monto).toLocaleString('es-CL')}`;
      await ZohoService.createTicket({
        subject: `💰 RETIRO: $${Number(monto).toLocaleString('es-CL')} - ${profile.full_name}`,
        contactName: profile.full_name,
        email: authUser?.user?.email || 'soporte@donia.cl',
        description: description,
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
