
import { createClient } from '@supabase/supabase-js';
import { Mailer, logger, Validator, getCanonicalBackendBaseUrl, calculateEffectiveStatus } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, payment_id } = req.query;
  const accessToken = process.env.MP_ACCESS_TOKEN;
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!accessToken || !supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ success: false, error: "Error de configuración." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  async function processPaymentRecord(pId: string) {
    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${pId}`, { 
      headers: { 'Authorization': `Bearer ${accessToken}` } 
    });
    
    if (!mpResp.ok) throw new Error(`Mercado Pago API Error`);
    const payment = await mpResp.json();
    
    if (payment.status === 'approved') {
      const metadata = payment.metadata || {};
      const { campaign_id, donor_name, donor_comment, donor_email, donor_user_id, base_amount, tip_amount, fee_amount } = metadata;
      
      const totalPaid = Number(payment.transaction_amount);
      const finalCauseAmount = Number(base_amount || totalPaid);
      const finalTipAmount = Number(tip_amount || 0);
      const finalFeeAmount = Number(fee_amount || (totalPaid - finalCauseAmount - finalTipAmount));

      const { data: existing } = await supabase.from('donations').select('id').eq('payment_id', String(payment.id)).maybeSingle();
      
      if (!existing) {
        await supabase.from('donations').insert([{ 
          campaign_id, 
          monto: finalCauseAmount,
          amount_cause: finalCauseAmount,
          amount_tip: finalTipAmount,
          amount_fee: finalFeeAmount,
          amount_total: totalPaid,
          donor_email: donor_email,
          nombre_donante: donor_name || 'Anónimo', 
          donor_user_id: donor_user_id || null,
          comentario: donor_comment,
          payment_provider: 'mercado_pago',
          payment_id: String(payment.id),
          status: 'completed'
        }]);
        
        const { data: campaign } = await supabase.from('campaigns').select('recaudado, donantes_count, titulo').eq('id', campaign_id).single();
        if (campaign) {
          await supabase.from('campaigns').update({ 
            recaudado: (Number(campaign.recaudado) || 0) + finalCauseAmount, 
            donantes_count: (Number(campaign.donantes_count) || 0) + 1 
          }).eq('id', campaign_id);

          if (donor_email) {
            try {
              await Mailer.sendDonationReceipt(donor_email, donor_name || 'Donante', finalCauseAmount, campaign.titulo, campaign_id, req);
            } catch (e) {
              logger.error('PREFERENCE_VERIFY_MAIL_ERROR', e);
            }
          }
        }
      }
      return { success: true, amount_cause: finalCauseAmount, amount_tip: finalTipAmount, amount_fee: finalFeeAmount, amount_total: totalPaid, donor_email: donor_email };
    }
    return { success: false, status: payment.status };
  }

  if (action === 'verify') {
    try {
      Validator.required(payment_id, 'payment_id');
      return res.status(200).json(await processPaymentRecord(String(payment_id)));
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (action === 'preference' && req.method === 'POST') {
    const { campaignId, monto, nombre, comentario, campaignTitle, email, donorUserId, base_amount, tip_amount, fee_amount } = req.body; 

    try {
      Validator.uuid(campaignId, 'campaignId');
      Validator.number(monto, 500, 'monto');
      Validator.email(email);

      const { data: campaign } = await supabase.from('campaigns').select('estado, fecha_termino').eq('id', campaignId).single();
      if (!campaign) throw new Error("Campaña no encontrada.");
      
      const effectiveStatus = calculateEffectiveStatus(campaign);
      if (effectiveStatus !== 'activa') {
        throw new Error(`Esta campaña no puede recibir donaciones en este momento (Estado: ${effectiveStatus}).`);
      }

      const baseUrl = getCanonicalBackendBaseUrl(req);
      const preferencePayload = { 
        items: [{ id: campaignId, title: `Donación Donia: ${campaignTitle}`, quantity: 1, unit_price: Math.round(Number(monto)), currency_id: 'CLP' }], 
        payer: { email: email.trim(), name: (nombre || 'Donante').substring(0, 50) },
        metadata: { campaign_id: campaignId, donor_name: nombre || 'Anónimo', donor_comment: comentario || '', donor_email: email, donor_user_id: donorUserId || null, base_amount: Number(base_amount || monto), tip_amount: Number(tip_amount || 0), fee_amount: Number(fee_amount || 0) }, 
        back_urls: { success: `${baseUrl}/campana/${campaignId}/donar`, failure: `${baseUrl}/campana/${campaignId}/donar`, pending: `${baseUrl}/campana/${campaignId}/donar` }, 
        auto_return: 'approved',
        binary_mode: true
      };

      const resp = await fetch('https://api.mercadopago.com/checkout/preferences', { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, 
        body: JSON.stringify(preferencePayload) 
      });
      
      const data = await resp.json();
      return res.status(200).json({ success: true, preference_id: data.id, init_point: data.init_point });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(404).json({ success: false, error: 'Acción no válida.' });
}
