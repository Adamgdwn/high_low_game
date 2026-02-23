import { BET_STEP, MIN_BET, QUICK_BETS } from "@/lib/constants";
import { cn, formatChips } from "@/lib/utils";

interface BetControlsProps {
  balance: number;
  bet: number;
  onSetBet: (value: number) => void;
  onAddBet: (delta: number) => void;
}

export function BetControls({ balance, bet, onSetBet, onAddBet }: BetControlsProps) {
  const maxBet = Math.max(0, balance);

  return (
    <section className="panel neon-ring p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Bet</h2>
        <div className="text-xs text-slate-400">Min {MIN_BET} / Max {formatChips(maxBet)}</div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {QUICK_BETS.map((quick) => (
          <button
            key={quick}
            type="button"
            aria-label={`Set bet to ${quick} chips`}
            onClick={() => onSetBet(Math.min(quick, maxBet))}
            className={cn(
              "btn-press rounded-xl border px-3 py-2 text-sm font-semibold",
              bet === quick ? "border-cyan-300/35 bg-cyan-400/12 text-cyan-100 shadow-neon" : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            )}
          >
            {quick}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease bet by ${BET_STEP}`}
          onClick={() => onAddBet(-BET_STEP)}
          className="btn-press rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-lg font-bold hover:bg-white/10"
        >
          -
        </button>

        <label className="flex min-h-11 items-center rounded-xl border border-white/10 bg-black/20 px-3">
          <span className="mr-2 text-xs uppercase tracking-[0.2em] text-slate-400">chips</span>
          <input
            aria-label="Bet amount"
            inputMode="numeric"
            value={bet}
            onChange={(e) => onSetBet(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
            className="w-full bg-transparent text-lg font-semibold text-slate-50 outline-none"
          />
        </label>

        <button
          type="button"
          aria-label={`Increase bet by ${BET_STEP}`}
          onClick={() => onAddBet(BET_STEP)}
          className="btn-press rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-lg font-bold hover:bg-white/10"
        >
          +
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-label="Bet maximum"
          onClick={() => onSetBet(maxBet)}
          className="btn-press rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-400/15"
        >
          MAX
        </button>
        <button
          type="button"
          aria-label="Clear bet"
          onClick={() => onSetBet(0)}
          className="btn-press rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
        >
          CLEAR
        </button>
      </div>
    </section>
  );
}
