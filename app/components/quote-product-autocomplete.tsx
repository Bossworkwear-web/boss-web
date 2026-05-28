"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import {
  findQuoteCatalogProductByStyleCode,
  resolveQuoteProductLink,
  searchQuoteCatalogProducts,
  type QuoteCatalogProduct,
} from "@/lib/quote-catalog-products";

type Props = {
  id: string;
  inputName: string;
  hiddenIdName: string;
  catalog: QuoteCatalogProduct[];
  productId: string | null;
  spec: string;
  onChange: (next: { productId: string | null; spec: string }) => void;
  placeholder?: string;
  className?: string;
};

function insertAtCursor(
  el: HTMLInputElement,
  currentValue: string,
  text: string,
  onValueChange: (value: string) => void,
) {
  const start = el.selectionStart ?? currentValue.length;
  const end = el.selectionEnd ?? currentValue.length;
  const next = currentValue.slice(0, start) + text + currentValue.slice(end);
  onValueChange(next);
  const pos = start + text.length;
  requestAnimationFrame(() => {
    el.setSelectionRange(pos, pos);
  });
}

function deleteAtCursor(
  el: HTMLInputElement,
  currentValue: string,
  direction: "backward" | "forward",
  onValueChange: (value: string) => void,
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

  onValueChange(next);
  requestAnimationFrame(() => {
    el.setSelectionRange(pos, pos);
  });
}

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

export function QuoteProductAutocomplete({
  id,
  inputName,
  hiddenIdName,
  catalog,
  productId,
  spec,
  onChange,
  placeholder,
  className = "",
}: Props) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const specRef = useRef(spec);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  specRef.current = spec;

  const suggestions = useMemo(() => searchQuoteCatalogProducts(catalog, spec), [catalog, spec]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function applySpecChange(nextSpec: string) {
    const trimmed = nextSpec.trim();
    const styleMatch = findQuoteCatalogProductByStyleCode(catalog, trimmed);
    if (styleMatch) {
      onChange({ productId: styleMatch.id, spec: styleMatch.displayName });
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    const linkedProductId = resolveQuoteProductLink(catalog, nextSpec, productId);
    onChange({ productId: linkedProductId, spec: nextSpec });
    setOpen(trimmed.length > 0);
    setActiveIndex(-1);
  }

  function selectProduct(product: QuoteCatalogProduct) {
    onChange({ productId: product.id, spec: product.displayName });
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleInputChange(nextSpec: string) {
    applySpecChange(nextSpec);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    if (e.key === "ArrowDown" && open && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
      return;
    }

    if (e.key === "ArrowUp" && open && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      return;
    }

    if (e.key === "Enter" && open && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault();
      selectProduct(suggestions[activeIndex]);
      return;
    }

    if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      e.stopPropagation();
      deleteAtCursor(
        e.currentTarget,
        specRef.current,
        e.key === "Backspace" ? "backward" : "forward",
        handleInputChange,
      );
      return;
    }

    const char = resolveAsciiKey(e);
    if (!char) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    insertAtCursor(e.currentTarget, specRef.current, char, handleInputChange);
    setOpen(true);
  }

  const showSuggestions = open && spec.trim().length > 0 && suggestions.length > 0;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <input type="hidden" name={hiddenIdName} value={productId ?? ""} />
      <input
        id={id}
        name={inputName}
        type="text"
        value={spec}
        placeholder={placeholder}
        lang="en"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className={className}
        onFocus={() => {
          if (spec.trim()) {
            setOpen(true);
          }
        }}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          handleInputChange(e.currentTarget.value);
        }}
        onChange={(e) => {
          if (composingRef.current) {
            return;
          }
          handleInputChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
      />

      {showSuggestions ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-brand-navy/20 bg-white py-1 shadow-lg"
        >
          {suggestions.map((product, index) => (
            <li key={product.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`block w-full px-3 py-2 text-left text-sm text-brand-navy hover:bg-brand-orange/10 ${
                  index === activeIndex ? "bg-brand-orange/10" : ""
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectProduct(product)}
              >
                <span className="font-medium">{product.displayName}</span>
                {product.styleCode ? (
                  <span className="mt-0.5 block text-xs font-semibold uppercase tracking-wide text-brand-orange">
                    Product ID: {product.styleCode}
                  </span>
                ) : null}
                {product.slug ? (
                  <span className="mt-0.5 block text-xs text-brand-navy/60">{product.slug}</span>
                ) : null}
                <span className="mt-0.5 block font-mono text-[11px] text-brand-navy/45">{product.id}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
