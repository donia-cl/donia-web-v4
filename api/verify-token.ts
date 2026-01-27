import { createClient } from '@supabase/supabase-js';
import { logger, getCanonicalBackendBaseUrl } from './_utils.js';

export default async function handler(req: any, res: any) {
  const { token } = req.query;

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "Configuración del servidor incompleta." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const baseUrl = getCanonicalBackendBaseUrl(req);

  try {
    if (!token) throw new Error("Token no proporcionado.");

    // 1. Buscar el token activo
    const { data: verification, error: vError } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('token', token)
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (vError || !verification) {
      logger.warn('VERIFY_TOKEN_INVALID_OR_EXPIRED', { token });
      throw new Error("El enlace es inválido o ha expirado.");
    }

    // 2. Marcar como verificado en el perfil usando IS_VERIFIED
    const { error: pError } = await supabase
      .from('profiles')
      .update({ is_verified: true, email_verified: true }) // Actualizamos ambos por consistencia
      .eq('id', verification.user_id);

    if (pError) throw pError;

    // 3. Consumir el token
    await supabase
      .from('email_verifications')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', verification.id);

    logger.info('VERIFY_TOKEN_SUCCESS', { userId: verification.user_id });

    // 4. Redirigir al dashboard con éxito
    return res.redirect(303, `${baseUrl}/dashboard?verified=true`);

  } catch (error: any) {
    logger.error('VERIFY_TOKEN_ERROR', error);
    return res.redirect(303, `${baseUrl}/dashboard?error=${encodeURIComponent(error.message)}`);
  }
}