export type StorefrontDecoratedServiceType = "Embroidery" | "Printing";

export type StorefrontPlacementOption = {
  id: string;
  label: string;
  short: string;
  diagramAbbr: string;
  embroideryCost: number;
  printingCost: number;
};

export const STOREFRONT_SERVICE_TYPE_BUTTON_IMAGE = {
  Plain: "/button/Button_Plain.png",
  Embroidery: "/button/Buttom_Emb.png",
  Printing: "/button/Button_Print.png",
} as const;

export const STOREFRONT_SERVICE_TYPE_BUTTON_IMAGE_SELECTED = {
  Plain: "/button/Button_Plain_2.png",
  Embroidery: "/button/Buttom_Emb_2.png",
  Printing: "/button/Button_Print_2.png",
} as const;

export const STOREFRONT_SERVICE_TYPE_BUTTON_SHADOW_IDLE = {
  Plain:
    "shadow-[0_5px_18px_-5px_rgba(0,31,63,0.22),0_2px_8px_-2px_rgba(0,31,63,0.12)]",
  Embroidery:
    "shadow-[0_5px_18px_-5px_rgba(255,133,27,0.26),0_2px_8px_-2px_rgba(255,133,27,0.13)]",
  Printing:
    "shadow-[0_5px_18px_-5px_rgba(59,130,246,0.28),0_2px_8px_-2px_rgba(59,130,246,0.14)]",
} as const;

export const STOREFRONT_SERVICE_TYPE_BUTTON_ROUNDED = "rounded-[0.8rem] sm:rounded-[0.94rem]";

const PLACEMENT_FALLBACK_EMBROIDERY = 2.0;
const PLACEMENT_FALLBACK_PRINTING = 1.5;

const defaultEmbroideryPlacementPricing: Record<string, number> = {
  "left chest": 9.95,
  "left-hand chest": 9.95,
  "right chest": 9.95,
  "center chest": 24.95,
  "full back": 18,
  "front full": 18,
  "front bottom": 18,
  "full chest": 18,
  "front collar": 18,
  "back upper": 7.95,
  "back middle": 24.95,
  "left sleeve": 8.95,
  "right sleeve": 8.95,
};

const defaultPrintingPlacementPricing: Record<string, number> = {
  "left chest": 8.95,
  "left-hand chest": 8.95,
  "right chest": 8.95,
  "center chest": 14.95,
  "full back": 17.95,
  "front full": 17.95,
  "front bottom": 18,
  "full chest": 17.95,
  "front collar": 18,
  "back upper": 7.95,
  "back middle": 14.95,
  "left sleeve": 7.95,
  "right sleeve": 7.95,
};

function toShortCode(label: string): string {
  const words = label
    .split(/[\s/|]+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (!words.length) {
    return "OP";
  }
  return words
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Full Back (FB) and Full Chest (FC): printing only — same rule as storefront PDP. */
export function isEmbroideryOfferedForPlacement(diagramAbbr: string): boolean {
  const a = diagramAbbr.trim().toUpperCase();
  return a !== "FB" && a !== "FC";
}

/** Storefront / Get a Quote placement row order (top → bottom). */
export const STOREFRONT_PLACEMENT_UI_ORDER = [
  "LC",
  "RC",
  "LS",
  "RS",
  "CC",
  "BM",
  "BU",
] as const;

function sortStorefrontPlacementOptions(
  options: StorefrontPlacementOption[],
): StorefrontPlacementOption[] {
  const rank = new Map<string, number>(
    STOREFRONT_PLACEMENT_UI_ORDER.map((code, index) => [code, index]),
  );
  return [...options].sort((a, b) => {
    const ra = rank.get(a.diagramAbbr.trim().toUpperCase()) ?? rank.size + 1;
    const rb = rank.get(b.diagramAbbr.trim().toUpperCase()) ?? rank.size + 1;
    if (ra !== rb) {
      return ra - rb;
    }
    return a.label.localeCompare(b.label);
  });
}

export function buildStorefrontPlacementOptions(
  placements: readonly { id: string; name: string }[],
): StorefrontPlacementOption[] {
  const options = placements.map((item) => {
    const nameForCodes = item.name.replace(/\s+/g, " ").trim();
    const normalizedName = nameForCodes.toLowerCase();
    const diagramAbbr =
      normalizedName === "right chest"
        ? "RC"
        : normalizedName === "full back" ||
            normalizedName === "front full" ||
            normalizedName === "front bottom"
          ? "FB"
          : toShortCode(nameForCodes);
    const short =
      normalizedName === "full back" ||
      normalizedName === "front full" ||
      normalizedName === "front bottom"
        ? "FB"
        : toShortCode(nameForCodes);
    return {
      id: item.id,
      label: nameForCodes,
      short,
      diagramAbbr,
      embroideryCost:
        defaultEmbroideryPlacementPricing[normalizedName] ?? PLACEMENT_FALLBACK_EMBROIDERY,
      printingCost: defaultPrintingPlacementPricing[normalizedName] ?? PLACEMENT_FALLBACK_PRINTING,
    };
  });
  return sortStorefrontPlacementOptions(options);
}

export function storefrontServiceTypeLabel(
  selected: Record<StorefrontDecoratedServiceType, boolean>,
): string {
  if (selected.Embroidery && selected.Printing) {
    return "Embroidery & Printing";
  }
  if (selected.Embroidery) {
    return "Embroidery";
  }
  if (selected.Printing) {
    return "Printing";
  }
  return "";
}

export function formatStorefrontPlacementAddonAud(amount: number): string {
  return amount.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
