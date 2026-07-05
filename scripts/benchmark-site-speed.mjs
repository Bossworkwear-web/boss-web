#!/usr/bin/env node
/**
 * Compare server response + browser navigation timing across Boss Workwear and competitors.
 * Usage: node scripts/benchmark-site-speed.mjs
 */
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const RUNS = 3;

const SITES = [
  {
    name: "Boss Workwear",
    pages: {
      home: "https://bossworkwear.au/",
      category: "https://bossworkwear.au/categories/mens",
      subcategory: "https://bossworkwear.au/categories/mens/polos",
      product: "https://bossworkwear.au/products/jb-2kp",
    },
    transitions: [
      ["home", "category"],
      ["category", "subcategory"],
      ["subcategory", "product"],
      ["product", "category"],
    ],
  },
  {
    name: "King Gee",
    pages: {
      home: "https://www.kinggee.com.au/",
      category: "https://www.kinggee.com.au/collections/mens-workwear",
      product: "https://www.kinggee.com.au/products/classic-cotton-polo",
    },
    transitions: [
      ["home", "category"],
      ["category", "product"],
    ],
  },
  {
    name: "Hard Yakka AU",
    pages: {
      home: "https://www.hardyakka.com/au/",
      category: "https://www.hardyakka.com/au/shop/mens",
    },
    transitions: [["home", "category"]],
  },
  {
    name: "Worklocker",
    pages: {
      home: "https://www.worklocker.com.au/",
      category: "https://www.worklocker.com.au/workwear",
    },
    transitions: [["home", "category"]],
  },
  {
    name: "Total Workwear",
    pages: {
      home: "https://www.totalworkwear.com.au/",
      category: "https://www.totalworkwear.com.au/workwear",
    },
    transitions: [["home", "category"]],
  },
  {
    name: "DNC Workwear",
    pages: {
      home: "https://www.dncworkwear.com/",
      category: "https://www.dncworkwear.com/collections/workwear",
    },
    transitions: [["home", "category"]],
  },
];

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function curlTiming(url) {
  try {
    const out = execFileSync(
      "curl",
      ["-sS", "-o", "/dev/null", "-w", "%{time_starttransfer} %{time_total} %{http_code}", "-L", "--max-time", "60", url],
      { encoding: "utf8" },
    ).trim();
    const [ttfb, total, code] = out.split(" ");
    return {
      ok: code.startsWith("2") || code.startsWith("3"),
      status: Number(code),
      ttfbMs: Math.round(Number(ttfb) * 1000),
      totalMs: Math.round(Number(total) * 1000),
    };
  } catch {
    return { ok: false, status: 0, ttfbMs: null, totalMs: null };
  }
}

async function measureCurlPages(site) {
  const rows = [];
  for (const [label, url] of Object.entries(site.pages)) {
    const samples = [];
    for (let i = 0; i < RUNS; i++) {
      samples.push(curlTiming(url));
    }
    const ok = samples.filter((s) => s.ok);
    rows.push({
      label,
      url,
      status: ok[0]?.status ?? samples[0]?.status ?? 0,
      ttfbMedianMs: ok.length ? median(ok.map((s) => s.ttfbMs)) : null,
      totalMedianMs: ok.length ? median(ok.map((s) => s.totalMs)) : null,
      ttfbSamplesMs: samples.map((s) => s.ttfbMs),
    });
  }
  return rows;
}

async function measureBrowser(site, page) {
  const pageRows = [];
  for (const [label, url] of Object.entries(site.pages)) {
    const samples = [];
    for (let i = 0; i < RUNS; i++) {
      try {
        const wallStart = Date.now();
        const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        const domWallMs = Date.now() - wallStart;
        await page.waitForLoadState("load", { timeout: 20000 }).catch(() => {});
        const loadWallMs = Date.now() - wallStart;
        const nav = await page.evaluate(() => {
          const n = performance.getEntriesByType("navigation")[0];
          if (!n) return null;
          return {
            ttfbMs: Math.round(n.responseStart),
            domMs: Math.round(n.domContentLoadedEventEnd),
            loadMs: Math.round(n.loadEventEnd),
            transferBytes: n.transferSize || 0,
          };
        });
        samples.push({
          ok: resp?.ok() ?? false,
          domWallMs,
          loadWallMs,
          ttfbMs: nav?.ttfbMs ?? null,
          domMs: nav?.domMs ?? null,
          loadMs: nav?.loadMs ?? null,
          transferBytes: nav?.transferBytes ?? null,
        });
        await page.waitForTimeout(600);
      } catch (e) {
        samples.push({ ok: false, error: String(e.message || e).slice(0, 100) });
      }
    }
    const ok = samples.filter((s) => s.ok);
    pageRows.push({
      label,
      url,
      domWallMedianMs: ok.length ? median(ok.map((s) => s.domWallMs)) : null,
      loadWallMedianMs: ok.length ? median(ok.map((s) => s.loadWallMs)) : null,
      ttfbMedianMs: ok.length && ok.every((s) => s.ttfbMs != null) ? median(ok.map((s) => s.ttfbMs)) : null,
      transferMedianKb: ok.length && ok.some((s) => s.transferBytes)
        ? Math.round(median(ok.map((s) => s.transferBytes || 0)) / 1024)
        : null,
      errors: samples.filter((s) => !s.ok).map((s) => s.error || "failed"),
    });
  }

  const transitionRows = [];
  for (const [fromKey, toKey] of site.transitions) {
    const from = site.pages[fromKey];
    const to = site.pages[toKey];
    if (!from || !to) continue;
    const samples = [];
    for (let i = 0; i < RUNS; i++) {
      try {
        await page.goto(from, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForLoadState("load", { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(400);
        const start = Date.now();
        await page.goto(to, { waitUntil: "domcontentloaded", timeout: 60000 });
        const domMs = Date.now() - start;
        await page.waitForLoadState("load", { timeout: 20000 }).catch(() => {});
        const loadMs = Date.now() - start;
        samples.push({ domMs, loadMs });
        await page.waitForTimeout(600);
      } catch (e) {
        samples.push({ error: String(e.message || e).slice(0, 100) });
      }
    }
    const ok = samples.filter((s) => s.domMs != null);
    transitionRows.push({
      label: `${fromKey} → ${toKey}`,
      domMedianMs: ok.length ? median(ok.map((s) => s.domMs)) : null,
      loadMedianMs: ok.length ? median(ok.map((s) => s.loadMs)) : null,
      errors: samples.filter((s) => s.error).map((s) => s.error),
    });
  }

  return { pages: pageRows, transitions: transitionRows };
}

function printTable(title, rows, cols) {
  console.log(`\n## ${title}`);
  const header = ["Site", ...cols.map((c) => c.label)];
  console.log("| " + header.join(" | ") + " |");
  console.log("| " + header.map(() => "---").join(" | ") + " |");
  for (const row of rows) {
    console.log("| " + [row.site, ...cols.map((c) => c.fmt(row))].join(" | ") + " |");
  }
}

async function main() {
  console.log(`Benchmark started: ${new Date().toISOString()} (${RUNS} runs/url, cold-ish curl + headless Chrome)`);

  const curlResults = [];
  for (const site of SITES) {
    console.error(`curl: ${site.name}...`);
    curlResults.push({ site: site.name, pages: await measureCurlPages(site) });
  }

  let browserResults = [];
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 900 },
    });
    for (const site of SITES) {
      console.error(`browser: ${site.name}...`);
      const measured = await measureBrowser(site, page);
      browserResults.push({ site: site.name, ...measured });
    }
    await browser.close();
  } catch (e) {
    console.error("Browser benchmark skipped:", e.message);
  }

  // Markdown summary for user
  const homeTtfb = curlResults.map((r) => ({
    site: r.site,
    ttfb: r.pages.find((p) => p.label === "home")?.ttfbMedianMs,
    total: r.pages.find((p) => p.label === "home")?.totalMedianMs,
  }));
  printTable("홈 TTFB / 전체 응답 (curl, ms)", homeTtfb, [
    { label: "TTFB (ms)", fmt: (r) => (r.ttfb != null ? String(r.ttfb) : "—") },
    { label: "Total (ms)", fmt: (r) => (r.total != null ? String(r.total) : "—") },
  ]);

  const catTtfb = curlResults.map((r) => ({
    site: r.site,
    ttfb: r.pages.find((p) => p.label === "category")?.ttfbMedianMs,
    total: r.pages.find((p) => p.label === "category")?.totalMedianMs,
  }));
  printTable("카테고리 TTFB / 전체 응답 (curl, ms)", catTtfb, [
    { label: "TTFB (ms)", fmt: (r) => (r.ttfb != null ? String(r.ttfb) : "—") },
    { label: "Total (ms)", fmt: (r) => (r.total != null ? String(r.total) : "—") },
  ]);

  if (browserResults.length) {
    const boss = browserResults.find((r) => r.site === "Boss Workwear");
    const bossHome = boss?.pages.find((p) => p.label === "home");
    const bossCat = boss?.pages.find((p) => p.label === "category");
    const bossTransitions = boss?.transitions ?? [];

    const browserHome = browserResults.map((r) => ({
      site: r.site,
      dom: r.pages.find((p) => p.label === "home")?.domWallMedianMs,
      load: r.pages.find((p) => p.label === "home")?.loadWallMedianMs,
    }));
    printTable("홈 브라우저 로딩 (DOM / Load, ms)", browserHome, [
      { label: "DOM (ms)", fmt: (r) => (r.dom != null ? String(r.dom) : "—") },
      { label: "Load (ms)", fmt: (r) => (r.load != null ? String(r.load) : "—") },
    ]);

    const browserCat = browserResults.map((r) => ({
      site: r.site,
      dom: r.pages.find((p) => p.label === "category")?.domWallMedianMs,
      load: r.pages.find((p) => p.label === "category")?.loadWallMedianMs,
    }));
    printTable("카테고리 브라우저 로딩 (DOM / Load, ms)", browserCat, [
      { label: "DOM (ms)", fmt: (r) => (r.dom != null ? String(r.dom) : "—") },
      { label: "Load (ms)", fmt: (r) => (r.load != null ? String(r.load) : "—") },
    ]);

    const allTransitions = browserResults.flatMap((r) =>
      (r.transitions ?? []).map((t) => ({ site: r.site, ...t })),
    );
    printTable("페이지 이동 (브라우저, DOM까지 ms)", allTransitions, [
      { label: "Transition", fmt: (r) => r.label },
      { label: "DOM (ms)", fmt: (r) => (r.domMedianMs != null ? String(r.domMedianMs) : "—") },
      { label: "Load (ms)", fmt: (r) => (r.loadMedianMs != null ? String(r.loadMedianMs) : "—") },
    ]);

    console.log("\n### Boss Workwear 상세");
    console.log(`- 홈: DOM ${bossHome?.domWallMedianMs ?? "—"}ms / Load ${bossHome?.loadWallMedianMs ?? "—"}ms / TTFB ${bossHome?.ttfbMedianMs ?? "—"}ms`);
    console.log(`- 카테고리: DOM ${bossCat?.domWallMedianMs ?? "—"}ms / Load ${bossCat?.loadWallMedianMs ?? "—"}ms`);
    for (const t of bossTransitions) {
      console.log(`- 이동 ${t.label}: DOM ${t.domMedianMs ?? "—"}ms / Load ${t.loadMedianMs ?? "—"}ms`);
    }
  }

  console.log("\n(raw json follows)\n");
  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), curlResults, browserResults }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
