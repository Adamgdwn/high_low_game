import type { GameMode, ZenMusicTrack } from "@/lib/types";

interface SettingsModalProps {
  open: boolean;
  mode: GameMode;
  fairDeckCount: 1 | 2 | 3;
  soundEnabled: boolean;
  zenMode: boolean;
  zenMusicEnabled: boolean;
  zenMusicTrack: ZenMusicTrack;
  zenMusicVolume: number;
  reducedMotion: boolean;
  onClose: () => void;
  onModeChange: (mode: GameMode) => void;
  onFairDeckCountChange: (count: 1 | 2 | 3) => void;
  onSoundChange: (value: boolean) => void;
  onZenModeChange: (value: boolean) => void;
  onZenMusicEnabledChange: (value: boolean) => void;
  onZenMusicTrackChange: (value: ZenMusicTrack) => void;
  onZenMusicVolumeChange: (value: number) => void;
  onReducedMotionChange: (value: boolean) => void;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <span className="text-sm text-slate-200">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`btn-press relative h-7 w-12 rounded-full border ${checked ? "border-cyan-300/30 bg-cyan-400/20" : "border-white/10 bg-white/10"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? "left-6" : "left-1"}`} />
      </button>
    </label>
  );
}

export function SettingsModal({
  open,
  mode,
  fairDeckCount,
  soundEnabled,
  zenMode,
  zenMusicEnabled,
  zenMusicTrack,
  zenMusicVolume,
  reducedMotion,
  onClose,
  onModeChange,
  onFairDeckCountChange,
  onSoundChange,
  onZenModeChange,
  onZenMusicEnabledChange,
  onZenMusicTrackChange,
  onZenMusicVolumeChange,
  onReducedMotionChange
}: SettingsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={onClose}>
      <div className="panel neon-ring w-full max-w-xl p-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 id="settings-title" className="text-lg font-bold text-slate-50">Settings</h2>
          <button type="button" onClick={onClose} className="btn-press rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm hover:bg-white/10" aria-label="Close settings">
            Close
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <label className="mb-2 block text-sm font-semibold text-slate-100" htmlFor="mode">Game Mode</label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => onModeChange(e.target.value as GameMode)}
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
            >
              <option value="fair">Fair</option>
              <option value="alwaysWin">Demo: Always Win</option>
              <option value="alwaysLose">Chaos: Always Lose</option>
            </select>
            <p className="mt-2 text-xs text-slate-400">Rigged modes are clearly labeled demos and are not fair gameplay.</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 text-sm font-semibold text-slate-100">Fair Mode Decks</div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => onFairDeckCountChange(count as 1 | 2 | 3)}
                  className={`btn-press rounded-xl border px-3 py-2 text-sm font-semibold ${
                    fairDeckCount === count
                      ? "border-cyan-300/35 bg-cyan-400/12 text-cyan-100"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                  aria-label={`Use ${count} deck${count > 1 ? "s" : ""} in fair mode`}
                >
                  {count} Deck{count > 1 ? "s" : ""}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">Random Fair mode uses a shoe of 1, 2, or 3 decks.</p>
          </div>

          <Toggle label="Sound" checked={soundEnabled} onChange={onSoundChange} />
          <Toggle label="Zen mode" checked={zenMode} onChange={onZenModeChange} />
          <Toggle label="Zen music" checked={zenMusicEnabled} onChange={onZenMusicEnabledChange} />
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <label className="mb-2 block text-sm font-semibold text-slate-100" htmlFor="zen-track">Zen Track</label>
            <select
              id="zen-track"
              value={zenMusicTrack}
              onChange={(e) => onZenMusicTrackChange(e.target.value as ZenMusicTrack)}
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-300"
            >
              <option value="calm">Calm Drift</option>
              <option value="focus">Focus Bloom</option>
              <option value="night">Night Float</option>
            </select>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                <span>Zen Music Volume</span>
                <span>{zenMusicVolume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={zenMusicVolume}
                onChange={(e) => onZenMusicVolumeChange(Number(e.target.value))}
                aria-label="Zen music volume"
                className="w-full accent-cyan-300"
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">Uses bundled zen loop files when available, otherwise falls back to placeholder synth ambience.</p>
          </div>
          <Toggle label="Reduced motion" checked={reducedMotion} onChange={onReducedMotionChange} />

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
            Zen mode softens the experience by muting game sounds, reducing motion, and toning down visual intensity.
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-slate-300">
            <div className="mb-2 font-semibold text-slate-100">Rules</div>
            <p>Pick HIGH if the next rank is higher, LOW if lower. Ties are a <span className="font-semibold text-amber-200">Push</span> (bet returned, streak unchanged).</p>
            <p className="mt-2">Win = +bet profit. Loss = -bet. Every 3 wins adds +10% of bet (capped).</p>
          </div>

          <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">
            Chips have no cash value. No cash out. No prizes. Social casino demo only.
          </div>
        </div>
      </div>
    </div>
  );
}
