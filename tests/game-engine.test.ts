import { describe, expect, it } from "vitest";
import { calculateBonus, determineOutcome, pickNextCard, resolvePayout } from "@/lib/game-engine";
import type { Card } from "@/lib/types";

const current: Card = { id: "♠-7", suit: "♠", rank: 7 };
const higher: Card = { id: "♥-11", suit: "♥", rank: 11 };
const lower: Card = { id: "♣-2", suit: "♣", rank: 2 };
const tie: Card = { id: "♦-7", suit: "♦", rank: 7 };

describe("determineOutcome", () => {
  it("returns win/loss/push correctly", () => {
    expect(determineOutcome("high", current, higher)).toBe("win");
    expect(determineOutcome("low", current, higher)).toBe("loss");
    expect(determineOutcome("low", current, lower)).toBe("win");
    expect(determineOutcome("high", current, tie)).toBe("push");
  });
});

describe("resolvePayout", () => {
  it("applies streak bonus on interval", () => {
    expect(calculateBonus(100, 2)).toBe(0);
    expect(calculateBonus(100, 3)).toBe(10);
    expect(resolvePayout({ bet: 100, outcome: "win", previousStreak: 2 })).toEqual({
      streak: 3,
      bonus: 10,
      profit: 110
    });
  });

  it("handles loss and push", () => {
    expect(resolvePayout({ bet: 100, outcome: "loss", previousStreak: 4 })).toEqual({
      streak: 0,
      bonus: 0,
      profit: -100
    });
    expect(resolvePayout({ bet: 100, outcome: "push", previousStreak: 4 })).toEqual({
      streak: 4,
      bonus: 0,
      profit: 0
    });
  });
});

describe("pickNextCard rigged modes", () => {
  const deck: Card[] = [
    { id: "♠-3", suit: "♠", rank: 3 },
    { id: "♠-5", suit: "♠", rank: 5 },
    { id: "♠-9", suit: "♠", rank: 9 },
    { id: "♠-12", suit: "♠", rank: 12 }
  ];

  it("alwaysWin picks a higher card for HIGH", () => {
    const result = pickNextCard({ deck, current, mode: "alwaysWin", choice: "high", rng: () => 0 });
    expect(result.nextCard.rank).toBeGreaterThan(current.rank);
  });

  it("alwaysLose picks a higher card when player chooses LOW", () => {
    const result = pickNextCard({ deck, current, mode: "alwaysLose", choice: "low", rng: () => 0 });
    expect(result.nextCard.rank).toBeGreaterThan(current.rank);
  });
});
