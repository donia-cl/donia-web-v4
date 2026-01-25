
import { Mailer, logger, Validator } from './_utils.js';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { userId } = req.body;

  try {
    Validator.required(userId, 'userId');

    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl!, serviceRoleKey!);

    // Obtener email del usuario desde Auth
    const { data: authUser, error: authError } = await (supabase.auth as any).admin.getUserById(userId);
    if (authError || !authUser?.user) throw new Error("Usuario no encontrado.");

    const email = authUser.user.email;
    
    // Obtener nombre del perfil
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
    const fullName = profile?.full_name || authUser.user.user_metadata?.full_name || email.split('@')[0];

    // Enviar notificación vía Resend
    await Mailer.sendPasswordChangedNotification(email, fullName, req);

    logger.info('PASSWORD_CHANGE_NOTIFICATION_SENT', { userId, email });
    return res.status(200).json({ success: true });

  } catch (error: any) {
    logger.error('PASSWORD_CHANGE_NOTIFICATION_ERROR', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
