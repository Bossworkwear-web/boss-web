"use client";

import { useMemo, useState } from "react";

import { PlacementIcon } from "@/app/components/icons";
import {
  buildStorefrontPlacementOptions,
  isEmbroideryOfferedForPlacement,
  STOREFRONT_SERVICE_TYPE_BUTTON_IMAGE,
  STOREFRONT_SERVICE_TYPE_BUTTON_IMAGE_SELECTED,
  STOREFRONT_SERVICE_TYPE_BUTTON_ROUNDED,
  STOREFRONT_SERVICE_TYPE_BUTTON_SHADOW_IDLE,
  storefrontServiceTypeLabel,
  type StorefrontDecoratedServiceType,
  type StorefrontPlacementOption,
} from "@/lib/storefront-placement-options";
import { placementLogoLocationSrc } from "@/lib/placement-logo-location";

/** Embroidery / print icon buttons — 69% larger than PDP default (40% / 3.5rem). */
const PLACEMENT_SERVICE_ICON_BUTTON_SIZE = "w-[67.6%] max-w-[5.915rem]";

/** Placement diagram thumbnails — 60% larger than default (h-12/w-12, sm:h-14/w-14). */
const PLACEMENT_DIAGRAM_IMAGE_SIZE = "h-[4.8rem] w-[4.8rem] sm:h-[5.6rem] sm:w-[5.6rem]";
const PLACEMENT_DIAGRAM_FALLBACK_SIZE = "h-[3.2rem] w-[3.2rem]";
const PLACEMENT_DIAGRAM_FALLBACK_ICON_SIZE = "h-[1.6rem] w-[1.6rem]";

type Props = {
  placements: readonly { id: string; name: string }[];
  prefilledServiceType?: string;
  prefilledPlacementIds?: string[];
};

function parseInitialAssignments(
  options: StorefrontPlacementOption[],
  prefilledServiceType: string,
  prefilledPlacementIds: string[],
): Record<string, StorefrontDecoratedServiceType | null> {
  const service = prefilledServiceType.trim();
  const out: Record<string, StorefrontDecoratedServiceType | null> = {};
  for (const id of prefilledPlacementIds) {
    const opt = options.find((o) => o.id === id);
    if (!opt) {
      continue;
    }
    if (service.includes("Printing") && !service.includes("Embroidery")) {
      out[id] = "Printing";
      continue;
    }
    if (isEmbroideryOfferedForPlacement(opt.diagramAbbr)) {
      out[id] = "Embroidery";
    } else {
      out[id] = "Printing";
    }
  }
  return out;
}

function serviceTypeFromAssignments(
  assignments: Record<string, StorefrontDecoratedServiceType | null>,
): string {
  const hasEmbroidery = Object.values(assignments).some((svc) => svc === "Embroidery");
  const hasPrinting = Object.values(assignments).some((svc) => svc === "Printing");
  return storefrontServiceTypeLabel({ Embroidery: hasEmbroidery, Printing: hasPrinting });
}

function PlacementServiceIconButton({
  service,
  isActive,
  onClick,
  ariaLabel,
}: {
  service: StorefrontDecoratedServiceType;
  isActive: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  const activeGlowClass =
    service === "Printing"
      ? "shadow-[0_10px_28px_-8px_rgba(59,130,246,0.38)]"
      : "shadow-[0_10px_28px_-8px_rgba(255,133,27,0.38)]";
  const buttonArtSrc = isActive
    ? STOREFRONT_SERVICE_TYPE_BUTTON_IMAGE_SELECTED[service]
    : STOREFRONT_SERVICE_TYPE_BUTTON_IMAGE[service];

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={isActive}
      onClick={onClick}
      className={`relative mx-auto overflow-hidden ${PLACEMENT_SERVICE_ICON_BUTTON_SIZE} ${STOREFRONT_SERVICE_TYPE_BUTTON_ROUNDED} border-0 bg-transparent p-0 transition-shadow duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange ${
        isActive ? activeGlowClass : STOREFRONT_SERVICE_TYPE_BUTTON_SHADOW_IDLE[service]
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- PDP artwork in public/button */}
      <img
        src={buttonArtSrc}
        alt=""
        width={512}
        height={512}
        draggable={false}
        className="pointer-events-none h-auto w-full select-none object-contain"
      />
    </button>
  );
}

export function QuoteServicePlacementFields({
  placements,
  prefilledServiceType = "",
  prefilledPlacementIds = [],
}: Props) {
  const placementOptions = useMemo(() => buildStorefrontPlacementOptions(placements), [placements]);

  const [placementAssignments, setPlacementAssignments] = useState<
    Record<string, StorefrontDecoratedServiceType | null>
  >(() => parseInitialAssignments(placementOptions, prefilledServiceType, prefilledPlacementIds));

  const embroideryIds = useMemo(
    () =>
      Object.entries(placementAssignments)
        .filter(([, svc]) => svc === "Embroidery")
        .map(([id]) => id),
    [placementAssignments],
  );

  const printingIds = useMemo(
    () =>
      Object.entries(placementAssignments)
        .filter(([, svc]) => svc === "Printing")
        .map(([id]) => id),
    [placementAssignments],
  );

  const serviceTypeValue = useMemo(
    () => serviceTypeFromAssignments(placementAssignments),
    [placementAssignments],
  );

  function assignPlacement(id: string, service: StorefrontDecoratedServiceType) {
    if (service === "Embroidery") {
      const opt = placementOptions.find((o) => o.id === id);
      if (opt && !isEmbroideryOfferedForPlacement(opt.diagramAbbr)) {
        return;
      }
    }
    setPlacementAssignments((prev) => {
      const current = prev[id] ?? null;
      return {
        ...prev,
        [id]: current === service ? null : service,
      };
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-brand-navy/15 p-4">
      <input type="hidden" name="service_type" value={serviceTypeValue} readOnly />
      {embroideryIds.map((id) => (
        <input key={`emb-${id}`} type="hidden" name="embroidery_position_id" value={id} readOnly />
      ))}
      {printingIds.map((id) => (
        <input key={`prt-${id}`} type="hidden" name="printing_position_id" value={id} readOnly />
      ))}

      <h3 className="text-sm font-medium uppercase tracking-[0.1em] text-brand-navy/75">
        3. Service Type &amp; Placement Selector
      </h3>
      <div className="space-y-1 text-sm text-brand-navy/60">
        <p>Tap the embroidery or print icon for each placement (same as the product page).</p>
        <p>
          The <strong>first</strong> embroidery and printing position are stored on the quote; extras are
          added to <strong>Notes</strong> for staff.
        </p>
      </div>
      {placementOptions.length === 0 ? (
        <p className="text-sm text-brand-navy/55">No placements loaded.</p>
      ) : (
        <div className="grid gap-2 overflow-visible">
          {placementOptions.map((option) => {
            const assignedService = placementAssignments[option.id] ?? null;
            const diagramSrc = placementLogoLocationSrc(option.id, option.label, {
              diagramAbbr: option.diagramAbbr,
            });
            const rowSelectedClass =
              assignedService === "Embroidery"
                ? "bg-brand-orange/10"
                : assignedService === "Printing"
                  ? "bg-blue-100"
                  : "";

            return (
              <div
                key={option.id}
                className={`grid grid-cols-3 items-center gap-2 overflow-visible rounded-xl px-2 py-2 transition sm:gap-3 sm:px-3 sm:py-3 ${rowSelectedClass}`}
              >
                <div className="flex min-w-0 items-center gap-2 overflow-visible sm:gap-3">
                  {diagramSrc ? (
                    <span className="relative shrink-0 overflow-visible">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={diagramSrc}
                        alt=""
                        className={`relative z-0 origin-center rounded-lg border border-brand-navy/10 bg-white object-contain shadow-sm transition-[transform,box-shadow] duration-300 ease-out will-change-transform hover:z-[80] hover:scale-[2.75] hover:shadow-2xl hover:ring-2 hover:ring-brand-navy/20 ${PLACEMENT_DIAGRAM_IMAGE_SIZE}`}
                      />
                    </span>
                  ) : (
                    <span
                      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-navy text-white ${PLACEMENT_DIAGRAM_FALLBACK_SIZE}`}
                    >
                      <PlacementIcon className={PLACEMENT_DIAGRAM_FALLBACK_ICON_SIZE} />
                    </span>
                  )}
                  <span className="min-w-0 text-sm font-semibold leading-snug">
                    {option.label}{" "}
                    <span className="text-brand-navy/50">({option.short})</span>
                  </span>
                </div>
                {isEmbroideryOfferedForPlacement(option.diagramAbbr) ? (
                  <PlacementServiceIconButton
                    service="Embroidery"
                    isActive={assignedService === "Embroidery"}
                    onClick={() => assignPlacement(option.id, "Embroidery")}
                    ariaLabel={`Embroidery at ${option.label}`}
                  />
                ) : (
                  <span
                    className={`mx-auto inline-flex ${PLACEMENT_SERVICE_ICON_BUTTON_SIZE} items-center justify-center text-sm font-medium text-brand-navy/40`}
                    aria-label="Embroidery not available for this placement"
                  >
                    -
                  </span>
                )}
                <PlacementServiceIconButton
                  service="Printing"
                  isActive={assignedService === "Printing"}
                  onClick={() => assignPlacement(option.id, "Printing")}
                  ariaLabel={`Print at ${option.label}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
