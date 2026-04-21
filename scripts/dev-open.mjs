#!/usr/bin/env node
/**
 * Runs `next dev` and opens Google Chrome when the app responds (fallback: system default browser).
 *
 * Usage:
 *   npm run dev          — logo prestep + this script (Chrome preview)
 *   npm run dev:server   — `next dev` only, no browser
 *   npm run dev:open / preview — same as dev without duplicate predev when chained from npm
 *
 * Env:
 *   PORT               — dev server port (default 3000)
 *   DEV_PREVIEW_URL    — full URL to open (default http://localhost:$PORT)
 *   DEV_PREVIEW_BROWSER — `chrome` (default) or `default` for OS default browser only
 *   NEXT_DEV_WEBPACK   — set to `1` to run `next dev --webpack` (helps when Turbopack hits EMFILE / broken routes on macOS)
 */
import { spawn, exec } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT ?? "3000";
const url = process.env.DEV_PREVIEW_URL ?? `http://localhost:${port}`;
const browserMode = (process.env.DEV_PREVIEW_BROWSER ?? "chrome").toLowerCase();

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextBin)) {
  console.error("Missing Next.js CLI. Run npm install in", root);
  process.exit(1);
}

// Force localhost to avoid Node `os.networkInterfaces()` failures (uv_interface_addresses)
// that can crash Next's "network host" detection on some machines.
const useWebpack = process.env.NEXT_DEV_WEBPACK === "1" || process.env.NEXT_DEV_WEBPACK === "true";
const devArgs = ["dev", "-H", "localhost", "-p", port];
if (useWebpack) {
  devArgs.push("--webpack");
}
const dev = spawn(process.execPath, [nextBin, ...devArgs], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env },
});

let opened = false;

function openDefaultBrowser() {
  if (process.platform === "darwin") {
    exec(`open "${url}"`, () => {});
  } else if (process.platform === "win32") {
    exec(`start "" "${url}"`, { shell: true }, () => {});
  } else {
    exec(`xdg-open "${url}"`, () => {});
  }
}

function openChromeThenFallback() {
  const fallback = () => {
    openDefaultBrowser();
  };

  if (process.platform === "darwin") {
    const tryApps = ["Google Chrome", "Chromium"];
    let i = 0;
    const tryNext = () => {
      if (i >= tryApps.length) {
        fallback();
        return;
      }
      const app = tryApps[i++];
      const p = spawn("open", ["-a", app, url], {
        stdio: "ignore",
        detached: true,
      });
      p.on("error", tryNext);
      p.on("close", (code) => {
        if (code !== 0) {
          tryNext();
        }
      });
    };
    tryNext();
    return;
  }

  if (process.platform === "win32") {
    exec(`start chrome "${url}"`, { shell: true }, (err) => {
      if (err) {
        exec(`start "" "${url}"`, { shell: true }, () => {});
      }
    });
    return;
  }

  exec(`google-chrome "${url}"`, { shell: true }, (err) => {
    if (err) {
      exec(`chromium "${url}"`, { shell: true }, (err2) => {
        if (err2) {
          exec(`chromium-browser "${url}"`, { shell: true }, (err3) => {
            if (err3) {
              openDefaultBrowser();
            }
          });
        }
      });
    }
  });
}

function openBrowser() {
  if (opened) {
    return;
  }
  opened = true;
  if (browserMode === "default") {
    openDefaultBrowser();
  } else {
    openChromeThenFallback();
  }
}

const poll = setInterval(async () => {
  try {
    const res = await fetch(url, { cache: "no-store" });
    // Open once the dev server answers (even 404) so a broken home route is visible in the browser.
    if (res.status >= 100 && res.status < 600) {
      clearInterval(poll);
      openBrowser();
    }
  } catch {
    /* server not ready */
  }
}, 400);

dev.on("exit", (code) => {
  clearInterval(poll);
  process.exit(code ?? 0);
});
