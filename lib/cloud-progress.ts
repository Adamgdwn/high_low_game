import { defaultPersistedState } from "@/lib/storage";
import type { PersistedState } from "@/lib/types";

export interface CloudGameProfileRow {
  user_id: string;
  state: PersistedState;
  updated_at?: string;
}

export function sanitizePersistedState(input: unknown): PersistedState {
  const raw = (input && typeof input === "object" ? input : {}) as Partial<PersistedState>;
  const fairDeckCount = raw.fairDeckCount;
  return {
    ...defaultPersistedState,
    ...raw,
    fairDeckCount:
      fairDeckCount === 1 || fairDeckCount === 2 || fairDeckCount === 3 ? fairDeckCount : 1,
    balance: Number.isFinite(raw.balance) ? Math.max(0, Math.floor(raw.balance as number)) : defaultPersistedState.balance,
    streak: Number.isFinite(raw.streak) ? Math.max(0, Math.floor(raw.streak as number)) : defaultPersistedState.streak,
    lastBet: Number.isFinite(raw.lastBet) ? Math.max(0, Math.floor(raw.lastBet as number)) : defaultPersistedState.lastBet
  };
}
