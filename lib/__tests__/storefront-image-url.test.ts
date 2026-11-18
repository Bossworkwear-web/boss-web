import { describe, expect, it } from "vitest";

import { resolveStorefrontImageUrl, rewritePipanzAdminImageUrl } from "@/lib/storefront-image-url";

describe("rewritePipanzAdminImageUrl", () => {
  it("points Bisley admin hotlinks at the public PIP asset blob", () => {
    expect(rewritePipanzAdminImageUrl("https://myadmin.pipanz.com/images/D/BK6440_TT05_1.jpg")).toBe(
      "https://pipanz.blob.core.windows.net/assets/images/D/BK6440_TT05_1.jpg",
    );
    expect(
      resolveStorefrontImageUrl("http://myadmin.pipanz.com/images/D/BJ6976_BBLK_1.jpg"),
    ).toBe("https://pipanz.blob.core.windows.net/assets/images/D/BJ6976_BBLK_1.jpg");
    expect(rewritePipanzAdminImageUrl("https://myadmin.pipanz.com/images/D/BKT078_ BBLK-0.jpg")).toBe(
      "https://pipanz.blob.core.windows.net/assets/images/D/BKT078_%20BBLK-0.jpg",
    );
  });

  it("leaves other image hosts unchanged", () => {
    expect(rewritePipanzAdminImageUrl("https://pipanz.blob.core.windows.net/assets/images/D/a.jpg")).toBe(
      null,
    );
    expect(resolveStorefrontImageUrl("/api/supplier-media/bisley/images/4280.jpg")).toBe(
      "/api/supplier-media/bisley/images/4280.jpg",
    );
  });
});
