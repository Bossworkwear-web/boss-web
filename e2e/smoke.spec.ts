import { expect, test } from "@playwright/test";

import { DEFAULT_HOMEPAGE_HERO } from "../lib/site-content";

const LEGAL_PAGES = [
  { path: "/terms-and-conditions", heading: "Terms & Conditions" },
  { path: "/privacy-policy", heading: "Privacy Policy" },
  { path: "/shipping-policy", heading: "Shipping Policy" },
  { path: "/returns-policy", heading: "Returns Policy" },
] as const;

test.describe("storefront smoke", () => {
  test("home page shows default hero copy", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(DEFAULT_HOMEPAGE_HERO.line1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(DEFAULT_HOMEPAGE_HERO.line2);
    await expect(page.getByText(DEFAULT_HOMEPAGE_HERO.subtext)).toBeVisible();
  });

  for (const legal of LEGAL_PAGES) {
    test(`${legal.path} renders built-in heading`, async ({ page }) => {
      await page.goto(legal.path);

      await expect(page.getByRole("heading", { level: 1, name: legal.heading })).toBeVisible();
    });
  }
});

test.describe("admin smoke", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/admin/login");

    await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in to dashboard/i })).toBeVisible();
  });

  test("protected admin route redirects to login", async ({ page }) => {
    await page.goto("/admin/site/legal");

    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
  });
});
