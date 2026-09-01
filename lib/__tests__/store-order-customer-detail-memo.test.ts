import { describe, expect, it } from "vitest";

import {
  checkoutMemoServiceForLine,
  checkoutMemoServicesForNotes,
  parseCheckoutMemoPlacementServices,
  resolveCheckoutMemoLineService,
  stripCheckoutMemoLastLine,
  withCheckoutMemoColorAfterModel,
  withCheckoutMemoProductName,
  withCheckoutMemoSize,
} from "@/lib/store-order-customer-detail";

describe("withCheckoutMemoSize", () => {
  it("appends size to the first line (model / colour)", () => {
    const notes = [
      "TT04 - Yellow/Navy",
      "LC - Frenken Group logo black/orange",
      "RC - LUKE",
      "[Embroidery logo setup: Use my saved embroidery logo ($0)]",
    ].join("\n");
    expect(withCheckoutMemoSize(notes, "L")).toBe(
      [
        "TT04 - Yellow/Navy / L",
        "LC - Frenken Group logo black/orange",
        "RC - LUKE",
        "[Embroidery logo setup: Use my saved embroidery logo ($0)]",
      ].join("\n"),
    );
  });

  it("does not duplicate when size is already on the first line", () => {
    const notes = "TT04 - Yellow/Navy / XL\nRC - ANDREW";
    expect(withCheckoutMemoSize(notes, "XL")).toBe(notes);
  });

  it("returns notes unchanged when size is empty", () => {
    expect(withCheckoutMemoSize("TT04 - Yellow/Navy\nRC - JASON", "  ")).toBe(
      "TT04 - Yellow/Navy\nRC - JASON",
    );
  });
});

describe("withCheckoutMemoProductName", () => {
  it("prepends the product name above the memo body", () => {
    const notes = ["TT04 - Yellow/Navy / L", "RC - LUKE"].join("\n");
    expect(withCheckoutMemoProductName(notes, "Hi-Vis Short Sleeve")).toBe(
      ["Hi-Vis Short Sleeve", "TT04 - Yellow/Navy / L", "RC - LUKE"].join("\n"),
    );
  });

  it("does not duplicate when the memo already starts with the product name", () => {
    const notes = ["Hi-Vis Short Sleeve", "TT04 - Yellow/Navy / L"].join("\n");
    expect(withCheckoutMemoProductName(notes, "Hi-Vis Short Sleeve")).toBe(notes);
  });
});

describe("stripCheckoutMemoLastLine", () => {
  it("removes the trailing embroidery logo-setup line", () => {
    const notes = [
      "TT04 - Yellow/Navy",
      "LC - Frenken Group logo black/orange",
      "RC - LUKE",
      "[Embroidery logo setup: Use my saved embroidery logo ($0)]",
    ].join("\n");
    expect(stripCheckoutMemoLastLine(notes)).toBe(
      ["TT04 - Yellow/Navy", "LC - Frenken Group logo black/orange", "RC - LUKE"].join("\n"),
    );
  });

  it("keeps customer text above the last line", () => {
    const notes = [
      "TT04 - Yellow/Navy",
      "Please see email from last order",
      "[Embroidery logo setup: Use my saved embroidery logo ($0)]",
    ].join("\n");
    expect(stripCheckoutMemoLastLine(notes)).toBe(
      ["TT04 - Yellow/Navy", "Please see email from last order"].join("\n"),
    );
  });
});

describe("withCheckoutMemoColorAfterModel", () => {
  it("keeps colour after the model name", () => {
    expect(withCheckoutMemoColorAfterModel("TT04 - Yellow/Navy\nRC - LUKE", "Yellow/Navy")).toBe(
      "TT04 - Yellow/Navy\nRC - LUKE",
    );
  });

  it("moves colour that was written before the model name", () => {
    expect(withCheckoutMemoColorAfterModel("Yellow/Navy - TT04\nLC - logo", "Yellow/Navy")).toBe(
      "TT04 - Yellow/Navy\nLC - logo",
    );
  });

  it("appends colour when the model line has no colour yet", () => {
    expect(withCheckoutMemoColorAfterModel("TT04\nRC - LUKE", "Yellow/Navy")).toBe(
      "TT04 - Yellow/Navy\nRC - LUKE",
    );
  });

  it("prepends model + colour when notes start with placement lines only", () => {
    const notes = [
      "LC - Frenken Group logo white/orange",
      "BU - Frenken Group logo white/orange",
    ].join("\n");
    expect(
      withCheckoutMemoColorAfterModel(notes, "Black/Orange", "JB's 350 Trade Hoodie (6CFH)"),
    ).toBe(["6CFH - Black/Orange", "LC - Frenken Group logo white/orange", "BU - Frenken Group logo white/orange"].join("\n"));
  });
});

describe("checkout memo placement services", () => {
  it("parses Embroidery/Printing placement strings into short codes", () => {
    expect(
      parseCheckoutMemoPlacementServices([
        "Embroidery: Left Chest",
        "Printing: Right Chest",
        "Embroidery: Back Upper",
      ]),
    ).toEqual([
      { code: "LC", service: "Embroidery" },
      { code: "RC", service: "Printing" },
      { code: "BU", service: "Embroidery" },
    ]);
  });

  it("resolves singular line service and attaches it beside logo lines", () => {
    expect(resolveCheckoutMemoLineService("Embroidery")).toBe("Embroidery");
    expect(resolveCheckoutMemoLineService("Embroidery + Printing")).toBe(null);
    expect(
      checkoutMemoServiceForLine(
        "LC - Frenken Group logo black/orange",
        [{ code: "LC", service: "Embroidery" }],
        null,
      ),
    ).toBe("Embroidery");
    expect(checkoutMemoServiceForLine("RC - LUKE", [], "Embroidery")).toBe("Embroidery");
    expect(checkoutMemoServiceForLine("TT04 - Yellow/Navy / L", [], "Embroidery")).toBe(null);
  });

  it("maps leftover memo codes to leftover placements (BU note vs Back Middle checkout)", () => {
    const placements = parseCheckoutMemoPlacementServices([
      "Embroidery: Left chest",
      "Printing: Back Middle",
    ]);
    expect(placements).toEqual([
      { code: "LC", service: "Embroidery" },
      { code: "BM", service: "Printing" },
    ]);
    const notes = [
      "LC - Frenken Group logo white/orange",
      "BU - Frenken Group logo white/orange",
      "",
      "Please see email from last order",
    ].join("\n");
    expect(checkoutMemoServicesForNotes(notes, placements, null)).toEqual([
      "Embroidery",
      "Printing",
      null,
      null,
    ]);
  });
});
