import fs from "node:fs";
import path from "node:path";

let cache: Map<string, string> | null = null;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? "";
    if (ch === "\"") {
      const next = line[i + 1] ?? "";
      if (inQuotes && next === "\"") {
        cur += "\"";
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function tryLoadSyzmikCsvMap(): Map<string, string> {
  const root = process.cwd();
  const candidates = [
    path.join(root, "data/supplier/fashion-biz/csv/2026_syzmik_au_sum.csv"),
    path.join(root, "data/supplier/fashion-biz/csv/2025_syzmik_au_sum.csv"),
  ];

  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) {
    return new Map();
  }

  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) {
    return new Map();
  }

  const header = parseCsvLine(lines[0] ?? "");
  const styleIdx = header.findIndex((h) => h.trim().toLowerCase() === "style");
  const descIdx = header.findIndex((h) => h.trim().toLowerCase() === "stringified_description");
  if (styleIdx < 0 || descIdx < 0) {
    return new Map();
  }

  const m = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const style = (cols[styleIdx] ?? "").trim().toUpperCase();
    const body = (cols[descIdx] ?? "").trim();
    if (!style || !body) continue;
    // Prefer the longest body if duplicates appear (e.g. multiple colors rows).
    const prev = m.get(style);
    if (!prev || body.length > prev.length) {
      m.set(style, body);
    }
  }
  return m;
}

export function syzmikDescriptionBodyFromCsv(styleCodeUpper: string): string | null {
  const code = String(styleCodeUpper ?? "").trim().toUpperCase();
  if (!code) return null;
  if (cache == null) {
    cache = tryLoadSyzmikCsvMap();
  }
  return cache.get(code) ?? null;
}

