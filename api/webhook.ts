
import { createClient } from '@supabase/supabase-js';
import { Mailer, logger } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { type, data } = req.body;
  const accessToken = process.env.MP_ACCESS_TOKEN;
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (type !== 'payment') {
    logger.warn("WEBHOOK_IGNORED_TYPE", { type });
    return res.status(200).send('OK'); 
  }
  
  if (!accessToken || !supabaseUrl || !serviceRoleKey) {
    logger.error("WEBHOOK_MISSING_CONFIG", new Error("Configuración incompleta."));
    return res.status(500).json({ error: "Configuración incompleta." });
  }

  try {
    const paymentId = data.id;
    if (!paymentId) throw new Error("Payment ID missing.");

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!mpResponse.ok) throw new Error(`MP API Error: ${mpResponse.statusText}`);
    const payment = await mpResponse.json();

    if (payment.status === 'approved') {
      const metadata = payment.metadata || {};
      const { 
        campaign_id, 
        donor_name, 
        donor_comment, 
        donor_email, 
        donor_user_id, 
        base_amount, 
        tip_amount, 
        fee_amount 
      } = metadata;
      
      const totalAmount = payment.transaction_amount;
      const amountCause = Number(base_amount || totalAmount);
      const amountTip = Number(tip_amount || 0);
      const amountFee = Number(fee_amount || (totalAmount - amountCause - amountTip));

      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data: existing } = await supabase.from('donations').select('id').eq('payment_id', String(payment.id)).maybeSingle();

      if (!existing) {
        await supabase.from('donations').insert([{
          campaign_id,
          amount_cause: amountCause,
          amount_tip: amountTip,
          amount_fee: amountFee,
          amount_total: totalAmount,
          monto: amountCause,
          nombre_donante: donor_name || 'Anónimo',
          donor_email: donor_email,
          donor_user_id: donor_user_id || null,
          comentario: donor_comment,
          payment_provider: 'mercado_pago',
          payment_id: String(payment.id),
          status: 'completed'
        }]);

        const { data: campaign } = await supabase
          .from('campaigns')
          .select('recaudado, donantes_count, owner_id, titulo')
          .eq('id', campaign_id)
          .single();
        
        if (campaign) {
          await supabase.from('campaigns').update({
            recaudado: (Number(campaign.recaudado) || 0) + amountCause,
            donantes_count: (Number(campaign.donantes_count) || 0) + 1
          }).eq('id', campaign_id);

          // ENVIAR CORREOS CON AWAIT PARA EVITAR CIERRE DE PROCESO
          if (donor_email) {
            try {
              await Mailer.sendDonationReceipt(donor_email, donor_name || 'Amigo de Donia', amountCause, campaign.titulo, campaign_id);
              logger.info("WEBHOOK_DONOR_MAIL_SENT", { donor_email });
            } catch (e) {
              logger.error("WEBHOOK_DONOR_MAIL_FAIL", e);
            }
          }

          try {
            const { data: authOwner } = await (supabase.auth as any).admin.getUserById(campaign.owner_id);
            const { data: ownerProfile } = await supabase.from('profiles').select('full_name').eq('id', campaign.owner_id).single();
            
            if (authOwner?.user?.email) {
              await Mailer.sendOwnerDonationNotification(
                authOwner.user.email,
                ownerProfile?.full_name || 'Creador',
                donor_name || 'Anónimo',
                amountCause,
                campaign.titulo,
                donor_comment
              );
            }
          } catch (e) {
            logger.error("WEBHOOK_OWNER_NOTIFY_FAIL", e);
          }
        }
      }
    }
    return res.status(200).send('OK');
  } catch (error: any) {
    logger.error("WEBHOOK_FATAL_ERROR", error);
    return res.status(500).json({ error: error.message });
  }
}
