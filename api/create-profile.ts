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

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: existing } = await supabase.from('profiles').select('id, email_verified').eq('id', id).maybeSingle();

    // 1. Obtener info del usuario de Auth para saber el proveedor
    const { data: authUser } = await (supabase.auth as any).admin.getUserById(id);
    if (!authUser?.user) throw new Error("Usuario no encontrado en auth.");

    const provider = authUser.user.app_metadata?.provider || authUser.user.app_metadata?.providers?.[0];
    const isGoogle = provider === 'google';

    // 2. Definir estado de verificación inicial
    // Si ya existe y está verificado, mantenemos true. Si es nuevo, Google es true, otros false.
    let emailVerified = existing?.email_verified || isGoogle;

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id,
        full_name: fullName || authUser.user.user_metadata?.full_name || 'Usuario Nuevo',
        role: 'user',
        email_verified: emailVerified
      }, { onConflict: 'id' });

    if (error) throw error;

    // 3. Disparar verificación si no está verificado (solo para no-Google nuevos o re-activación)
    if (!emailVerified && authUser.user.email) {
      await Mailer.generateAndSendVerification(
        supabase, 
        id, 
        authUser.user.email, 
        fullName || 'Usuario',
        req
      );
    } else if (!existing) {
      // Si es Google y es nuevo, solo mandamos bienvenida normal
      if (authUser.user.email) {
        await Mailer.sendWelcomeNotification(authUser.user.email, fullName || 'Usuario', req);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error('CREATE_PROFILE_API_ERROR', error);
    return res.status(500).json({ error: error.message });
  }
}