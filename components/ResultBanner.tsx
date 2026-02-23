import type { RoundRecord } from "@/lib/types";
import { cn, formatChips } from "@/lib/utils";

export function ResultBanner({ lastRound }: { lastRound: RoundRecord | null }) {
  if (!lastRound) {
    return <div className="panel px-4 py-3 text-sm text-slate-300">Place a bet and choose HIGH or LOW.</div>;
  }

  return (
    <div
      className={cn(
        "panel border px-4 py-3 text-sm",
        lastRound.outcome === "win" && "pulse-win border-emerald-300/20",
        lastRound.outcome === "loss" && "pulse-loss border-rose-300/20",
        lastRound.outcome === "push" && "border-amber-300/20"
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">
          {lastRound.outcome === "win" ? "Win" : lastRound.outcome === "loss" ? "Loss" : "Push"}
        </span>
        <span
          className={cn(
            "font-semibold",
            lastRound.profit > 0 && "text-emerald-200",
            lastRound.profit < 0 && "text-rose-200",
            lastRound.profit === 0 && "text-amber-200"
          )}
        >
          {lastRound.profit > 0 ? "+" : ""}
          {formatChips(lastRound.profit)} chips
          {lastRound.bonus ? ` (bonus +${formatChips(lastRound.bonus)})` : ""}
        </span>
      </div>
      <div className="mt-1 text-xs text-slate-400">
        {lastRound.choice.toUpperCase()} on {lastRound.current.rank} {"->"} {lastRound.next.rank}
      </div>
    </div>
  );
}
