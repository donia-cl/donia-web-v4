
import { createClient } from '@supabase/supabase-js';
import { logger, Mailer, Validator } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, updates, otpCode } = req.body;
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl!, serviceRoleKey!);

  try {
    Validator.required(id, 'id');
    const { data: existing, error: findError } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (findError || !existing) return res.status(404).json({ error: 'Perfil no encontrado' });

    // Detectar si cambia el teléfono o la configuración de 2FA
    const isPhoneChange = updates.phone && updates.phone !== existing.phone;
    const is2FAChange = updates.two_factor_enabled !== undefined && updates.two_factor_enabled !== existing.two_factor_enabled;

    if (isPhoneChange || is2FAChange) {
      if (!otpCode) throw new Error(`Se requiere código de verificación para ${is2FAChange ? 'cambiar la seguridad de la cuenta' : 'cambiar el teléfono'}.`);
      
      const otpType = is2FAChange ? '2fa_toggle' : 'phone_update';
      const { data: otp, error: otpError } = await supabase
        .from('security_otps')
        .select('*')
        .eq('user_id', id)
        .eq('code', otpCode)
        .eq('type', otpType)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (otpError || !otp) throw new Error("Código de seguridad inválido o expirado.");
      
      await supabase.from('security_otps').update({ used_at: new Date().toISOString() }).eq('id', otp.id);
    }

    const dbUpdates: any = {};
    if (updates.full_name !== undefined) dbUpdates.full_name = updates.full_name;
    if (updates.rut !== undefined) dbUpdates.rut = updates.rut;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.region !== undefined) dbUpdates.region = updates.region;
    if (updates.city !== undefined) dbUpdates.city = updates.city;
    if (updates.two_factor_enabled !== undefined) dbUpdates.two_factor_enabled = updates.two_factor_enabled;

    const { data, error } = await supabase.from('profiles').update(dbUpdates).eq('id', id).select().single();

    if (error) throw error;

    const { data: authData } = await (supabase.auth as any).admin.getUserById(id);
    const email = authData?.user?.email;

    if (email) {
      if (is2FAChange) {
        await Mailer.sendSecurityUpdateNotification(email, data.full_name, updates.two_factor_enabled ? 'Activación de Autenticación de Dos Factores (2FA)' : 'Desactivación de Autenticación de Dos Factores (2FA)');
      } else if (isPhoneChange || (updates.rut && updates.rut !== existing.rut)) {
        await Mailer.sendSecurityUpdateNotification(email, data.full_name, 'Teléfono o RUT de contacto');
      } else {
        await Mailer.sendProfileUpdateNotification(email, data.full_name);
      }
    }

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    logger.error("Update Profile Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
