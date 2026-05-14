/**
 * PDP size-guide panel: infer chart type from `available_sizes` and show approximate measurements.
 * Numbers are typical industry ranges — customers should confirm with the supplier chart when in doubt.
 */

export type SizeGuideKind = "mens-alpha" | "womens-numeric" | "kids-numeric" | "numeric-workwear" | "mixed";

export type SizeGuideTable = {
  caption: string;
  headers: string[];
  rows: string[][];
};

export type SizeGuideBundle = {
  title: string;
  intro: string;
  tables: SizeGuideTable[];
};

function isPlainIntegerSize(s: string): boolean {
  return /^\d+$/.test(s.trim());
}

/** AU workwear pants: leading digits = waist (cm); trailing S / R / L = leg (Short / Regular / Long). */
function isWorkwearWaistLegCode(s: string): boolean {
  return /^\d{2,3}\s*[SRL]$/i.test(s.trim());
}

/** Waist / leg sizing used on overalls & some pants (e.g. Syzmik-style numeric blocks). */
function looksLikeWorkwearNumeric(nums: number[]): boolean {
  if (nums.length < 2) {
    return false;
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return min >= 67 && max >= 87;
}

export function inferSizeGuideKind(sizes: string[], productName = ""): SizeGuideKind {
  const trimmed = sizes.map((s) => s.trim()).filter(Boolean);
  const nameLower = productName.toLowerCase();
  if (!trimmed.length) {
    return "mens-alpha";
  }

  if (trimmed.some(isWorkwearWaistLegCode)) {
    return "numeric-workwear";
  }

  const plainNums = trimmed.filter(isPlainIntegerSize);
  const nums = plainNums.map((s) => Number.parseInt(s, 10));
  const allPlainNum = plainNums.length === trimmed.length && nums.length > 0;

  if (allPlainNum) {
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    if (looksLikeWorkwearNumeric(nums)) {
      return "numeric-workwear";
    }
    const kidCue =
      nums.includes(4) || /\bkids?\b|\bchildren\b|\byouth\b/i.test(productName);
    const womensCue =
      /\bwomens\b|\bladies\b/i.test(nameLower) || nums.some((x) => x >= 18 || x === 22 || x === 24);
    if (kidCue && !womensCue && max <= 16) {
      return "kids-numeric";
    }
    if (womensCue && !looksLikeWorkwearNumeric(nums)) {
      return "womens-numeric";
    }
    if (min >= 6 && max <= 34) {
      return "womens-numeric";
    }
  }

  const letterish = /^(XXS|XS|S|M|L|XL|XXXS|\d+XL|ONE\s*SIZE|OS|FRE)$/i;
  const hasAlpha = trimmed.some((s) => letterish.test(s.replace(/\s+/g, "")));
  if (hasAlpha && plainNums.length < trimmed.length) {
    return "mens-alpha";
  }
  if (allPlainNum) {
    return "womens-numeric";
  }
  return "mixed";
}

const DISCLAIMER =
  "This is a general fitting guide only. For the exact garment spec, please refer to the supplier’s latest size chart or contact us.";

/** Footer for the size-guide panel and plain-text download — authoritative sizing is on the supplier’s site. */
export const SIZE_GUIDE_SUPPLIER_WEBSITE_FOOTNOTE =
  "For accurate sizing, follow the information on the supplier’s official website.";

/** AU workwear trouser codes: number ≈ waist (cm); S/R/L = leg length (exact inseam varies by brand). */
const WORKWEAR_WAIST_LEG_LETTER_TABLE: SizeGuideTable = {
  caption: "Workwear pants — waist × leg letter (e.g. 77R, 82R)",
  headers: ["Typical codes", "Waist (cm)", "Leg letter"],
  rows: [
    ["67S, 67R, 67L", "67", "S = Short · R = Regular · L = Long"],
    ["72S, 72R, 72L", "72", "Same waist; letter = leg / inseam length"],
    ["77S, 77R, 77L", "77", "S = Short · R = Regular · L = Long"],
    ["82S, 82R, 82L", "82", "Same waist; letter = leg / inseam length"],
    ["87S, 87R, 87L", "87", "S = Short · R = Regular · L = Long"],
    ["92S, 92R, 92L", "92", "Same waist; letter = leg / inseam length"],
    ["97S, 97R, 97L", "97", "S = Short · R = Regular · L = Long"],
    ["102S, 102R, 102L", "102", "Same waist; letter = leg / inseam length"],
    ["107S, 107R, 107L", "107", "S = Short · R = Regular · L = Long"],
  ],
};

export function getSizeGuideBundle(kind: SizeGuideKind, productName: string): SizeGuideBundle {
  const title = "Size guide";
  const nameLine = productName.trim() ? `Product: ${productName.trim()}\n\n` : "";

  switch (kind) {
    case "mens-alpha":
      return {
        title,
        intro: `${nameLine}${DISCLAIMER}\n\nMen’s / unisex letter sizes — approximate body measurements (AU-style tops & pants).`,
        tables: [
          {
            caption: "Men’s tops (approx. cm)",
            headers: ["Size", "Chest", "Waist"],
            rows: [
              ["XS", "87–92", "73–78"],
              ["S", "92–97", "78–83"],
              ["M", "97–102", "83–88"],
              ["L", "102–107", "88–93"],
              ["XL", "107–112", "93–98"],
              ["2XL", "112–117", "98–103"],
              ["3XL", "117–122", "103–108"],
              ["4XL", "122–127", "108–113"],
              ["5XL", "127–132", "113–118"],
            ],
          },
          {
            caption: "Men’s pants (AU standard, approx. cm)",
            headers: ["Size", "Waist", "Hip (seat)"],
            rows: [
              ["XS", "73–78", "88–93"],
              ["S", "78–83", "93–98"],
              ["M", "83–88", "98–103"],
              ["L", "88–93", "103–108"],
              ["XL", "93–98", "108–113"],
              ["2XL", "98–103", "113–118"],
              ["3XL", "103–108", "118–123"],
              ["4XL", "108–113", "123–128"],
              ["5XL", "113–118", "128–133"],
            ],
          },
          WORKWEAR_WAIST_LEG_LETTER_TABLE,
        ],
      };
    case "womens-numeric":
      return {
        title,
        intro: `${nameLine}${DISCLAIMER}\n\nWomen’s numeric sizes — approximate body measurements (AU dress / pants numbering).`,
        tables: [
          {
            caption: "Women’s tops & dresses (approx. cm)",
            headers: ["Size", "Bust", "Waist", "Hip"],
            rows: [
              ["6", "80", "63", "88"],
              ["8", "85", "68", "93"],
              ["10", "90", "73", "98"],
              ["12", "95", "78", "103"],
              ["14", "100", "83", "108"],
              ["16", "105", "88", "113"],
              ["18", "110", "93", "118"],
              ["20", "115", "98", "123"],
              ["22", "120", "103", "128"],
              ["24", "125", "108", "133"],
            ],
          },
          {
            caption: "Women’s pants & skirts (AU standard, approx. cm)",
            headers: ["Size", "Waist", "Hip"],
            rows: [
              ["6", "63", "88"],
              ["8", "68", "93"],
              ["10", "73", "98"],
              ["12", "78", "103"],
              ["14", "83", "108"],
              ["16", "88", "113"],
              ["18", "93", "118"],
              ["20", "98", "123"],
              ["22", "103", "128"],
              ["24", "108", "133"],
            ],
          },
        ],
      };
    case "kids-numeric":
      return {
        title,
        intro: `${nameLine}${DISCLAIMER}\n\nKids’ numeric sizes — approximate age and chest for polo / tee fits.`,
        tables: [
          {
            caption: "Kids (approx.)",
            headers: ["Size", "Typical age", "Chest (cm)"],
            rows: [
              ["4", "3–4 yrs", "60–63"],
              ["6", "5–6 yrs", "64–67"],
              ["8", "7–8 yrs", "68–71"],
              ["10", "9–10 yrs", "72–75"],
              ["12", "11–12 yrs", "76–79"],
              ["14", "13–14 yrs", "80–84"],
              ["16", "15+ yrs (youth)", "85–90"],
            ],
          },
        ],
      };
    case "numeric-workwear":
      return {
        title,
        intro: `${nameLine}${DISCLAIMER}\n\nNumeric workwear sizing — pants often use a waist number with S/R/L (e.g. 77R, 82R); overalls may use waist–length block numbers. Always check the supplier chart for inseam.`,
        tables: [
          WORKWEAR_WAIST_LEG_LETTER_TABLE,
          {
            caption: "Overalls / some pants — waist–length block numbers (examples)",
            headers: ["Label range", "Notes"],
            rows: [
              ["72 – 87", "Smaller waist / shorter leg blocks — see supplier chart."],
              ["92 – 107", "Mid range — see supplier chart for inseam."],
              ["112 – 122", "Larger / longer blocks — see supplier chart."],
            ],
          },
        ],
      };
    default:
      return {
        title,
        intro: `${nameLine}${DISCLAIMER}\n\nThis style mixes size types or uses special labels. Compare your measurements to the supplier chart, or contact us with the style code.`,
        tables: [
          {
            caption: "Letter sizes (men’s / unisex tops, approx. cm)",
            headers: ["Size", "Chest", "Waist"],
            rows: [
              ["S", "92–97", "78–83"],
              ["M", "97–102", "83–88"],
              ["L", "102–107", "88–93"],
              ["XL", "107–112", "93–98"],
              ["2XL", "112–117", "98–103"],
              ["3XL", "117–122", "103–108"],
            ],
          },
          {
            caption: "Men’s pants (AU standard, approx. cm)",
            headers: ["Size", "Waist", "Hip (seat)"],
            rows: [
              ["S", "78–83", "93–98"],
              ["M", "83–88", "98–103"],
              ["L", "88–93", "103–108"],
              ["XL", "93–98", "108–113"],
              ["2XL", "98–103", "113–118"],
              ["3XL", "103–108", "118–123"],
            ],
          },
          {
            caption: "Women’s numeric (approx. cm)",
            headers: ["Size", "Bust", "Waist"],
            rows: [
              ["10", "90", "73"],
              ["12", "95", "78"],
              ["14", "100", "83"],
              ["16", "105", "88"],
              ["18", "110", "93"],
            ],
          },
          {
            caption: "Women’s pants & skirts (AU standard, approx. cm)",
            headers: ["Size", "Waist", "Hip"],
            rows: [
              ["10", "73", "98"],
              ["12", "78", "103"],
              ["14", "83", "108"],
              ["16", "88", "113"],
              ["18", "93", "118"],
            ],
          },
          WORKWEAR_WAIST_LEG_LETTER_TABLE,
        ],
      };
  }
}

export function sizeGuideToPlainText(bundle: SizeGuideBundle): string {
  const lines: string[] = [bundle.title.toUpperCase(), "", bundle.intro, ""];
  for (const t of bundle.tables) {
    lines.push(t.caption, t.headers.join("\t"), ...t.rows.map((r) => r.join("\t")), "");
  }
  lines.push("", SIZE_GUIDE_SUPPLIER_WEBSITE_FOOTNOTE);
  return lines.join("\n").trim();
}
