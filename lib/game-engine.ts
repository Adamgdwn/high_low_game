import { BONUS_CONFIG, DEFAULT_TIE_BEHAVIOR } from "@/lib/constants";
import type { BonusConfig, Card, GameMode, PlayerChoice, RoundOutcome, Suit, TieBehavior } from "@/lib/types";

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({ id: `${suit}-${rank}`, suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[], rng: () => number = Math.random): Card[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRandom<T>(items: T[], rng: () => number = Math.random): T {
  return items[Math.floor(rng() * items.length)];
}

export function removeCard(deck: Card[], cardId: string): Card[] {
  const idx = deck.findIndex((c) => c.id === cardId);
  if (idx < 0) return deck;
  return [...deck.slice(0, idx), ...deck.slice(idx + 1)];
}

export function compareCards(current: Card, next: Card): -1 | 0 | 1 {
  if (next.rank > current.rank) return 1;
  if (next.rank < current.rank) return -1;
  return 0;
}

export function determineOutcome(
  choice: PlayerChoice,
  current: Card,
  next: Card,
  tieBehavior: TieBehavior = DEFAULT_TIE_BEHAVIOR
): RoundOutcome {
  const cmp = compareCards(current, next);
  if (cmp === 0) return tieBehavior === "push" ? "push" : "loss";
  if (choice === "high") return cmp > 0 ? "win" : "loss";
  return cmp < 0 ? "win" : "loss";
}

export function calculateBonus(bet: number, streakAfterRound: number, config: BonusConfig = BONUS_CONFIG) {
  if (streakAfterRound <= 0) return 0;
  if (streakAfterRound % config.streakEvery !== 0) return 0;
  return Math.min(Math.floor(bet * config.bonusPct), config.bonusCap);
}

export function resolvePayout(params: { bet: number; outcome: RoundOutcome; previousStreak: number; bonusConfig?: BonusConfig }) {
  const { bet, outcome, previousStreak, bonusConfig = BONUS_CONFIG } = params;
  if (outcome === "push") return { streak: previousStreak, bonus: 0, profit: 0 };
  if (outcome === "loss") return { streak: 0, bonus: 0, profit: -bet };
  const streak = previousStreak + 1;
  const bonus = calculateBonus(bet, streak, bonusConfig);
  return { streak, bonus, profit: bet + bonus };
}

export function drawCurrentCard(params: { deck: Card[]; mode: GameMode; rng?: () => number }) {
  const { deck, mode, rng = Math.random } = params;
  // Rigged modes avoid edge ranks (A/K) so both HIGH and LOW can always be forced next.
  const eligible = mode === "fair" ? deck : deck.filter((c) => c.rank > 1 && c.rank < 13);
  const source = eligible.length ? eligible : deck;
  const card = pickRandom(source, rng);
  return { card, deck: removeCard(deck, card.id) };
}

export interface PickNextCardResult {
  nextCard: Card;
  deck: Card[];
  didReshuffle: boolean;
  riggedFallbackUsed: boolean;
}

export function pickNextCard(params: {
  deck: Card[];
  current: Card;
  mode: GameMode;
  choice: PlayerChoice;
  rng?: () => number;
}): PickNextCardResult {
  const { deck, current, mode, choice, rng = Math.random } = params;

  if (mode === "fair") {
    const nextCard = pickRandom(deck, rng);
    return { nextCard, deck: removeCard(deck, nextCard.id), didReshuffle: false, riggedFallbackUsed: false };
  }

  const wantsHigher = (mode === "alwaysWin" && choice === "high") || (mode === "alwaysLose" && choice === "low");
  const candidates = deck.filter((c) => (wantsHigher ? c.rank > current.rank : c.rank < current.rank));
  if (candidates.length) {
    const nextCard = pickRandom(candidates, rng);
    return { nextCard, deck: removeCard(deck, nextCard.id), didReshuffle: false, riggedFallbackUsed: false };
  }

  // Fallback path is explicit and deterministic in code:
  // reshuffle a fresh deck (minus current card) and try to force the required relation again.
  const reshuffled = shuffleDeck(removeCard(createDeck(), current.id), rng);
  const forcedCandidates = reshuffled.filter((c) => (wantsHigher ? c.rank > current.rank : c.rank < current.rank));
  if (forcedCandidates.length) {
    const nextCard = pickRandom(forcedCandidates, rng);
    return { nextCard, deck: removeCard(reshuffled, nextCard.id), didReshuffle: true, riggedFallbackUsed: false };
  }

  // Last resort (should be unreachable due to drawCurrentCard edge-rank guard).
  const nonTie = reshuffled.filter((c) => c.rank !== current.rank);
  const nextCard = pickRandom(nonTie.length ? nonTie : reshuffled, rng);
  return { nextCard, deck: removeCard(reshuffled, nextCard.id), didReshuffle: true, riggedFallbackUsed: true };
}

export function modeLabel(mode: GameMode) {
  if (mode === "fair") return "Fair";
  if (mode === "alwaysWin") return "Demo: Always Win";
  return "Chaos: Always Lose";
}
