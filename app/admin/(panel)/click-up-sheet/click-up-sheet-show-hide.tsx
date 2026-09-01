"use client";

import { useState, type ReactNode } from "react";

const TOGGLE_BTN_CLASS =
  "click-up-sheet-print-hide inline-flex shrink-0 items-center rounded border border-slate-300 bg-white px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50";

type HeadingProps = {
  title: ReactNode;
  open: boolean;
  onToggle: () => void;
  headingClassName?: string;
};

/** Show/Hide control placed in front of a Click Up sheet section title. */
export function ClickUpSheetShowHideHeading({
  title,
  open,
  onToggle,
  headingClassName = "text-sm font-semibold uppercase tracking-wide text-slate-500",
}: HeadingProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={TOGGLE_BTN_CLASS}
        aria-expanded={open}
        onClick={onToggle}
      >
        {open ? "Hide" : "Show"}
      </button>
      <h2 className={headingClassName}>{title}</h2>
    </div>
  );
}

type BodyProps = {
  open: boolean;
  children: ReactNode;
};

/** Keeps body collapsed on screen and in print when hidden. */
export function ClickUpSheetShowHideBody({ open, children }: BodyProps) {
  return <div className={open ? undefined : "hidden"}>{children}</div>;
}

export function useClickUpSheetShowHide(defaultOpen = false) {
  const [open, setOpen] = useState(defaultOpen);
  return {
    open,
    toggle: () => setOpen((v) => !v),
  };
}
