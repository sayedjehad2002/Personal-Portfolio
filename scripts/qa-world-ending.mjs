// The ending: jump to the nest, walk to the top, watch the dragon wake, then scroll on into the last shot.
// Usage: node scripts/qa-world-ending.mjs [outDir] [width] [height]
import { chromium } from "@playwright/test";
import fs from "node:fs";

const out = process.argv[2] || "test-results/world";
const width = Number(process.argv[3] || 1366);
const height = Number(process.argv[4] || 657);
fs.mkdirSync(out, { recursive: true });
const phone = width < 700;
const browser = await chromium.launch({ channel: process.env.QA_CHANNEL || "msedge", headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: phone ? 2 : 1, hasTouch: phone, isMobile: phone });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
await page.goto(process.env.QA_URL || "http://localhost:3000/", { waitUntil: "load" });
await page.waitForFunction(() => window.__world && window.__world.stats().frames > 30 && window.__world.sim.qa.revealed, null, { timeout: 120000 });
await page.waitForTimeout(1100);
const r = { errors, viewport: `${width}x${height}` };

// the HUD's Contact button goes straight to the nest
await page.getByRole("button", { name: "Contact" }).click();
await page.waitForTimeout(3500);
r.contact = await page.evaluate(() => ({ x: +window.__world.sim.x.toFixed(1), boards: window.__world.sim.qa.boards }));
await page.screenshot({ path: `${out}/e1-nest.png` });

// walk to the very top: the flag goes in and the dragon wakes
await page.keyboard.down("ArrowRight");
await page.waitForFunction(() => window.__world.sim.x >= 273.4, null, { timeout: 30000 });
await page.keyboard.up("ArrowRight");
for (const [name, ms] of [["e2-eye-opens", 900], ["e3-head-up", 1100], ["e4-fire", 900], ["e5-fireworks", 1400]]) {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: `${out}/${name}.png` });
}
r.sounds = await page.evaluate(() => ({ roar: window.__world.sim.qa.sounds.roar ?? 0, fanfare: window.__world.sim.qa.sounds.fanfare ?? 0, firework: window.__world.sim.qa.sounds.firework ?? 0 }));

// the last shot, part-way and at the end
const total = await page.evaluate(() => window.__world.end + window.__world.epilogue);
for (const [name, k] of [["e6-pulling-back", 0.45], ["e7-last-shot", 1.02]]) {
  await page.evaluate((x) => window.__world.goto(x), (await page.evaluate(() => window.__world.end)) + (total - (await page.evaluate(() => window.__world.end))) * k);
  await page.waitForTimeout(3200);
  await page.screenshot({ path: `${out}/${name}.png` });
}
r.final = await page.evaluate(() => {
  const el = document.querySelector("section.final-card");
  return { opacity: el && getComputedStyle(el).opacity, numbers: [...el.querySelectorAll("dd")].map((d) => d.textContent), links: [...el.querySelectorAll("a")].map((a) => a.textContent.trim()), overview: +window.__world.sim.qa.overview.toFixed(2) };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
