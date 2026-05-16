#!/usr/bin/env node
/**
 * Verifies sharp loads after install. Non-fatal — optimize script falls back to sips on macOS.
 */
async function main() {
  try {
    const mod = await import("sharp");
    const sharp = mod.default;
    const buf = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    if (!buf?.length) {
      throw new Error("empty output");
    }
    console.log("sharp: ok");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`sharp: unavailable (${msg.split("\n")[0]})`);
    console.warn("  Run: npm run reinstall:sharp");
    console.warn("  Image script will use macOS sips when sharp is missing.");
  }
}

main();
