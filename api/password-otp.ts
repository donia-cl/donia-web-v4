
import { createClient } from '@supabase/supabase-js';
import { Mailer, logger, Validator } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, userId, code, newPassword } = req.body;
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: "Config" });
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    Validator.required(userId, 'userId');

    // ACCIÓN: SOLICITAR CÓDIGO
    if (action === 'request') {
      const { data: authUser } = await (supabase.auth as any).admin.getUserById(userId);
      const email = authUser?.user?.email;
      if (!email) throw new Error("Usuario no encontrado.");

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
      
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      await supabase.from('security_otps').delete().eq('user_id', userId).eq('type', 'password_change');
      await supabase.from('security_otps').insert([{ user_id: userId, code: otpCode, type: 'password_change', expires_at: expiresAt }]);

      await Mailer.sendSecurityOTP(email, profile?.full_name || 'Usuario', otpCode, 'cambio de contraseña');
      
      return res.status(200).json({ success: true, message: "Código enviado" });
    }

    // ACCIÓN: VERIFICAR Y CAMBIAR
    if (action === 'verify') {
      Validator.required(code, 'code');
      Validator.string(newPassword, 6, 'newPassword');

      const { data: otp, error: otpError } = await supabase
        .from('security_otps')
        .select('*')
        .eq('user_id', userId)
        .eq('code', code)
        .eq('type', 'password_change')
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (otpError || !otp) throw new Error("Código inválido o expirado.");

      // Ejecutar cambio de contraseña vía Admin SDK
      const { error: updateError } = await (supabase.auth as any).admin.updateUserById(userId, { password: newPassword });
      if (updateError) throw updateError;

      // Marcar OTP como usado
      await supabase.from('security_otps').update({ used_at: new Date().toISOString() }).eq('id', otp.id);

      // Notificar éxito
      const { data: authUser } = await (supabase.auth as any).admin.getUserById(userId);
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
      if (authUser?.user?.email) {
        await Mailer.sendPasswordChangedNotification(authUser.user.email, profile?.full_name || 'Usuario');
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Acción no válida" });
  } catch (error: any) {
    logger.error('PASSWORD_OTP_ERROR', error);
    return res.status(500).json({ error: error.message });
  }
}
