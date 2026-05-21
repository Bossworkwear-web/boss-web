type LoadingRingSpinnerProps = {
  className?: string;
};

/** Orange ring spinner (matches Customer Details Saving overlay). */
export function LoadingRingSpinner({ className = "h-8 w-8" }: LoadingRingSpinnerProps) {
  return (
    <span
      className={`shrink-0 animate-spin rounded-full border-[3px] border-brand-navy/15 border-t-brand-orange ${className}`.trim()}
      aria-hidden
    />
  );
}
