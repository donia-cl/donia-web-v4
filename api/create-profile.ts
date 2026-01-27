import { createClient } from '@supabase/supabase-js';
import { Mailer, logger } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, fullName } = req.body;
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration missing' });
  }

  // Usar Service Role para garantizar permisos de escritura y bypass de RLS
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Obtener el perfil actual si existe
    const { data: existingProfile } = await supabase.from('profiles').select('id, is_verified').eq('id', id).maybeSingle();

    // 2. Obtener info de Auth para validar proveedor real
    const { data: authUser, error: authError } = await (supabase.auth as any).admin.getUserById(id);
    if (authError || !authUser?.user) throw new Error("Error obteniendo datos del usuario");

    const provider = authUser.user.app_metadata?.provider || authUser.user.app_metadata?.providers?.[0];
    const isGoogle = provider === 'google';

    // 3. Determinar estado de verificación final
    // Prioridad: 
    // - Si ya estaba verificado en el perfil, se mantiene.
    // - Si es Google, se marca como verificado automáticamente.
    // - De lo contrario, FALSE.
    let finalIsVerified = (existingProfile?.is_verified === true) || isGoogle;

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({
        id,
        full_name: fullName || authUser.user.user_metadata?.full_name || 'Usuario Nuevo',
        role: 'user',
        is_verified: finalIsVerified,
        email_verified: finalIsVerified // Por consistencia histórica
      }, { onConflict: 'id' });

    if (upsertError) throw upsertError;

    // 4. Lógica de envío de correos
    if (!finalIsVerified && authUser.user.email) {
      // Es una cuenta de correo nueva o pendiente -> Mandamos token
      logger.info('WORKFLOW_START: SEND_INITIAL_VERIFICATION', { userId: id, email: authUser.user.email });
      
      const emailSent = await Mailer.generateAndSendVerification(
        supabase, 
        id, 
        authUser.user.email, 
        fullName || authUser.user.user_metadata?.full_name || 'Usuario',
        req
      );

      if (!emailSent) {
        logger.error('WORKFLOW_FAIL: INITIAL_VERIFICATION_MAIL_NOT_SENT', new Error("Fallo en Mailer"), { id });
      }
    } else if (!existingProfile && isGoogle && authUser.user.email) {
      // Es un usuario nuevo de Google -> Solo bienvenida
      await Mailer.sendWelcomeNotification(authUser.user.email, fullName || 'Usuario', req);
    }

    return res.status(200).json({ success: true, is_verified: finalIsVerified });

  } catch (error: any) {
    logger.error('CREATE_PROFILE_API_ERROR', error);
    return res.status(500).json({ error: error.message });
  }
}