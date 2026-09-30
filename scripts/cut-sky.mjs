// Cut the painted sky (and the free-floating clouds / sparkles) out of Sayed's outdoor scene paintings,
// so the world's one continuous sky, clouds and far mountains show behind every scene.
// usage (from the project root): node scripts/cut-sky.mjs   → writes public/scenes/open/*.webp
import { createRequire } from "node:module";
const sharp = createRequire(import.meta.url)("sharp");
import fs from "node:fs";

const out = process.argv[2] ?? "public/scenes/open";
fs.mkdirSync(out, { recursive: true });
const SRC = "public/scenes/";

// limit: lowest row (fraction of height) the sky flood may reach (keeps lakes / the frozen sea painted)
const JOBS = [
  // the painted start sign goes too: the world draws it as crisp vector art (world/StartSign.tsx) in its place
  { name: "base-camp", limit: 0.765, T: 30, pocket: false, erase: "scripts/start-sign-erase.json" },
  { name: "bahrain", limit: 0.745, T: 14, pocket: true, blades: [[1075, 360, 44], [1075, 461, 44], [1075, 556, 36]] },
  { name: "summit", limit: 0.97, T: 30, pocket: true, patches: [[800, 370, 915, 520]] },
];

const dist = (r, g, b, s) => Math.sqrt((r - s[0]) ** 2 + (g - s[1]) ** 2 + (b - s[2]) ** 2);
const median = (a) => {
  a.sort((x, y) => x - y);
  return a[a.length >> 1];
};

for (const job of JOBS) {
  const { data, info } = await sharp(SRC + job.name + ".webp").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const px = (x, y) => (y * W + x) * 4;

  // 1. the sky colour of every row (a smooth vertical gradient): median of the pixels close to the row above's colour
  const sky = new Array(H);
  {
    const r = [], g = [], b = [];
    for (let x = 0; x < W; x++) {
      const i = px(x, 0);
      if (data[i + 2] > data[i] + 40) (r.push(data[i]), g.push(data[i + 1]), b.push(data[i + 2]));
    }
    sky[0] = [median(r), median(g), median(b)];
  }
  for (let y = 1; y < H; y++) {
    const prev = sky[y - 1];
    const r = [], g = [], b = [];
    for (let x = 0; x < W; x++) {
      const i = px(x, y);
      if (dist(data[i], data[i + 1], data[i + 2], prev) < 16) (r.push(data[i]), g.push(data[i + 1]), b.push(data[i + 2]));
    }
    sky[y] = r.length > W * 0.04 ? [median(r), median(g), median(b)] : prev;
  }

  // 2. flood the sky from the top edge (and the upper side edges)
  const T = job.T;
  const isSky = new Uint8Array(W * H);
  const lim = Math.round(H * job.limit);
  const q = new Int32Array(W * H);
  let qh = 0, qt = 0;
  const seed = (x, y) => {
    const k = y * W + x;
    if (isSky[k]) return;
    const i = k * 4;
    if (dist(data[i], data[i + 1], data[i + 2], sky[y]) < T) {
      isSky[k] = 1;
      q[qt++] = k;
    }
  };
  for (let x = 0; x < W; x++) seed(x, 0);
  for (let y = 0; y < lim * 0.6; y++) (seed(0, y), seed(W - 1, y));
  while (qh < qt) {
    const k = q[qh++];
    const x = k % W, y = (k / W) | 0;
    if (x > 0) seed(x - 1, y);
    if (x < W - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < lim - 1) seed(x, y + 1);
  }
  // enclosed pockets of pure sky (between the WTC towers, under the summit sign...)
  for (const [x0, y0, x1, y1] of job.patches ?? [])
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * 4;
        if (data[i + 2] > 230 && data[i] < 100) isSky[y * W + x] = 1;
      }
  if (job.pocket) {
    const seen = new Uint8Array(W * H);
    for (let s = 0; s < W * lim; s++) {
      if (isSky[s] || seen[s]) continue;
      const sy = (s / W) | 0;
      const i0 = s * 4;
      if (dist(data[i0], data[i0 + 1], data[i0 + 2], sky[sy]) >= T * 0.65) continue;
      const list = [s];
      seen[s] = 1;
      for (let h = 0; h < list.length; h++) {
        const k = list[h];
        const x = k % W, y = (k / W) | 0;
        for (const n of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < lim - 1 ? k + W : -1]) {
          if (n < 0 || seen[n] || isSky[n]) continue;
          const j = n * 4;
          if (dist(data[j], data[j + 1], data[j + 2], sky[(n / W) | 0]) < T) (seen[n] = 1, list.push(n));
        }
      }
      if (list.length > 200) for (const k of list) isSky[k] = 1;
    }
  }

  // 3. free-floating islands (clouds, sparkles) that are pale and unsaturated go too
  const comp = new Int32Array(W * H).fill(-1);
  let nc = 0;
  const removed = [];
  for (let s = 0; s < W * H; s++) {
    if (isSky[s] || comp[s] >= 0) continue;
    const list = [s];
    comp[s] = nc;
    let touchesBottom = false, sumL = 0, sumSat = 0;
    for (let h = 0; h < list.length; h++) {
      const k = list[h];
      const x = k % W, y = (k / W) | 0;
      if (y >= lim - 2) touchesBottom = true;
      const i = k * 4;
      const mx = Math.max(data[i], data[i + 1], data[i + 2]), mn = Math.min(data[i], data[i + 1], data[i + 2]);
      sumL += (data[i] + data[i + 1] + data[i + 2]) / 3;
      sumSat += mx - mn;
      const nb = [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1];
      for (const n of nb) if (n >= 0 && !isSky[n] && comp[n] < 0) (comp[n] = nc, list.push(n));
    }
    const n = list.length;
    const pale = sumL / n > 175 && sumSat / n < 95;
    if (!touchesBottom && (pale || n < 300)) {
      for (const k of list) isSky[k] = 1;
      removed.push({ n, L: Math.round(sumL / n), S: Math.round(sumSat / n) });
    }
    nc++;
  }

  // the WTC's painted (still) turbine blades: the live spinning rotors replace them (the bridges stay)
  for (const [cx, cy, reach] of job.blades ?? [])
    for (let y = cy - reach; y <= cy + reach; y++)
      for (let x = cx - 26; x <= cx + 26; x++) {
        if (Math.abs(y - cy) <= 8) continue;
        const i = (y * W + x) * 4;
        if ((data[i] + data[i + 1] + data[i + 2]) / 3 > 150) isSky[y * W + x] = 1;
      }

  // an element redrawn as vector art: its polygon (image px), grown by 2px, is cut out
  if (job.erase) {
    const polys = JSON.parse(fs.readFileSync(job.erase, "utf8"));
    const inside = (px, py, poly) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const hit = new Uint8Array(W * H);
    for (const poly of polys) {
      const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
      for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(H - 1, Math.ceil(Math.max(...ys))); y++)
        for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(W - 1, Math.ceil(Math.max(...xs))); x++)
          if (inside(x + 0.5, y + 0.5, poly)) hit[y * W + x] = 1;
    }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (isSky[y * W + x]) continue;
        for (let dy = -2; dy <= 2 && !isSky[y * W + x]; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const yy = y + dy, xx = x + dx;
            if (yy >= 0 && xx >= 0 && yy < H && xx < W && hit[yy * W + xx]) {
              isSky[y * W + x] = 1;
              break;
            }
          }
      }
  }

  // 4. alpha: sky 0; a soft 2px rim where the art meets the sky, its colour un-mixed from the sky tone
  const outBuf = Buffer.from(data);
  const near = (k, r) => {
    const x = k % W, y = (k / W) | 0;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && isSky[yy * W + xx]) return true;
      }
    return false;
  };
  for (let k = 0; k < W * H; k++) {
    const i = k * 4;
    if (isSky[k]) {
      outBuf[i + 3] = 0;
      continue;
    }
    if (!near(k, 1)) continue;
    const y = (k / W) | 0;
    const s = sky[y];
    const d = dist(data[i], data[i + 1], data[i + 2], s);
    const a = Math.min(1, Math.max(0.25, d / 40));
    outBuf[i + 3] = Math.round(a * 255);
    for (let c = 0; c < 3; c++) outBuf[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - (1 - a) * s[c]) / a)));
  }

  await sharp(outBuf, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 90, alphaQuality: 90, effort: 6 }).toFile(`${out}/${job.name}.webp`);
  // to check a cut by eye, composite the result over magenta: whatever isn't magenta is kept
  if (process.env.DEBUG_CUT)
    await sharp({ create: { width: W, height: H, channels: 4, background: "#ff00ff" } })
      .composite([{ input: await sharp(outBuf, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer() }])
      .png()
      .toFile(`${process.env.DEBUG_CUT}/${job.name}-debug.png`);
  console.log(job.name, `${W}x${H}`, "islands removed:", removed.length);
}
