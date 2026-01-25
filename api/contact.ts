
import { createClient } from '@supabase/supabase-js';
import { Validator, logger } from './_utils.js';
import { ZohoService } from './_zoho.js';

const SUBJECT_TRANSLATIONS: Record<string, string> = {
  'report': 'Reportar una campaña',
  'payment': 'Problema con un pago',
  'withdraw': 'Problema con retiros',
  'account': 'Acceso a mi cuenta',
  'other': 'Otro tema'
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, subject, message } = req.body;

    // Log de entrada para ver qué está llegando
    logger.info('CONTACT_FORM_SUBMITTED', { name, email, subject });

    Validator.required(name, 'Nombre');
    Validator.email(email);
    Validator.required(subject, 'Asunto');
    Validator.string(message, 10, 'Mensaje');

    const displaySubject = SUBJECT_TRANSLATIONS[subject] || subject;

    // 1. Guardar en Base de Datos (Respaldo)
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && serviceRoleKey) {
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        await supabase.from('support_tickets').insert([{
          name, email, subject: displaySubject, message, status: 'pending', source: 'web_form'
        }]);
        logger.info('CONTACT_DB_SAVED_SUCCESS', { email });
      }
    } catch (e) { 
      logger.error('CONTACT_DB_SAVE_FAIL', e); 
    }

    // 2. Crear Ticket en Zoho Desk
    try {
      await ZohoService.createTicket({
        subject: `[Soporte Web] ${displaySubject}`,
        contactName: name,
        email: email,
        description: message,
        classification: displaySubject
      });
    } catch (zohoError) {
      // Ya lo loguea internamente ZohoService, pero aquí capturamos el fallo para no bloquear
      logger.warn('CONTACT_ZOHO_SYNC_FAIL_SKIPPED', zohoError);
    }

    return res.status(200).json({ success: true, message: "Mensaje recibido correctamente" });

  } catch (error: any) {
    logger.error('CONTACT_API_FATAL_ERROR', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
