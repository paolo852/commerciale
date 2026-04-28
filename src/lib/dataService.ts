import { isDemoMode, supabase } from './supabase';
import {
  demoOffers,
  demoProjectManagers,
  demoFundingCalls,
  demoAllowedUsers,
  demoLeads,
  demoLeadFiles,
} from './demoStorage';
import type {
  AllowedUser,
  CreateAllowedUserForm,
  Offer,
  ProjectManager,
  FundingCall,
  Lead,
  LeadFile,
  LeadMatch,
  CreateLeadForm,
  UpdateLeadForm,
  CreateProjectManagerForm,
  UpdateProjectManagerForm,
  CreateFundingCallForm,
  UpdateFundingCallForm,
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
        notes: input.notes ?? null,
        probability: input.probability ?? 50,
        pdf_path: null,
        pdf_filename: null,
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
// Leads
// ----------------------------------------------------------------

export const leadsService = {
  async list(): Promise<Lead[]> {
    if (isDemoMode) {
      return [...demoLeads.list()].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
    }
    const { data, error } = await ensureSb()
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Lead[];
  },

  async create(input: CreateLeadForm, userId: string): Promise<Lead> {
    if (isDemoMode) {
      return demoLeads.create({
        name: input.name,
        pi: input.pi ?? null,
        ente: input.ente ?? null,
        description: input.description ?? null,
        status: input.status ?? 'in_valutazione',
        notes: input.notes ?? null,
        promoted_offer_id: null,
      });
    }
    const { data, error } = await ensureSb()
      .from('leads')
      .insert({ ...input, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data as Lead;
  },

  async update(id: string, patch: UpdateLeadForm): Promise<Lead> {
    if (isDemoMode) {
      const updated = demoLeads.update(id, patch);
      if (!updated) throw new Error('Lead non trovato');
      return updated;
    }
    const { data, error } = await ensureSb()
      .from('leads')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Lead;
  },

  async remove(id: string): Promise<void> {
    if (isDemoMode) { demoLeads.remove(id); return; }
    const { error } = await ensureSb().from('leads').delete().eq('id', id);
    if (error) throw error;
  },
};

// ----------------------------------------------------------------
// Lead Files (Supabase Storage + tabella metadati)
// ----------------------------------------------------------------

const LEAD_BUCKET = 'lead-files';

export const leadFilesService = {
  async list(leadId: string): Promise<LeadFile[]> {
    if (isDemoMode) return demoLeadFiles.list(leadId);
    const { data, error } = await ensureSb()
      .from('lead_files')
      .select('*')
      .eq('lead_id', leadId)
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as LeadFile[];
  },

  async upload(leadId: string, file: File): Promise<LeadFile> {
    if (isDemoMode) {
      // In demo mode salviamo solo metadati (no upload reale)
      return demoLeadFiles.create({
        lead_id: leadId,
        filename: file.name,
        storage_path: `demo/${file.name}`,
        size: file.size,
        mime_type: file.type || null,
      });
    }
    const sb = ensureSb();
    const safeName = file.name.replace(/[^\w.\-]/g, '_');
    const path = `${leadId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await sb.storage.from(LEAD_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });
    if (upErr) throw upErr;
    const { data, error } = await sb
      .from('lead_files')
      .insert({
        lead_id: leadId,
        filename: file.name,
        storage_path: path,
        size: file.size,
        mime_type: file.type || null,
      })
      .select()
      .single();
    if (error) {
      await sb.storage.from(LEAD_BUCKET).remove([path]);
      throw error;
    }
    return data as LeadFile;
  },

  async signedUrl(path: string): Promise<string | null> {
    if (isDemoMode) return null;
    const { data, error } = await ensureSb()
      .storage.from(LEAD_BUCKET)
      .createSignedUrl(path, 60 * 10);
    if (error) return null;
    return data?.signedUrl ?? null;
  },

  async remove(file: LeadFile): Promise<void> {
    if (isDemoMode) { demoLeadFiles.remove(file.id); return; }
    const sb = ensureSb();
    await sb.storage.from(LEAD_BUCKET).remove([file.storage_path]);
    const { error } = await sb.from('lead_files').delete().eq('id', file.id);
    if (error) throw error;
  },
};

// ----------------------------------------------------------------
// Lead Matches (cache risultati AI matching)
// ----------------------------------------------------------------

const matchKey = 'commerciale.demo.leadMatches';

function readDemoMatches(): LeadMatch[] {
  try { return JSON.parse(localStorage.getItem(matchKey) ?? '[]'); }
  catch { return []; }
}
function writeDemoMatches(arr: LeadMatch[]) {
  localStorage.setItem(matchKey, JSON.stringify(arr));
}

export const leadMatchesService = {
  async list(leadId: string): Promise<LeadMatch[]> {
    if (isDemoMode) {
      return readDemoMatches().filter((m) => m.lead_id === leadId).sort((a, b) => b.score - a.score);
    }
    const { data, error } = await ensureSb()
      .from('lead_matches')
      .select('*')
      .eq('lead_id', leadId)
      .order('score', { ascending: false });
    if (error) throw error;
    return (data ?? []) as LeadMatch[];
  },

  async replace(leadId: string, matches: { funding_call_id: string; score: number; rationale: string }[]): Promise<LeadMatch[]> {
    if (isDemoMode) {
      const all = readDemoMatches().filter((m) => m.lead_id !== leadId);
      const now = new Date().toISOString();
      const created: LeadMatch[] = matches.map((m) => ({
        id: crypto.randomUUID(),
        lead_id: leadId,
        funding_call_id: m.funding_call_id,
        score: m.score,
        rationale: m.rationale,
        analyzed_at: now,
      }));
      writeDemoMatches([...all, ...created]);
      return created.sort((a, b) => b.score - a.score);
    }
    const sb = ensureSb();
    // Cancella i match esistenti per il lead
    await sb.from('lead_matches').delete().eq('lead_id', leadId);
    if (matches.length === 0) return [];
    const { data, error } = await sb
      .from('lead_matches')
      .insert(matches.map((m) => ({ ...m, lead_id: leadId })))
      .select();
    if (error) throw error;
    return ((data ?? []) as LeadMatch[]).sort((a, b) => b.score - a.score);
  },

  async analyze(lead: Lead, fundingCalls: FundingCall[]): Promise<{ matches: LeadMatch[]; model?: string }> {
    // Filtra bandi non scaduti
    const today = new Date().toISOString().slice(0, 10);
    const active = fundingCalls.filter((fc) => !fc.deadline || fc.deadline >= today);

    if (!lead.description?.trim()) {
      throw new Error('Inserisci una descrizione della tecnologia prima di lanciare il match AI.');
    }

    // Per i bandi con PDF allegato, scarica e codifica in base64
    const callsWithPdf = await Promise.all(
      active.map(async (fc) => {
        if (!fc.pdf_path) {
          return { id: fc.id, code: fc.code, name: fc.name, body: fc.body, deadline: fc.deadline, notes: fc.notes };
        }
        try {
          const url = await fundingCallPdfService.signedUrl(fc.pdf_path);
          if (!url) return { id: fc.id, code: fc.code, name: fc.name, body: fc.body, deadline: fc.deadline, notes: fc.notes };
          const blob = await fetch(url).then((r) => r.arrayBuffer());
          const b64 = btoa(String.fromCharCode(...new Uint8Array(blob)));
          return { id: fc.id, code: fc.code, name: fc.name, body: fc.body, deadline: fc.deadline, notes: fc.notes, pdf_base64: b64 };
        } catch {
          return { id: fc.id, code: fc.code, name: fc.name, body: fc.body, deadline: fc.deadline, notes: fc.notes };
        }
      }),
    );

    const res = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadName: lead.name,
        leadDescription: lead.description,
        leadPi: lead.pi,
        leadEnte: lead.ente,
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
    const stored = await this.replace(lead.id, json.matches);
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
