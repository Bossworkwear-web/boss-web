type Props = {
  currentPage: number;
  totalPages: number;
};

/** Compact page counter shown below category browse pagination controls. */
export function CategoryPaginationPageSummary({ currentPage, totalPages }: Props) {
  return (
    <div
      className="inline-flex max-w-full items-center gap-3 rounded-full px-5 py-2"
      aria-live="polite"
    >
      <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-brand-navy/45">
        Page
      </span>
      <span className="h-4 w-px shrink-0 bg-brand-navy/12" aria-hidden />
      <span className="flex items-baseline gap-2 tabular-nums">
        <span className="text-[1.0625rem] font-semibold leading-none text-brand-navy">{currentPage}</span>
        <span className="pb-px text-[0.8125rem] font-light text-brand-navy/38">of</span>
        <span className="text-[1.0625rem] font-semibold leading-none text-brand-navy/72">{totalPages}</span>
      </span>
    </div>
  );
}
