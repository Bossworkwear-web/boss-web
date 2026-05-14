/**
 * Optional brand / supplier size-chart URLs for the PDP dialog and .txt download.
 * Edit this list when suppliers publish new PDFs or pages — no schema migration required.
 */

export type SupplierSizeChartLink = {
  label: string;
  href: string;
};

function pack(productName: string, storeSlug?: string | null): string {
  return `${productName} ${storeSlug ?? ""}`.toLowerCase();
}

/**
 * Resolve public “official” or brand-catalog size pages from product name and store slug.
 * Uses https where the host supports it.
 */
export function resolveSupplierSizeChartLinks(
  productName: string,
  storeSlug?: string | null,
): SupplierSizeChartLink[] {
  const blob = pack(productName, storeSlug);
  const slug = String(storeSlug ?? "").toLowerCase();

  if (blob.includes("syzmik") || slug.includes("syzmik")) {
    return [{ label: "Syzmik — size guide", href: "https://www.syzmik.com/size-guide" }];
  }
  if (blob.includes("biz collection") || slug.includes("bizcollection")) {
    return [{ label: "Biz Collection — size guide", href: "https://www.bizcollection.com.au/size-guide" }];
  }
  if (blob.includes("biz care") || slug.includes("bizcare")) {
    return [
      {
        label: "Biz Collection — size guide (Biz Care / healthcare fits)",
        href: "https://www.bizcollection.com.au/size-guide",
      },
    ];
  }
  if (blob.includes("yes chef") || slug.includes("yeschef")) {
    return [
      {
        label: "Biz Collection — size guide (hospitality / aprons)",
        href: "https://www.bizcollection.com.au/size-guide",
      },
    ];
  }

  return [];
}

export function appendSupplierLinksToPlainText(
  body: string,
  links: SupplierSizeChartLink[],
): string {
  if (!links.length) {
    return body;
  }
  const lines = links.map((l) => `${l.label}\n${l.href}`);
  return `${body.trim()}\n\n---\nSupplier size charts (open in browser)\n\n${lines.join("\n\n")}\n`;
}
