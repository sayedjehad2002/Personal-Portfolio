// Frame times for one stretch of the world: node scripts/qa-world-frames.mjs <fromX> <toX> [repeats]
import { chromium } from "@playwright/test";
const [from, to, reps] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4] || 3)];
const browser = await chromium.launch({ channel: process.env.QA_CHANNEL || "msedge", headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 657 } });
await page.goto(process.env.QA_URL || "http://localhost:3000/", { waitUntil: "load" });
await page.waitForFunction(() => window.__world && window.__world.stats().frames > 30, null, { timeout: 120000 });
const out = [];
for (let i = 0; i < reps; i++) {
  await page.evaluate((x) => window.__world.goto(x), from);
  await page.waitForTimeout(i ? 1500 : 7000);
  await page.evaluate(() => window.__world.reset());
  await page.keyboard.down("Shift");
  await page.keyboard.down("ArrowRight");
  for (let k = 0; k < 400; k++) {
    if ((await page.evaluate(() => window.__world.sim.x)) >= to) break;
    await page.waitForTimeout(40);
  }
  await page.keyboard.up("ArrowRight");
  await page.keyboard.up("Shift");
  out.push(await page.evaluate(() => window.__world.stats()));
}
console.log(JSON.stringify(out));
await browser.close();
