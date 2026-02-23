export type GameMode = "fair" | "alwaysWin" | "alwaysLose";
export type TieBehavior = "push";
export type PlayerChoice = "high" | "low";
export type RoundOutcome = "win" | "loss" | "push";
export type GamePhase = "idle" | "ready" | "choice" | "revealing" | "result";
export type Suit = "♠" | "♥" | "♦" | "♣";

export interface Card {
  id: string;
  suit: Suit;
  rank: number;
}

export interface BonusConfig {
  streakEvery: number;
  bonusPct: number;
  bonusCap: number;
}

export interface PersistedState {
  balance: number;
  mode: GameMode;
  fairDeckCount: 1 | 2 | 3;
  soundEnabled: boolean;
  reducedMotion: boolean;
  streak: number;
  lastBet: number;
  borrowUsed: boolean;
  welcomeSeen: boolean;
  debugOpen: boolean;
}

export interface RoundRecord {
  id: string;
  current: Card;
  next: Card;
  choice: PlayerChoice;
  outcome: RoundOutcome;
  bet: number;
  profit: number;
  bonus: number;
  mode: GameMode;
  timestamp: number;
}
