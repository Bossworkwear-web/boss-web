/** PDP description body for DNC rows when CSV has no supplier marketing copy. */
export function buildDncProductDescription(params: {
  productName: string;
  styleCode?: string | null;
  category?: string | null;
  colors?: readonly string[];
  sizes?: readonly string[];
  hasDiscontinuedVariants?: boolean;
}): string {
  const lines: string[] = [];
  const intro = String(params.productName ?? "").trim();
  if (intro) {
    lines.push(intro);
  }

  const colourList = (params.colors ?? []).map((c) => String(c).trim()).filter(Boolean);
  if (colourList.length === 1) {
    lines.push(`Colour: ${colourList[0]}`);
  } else if (colourList.length > 1) {
    lines.push(`Colours: ${colourList.join(", ")}`);
  }

  const sizeList = (params.sizes ?? []).map((s) => String(s).trim()).filter(Boolean);
  if (sizeList.length === 1 && sizeList[0] === "One Size") {
    lines.push("Size: One Size");
  } else if (sizeList.length > 0) {
    lines.push(`Sizes: ${sizeList.join(", ")}`);
  }

  const cat = String(params.category ?? "").trim();
  if (cat) {
    lines.push(`Category: ${cat}`);
  }

  const code = String(params.styleCode ?? "").trim();
  if (code) {
    lines.push(`Style code: ${code}`);
  }

  if (params.hasDiscontinuedVariants) {
    lines.push("Note: Some colour/size options are discontinued at the supplier.");
  }

  return lines.join("\n").trim();
}
