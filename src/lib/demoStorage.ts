import type {
  AllowedUser, Offer, ProjectManager, FundingCall,
  Concept, ConceptAssignee, ConceptVersion, ConceptVersionComment, ConceptRevisionDeadline,
  LeadCandidate, LeadUpdate,
  AppNotification, NotificationPreferences, NotificationType,
  Task, ConceptFile,
} from '../types';

// ============================================================
// Demo storage: emula Supabase usando localStorage.
// Attivo quando VITE_SUPABASE_URL/ANON_KEY non sono configurate.
// ============================================================

const KEYS = {
  user: 'commerciale.demo.user',
  offers: 'commerciale.demo.offers',
  projectManagers: 'commerciale.demo.projectManagers',
  fundingCalls: 'commerciale.demo.fundingCalls',
  allowedUsers: 'commerciale.demo.allowedUsers',
  concepts: 'commerciale.demo.concepts',
  conceptAssignees: 'commerciale.demo.conceptAssignees',
  leadCandidates: 'commerciale.demo.leadCandidates',
  leadUpdates: 'commerciale.demo.leadUpdates',
  conceptVersions: 'commerciale.demo.conceptVersions',
  conceptComments: 'commerciale.demo.conceptComments',
  conceptDeadlines: 'commerciale.demo.conceptDeadlines',
  notifications: 'commerciale.demo.notifications',
  notificationPrefs: 'commerciale.demo.notificationPrefs',
  tasks: 'commerciale.demo.tasks',
  conceptFiles: 'commerciale.demo.conceptFiles',
} as const;

export interface DemoUser {
  id: string;
  email: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================
// Auth
// ============================================================

export const demoAuth = {
  getUser(): DemoUser | null {
    return read<DemoUser | null>(KEYS.user, null);
  },
  signIn(email: string): DemoUser {
    const user: DemoUser = { id: 'demo-user', email };
    write(KEYS.user, user);
    return user;
  },
  signOut(): void {
    localStorage.removeItem(KEYS.user);
  },
};

// ============================================================
// Offers
// ============================================================

export const demoOffers = {
  list(): Offer[] {
    return read<Offer[]>(KEYS.offers, []);
  },
  create(input: Omit<Offer, 'id' | 'user_id' | 'created_at'>): Offer {
    const offers = this.list();
    const offer: Offer = {
      ...input,
      id: uuid(),
      user_id: 'demo-user',
      created_at: new Date().toISOString(),
    };
    offers.push(offer);
    write(KEYS.offers, offers);
    return offer;
  },
  update(id: string, patch: Partial<Offer>): Offer | null {
    const offers = this.list();
    const idx = offers.findIndex((o) => o.id === id);
    if (idx < 0) return null;
    offers[idx] = { ...offers[idx], ...patch };
    write(KEYS.offers, offers);
    return offers[idx];
  },
  remove(id: string): void {
    write(KEYS.offers, this.list().filter((o) => o.id !== id));
  },
};

// ============================================================
// Project Managers
// ============================================================

export const demoProjectManagers = {
  list(): ProjectManager[] {
    return read<ProjectManager[]>(KEYS.projectManagers, []);
  },
  create(input: Omit<ProjectManager, 'id' | 'user_id' | 'created_at'>): ProjectManager {
    const items = this.list();
    const item: ProjectManager = {
      ...input,
      id: uuid(),
      user_id: 'demo-user',
      created_at: new Date().toISOString(),
    };
    items.push(item);
    write(KEYS.projectManagers, items);
    return item;
  },
  update(id: string, patch: Partial<ProjectManager>): ProjectManager | null {
    const items = this.list();
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    items[idx] = { ...items[idx], ...patch };
    write(KEYS.projectManagers, items);
    return items[idx];
  },
  remove(id: string): void {
    write(KEYS.projectManagers, this.list().filter((i) => i.id !== id));
  },
};

// ============================================================
// Allowed Users
// ============================================================

export const demoAllowedUsers = {
  list(): AllowedUser[] {
    return read<AllowedUser[]>(KEYS.allowedUsers, []);
  },
  create(input: Omit<AllowedUser, 'id' | 'created_at'>): AllowedUser {
    const items = this.list();
    const item: AllowedUser = {
      ...input,
      id: uuid(),
      created_at: new Date().toISOString(),
    };
    items.push(item);
    write(KEYS.allowedUsers, items);
    return item;
  },
  remove(id: string): void {
    write(KEYS.allowedUsers, this.list().filter((i) => i.id !== id));
  },
};

// ============================================================
// Concepts
// ============================================================

export const demoConcepts = {
  list(): Concept[] {
    return read<Concept[]>(KEYS.concepts, []);
  },
  create(input: Omit<Concept, 'id' | 'user_id' | 'created_at'>): Concept {
    const items = this.list();
    const item: Concept = {
      ...input,
      id: uuid(),
      user_id: 'demo-user',
      created_at: new Date().toISOString(),
    };
    items.push(item);
    write(KEYS.concepts, items);
    return item;
  },
  update(id: string, patch: Partial<Concept>): Concept | null {
    const items = this.list();
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    items[idx] = { ...items[idx], ...patch };
    write(KEYS.concepts, items);
    return items[idx];
  },
  remove(id: string): void {
    write(KEYS.concepts, this.list().filter((i) => i.id !== id));
  },
};

export const demoConceptAssignees = {
  list(conceptId: string): ConceptAssignee[] {
    return read<ConceptAssignee[]>(KEYS.conceptAssignees, []).filter((a) => a.concept_id === conceptId);
  },
  add(conceptId: string, pmId: string): ConceptAssignee {
    const all = read<ConceptAssignee[]>(KEYS.conceptAssignees, []);
    if (all.some((a) => a.concept_id === conceptId && a.project_manager_id === pmId)) {
      return all.find((a) => a.concept_id === conceptId && a.project_manager_id === pmId)!;
    }
    const item: ConceptAssignee = {
      concept_id: conceptId,
      project_manager_id: pmId,
      added_at: new Date().toISOString(),
    };
    all.push(item);
    write(KEYS.conceptAssignees, all);
    return item;
  },
  remove(conceptId: string, pmId: string): void {
    write(
      KEYS.conceptAssignees,
      read<ConceptAssignee[]>(KEYS.conceptAssignees, []).filter(
        (a) => !(a.concept_id === conceptId && a.project_manager_id === pmId),
      ),
    );
  },
};

export const demoConceptVersions = {
  list(conceptId: string): ConceptVersion[] {
    return read<ConceptVersion[]>(KEYS.conceptVersions, [])
      .filter((v) => v.concept_id === conceptId)
      .sort((a, b) => b.version_number - a.version_number);
  },
  create(input: Omit<ConceptVersion, 'id' | 'uploaded_at' | 'version_number'>): ConceptVersion {
    const all = read<ConceptVersion[]>(KEYS.conceptVersions, []);
    const existingForConcept = all.filter((v) => v.concept_id === input.concept_id);
    const nextVersion = existingForConcept.length === 0
      ? 1
      : Math.max(...existingForConcept.map((v) => v.version_number)) + 1;
    const item: ConceptVersion = {
      ...input,
      id: uuid(),
      version_number: nextVersion,
      uploaded_at: new Date().toISOString(),
    };
    all.push(item);
    write(KEYS.conceptVersions, all);
    return item;
  },
  remove(id: string): void {
    write(KEYS.conceptVersions, read<ConceptVersion[]>(KEYS.conceptVersions, []).filter((v) => v.id !== id));
  },
};

export const demoConceptComments = {
  list(versionId: string): ConceptVersionComment[] {
    return read<ConceptVersionComment[]>(KEYS.conceptComments, [])
      .filter((c) => c.version_id === versionId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  create(input: Omit<ConceptVersionComment, 'id' | 'created_at'>): ConceptVersionComment {
    const all = read<ConceptVersionComment[]>(KEYS.conceptComments, []);
    const item: ConceptVersionComment = {
      ...input,
      id: uuid(),
      created_at: new Date().toISOString(),
    };
    all.push(item);
    write(KEYS.conceptComments, all);
    return item;
  },
  remove(id: string): void {
    write(KEYS.conceptComments, read<ConceptVersionComment[]>(KEYS.conceptComments, []).filter((c) => c.id !== id));
  },
};

export const demoConceptDeadlines = {
  list(conceptId: string): ConceptRevisionDeadline[] {
    return read<ConceptRevisionDeadline[]>(KEYS.conceptDeadlines, [])
      .filter((d) => d.concept_id === conceptId)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  },
  create(input: Omit<ConceptRevisionDeadline, 'id' | 'created_at'>): ConceptRevisionDeadline {
    const all = read<ConceptRevisionDeadline[]>(KEYS.conceptDeadlines, []);
    const item: ConceptRevisionDeadline = {
      ...input,
      id: uuid(),
      created_at: new Date().toISOString(),
    };
    all.push(item);
    write(KEYS.conceptDeadlines, all);
    return item;
  },
  update(id: string, patch: Partial<ConceptRevisionDeadline>): ConceptRevisionDeadline | null {
    const all = read<ConceptRevisionDeadline[]>(KEYS.conceptDeadlines, []);
    const idx = all.findIndex((d) => d.id === id);
    if (idx < 0) return null;
    all[idx] = { ...all[idx], ...patch };
    write(KEYS.conceptDeadlines, all);
    return all[idx];
  },
  remove(id: string): void {
    write(KEYS.conceptDeadlines, read<ConceptRevisionDeadline[]>(KEYS.conceptDeadlines, []).filter((d) => d.id !== id));
  },
};

// ============================================================
// Funding Calls
// ============================================================

export const demoFundingCalls = {
  list(): FundingCall[] {
    return read<FundingCall[]>(KEYS.fundingCalls, []);
  },
  create(input: Omit<FundingCall, 'id' | 'user_id' | 'created_at'>): FundingCall {
    const items = this.list();
    const item: FundingCall = {
      ...input,
      id: uuid(),
      user_id: 'demo-user',
      created_at: new Date().toISOString(),
    };
    items.push(item);
    write(KEYS.fundingCalls, items);
    return item;
  },
  update(id: string, patch: Partial<FundingCall>): FundingCall | null {
    const items = this.list();
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    items[idx] = { ...items[idx], ...patch };
    write(KEYS.fundingCalls, items);
    return items[idx];
  },
  remove(id: string): void {
    write(KEYS.fundingCalls, this.list().filter((i) => i.id !== id));
  },
};

// ============================================================
// Lead Candidates
// ============================================================

export const demoLeadCandidates = {
  list(): LeadCandidate[] {
    return read<LeadCandidate[]>(KEYS.leadCandidates, []);
  },
  create(input: Omit<LeadCandidate, 'id' | 'user_id' | 'created_at'>): LeadCandidate {
    const items = this.list();
    const item: LeadCandidate = { ...input, id: uuid(), user_id: 'demo-user', created_at: new Date().toISOString() };
    items.push(item);
    write(KEYS.leadCandidates, items);
    return item;
  },
  update(id: string, patch: Partial<LeadCandidate>): LeadCandidate | null {
    const items = this.list();
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    items[idx] = { ...items[idx], ...patch };
    write(KEYS.leadCandidates, items);
    return items[idx];
  },
  remove(id: string): void {
    write(KEYS.leadCandidates, this.list().filter((i) => i.id !== id));
  },
};

export const demoLeadUpdates = {
  list(leadId: string): LeadUpdate[] {
    return read<LeadUpdate[]>(KEYS.leadUpdates, [])
      .filter((u) => u.lead_id === leadId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  create(input: Omit<LeadUpdate, 'id' | 'created_at'>): LeadUpdate {
    const all = read<LeadUpdate[]>(KEYS.leadUpdates, []);
    const item: LeadUpdate = { ...input, id: uuid(), created_at: new Date().toISOString() };
    all.push(item);
    write(KEYS.leadUpdates, all);
    return item;
  },
  remove(id: string): void {
    write(KEYS.leadUpdates, read<LeadUpdate[]>(KEYS.leadUpdates, []).filter((u) => u.id !== id));
  },
};

// ============================================================
// Notifications
// ============================================================

export const demoNotifications = {
  list(userId: string): AppNotification[] {
    return read<AppNotification[]>(KEYS.notifications, [])
      .filter((n) => n.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  create(input: Omit<AppNotification, 'id' | 'created_at'>): AppNotification {
    const all = read<AppNotification[]>(KEYS.notifications, []);
    const item: AppNotification = { ...input, id: uuid(), created_at: new Date().toISOString() };
    write(KEYS.notifications, [item, ...all]);
    return item;
  },
  markRead(id: string): void {
    write(KEYS.notifications,
      read<AppNotification[]>(KEYS.notifications, []).map((n) => n.id === id ? { ...n, read: true } : n));
  },
  markAllRead(userId: string): void {
    write(KEYS.notifications,
      read<AppNotification[]>(KEYS.notifications, []).map((n) => n.user_id === userId ? { ...n, read: true } : n));
  },
  has(userId: string, type: NotificationType, entityId: string): boolean {
    return read<AppNotification[]>(KEYS.notifications, []).some(
      (n) => n.user_id === userId && n.type === type && n.entity_id === entityId,
    );
  },
};

const DEFAULT_PREFS: Omit<NotificationPreferences, 'user_id'> = {
  in_app_lead_promoted: true,
  in_app_lead_archived: true,
  in_app_offer_deadline: true,
  in_app_concept_status: true,
  email_lead_promoted: false,
  email_lead_archived: false,
  email_offer_deadline: false,
  email_concept_status: false,
  deadline_days_before: 7,
};

export const demoNotificationPrefs = {
  get(userId: string): NotificationPreferences {
    const all = read<Record<string, NotificationPreferences>>(KEYS.notificationPrefs, {});
    return all[userId] ?? { user_id: userId, ...DEFAULT_PREFS };
  },
  update(userId: string, patch: Partial<NotificationPreferences>): NotificationPreferences {
    const all = read<Record<string, NotificationPreferences>>(KEYS.notificationPrefs, {});
    const current = all[userId] ?? { user_id: userId, ...DEFAULT_PREFS };
    const updated = { ...current, ...patch, user_id: userId };
    write(KEYS.notificationPrefs, { ...all, [userId]: updated });
    return updated;
  },
};

// ============================================================
// Tasks
// ============================================================

export const demoTasks = {
  list(): Task[] {
    return read<Task[]>(KEYS.tasks, []).sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return b.created_at.localeCompare(a.created_at);
    });
  },
  create(input: Omit<Task, 'id' | 'user_id' | 'created_at'>, userId: string): Task {
    const item: Task = { ...input, id: uuid(), user_id: userId, created_at: new Date().toISOString() };
    write(KEYS.tasks, [item, ...read<Task[]>(KEYS.tasks, [])]);
    return item;
  },
  setCompleted(id: string, completed: boolean): Task | null {
    const all = read<Task[]>(KEYS.tasks, []);
    const idx = all.findIndex((t) => t.id === id);
    if (idx < 0) return null;
    all[idx] = { ...all[idx], completed };
    write(KEYS.tasks, all);
    return all[idx];
  },
  remove(id: string): void {
    write(KEYS.tasks, read<Task[]>(KEYS.tasks, []).filter((t) => t.id !== id));
  },
};

// ============================================================
// Concept Files
// ============================================================

export const demoConceptFiles = {
  list(conceptId: string): ConceptFile[] {
    return read<ConceptFile[]>(KEYS.conceptFiles, [])
      .filter((f) => f.concept_id === conceptId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  create(input: Omit<ConceptFile, 'id' | 'created_at'>): ConceptFile {
    const all = read<ConceptFile[]>(KEYS.conceptFiles, []);
    const item: ConceptFile = { ...input, id: uuid(), created_at: new Date().toISOString() };
    write(KEYS.conceptFiles, [item, ...all]);
    return item;
  },
  remove(id: string): void {
    write(KEYS.conceptFiles, read<ConceptFile[]>(KEYS.conceptFiles, []).filter((f) => f.id !== id));
  },
};
