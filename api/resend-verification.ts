
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
      logger.error('RESEND_VERIFICATION_SUPABASE_CONFIG_MISSING', new Error("Servicio de correo no configurado en el servidor."));
      throw new Error("Servicio de correo no configurado en el servidor.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Buscar usuario
    const { data: adminUser, error: adminUserError } = await (supabase.auth as any).admin.getUserByEmail(email);
    const user = adminUser?.user;

    if (!user) {
        logger.warn('RESEND_VERIFICATION_USER_NOT_FOUND', { email });
        throw new Error("No existe una cuenta asociada a este correo.");
    }

    // 2. Obtener nombre para el mail
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const fullName = profile?.full_name || user.user_metadata?.full_name || 'Usuario';

    // 3. Ejecutar proceso unificado
    await Mailer.generateAndSendVerification(supabase, user.id, email, fullName, req);
    
    return res.status(200).json({ success: true, message: "Correo de verificación reenviado exitosamente." });

  } catch (error: any) {
    logger.error('RESEND_VERIFICATION_FATAL_FAIL', error, { email: req.body.email });
    return res.status(500).json({ success: false, error: error.message });
  }
}
