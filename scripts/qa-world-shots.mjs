// Stills of chosen places: node scripts/qa-world-shots.mjs <outDir> <x> [x ...]
import { chromium } from "@playwright/test";
import fs from "node:fs";
const [out, ...xs] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.QA_CHANNEL || "msedge", headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 657 } });
await page.goto(process.env.QA_URL || "http://localhost:3000/", { waitUntil: "load" });
await page.waitForFunction(() => window.__world && window.__world.sim.qa.revealed, null, { timeout: 120000 });
await page.waitForTimeout(1100);
for (const x of xs) {
  await page.evaluate((v) => window.__world.goto(v), Number(x));
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}/at-${x}.png` });
}
await browser.close();
