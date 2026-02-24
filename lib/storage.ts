import { STARTING_BALANCE, STORAGE_KEY } from "@/lib/constants";
import type { PersistedState } from "@/lib/types";

export const defaultPersistedState: PersistedState = {
  balance: STARTING_BALANCE,
  mode: "fair",
  fairDeckCount: 1,
  soundEnabled: false,
  zenMode: false,
  zenMusicEnabled: false,
  zenMusicTrack: "calm",
  zenMusicVolume: 35,
  reducedMotion: false,
  streak: 0,
  lastBet: 100,
  borrowUsed: false,
  welcomeSeen: false,
  debugOpen: false
};

export function loadPersistedState(): PersistedState {
  if (typeof window === "undefined") return defaultPersistedState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPersistedState;
    return { ...defaultPersistedState, ...(JSON.parse(raw) as Partial<PersistedState>) };
  } catch {
    return defaultPersistedState;
  }
}

export function savePersistedState(state: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore persistence errors
  }
}
