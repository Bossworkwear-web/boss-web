const VOLUME_KEY = "boss_storefront_chat_admin_sound_volume";
const ENABLED_KEY = "boss_storefront_chat_admin_sound_enabled";

const DEFAULT_VOLUME = 0.7;
const DEFAULT_ENABLED = true;

export function isStorefrontChatSoundEnabled(): boolean {
  if (typeof window === "undefined") {
    return DEFAULT_ENABLED;
  }
  try {
    const raw = localStorage.getItem(ENABLED_KEY);
    if (raw === null) {
      return DEFAULT_ENABLED;
    }
    return raw === "1" || raw === "true";
  } catch {
    return DEFAULT_ENABLED;
  }
}

export function setStorefrontChatSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** 0–1 linear gain */
export function getStorefrontChatSoundVolume(): number {
  if (typeof window === "undefined") {
    return DEFAULT_VOLUME;
  }
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw === null) {
      return DEFAULT_VOLUME;
    }
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) {
      return DEFAULT_VOLUME;
    }
    return Math.min(1, Math.max(0, n));
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function setStorefrontChatSoundVolume(linear: number): void {
  try {
    const clamped = Math.min(1, Math.max(0, linear));
    localStorage.setItem(VOLUME_KEY, String(clamped));
  } catch {
    /* ignore */
  }
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) {
    return null;
  }
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new Ctx();
  }
  return audioContext;
}

/** Soft two-tone “띵~” chime for new customer chat messages. */
export function playStorefrontChatGuestDing(volume = getStorefrontChatSoundVolume()): void {
  if (!isStorefrontChatSoundEnabled() || volume <= 0) {
    return;
  }
  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  const run = () => {
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = volume * 0.45;
    master.connect(ctx.destination);

    const playTone = (freq: number, start: number, duration: number, peak: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0 + start);
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0 + start);
      osc.stop(t0 + start + duration + 0.02);
    };

    playTone(880, 0, 0.22, 1);
    playTone(1174.66, 0.1, 0.35, 0.85);
  };

  if (ctx.state === "suspended") {
    void ctx.resume().then(run).catch(() => {});
    return;
  }
  run();
}
