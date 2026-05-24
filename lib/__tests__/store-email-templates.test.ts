import { describe, expect, it } from "vitest";

import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_SLUGS,
  mergeEmailTemplateContent,
  renderEmailTemplate,
} from "@/lib/store-email-templates";

describe("renderEmailTemplate", () => {
  it("replaces known placeholders", () => {
    const out = renderEmailTemplate("Hi {{customerName}}, order {{orderNumber}}", {
      customerName: "Alex",
      orderNumber: "SO-1001",
    });
    expect(out).toBe("Hi Alex, order SO-1001");
  });

  it("leaves unknown placeholders empty", () => {
    expect(renderEmailTemplate("{{missing}}", {})).toBe("");
  });
});

describe("mergeEmailTemplateContent", () => {
  it("falls back to defaults for empty fields", () => {
    expect(mergeEmailTemplateContent("order_confirmation", {})).toEqual(
      DEFAULT_EMAIL_TEMPLATES.order_confirmation,
    );
  });

  it("merges partial overrides", () => {
    expect(
      mergeEmailTemplateContent("order_shipped", {
        subject: "Custom subject — {{orderNumber}}",
      }).subject,
    ).toBe("Custom subject — {{orderNumber}}");
  });
});

describe("email template metadata", () => {
  it("defines defaults for every slug", () => {
    for (const slug of EMAIL_TEMPLATE_SLUGS) {
      expect(DEFAULT_EMAIL_TEMPLATES[slug].subject).toMatch(/\S/);
      expect(DEFAULT_EMAIL_TEMPLATES[slug].html).toMatch(/\S/);
    }
  });
});
