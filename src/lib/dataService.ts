import { isDemoMode, supabase } from './supabase';
import {
  demoOffers,
  demoProjectManagers,
  demoFundingCalls,
} from './demoStorage';
import type {
  Offer,
  ProjectManager,
  FundingCall,
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
