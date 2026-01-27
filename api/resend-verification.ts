import { createClient } from '@supabase/supabase-js';
import { Mailer, Validator, logger } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email } = req.body;
    Validator.email(email);

    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      logger.error('RESEND_VERIFICATION_SUPABASE_CONFIG_MISSING', new Error("Servicio de correo no configurado."));
      throw new Error("Servicio de correo no configurado.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Buscar usuario por email usando Admin SDK (robusto)
    const { data: adminUser, error: adminUserError } = await (supabase.auth as any).admin.getUserByEmail(email);

    if (adminUserError || !adminUser?.user) {
        logger.warn('RESEND_VERIFICATION_USER_NOT_FOUND', { email });
        throw new Error("No existe una cuenta asociada a este correo.");
    }

    const user = adminUser.user;

    // 2. Obtener nombre del perfil
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const fullName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario';

    // 3. Usar el flujo centralizado de Mailer
    const success = await Mailer.generateAndSendVerification(supabase, user.id, email, fullName, req);

    if (!success) throw new Error("Fallo al generar el correo de activación.");

    logger.info('VERIFICATION_EMAIL_RESENT', { email, userId: user.id });
    return res.status(200).json({ success: true, message: "Correo de verificación reenviado exitosamente." });

  } catch (error: any) {
    logger.error('RESEND_VERIFICATION_FATAL_FAIL', error, { email: req.body.email });
    return res.status(500).json({ success: false, error: error.message });
  }
}