
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
    const { data: existing } = await supabase.from('profiles').select('id').eq('id', id).maybeSingle();

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id,
        full_name: fullName || 'Usuario Nuevo',
        role: 'user'
      }, { onConflict: 'id' });

    if (error) throw error;

    if (!existing) {
      try {
        const { data: authUser } = await (supabase.auth as any).admin.getUserById(id);
        if (authUser?.user?.email) {
          await Mailer.sendWelcomeNotification(authUser.user.email, fullName || 'Usuario', req);
        }
      } catch (mailErr) {
        logger.error('WELCOME_MAIL_ERROR', mailErr);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
