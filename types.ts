
export type CampaignStatus = 'borrador' | 'activa' | 'finalizada' | 'en_revision' | 'pausada' | 'cancelada';

export interface Profile {
  id: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  rut?: string;
  phone?: string;
  region?: string;
  city?: string;
  role: 'user' | 'admin' | 'reviewer';
  is_verified: boolean;
  email_verified: boolean;
  two_factor_enabled: boolean; // Estado de 2FA
}

export interface CampaignData {
  id: string;
  titulo: string;
  historia: string;
  monto: number;
  recaudado: number;
  categoria: string;
  ubicacion: string;
  ciudad?: string;
  fechaCreacion: string;
  fechaTermino?: string;
  duracionDias?: number;
  imagenUrl: string;
  images: string[];
  estado: CampaignStatus;
  donantesCount: number;
  beneficiarioNombre?: string;
  beneficiarioApellido?: string;
  beneficiarioRelacion?: string;
  donations?: Donation[];
  owner_id?: string;
}

export interface Donation {
  id: string;
  campaignId: string;
  monto: number;
  amountCause: number;
  amountTip: number;
  amountFee: number;
  amountTotal: number;
  fecha: string;
  nombreDonante: string;
  emailDonante: string;
  comentario?: string;
  donorUserId?: string;
  status?: 'completed' | 'refunded' | 'pending';
  paymentId?: string;
  campaign?: {
    titulo: string;
    imagenUrl: string;
    beneficiarioNombre?: string;
  };
}

export interface Withdrawal {
  id: string;
  monto: number;
  fecha: string;
  estado: 'pendiente' | 'completado' | 'rechazado';
  campaignId: string;
  campaignTitle: string;
}

export interface FinancialSummary {
  totalRecaudado: number;
  disponibleRetiro: number;
  enProceso: number;
  totalRetirado: number;
}

export type WizardStep = 'intro' | 'historia' | 'detalles' | 'revisar';
