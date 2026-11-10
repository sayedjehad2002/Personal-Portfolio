// Records a slow walk through the whole world as a video for sharing (about two minutes).
// Usage: node scripts/record-walkthrough.mjs [outDir]      (QA_URL as in qa-world.mjs; needs ffmpeg on the PATH for the .mp4)
// The recording has no sound: a headless browser does not capture audio.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] || "docs/video";
fs.mkdirSync(out, { recursive: true });
const size = { width: 1280, height: 720 };
const browser = await chromium.launch({ channel: process.env.QA_CHANNEL || "msedge", headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ viewport: size, recordVideo: { dir: out, size } });
const page = await context.newPage();
await page.goto(process.env.QA_URL || "http://localhost:3000/", { waitUntil: "load" });
await page.waitForFunction(() => window.__world && window.__world.sim.qa.revealed, null, { timeout: 120000 });
await page.waitForTimeout(3500); // the loading screen fades, the first screen is read

// one steady glide from the first dune to the top: the scroll does the walking, the world does the rest
const walk = (toX, seconds) =>
  page.evaluate(
    ([x, s]) =>
      new Promise((done) => {
        const w = window.__world;
        const px = x * w.sim.u; // pixels of scroll per unit of the walk
        w.lenis.scrollTo(px, { duration: s, easing: (t) => t, lock: true, force: true, onComplete: done });
        setTimeout(done, s * 1000 + 1500);
      }),
    [toX, seconds],
  );
const end = await page.evaluate(() => window.__world.end);
// slower where there is most to read, a little quicker over the quiet stretches
for (const [x, s] of [[24, 9], [62, 13], [124, 20], [142, 6], [190, 17], [204, 6], [226, 8], [262, 13], [end, 6]]) await walk(x, s);
await page.waitForTimeout(8500); // the dragon wakes, the fire, the fireworks, the hatchling
await walk(end + (await page.evaluate(() => window.__world.epilogue)) + 1, 3);
await page.waitForTimeout(5000); // the final card

const video = page.video();
await context.close();
await browser.close();
const webm = path.join(out, "sayed-jehad-world-walkthrough.webm");
fs.renameSync(await video.path(), webm);
console.log("saved", webm);
try {
  const mp4 = webm.replace(".webm", ".mp4");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", "-movflags", "+faststart", mp4]);
  console.log("saved", mp4);
} catch (e) {
  console.log("ffmpeg not available or failed: the .webm is the recording.", String(e).slice(0, 200));
}
