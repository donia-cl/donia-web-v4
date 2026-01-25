
import { createClient } from '@supabase/supabase-js';
import { logger, Validator } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, code } = req.body;
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: "Config" });
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    Validator.required(userId, 'userId');
    Validator.required(code, 'code');

    const { data: otp, error: otpError } = await supabase
      .from('security_otps')
      .select('*')
      .eq('user_id', userId)
      .eq('code', code)
      .eq('type', 'login_2fa')
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (otpError || !otp) {
      return res.status(401).json({ success: false, error: "El código de seguridad es inválido o ha expirado." });
    }

    // Marcar OTP como usado
    await supabase.from('security_otps').update({ used_at: new Date().toISOString() }).eq('id', otp.id);

    logger.info('2FA_VERIFIED_SUCCESS', { userId });
    return res.status(200).json({ success: true });

  } catch (error: any) {
    logger.error('2FA_VERIFICATION_ERROR', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
