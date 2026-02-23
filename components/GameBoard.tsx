import { ResultBanner } from "@/components/ResultBanner";
import type { Card, GameMode, GamePhase, PlayerChoice, RoundRecord } from "@/lib/types";
import { modeLabel } from "@/lib/game-engine";
import { cn, formatChips, rankLabel } from "@/lib/utils";

interface GameBoardProps {
  balance: number;
  currentCard: Card | null;
  revealCard: Card | null;
  bet: number;
  streak: number;
  phase: GamePhase;
  lastRound: RoundRecord | null;
  lastResultText: string;
  mode: GameMode;
  canPlay: boolean;
  canChooseHigh: boolean;
  canChooseLow: boolean;
  isRevealing: boolean;
  reducedMotion: boolean;
  onChoose: (choice: PlayerChoice) => void;
}

function CardFace({ card, hidden, accent }: { card: Card | null; hidden?: boolean; accent?: "win" | "loss" }) {
  const isRed = card?.suit === "♥" || card?.suit === "♦";
  return (
    <div
      className={cn(
        "relative grid h-48 w-full place-items-center rounded-2xl border bg-gradient-to-b from-white/10 to-white/5 p-4 sm:h-56",
        hidden ? "border-cyan-300/20" : "border-white/15",
        accent === "win" && "shadow-neon",
        accent === "loss" && "shadow-pink"
      )}
    >
      {hidden ? (
        <div className="shine grid h-full w-full place-items-center rounded-xl border border-dashed border-cyan-200/20 bg-black/20">
          <span className="text-xs uppercase tracking-[0.35em] text-cyan-100/80">Reveal</span>
        </div>
      ) : card ? (
        <div className={cn("text-center", isRed ? "text-rose-200" : "text-slate-50")}>
          <div className="text-6xl font-black leading-none sm:text-7xl">{rankLabel(card.rank)}</div>
          <div className="mt-2 text-2xl">{card.suit}</div>
          <div className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-300/80">Rank {card.rank}</div>
        </div>
      ) : (
        <div className="text-sm text-slate-400">Loading…</div>
      )}
    </div>
  );
}

export function GameBoard({
  balance,
  currentCard,
  revealCard,
  bet,
  streak,
  phase,
  lastRound,
  lastResultText,
  mode,
  canPlay,
  canChooseHigh,
  canChooseLow,
  isRevealing,
  reducedMotion,
  onChoose
}: GameBoardProps) {
  return (
    <section className="space-y-4">
      <div className="panel neon-ring p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="chip-balance rounded-2xl px-4 py-3">
            <div className="text-xs uppercase tracking-[0.28em] text-amber-100/80">Chip Balance</div>
            <div className="mt-1 text-3xl font-black text-amber-100 sm:text-4xl">{formatChips(balance)}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
              {modeLabel(mode)}
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              Streak <span className="font-semibold text-lime-200">{streak}</span>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{lastResultText}</div>
            <div className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
              Aces are low (A = 1)
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.26em] text-slate-400">Current</div>
            <CardFace card={currentCard} />
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.26em] text-slate-400">Next</div>
            <div className={cn(isRevealing && !reducedMotion && "card-flip [transform-style:preserve-3d]")}>
              <CardFace
                card={phase === "revealing" || phase === "result" ? revealCard : null}
                hidden={phase !== "revealing" && phase !== "result"}
                accent={phase === "result" && lastRound?.outcome === "win" ? "win" : phase === "result" && lastRound?.outcome === "loss" ? "loss" : undefined}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            aria-label="Choose High"
            disabled={!canChooseHigh}
            onClick={() => onChoose("high")}
            className={cn(
              "btn-press rounded-2xl border px-4 py-5 text-xl font-black tracking-wide sm:text-2xl",
              canChooseHigh ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100 shadow-neon hover:bg-cyan-400/15" : "cursor-not-allowed border-white/10 bg-white/5 text-slate-500"
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <span>HIGH</span>
              {!canChooseHigh && <span aria-hidden="true" className="text-base leading-none">🔒</span>}
            </span>
            {!canChooseHigh && (
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Unavailable
              </span>
            )}
          </button>
          <button
            type="button"
            aria-label="Choose Low"
            disabled={!canChooseLow}
            onClick={() => onChoose("low")}
            className={cn(
              "btn-press rounded-2xl border px-4 py-5 text-xl font-black tracking-wide sm:text-2xl",
              canChooseLow ? "border-pink-300/30 bg-pink-400/10 text-pink-100 shadow-pink hover:bg-pink-400/15" : "cursor-not-allowed border-white/10 bg-white/5 text-slate-500"
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <span>LOW</span>
              {!canChooseLow && <span aria-hidden="true" className="text-base leading-none">🔒</span>}
            </span>
            {!canChooseLow && (
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Unavailable
              </span>
            )}
          </button>
        </div>

        {!canPlay && <div className="mt-3 text-xs text-slate-400">Place a valid bet to enable HIGH/LOW.</div>}
        {canPlay && currentCard?.rank === 1 && (
          <div className="mt-3 text-xs text-amber-200">Ace is low (A=1), so LOW is unavailable on this hand.</div>
        )}
        {canPlay && currentCard?.rank === 13 && (
          <div className="mt-3 text-xs text-amber-200">King is highest (K=13), so HIGH is unavailable on this hand.</div>
        )}
      </div>

      <ResultBanner lastRound={lastRound} />
    </section>
  );
}
