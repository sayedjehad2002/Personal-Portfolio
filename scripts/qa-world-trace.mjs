// Debug helper: records x, y and whether he is on the ground while he walks from one x to another.
// Usage: node scripts/qa-world-trace.mjs <fromX> <toX>
import { chromium } from "@playwright/test";
const [from, to] = [Number(process.argv[2]), Number(process.argv[3])];
const browser = await chromium.launch({ channel: process.env.QA_CHANNEL || "msedge", headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 657 } });
await page.goto(process.env.QA_URL || "http://localhost:3000/", { waitUntil: "load" });
await page.waitForFunction(() => window.__world && window.__world.stats().frames > 30, null, { timeout: 120000 });
await page.evaluate((x) => window.__world.goto(x), from);
await page.waitForTimeout(6000);
await page.evaluate(() => {
  window.__trace = [];
  const f = () => {
    const s = window.__world.sim;
    window.__trace.push([+s.x.toFixed(2), +s.y.toFixed(2), s.qa.onGround ? 1 : 0, ...(s.qa.dbg || [])]);
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
});
await page.keyboard.down("ArrowRight");
for (let i = 0; i < 300; i++) {
  if ((await page.evaluate(() => window.__world.sim.x)) >= to) break;
  await page.waitForTimeout(30);
}
await page.keyboard.up("ArrowRight");
await page.waitForTimeout(1500);
const t = await page.evaluate(() => window.__trace);
const out = [];
const every = Number(process.argv[4] || 4);
for (let i = 0; i < t.length; i += every) out.push(t[i].join(","));
console.log(out.join(" | "));
await browser.close();
