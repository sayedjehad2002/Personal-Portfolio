// HUD jumps: click each realm chip from far away and check he lands on the ground there, the realm is drawn and no
// section title is left standing from the place he came from. Usage: node scripts/qa-world-jumps.mjs [outDir]
import { chromium } from "@playwright/test";
import fs from "node:fs";

const out = process.argv[2] || "test-results/world";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.QA_CHANNEL || "msedge", headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 969 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
await page.goto(process.env.QA_URL || "http://localhost:3000/", { waitUntil: "load" });
await page.waitForFunction(() => window.__world && window.__world.stats().frames > 30 && window.__world.sim.qa.loaded.includes("desert"), null, { timeout: 120000 });

const r = { errors };
// walk a little into the Aqua realm first, so its title is on screen when the jump happens
await page.evaluate(() => window.__world.goto(70));
await page.waitForTimeout(1500);
for (const realm of ["Magma", "Desert", "Snow", "Aqua"]) {
  await page.getByRole("button", { name: realm, exact: true }).click();
  await page.waitForFunction((id) => window.__world.sim.qa.loaded.includes(id), realm.toLowerCase(), { timeout: 120000 });
  await page.waitForTimeout(3500);
  r[realm] = await page.evaluate(() => {
    const vw = window.innerWidth;
    const q = window.__world.sim.qa;
    return {
      x: +window.__world.sim.x.toFixed(1),
      y: +window.__world.sim.y.toFixed(2),
      onGround: q.onGround,
      chip: document.querySelector('nav[aria-label="Realms"] [aria-current]')?.textContent,
      titlesOnScreen: [...document.querySelectorAll("h2")].filter((h) => { const b = h.getBoundingClientRect(); return b.right > 0 && b.left < vw; }).map((h) => h.textContent),
    };
  });
  await page.screenshot({ path: `${out}/jump-${realm.toLowerCase()}.png` });
}
console.log(JSON.stringify(r, null, 1));
await browser.close();
