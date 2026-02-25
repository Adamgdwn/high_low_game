import type { ZenMusicTrack } from "@/lib/types";

type SoundKind = "click" | "flip" | "win" | "loss" | "push";

const ZEN_TRACK_FILES: Record<ZenMusicTrack, string> = {
  calm: "/audio/zen/calm.mp3",
  focus: "/audio/zen/focus.mp3",
  night: "/audio/zen/night.mp3"
};

let audioContext: AudioContext | null = null;

// Synth fallback state (used when no licensed loop files are bundled yet).
let zenMusicTimer: number | null = null;
let zenMusicPulses: number[] = [];

// File playback state (preferred when track files exist).
let zenAudioA: HTMLAudioElement | null = null;
let zenAudioB: HTMLAudioElement | null = null;
let zenActiveSlot: "a" | "b" | null = null;
let zenFadeTimer: number | null = null;
let zenRequestId = 0;
let zenFilePlaybackEnabled = false;

let zenMusicState: { enabled: boolean; track: ZenMusicTrack; volume: number } = {
  enabled: false,
  track: "calm",
  volume: 35
};

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
  if (typeof window === "undefined") return;
  if (zenMusicTimer) {
    window.clearInterval(zenMusicTimer);
    zenMusicTimer = null;
  }
  zenMusicPulses.forEach((id) => window.clearTimeout(id));
  zenMusicPulses = [];
}

function clearZenFadeTimer() {
  if (typeof window === "undefined") return;
  if (zenFadeTimer) {
    window.clearInterval(zenFadeTimer);
    zenFadeTimer = null;
  }
}

function schedulePulse(fn: () => void, delayMs: number) {
  if (typeof window === "undefined") return;
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

function startZenSynthFallback(track: ZenMusicTrack, volume: number) {
  clearZenMusicTimers();
  const spacing = track === "focus" ? 1500 : track === "night" ? 2300 : 2000;
  playZenMotif(track, volume);
  if (typeof window !== "undefined") {
    zenMusicTimer = window.setInterval(() => {
      zenMusicPulses = [];
      playZenMotif(track, volume);
    }, spacing);
  }
}

function stopZenFilePlayback() {
  clearZenFadeTimer();
  zenFilePlaybackEnabled = false;
  [zenAudioA, zenAudioB].forEach((player) => {
    if (!player) return;
    try {
      player.pause();
      player.currentTime = 0;
      player.volume = 0;
    } catch {
      // ignore
    }
  });
}

function ensureZenPlayers() {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (!zenAudioA) {
    zenAudioA = new Audio();
    zenAudioA.loop = true;
    zenAudioA.preload = "auto";
  }
  if (!zenAudioB) {
    zenAudioB = new Audio();
    zenAudioB.loop = true;
    zenAudioB.preload = "auto";
  }
  return { a: zenAudioA, b: zenAudioB };
}

function getTargetZenVolume(volume: number) {
  // Keep ambient loops soft by design.
  return Math.max(0, Math.min(0.45, volume / 220));
}

function fadeBetweenPlayers(
  fromPlayer: HTMLAudioElement | null,
  toPlayer: HTMLAudioElement,
  targetVolume: number,
  durationMs = 900
) {
  if (typeof window === "undefined") return;
  clearZenFadeTimer();
  const steps = 18;
  let step = 0;
  const fromStart = fromPlayer?.volume ?? 0;
  toPlayer.volume = 0;

  zenFadeTimer = window.setInterval(() => {
    step += 1;
    const t = Math.min(1, step / steps);
    const eased = t * t * (3 - 2 * t);
    if (fromPlayer) fromPlayer.volume = Math.max(0, fromStart * (1 - eased));
    toPlayer.volume = targetVolume * eased;

    if (t >= 1) {
      clearZenFadeTimer();
      if (fromPlayer) {
        try {
          fromPlayer.pause();
          fromPlayer.currentTime = 0;
        } catch {
          // ignore
        }
      }
      toPlayer.volume = targetVolume;
    }
  }, Math.max(16, Math.floor(durationMs / steps)));
}

async function startZenFileTrack(track: ZenMusicTrack, volume: number, requestId: number) {
  const players = ensureZenPlayers();
  if (!players) return false;

  const nextSlot: "a" | "b" = zenActiveSlot === "a" ? "b" : "a";
  const nextPlayer = nextSlot === "a" ? players.a : players.b;
  const currentPlayer =
    zenActiveSlot === "a" ? players.a : zenActiveSlot === "b" ? players.b : null;
  const src = ZEN_TRACK_FILES[track];

  try {
    if (nextPlayer.src !== src) {
      nextPlayer.src = src;
      nextPlayer.load();
    } else {
      nextPlayer.currentTime = 0;
    }

    nextPlayer.loop = true;
    nextPlayer.volume = 0;
    await nextPlayer.play();

    if (requestId !== zenRequestId || !zenMusicState.enabled) {
      nextPlayer.pause();
      return false;
    }

    clearZenMusicTimers(); // stop synth fallback if it was running
    zenFilePlaybackEnabled = true;
    fadeBetweenPlayers(currentPlayer, nextPlayer, getTargetZenVolume(volume));
    zenActiveSlot = nextSlot;
    return true;
  } catch {
    try {
      nextPlayer.pause();
    } catch {
      // ignore
    }
    return false;
  }
}

function updateZenFileVolume(volume: number) {
  if (!zenFilePlaybackEnabled) return;
  const target = getTargetZenVolume(volume);
  const active = zenActiveSlot === "a" ? zenAudioA : zenActiveSlot === "b" ? zenAudioB : null;
  if (active) active.volume = target;
}

export function setZenMusic(options: { enabled: boolean; track: ZenMusicTrack; volume: number }) {
  zenMusicState = {
    enabled: options.enabled,
    track: options.track,
    volume: Math.max(0, Math.min(100, Math.floor(options.volume)))
  };
  zenRequestId += 1;
  const requestId = zenRequestId;

  if (!zenMusicState.enabled || zenMusicState.volume <= 0) {
    clearZenMusicTimers();
    stopZenFilePlayback();
    return;
  }

  if (zenFilePlaybackEnabled) {
    void startZenFileTrack(zenMusicState.track, zenMusicState.volume, requestId).then((ok) => {
      if (!ok && requestId === zenRequestId) {
        stopZenFilePlayback();
        startZenSynthFallback(zenMusicState.track, zenMusicState.volume);
      }
    });
    updateZenFileVolume(zenMusicState.volume);
    return;
  }

  try {
    void startZenFileTrack(zenMusicState.track, zenMusicState.volume, requestId).then((ok) => {
      if (!ok && requestId === zenRequestId) {
        startZenSynthFallback(zenMusicState.track, zenMusicState.volume);
      }
    });
  } catch {
    startZenSynthFallback(zenMusicState.track, zenMusicState.volume);
  }
}

export function playSound(kind: SoundKind, enabled: boolean) {
  if (!enabled) return;
  try {
    if (kind === "click") {
      tone(820, 45, "triangle", 0.02);
      window.setTimeout(() => tone(1040, 55, "square", 0.018), 18);
    }
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

