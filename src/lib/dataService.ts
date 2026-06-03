import { isDemoMode, supabase } from './supabase';
import {
  demoOffers,
  demoProjectManagers,
  demoFundingCalls,
  demoAllowedUsers,
  demoConcepts,
  demoConceptAssignees,
  demoConceptVersions,
  demoConceptComments,
  demoConceptDeadlines,
  demoLeadCandidates,
  demoLeadUpdates,
  demoNotifications,
  demoNotificationPrefs,
  demoTasks,
  demoConceptFiles,
  demoConceptFieldComments,
} from './demoStorage';
import type {
  AllowedUser,
  CreateAllowedUserForm,
  Offer,
  ProjectManager,
  FundingCall,
  Concept,
  ConceptAssignee,
  ConceptVersion,
  ConceptVersionComment,
  ConceptRevisionDeadline,
  ConceptMatch,
  CreateConceptForm,
  UpdateConceptForm,
  CreateProjectManagerForm,
  UpdateProjectManagerForm,
  CreateFundingCallForm,
  UpdateFundingCallForm,
  LeadCandidate,
  LeadUpdate,
  CreateLeadCandidateForm,
  UpdateLeadCandidateForm,
  AppNotification,
  NotificationPreferences,
  NotificationType,
  Task,
  CreateTaskForm,
  ConceptFile,
  ConceptFieldComment,
  CreateConceptFieldCommentForm,
} from '../types';

// ============================================================
// Data service: unico entry point per le entità.
// Switcha automaticamente tra Supabase e demo storage.
// ============================================================

function ensureSb() {
  if (!supabase) throw new Error('Supabase client non inizializzato');
  return supabase;
}

// ----------------------------------------------------------------
// Allowed Users
// ----------------------------------------------------------------

export const allowedUsersService = {
  async list(): Promise<AllowedUser[]> {
    if (isDemoMode) return demoAllowedUsers.list();
    const { data, error } = await ensureSb()
      .from('allowed_users')
      .select('*')
      .order('email', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: CreateAllowedUserForm): Promise<AllowedUser> {
    if (isDemoMode) {
      return demoAllowedUsers.create({ email: input.email.toLowerCase().trim(), name: input.name ?? null });
    }
    const { data, error } = await ensureSb()
      .from('allowed_users')
      .insert({ email: input.email.toLowerCase().trim(), name: input.name ?? null })
      .select()
      .single();
    if (error) throw error;
    return data as AllowedUser;
  },

  async remove(id: string): Promise<void> {
    if (isDemoMode) { demoAllowedUsers.remove(id); return; }
    const { error } = await ensureSb().from('allowed_users').delete().eq('id', id);
    if (error) throw error;
  },

  async isAllowed(email: string): Promise<boolean> {
    if (isDemoMode) return true;
    try {
      // Se la tabella è vuota il whitelist non è ancora configurato → fail open
      const { count, error: countErr } = await ensureSb()
        .from('allowed_users')
        .select('*', { count: 'exact', head: true });
      if (countErr) return true; // tabella non ancora creata
      if (!count) return true;   // tabella vuota → non ancora configurato

      const { data, error } = await ensureSb()
        .from('allowed_users')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();
      if (error) return true;
      return data !== null;
    } catch {
      return true;
    }
  },
};

// ----------------------------------------------------------------
// Project Managers
// ----------------------------------------------------------------

export const projectManagersService = {
  async list(): Promise<ProjectManager[]> {
    if (isDemoMode) {
      return [...demoProjectManagers.list()].sort((a, b) =>
        a.name.localeCompare(b.name, 'it'),
      );
    }
    const { data, error } = await ensureSb()
      .from('project_managers')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: CreateProjectManagerForm, userId: string): Promise<ProjectManager> {
    if (isDemoMode) {
      return demoProjectManagers.create({
        name: input.name,
        email: input.email ?? null,
        avatar_url: null,
        active: input.active ?? true,
      });
    }
    const { data, error } = await ensureSb()
      .from('project_managers')
      .insert({ ...input, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data as ProjectManager;
  },

  async update(id: string, patch: UpdateProjectManagerForm): Promise<ProjectManager> {
    if (isDemoMode) {
      const updated = demoProjectManagers.update(id, patch);
      if (!updated) throw new Error('Project Manager non trovato');
      return updated;
    }
    const { data, error } = await ensureSb()
      .from('project_managers')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as ProjectManager;
  },

  async remove(id: string): Promise<void> {
    if (isDemoMode) {
      demoProjectManagers.remove(id);
      return;
    }
    const { error } = await ensureSb().from('project_managers').delete().eq('id', id);
    if (error) throw error;
  },

  async getByUserId(userId: string): Promise<ProjectManager | null> {
    if (isDemoMode) {
      return demoProjectManagers.list().find((p) => p.user_id === userId) ?? null;
    }
    const { data, error } = await ensureSb()
      .from('project_managers').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data as ProjectManager | null;
  },

  async uploadAvatar(pm: ProjectManager, file: File): Promise<ProjectManager> {
    let avatar_url: string;
    if (isDemoMode) {
      avatar_url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } else {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${pm.id}/avatar.${ext}`;
      const { error: upErr } = await ensureSb()
        .storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = ensureSb().storage.from('avatars').getPublicUrl(path);
      avatar_url = `${urlData.publicUrl}?t=${Date.now()}`;
    }
    return projectManagersService.update(pm.id, { avatar_url });
  },
};

// ----------------------------------------------------------------
// Funding Calls
// ----------------------------------------------------------------

export const fundingCallsService = {
  async list(): Promise<FundingCall[]> {
    if (isDemoMode) {
      return [...demoFundingCalls.list()].sort((a, b) =>
        a.code.localeCompare(b.code, 'it'),
      );
    }
    const { data, error } = await ensureSb()
      .from('funding_calls')
      .select('*')
      .order('code', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: CreateFundingCallForm, userId: string): Promise<FundingCall> {
    if (isDemoMode) {
      return demoFundingCalls.create({
        code: input.code,
        name: input.name,
        body: input.body ?? null,
        deadline: input.deadline ?? null,
        lead_deadline: input.lead_deadline ?? null,
        internal_deadline: input.internal_deadline ?? null,
        description: input.description ?? null,
        notes: input.notes ?? null,
        probability: input.probability ?? 50,
        pdf_path: null,
        pdf_filename: null,
        source_url: input.source_url ?? null,
        target_offers: input.target_offers ?? null,
      });
    }
    const { data, error } = await ensureSb()
      .from('funding_calls')
      .insert({ ...input, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data as FundingCall;
  },

  async update(id: string, patch: UpdateFundingCallForm): Promise<FundingCall> {
    if (isDemoMode) {
      const updated = demoFundingCalls.update(id, patch);
      if (!updated) throw new Error('Bando non trovato');
      return updated;
    }
    const { data, error } = await ensureSb()
      .from('funding_calls')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as FundingCall;
  },

  async remove(id: string): Promise<void> {
    if (isDemoMode) {
      demoFundingCalls.remove(id);
      return;
    }
    const { error } = await ensureSb().from('funding_calls').delete().eq('id', id);
    if (error) throw error;
  },
};

// ----------------------------------------------------------------
// Funding Call PDFs (Supabase Storage)
// ----------------------------------------------------------------

const FC_BUCKET = 'funding-call-files';

export const fundingCallPdfService = {
  async upload(callId: string, file: File): Promise<FundingCall> {
    const sb = ensureSb();
    const safeName = file.name.replace(/[^\w.\-]/g, '_');
    const path = `${callId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await sb.storage.from(FC_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/pdf',
    });
    if (upErr) throw upErr;
    const { data, error } = await sb
      .from('funding_calls')
      .update({ pdf_path: path, pdf_filename: file.name })
      .eq('id', callId)
      .select()
      .single();
    if (error) {
      await sb.storage.from(FC_BUCKET).remove([path]);
      throw error;
    }
    return data as FundingCall;
  },

  async signedUrl(path: string): Promise<string | null> {
    const { data, error } = await ensureSb()
      .storage.from(FC_BUCKET)
      .createSignedUrl(path, 60 * 10);
    if (error) return null;
    return data?.signedUrl ?? null;
  },

  async remove(callId: string, path: string): Promise<FundingCall> {
    const sb = ensureSb();
    await sb.storage.from(FC_BUCKET).remove([path]);
    const { data, error } = await sb
      .from('funding_calls')
      .update({ pdf_path: null, pdf_filename: null })
      .eq('id', callId)
      .select()
      .single();
    if (error) throw error;
    return data as FundingCall;
  },
};

// ----------------------------------------------------------------
// Concepts
// ----------------------------------------------------------------

export const conceptsService = {
  async list(): Promise<Concept[]> {
    if (isDemoMode) {
      const pms = demoProjectManagers.list();
      return [...demoConcepts.list()]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((c) => ({
          ...c,
          assignees: demoConceptAssignees.list(c.id).map((a) => ({
            ...a,
            project_manager: pms.find((p) => p.id === a.project_manager_id) ?? null,
          })),
        }));
    }
    const { data, error } = await ensureSb()
      .from('concepts')
      .select('*, assignees:concept_assignees(*, project_manager:project_managers(*))')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Concept[];
  },

  async get(id: string): Promise<Concept | null> {
    if (isDemoMode) {
      return demoConcepts.list().find((c) => c.id === id) ?? null;
    }
    const { data, error } = await ensureSb()
      .from('concepts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as Concept | null;
  },

  async create(input: CreateConceptForm, userId: string): Promise<Concept> {
    if (isDemoMode) {
      return demoConcepts.create({
        name: input.name,
        pi: input.pi ?? null,
        ente: input.ente ?? null,
        description: input.description ?? null,
        status: input.status ?? 'in_valutazione',
        notes: input.notes ?? null,
        deadline: null,
        promoted_offer_id: null,
        funding_call_id: null,
        concept_data: null,
      });
    }
    const { data, error } = await ensureSb()
      .from('concepts')
      .insert({ ...input, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data as Concept;
  },

  async update(id: string, patch: UpdateConceptForm): Promise<Concept> {
    if (isDemoMode) {
      const updated = demoConcepts.update(id, patch);
      if (!updated) throw new Error('Concept non trovato');
      return updated;
    }
    const { data, error } = await ensureSb()
      .from('concepts')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Concept;
  },

  async remove(id: string): Promise<void> {
    if (isDemoMode) { demoConcepts.remove(id); return; }
    const { error } = await ensureSb().from('concepts').delete().eq('id', id);
    if (error) throw error;
  },
};

// ----------------------------------------------------------------
// Concept Assignees (PM responsabili)
// ----------------------------------------------------------------

export const conceptAssigneesService = {
  async list(conceptId: string): Promise<ConceptAssignee[]> {
    if (isDemoMode) {
      const all = demoConceptAssignees.list(conceptId);
      const pms = demoProjectManagers.list();
      return all.map((a) => ({ ...a, project_manager: pms.find((p) => p.id === a.project_manager_id) ?? null }));
    }
    const { data, error } = await ensureSb()
      .from('concept_assignees')
      .select('*, project_manager:project_managers(*)')
      .eq('concept_id', conceptId);
    if (error) throw error;
    return (data ?? []) as ConceptAssignee[];
  },

  async add(conceptId: string, projectManagerId: string, role?: string | null): Promise<void> {
    if (isDemoMode) { demoConceptAssignees.add(conceptId, projectManagerId, role); return; }
    const { error } = await ensureSb()
      .from('concept_assignees')
      .insert({ concept_id: conceptId, project_manager_id: projectManagerId, role: role ?? null });
    if (error && error.code !== '23505') throw error;
  },

  async setRole(conceptId: string, projectManagerId: string, role: string | null): Promise<void> {
    if (isDemoMode) { demoConceptAssignees.setRole(conceptId, projectManagerId, role); return; }
    const { error } = await ensureSb()
      .from('concept_assignees')
      .update({ role })
      .eq('concept_id', conceptId)
      .eq('project_manager_id', projectManagerId);
    if (error) throw error;
  },

  async remove(conceptId: string, projectManagerId: string): Promise<void> {
    if (isDemoMode) { demoConceptAssignees.remove(conceptId, projectManagerId); return; }
    const { error } = await ensureSb()
      .from('concept_assignees')
      .delete()
      .eq('concept_id', conceptId)
      .eq('project_manager_id', projectManagerId);
    if (error) throw error;
  },
};

// ----------------------------------------------------------------
// Concept Versions (file caricati con versioning)
// ----------------------------------------------------------------

const CONCEPT_BUCKET = 'concept-files';

export const conceptVersionsService = {
  async list(conceptId: string): Promise<ConceptVersion[]> {
    if (isDemoMode) {
      const all = demoConceptVersions.list(conceptId);
      const pms = demoProjectManagers.list();
      return all.map((v) => ({ ...v, uploader: pms.find((p) => p.id === v.uploaded_by) ?? null }));
    }
    const { data, error } = await ensureSb()
      .from('concept_versions')
      .select('*, uploader:project_managers!uploaded_by(*)')
      .eq('concept_id', conceptId)
      .order('version_number', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ConceptVersion[];
  },

  async upload(conceptId: string, file: File, uploadedBy: string | null, note: string | null): Promise<ConceptVersion> {
    if (isDemoMode) {
      return demoConceptVersions.create({
        concept_id: conceptId,
        filename: file.name,
        storage_path: `demo/${file.name}`,
        size: file.size,
        mime_type: file.type || null,
        uploaded_by: uploadedBy,
        note,
      });
    }
    const sb = ensureSb();
    // Trova il prossimo version_number (max + 1)
    const { data: existing } = await sb
      .from('concept_versions')
      .select('version_number')
      .eq('concept_id', conceptId)
      .order('version_number', { ascending: false })
      .limit(1);
    const nextVersion = (existing?.[0]?.version_number ?? 0) + 1;

    const safeName = file.name.replace(/[^\w.\-]/g, '_');
    const path = `${conceptId}/v${nextVersion}-${Date.now()}-${safeName}`;
    const { error: upErr } = await sb.storage.from(CONCEPT_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });
    if (upErr) throw upErr;
    const { data, error } = await sb
      .from('concept_versions')
      .insert({
        concept_id: conceptId,
        version_number: nextVersion,
        filename: file.name,
        storage_path: path,
        size: file.size,
        mime_type: file.type || null,
        uploaded_by: uploadedBy,
        note,
      })
      .select('*, uploader:project_managers!uploaded_by(*)')
      .single();
    if (error) {
      await sb.storage.from(CONCEPT_BUCKET).remove([path]);
      throw error;
    }
    return data as ConceptVersion;
  },

  async signedUrl(path: string): Promise<string | null> {
    if (isDemoMode) return null;
    const { data, error } = await ensureSb()
      .storage.from(CONCEPT_BUCKET)
      .createSignedUrl(path, 60 * 10);
    if (error) return null;
    return data?.signedUrl ?? null;
  },

  async remove(version: ConceptVersion): Promise<void> {
    if (isDemoMode) { demoConceptVersions.remove(version.id); return; }
    const sb = ensureSb();
    await sb.storage.from(CONCEPT_BUCKET).remove([version.storage_path]);
    const { error } = await sb.from('concept_versions').delete().eq('id', version.id);
    if (error) throw error;
  },
};

// ----------------------------------------------------------------
// Concept Version Comments (con @mention)
// ----------------------------------------------------------------

export const conceptCommentsService = {
  async list(versionId: string): Promise<ConceptVersionComment[]> {
    if (isDemoMode) return demoConceptComments.list(versionId);
    const { data, error } = await ensureSb()
      .from('concept_version_comments')
      .select('*')
      .eq('version_id', versionId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ConceptVersionComment[];
  },

  async create(input: Omit<ConceptVersionComment, 'id' | 'created_at'>): Promise<ConceptVersionComment> {
    if (isDemoMode) return demoConceptComments.create(input);
    const { data, error } = await ensureSb()
      .from('concept_version_comments')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as ConceptVersionComment;
  },

  async remove(id: string): Promise<void> {
    if (isDemoMode) { demoConceptComments.remove(id); return; }
    const { error } = await ensureSb().from('concept_version_comments').delete().eq('id', id);
    if (error) throw error;
  },
};

// ----------------------------------------------------------------
// Concept Revision Deadlines
// ----------------------------------------------------------------

export const conceptDeadlinesService = {
  async list(conceptId: string): Promise<ConceptRevisionDeadline[]> {
    if (isDemoMode) return demoConceptDeadlines.list(conceptId);
    const { data, error } = await ensureSb()
      .from('concept_revision_deadlines')
      .select('*')
      .eq('concept_id', conceptId)
      .order('due_date', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ConceptRevisionDeadline[];
  },

  async create(input: Omit<ConceptRevisionDeadline, 'id' | 'created_at'>): Promise<ConceptRevisionDeadline> {
    if (isDemoMode) return demoConceptDeadlines.create(input);
    const { data, error } = await ensureSb()
      .from('concept_revision_deadlines')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as ConceptRevisionDeadline;
  },

  async update(id: string, patch: Partial<ConceptRevisionDeadline>): Promise<ConceptRevisionDeadline> {
    if (isDemoMode) {
      const updated = demoConceptDeadlines.update(id, patch);
      if (!updated) throw new Error('Deadline non trovata');
      return updated;
    }
    const { data, error } = await ensureSb()
      .from('concept_revision_deadlines')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as ConceptRevisionDeadline;
  },

  async remove(id: string): Promise<void> {
    if (isDemoMode) { demoConceptDeadlines.remove(id); return; }
    const { error } = await ensureSb().from('concept_revision_deadlines').delete().eq('id', id);
    if (error) throw error;
  },
};

// ----------------------------------------------------------------
// Concept Matches (AI matching → ex lead_matches)
// ----------------------------------------------------------------

const matchKey = 'commerciale.demo.conceptMatches';

function readDemoMatches(): ConceptMatch[] {
  try { return JSON.parse(localStorage.getItem(matchKey) ?? '[]'); }
  catch { return []; }
}
function writeDemoMatches(arr: ConceptMatch[]) {
  localStorage.setItem(matchKey, JSON.stringify(arr));
}

export const conceptMatchesService = {
  async list(conceptId: string): Promise<ConceptMatch[]> {
    if (isDemoMode) {
      return readDemoMatches().filter((m) => m.concept_id === conceptId).sort((a, b) => b.score - a.score);
    }
    const { data, error } = await ensureSb()
      .from('concept_matches')
      .select('*')
      .eq('concept_id', conceptId)
      .order('score', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ConceptMatch[];
  },

  async replace(conceptId: string, matches: { funding_call_id: string; score: number; rationale: string }[]): Promise<ConceptMatch[]> {
    if (isDemoMode) {
      const all = readDemoMatches().filter((m) => m.concept_id !== conceptId);
      const now = new Date().toISOString();
      const created: ConceptMatch[] = matches.map((m) => ({
        id: crypto.randomUUID(),
        concept_id: conceptId,
        funding_call_id: m.funding_call_id,
        score: m.score,
        rationale: m.rationale,
        analyzed_at: now,
      }));
      writeDemoMatches([...all, ...created]);
      return created.sort((a, b) => b.score - a.score);
    }
    const sb = ensureSb();
    await sb.from('concept_matches').delete().eq('concept_id', conceptId);
    if (matches.length === 0) return [];
    const { data, error } = await sb
      .from('concept_matches')
      .insert(matches.map((m) => ({ ...m, concept_id: conceptId })))
      .select();
    if (error) throw error;
    return ((data ?? []) as ConceptMatch[]).sort((a, b) => b.score - a.score);
  },

  async analyze(concept: Concept, fundingCalls: FundingCall[]): Promise<{ matches: ConceptMatch[]; model?: string }> {
    const today = new Date().toISOString().slice(0, 10);
    const active = fundingCalls.filter((fc) => !fc.deadline || fc.deadline >= today);

    if (!concept.description?.trim()) {
      throw new Error('Inserisci una descrizione del concept prima di lanciare il match AI.');
    }

    const callsWithPdf = await Promise.all(
      active.map(async (fc) => {
        if (!fc.pdf_path) {
          return { id: fc.id, code: fc.code, name: fc.name, body: fc.body, deadline: fc.deadline, description: fc.description, notes: fc.notes };
        }
        try {
          const url = await fundingCallPdfService.signedUrl(fc.pdf_path);
          if (!url) return { id: fc.id, code: fc.code, name: fc.name, body: fc.body, deadline: fc.deadline, description: fc.description, notes: fc.notes };
          const blob = await fetch(url).then((r) => r.arrayBuffer());
          const b64 = btoa(String.fromCharCode(...new Uint8Array(blob)));
          return { id: fc.id, code: fc.code, name: fc.name, body: fc.body, deadline: fc.deadline, description: fc.description, notes: fc.notes, pdf_base64: b64 };
        } catch {
          return { id: fc.id, code: fc.code, name: fc.name, body: fc.body, deadline: fc.deadline, description: fc.description, notes: fc.notes };
        }
      }),
    );

    const res = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadName: concept.name,
        leadDescription: concept.description,
        leadPi: concept.pi,
        leadEnte: concept.ente,
        fundingCalls: callsWithPdf,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error ?? 'Errore matching AI');
    }
    const json = await res.json() as {
      matches: { funding_call_id: string; score: number; rationale: string }[];
      model?: string;
    };
    const stored = await this.replace(concept.id, json.matches);
    return { matches: stored, model: json.model };
  },
};

// ----------------------------------------------------------------
// Offers (utilizzo nei prossimi step)
// ----------------------------------------------------------------

export const offersService = {
  async list(): Promise<Offer[]> {
    if (isDemoMode) {
      return [...demoOffers.list()].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
    }
    const { data, error } = await ensureSb()
      .from('offers')
      .select('*, project_manager:project_managers(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Offer[];
  },

  async get(id: string): Promise<Offer | null> {
    if (isDemoMode) {
      return demoOffers.list().find((o) => o.id === id) ?? null;
    }
    const { data, error } = await ensureSb()
      .from('offers')
      .select('*, project_manager:project_managers(*)')
      .eq('id', id)
      .single();
    if (error) return null;
    return data as Offer;
  },

  async create(input: Omit<Offer, 'id' | 'user_id' | 'created_at'>, userId: string): Promise<Offer> {
    if (isDemoMode) {
      return demoOffers.create(input);
    }
    const { data, error } = await ensureSb()
      .from('offers')
      .insert({ ...input, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data as Offer;
  },

  async update(id: string, patch: Partial<Offer>): Promise<Offer> {
    if (isDemoMode) {
      const updated = demoOffers.update(id, patch);
      if (!updated) throw new Error('Offerta non trovata');
      return updated;
    }
    const { data, error } = await ensureSb()
      .from('offers')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Offer;
  },

  async remove(id: string): Promise<void> {
    if (isDemoMode) {
      demoOffers.remove(id);
      return;
    }
    const { error } = await ensureSb().from('offers').delete().eq('id', id);
    if (error) throw error;
  },
};

// ----------------------------------------------------------------
// Lead Candidates
// ----------------------------------------------------------------

export const leadCandidatesService = {
  async list(): Promise<LeadCandidate[]> {
    if (isDemoMode) return [...demoLeadCandidates.list()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const { data, error } = await ensureSb()
      .from('lead_candidates')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as LeadCandidate[];
  },

  async get(id: string): Promise<LeadCandidate | null> {
    if (isDemoMode) return demoLeadCandidates.list().find((l) => l.id === id) ?? null;
    const { data, error } = await ensureSb()
      .from('lead_candidates')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as LeadCandidate | null;
  },

  async create(input: CreateLeadCandidateForm, userId: string): Promise<LeadCandidate> {
    if (isDemoMode) return demoLeadCandidates.create({ ...input, promoted_concept_id: null });
    const { data, error } = await ensureSb()
      .from('lead_candidates')
      .insert({ ...input, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data as LeadCandidate;
  },

  async update(id: string, patch: UpdateLeadCandidateForm): Promise<LeadCandidate> {
    if (isDemoMode) {
      const u = demoLeadCandidates.update(id, patch);
      if (!u) throw new Error('Lead non trovato');
      return u;
    }
    const { data, error } = await ensureSb()
      .from('lead_candidates')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as LeadCandidate;
  },

  async remove(id: string): Promise<void> {
    if (isDemoMode) { demoLeadCandidates.remove(id); return; }
    const { error } = await ensureSb().from('lead_candidates').delete().eq('id', id);
    if (error) throw error;
  },

  async callTypes(): Promise<string[]> {
    if (isDemoMode) {
      const types = [...new Set(demoLeadCandidates.list().map((l) => l.call_type))];
      return types.sort();
    }
    const { data, error } = await ensureSb()
      .from('lead_candidates')
      .select('call_type');
    if (error) throw error;
    const types = [...new Set((data ?? []).map((r: { call_type: string }) => r.call_type))];
    return types.sort();
  },
};

// ----------------------------------------------------------------
// Lead Updates (storico interazioni)
// ----------------------------------------------------------------

export const leadUpdatesService = {
  async list(leadId: string): Promise<LeadUpdate[]> {
    if (isDemoMode) return demoLeadUpdates.list(leadId);
    const { data, error } = await ensureSb()
      .from('lead_updates')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as LeadUpdate[];
  },

  async create(
    input: Omit<LeadUpdate, 'id' | 'created_at' | 'attachment_url' | 'attachment_name'>,
    file?: File,
    userId?: string,
  ): Promise<LeadUpdate> {
    let attachment_url: string | null = null;
    let attachment_name: string | null = null;

    if (file) {
      attachment_name = file.name;
      if (isDemoMode) {
        attachment_url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        const path = `${userId ?? 'anon'}/${input.lead_id}/${Date.now()}_${file.name}`;
        const { error: upErr } = await ensureSb()
          .storage.from('lead-update-files')
          .upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = ensureSb()
          .storage.from('lead-update-files')
          .getPublicUrl(path);
        attachment_url = urlData.publicUrl;
      }
    }

    const full = { ...input, attachment_url, attachment_name };
    if (isDemoMode) return demoLeadUpdates.create(full);
    const { data, error } = await ensureSb()
      .from('lead_updates')
      .insert(full)
      .select()
      .single();
    if (error) throw error;
    return data as LeadUpdate;
  },

  async remove(id: string): Promise<void> {
    if (isDemoMode) { demoLeadUpdates.remove(id); return; }
    const { error } = await ensureSb().from('lead_updates').delete().eq('id', id);
    if (error) throw error;
  },
};

// ================================================================
// Notifications
// ================================================================

export const notificationsService = {
  async list(userId: string): Promise<AppNotification[]> {
    if (isDemoMode) return demoNotifications.list(userId);
    const { data, error } = await ensureSb()
      .from('notifications').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return (data ?? []) as AppNotification[];
  },

  async create(input: Omit<AppNotification, 'id' | 'created_at'>): Promise<AppNotification> {
    if (isDemoMode) return demoNotifications.create(input);
    const { data, error } = await ensureSb()
      .from('notifications').insert(input).select().single();
    if (error) throw error;
    return data as AppNotification;
  },

  async has(userId: string, type: NotificationType, entityId: string): Promise<boolean> {
    if (isDemoMode) return demoNotifications.has(userId, type, entityId);
    const { data } = await ensureSb()
      .from('notifications').select('id')
      .eq('user_id', userId).eq('type', type).eq('entity_id', entityId)
      .limit(1).maybeSingle();
    return !!data;
  },

  async markRead(id: string): Promise<void> {
    if (isDemoMode) { demoNotifications.markRead(id); return; }
    const { error } = await ensureSb().from('notifications').update({ read: true }).eq('id', id);
    if (error) throw error;
  },

  async markAllRead(userId: string): Promise<void> {
    if (isDemoMode) { demoNotifications.markAllRead(userId); return; }
    const { error } = await ensureSb()
      .from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    if (error) throw error;
  },
};

// ================================================================
// Notification Preferences
// ================================================================

const DEFAULT_PREFS = (userId: string): NotificationPreferences => ({
  user_id: userId,
  in_app_lead_promoted: true, in_app_lead_archived: true,
  in_app_offer_deadline: true, in_app_concept_status: true,
  email_lead_promoted: false, email_lead_archived: false,
  email_offer_deadline: false, email_concept_status: false,
  deadline_days_before: 7,
});

export const notificationPrefsService = {
  async get(userId: string): Promise<NotificationPreferences> {
    if (isDemoMode) return demoNotificationPrefs.get(userId);
    const { data } = await ensureSb()
      .from('notification_preferences').select('*').eq('user_id', userId).maybeSingle();
    if (!data) {
      const { data: created, error } = await ensureSb()
        .from('notification_preferences').insert(DEFAULT_PREFS(userId)).select().single();
      if (error) throw error;
      return created as NotificationPreferences;
    }
    return data as NotificationPreferences;
  },

  async update(userId: string, patch: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    if (isDemoMode) return demoNotificationPrefs.update(userId, patch);
    const { data, error } = await ensureSb()
      .from('notification_preferences')
      .upsert({ ...DEFAULT_PREFS(userId), ...patch, user_id: userId })
      .select().single();
    if (error) throw error;
    return data as NotificationPreferences;
  },
};

// ----------------------------------------------------------------
// Tasks
// ----------------------------------------------------------------
export const tasksService = {
  async list(): Promise<Task[]> {
    if (isDemoMode) return demoTasks.list();
    const { data, error } = await ensureSb()
      .from('tasks')
      .select('*')
      .order('completed', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Task[];
  },

  async create(input: CreateTaskForm, userId: string, file?: File): Promise<Task> {
    let attachment_url: string | null = null;
    let attachment_name: string | null = null;

    if (file) {
      attachment_name = file.name;
      if (isDemoMode) {
        attachment_url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        const path = `${userId}/${input.entity_id ?? 'generic'}/${Date.now()}_${file.name}`;
        const { error: upErr } = await ensureSb()
          .storage.from('task-files')
          .upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = ensureSb().storage.from('task-files').getPublicUrl(path);
        attachment_url = urlData.publicUrl;
      }
    }

    const extra = { attachment_url, attachment_name };
    if (isDemoMode) return demoTasks.create({ ...input, completed: false, ...extra }, userId);
    const { data, error } = await ensureSb()
      .from('tasks')
      .insert({ ...input, user_id: userId, completed: false, ...extra })
      .select().single();
    if (error) throw error;
    return data as Task;
  },

  async setCompleted(id: string, completed: boolean): Promise<Task> {
    if (isDemoMode) {
      const t = demoTasks.setCompleted(id, completed);
      if (!t) throw new Error('Task non trovato');
      return t;
    }
    const { data, error } = await ensureSb()
      .from('tasks')
      .update({ completed })
      .eq('id', id)
      .select().single();
    if (error) throw error;
    return data as Task;
  },

  async listByEntity(entityId: string): Promise<Task[]> {
    if (isDemoMode) return demoTasks.list().filter((t) => t.entity_id === entityId);
    const { data, error } = await ensureSb()
      .from('tasks')
      .select('*')
      .eq('entity_id', entityId)
      .order('completed', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Task[];
  },

  async remove(id: string): Promise<void> {
    if (isDemoMode) { demoTasks.remove(id); return; }
    const { error } = await ensureSb().from('tasks').delete().eq('id', id);
    if (error) throw error;
  },
};

// ----------------------------------------------------------------
// Concept Files
// ----------------------------------------------------------------
export const conceptFilesService = {
  async list(conceptId: string): Promise<ConceptFile[]> {
    if (isDemoMode) return demoConceptFiles.list(conceptId);
    const { data, error } = await ensureSb()
      .from('concept_files')
      .select('*')
      .eq('concept_id', conceptId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ConceptFile[];
  },

  async upload(conceptId: string, file: File, userId: string): Promise<ConceptFile> {
    if (isDemoMode) {
      const url: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      return demoConceptFiles.create({
        concept_id: conceptId, user_id: userId,
        filename: file.name, file_path: url, file_url: url,
      });
    }
    const sb = ensureSb();
    const path = `${conceptId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await sb.storage.from('concept-files').upload(path, file);
    if (upErr) throw upErr;
    const { data: { publicUrl } } = sb.storage.from('concept-files').getPublicUrl(path);
    const { data, error } = await sb
      .from('concept_files')
      .insert({ concept_id: conceptId, user_id: userId, filename: file.name, file_path: path, file_url: publicUrl })
      .select().single();
    if (error) throw error;
    return data as ConceptFile;
  },

  async remove(id: string, filePath: string): Promise<void> {
    if (isDemoMode) { demoConceptFiles.remove(id); return; }
    const sb = ensureSb();
    await sb.storage.from('concept-files').remove([filePath]);
    const { error } = await sb.from('concept_files').delete().eq('id', id);
    if (error) throw error;
  },
};

// ----------------------------------------------------------------
// Concept Field Comments
// ----------------------------------------------------------------

export const conceptFieldCommentsService = {
  async list(conceptId: string): Promise<ConceptFieldComment[]> {
    if (isDemoMode) return demoConceptFieldComments.list(conceptId);
    const { data, error } = await ensureSb()
      .from('concept_field_comments')
      .select('*')
      .eq('concept_id', conceptId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ConceptFieldComment[];
  },

  async create(conceptId: string, form: CreateConceptFieldCommentForm): Promise<ConceptFieldComment> {
    if (isDemoMode) {
      return demoConceptFieldComments.create({ concept_id: conceptId, ...form });
    }
    const sb = ensureSb();
    const { data: { user } } = await sb.auth.getUser();
    const { data, error } = await sb
      .from('concept_field_comments')
      .insert({ concept_id: conceptId, user_id: user!.id, ...form })
      .select()
      .single();
    if (error) throw error;
    return data as ConceptFieldComment;
  },

  async remove(id: string): Promise<void> {
    if (isDemoMode) { demoConceptFieldComments.remove(id); return; }
    const { error } = await ensureSb().from('concept_field_comments').delete().eq('id', id);
    if (error) throw error;
  },
};
