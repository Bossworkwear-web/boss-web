#!/usr/bin/env node
/**
 * `next dev` without opening a browser. Honors NEXT_DEV_WEBPACK=1 (--webpack).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT ?? "3000";
const host = process.env.DEV_PREVIEW_HOST ?? "127.0.0.1";
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

if (!existsSync(nextBin)) {
  console.error("Missing Next.js CLI. Run npm install in", root);
  process.exit(1);
}

const useWebpack = process.env.NEXT_DEV_WEBPACK === "1" || process.env.NEXT_DEV_WEBPACK === "true";
const devArgs = ["dev", "-H", host, "-p", port];
if (useWebpack) {
  devArgs.push("--webpack");
}

const dev = spawn(process.execPath, [nextBin, ...devArgs], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env },
});

dev.on("exit", (code) => process.exit(code ?? 0));
