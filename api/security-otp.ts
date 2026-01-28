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

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); 

    // CAPA 3: IDEMPOTENCIA ATÓMICA VIA RPC
    // Llamamos a la función de DB que hace el check-and-insert en un solo paso
    const { data: wasInserted, error: rpcError } = await supabase.rpc('request_security_otp_atomic', {
      p_user_id: userId,
      p_type: type,
      p_code: otpCode,
      p_expires_at: expiresAt
    });

    if (rpcError) {
      logger.error('SECURITY_OTP_RPC_FAIL', rpcError);
      throw rpcError;
    }

    // Si la función devolvió FALSE, significa que detectó un duplicado en la ventana de 30s
    if (!wasInserted) {
      logger.info('SECURITY_OTP_SKIPPED_ATOMIC', { userId, type });
      return res.status(200).json({ 
        success: true, 
        message: "Solicitud procesada anteriormente (Idempotencia Atómica)." 
      });
    }

    // Solo si se insertó con éxito, procedemos a enviar el correo
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
      throw new Error("No se pudo determinar el destinatario del código.");
    }

    let name = 'Usuario';
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
      if (profile?.full_name) name = profile.full_name;
    } catch (pErr) {
      logger.warn('PROFILE_NAME_LOOKUP_FAIL', { userId });
    }
    
    let actionDesc = 'realizar una acción de seguridad';
    if (type === 'bank_account_update') actionDesc = 'actualizar tus datos bancarios para retiros';
    if (type === 'phone_update') actionDesc = 'cambiar tu número de teléfono de contacto';
    if (type === '2fa_toggle') actionDesc = 'cambiar la configuración de tu autenticación de dos factores (2FA)';
    if (type === 'withdrawal_request') actionDesc = 'autorizar el retiro de fondos de tu campaña';
    if (type === 'cancel_campaign') actionDesc = 'cancelar definitivamente tu campaña activa';

    // Enviar correo (Solo se llega aquí si el insert fue el ÚNICO ganador)
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