"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BetControls } from "@/components/BetControls";
import { GameBoard } from "@/components/GameBoard";
import { SettingsModal } from "@/components/SettingsModal";
import { Toasts, type ToastItem } from "@/components/Toasts";
import { BONUS_CONFIG, MIN_BET, SHUFFLE_THRESHOLD, STARTING_BALANCE } from "@/lib/constants";
import {
  createDeck,
  determineOutcome,
  drawCurrentCard,
  modeLabel,
  pickNextCard,
  resolvePayout,
  shuffleDeck
} from "@/lib/game-engine";
import { playSound } from "@/lib/sound";
import { defaultPersistedState, loadPersistedState, savePersistedState } from "@/lib/storage";
import type { Card, GameMode, GamePhase, PlayerChoice, RoundRecord } from "@/lib/types";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { clamp, formatChips } from "@/lib/utils";

function toastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function roundId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeBet(raw: number, balance: number) {
  if (!Number.isFinite(raw)) return 0;
  return clamp(Math.floor(raw), 0, Math.max(0, balance));
}

export default function Page() {
  const systemReduced = usePrefersReducedMotion();

  const [hydrated, setHydrated] = useState(false);
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [mode, setMode] = useState<GameMode>("fair");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [reducedMotionManual, setReducedMotionManual] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bet, setBet] = useState(100);
  const [welcomeSeen, setWelcomeSeen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  const [deck, setDeck] = useState<Card[]>([]);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [revealCard, setRevealCard] = useState<Card | null>(null);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [isRevealing, setIsRevealing] = useState(false);
  const [lastRound, setLastRound] = useState<RoundRecord | null>(null);
  const [history, setHistory] = useState<RoundRecord[]>([]);
  const [pendingChoice, setPendingChoice] = useState<PlayerChoice | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const reducedMotion = reducedMotionManual || systemReduced;
  const timers = useRef<number[]>([]);
  const latestBalanceRef = useRef(balance);

  useEffect(() => {
    latestBalanceRef.current = balance;
  }, [balance]);

  const canPlay = useMemo(
    () => !!currentCard && balance > 0 && bet >= MIN_BET && bet <= balance && phase !== "revealing",
    [currentCard, balance, bet, phase]
  );
  const canChooseHigh = canPlay && currentCard?.rank !== 13;
  const canChooseLow = canPlay && currentCard?.rank !== 1;

  const lastResultText = lastRound
    ? lastRound.outcome === "win"
      ? "Last: Win"
      : lastRound.outcome === "loss"
        ? "Last: Loss"
        : "Last: Push"
    : "Last: —";

  function schedule(fn: () => void, delay: number) {
    const id = window.setTimeout(fn, delay);
    timers.current.push(id);
  }

  function clearAllTimers() {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }

  function addToast(kind: ToastItem["kind"], message: string, duration = 1800) {
    const id = toastId();
    setToasts((prev) => [...prev, { id, kind, message }]);
    schedule(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }

  function ensureDeck(workingDeck: Card[]) {
    if (workingDeck.length >= SHUFFLE_THRESHOLD) return { deck: workingDeck, shuffled: false };
    return { deck: shuffleDeck(createDeck()), shuffled: true };
  }

  function drawNewCurrent(nextMode: GameMode, workingDeck: Card[]) {
    const checked = ensureDeck(workingDeck);
    if (checked.shuffled) addToast("info", "Shuffling…", 1100);
    const picked = drawCurrentCard({ deck: checked.deck, mode: nextMode });
    return { current: picked.card, deck: picked.deck };
  }

  function setPhaseByBet(nextBet: number) {
    setPhase((prev) => (prev === "revealing" ? prev : currentCard && nextBet >= MIN_BET ? "ready" : "idle"));
  }

  useEffect(() => {
    const saved = loadPersistedState();
    setBalance(saved.balance);
    setMode(saved.mode);
    setSoundEnabled(saved.soundEnabled);
    setReducedMotionManual(saved.reducedMotion);
    setStreak(saved.streak);
    setBet(saved.lastBet);
    setWelcomeSeen(saved.welcomeSeen);
    setDebugOpen(saved.debugOpen);

    const initialDeck = shuffleDeck(createDeck());
    const start = drawCurrentCard({ deck: initialDeck, mode: saved.mode });
    setDeck(start.deck);
    setCurrentCard(start.card);
    setPhase(saved.lastBet >= MIN_BET ? "ready" : "idle");
    setHydrated(true);
  }, []);

  useEffect(() => () => clearAllTimers(), []);

  useEffect(() => {
    if (!hydrated) return;
    savePersistedState({
      ...defaultPersistedState,
      balance,
      mode,
      soundEnabled,
      reducedMotion: reducedMotionManual,
      streak,
      lastBet: bet,
      welcomeSeen,
      debugOpen
    });
  }, [hydrated, balance, mode, soundEnabled, reducedMotionManual, streak, bet, welcomeSeen, debugOpen]);

  useEffect(() => {
    if (!hydrated || welcomeSeen) return;
    addToast("info", "Welcome! Start with 10,000 fake chips.", 2600);
    setWelcomeSeen(true);
  }, [hydrated, welcomeSeen]);

  useEffect(() => {
    if (!hydrated) return;
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen) {
        if (e.key === "Escape") setSettingsOpen(false);
        return;
      }
      const key = e.key.toLowerCase();
      if ((e.key === "ArrowUp" || key === "h") && canChooseHigh) {
        e.preventDefault();
        handleChoose("high");
      }
      if ((e.key === "ArrowDown" || key === "l") && canChooseLow) {
        e.preventDefault();
        handleChoose("low");
      }
      if (e.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hydrated, settingsOpen, canPlay, canChooseHigh, canChooseLow, currentCard, deck, mode, bet, balance, streak, phase, reducedMotion, soundEnabled]);

  function handleSetBet(value: number) {
    playSound("click", soundEnabled);
    const next = normalizeBet(value, balance);
    setBet(next);
    setPhaseByBet(next);
  }

  function handleAddBet(delta: number) {
    handleSetBet(bet + delta);
  }

  function handleModeChange(nextMode: GameMode) {
    setMode(nextMode);
    addToast("info", `Mode: ${modeLabel(nextMode)}`, 1400);
    setDeck((prev) => {
      const prepared = drawNewCurrent(nextMode, prev);
      setCurrentCard(prepared.current);
      setRevealCard(null);
      setPhase(bet >= MIN_BET ? "ready" : "idle");
      return prepared.deck;
    });
  }

  function startNextRound(nextMode: GameMode, workingDeck: Card[], nextBalance: number) {
    const prepared = drawNewCurrent(nextMode, workingDeck);
    setDeck(prepared.deck);
    setCurrentCard(prepared.current);
    setRevealCard(null);
    setPendingChoice(null);
    setIsRevealing(false);
    const adjustedBet = normalizeBet(bet, nextBalance);
    if (adjustedBet !== bet) setBet(adjustedBet);
    setPhase(adjustedBet >= MIN_BET && nextBalance > 0 ? "ready" : "idle");
  }

  function handleChoose(choice: PlayerChoice) {
    if (!canPlay || !currentCard) return;
    if ((choice === "high" && currentCard.rank === 13) || (choice === "low" && currentCard.rank === 1)) {
      addToast("warning", choice === "high" ? "HIGH unavailable on a King" : "LOW unavailable on an Ace", 1200);
      return;
    }
    if (!deck.length) {
      const shuffled = shuffleDeck(createDeck());
      setDeck(shuffled);
      addToast("info", "Shuffling…", 1100);
      return;
    }

    playSound("flip", soundEnabled);
    setPendingChoice(choice);
    setPhase("choice");

    const pick = pickNextCard({ deck, current: currentCard, mode, choice });
    if (pick.didReshuffle) addToast("info", "Shuffling…", 1100);

    const nextCard = pick.nextCard;
    const outcome = determineOutcome(choice, currentCard, nextCard);
    const payout = resolvePayout({ bet, outcome, previousStreak: streak, bonusConfig: BONUS_CONFIG });
    const nextBalance = Math.max(0, balance + payout.profit);

    const round: RoundRecord = {
      id: roundId(),
      current: currentCard,
      next: nextCard,
      choice,
      outcome,
      bet,
      profit: payout.profit,
      bonus: payout.bonus,
      mode,
      timestamp: Date.now()
    };

    setRevealCard(nextCard);
    setIsRevealing(true);
    setPhase("revealing");

    schedule(() => {
      setIsRevealing(false);
      setPhase("result");
      setLastRound(round);
      setHistory((prev) => [round, ...prev].slice(0, 12));
      setBalance(nextBalance);
      setStreak(payout.streak);

      if (outcome === "win") {
        playSound("win", soundEnabled);
        addToast("success", payout.bonus > 0 ? `Big Win! +${formatChips(payout.profit)} (bonus!)` : `Win! +${formatChips(payout.profit)}`);
      } else if (outcome === "loss") {
        playSound("loss", soundEnabled);
        addToast("error", `Ouch! -${formatChips(bet)}`);
      } else {
        playSound("push", soundEnabled);
        addToast("warning", "Push (tie) - bet returned");
      }

      schedule(() => {
        startNextRound(mode, pick.deck, nextBalance);
      }, reducedMotion ? 50 : 700);
    }, reducedMotion ? 30 : 650);
  }

  if (!hydrated) {
    return (
      <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center p-6">
        <div className="panel neon-ring w-full max-w-md p-6 text-center">
          <div className="text-sm uppercase tracking-[0.24em] text-slate-400">Loading Table</div>
          <div className="mt-2 text-2xl font-bold text-slate-100">Vegas High/Low</div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-4 sm:p-6">
      <Toasts items={toasts} />

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Social Casino MVP</div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-50 sm:text-4xl">Vegas-Style High / Low</h1>
          <p className="mt-2 text-sm text-slate-300">Chips have no cash value. No cash out. No prizes.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDebugOpen((v) => !v)}
            className="btn-press rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            {debugOpen ? "Hide Debug" : "Debug"}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="btn-press rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100 shadow-neon hover:bg-cyan-400/15"
          >
            Settings
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <GameBoard
          balance={balance}
          currentCard={currentCard}
          revealCard={revealCard}
          bet={bet}
          streak={streak}
          phase={phase}
          lastRound={lastRound}
          lastResultText={lastResultText}
          mode={mode}
          canPlay={canPlay}
          canChooseHigh={canChooseHigh}
          canChooseLow={canChooseLow}
          isRevealing={isRevealing}
          reducedMotion={reducedMotion}
          onChoose={handleChoose}
        />

        <div className="space-y-4">
          <BetControls balance={balance} bet={bet} onSetBet={handleSetBet} onAddBet={handleAddBet} />

          <section className="panel p-4">
            <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-400">Quick Help</div>
            <ul className="space-y-1 text-sm text-slate-300">
              <li>Arrow Up / H = HIGH</li>
              <li>Arrow Down / L = LOW</li>
              <li>Aces are low (A=1)</li>
              <li>Ties are Push (bet returned)</li>
              <li>Win = +bet profit, Loss = -bet</li>
            </ul>
          </section>

          {debugOpen && (
            <section className="panel p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Debug Panel</div>
                <button
                  type="button"
                  onClick={() => {
                    clearAllTimers();
                    setBalance(STARTING_BALANCE);
                    setStreak(0);
                    setBet(100);
                    const fresh = shuffleDeck(createDeck());
                    const start = drawCurrentCard({ deck: fresh, mode });
                    setDeck(start.deck);
                    setCurrentCard(start.card);
                    setRevealCard(null);
                    setPendingChoice(null);
                    setIsRevealing(false);
                    setLastRound(null);
                    setHistory([]);
                    setPhase("ready");
                    addToast("info", "Table reset", 1000);
                  }}
                  className="btn-press rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                >
                  Reset Table
                </button>
              </div>
              <pre className="max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-slate-300">
{JSON.stringify(
  {
    mode,
    phase,
    balance,
    bet,
    streak,
    pendingChoice,
    deckRemaining: deck.length,
    currentCard,
    lastRound,
    recentRounds: history.slice(0, 5)
  },
  null,
  2
)}
              </pre>
            </section>
          )}
        </div>
      </div>

      <footer className="mt-5 rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
        Social casino demo only. Chips have no cash value. No cash out. No prizes or gift cards.
      </footer>

      <SettingsModal
        open={settingsOpen}
        mode={mode}
        soundEnabled={soundEnabled}
        reducedMotion={reducedMotionManual}
        onClose={() => setSettingsOpen(false)}
        onModeChange={handleModeChange}
        onSoundChange={setSoundEnabled}
        onReducedMotionChange={setReducedMotionManual}
      />
    </main>
  );
}
