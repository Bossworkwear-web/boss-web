/**
 * Fashion Biz `*sum*.csv` (under `data/supplier/fashion-biz/csv/`) → style code → marketing text.
 * Uses the CSV header row so any sum export works (Biz Care, Biz Collection, Syzmik, Biz Corporates, …).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function splitCsvFields(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === "," && !q) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * @returns {{ shortByStyle: Map<string, string>, detailByStyle: Map<string, string> }}
 */
export function loadFashionBizSumMarketingMaps(root) {
  const shortByStyle = new Map();
  const detailByStyle = new Map();
  const csvDir = join(root, "data", "supplier", "fashion-biz", "csv");
  if (!existsSync(csvDir)) {
    return { shortByStyle, detailByStyle };
  }
  let files;
  try {
    files = readdirSync(csvDir).filter((f) => f.toLowerCase().endsWith(".csv") && f.toLowerCase().includes("sum"));
  } catch {
    return { shortByStyle, detailByStyle };
  }
  files.sort();
  for (const file of files) {
    let text;
    try {
      text = readFileSync(join(csvDir, file), "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    if (!lines.length) {
      continue;
    }
    const headerCols = splitCsvFields(lines[0]).map((h) => String(h).trim());
    const idxStyle = headerCols.findIndex((h) => h.toLowerCase() === "style");
    const idxShort = headerCols.findIndex((h) => h.toLowerCase() === "short_description");
    const idxDetail = headerCols.findIndex((h) => h.toLowerCase() === "stringified_description");
    if (idxStyle < 0) {
      continue;
    }
    if (idxShort < 0 && idxDetail < 0) {
      continue;
    }
    for (let li = 1; li < lines.length; li += 1) {
      const line = lines[li];
      if (!line.trim()) {
        continue;
      }
      const cols = splitCsvFields(line);
      const maxIdx = Math.max(idxStyle, idxShort, idxDetail);
      if (cols.length <= maxIdx) {
        continue;
      }
      const style = String(cols[idxStyle] ?? "")
        .trim()
        .toUpperCase()
        .replace(/-CLEARANCE$/i, "");
      if (!style) {
        continue;
      }
      if (idxShort >= 0) {
        const shortDesc = String(cols[idxShort] ?? "").trim();
        if (shortDesc) {
          shortByStyle.set(style, shortDesc);
        }
      }
      if (idxDetail >= 0) {
        const detail = String(cols[idxDetail] ?? "")
          .trim()
          .replace(/\r\n/g, "\n");
        if (detail) {
          const prev = detailByStyle.get(style);
          if (!prev || detail.length > prev.length) {
            detailByStyle.set(style, detail);
          }
        }
      }
    }
  }
  return { shortByStyle, detailByStyle };
}
