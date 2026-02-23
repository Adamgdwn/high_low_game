type SoundKind = "click" | "flip" | "win" | "loss" | "push";

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioContext) audioContext = new AC();
  return audioContext;
}

function tone(freq: number, durationMs: number, type: OscillatorType, volume = 0.03) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

export function playSound(kind: SoundKind, enabled: boolean) {
  if (!enabled) return;
  try {
    if (kind === "click") tone(320, 70, "square");
    if (kind === "flip") tone(190, 120, "triangle");
    if (kind === "win") {
      tone(440, 120, "sine", 0.04);
      window.setTimeout(() => tone(660, 160, "sine", 0.04), 70);
    }
    if (kind === "loss") tone(180, 220, "sawtooth", 0.028);
    if (kind === "push") {
      tone(270, 90, "triangle", 0.03);
      window.setTimeout(() => tone(270, 90, "triangle", 0.02), 60);
    }
  } catch {
    // Never crash on unsupported audio.
  }
}
