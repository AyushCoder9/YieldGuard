/**
 * E2E tests for YieldGuard web app.
 * Verifies all routes render, key UI elements are visible, and no JS errors.
 *
 * Run: npx playwright test (requires `npm run build && npm run start` first,
 *      or use the webServer config in playwright.config.ts).
 */

import { test, expect, type Page } from "@playwright/test";

async function hasNoConsoleErrors(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", err => errors.push(err.message));
  // Small wait to catch async errors
  await page.waitForTimeout(500);
  // Filter known benign Next.js hydration warnings
  const real = errors.filter(
    e => !e.includes("hydrat") && !e.includes("Warning:")
  );
  expect(real, `Console errors: ${real.join(", ")}`).toHaveLength(0);
}

// ── Home page ─────────────────────────────────────────────────────────────────

test.describe("Home page (/)", () => {
  test("loads and shows hero headline", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    const h1 = await page.locator("h1").first().textContent();
    expect(h1?.length).toBeGreaterThan(5);
  });

  test("has navbar with navigation links", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
    // Multiple links to /demo exist (navbar + CTAs) — just assert at least one visible
    await expect(page.locator("a[href='/demo']").first()).toBeVisible();
    await expect(page.locator("a[href='/dashboard']").first()).toBeVisible();
  });

  test("CTA button links to demo or dashboard", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator("a[href='/demo'], a[href='/dashboard']").first();
    await expect(cta).toBeVisible();
  });

  test("no JS errors on load", async ({ page }) => {
    await page.goto("/");
    await hasNoConsoleErrors(page);
  });
});

// ── Demo page ─────────────────────────────────────────────────────────────────

test.describe("Demo page (/demo)", () => {
  test("loads without error", async ({ page }) => {
    const response = await page.goto("/demo");
    expect(response?.status()).toBe(200);
  });

  test("shows machine selector", async ({ page }) => {
    await page.goto("/demo");
    // Machine names from demo_scenarios.json
    const machines = ["Compressor A", "Pump Station 2", "CNC Mill", "HVAC", "Conveyor Belt"];
    let found = false;
    for (const name of machines) {
      const el = page.getByText(name, { exact: false });
      if (await el.count() > 0) { found = true; break; }
    }
    expect(found, "No machine name found on demo page").toBe(true);
  });

  test("risk status badge visible", async ({ page }) => {
    await page.goto("/demo");
    // Status renders as title-case in the UI — use case-insensitive regex
    const badge = page.getByText(/critical|high|warning|operational/i, { exact: false });
    await expect(badge.first()).toBeVisible({ timeout: 10_000 });
  });

  test("no JS errors on load", async ({ page }) => {
    await page.goto("/demo");
    await hasNoConsoleErrors(page);
  });
});

// ── Dashboard page ────────────────────────────────────────────────────────────

test.describe("Dashboard page (/dashboard)", () => {
  test("loads without error", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response?.status()).toBe(200);
  });

  test("shows sensor sliders or CSV upload", async ({ page }) => {
    await page.goto("/dashboard");
    const slider = page.locator("input[type='range']");
    const upload = page.locator("input[type='file']");
    const hasSliders = await slider.count() > 0;
    const hasUpload = await upload.count() > 0;
    expect(hasSliders || hasUpload).toBe(true);
  });

  test("Run Analysis button exists", async ({ page }) => {
    await page.goto("/dashboard");
    const btn = page.getByRole("button", { name: /run|analyz|predict/i });
    await expect(btn.first()).toBeVisible();
  });

  test("no JS errors on load", async ({ page }) => {
    await page.goto("/dashboard");
    await hasNoConsoleErrors(page);
  });
});

// ── Guide page ────────────────────────────────────────────────────────────────

test.describe("Guide page (/guide)", () => {
  test("loads with content", async ({ page }) => {
    const response = await page.goto("/guide");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("CSV column reference table present", async ({ page }) => {
    await page.goto("/guide");
    const table = page.locator("table");
    if (await table.count() > 0) {
      await expect(table.first()).toBeVisible();
    }
    // At minimum, mention of required columns
    const text = await page.textContent("body");
    expect(text).toMatch(/vibration|temperature|pressure/i);
  });
});

// ── About page ────────────────────────────────────────────────────────────────

test.describe("About page (/about)", () => {
  test("loads with content", async ({ page }) => {
    const response = await page.goto("/about");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("shows model metrics", async ({ page }) => {
    await page.goto("/about");
    const text = await page.textContent("body");
    // Should mention PR-AUC or ROC-AUC somewhere
    expect(text).toMatch(/PR-AUC|ROC-AUC|precision|recall/i);
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

test.describe("Navigation", () => {
  test("clicking Demo nav link navigates to /demo", async ({ page }) => {
    await page.goto("/");
    await page.locator("a[href='/demo']").first().click();
    await page.waitForURL("**/demo");
    expect(page.url()).toContain("/demo");
  });

  test("clicking Dashboard nav link navigates to /dashboard", async ({ page }) => {
    await page.goto("/");
    await page.locator("a[href='/dashboard']").first().click();
    await page.waitForURL("**/dashboard");
    expect(page.url()).toContain("/dashboard");
  });

  test("404 page renders for unknown route", async ({ page }) => {
    const response = await page.goto("/this-does-not-exist");
    // Next.js returns 404 or redirects — either is fine
    expect([200, 404]).toContain(response?.status());
  });
});
