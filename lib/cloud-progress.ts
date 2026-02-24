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
    soundEnabled: typeof raw.soundEnabled === "boolean" ? raw.soundEnabled : defaultPersistedState.soundEnabled,
    zenMode: typeof raw.zenMode === "boolean" ? raw.zenMode : defaultPersistedState.zenMode,
    zenMusicEnabled: typeof raw.zenMusicEnabled === "boolean" ? raw.zenMusicEnabled : defaultPersistedState.zenMusicEnabled,
    zenMusicTrack:
      raw.zenMusicTrack === "calm" || raw.zenMusicTrack === "focus" || raw.zenMusicTrack === "night"
        ? raw.zenMusicTrack
        : defaultPersistedState.zenMusicTrack,
    zenMusicVolume:
      Number.isFinite(raw.zenMusicVolume) ? Math.max(0, Math.min(100, Math.floor(raw.zenMusicVolume as number))) : defaultPersistedState.zenMusicVolume,
    reducedMotion: typeof raw.reducedMotion === "boolean" ? raw.reducedMotion : defaultPersistedState.reducedMotion,
    balance: Number.isFinite(raw.balance) ? Math.max(0, Math.floor(raw.balance as number)) : defaultPersistedState.balance,
    streak: Number.isFinite(raw.streak) ? Math.max(0, Math.floor(raw.streak as number)) : defaultPersistedState.streak,
    lastBet: Number.isFinite(raw.lastBet) ? Math.max(0, Math.floor(raw.lastBet as number)) : defaultPersistedState.lastBet
  };
}
