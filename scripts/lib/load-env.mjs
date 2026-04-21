import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Resolve `dev/boss-web` root from this file (`scripts/lib/…`). */
export function getBossWebRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

/** Load `.env.local` into `process.env` (no override of existing vars). */
export function loadEnvLocal() {
  const envPath = join(getBossWebRoot(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        if (process.env[key] !== undefined) {
          continue;
        }
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}
