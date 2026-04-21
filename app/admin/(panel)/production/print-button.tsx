"use client";

const PRINT_PAGE_STYLE_ID = "production-pack-print-page";

/** Print dialog with admin chrome hidden so only `.production-pack-print-area` content is visible. */
export function printProductionPackView() {
  let pageStyle = document.getElementById(PRINT_PAGE_STYLE_ID) as HTMLStyleElement | null;
  if (!pageStyle) {
    pageStyle = document.createElement("style");
    pageStyle.id = PRINT_PAGE_STYLE_ID;
    document.head.appendChild(pageStyle);
  }
  /* Paper size/orientation: browser print dialog (do not force portrait). */
  pageStyle.textContent = "@page { margin: 0; }";

  document.body.classList.add("production-pack-print-mode");

  function cleanup() {
    document.body.classList.remove("production-pack-print-mode");
    pageStyle?.remove();
    window.removeEventListener("afterprint", cleanup);
  }
  window.addEventListener("afterprint", cleanup);
  window.print();
}

export function PrintButton({
  className,
  children,
  productionPack = false,
}: {
  className?: string;
  children: React.ReactNode;
  /** When true, hide admin sidebar/layout so only the production pack body prints. */
  productionPack?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => (productionPack ? printProductionPackView() : window.print())}
      className={className}
    >
      {children}
    </button>
  );
}

