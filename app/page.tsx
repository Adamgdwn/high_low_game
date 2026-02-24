"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BetControls } from "@/components/BetControls";
import { GameBoard } from "@/components/GameBoard";
import { SettingsModal } from "@/components/SettingsModal";
import { Toasts, type ToastItem } from "@/components/Toasts";
import { sanitizePersistedState } from "@/lib/cloud-progress";
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
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Card, GameMode, GamePhase, PlayerChoice, RoundRecord } from "@/lib/types";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { clamp, formatChips } from "@/lib/utils";
import type { AuthChangeEvent, Session, SupabaseClient, User } from "@supabase/supabase-js";

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

type SessionGoalId = "play10" | "win3" | "streak3";

const SESSION_GOALS: Array<{
  id: SessionGoalId;
  label: string;
  targetLabel: string;
  progress: (input: { roundsPlayed: number; wins: number; streak: number }) => number;
  target: number;
}> = [
  {
    id: "play10",
    label: "Play 10 rounds",
    targetLabel: "10 rounds",
    progress: ({ roundsPlayed }) => roundsPlayed,
    target: 10
  },
  {
    id: "win3",
    label: "Win 3 hands",
    targetLabel: "3 wins",
    progress: ({ wins }) => wins,
    target: 3
  },
  {
    id: "streak3",
    label: "Reach a 3-win streak",
    targetLabel: "3 streak",
    progress: ({ streak }) => streak,
    target: 3
  }
];

export default function Page() {
  const systemReduced = usePrefersReducedMotion();

  const [hydrated, setHydrated] = useState(false);
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [mode, setMode] = useState<GameMode>("fair");
  const [fairDeckCount, setFairDeckCount] = useState<1 | 2 | 3>(1);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [reducedMotionManual, setReducedMotionManual] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bet, setBet] = useState(100);
  const [borrowUsed, setBorrowUsed] = useState(false);
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
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authNotice, setAuthNotice] = useState<{ kind: "info" | "error" | "success"; message: string } | null>(null);
  const [sessionRoundsPlayed, setSessionRoundsPlayed] = useState(0);
  const [sessionWins, setSessionWins] = useState(0);
  const [sessionGoalIndex, setSessionGoalIndex] = useState(0);
  const [lastGoalCompletionRound, setLastGoalCompletionRound] = useState(-1);
  const [cloudStatus, setCloudStatus] = useState<"local" | "ready" | "loading" | "saving" | "error">(
    isSupabaseConfigured() ? "ready" : "local"
  );

  const reducedMotion = reducedMotionManual || systemReduced || zenMode;
  const audioEnabled = soundEnabled && !zenMode;
  const timers = useRef<number[]>([]);
  const latestBalanceRef = useRef(balance);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const cloudInitializedRef = useRef(false);
  const applyingCloudStateRef = useRef(false);
  const saveCloudTimerRef = useRef<number | null>(null);

  useEffect(() => {
    latestBalanceRef.current = balance;
  }, [balance]);

  const canPlay = useMemo(
    () => !!currentCard && balance > 0 && bet >= MIN_BET && bet <= balance && phase !== "revealing",
    [currentCard, balance, bet, phase]
  );
  const canChooseHigh = canPlay && currentCard?.rank !== 13;
  const canChooseLow = canPlay && currentCard?.rank !== 1;
  const needsRecovery = balance < MIN_BET;
  const canBorrow = needsRecovery && !borrowUsed;
  const hasSessionActivity = history.length > 0 || balance !== STARTING_BALANCE || streak > 0 || borrowUsed;
  const activeSessionGoal = SESSION_GOALS[sessionGoalIndex % SESSION_GOALS.length];
  const activeSessionGoalProgress = Math.min(
    activeSessionGoal.target,
    activeSessionGoal.progress({ roundsPlayed: sessionRoundsPlayed, wins: sessionWins, streak })
  );
  const activeSessionGoalComplete = activeSessionGoalProgress >= activeSessionGoal.target;
  const activeSessionGoalPct = Math.round((activeSessionGoalProgress / activeSessionGoal.target) * 100);

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

  function currentPersistedSnapshot() {
    return {
      ...defaultPersistedState,
      balance,
      mode,
      fairDeckCount,
      soundEnabled,
      zenMode,
      reducedMotion: reducedMotionManual,
      streak,
      lastBet: bet,
      borrowUsed,
      welcomeSeen,
      debugOpen
    };
  }

  function applyPersistedSnapshot(snapshot: ReturnType<typeof currentPersistedSnapshot>) {
    setBalance(snapshot.balance);
    setMode(snapshot.mode);
    setFairDeckCount(snapshot.fairDeckCount);
    setSoundEnabled(snapshot.soundEnabled);
    setZenMode(snapshot.zenMode);
    setReducedMotionManual(snapshot.reducedMotion);
    setStreak(snapshot.streak);
    setBet(snapshot.lastBet);
    setBorrowUsed(snapshot.borrowUsed);
    setWelcomeSeen(snapshot.welcomeSeen);
    setDebugOpen(snapshot.debugOpen);
    setSessionRoundsPlayed(0);
    setSessionWins(0);
    setSessionGoalIndex(0);
    setLastGoalCompletionRound(-1);

    const fresh = shuffleDeck(createDeck(snapshot.fairDeckCount));
    const start = drawCurrentCard({ deck: fresh, mode: snapshot.mode });
    setDeck(start.deck);
    setCurrentCard(start.card);
    setRevealCard(null);
    setPendingChoice(null);
    setIsRevealing(false);
    setLastRound(null);
    setHistory([]);
    setPhase(snapshot.lastBet >= MIN_BET && snapshot.balance > 0 ? "ready" : "idle");
  }

  function ensureDeck(workingDeck: Card[], currentToExclude?: Card | null) {
    if (workingDeck.length >= SHUFFLE_THRESHOLD) return { deck: workingDeck, shuffled: false };
    let fresh = shuffleDeck(createDeck(fairDeckCount));
    if (currentToExclude) fresh = fresh.filter((c) => c.id !== currentToExclude.id);
    return { deck: fresh, shuffled: true };
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
    setFairDeckCount(saved.fairDeckCount);
    setSoundEnabled(saved.soundEnabled);
    setZenMode(saved.zenMode);
    setReducedMotionManual(saved.reducedMotion);
    setStreak(saved.streak);
    setBet(saved.lastBet);
    setBorrowUsed(saved.borrowUsed);
    setWelcomeSeen(saved.welcomeSeen);
    setDebugOpen(saved.debugOpen);

    const initialDeck = shuffleDeck(createDeck(saved.fairDeckCount));
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
      fairDeckCount,
      soundEnabled,
      zenMode,
      reducedMotion: reducedMotionManual,
      streak,
      lastBet: bet,
      borrowUsed,
      welcomeSeen,
      debugOpen
    });
  }, [hydrated, balance, mode, fairDeckCount, soundEnabled, zenMode, reducedMotionManual, streak, bet, borrowUsed, welcomeSeen, debugOpen]);

  useEffect(() => {
    if (!hydrated || welcomeSeen) return;
    addToast("info", "Welcome. Start with 10,000 chips and take your time.", 2600);
    setWelcomeSeen(true);
  }, [hydrated, welcomeSeen]);

  useEffect(() => {
    if (!hydrated) return;
    if (!activeSessionGoalComplete) return;
    if (lastGoalCompletionRound === sessionRoundsPlayed) return;
    addToast("info", `Mini goal complete: ${activeSessionGoal.label}`, 1800);
    setLastGoalCompletionRound(sessionRoundsPlayed);
    setSessionGoalIndex((prev) => (prev + 1) % SESSION_GOALS.length);
  }, [hydrated, activeSessionGoalComplete, activeSessionGoal.label, lastGoalCompletionRound, sessionRoundsPlayed]);

  useEffect(() => {
    if (!hydrated) return;
    if (!isSupabaseConfigured()) {
      setCloudStatus("local");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setCloudStatus("local");
      return;
    }
    const client = supabase;
    supabaseRef.current = client;

    async function loadCloudForUser(user: User) {
      setCloudStatus("loading");
      const { data, error } = await client
        .from("game_profiles")
        .select("state")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setCloudStatus("error");
        addToast("error", "Cloud sync load failed");
        return;
      }

      if (data?.state) {
        applyingCloudStateRef.current = true;
        applyPersistedSnapshot(sanitizePersistedState(data.state));
        schedule(() => {
          applyingCloudStateRef.current = false;
        }, 50);
        addToast("info", "Cloud progress loaded", 1400);
      }

      cloudInitializedRef.current = true;
      setCloudStatus("ready");
    }

    async function bootstrap() {
      const { data, error } = await client.auth.getSession();
      if (error) {
        setCloudStatus("error");
        return;
      }
      const user = data.session?.user ?? null;
      setAuthUser(user);
      if (user) {
        await loadCloudForUser(user);
      } else {
        cloudInitializedRef.current = true;
        setCloudStatus("ready");
      }
    }

    void bootstrap();

    const { data: authSub } = client.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        const user = session?.user ?? null;
        setAuthUser(user);
        if (event === "SIGNED_IN" && user) {
          setAuthDialogOpen(false);
          setAuthNotice(null);
          cloudInitializedRef.current = false;
          addToast("success", `Signed in: ${user.email ?? "player"}`, 1400);
          await loadCloudForUser(user);
        }
        if (event === "SIGNED_OUT") {
          setCloudStatus("ready");
          addToast("info", "Signed out (local save still active)", 1400);
        }
      }
    );

    return () => {
      authSub.subscription.unsubscribe();
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (!authUser) return;
    if (!cloudInitializedRef.current) return;
    if (applyingCloudStateRef.current) return;
    const supabase = supabaseRef.current;
    if (!supabase) return;

    if (saveCloudTimerRef.current) window.clearTimeout(saveCloudTimerRef.current);
    saveCloudTimerRef.current = window.setTimeout(async () => {
      setCloudStatus("saving");
      const { error } = await supabase.from("game_profiles").upsert(
        {
          user_id: authUser.id,
          state: currentPersistedSnapshot()
        },
        { onConflict: "user_id" }
      );
      setCloudStatus(error ? "error" : "ready");
      if (error) addToast("error", "Cloud sync save failed");
    }, 700);

    return () => {
      if (saveCloudTimerRef.current) {
        window.clearTimeout(saveCloudTimerRef.current);
        saveCloudTimerRef.current = null;
      }
    };
  }, [
    hydrated,
    authUser,
    balance,
    mode,
    fairDeckCount,
    soundEnabled,
    zenMode,
    reducedMotionManual,
    streak,
    bet,
    borrowUsed,
    welcomeSeen,
    debugOpen
  ]);

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
  }, [hydrated, settingsOpen, canPlay, canChooseHigh, canChooseLow, currentCard, deck, mode, bet, balance, streak, phase, reducedMotion, audioEnabled, zenMode]);

  function handleSetBet(value: number) {
    playSound("click", audioEnabled);
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

  function handleFairDeckCountChange(count: 1 | 2 | 3) {
    setFairDeckCount(count);
    addToast("info", `Fair mode shoe: ${count} deck${count > 1 ? "s" : ""}`, 1400);
    const freshDeck = shuffleDeck(createDeck(count));
    const start = drawCurrentCard({ deck: freshDeck, mode });
    setDeck(start.deck);
    setCurrentCard(start.card);
    setRevealCard(null);
    setPendingChoice(null);
    setPhase(bet >= MIN_BET ? "ready" : "idle");
  }

  async function handleSendMagicLink() {
    const email = authEmail.trim();
    const supabase = supabaseRef.current;
    if (!supabase || !email) return;
    setAuthNotice(null);
    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined
      }
    });
    setAuthBusy(false);
    if (error) {
      setAuthNotice({ kind: "error", message: error.message || "Magic link failed" });
      addToast("error", error.message || "Magic link failed");
      setCloudStatus("error");
      return;
    }
    setAuthNotice({ kind: "info", message: `Magic link sent to ${email}. Check inbox and spam/promotions.` });
    addToast("info", `Magic link sent to ${email}`, 2200);
  }

  async function handleEmailPasswordSignIn() {
    const supabase = supabaseRef.current;
    const email = authEmail.trim();
    if (!supabase || !email || !authPassword) return;
    setAuthNotice(null);
    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: authPassword
    });
    setAuthBusy(false);
    if (error) {
      setAuthNotice({ kind: "error", message: error.message || "Sign in failed" });
      addToast("error", error.message || "Sign in failed");
      setCloudStatus("error");
      return;
    }
    setAuthDialogOpen(false);
    setAuthNotice({ kind: "success", message: "Signed in." });
    addToast("success", "Signed in", 1400);
  }

  async function handleCreateAccount() {
    const supabase = supabaseRef.current;
    const email = authEmail.trim();
    if (!supabase || !email || !authPassword) return;
    setAuthNotice(null);
    setAuthBusy(true);
    const { error, data } = await supabase.auth.signUp({
      email,
      password: authPassword,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined
      }
    });
    setAuthBusy(false);
    if (error) {
      setAuthNotice({ kind: "error", message: error.message || "Create account failed" });
      addToast("error", error.message || "Create account failed");
      setCloudStatus("error");
      return;
    }
    if (data.user && !data.session) {
      setAuthNotice({
        kind: "info",
        message: "Account created. Confirmation email should arrive shortly. Check spam/promotions, then click the link and return."
      });
      addToast("info", "Account created. Check email to confirm, then sign in.", 2600);
    } else {
      setAuthDialogOpen(false);
      setAuthNotice({ kind: "success", message: "Account created and signed in." });
      addToast("success", "Account created and signed in", 1800);
    }
  }

  async function handleSignOut() {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    setAuthBusy(true);
    await supabase.auth.signOut();
    setAuthBusy(false);
  }

  function handleShareByEmail() {
    if (typeof window === "undefined") return;
    const subject = "Try this High / Low game";
    const body = `Play this Vegas-style High / Low game: ${window.location.href}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function handleBorrowChips() {
    if (!canBorrow) return;
    setBalance((prev) => prev + 5000);
    setBorrowUsed(true);
    if (bet < MIN_BET) setBet(100);
    setPhase("ready");
    addToast("info", "House credit added: +5,000 chips (one-time borrow)", 2200);
  }

  function resetGameTable() {
    clearAllTimers();
    setBalance(STARTING_BALANCE);
    setStreak(0);
    setBet(100);
    setBorrowUsed(false);
    setSessionRoundsPlayed(0);
    setSessionWins(0);
    setSessionGoalIndex(0);
    setLastGoalCompletionRound(-1);
    const fresh = shuffleDeck(createDeck(fairDeckCount));
    const start = drawCurrentCard({ deck: fresh, mode });
    setDeck(start.deck);
    setCurrentCard(start.card);
    setRevealCard(null);
    setPendingChoice(null);
    setIsRevealing(false);
    setLastRound(null);
    setHistory([]);
    setPhase("ready");
    addToast("info", "New game started", 1200);
  }

  function handleResetGameTable() {
    if (!hasSessionActivity) {
      resetGameTable();
      return;
    }
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Start a new game and clear this session's table progress?");
      if (!confirmed) return;
    }
    resetGameTable();
  }

  function startNextRound(workingDeck: Card[], nextBalance: number, nextCurrentCard: Card) {
    const checked = ensureDeck(workingDeck, nextCurrentCard);
    if (checked.shuffled) addToast("info", "Shuffling…", 1100);
    setDeck(checked.deck);
    setCurrentCard(nextCurrentCard);
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
      const shuffled = shuffleDeck(createDeck(fairDeckCount)).filter((c) => c.id !== currentCard.id);
      setDeck(shuffled);
      addToast("info", "Shuffling…", 1100);
      return;
    }

    playSound("flip", audioEnabled);
    setPendingChoice(choice);
    setPhase("choice");

    const pick = pickNextCard({ deck, current: currentCard, mode, choice, deckCount: fairDeckCount });
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

    const revealDelay = reducedMotion ? 20 : zenMode ? 520 : 480;
    const nextRoundDelay = reducedMotion ? 40 : zenMode ? 560 : 420;

    schedule(() => {
      setIsRevealing(false);
      setPhase("result");
      setLastRound(round);
      setHistory((prev) => [round, ...prev].slice(0, 12));
      setBalance(nextBalance);
      setStreak(payout.streak);
      setSessionRoundsPlayed((prev) => prev + 1);
      if (outcome === "win") setSessionWins((prev) => prev + 1);

      if (outcome === "win") {
        playSound("win", audioEnabled);
        addToast("success", payout.bonus > 0 ? `Nice hit! +${formatChips(payout.profit)} (bonus)` : `Win! +${formatChips(payout.profit)}`);
        if ([3, 5, 10].includes(payout.streak)) {
          addToast("info", `Nice run: ${payout.streak}-win streak`, 1500);
        }
      } else if (outcome === "loss") {
        playSound("loss", audioEnabled);
        addToast("error", `Ouch! -${formatChips(bet)}`);
      } else {
        playSound("push", audioEnabled);
        addToast("warning", "Push (tie), bet returned");
      }

      schedule(() => {
        startNextRound(pick.deck, nextBalance, nextCard);
      }, nextRoundDelay);
    }, revealDelay);
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
        <div className="flex flex-col items-end gap-2">
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

          <div className="panel w-full min-w-[18rem] max-w-[28rem] p-3">
            {!isSupabaseConfigured() ? (
              <div className="text-xs text-slate-300">
                Cloud save is off. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable magic-link login and cross-device progress.
              </div>
            ) : authUser ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Signed In</div>
                  <div className="text-sm font-semibold text-slate-100">{authUser.email ?? "Player"}</div>
                  <div className="text-xs text-slate-400">
                    Cloud: {cloudStatus === "saving" ? "Saving…" : cloudStatus === "loading" ? "Loading…" : cloudStatus}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleShareByEmail}
                    className="btn-press rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/15"
                  >
                    Share this app with a friend
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={authBusy}
                    className="btn-press rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {authBusy ? "Working…" : "Log Out"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthNotice(null);
                    setAuthDialogOpen(true);
                  }}
                  className="w-full text-left text-sm text-slate-200"
                >
                  <span className="font-semibold text-cyan-100">Sign up or log in</span> to sync your game across devices.
                </button>
                <div className="text-[11px] text-slate-400">
                  One tap opens email/password or magic-link sign in.
                </div>
                <button
                  type="button"
                  onClick={handleShareByEmail}
                  className="btn-press w-full rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/15"
                >
                  Share this app with a friend
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {isSupabaseConfigured() && !authUser && authDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-dialog-title"
                onClick={() => {
                  setAuthNotice(null);
                  if (!authBusy) setAuthDialogOpen(false);
                }}
        >
          <div className="panel w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div id="auth-dialog-title" className="text-sm font-semibold text-slate-100">
                  Sign In / Create Account
                </div>
                <div className="text-xs text-slate-400">Sync chips, settings, streak, and borrow usage.</div>
              </div>
              <button
                type="button"
                onClick={() => setAuthDialogOpen(false)}
                disabled={authBusy}
                className="btn-press rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Close sign in dialog"
              >
                Close
              </button>
            </div>

            <div className="space-y-2">
              {authNotice && (
                <div
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    authNotice.kind === "error"
                      ? "border-rose-300/25 bg-rose-400/10 text-rose-100"
                      : authNotice.kind === "success"
                        ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                        : "border-cyan-300/25 bg-cyan-400/10 text-cyan-100"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {authNotice.message}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-cyan-300"
                  aria-label="Email for sign in"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Password (6+ chars)"
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-cyan-300"
                  aria-label="Password"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleEmailPasswordSignIn}
                  disabled={authBusy || !authEmail.trim() || !authPassword}
                  className="btn-press rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authBusy ? "Working…" : "Sign In"}
                </button>
                <button
                  type="button"
                  onClick={handleCreateAccount}
                  disabled={authBusy || !authEmail.trim() || !authPassword}
                  className="btn-press rounded-lg border border-lime-300/25 bg-lime-400/10 px-3 py-2 text-xs font-semibold text-lime-100 hover:bg-lime-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authBusy ? "Working…" : "Create Account"}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleSendMagicLink}
                  disabled={authBusy || !authEmail.trim()}
                  className="btn-press rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authBusy ? "Working…" : "Send Magic Link Instead"}
                </button>
              </div>
              <div className="text-[11px] text-slate-400">
                Email/password or magic link both work. Click outside the dialog to close it.
              </div>
            </div>
          </div>
        </div>
      )}

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
          zenMode={zenMode}
          showFirstMoveHint={history.length === 0}
          onChoose={handleChoose}
        />

        <div className="space-y-4">
          <BetControls balance={balance} bet={bet} onSetBet={handleSetBet} onAddBet={handleAddBet} />

          <section className="panel p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Mini Goal (Optional)</div>
              <div className="text-xs text-slate-400">{activeSessionGoalProgress}/{activeSessionGoal.target}</div>
            </div>
            <div className="text-sm font-semibold text-slate-100">{activeSessionGoal.label}</div>
            <div className="mt-1 text-xs text-slate-400">A small focus target for a quick mental break.</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full border border-white/10 bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300/70 to-lime-300/70 transition-[width]"
                style={{ width: `${activeSessionGoalPct}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-400">Target: {activeSessionGoal.targetLabel}</div>
          </section>

          <section className="panel p-4">
            <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-400">Quick Guide</div>
            <ul className="space-y-1 text-sm text-slate-300">
              <li>Arrow Up / H = HIGH</li>
              <li>Arrow Down / L = LOW</li>
              <li>Aces are low (A=1)</li>
              <li>Ties are Push (bet returned)</li>
              <li>Win = +bet profit, Loss = -bet</li>
            </ul>
          </section>

          {needsRecovery && (
            <section className="panel border border-amber-300/20 bg-amber-400/10 p-4">
              <div className="text-sm font-semibold text-amber-100">Out of chips</div>
              <p className="mt-1 text-xs text-amber-100/90">
                You need at least {MIN_BET} chips to play.{" "}
                {canBorrow ? "You can take a one-time 5,000 chip borrow." : "Your one-time borrow has been used."}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleBorrowChips}
                  disabled={!canBorrow}
                  className={`btn-press rounded-xl border px-3 py-2 text-sm font-semibold ${
                    canBorrow
                      ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15"
                      : "cursor-not-allowed border-white/10 bg-white/5 text-slate-500"
                  }`}
                >
                  Borrow 5,000
                </button>
                <button
                  type="button"
                  onClick={handleResetGameTable}
                  className="btn-press rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
                >
                  New Game
                </button>
              </div>
            </section>
          )}

          {debugOpen && (
            <section className="panel p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Debug Panel</div>
                <button
                  type="button"
                  onClick={handleResetGameTable}
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
        fairDeckCount={fairDeckCount}
        soundEnabled={soundEnabled}
        zenMode={zenMode}
        reducedMotion={reducedMotionManual}
        onClose={() => setSettingsOpen(false)}
        onModeChange={handleModeChange}
        onFairDeckCountChange={handleFairDeckCountChange}
        onSoundChange={setSoundEnabled}
        onZenModeChange={setZenMode}
        onReducedMotionChange={setReducedMotionManual}
      />
    </main>
  );
}

