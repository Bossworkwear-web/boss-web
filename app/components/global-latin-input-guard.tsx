"use client";

import { useEffect } from "react";

import {
  detectLatinInputMode,
  isLatinInputGuardDisabled,
  sanitizeLatinInput,
} from "@/lib/latin-input";

function applyFilter(el: HTMLInputElement | HTMLTextAreaElement) {
  const mode = detectLatinInputMode(el);
  const next = sanitizeLatinInput(el.value, mode);
  if (next !== el.value) {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.value = next;
    if (start !== null && end !== null) {
      const pos = Math.min(start, next.length);
      el.setSelectionRange(pos, pos);
    }
  }
}

/** Blocks non-Latin scripts on all text inputs project-wide. */
export function GlobalLatinInputGuard() {
  useEffect(() => {
    const onBeforeInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        return;
      }
      if (isLatinInputGuardDisabled(target)) {
        return;
      }

      const inputEvent = event as InputEvent;
      if (!inputEvent.data || inputEvent.inputType.startsWith("delete")) {
        return;
      }

      const mode = detectLatinInputMode(target);
      if (sanitizeLatinInput(inputEvent.data, mode) !== inputEvent.data) {
        event.preventDefault();
      }
    };

    const onInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        return;
      }
      if (isLatinInputGuardDisabled(target)) {
        return;
      }
      applyFilter(target);
    };

    const onPaste = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        return;
      }
      if (isLatinInputGuardDisabled(target)) {
        return;
      }

      const paste = (event as ClipboardEvent).clipboardData?.getData("text") ?? "";
      if (!paste) {
        return;
      }

      event.preventDefault();
      const mode = detectLatinInputMode(target);
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      const merged = sanitizeLatinInput(target.value.slice(0, start) + paste + target.value.slice(end), mode);
      target.value = merged;
      const pos = Math.min(start + sanitizeLatinInput(paste, mode).length, merged.length);
      target.setSelectionRange(pos, pos);
      target.dispatchEvent(new Event("input", { bubbles: true }));
    };

    document.addEventListener("beforeinput", onBeforeInput, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("paste", onPaste, true);

    return () => {
      document.removeEventListener("beforeinput", onBeforeInput, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("paste", onPaste, true);
    };
  }, []);

  return null;
}
