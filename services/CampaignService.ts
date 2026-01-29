
import { SupabaseClient } from '@supabase/supabase-js';
import { CampaignData, Donation, FinancialSummary, Withdrawal, CampaignStatus } from '../types';
import { AuthService } from './AuthService';

export class CampaignService {
  private static instance: CampaignService;
  private aiEnabled: boolean = false;
  private initPromise: Promise<void> | null = null;
  private localCampaigns: CampaignData[] = [];

  private constructor() {
    try {
      const saved = localStorage.getItem('donia_local_campaigns');
      if (saved) {
        this.localCampaigns = JSON.parse(saved);
      }
    } catch (e) {}
  }

  public static getInstance(): CampaignService {
    if (!CampaignService.instance) {
      CampaignService.instance = new CampaignService();
    }
    return CampaignService.instance;
  }

  private get supabase(): SupabaseClient | null {
    return AuthService.getInstance().getSupabase();
  }

  public async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
         await AuthService.getInstance().initialize();
         await this.fetchServerConfig();
      } catch (e) {
         console.warn("Failed to initialize CampaignService: Server config fetch failed.", e);
      }
    })();
    return this.initPromise;
  }

  private async fetchServerConfig() {
     try {
        const resp = await fetch('/api/config', { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        if (resp.ok) {
          const config = await resp.json();
          this.aiEnabled = !!config.aiEnabled;
        }
      } catch (netError: any) {
        this.aiEnabled = false; 
        // LOGGING
        console.error(JSON.stringify({ event: 'CAMPAIGN_CONFIG_FETCH_ERROR', timestamp: new Date().toISOString(), error: netError.message }));
      }
  }

  public checkAiAvailability(): boolean { return this.aiEnabled; }
  public getConnectionStatus(): 'cloud' | 'local' { return this.supabase ? 'cloud' : 'local'; }

  private mapCampaign(c: any): CampaignData {
    const dbGallery = Array.isArray(c.gallery_urls) ? c.gallery_urls : [];
    const finalImages = dbGallery.length > 0 ? dbGallery : [c.imagen_url || c.imagenUrl];

    return {
      id: c.id,
      titulo: c.titulo || 'Sin título',
      historia: c.historia || '',
      monto: Number(c.monto || 0),
      recaudado: Number(c.recaudado || 0),
      categoria: c.categoria || 'General',
      ubicacion: c.ubicacion || 'Chile',
      ciudad: c.ciudad,
      fechaCreacion: c.fecha_creacion || c.fechaCreacion || new Date().toISOString(),
      fechaTermino: c.fecha_termino || c.fechaTermino,
      duracionDias: c.duracion_dias || c.duracionDias,
      imagenUrl: c.imagen_url || c.imagenUrl || 'https://picsum.photos/800/600',
      images: finalImages,
      estado: c.estado as CampaignStatus || 'activa',
      donantesCount: Number(c.donantes_count || c.donantesCount || 0),
      beneficiarioNombre: c.beneficiario_nombre || c.beneficiarioNombre,
      beneficiarioApellido: c.beneficiario_apellido || c.beneficiarioApellido,
      beneficiarioRelacion: c.beneficiario_relacion || c.beneficiarioRelacion,
      owner_id: c.owner_id,
      donations: c.donations ? c.donations.map((d: any) => ({
        id: d.id,
        campaignId: d.campaign_id,
        monto: Number(d.amount_cause || d.monto || 0),
        amountCause: Number(d.amount_cause || d.monto || 0),
        amountTip: Number(d.amount_tip || 0),
        amountFee: Number(d.amount_fee || 0),
        amountTotal: Number(d.amount_total || d.monto || 0),
        fecha: d.fecha || d.created_at,
        nombreDonante: d.nombre_donante || d.donor_name || 'Anónimo',
        emailDonante: d.donor_email || '',
        comentario: d.comentario,
        donorUserId: d.donor_user_id
      })) : undefined
    };
  }

  async getCampaigns(): Promise<CampaignData[]> {
    await this.initialize();
    try {
      const resp = await fetch('/api/campaigns');
      if (!resp.ok) throw new Error("API Unreachable");
      const json = await resp.json();
      const serverData = (json.data || []).map((c: any) => this.mapCampaign(c));
      const all = [...this.localCampaigns];
      serverData.forEach((sd: any) => {
        if (!all.find(a => a.id === sd.id)) all.unshift(sd);
      });
      return all;
    } catch (e) { 
      // LOGGING
      console.warn(JSON.stringify({ event: 'CAMPAIGNS_FETCH_FAIL', timestamp: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) }));
      return this.localCampaigns; 
    }
  }

  async getUserCampaigns(userId: string): Promise<CampaignData[]> {
    await this.initialize();
    try {
      const resp = await fetch(`/api/user-campaigns?userId=${userId}`);
      if (!resp.ok) throw new Error("API Unreachable");
      const json = await resp.json();
      return (json.data || []).map((c: any) => this.mapCampaign(c));
    } catch (e) { 
      // LOGGING
      console.warn(JSON.stringify({ event: 'USER_CAMPAIGNS_FETCH_FAIL', timestamp: new Date().toISOString(), userId, error: e instanceof Error ? e.message : String(e) }));
      return this.localCampaigns.filter(c => c.owner_id === userId);
    }
  }

  async getUserDonations(userId: string): Promise<Donation[]> {
    await this.initialize();
    try {
      const resp = await fetch(`/api/user-donations?userId=${userId}`);
      if (!resp.ok) return [];
      const json = await resp.json();
      return (json.data || []).map((d: any) => ({
        id: d.id,
        campaignId: d.campaignId || d.campaign_id,
        monto: Number(d.amountCause || d.monto || 0),
        amountCause: Number(d.amountCause || d.monto || 0),
        amountTip: Number(d.amountTip || 0),
        amountFee: Number(d.amountFee || 0),
        amountTotal: Number(d.amountTotal || d.monto || 0),
        fecha: d.fecha || d.created_at,
        nombreDonante: d.nombreDonante || d.nombre_donante || d.donor_name || 'Anónimo',
        emailDonante: d.emailDonante || d.donor_email || '',
        comentario: d.comentario,
        donorUserId: d.donorUserId || d.donor_user_id,
        status: d.status,
        paymentId: d.paymentId || d.payment_id,
        campaign: d.campaign
      }));
    } catch (e) { 
      // LOGGING
      console.error(JSON.stringify({ event: 'USER_DONATIONS_FETCH_FAIL', timestamp: new Date().toISOString(), userId, error: e instanceof Error ? e.message : String(e) }));
      return []; 
    }
  }

  async getCampaignById(id: string): Promise<CampaignData | null> {
    await this.initialize();
    const local = this.localCampaigns.find(c => c.id === id);
    try {
      const resp = await fetch(`/api/campaigns?id=${id}`);
      if (!resp.ok) throw new Error("API error");
      const json = await resp.json();
      if (!json.success || !json.data) return local || null;
      return this.mapCampaign(json.data);
    } catch (e) { 
      // LOGGING
      console.warn(JSON.stringify({ event: 'CAMPAIGN_BY_ID_FETCH_FAIL', timestamp: new Date().toISOString(), campaignId: id, error: e instanceof Error ? e.message : String(e) }));
      return local || null; 
    }
  }

  async createCampaign(campaign: Partial<CampaignData>): Promise<CampaignData> {
      await this.initialize();
      // LOGGING
      console.info(JSON.stringify({ event: 'CAMPAIGN_CREATE_START', timestamp: new Date().toISOString(), owner: campaign.owner_id }));
      try {
        const response = await fetch('/api/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(campaign)
        });
        if (!response.ok) {
           const errJson = await response.json();
           // LOGGING
           console.error(JSON.stringify({ event: 'CAMPAIGN_CREATE_API_ERROR', timestamp: new Date().toISOString(), error: errJson.error }));
           throw new Error(errJson.error || "API Error al crear campaña");
        }
        const json = await response.json();
        if (!json.success) throw new Error(json.error || 'Error creating campaign');
        // LOGGING
        console.info(JSON.stringify({ event: 'CAMPAIGN_CREATE_SUCCESS', timestamp: new Date().toISOString(), campaignId: json.data?.id }));
        return this.mapCampaign(json.data);
      } catch (e) {
        // LOGGING
        console.warn(JSON.stringify({ event: 'CAMPAIGN_CREATE_FALLBACK_LOCAL', timestamp: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) }));
        const newCampaign: CampaignData = {
          ...campaign as any,
          id: `local-${Date.now()}`,
          recaudado: 0,
          donantesCount: 0,
          estado: 'activa',
          fechaCreacion: new Date().toISOString(),
          donations: [],
          images: campaign.images || [campaign.imagenUrl || '']
        };
        const saved = localStorage.getItem('donia_local_campaigns');
        let currentLocal = saved ? JSON.parse(saved) : [];
        currentLocal = [newCampaign, ...currentLocal];
        localStorage.setItem('donia_local_campaigns', JSON.stringify(currentLocal));
        this.localCampaigns = [newCampaign, ...this.localCampaigns];
        return newCampaign;
      }
  }

  async updateCampaign(id: string, userId: string, updates: Partial<CampaignData>): Promise<CampaignData> {
      await this.initialize();
      // LOGGING
      console.info(JSON.stringify({ event: 'CAMPAIGN_UPDATE_START', timestamp: new Date().toISOString(), campaignId: id, userId }));
      const response = await fetch('/api/update-campaign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, userId, updates })
      });
      const json = await response.json();
      if (!json.success) {
        // LOGGING
        console.error(JSON.stringify({ event: 'CAMPAIGN_UPDATE_FAIL', timestamp: new Date().toISOString(), campaignId: id, error: json.error }));
        throw new Error(json.error || 'Error updating campaign');
      }
      // LOGGING
      console.info(JSON.stringify({ event: 'CAMPAIGN_UPDATE_SUCCESS', timestamp: new Date().toISOString(), campaignId: id }));
      return this.mapCampaign(json.data);
  }

  async cancelCampaign(campaignId: string, userId: string, otpCode?: string): Promise<CampaignData> {
    await this.initialize();
    // LOGGING
    console.info(JSON.stringify({ event: 'CAMPAIGN_CANCEL_START', timestamp: new Date().toISOString(), campaignId, userId, hasOtp: !!otpCode }));
    const response = await fetch('/api/cancel-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, userId, otpCode })
    });
    const json = await response.json();
    if (!json.success) {
      // LOGGING
      console.error(JSON.stringify({ event: 'CAMPAIGN_CANCEL_FAIL', timestamp: new Date().toISOString(), campaignId, error: json.error }));
      throw new Error(json.error || 'Error cancelando campaña');
    }
    // LOGGING
    console.info(JSON.stringify({ event: 'CAMPAIGN_CANCEL_SUCCESS', timestamp: new Date().toISOString(), campaignId }));
    return this.mapCampaign(json.data);
  }

  async deleteCampaign(id: string, userId: string): Promise<boolean> {
      await this.initialize();
      // LOGGING
      console.info(JSON.stringify({ event: 'CAMPAIGN_DELETE_ATTEMPT', timestamp: new Date().toISOString(), campaignId: id, userId }));
      try {
        const response = await fetch('/api/delete-campaign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, userId })
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || 'Error eliminando campaña');
        // LOGGING
        console.info(JSON.stringify({ event: 'CAMPAIGN_DELETE_SUCCESS', timestamp: new Date().toISOString(), campaignId: id }));
        return true;
      } catch (e) {
        // LOGGING
        console.error(JSON.stringify({ event: 'CAMPAIGN_DELETE_ERROR', timestamp: new Date().toISOString(), campaignId: id, error: e instanceof Error ? e.message : String(e) }));
        throw e;
      }
  }

  async uploadImage(base64: string, name: string): Promise<string> {
      await this.initialize();
      // LOGGING
      console.info(JSON.stringify({ event: 'IMAGE_UPLOAD_START', timestamp: new Date().toISOString(), name, size: base64.length }));
      try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64, name })
        });
        if (!response.ok) {
          const errJson = await response.json();
          // LOGGING
          console.error(JSON.stringify({ event: 'IMAGE_UPLOAD_API_ERROR', timestamp: new Date().toISOString(), error: errJson.error }));
          throw new Error(errJson.error || "Upload failed");
        }
        const json = await response.json();
        if (!json.success) throw new Error(json.error);
        // LOGGING
        console.info(JSON.stringify({ event: 'IMAGE_UPLOAD_SUCCESS', timestamp: new Date().toISOString(), url: json.url }));
        return json.url;
      } catch (e) {
        // LOGGING
        console.error(JSON.stringify({ event: 'IMAGE_UPLOAD_EXCEPTION', timestamp: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) }));
        throw e;
      }
  }

  async polishStory(story: string): Promise<string> {
      await this.initialize();
      if (!this.aiEnabled) {
        return story;
      }
      // LOGGING
      console.info(JSON.stringify({ event: 'AI_POLISH_START', timestamp: new Date().toISOString(), storyLength: story.length }));
      try {
          const response = await fetch('/api/polish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ story })
          });
          if (!response.ok) {
            const errJson = await response.json();
            // LOGGING
            console.warn(JSON.stringify({ event: 'AI_POLISH_API_ERROR', timestamp: new Date().toISOString(), error: errJson.error }));
            throw new Error(errJson.error || "AI polishing failed");
          }
          const json = await response.json();
          // LOGGING
          console.info(JSON.stringify({ event: 'AI_POLISH_SUCCESS', timestamp: new Date().toISOString() }));
          return json.text || story;
      } catch (e) { 
        // LOGGING
        console.warn(JSON.stringify({ event: 'AI_POLISH_FALLBACK', timestamp: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) }));
        return story; 
      }
  }

  async requestWithdrawal(userId: string, campaignId: string, monto: number, otpCode: string): Promise<any> {
    await this.initialize();
    // LOGGING
    console.info(JSON.stringify({ event: 'WITHDRAWAL_REQUEST_START', timestamp: new Date().toISOString(), userId, campaignId, monto }));
    try {
      const response = await fetch('/api/request-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, campaignId, monto, otpCode })
      });
      const json = await response.json();
      if (!json.success) {
        // LOGGING
        console.error(JSON.stringify({ event: 'WITHDRAWAL_REQUEST_FAIL', timestamp: new Date().toISOString(), userId, error: json.error }));
        throw new Error(json.error || "Error solicitando retiro.");
      }
      // LOGGING
      console.info(JSON.stringify({ event: 'WITHDRAWAL_REQUEST_SUCCESS', timestamp: new Date().toISOString(), userId, requestId: json.data?.id }));
      return json.data;
    } catch (e) {
      // LOGGING
      console.error(JSON.stringify({ event: 'WITHDRAWAL_REQUEST_EXCEPTION', timestamp: new Date().toISOString(), userId, error: e instanceof Error ? e.message : String(e) }));
      throw e;
    }
  }

  async getFinancialSummary(userId: string): Promise<FinancialSummary & { enCursoNoDisponible: number }> {
      await this.initialize();
      try {
        const response = await fetch(`/api/financial-summary?userId=${userId}&type=summary`);
        if (!response.ok) {
          const errJson = await response.json();
          throw new Error(errJson.error || 'Failed to fetch financial summary');
        }
        const json = await response.json();
        return json.data;
      } catch (e) {
        console.error("Error fetching financial summary:", e);
        return {
          totalRecaudado: 0,
          disponibleRetiro: 0,
          enProceso: 0,
          totalRetirado: 0,
          enCursoNoDisponible: 0
        };
      }
  }

  async getWithdrawals(userId: string): Promise<Withdrawal[]> {
      await this.initialize();
      try {
        const response = await fetch(`/api/withdrawals?userId=${userId}`);
        if (!response.ok) {
          const errJson = await response.json();
          throw new Error(errJson.error || 'Failed to fetch withdrawals');
        }
        const json = await response.json();
        return json.data || [];
      } catch (e) { 
        console.error("Error fetching withdrawals:", e);
        return []; 
      }
  }
}
