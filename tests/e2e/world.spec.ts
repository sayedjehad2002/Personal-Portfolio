import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type QaWindow = Window & { __sjw?: { W: { ride: { maxS: number } }; top0: number } };

/** Console errors and uncaught exceptions seen on a page. */
function collectErrors(page: Page) {
  const list: string[] = [];
  page.on("pageerror", (e) => list.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") list.push(`console: ${m.text()}`);
  });
  return list;
}

/** Open the world with the QA geometry hook (`?qa` exposes window.__sjw in production). */
async function openWorld(page: Page) {
  await page.goto("/?qa");
  await page.waitForFunction(() => Boolean((window as QaWindow).__sjw));
}

const serious = (violations: { impact?: string | null }[]) => violations.filter((v) => v.impact === "serious" || v.impact === "critical");

test.describe("world mode on a laptop", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("the very first paint is already the world (no loading or dark screen)", async ({ page }) => {
    await page.goto("/", { waitUntil: "commit" });
    // the static opening shot is in the server HTML and shown by CSS alone
    await expect(page.locator('.first-frame img[src*="base-camp"]')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator(".first-frame")).toHaveCSS("display", "block");
  });

  test("opens straight into the world and says how to move", async ({ page }) => {
    const errors = collectErrors(page);
    await openWorld(page);
    await expect(page.locator("[data-world]")).toBeVisible();
    await expect(page.getByText("Scroll to walk")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });

  test("the mouse wheel walks him through the world", async ({ page }) => {
    await openWorld(page);
    await page.mouse.move(683, 400);
    for (let i = 0; i < 24; i++) await page.mouse.wheel(0, 120);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1500);
  });

  test("the end of the journey shows the contact card", async ({ page }) => {
    await openWorld(page);
    const end = await page.evaluate(() => {
      const q = (window as QaWindow).__sjw!;
      return q.top0 + q.W.ride.maxS;
    });
    await page.evaluate((y) => window.scrollTo(0, y), end);
    await expect(page.getByRole("heading", { name: "You reached the top!" })).toBeVisible({ timeout: 10_000 });
    const card = page.locator("[data-world]");
    await expect(card.getByRole("link", { name: /Connect on LinkedIn/ })).toHaveAttribute("href", /linkedin\.com\/in\/sayed-jehad-saeed/);
    await expect(card.getByRole("link", { name: /Download CV/ })).toHaveAttribute("href", "/Sayed-Jehad-Saeed-CV.pdf");
    await expect(card.getByText("sayedjehad2002@gmail.com")).toBeVisible();
  });

  test("Tab reaches the live project links on the whiteboard", async ({ page }) => {
    await openWorld(page);
    const link = page.locator('[data-world] a[href="https://careers.lumofy.ai"]');
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      if (await link.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(link).toBeFocused();
    await expect(link).toBeInViewport({ timeout: 6_000 });
  });

  test("Quick resume opens, holds focus and closes with Escape", async ({ page }) => {
    await openWorld(page);
    await page.getByRole("button", { name: "Quick resume" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Experience" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("no serious accessibility violations", async ({ page }) => {
    await openWorld(page);
    await page.waitForTimeout(1500);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(serious(r.violations)).toEqual([]);
  });
});

test.describe("story mode on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("shows every level, the heritage trail and the contact buttons, with no sideways scroll", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    for (const name of ["Base Camp", "Bahrain", "Discipline Lab", "AI Lab", "The Summit"]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeAttached();
    }
    await expect(page.getByRole("heading", { name: "Bahrain heritage" })).toBeAttached();
    await expect(page.getByRole("link", { name: /Download CV/ }).first()).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test("no serious accessibility violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1000);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(serious(r.violations)).toEqual([]);
  });
});

test("the CV download is a PDF", async ({ request }) => {
  const res = await request.get("/Sayed-Jehad-Saeed-CV.pdf");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
});

test("an unknown page shows the themed 404", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This trail is buried under snow" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to base camp" })).toHaveAttribute("href", "/");
  await expect(page).toHaveTitle(/Off the map/);
});
