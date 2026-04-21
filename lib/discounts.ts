/**
 * Returns discount percent (0–100) for a product based on its name.
 * Used on both category listing and product detail page.
 */
export function getDiscountPercent(productName: string): number {
  const n = productName.toLowerCase();
  if (productName === "Demo Crew Tee") return 15;
  if (n.includes("polos 02") || n.includes("polo 02")) return 15;
  return 0;
}
