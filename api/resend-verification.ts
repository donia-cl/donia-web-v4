
import { createClient } from '@supabase/supabase-js';
import { Mailer, Validator, logger, getCanonicalBackendBaseUrl } from './_utils.js';

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

    let user = null;
    let profileFullName = 'Usuario';

    const { data: adminUser, error: adminUserError } = await (supabase.auth as any).admin.getUserByEmail(email);

    if (adminUserError) {
        logger.warn('ADMIN_GET_USER_BY_EMAIL_ERROR', adminUserError, { email });
    } else if (adminUser?.user) {
        user = adminUser.user;
    }

    if (!user) {
        const { data, error: listUsersError } = await (supabase.auth as any).admin.listUsers();
        if (listUsersError || !data?.users) {
            logger.error('ADMIN_LIST_USERS_FALLBACK_ERROR', listUsersError, { email });
            throw new Error("Error consultando base de usuarios para reenviar verificación.");
        }
        user = (data.users as any[]).find(u => u.email === email);
    }
    
    if (!user) {
        logger.warn('RESEND_VERIFICATION_USER_NOT_FOUND', { email });
        throw new Error("No existe una cuenta asociada a este correo.");
    }

    const { data: profile, error: profileError } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    if (profileError) {
        logger.warn('PROFILE_FETCH_FOR_VERIFICATION_EMAIL_ERROR', profileError, { userId: user.id });
    }
    profileFullName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario';

    await supabase.from('email_verifications').delete().eq('user_id', user.id).is('consumed_at', null);

    const { data: verification, error: vError } = await supabase
      .from('email_verifications')
      .insert([{ user_id: user.id }])
      .select()
      .single();

    if (vError) {
      logger.error('VERIFICATION_TOKEN_INSERT_ERROR', vError, { userId: user.id });
      throw vError;
    }

    // Usar detección dinámica de URL base
    const baseUrl = getCanonicalBackendBaseUrl(req);
    const verifyLink = `${baseUrl}/api/verify-token?token=${verification.token}`;
    
    await Mailer.sendAccountVerification(email, profileFullName, verifyLink);
    
    logger.info('VERIFICATION_EMAIL_SENT', { email, userId: user.id, baseUrl });
    return res.status(200).json({ success: true, message: "Correo de verificación reenviado exitosamente." });

  } catch (error: any) {
    logger.error('RESEND_VERIFICATION_FATAL_FAIL', error, { email: req.body.email });
    const clientMessage = error.message.includes('No existe una cuenta') ? error.message : "Error al reenviar el correo de verificación. Intenta de nuevo más tarde.";
    return res.status(500).json({ success: false, error: clientMessage });
  }
}
