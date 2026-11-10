// Makes the static opening shots the page shows before the 3D world has loaded (the dev server must be running):
//   public/world/first-frame.jpg (wide screens) and first-frame-phone.jpg, plus the share image src/app/opengraph-image.jpg.
// Usage: node scripts/first-frame.mjs
import { chromium } from "@playwright/test";
import sharp from "sharp";

const url = process.env.QA_URL || "http://localhost:3000/";
const browser = await chromium.launch({ channel: process.env.QA_CHANNEL || "msedge", headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] });

async function open(width, height, scale, phone) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale, hasTouch: phone, isMobile: phone });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => window.__world && window.__world.stats().frames > 60 && window.__world.sim.qa.loaded.includes("desert"), null, { timeout: 120000 });
  return page;
}
// only the sky and the 3D picture: the HUD, the cards and the titles are drawn by the page over the shot
const bare = (page) => page.addStyleTag({ content: "nextjs-portal, header, h2, article, picture, [data-fps], div:has(> .flex > .wheel-hint) { visibility: hidden !important; }" });

for (const [name, w, h, scale, phone] of [
  ["first-frame", 1600, 900, 1, false],
  ["first-frame-phone", 390, 844, 2, true],
]) {
  const page = await open(w, h, scale, phone);
  await bare(page);
  await page.waitForTimeout(1500);
  await sharp(await page.screenshot({ type: "png" })).jpeg({ quality: 72, mozjpeg: true }).toFile(`public/world/${name}.jpg`);
  console.log(name, "done");
  await page.close();
}

// the share image: the last shot, the whole walk with the four realms named
const page = await open(1200, 630, 1, false);
for (const realm of ["aqua", "snow", "magma"]) await page.waitForFunction((r) => window.__world.sim.qa.loaded.includes(r), realm, { timeout: 120000 });
await page.evaluate(() => window.__world.goto(window.__world.end + window.__world.epilogue + 2));
await page.waitForTimeout(4000);
await page.addStyleTag({ content: "nextjs-portal, header, article, picture, [data-fps] { visibility: hidden !important; }" });
// the name over the sky, in the page's own fonts
await page.evaluate(() => {
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;left:0;right:0;top:13%;z-index:99;text-align:center;color:#fff";
  d.innerHTML =
    '<div style="font-family:var(--font-display);font-size:96px;line-height:1;text-shadow:0 5px 0 #B9772F,0 14px 30px rgba(0,0,0,.35)">Sayed Jehad World</div>' +
    '<div style="font-family:var(--font-body);font-weight:800;font-size:30px;margin-top:22px;text-shadow:0 2px 10px rgba(0,0,0,.55)">Sayed Jehad Saeed · AI System Developer · Interactive resume</div>';
  document.body.appendChild(d);
});
await page.waitForTimeout(600);
await sharp(await page.screenshot({ type: "png" })).jpeg({ quality: 82, mozjpeg: true }).toFile("src/app/opengraph-image.jpg");
console.log("opengraph-image done");
await browser.close();
