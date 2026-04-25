import type { Offer, ProjectManager, FundingCall } from '../types';

// ============================================================
// Demo storage: emula Supabase usando localStorage.
// Attivo quando VITE_SUPABASE_URL/ANON_KEY non sono configurate.
// ============================================================

const KEYS = {
  user: 'commerciale.demo.user',
  offers: 'commerciale.demo.offers',
  projectManagers: 'commerciale.demo.projectManagers',
  fundingCalls: 'commerciale.demo.fundingCalls',
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
