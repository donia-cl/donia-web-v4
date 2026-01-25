
import { logger } from './_utils.js';

export interface ZohoTicket {
  subject: string;
  contactName: string;
  email: string;
  description: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  classification?: string;
}

export class ZohoService {
  private static async getAccessToken(): Promise<string> {
    const clientId = process.env.ZOHO_CLIENT_ID?.trim();
    const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN?.trim();

    if (!clientId || !clientSecret || !refreshToken) {
      logger.error('ZOHO_CREDENTIALS_MISSING', new Error("Faltan variables OAuth de Zoho."));
      throw new Error("Credenciales de Zoho OAuth incompletas.");
    }

    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    });

    const resp = await fetch(`https://accounts.zoho.com/oauth/v2/token?${params.toString()}`, {
      method: 'POST'
    });

    const data = await resp.json();
    if (!resp.ok || !data.access_token) {
      logger.error('ZOHO_AUTH_TOKEN_FAIL', data);
      throw new Error("No se pudo obtener el token de acceso de Zoho.");
    }

    return data.access_token;
  }

  public static async createTicket(ticket: ZohoTicket) {
    try {
      const accessToken = await this.getAccessToken();
      const orgId = process.env.ZOHO_ORG_ID?.trim();
      const deptId = process.env.ZOHO_DEPT_ID?.trim();

      if (!orgId || !deptId) {
        logger.error('ZOHO_CONFIG_IDS_MISSING', new Error("Falta ZOHO_ORG_ID o ZOHO_DEPT_ID."));
        throw new Error("Configuración de OrgID o DeptID de Zoho ausente.");
      }

      // Log preventivo para ver longitud de IDs (ayuda a depurar sin exponer el ID completo)
      logger.info('ZOHO_ATTEMPT_CREATE', { 
        orgIdLength: orgId.length, 
        deptIdLength: deptId.length,
        subject: ticket.subject 
      });

      const payload = {
        subject: ticket.subject,
        contact: {
          lastName: ticket.contactName,
          email: ticket.email
        },
        departmentId: deptId,
        description: ticket.description,
        priority: ticket.priority || 'Medium',
        classification: ticket.classification || 'None',
        channel: 'Web'
      };

      const resp = await fetch('https://desk.zoho.com/api/v1/tickets', {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'orgId': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await resp.json();
      if (!resp.ok) {
        // Log detallado del error de la API de Zoho
        logger.error('ZOHO_API_RESPONSE_ERROR', result, { orgIdUsed: orgId });
        throw new Error(result.message || "Error al crear ticket en Zoho Desk");
      }

      logger.info('ZOHO_TICKET_CREATED_SUCCESS', { ticketId: result.id });
      return result;
    } catch (error: any) {
      logger.error('ZOHO_SERVICE_FATAL', error);
      throw error;
    }
  }
}
