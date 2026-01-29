
import { createClient } from '@supabase/supabase-js';
import { Mailer, logger, Validator, checkRateLimit } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  console.log("[DONIA-VER] api/recover-password.ts v2.1 - listUsers strategy");

  const { action, email, code, newPassword } = req.body;
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: "Configuración de servidor incompleta." });
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const ip = req.headers['x-forwarded-for'] || 'unknown';
    checkRateLimit(String(ip), 5, 60000); 

    Validator.email(email);

    if (action === 'request') {
      // 1. Buscar usuario por email usando listUsers
      // Fix: Cast auth to any to bypass admin property missing on SupabaseAuthClient
      const { data: userData, error: userError } = await (supabase.auth as any).admin.listUsers();
      if (userError) throw userError;
      
      const user = userData.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        logger.warn('RECOVERY_REQUESTED_FOR_NON_EXISTENT_EMAIL', { email });
        return res.status(200).json({ success: true, message: "Si el correo está registrado, recibirás un código." });
      }

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); 

      await supabase.from('security_otps').delete().eq('user_id', user.id).eq('type', 'password_recovery');
      await supabase.from('security_otps').insert([{ 
        user_id: user.id, 
        code: otpCode, 
        type: 'password_recovery', 
        expires_at: expiresAt 
      }]);

      await Mailer.sendSecurityOTP(email, profile?.full_name || 'Usuario', otpCode, 'recuperación de cuenta');
      
      logger.info('RECOVERY_OTP_SENT', { userId: user.id, email });
      return res.status(200).json({ success: true, message: "Código enviado con éxito." });
    }

    if (action === 'reset') {
      Validator.required(code, 'code');
      Validator.string(newPassword, 6, 'newPassword');

      // Fix: Cast auth to any to bypass admin property missing on SupabaseAuthClient
      const { data: userData } = await (supabase.auth as any).admin.listUsers();
      const user = userData.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (!user) throw new Error("Usuario no encontrado.");

      const { data: otp, error: otpError } = await supabase
        .from('security_otps')
        .select('*')
        .eq('user_id', user.id)
        .eq('code', code)
        .eq('type', 'password_recovery')
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (otpError || !otp) {
        throw new Error("El código es inválido o ha expirado.");
      }

      // Fix: Cast auth to any to bypass admin property missing on SupabaseAuthClient
      const { error: updateError } = await (supabase.auth as any).admin.updateUserById(user.id, { 
        password: newPassword,
        email_confirm: true 
      });
      
      if (updateError) throw updateError;

      await supabase.from('security_otps').update({ used_at: new Date().toISOString() }).eq('id', otp.id);

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      await Mailer.sendPasswordChangedNotification(email, profile?.full_name || 'Usuario', req);

      logger.info('PASSWORD_RESET_VIA_RECOVERY_SUCCESS', { userId: user.id, email });
      return res.status(200).json({ success: true, message: "Contraseña actualizada exitosamente." });
    }

    return res.status(400).json({ error: "Acción no válida" });
  } catch (error: any) {
    logger.error('RECOVERY_API_ERROR', error);
    return res.status(500).json({ error: error.message || "Error procesando la solicitud." });
  }
}
