"use client";

import { useRef, type ChangeEvent, type KeyboardEvent } from "react";

type ImeFriendlyNameInputProps = {
  id: string;
  name: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
  autoComplete?: string;
};

type ImeFriendlyProductSpecInputProps = {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
};

function insertAtCursorInControlledInput(
  el: HTMLInputElement,
  currentValue: string,
  text: string,
  onChange: (value: string) => void,
) {
  const start = el.selectionStart ?? currentValue.length;
  const end = el.selectionEnd ?? currentValue.length;
  const next = currentValue.slice(0, start) + text + currentValue.slice(end);
  onChange(next);
  const pos = start + text.length;
  requestAnimationFrame(() => {
    el.setSelectionRange(pos, pos);
  });
}

function deleteAtCursorInControlledInput(
  el: HTMLInputElement,
  currentValue: string,
  direction: "backward" | "forward",
  onChange: (value: string) => void,
) {
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;

  let next = currentValue;
  let pos = start;

  if (start !== end) {
    next = currentValue.slice(0, start) + currentValue.slice(end);
    pos = start;
  } else if (direction === "backward" && start > 0) {
    next = currentValue.slice(0, start - 1) + currentValue.slice(start);
    pos = start - 1;
  } else if (direction === "forward" && start < currentValue.length) {
    next = currentValue.slice(0, start) + currentValue.slice(start + 1);
    pos = start;
  } else {
    return;
  }

  onChange(next);
  requestAnimationFrame(() => {
    el.setSelectionRange(pos, pos);
  });
}

/** Name field — Latin letters work when Korean IME is active (same pattern as instore Size input). */
export function ImeFriendlyNameInput({
  id,
  name,
  required,
  className,
  placeholder,
  autoComplete = "name",
}: ImeFriendlyNameInputProps) {
  const composingRef = useRef(false);

  function insertAtCursor(el: HTMLInputElement, text: string) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + text + el.value.slice(end);
    el.value = next;
    const pos = start + text.length;
    requestAnimationFrame(() => {
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <input
      id={id}
      name={name}
      type="text"
      required={required}
      placeholder={placeholder}
      lang="en"
      inputMode="text"
      autoComplete={autoComplete}
      autoCapitalize="words"
      spellCheck={false}
      className={className}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={() => {
        composingRef.current = false;
      }}
      onKeyDown={(e) => {
        if (composingRef.current || e.nativeEvent.isComposing) {
          return;
        }
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) {
          return;
        }
        if (!/[a-zA-Z \-'.]/.test(e.key)) {
          return;
        }
        e.preventDefault();
        insertAtCursor(e.currentTarget, e.key);
      }}
    />
  );
}

/** Product name, slug, or UUID — letters and digits work when Korean IME is active. */
export function ImeFriendlyProductSpecInput({
  id,
  name,
  value,
  onChange,
  className,
  placeholder,
}: ImeFriendlyProductSpecInputProps) {
  const composingRef = useRef(false);
  const valueRef = useRef(value);

  valueRef.current = value;

  function resolveAsciiKey(e: KeyboardEvent<HTMLInputElement>): string | null {
    if (e.key.length === 1 && /[a-zA-Z0-9 \-'_]/.test(e.key)) {
      return e.key;
    }

    const { code } = e;
    if (/^Key[A-Z]$/.test(code)) {
      const letter = code.slice(3);
      return e.shiftKey ? letter : letter.toLowerCase();
    }
    if (/^Digit[0-9]$/.test(code)) {
      return code.slice(5);
    }
    if (/^Numpad[0-9]$/.test(code)) {
      return code.slice(6);
    }
    if (code === "Minus") {
      return e.shiftKey ? "_" : "-";
    }
    if (code === "NumpadSubtract") {
      return "-";
    }
    if (code === "Space") {
      return " ";
    }

    return null;
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      e.stopPropagation();
      deleteAtCursorInControlledInput(
        e.currentTarget,
        valueRef.current,
        e.key === "Backspace" ? "backward" : "forward",
        onChange,
      );
      return;
    }

    const char = resolveAsciiKey(e);
    if (!char) {
      return;
    }

    // Always insert ASCII directly so Korean IME cannot swallow Latin letters or digits.
    e.preventDefault();
    e.stopPropagation();
    insertAtCursorInControlledInput(e.currentTarget, valueRef.current, char, onChange);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (composingRef.current) {
      return;
    }
    onChange(e.target.value);
  }

  return (
    <input
      id={id}
      name={name}
      type="text"
      value={value}
      placeholder={placeholder}
      lang="en"
      inputMode="text"
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
      className={className}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(e) => {
        composingRef.current = false;
        onChange(e.currentTarget.value);
      }}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
    />
  );
}
