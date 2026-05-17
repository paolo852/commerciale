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
  deadline: string | null;
  lead_deadline: string | null;      // scadenza interna per raccolta lead candidates
  internal_deadline: string | null; // scadenza interna per definizione concept
  description: string | null;
  notes: string | null;
  probability: number;
  pdf_path: string | null;
  pdf_filename: string | null;
  source_url: string | null;
  created_at: string;
}

export interface Offer {
  id: string;
  user_id: string;
  name: string;
  type: OfferType;
  funding_call: string | null;  // solo se type = 'financed' (codice bando)
  client: string | null;        // solo se type = 'consulting'
  consulting_call_id: string | null; // opzionale per consulenze legate a un bando
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

export type CreateFundingCallForm = Pick<FundingCall, 'code' | 'name' | 'body' | 'deadline' | 'lead_deadline' | 'internal_deadline' | 'description' | 'notes' | 'probability' | 'source_url'>;

// ============================================================
// Concept files (documenti tecnologia)
// ============================================================

export interface ConceptFile {
  id: string;
  concept_id: string;
  user_id: string;
  filename: string;
  file_path: string;
  file_url: string;
  created_at: string;
}

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
  consulting_call_id?: string | null;
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

export interface ConceptTemplateData {
  // Cover metadata
  project_name: string;
  lead_organisation: string;
  authors: string;
  trl_current: string;
  version: string;
  // 1.1 Technology
  tech_description: string;
  // 1.2 Product (new template)
  product_description: string;
  // 1.2 Current TRL and evidence
  trl_justification: string;
  trl_evidence: string;
  trl_gaps: string;
  trl_next_milestone: string;
  // 1.3 IP
  ip: string;
  // 2.1 Problem
  problem_statement: string;
  // 2.2 Value proposition (single field, new template)
  value_proposition: string;
  // 3.1 Market
  tam: string;
  sam: string;
  som: string;
  // 4.1 Roadmap
  roadmap: string;
  // 5. Risks
  risk_assumptions: string;
  // Fields approved/locked by a reviewer
  locked_fields: string[];
  // Section-2 validation status per field
  validation_status: Record<string, 'ipotesi' | 'validato'>;
  validation_how: Record<string, string>;
}

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
  concept_data: ConceptTemplateData | null;
  created_at: string;
  assignees?: ConceptAssignee[];
}

export type CreateConceptForm = Pick<Concept, 'name' | 'pi' | 'ente' | 'description' | 'status' | 'notes'>;
export type UpdateConceptForm = Partial<CreateConceptForm & Pick<Concept, 'promoted_offer_id' | 'concept_data'>>;

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

export interface ConceptFieldComment {
  id: string;
  concept_id: string;
  field_key: string;
  parent_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

export type CreateConceptFieldCommentForm = Pick<
  ConceptFieldComment,
  'field_key' | 'parent_id' | 'author_name' | 'body'
>;

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
// Tasks
// ============================================================

export interface Task {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  pm_id: string | null;
  entity_id: string | null;
  entity_type: 'lead' | 'concept' | 'offer' | null;
  due_date: string | null;
  completed: boolean;
  created_at: string;
}

export type CreateTaskForm = Pick<Task, 'title' | 'body' | 'pm_id' | 'entity_id' | 'entity_type' | 'due_date'>;

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
