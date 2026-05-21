"use client";

import { useEffect } from "react";

import {
  detectLatinInputMode,
  isLatinInputGuardDisabled,
  sanitizeLatinInput,
} from "@/lib/latin-input";

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
      const sanitizedPaste = sanitizeLatinInput(paste, mode);
      target.setRangeText(sanitizedPaste, start, end, "end");
      const pos = Math.min(start + sanitizedPaste.length, target.value.length);
      target.setSelectionRange(pos, pos);
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
    };

    document.addEventListener("beforeinput", onBeforeInput, true);
    document.addEventListener("paste", onPaste, true);

    return () => {
      document.removeEventListener("beforeinput", onBeforeInput, true);
      document.removeEventListener("paste", onPaste, true);
    };
  }, []);

  return null;
}
