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

  const sendResultPage = (title: string, message: string, isError = false) => {
    const targetUrl = `${baseUrl}/dashboard?verified=true`;
    const loginUrl = `${baseUrl}/login`;
    
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <title>${title} | Donia</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; }
        </style>
      </head>
      <body class="bg-slate-50 flex items-center justify-center min-h-screen">
        <div class="max-w-md w-full p-10 bg-white rounded-[40px] shadow-2xl border border-slate-100 text-center mx-4 animate-in fade-in zoom-in duration-500">
          <div class="mb-8 flex justify-center">
            <div class="w-20 h-20 ${isError ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'} rounded-[28px] flex items-center justify-center shadow-sm">
              ${isError 
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
              }
            </div>
          </div>
          <h1 class="text-3xl font-black text-slate-900 mb-4 tracking-tight">${title}</h1>
          <p class="text-slate-500 font-medium mb-10 leading-relaxed">${message}</p>
          
          <div class="space-y-4">
            <a href="${targetUrl}" class="block w-full py-4 bg-violet-600 text-white rounded-[20px] font-black text-sm uppercase tracking-widest hover:bg-violet-700 transition-all shadow-xl shadow-violet-100 active:scale-95">
              ${isError ? 'Ir a mi cuenta' : 'Ir a mi panel'}
            </a>
            ${isError ? `<a href="${loginUrl}" class="block text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">Reintentar ingreso</a>` : ''}
          </div>
          
          <div class="mt-12 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Donia Chile • Seguridad</div>
        </div>
      </body>
      </html>
    `);
  };

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
      throw new Error("El enlace de activación es inválido o ya ha expirado.");
    }

    // 2. Marcar como verificado
    const { error: pError } = await supabase
      .from('profiles')
      .update({ is_verified: true, email_verified: true })
      .eq('id', verification.user_id);

    if (pError) throw pError;

    // 3. Consumir el token
    await supabase
      .from('email_verifications')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', verification.id);

    logger.info('VERIFY_TOKEN_SUCCESS', { userId: verification.user_id });

    return sendResultPage(
      "¡Correo verificado!", 
      "Tu cuenta ha sido activada con éxito. Ya puedes publicar campañas y gestionar tus aportes."
    );

  } catch (error: any) {
    logger.error('VERIFY_TOKEN_ERROR', error);
    return sendResultPage(
      "Ocurrió un problema", 
      error.message || "No pudimos procesar tu enlace de verificación.",
      true
    );
  }
}