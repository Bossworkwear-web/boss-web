/**
 * Build storefront PDP `products.description` for DNC Workwear from CSV-derived fields.
 * DNC's export has no marketing copy — we compose per-style text from name, colours, and sizes.
 */
export function buildDncProductDescription({
  productName,
  styleCode,
  category,
  colors = [],
  sizes = [],
  hasDiscontinuedVariants = false,
}) {
  const lines = [];
  const intro = String(productName ?? "").trim();
  if (intro) {
    lines.push(intro);
  }

  const colourList = [...colors].map((c) => String(c).trim()).filter(Boolean);
  if (colourList.length === 1) {
    lines.push(`Colour: ${colourList[0]}`);
  } else if (colourList.length > 1) {
    lines.push(`Colours: ${colourList.join(", ")}`);
  }

  const sizeList = [...sizes].map((s) => String(s).trim()).filter(Boolean);
  if (sizeList.length === 1 && sizeList[0] === "One Size") {
    lines.push("Size: One Size");
  } else if (sizeList.length > 0) {
    lines.push(`Sizes: ${sizeList.join(", ")}`);
  }

  const cat = String(category ?? "").trim();
  if (cat) {
    lines.push(`Category: ${cat}`);
  }

  const code = String(styleCode ?? "").trim();
  if (code) {
    lines.push(`Style code: ${code}`);
  }

  if (hasDiscontinuedVariants) {
    lines.push("Note: Some colour/size options are discontinued at the supplier.");
  }

  return lines.join("\n").trim();
}
