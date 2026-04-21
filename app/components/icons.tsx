export type IconProps = { className?: string; strokeWidth?: number };

const ICON_STROKE_WIDTH = 1.8;

export function ShirtIcon({ className = "h-4 w-4", strokeWidth = ICON_STROKE_WIDTH }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M8 6l4 2 4-2 3 3-2 3v8H7v-8L5 9l3-3Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BriefcaseIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="4" y="7" width="16" height="12" rx="2" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <path d="M4 12h16" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
    </svg>
  );
}

export function MedicalIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" />
    </svg>
  );
}

export function SparklesIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="m12 4 1.2 3.3L16.5 8.5l-3.3 1.2L12 13l-1.2-3.3L7.5 8.5l3.3-1.2L12 4Z" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <path d="m18 14 .7 1.9L20.6 16l-1.9.7L18 18.6l-.7-1.9-1.9-.7 1.9-.7L18 14Z" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
    </svg>
  );
}

export function ArrowRightIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 12h14" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" />
      <path d="m13 7 6 5-6 5" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowLeftIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M19 12H5" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" />
      <path d="m11 6-6 6 6 6" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClipboardIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="6" y="4" width="12" height="16" rx="2" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <path d="M9 4h6v3H9z" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
    </svg>
  );
}

export function ClipboardCheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="6" y="4" width="12" height="16" rx="2" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <path d="M9 4h6v3H9z" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <path d="m9.5 13.5 1.8 1.8 3.5-3.5" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BuildingIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 20V6l7-2 7 2v14H5Z" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <path d="M9 10h1M12 10h1M15 10h1M9 14h1M12 14h1M15 14h1" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" />
    </svg>
  );
}

export function ProductIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="m12 3 8 4-8 4-8-4 8-4Z" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <path d="M4 7v10l8 4 8-4V7" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
    </svg>
  );
}

export function NotesIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" />
    </svg>
  );
}

export function CheckCircleIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <path d="m8.5 12.5 2.2 2.2 4.8-4.8" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertTriangleIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 4.5 20 19H4l8-14.5Z"
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 10v4" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function XCircleIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <path d="m9 9 6 6M15 9l-6 6" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" />
    </svg>
  );
}

export function NeedleIcon({ className = "h-4 w-4", strokeWidth = ICON_STROKE_WIDTH }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M6 18l12-12" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M14 6h4v4" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="7" cy="17" r="2" stroke="currentColor" strokeWidth={strokeWidth} />
    </svg>
  );
}

export function PrinterIcon({ className = "h-4 w-4", strokeWidth = ICON_STROKE_WIDTH }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="7" y="3" width="10" height="5" rx="1" stroke="currentColor" strokeWidth={strokeWidth} />
      <rect x="5" y="9" width="14" height="8" rx="2" stroke="currentColor" strokeWidth={strokeWidth} />
      <rect x="8" y="14" width="8" height="7" rx="1" stroke="currentColor" strokeWidth={strokeWidth} />
    </svg>
  );
}

export function PlacementIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 21s6-4.9 6-10a6 6 0 1 0-12 0c0 5.1 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
      />
      <circle cx="12" cy="11" r="2.2" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
    </svg>
  );
}

export function UploadIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 16V8" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" />
      <path d="m9 11 3-3 3 3" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" />
      <path
        d="M6 18h12a3 3 0 0 0 0-6 5 5 0 0 0-9.6-1.6A3.5 3.5 0 0 0 6 18Z"
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CalculatorIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="6" y="3" width="12" height="18" rx="2" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <rect x="9" y="6" width="6" height="3" rx="0.8" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <path d="M9 12h1M12 12h1M15 12h1M9 15h1M12 15h1M15 15h1" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" />
    </svg>
  );
}

export function UserIcon({ className = "h-4 w-4" }: IconProps) {
  const headR = 3.25 * 1.3;
  const headCy = 8.65 + 3.25 - headR;
  const headBottom = headCy + headR;
  const neckGapBeforeMm = 13.55 - (8.65 + 3.25);
  const mmExtraInViewBox = ((96 / 25.4) * 1.5 * 24) / 24;
  const neckGap = (neckGapBeforeMm + mmExtraInViewBox) * 0.5;
  const shoulderY = headBottom + neckGap;
  const torsoEndDy = 20.5 - shoulderY;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy={headCy} r={headR} stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <path
        d={`M2.75 20.5C2.75 17.4 6.45 ${shoulderY} 12 ${shoulderY}s9.25 2.05 9.25 ${torsoEndDy}`}
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Cart uses a lighter stroke so large header sizes stay crisp. */
const CART_ICON_STROKE_WIDTH = 1.15;

export function CartIcon({ className = "h-4 w-4", strokeWidth = CART_ICON_STROKE_WIDTH }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <g transform="translate(12 12) scale(1.15 1) translate(-12 -12)">
        <circle
          cx="9"
          cy="19"
          r="1.4"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          vectorEffect="nonScalingStroke"
        />
        <circle
          cx="17"
          cy="19"
          r="1.4"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          vectorEffect="nonScalingStroke"
        />
        <path
          d="M3.5 4H6l1.6 9.2a1.2 1.2 0 0 0 1.2 1h7.4a1.2 1.2 0 0 0 1.2-.9L19 7H7"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="nonScalingStroke"
        />
      </g>
    </svg>
  );
}

export function MenuIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SearchIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" />
    </svg>
  );
}
