import type { BonusConfig, TieBehavior } from "@/lib/types";

export const STARTING_BALANCE = 10_000;
export const DEFAULT_TIE_BEHAVIOR: TieBehavior = "push";
export const MIN_BET = 10;
export const BET_STEP = 10;
export const QUICK_BETS = [10, 50, 100, 500];
export const SHUFFLE_THRESHOLD = 10;

export const BONUS_CONFIG: BonusConfig = {
  streakEvery: 3,
  bonusPct: 0.1,
  bonusCap: 250
};

export const STORAGE_KEY = "vegas-high-low-mvp-v1";
