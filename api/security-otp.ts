import { createClient } from '@supabase/supabase-js';
import { Mailer, logger, Validator } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, type, email: providedEmail } = req.body;
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: "Config error" });
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    Validator.required(userId, 'userId');
    Validator.required(type, 'type');

    // Capa 3: IDEMPOTENCIA SUAVE
    // Buscamos si ya se generó un OTP del mismo tipo para este usuario en los últimos 30 segundos
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    const { data: recentOtp } = await supabase
      .from('security_otps')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('type', type)
      .gt('created_at', thirtySecondsAgo)
      .limit(1)
      .maybeSingle();

    if (recentOtp) {
      logger.info('SECURITY_OTP_SKIPPED_DUPLICATE', { userId, type, recentId: recentOtp.id });
      return res.status(200).json({ 
        success: true, 
        message: "OTP ya enviado recientemente, ignorando solicitud duplicada." 
      });
    }

    let email = providedEmail;
    if (!email) {
      try {
        const { data: authUser } = await (supabase.auth as any).admin.getUserById(userId);
        email = authUser?.user?.email;
      } catch (err) {
        logger.warn('USER_LOOKUP_FAIL', { userId });
      }
    }

    if (!email) {
      throw new Error("No se pudo determinar el destinatario del código de seguridad.");
    }

    let name = 'Usuario';
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
      if (profile?.full_name) name = profile.full_name;
    } catch (pErr) {
      logger.warn('PROFILE_NAME_LOOKUP_FAIL', { userId });
    }
    
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); 

    let actionDesc = 'realizar una acción de seguridad';
    if (type === 'bank_account_update') actionDesc = 'actualizar tus datos bancarios para retiros';
    if (type === 'phone_update') actionDesc = 'cambiar tu número de teléfono de contacto';
    if (type === '2fa_toggle') actionDesc = 'cambiar la configuración de tu autenticación de dos factores (2FA)';
    if (type === 'withdrawal_request') actionDesc = 'autorizar el retiro de fondos de tu campaña';
    if (type === 'cancel_campaign') actionDesc = 'cancelar definitivamente tu campaña activa';

    // Guardar OTP en BD
    await supabase.from('security_otps').delete().eq('user_id', userId).eq('type', type);
    await supabase.from('security_otps').insert([{ user_id: userId, code: otpCode, type: type, expires_at: expiresAt }]);

    // Enviar correo
    if (type === 'login_2fa') {
      await Mailer.send2FACode(email, name, otpCode);
    } else {
      await Mailer.sendSecurityOTP(email, name, otpCode, actionDesc);
    }
    
    logger.info('SECURITY_OTP_SENT', { userId, type, email });
    return res.status(200).json({ success: true, message: "Código enviado" });

  } catch (error: any) {
    logger.error('SECURITY_OTP_ERROR', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}