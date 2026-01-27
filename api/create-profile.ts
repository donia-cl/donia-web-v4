import { createClient } from '@supabase/supabase-js';
import { Mailer, logger } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, fullName } = req.body;
  logger.info('CREATE_PROFILE_API_CALLED', { id, fullName });

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    logger.error('CONFIG_SUPABASE_MISSING', new Error('Supabase environment variables missing in API.'));
    return res.status(500).json({ error: 'Server configuration missing' });
  }

  // IMPORTANTE: Usar Service Role para bypass de RLS y gestión de tokens
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Obtener info del usuario de Auth para saber el proveedor real
    const { data: authUser, error: authError } = await (supabase.auth as any).admin.getUserById(id);
    if (authError || !authUser?.user) {
      logger.error('CREATE_PROFILE_AUTH_LOOKUP_FAIL', authError || new Error('Auth User not found'), { id });
      throw new Error("Usuario no encontrado en el sistema de autenticación.");
    }

    const provider = authUser.user.app_metadata?.provider || authUser.user.app_metadata?.providers?.[0];
    const isGoogle = provider === 'google';
    logger.info('CREATE_PROFILE_PROVIDER_DETECTED', { id, provider, isGoogle });

    // 2. Verificar si ya existe un perfil
    const { data: existing } = await supabase.from('profiles').select('id, is_verified').eq('id', id).maybeSingle();

    // LÓGICA CRÍTICA: 
    // - Si es Google: is_verified = true
    // - Si ya existía y estaba verificado: se mantiene true
    // - Si es nuevo o no verificado y es Email/Password: is_verified = false
    let finalIsVerified = isGoogle || (existing?.is_verified === true);
    logger.info('CREATE_PROFILE_VERIFICATION_STATUS_DETERMINED', { id, finalIsVerified });

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({
        id,
        full_name: fullName || authUser.user.user_metadata?.full_name || 'Usuario Nuevo',
        role: 'user',
        is_verified: finalIsVerified,
        email_verified: finalIsVerified
      }, { onConflict: 'id' });

    if (upsertError) {
      logger.error('CREATE_PROFILE_UPSERT_DB_FAIL', upsertError, { id });
      throw upsertError;
    }

    logger.info('CREATE_PROFILE_UPSERT_SUCCESS', { id });

    // 3. Si NO está verificado, generamos token y mandamos correo (Lógica similar a cambio de perfil)
    if (!finalIsVerified && authUser.user.email) {
      logger.info('CREATE_PROFILE_TRIGGER_VERIFICATION_MAIL', { userId: id, email: authUser.user.email });
      
      const success = await Mailer.generateAndSendVerification(
        supabase, 
        id, 
        authUser.user.email, 
        fullName || authUser.user.user_metadata?.full_name || 'Usuario',
        req
      );

      if (!success) {
        logger.error('CREATE_PROFILE_VERIFICATION_MAIL_WORKFLOW_FAILED', new Error("Fallo en generateAndSendVerification"), { id });
      }
    } else if (!existing && isGoogle) {
      // Si es Google y es el primer ingreso, mandamos bienvenida simple
      if (authUser.user.email) {
        logger.info('CREATE_PROFILE_TRIGGER_WELCOME_MAIL', { userId: id, email: authUser.user.email });
        await Mailer.sendWelcomeNotification(authUser.user.email, fullName || 'Usuario', req);
      }
    }

    return res.status(200).json({ success: true, is_verified: finalIsVerified });
  } catch (error: any) {
    logger.error('CREATE_PROFILE_FATAL_ERROR', error, { id });
    return res.status(500).json({ error: error.message });
  }
}