// ============================================================
// Enums
// ============================================================

export type OfferType = 'financed' | 'consulting';

export type OfferStatus = 'in_lavorazione' | 'presentata' | 'ferma';

export type OfferOutcome = 'nessuno' | 'approvato' | 'rifiutato';

// ============================================================
// Entità database
// ============================================================

export interface ProjectManager {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  active: boolean;
  created_at: string;
}

export interface FundingCall {
  id: string;
  user_id: string;
  code: string;
  name: string;
  body: string | null;
  deadline: string | null; // ISO date string
  notes: string | null;
  probability: number; // 0-100, tasso di successo stimato del bando
  created_at: string;
}

export interface Offer {
  id: string;
  user_id: string;
  name: string;
  type: OfferType;
  funding_call: string | null;  // solo se type = 'financed'
  client: string | null;        // solo se type = 'consulting'
  deadline: string;             // ISO date string
  budget: number;
  probability: number; // 0-100, probabilità di successo stimata
  project_manager_id: string | null;
  pi: string | null;            // principal investigator
  ente: string | null;          // ente di riferimento
  status: OfferStatus;
  outcome: OfferOutcome;
  submitted_at: string | null;  // ISO date string
  decided_at: string | null;    // ISO date string
  notes: string | null;
  created_at: string;

  // Relazione opzionale (join)
  project_manager?: ProjectManager | null;
}

// ============================================================
// Forme per creazione / modifica
// ============================================================

export type CreateProjectManagerForm = Pick<ProjectManager, 'name' | 'email' | 'active'>;

export type UpdateProjectManagerForm = Partial<CreateProjectManagerForm>;

export type CreateFundingCallForm = Pick<FundingCall, 'code' | 'name' | 'body' | 'deadline' | 'notes' | 'probability'>;

export type UpdateFundingCallForm = Partial<CreateFundingCallForm>;

// Form offerta: union discriminata per garantire i vincoli logici a livello TS
interface OfferFormBase {
  name: string;
  deadline: string;
  budget: number;
  probability: number;
  project_manager_id: string | null;
  pi: string | null;
  ente: string | null;
  status: OfferStatus;
  outcome: OfferOutcome;
  submitted_at: string | null;
  decided_at: string | null;
  notes: string | null;
}

export interface FinancedOfferForm extends OfferFormBase {
  type: 'financed';
  funding_call: string;
  client?: null;
}

export interface ConsultingOfferForm extends OfferFormBase {
  type: 'consulting';
  client: string;
  funding_call?: null;
}

export type CreateOfferForm = FinancedOfferForm | ConsultingOfferForm;

export type UpdateOfferForm = Partial<CreateOfferForm>;

// ============================================================
// Tipi per la Dashboard / Analytics
// ============================================================

export interface AllowedUser {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

export type CreateAllowedUserForm = Pick<AllowedUser, 'email' | 'name'>;

// ============================================================
// Lead — tecnologie in valutazione (pre-offerta)
// ============================================================

export type LeadStatus = 'in_valutazione' | 'promosso' | 'rifiutato';

export interface Lead {
  id: string;
  user_id: string;
  name: string;
  pi: string | null;
  ente: string | null;
  description: string | null;
  status: LeadStatus;
  notes: string | null;
  promoted_offer_id: string | null;
  created_at: string;
}

export interface LeadFile {
  id: string;
  lead_id: string;
  filename: string;
  storage_path: string;
  size: number;
  mime_type: string | null;
  uploaded_at: string;
}

export type CreateLeadForm = Pick<Lead, 'name' | 'pi' | 'ente' | 'description' | 'status' | 'notes'>;
export type UpdateLeadForm = Partial<CreateLeadForm & Pick<Lead, 'promoted_offer_id'>>;

export interface DashboardKPIs {
  totalInOfferta: number;       // somma budget presentate non rifiutate
  inLavorazione: number;        // count offerte in_lavorazione
  inAttesaEsito: number;        // count offerte presentate senza esito
  tassoSuccesso: number | null; // approvati / (approvati + rifiutati), null se nessun dato
}

export interface MonthlyStats {
  month: string;          // "YYYY-MM"
  presentate: number;
  approvate: number;
  rifiutate: number;
  budgetPresentato: number;
}

export interface FundingCallStats {
  funding_call: string;
  totale: number;
  approvate: number;
  rifiutate: number;
  tassoSuccesso: number | null;
}

export interface ProjectManagerStats {
  project_manager_id: string;
  name: string;
  totale: number;
  approvate: number;
  rifiutate: number;
  tassoSuccesso: number | null;
  tempoMedioDecisione: number | null; // giorni medi
}
