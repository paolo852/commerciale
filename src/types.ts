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
  description: string | null; // testo del bando (usato da Gemini per il matching)
  notes: string | null;
  probability: number; // 0-100, tasso di successo stimato del bando
  pdf_path: string | null;
  pdf_filename: string | null;
  source_url: string | null; // URL di origine (es. EU Participant Portal)
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

export type CreateFundingCallForm = Pick<FundingCall, 'code' | 'name' | 'body' | 'deadline' | 'description' | 'notes' | 'probability' | 'source_url'>;

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
// Concept — Concept Development (ex Lead)
// ============================================================

export type ConceptStatus = 'in_valutazione' | 'promosso' | 'rifiutato';

export interface Concept {
  id: string;
  user_id: string;
  name: string;
  pi: string | null;
  ente: string | null;
  description: string | null;
  status: ConceptStatus;
  notes: string | null;
  promoted_offer_id: string | null;
  created_at: string;
  assignees?: ConceptAssignee[];
}

export type CreateConceptForm = Pick<Concept, 'name' | 'pi' | 'ente' | 'description' | 'status' | 'notes'>;
export type UpdateConceptForm = Partial<CreateConceptForm & Pick<Concept, 'promoted_offer_id'>>;

export interface ConceptAssignee {
  concept_id: string;
  project_manager_id: string;
  added_at: string;
  project_manager?: ProjectManager | null;
}

export interface ConceptVersion {
  id: string;
  concept_id: string;
  version_number: number;
  filename: string;
  storage_path: string;
  size: number;
  mime_type: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  note: string | null;
  uploader?: ProjectManager | null;
}

export interface ConceptVersionComment {
  id: string;
  version_id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  mentions: string[]; // array di project_manager IDs
  created_at: string;
}

export interface ConceptRevisionDeadline {
  id: string;
  concept_id: string;
  label: string;
  due_date: string; // ISO date
  completed: boolean;
  notes: string | null;
  created_at: string;
}

export interface ConceptMatch {
  id: string;
  concept_id: string;
  funding_call_id: string;
  score: number; // 0-100
  rationale: string | null;
  analyzed_at: string;
}

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

// ============================================================
// Lead Candidates — fase pre-concept
// ============================================================

export type LeadCandidateStatus = 'attivo' | 'promosso' | 'archiviato';

export interface LeadCandidate {
  id: string;
  user_id: string;
  researcher_name: string;
  institution: string | null;
  call_type: string;
  funding_call_id: string | null;
  potential_project: string | null;
  status: LeadCandidateStatus;
  promoted_concept_id: string | null;
  pm_id: string | null;
  created_at: string;
}

export type CreateLeadCandidateForm = Pick<
  LeadCandidate,
  'researcher_name' | 'institution' | 'call_type' | 'funding_call_id' | 'potential_project' | 'status' | 'pm_id'
>;
export type UpdateLeadCandidateForm = Partial<CreateLeadCandidateForm & Pick<LeadCandidate, 'promoted_concept_id'>>;

// ============================================================
// Notifications
// ============================================================

export type NotificationType =
  | 'lead_promoted'
  | 'lead_archived'
  | 'offer_deadline'
  | 'concept_status_changed';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_id: string | null;
  entity_type: 'lead' | 'concept' | 'offer' | null;
  read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  in_app_lead_promoted: boolean;
  in_app_lead_archived: boolean;
  in_app_offer_deadline: boolean;
  in_app_concept_status: boolean;
  email_lead_promoted: boolean;
  email_lead_archived: boolean;
  email_offer_deadline: boolean;
  email_concept_status: boolean;
  deadline_days_before: number;
}

export interface LeadUpdate {
  id: string;
  lead_id: string;
  body: string;
  author_id: string | null;
  author_name: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
}
