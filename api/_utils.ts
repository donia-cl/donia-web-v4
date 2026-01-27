import { Resend } from 'resend';

// rateLimitMap for in-memory rate limiting
const rateLimitMap = new Map<string, { count: number, lastReset: number }>();

export const checkRateLimit = (ip: string, limit: number = 10, windowMs: number = 60000) => {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, lastReset: now };

  if (now - record.lastReset > windowMs) {
    record.count = 0;
    record.lastReset = now;
  }

  record.count++;
  rateLimitMap.set(ip, record);

  if (record.count > limit) {
    console.error(`[DONIA-ERROR] RATE-LIMIT: Exceeded for IP: ${ip}`);
    throw new Error('Demasiadas solicitudes. Intente nuevamente en unos minutos.');
  }
};

export function calculateEffectiveStatus(campaign: any): string {
  if (!campaign) return 'borrador';
  const status = campaign.estado || campaign.status || 'borrador';
  const endDateStr = campaign.fecha_termino || campaign.fechaTermino;
  
  // Terminal and explicit states override time-based logic
  if (['finalizada', 'pausada', 'en_revision', 'cancelada'].includes(status)) return status;
  
  if (status === 'activa' && endDateStr) {
    const now = new Date();
    const endDate = new Date(endDateStr);
    if (!isNaN(endDate.getTime()) && endDate < now) return 'finalizada';
  }
  return status === 'activa' ? 'activa' : status;
}

export const logger = {
  info: (action: string, meta: any = {}) => {
    console.log(JSON.stringify({ level: 'INFO', timestamp: new Date().toISOString(), action, ...meta }));
  },
  warn: (action: string, error: any = null, meta: any = {}) => {
    console.warn(JSON.stringify({ level: 'WARN', timestamp: new Date().toISOString(), action, message: error?.message || error, ...meta }));
  },
  error: (action: string, error: any, meta: any = {}) => {
    console.error(JSON.stringify({ level: 'ERROR', timestamp: new Date().toISOString(), action, message: error?.message || (typeof error === 'string' ? error : 'Unknown Error'), stack: error?.stack, ...meta }));
  },
  audit: (userId: string, action: string, resourceId: string, details: any = {}) => {
    console.log(JSON.stringify({ level: 'AUDIT', timestamp: new Date().toISOString(), userId, action, resourceId, ...details }));
  }
};

export function getCanonicalBackendBaseUrl(req?: any): string {
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  if (host) {
    const protocol = req.headers?.['x-forwarded-proto'] || 'https';
    return `${protocol}://${host}`;
  }
  if (process.env.CANONICAL_BASE_URL) return process.env.CANONICAL_BASE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://donia.cl';
}

export class Mailer {
  private static getResend() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY no configurada.');
    return new Resend(apiKey);
  }

  private static getHtmlLayout(content: string) {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
          .wrapper { background-color: #f8fafc; padding: 40px 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 32px; overflow: hidden; border: 1px solid #e2e8f0; }
          .header { background-color: #7c3aed; padding: 40px; text-align: center; }
          .logo { font-size: 28px; font-weight: 900; color: #ffffff; text-decoration: none; }
          .content { padding: 40px; color: #1e293b; line-height: 1.6; }
          .footer { background-color: #f8fafc; padding: 40px; text-align: center; border-top: 1px solid #f1f5f9; }
          .otp-code { font-size: 48px; font-weight: 900; color: #7c3aed; text-align: center; letter-spacing: 12px; margin: 30px 0; padding: 20px; background: #f5f3ff; border-radius: 20px; border: 2px dashed #c4b5fd; }
          .button { display: inline-block; padding: 16px 36px; background-color: #7c3aed; color: #ffffff !important; border-radius: 16px; font-weight: 800; text-decoration: none; }
          .footer-text { font-size: 12px; color: #94a3b8; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header"><a href="https://donia.cl" class="logo">💜 DONIA</a></div>
            <div class="content">${content}</div>
            <div class="footer">
              <p class="footer-text"><strong>Donia Chile SpA</strong></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private static async send(payload: any) {
    const resend = this.getResend();
    const { data, error } = await resend.emails.send(payload);
    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Genera el token de verificación en la tabla email_verifications y envía el correo.
   */
  static async generateAndSendVerification(supabase: any, userId: string, email: string, fullName: string, req?: any) {
    try {
      // 1. Limpiar cualquier token pendiente no consumido
      await supabase.from('email_verifications').delete().eq('user_id', userId).is('consumed_at', null);

      // 2. Crear nuevo token de verificación
      const { data: verification, error: vError } = await supabase
        .from('email_verifications')
        .insert([{ 
          user_id: userId, 
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
        }])
        .select()
        .single();

      if (vError) throw vError;

      // 3. Construir link
      const baseUrl = getCanonicalBackendBaseUrl(req);
      const verifyLink = `${baseUrl}/api/verify-token?token=${verification.token}`;
      
      // 4. Enviar
      await this.sendAccountVerification(email, fullName, verifyLink);
      
      logger.info('VERIFICATION_TRIGGERED_SUCCESS', { email, userId });
      return true;
    } catch (err) {
      logger.error('VERIFICATION_TRIGGER_FAIL', err);
      return false;
    }
  }

  static async sendSecurityOTP(to: string, userName: string, code: string, action: string) {
    const body = `
      <h1>Código de Seguridad</h1>
      <p>Hola ${userName}, para autorizar el <strong>${action}</strong> en tu cuenta de Donia, utiliza el siguiente código de verificación:</p>
      <div class="otp-code">${code}</div>
      <p style="text-align: center; color: #64748b; font-size: 14px;">Este código expirará en 10 minutos.</p>
    `;
    return this.send({ from: 'Donia Seguridad <seguridad@notifications.donia.cl>', to, subject: `Código de verificación: ${code}`, html: this.getHtmlLayout(body) });
  }

  // Added missing send2FACode method to fix compile error in api/security-otp.ts
  static async send2FACode(to: string, userName: string, code: string) {
    const body = `
      <h1>Código de Verificación (2FA)</h1>
      <p>Hola ${userName}, utiliza el siguiente código para completar tu inicio de sesión en Donia:</p>
      <div class="otp-code">${code}</div>
      <p style="text-align: center; color: #64748b; font-size: 14px;">Este código expirará en 10 minutos.</p>
    `;
    return this.send({ from: 'Donia Seguridad <seguridad@notifications.donia.cl>', to, subject: `Tu código de acceso: ${code}`, html: this.getHtmlLayout(body) });
  }

  static async sendDonationReceipt(to: string, userName: string, amount: number, campaignTitle: string, campaignId: string, req?: any) {
    const body = `<h1>¡Gracias por tu apoyo!</h1><p>Hola ${userName}, recibimos con éxito tu donación para la campaña <strong>"${campaignTitle}"</strong>.</p><div style="font-size: 40px; font-weight: 900; color: #7c3aed; margin: 20px 0;">$${amount.toLocaleString('es-CL')}</div><div style="text-align: center;"><a href="${getCanonicalBackendBaseUrl(req)}/campana/${campaignId}" class="button">Ver campaña</a></div>`;
    return this.send({ from: 'Donia <pagos@notifications.donia.cl>', to, subject: 'Recibo de tu donación en Donia', html: this.getHtmlLayout(body) });
  }

  static async sendOwnerDonationNotification(to: string, ownerName: string, donorName: string, amount: number, campaignTitle: string, comment?: string, req?: any) {
    const body = `<h1>¡Nueva donación!</h1><p>Hola ${ownerName}, tienes un nuevo aporte de <strong>$${amount.toLocaleString('es-CL')}</strong> en "${campaignTitle}".</p><p>De: <strong>${donorName}</strong></p>${comment ? `<div style="background: #f1f5f9; padding: 20px; border-radius: 16px; border-left: 4px solid #7c3aed;">"${comment}"</div>` : ''}<div style="text-align: center; margin-top: 20px;"><a href="${getCanonicalBackendBaseUrl(req)}/dashboard" class="button">Ir a mi panel</a></div>`;
    return this.send({ from: 'Donia <notificaciones@notifications.donia.cl>', to, subject: '¡Nueva donación en tu campaña!', html: this.getHtmlLayout(body) });
  }

  static async sendCampaignCreatedNotification(to: string, userName: string, campaignTitle: string, campaignId: string, req?: any) {
    const body = `<h1>¡Campaña activa!</h1><p>Hola ${userName}, "${campaignTitle}" ya está lista.</p><div style="text-align: center;"><a href="${getCanonicalBackendBaseUrl(req)}/campana/${campaignId}" class="button">Ver mi campaña</a></div>`;
    return this.send({ from: 'Donia <notificaciones@notifications.donia.cl>', to, subject: '¡Tu campaña ya está activa!', html: this.getHtmlLayout(body) });
  }

  static async sendAccountVerification(to: string, userName: string, link: string) {
    const body = `
      <h1>¡Activa tu cuenta!</h1>
      <p>Hola ${userName}, bienvenido a Donia. Para poder publicar tu primera campaña y recibir fondos, necesitamos que valides tu correo haciendo clic en el siguiente botón:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${link}" class="button">Validar mi correo</a>
      </div>
      <p style="font-size: 11px; color: #94a3b8; text-align: center;">Si el botón no funciona, copia y pega este enlace: ${link}</p>
    `;
    return this.send({ from: 'Donia <bienvenida@notifications.donia.cl>', to, subject: 'Activa tu cuenta en Donia Chile', html: this.getHtmlLayout(body) });
  }

  static async sendWelcomeNotification(to: string, userName: string, req?: any) {
    const body = `<h1>¡Hola ${userName}!</h1><p>Cuenta creada exitosamente en Donia Chile.</p>`;
    return this.send({ from: 'Donia <bienvenida@notifications.donia.cl>', to, subject: '¡Bienvenido a Donia!', html: this.getHtmlLayout(body) });
  }
  
  static async sendCampaignUpdatedNotification(to: string, userName: string, campaignTitle: string, campaignId: string, req?: any) {
    const body = `<h1>Campaña actualizada</h1><p>Hola ${userName}, cambios guardados en "${campaignTitle}".</p>`;
    return this.send({ from: 'Donia <notificaciones@notifications.donia.cl>', to, subject: 'Actualización de campaña', html: this.getHtmlLayout(body) });
  }

  static async sendCampaignPausedNotification(to: string, userName: string, campaignTitle: string) {
    const body = `<h1>Campaña Pausada</h1><p>Hola ${userName}, tu campaña <strong>"${campaignTitle}"</strong> ha sido pausada temporalmente.</p>`;
    return this.send({ from: 'Donia <notificaciones@notifications.donia.cl>', to, subject: 'Tu campaña ha sido pausada', html: this.getHtmlLayout(body) });
  }

  static async sendCampaignResumedNotification(to: string, userName: string, campaignTitle: string, campaignId: string, req?: any) {
    const body = `<h1>Campaña Reanudada</h1><p>Hola ${userName}, tu campaña <strong>"${campaignTitle}"</strong> está activa nuevamente.</p>`;
    return this.send({ from: 'Donia <notificaciones@notifications.donia.cl>', to, subject: 'Tu campaña ha sido reanudada', html: this.getHtmlLayout(body) });
  }

  static async sendCampaignCancelledNotification(to: string, userName: string, campaignTitle: string) {
    const body = `<h1>Campaña Cancelada</h1><p>Hola ${userName}, confirmamos que tu campaña <strong>"${campaignTitle}"</strong> ha sido cancelada definitivamente.</p>`;
    return this.send({ from: 'Donia <notificaciones@notifications.donia.cl>', to, subject: 'Tu campaña ha sido cancelada', html: this.getHtmlLayout(body) });
  }

  static async sendProfileUpdateNotification(to: string, userName: string, req?: any) {
    const body = `<h1>Perfil actualizado</h1><p>Hola ${userName}, tus datos han sido actualizados.</p>`;
    return this.send({ from: 'Donia <notificaciones@notifications.donia.cl>', to, subject: 'Perfil actualizado', html: this.getHtmlLayout(body) });
  }

  static async sendSecurityUpdateNotification(to: string, userName: string, field: string, req?: any) {
    const body = `<h1>Aviso de seguridad</h1><p>Hola ${userName}, se actualizó: <strong>${field}</strong>.</p>`;
    return this.send({ from: 'Donia Seguridad <seguridad@notifications.donia.cl>', to, subject: 'Cambio en tu perfil', html: this.getHtmlLayout(body) });
  }

  static async sendPasswordChangedNotification(to: string, userName: string, req?: any) {
    const body = `<h1>Contraseña cambiada</h1><p>Hola ${userName}, tu contraseña ha sido actualizada exitosamente.</p>`;
    return this.send({ from: 'Donia Seguridad <seguridad@notifications.donia.cl>', to, subject: 'Tu contraseña ha sido cambiada', html: this.getHtmlLayout(body) });
  }

  static async sendWithdrawalConfirmation(to: string, userName: string, amount: number, campaignTitle: string, req?: any) {
    const body = `<h1>Retiro en proceso</h1><p>Hola ${userName}, recibimos tu solicitud de $${amount.toLocaleString('es-CL')}.</p>`;
    return this.send({ from: 'Donia <pagos@notifications.donia.cl>', to, subject: 'Retiro en proceso', html: this.getHtmlLayout(body) });
  }
}

export class Validator {
  static email(value: any) { const r = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; if (!r.test(value)) throw new Error(`Email inválido`); }
  static required(value: any, name: string) { if (value === undefined || value === null || value === '') throw new Error(`${name} requerido`); }
  static string(value: any, min: number, name: string) { if (typeof value !== 'string' || value.length < min) throw new Error(`${name} muy corto`); }
  static number(value: any, min: number, name: string) { const n = Number(value); if (isNaN(n) || n < min) throw new Error(`${name} inválido`); }
  static uuid(value: any, name: string) { const r = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i; if (!value || !r.test(value)) throw new Error(`${name} ID inválido`); }
}