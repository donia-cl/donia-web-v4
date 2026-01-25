
import { createClient } from '@supabase/supabase-js';
import { Validator, logger, Mailer } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl!, serviceRoleKey!);

  try {
    if (req.method === 'GET') {
      const { userId } = req.query;
      Validator.required(userId, 'userId');
      const { data, error } = await supabase.from('bank_accounts').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    if (req.method === 'POST') {
      const { userId, bankName, accountType, accountNumber, holderName, holderRut, otpCode } = req.body;
      
      Validator.required(userId, 'userId');
      Validator.required(otpCode, 'Código de seguridad');

      // 1. Validar OTP (Mandatorio para banco)
      const { data: otp, error: otpError } = await supabase
        .from('security_otps')
        .select('*')
        .eq('user_id', userId)
        .eq('code', otpCode)
        .eq('type', 'bank_account_update')
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (otpError || !otp) throw new Error("Código de seguridad inválido o expirado.");

      // 2. Ejecutar Guardado
      const { data, error } = await supabase
        .from('bank_accounts')
        .upsert({
          user_id: userId,
          bank_name: bankName,
          account_type: accountType,
          account_number: accountNumber,
          holder_name: holderName,
          holder_rut: holderRut,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;

      // 3. Marcar OTP como usado y Notificar
      await supabase.from('security_otps').update({ used_at: new Date().toISOString() }).eq('id', otp.id);

      const { data: authUser } = await (supabase.auth as any).admin.getUserById(userId);
      if (authUser?.user?.email) {
        await Mailer.sendSecurityUpdateNotification(authUser.user.email, holderName, 'Información de Cuenta Bancaria para Retiros');
      }

      logger.audit(userId, 'BANK_ACCOUNT_UPDATED', data.id);
      return res.status(200).json({ success: true, data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    logger.error('BANK_ACCOUNT_API_ERROR', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
