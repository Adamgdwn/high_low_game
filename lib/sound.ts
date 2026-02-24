import type { ZenMusicTrack } from "@/lib/types";

type SoundKind = "click" | "flip" | "win" | "loss" | "push";

let zenMusicTimer: number | null = null;
let zenMusicPulses: number[] = [];
let zenMusicState: { enabled: boolean; track: ZenMusicTrack; volume: number } = {
  enabled: false,
  track: "calm",
  volume: 35
};

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

function clearZenMusicTimers() {
  if (zenMusicTimer) {
    window.clearInterval(zenMusicTimer);
    zenMusicTimer = null;
  }
  zenMusicPulses.forEach((id) => window.clearTimeout(id));
  zenMusicPulses = [];
}

function schedulePulse(fn: () => void, delayMs: number) {
  const id = window.setTimeout(fn, delayMs);
  zenMusicPulses.push(id);
}

function playZenMotif(track: ZenMusicTrack, volumePct: number) {
  const level = Math.max(0.004, Math.min(0.03, volumePct / 1000));
  if (track === "calm") {
    tone(220, 420, "sine", level);
    schedulePulse(() => tone(329.63, 320, "triangle", level * 0.8), 220);
    schedulePulse(() => tone(261.63, 380, "sine", level * 0.7), 620);
  }
  if (track === "focus") {
    tone(196, 240, "triangle", level * 0.85);
    schedulePulse(() => tone(293.66, 180, "triangle", level * 0.8), 180);
    schedulePulse(() => tone(392, 260, "sine", level * 0.65), 540);
    schedulePulse(() => tone(293.66, 160, "sine", level * 0.55), 880);
  }
  if (track === "night") {
    tone(174.61, 520, "sine", level * 0.9);
    schedulePulse(() => tone(207.65, 420, "sine", level * 0.65), 360);
    schedulePulse(() => tone(155.56, 640, "triangle", level * 0.55), 900);
  }
}

export function setZenMusic(options: { enabled: boolean; track: ZenMusicTrack; volume: number }) {
  zenMusicState = {
    enabled: options.enabled,
    track: options.track,
    volume: Math.max(0, Math.min(100, Math.floor(options.volume)))
  };
  clearZenMusicTimers();
  if (!zenMusicState.enabled || zenMusicState.volume <= 0) return;

  const spacing = zenMusicState.track === "focus" ? 1500 : zenMusicState.track === "night" ? 2300 : 2000;
  try {
    playZenMotif(zenMusicState.track, zenMusicState.volume);
    zenMusicTimer = window.setInterval(() => {
      zenMusicPulses = [];
      playZenMotif(zenMusicState.track, zenMusicState.volume);
    }, spacing);
  } catch {
    // Never crash on unsupported audio.
  }
}

export function playSound(kind: SoundKind, enabled: boolean) {
  if (!enabled) return;
  try {
    // Placeholder chip clank (betting).
    if (kind === "click") {
      tone(820, 45, "triangle", 0.02);
      window.setTimeout(() => tone(1040, 55, "square", 0.018), 18);
    }
    // Placeholder card flip/reveal.
    if (kind === "flip") {
      tone(240, 55, "triangle", 0.02);
      window.setTimeout(() => tone(180, 75, "sine", 0.02), 38);
      window.setTimeout(() => tone(300, 55, "triangle", 0.018), 88);
    }
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
