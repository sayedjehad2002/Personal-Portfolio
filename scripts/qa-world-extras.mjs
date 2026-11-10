// The checks around the walk itself: what the server sends before any script runs, reduced motion, a browser
// without WebGL, the 404 page and the dev-only lab. Usage: node scripts/qa-world-extras.mjs   (QA_URL as in qa-world.mjs)
import { chromium } from "@playwright/test";

const url = process.env.QA_URL || "http://localhost:3000/";
const gpu = ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"];
const channel = process.env.QA_CHANNEL || "msedge";
const r = {};

// the server HTML: the opening shot and its preloads are there from the first byte
const html = await (await fetch(url)).text();
r.html = {
  firstFrameImg: html.includes('src="/world/first-frame.jpg"'),
  loadingScreen: html.includes("data-loader") && html.includes("Raising the dunes"),
  phoneSource: html.includes("/world/first-frame-phone.jpg"),
  preload: /rel="preload"[^>]*first-frame\.jpg/.test(html),
  title: (html.match(/<title>([^<]*)<\/title>/) || [])[1],
  ogImage: /property="og:image"/.test(html),
  oldWorld: /scenes\/open|base-camp|ice-themed|winter side-scroller/.test(html),
};
for (const path of ["world/first-frame.jpg", "world/first-frame-phone.jpg", "world/sayed.glb", "world/desert.glb", "draco/draco_decoder.wasm", "Sayed-Jehad-Saeed-CV.pdf", "opengraph-image.jpg", "sayed-avatar.webp"])
  r["GET /" + path] = (await fetch(url + path, { method: "HEAD" })).status;
r["GET /lab/3d"] = (await fetch(url + "lab/3d")).status;
r["GET /v2"] = (await fetch(url + "v2")).status;
const nf = await fetch(url + "nowhere");
r["GET /nowhere"] = { status: nf.status, themed: (await nf.text()).includes("Off the map") };

// reduced motion: the world still walks, the ambient loops are stopped
{
  const browser = await chromium.launch({ channel, headless: true, args: gpu });
  const page = await browser.newPage({ viewport: { width: 1366, height: 657 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => window.__world && window.__world.stats().frames > 30 && window.__world.sim.qa.revealed, null, { timeout: 120000 });
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(2500);
  await page.keyboard.up("ArrowRight");
  await page.waitForTimeout(600);
  r.reducedMotion = await page.evaluate(() => ({ calm: window.__world.sim.calm, x: +window.__world.sim.x.toFixed(1), loaderGone: !document.querySelector("[data-loader]") }));
  r.reducedMotion.errors = errors;
  await browser.close();
}

// the loading screen: hold the realm models back so it can be seen part-way, then check it goes when they land
for (const [name, w, h, phone] of [["loader", 1366, 657, false], ["loader-phone", 390, 844, true]]) {
  const browser = await chromium.launch({ channel, headless: true, args: gpu });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: phone ? 2 : 1, hasTouch: phone, isMobile: phone });
  const wait = { desert: 300, aqua: 900, snow: 4200, magma: 4800 };
  await page.route("**/world/*.glb", async (route) => {
    const id = route.request().url().match(/world\/(\w+)\.glb/)[1];
    await new Promise((res) => setTimeout(res, wait[id] ?? 0));
    route.continue();
  });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(2600);
  const mid = await page.evaluate(() => ({
    shown: !!document.querySelector("[data-loader]"),
    text: document.querySelector("[data-loader] [role=status]")?.textContent,
    progress: window.__world ? +window.__world.sim.qa.progress.toFixed(2) : null,
    scrollLocked: getComputedStyle(document.documentElement).overflow,
  }));
  await page.screenshot({ path: `test-results/world/${name}.png` });
  await page.waitForFunction(() => window.__world && window.__world.sim.qa.revealed, null, { timeout: 120000 });
  await page.waitForTimeout(1200);
  r[name] = { mid, after: await page.evaluate(() => ({ gone: !document.querySelector("[data-loader]"), scrollLocked: getComputedStyle(document.documentElement).overflow, loaded: window.__world.sim.qa.loaded.length })) };
  await browser.close();
}

// no WebGL: the resume as text over the opening shot
{
  const browser = await chromium.launch({ channel, headless: true, args: ["--disable-3d-apis"] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 657 } });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  r.noWebGL = await page.evaluate(() => ({
    notice: document.body.innerText.includes("cannot draw the 3D world"),
    headings: [...document.querySelectorAll("h2, h3")].length,
    canvas: !!document.querySelector("canvas"),
    cv: !!document.querySelector('a[href$=".pdf"]'),
  }));
  await page.screenshot({ path: "test-results/world/no-webgl.png" });
  await browser.close();
}

console.log(JSON.stringify(r, null, 1));
