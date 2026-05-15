"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getStorefrontChatSoundVolume,
  isStorefrontChatSoundEnabled,
  playStorefrontChatGuestDing,
  setStorefrontChatSoundEnabled,
  setStorefrontChatSoundVolume,
} from "@/lib/storefront-chat-admin-sound";

export function StorefrontChatSoundSettings() {
  const [enabled, setEnabled] = useState(true);
  const [volumePercent, setVolumePercent] = useState(70);

  useEffect(() => {
    setEnabled(isStorefrontChatSoundEnabled());
    setVolumePercent(Math.round(getStorefrontChatSoundVolume() * 100));
  }, []);

  const persistVolume = useCallback((percent: number) => {
    const clamped = Math.min(100, Math.max(0, percent));
    setVolumePercent(clamped);
    setStorefrontChatSoundVolume(clamped / 100);
  }, []);

  const toggleEnabled = useCallback((next: boolean) => {
    setEnabled(next);
    setStorefrontChatSoundEnabled(next);
  }, []);

  const testSound = useCallback(() => {
    playStorefrontChatGuestDing(volumePercent / 100);
  }, [volumePercent]);

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white px-4 py-4"
      aria-labelledby="storefront-chat-sound-title"
    >
      <h2 id="storefront-chat-sound-title" className="text-sm font-semibold text-slate-900">
        Sound notifications
      </h2>
      <p className="mt-1 text-xs text-slate-600">
        Play a chime when a customer sends a new message in the chat widget. Settings are saved in this browser.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => toggleEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-orange focus:ring-brand-orange"
          />
          Enable sound
        </label>

        <div className="flex min-w-[12rem] flex-1 items-center gap-3 sm:max-w-xs">
          <span className="shrink-0 text-xs font-medium text-slate-600">Volume</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={volumePercent}
            disabled={!enabled}
            onChange={(e) => persistVolume(Number(e.target.value))}
            className="h-2 flex-1 cursor-pointer accent-brand-orange disabled:opacity-40"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={volumePercent}
            aria-label="Notification volume"
          />
          <span className="w-9 shrink-0 text-right text-xs tabular-nums text-slate-600">{volumePercent}%</span>
        </div>

        <button
          type="button"
          onClick={testSound}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-100"
        >
          Test sound
        </button>
      </div>
    </section>
  );
}
