/** Imperative top progress bar — no React state (safe during Next.js pushState / commit). */

const HOST_ID = "boss-route-progress";

let mounted = false;
let tickId: ReturnType<typeof setInterval> | null = null;
let barEl: HTMLDivElement | null = null;
let fillEl: HTMLDivElement | null = null;

function clearTick() {
  if (tickId) {
    clearInterval(tickId);
    tickId = null;
  }
}

export function mountRouteProgressBar() {
  if (mounted || typeof document === "undefined") {
    return;
  }
  mounted = true;
  barEl = document.createElement("div");
  barEl.id = HOST_ID;
  barEl.className = "boss-route-progress";
  barEl.setAttribute("aria-hidden", "true");
  fillEl = document.createElement("div");
  fillEl.className = "boss-route-progress__fill";
  barEl.appendChild(fillEl);
  document.body.appendChild(barEl);
}

export function showRouteProgressBar() {
  if (typeof document === "undefined") {
    return;
  }
  mountRouteProgressBar();
  if (!barEl || !fillEl) {
    return;
  }
  clearTick();
  barEl.classList.add("is-active");
  fillEl.style.width = "12%";
  let width = 12;
  tickId = setInterval(() => {
    if (width >= 88) {
      return;
    }
    width += Math.max(1, (88 - width) * 0.12);
    fillEl!.style.width = `${width}%`;
  }, 120);
}

export function hideRouteProgressBar() {
  if (!barEl || !fillEl) {
    return;
  }
  clearTick();
  fillEl.style.width = "100%";
  window.setTimeout(() => {
    barEl?.classList.remove("is-active");
    if (fillEl) {
      fillEl.style.width = "0%";
    }
  }, 220);
}
