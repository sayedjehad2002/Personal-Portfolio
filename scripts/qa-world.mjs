// QA for the world (the dev server must be running, or pass QA_URL=http://localhost:3001/ for a production build): walks the four realms, checks each way of moving,
// takes screenshots and reports frame times per realm.
// Usage: node scripts/qa-world.mjs [outDir] [width] [height]     (QA_CHANNEL=chrome to use Chrome instead of Edge)
import { chromium } from "@playwright/test";
import fs from "node:fs";

const out = process.argv[2] || "test-results/world";
const width = Number(process.argv[3] || 1366);
const height = Number(process.argv[4] || 657);
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.QA_CHANNEL || "msedge", headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] });
// a narrow viewport runs as a phone: touch, mobile layout
const phone = width < 700;
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: phone ? 2 : 1, hasTouch: phone, isMobile: phone });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !/hmr|WebSocket/i.test(m.text()) && errors.push(m.text().slice(0, 300)));

await page.goto(process.env.QA_URL || "http://localhost:3000/", { waitUntil: "load" });
await page.waitForFunction(() => window.__world && window.__world.stats().frames > 30 && window.__world.sim.qa.revealed, null, { timeout: 120000 });
const gpu = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  const e = gl && gl.getExtension("WEBGL_debug_renderer_info");
  return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "unknown";
});
const state = () => page.evaluate(() => ({ x: +window.__world.sim.x.toFixed(2), y: +window.__world.sim.y.toFixed(2), ...window.__world.sim.qa }));
const cards = {};
const shot = async (name) => {
  cards[name] = (await page.evaluate(() => window.__world.sim.qa.boards)).join("+") || "-";
  await page.screenshot({ path: `${out}/${name}.png` });
};
const sleep = (ms) => page.waitForTimeout(ms);
const goto = async (x, realm) => {
  await page.evaluate((x) => window.__world.goto(x), x);
  if (realm) await page.waitForFunction((r) => window.__world.sim.qa.loaded.includes(r), realm, { timeout: 120000 });
  await sleep(1500);
};
/** hold → until he reaches x; returns the highest and lowest he got and the ways he moved */
const walkTo = async (x, fast = false) => {
  const seen = { maxY: -99, minY: 99, modes: new Set() };
  if (fast) await page.keyboard.down("Shift");
  await page.keyboard.down("ArrowRight");
  for (let i = 0; i < 900; i++) {
    const s = await state();
    seen.maxY = Math.max(seen.maxY, s.y);
    seen.minY = Math.min(seen.minY, s.y);
    seen.modes.add(s.mode);
    if (s.x >= x) break;
    await sleep(40);
  }
  await page.keyboard.up("ArrowRight");
  if (fast) await page.keyboard.up("Shift");
  await sleep(900);
  return { maxY: seen.maxY, minY: seen.minY, modes: [...seen.modes] };
};
const frames = async (to) => {
  await page.evaluate(() => window.__world.reset());
  await walkTo(to, true);
  return page.evaluate(() => window.__world.stats());
};

const r = { gpu, viewport: `${width}x${height}`, phone, errors };
// how long the loading screen was up, then let it fade away
r.loadMs = Math.round(await page.evaluate(() => performance.now()));
await sleep(1100);
r.loaderGone = await page.evaluate(() => !document.querySelector("[data-loader]"));
// turn the sound on (off by default) so the audio graph runs during the walk
await page.getByRole("button", { name: "Sound" }).click();
await sleep(400);
r.audioState = await page.evaluate(() => window.__world.audio());
await shot("01-desert-start");
r.start = await state();

// Desert: the wheel walks him, ↑ jumps, he hops up the stone steps
if (!phone) {
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.wheel(0, 500);
  await sleep(1200);
}
r.afterWheel = (await state()).x;
await page.keyboard.press("ArrowUp");
let top = 0;
for (let i = 0; i < 24; i++) {
  top = Math.max(top, (await state()).y);
  await sleep(40);
}
r.jumpHeight = top;
await walkTo(12);
await shot("02-desert-board-camel");
await goto(22.5);
r.steps = await walkTo(33);
await goto(44);
await shot("03-desert-heritage");
r.frames = { desert: await frames(58) };
await shot("04-desert-shore");

// Aqua: down the beach, swimming over the sea bed, up to the ice
await goto(62.5, "aqua");
r.beach = await walkTo(72);
await shot("05-aqua-diving");
await goto(84);
await shot("06-aqua-reef");
await page.keyboard.press("ArrowUp");
let kick = -99;
const base = (await state()).y;
for (let i = 0; i < 20; i++) {
  kick = Math.max(kick, (await state()).y);
  await sleep(40);
}
r.swimKick = +(kick - base).toFixed(2);
r.frames.aqua = await frames(112);
await shot("07-aqua-timeline");
await goto(116, "snow");
r.surfacing = await walkTo(127);
await shot("08-snow-out-of-the-ice");

// Snow: skating, the cabin, the AI Lab, the cable car
r.skate = await walkTo(136);
await shot("09-snow-skating");
await goto(148);
await shot("10-snow-discipline-lab");
r.frames.snow = await frames(182);
await shot("11-snow-ai-lab");
await goto(189.5, "magma");
r.ride = await walkTo(197.2);
await shot("12-cable-car");
await walkTo(206);

// Magma: certificates, then the climb over the dragon to the nest and the top
await shot("13-magma-start");
await goto(213);
await shot("14-magma-certificates");
r.frames.magma = await frames(232);
await shot("15-dragon-tail");
r.climb = await walkTo(250);
await shot("16-on-the-dragon");
r.neck = await walkTo(262.5);
await shot("17-dragon-head");
r.nest = await walkTo(268.5);
await shot("18-egg-nest");
r.top = await walkTo(273.4);
await sleep(1500);
await shot("19-the-top");
r.end = await state();
r.sounds = await page.evaluate(() => ({ ...window.__world.sim.qa.sounds }));
r.audioStateEnd = await page.evaluate(() => window.__world.audio());

// the last stretch of scroll pulls the camera back over the whole walk
await page.evaluate(() => window.__world.goto(window.__world.end + window.__world.epilogue + 2));
await sleep(3500);
await shot("20-the-whole-walk");
r.overview = await page.evaluate(() => +window.__world.sim.qa.overview.toFixed(2));

// standing still near the start he waves
await goto(6);
await sleep(2600);
await shot("21-standing-wave");

// Tab reaches a card that is far away: the world travels there
await page.evaluate(() => document.querySelector('article[data-x] a[href^="mailto"], article[data-x] a[href*="linkedin"]')?.focus());
await sleep(4500);
r.tabTravel = { x: (await state()).x, boards: (await state()).boards };
await shot("22-tab-to-contact");

// Quick resume and Pause animations
await page.getByRole("button", { name: "Quick resume" }).click();
await sleep(500);
r.quickResume = await page.evaluate(() => !!document.querySelector("dialog[open]"));
await shot("23-quick-resume");
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Pause animations" }).click();
await sleep(300);
r.calm = await page.evaluate(() => window.__world.sim.calm);
r.quality = await page.evaluate(() => window.__world.sim.qa.quality);

r.cards = cards;
console.log(JSON.stringify(r, null, 1));
await browser.close();
