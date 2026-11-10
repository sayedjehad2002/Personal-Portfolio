import * as THREE from "three";
import type { SoundName } from "./audio";
import { LEVELS, type RealmId } from "./config";
import { fishWiggle } from "./shaders";

/**
 * What lives in each realm, and how it reacts to him. Nodes are found by the names Blender gave them
 * (three drops the dots: "Camel.head" arrives as "Camelhead", "Palm.003" as "Palm003").
 * Everything here is ambient: nothing blocks the scroll.
 */

export type Ctx = {
  /** player position (units, y up) */
  x: number;
  y: number;
  camX: number;
  dt: number;
  time: number;
  running: boolean;
  /** the dragon's breath, -1..1 */
  breath: number;
  /** seconds since the dragon woke (he reached the top), or -1 while it sleeps */
  wake: number;
  /** ask for a sound (the camel's grunt, the owl's hoot ...) */
  emit: (name: SoundName) => void;
};
export type Life = { update: (c: Ctx) => void };

const tmp = { m: new THREE.Matrix4(), v: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), e: new THREE.Euler() };

const find = (scene: THREE.Object3D, name: string) => scene.getObjectByName(name) ?? null;
function findAll(scene: THREE.Object3D, re: RegExp) {
  const out: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (re.test(o.name)) out.push(o);
  });
  return out;
}

/** A head that turns to watch him when he is near (the camel, the owl). */
function watcher(scene: THREE.Object3D, bodyName: string, headName: string, homeX: number, range: number, sound: SoundName) {
  const body = find(scene, bodyName);
  const head = find(scene, headName);
  if (!body || !head) return () => {};
  const rest = head.quaternion.clone();
  let was = false;
  return (c: Ctx) => {
    const local = body.worldToLocal(tmp.v.set(c.x, c.y + 1.2, 0)).sub(head.position);
    const near = Math.abs(c.x - homeX) < range;
    // it greets him when it first notices him
    if (Math.abs(c.x - homeX) < range * 0.45 && !was) c.emit(sound);
    was = Math.abs(c.x - homeX) < range * 0.45;
    const yaw = near ? Math.max(-1.15, Math.min(1.15, Math.atan2(-local.z, local.x))) : Math.sin(c.time * 0.5) * 0.12;
    tmp.q.setFromEuler(tmp.e.set(0, yaw, near ? -0.12 : Math.sin(c.time * 0.7) * 0.04, "YZX"));
    head.quaternion.slerp(tmp.q.premultiply(rest), Math.min(1, c.dt * 4));
  };
}

/** A small animal that bolts away when he comes close, then stops and looks back (hare, fox, fire-lizard). */
function bolter(node: THREE.Object3D | null, o: { x: number; depth: number; min: number; max: number; near: number; run: number; speed: number; hop: number; height: number }) {
  if (!node) return () => {};
  const s = { x: o.x, dir: 1, left: 0, hop: 0, look: 1 };
  const baseY = node.position.y;
  return (c: Ctx) => {
    if (s.left <= 0 && Math.abs(c.x - s.x) < o.near && Math.abs(c.y - baseY) < 2.5) {
      s.dir = c.x < s.x ? 1 : -1;
      // cornered at the end of its patch: dart past him instead
      if ((s.dir > 0 && s.x > o.max - 1) || (s.dir < 0 && s.x < o.min + 1)) s.dir = -s.dir;
      s.left = Math.min(o.run, s.dir > 0 ? o.max - s.x : s.x - o.min);
      c.emit("scurry");
    }
    let up = 0;
    if (s.left > 0) {
      const step = Math.min(s.left, c.dt * o.speed);
      s.x += s.dir * step;
      s.left -= step;
      s.hop += step / o.hop;
      up = Math.abs(Math.sin(s.hop * Math.PI)) * o.height;
      s.look = s.dir;
    } else {
      s.hop = 0;
      s.look = c.x < s.x ? -1 : 1;
    }
    node.position.set(s.x, baseY + up, -o.depth);
    node.rotation.y += ((s.look > 0 ? 0 : Math.PI) - node.rotation.y) * Math.min(1, c.dt * 12);
    node.rotation.z = s.left > 0 ? Math.cos(s.hop * Math.PI) * 0.25 * s.dir * Math.min(1, o.height * 3) : 0;
  };
}

/** Many fish drawn as one instanced mesh, taken from a single fish Blender exported. */
function school(scene: THREE.Object3D, template: string, count: number) {
  const tpl = find(scene, template);
  const found: THREE.Mesh[] = [];
  tpl?.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) found.push(o as THREE.Mesh);
  });
  if (!tpl || !found.length) return null;
  // (React runs effects twice in development: reuse the school if it is already there)
  const old = scene.getObjectByName(template + "School") as THREE.InstancedMesh | undefined;
  if (old) return old;
  const mesh = new THREE.InstancedMesh(found[0].geometry, fishWiggle((found[0].material as THREE.Material).clone()), count);
  mesh.name = template + "School";
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  tpl.visible = false;
  scene.add(mesh);
  return mesh;
}

/** A few far-off birds crossing the sky: each is two flat wings seen from the front, beaten by flipping their height. */
function flock(scene: THREE.Object3D, name: string, count: number, color: string) {
  const old = scene.getObjectByName(name) as THREE.InstancedMesh | undefined;
  if (old) return old;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0, -0.42, 0.2, 0, -0.2, 0.0, 0, 0, 0, 0, 0.2, 0.0, 0, 0.42, 0.2, 0]), 3));
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.75 }), count);
  mesh.name = name;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

function desert(scene: THREE.Object3D): Life {
  const L = LEVELS.desert.life;
  const birds = flock(scene, "SkyBirds", 7, "#6B5648");
  const palms = findAll(scene, /^Palm\d*$/);
  const flamingos = findAll(scene, /^Flamingo\d*$/);
  const camel = find(scene, "Camel");
  const look = watcher(scene, "Camel", "Camelhead", L.camel.x, 11, "camel");
  const hare = bolter(find(scene, "Hare"), { x: L.hare.x, depth: L.hare.y, min: L.hare.min, max: L.hare.max, near: 2.4, run: 5.6, speed: 6.5, hop: 0.85, height: 0.34 });
  const falcon = find(scene, "Falcon");
  const wings = [find(scene, "FalconwingL"), find(scene, "FalconwingR")];
  const tail = find(scene, "Cameltail");
  const f = { a: 0, cx: L.falcon.x };
  return {
    update(c) {
      palms.forEach((p, i) => (p.rotation.z = Math.sin(c.time * 0.9 + i * 1.7) * 0.022 + Math.sin(c.time * 2.3 + i) * 0.006));
      // the flamingos lift their heads and shuffle when he runs at the shore
      const spooked = c.running && c.x > 54 ? 1 : 0;
      flamingos.forEach((b, i) => {
        b.rotation.z = Math.sin(c.time * (0.8 + spooked * 5) + i * 2) * (0.035 + spooked * 0.05);
        const lift = ((spooked ? 0.25 : 0) - (b.userData.lift ?? 0)) * Math.min(1, c.dt * 5);
        b.position.y += lift;
        b.userData.lift = (b.userData.lift ?? 0) + lift;
      });
      // a loose line of birds drifts across the far sky, and comes round again
      for (let i = 0; i < birds.count; i++) {
        const span = 90;
        const bx = c.camX * 0.8 - span / 2 + ((((i * 2.3 + c.time * 1.1) % span) + span) % span);
        const k = bx < 70 ? 1 : 0; // never out over the Gulf
        tmp.m.compose(
          tmp.v.set(bx, 10.5 + Math.sin(i * 1.7) * 1.4 + Math.sin(c.time * 0.6 + i) * 0.3, -46 - (i % 3) * 4),
          tmp.q.identity(),
          tmp.s.set(1.5 * k, 1.5 * k * Math.sin(c.time * 5.5 + i * 1.3), 1.5 * k),
        );
        birds.setMatrixAt(i, tmp.m);
      }
      birds.instanceMatrix.needsUpdate = true;
      if (camel) camel.scale.y = 1 + Math.sin(c.time * 1.6) * 0.006;
      if (tail) tail.rotation.x = Math.sin(c.time * 2.1) * 0.22 + Math.sin(c.time * 5.3) * 0.05;
      look(c);
      hare(c);
      if (falcon) {
        // the falcon circles above him while he is in the desert
        f.a += c.dt * 0.75;
        f.cx += (Math.min(c.x, 56) + 2.5 - f.cx) * Math.min(1, c.dt * 0.6);
        falcon.position.set(f.cx + Math.cos(f.a) * 3.4, L.falcon.height + Math.sin(f.a * 2) * 0.3, -L.falcon.depth + Math.sin(f.a) * 1.8);
        falcon.rotation.set(0.38, Math.atan2(-Math.cos(f.a), -Math.sin(f.a)), 0, "YXZ");
        // a few beats, then a glide
        const beat = Math.sin(c.time * 9) * Math.max(0, Math.sin(c.time * 0.9)) * 0.55;
        wings.forEach((w, i) => w && (w.rotation.x = (i ? 1 : -1) * beat));
      }
    },
  };
}

function aqua(scene: THREE.Object3D): Life {
  const L = LEVELS.aqua.life;
  const gold = school(scene, "FishGold", 46);
  const blue = school(scene, "FishBlue", 22);
  const reef = school(scene, "FishCoral", 18);
  // no two fish the same size or quite the same colour
  for (const [m, tint] of [[gold, 0.16], [blue, 0.14], [reef, 0.2]] as const) {
    if (!m) continue;
    for (let i = 0; i < m.count; i++) {
      const v = Math.abs(Math.sin(i * 91.7) * 43758.5453) % 1;
      m.setColorAt(i, new THREE.Color().setRGB(1 - tint * v, 1 - tint * 0.5 * (1 - v), 1 - tint * (1 - v)));
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  const size = (i: number) => 0.75 + (Math.abs(Math.sin(i * 37.3) * 1375.3) % 1) * 0.65;
  const seeds = Array.from({ length: 46 }, (_, i) => ({ r: Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1, r2: Math.abs(Math.sin(i * 78.233) * 12345.678) % 1 }));
  const turtle = find(scene, "Turtle");
  const flips = [find(scene, "TurtleflipL"), find(scene, "TurtleflipR")];
  const rayWings = [find(scene, "RaywingL"), find(scene, "RaywingR")];
  const ray = find(scene, "Ray");
  const hamour = find(scene, "Hamour");
  const dugong = find(scene, "Dugong");
  const jellies = findAll(scene, /^Jelly\d*$/);
  const jellyY = jellies.map((j) => j.position.y);
  const jellyS = jellies.map((j) => j.scale.x);
  const t = { x: L.turtle.x, y: L.turtle.height };
  const r = { x: L.ray.x, lift: 0, glide: 0 };
  const h = { out: 1 };
  const d = { x: L.dugong.x0 };
  return {
    update(c) {
      const under = c.y < L.sea_level - 0.6;
      // the gold school flows past and parts around him, closing again behind
      if (gold) {
        const span = 30;
        for (let i = 0; i < gold.count; i++) {
          const s = seeds[i];
          const fx = c.camX - span / 2 + ((((i / gold.count) * span + c.time * (0.7 + s.r * 0.5)) % span) + span) % span;
          const side = i % 2 ? 1 : -1;
          const part = (xx: number) => side * (0.25 + 1.25 * Math.exp(-(((xx - c.x) / 2.2) ** 2)));
          const cy = under ? c.y + 0.9 : L.school.height;
          const fy = cy + part(fx) + (s.r - 0.5) * 0.56 + Math.sin(c.time * 1.3 + i) * 0.05;
          const inSea = fx > L.school.x0 && fx < L.school.x1 && fy < L.sea_level - 0.3;
          const k = inSea ? size(i) : 0;
          tmp.q.setFromEuler(tmp.e.set(0, (s.r2 - 0.5) * 0.24, (part(fx + 0.3) - part(fx - 0.3)) * 1.3 + Math.sin(c.time * 6 + i) * 0.04));
          tmp.m.compose(tmp.v.set(fx, fy, -(L.school.depth + s.r2 * 2.2)), tmp.q, tmp.s.set(k, k, k));
          gold.setMatrixAt(i, tmp.m);
        }
        gold.instanceMatrix.needsUpdate = true;
      }
      if (blue) {
        const span = 44;
        for (let i = 0; i < blue.count; i++) {
          const s = seeds[i];
          const fx = c.camX * 0.6 + 36 - span / 2 + ((((i / blue.count) * span + c.time * 0.45) % span) + span) % span;
          const k = fx > L.school.x0 + 2 && fx < L.school.x1 ? size(i + 50) : 0;
          tmp.q.setFromEuler(tmp.e.set(0, 0, Math.sin(c.time * 0.8 + i) * 0.08));
          tmp.m.compose(tmp.v.set(fx, L.bed + 3.2 + (s.r - 0.5) * 0.7 + Math.sin(c.time + i) * 0.08, -(9 + s.r2 * 2)), tmp.q, tmp.s.set(k, k, k));
          blue.setMatrixAt(i, tmp.m);
        }
        blue.instanceMatrix.needsUpdate = true;
      }
      // the coral fish keep to the reef: small groups that circle their own patch and dart when he comes close
      if (reef) {
        for (let i = 0; i < reef.count; i++) {
          const s = seeds[i];
          const home = L.school.x0 + 6 + (Math.floor(i / 3) / 6) * (L.school.x1 - L.school.x0 - 12);
          const a = c.time * (0.5 + s.r * 0.5) + i * 2.1;
          const scare = Math.exp(-(((home - c.x) / 2.5) ** 2));
          const fx = home + Math.cos(a) * (1.1 + s.r2 + scare * 1.6);
          const fy = L.bed + 1.1 + s.r * 0.9 + Math.sin(a * 1.3) * 0.25 + scare * 0.5;
          tmp.q.setFromEuler(tmp.e.set(0, Math.sin(a) > 0 ? Math.PI : 0, Math.sin(a * 1.3) * 0.15));
          const k = size(i + 90) * 0.9;
          tmp.m.compose(tmp.v.set(fx, Math.min(fy, L.sea_level - 0.5), -(2.2 + s.r2 * 3.5)), tmp.q, tmp.s.set(k, k, k));
          reef.setMatrixAt(i, tmp.m);
        }
        reef.instanceMatrix.needsUpdate = true;
      }
      if (turtle) {
        // the turtle swims beside him for as long as he is in the deep water
        const tx = Math.max(72, Math.min(112, c.x + 3.4));
        const before = t.x;
        t.x += (tx - t.x) * Math.min(1, c.dt * 0.9);
        t.y += ((under ? c.y + 1.5 : L.turtle.height) - t.y) * Math.min(1, c.dt * 0.8);
        turtle.position.set(t.x, Math.min(t.y, L.sea_level - 0.7) + Math.sin(c.time * 1.1) * 0.08, -L.turtle.depth);
        const heading = t.x - before < -0.0005 ? Math.PI : 0;
        turtle.rotation.y += (heading - turtle.rotation.y) * Math.min(1, c.dt * 3);
        turtle.rotation.z = Math.sin(c.time * 1.1) * 0.08;
        flips.forEach((fl, i) => fl && (fl.rotation.x = (i ? 1 : -1) * Math.sin(c.time * 2.4) * 0.5));
      }
      if (ray) {
        // the ray lifts off the sand when he comes near and glides on ahead
        if (r.glide <= 0 && Math.abs(c.x - r.x) < 3.4 && under && r.x < 110) r.glide = 7.5;
        if (r.glide > 0) {
          const step = Math.min(r.glide, c.dt * 2.6);
          r.x += step;
          r.glide -= step;
        }
        r.lift += ((r.glide > 0 ? 1 : 0) - r.lift) * Math.min(1, c.dt * 2.5);
        ray.position.set(r.x, L.ray.height + r.lift * 0.9 + Math.sin(c.time * 2) * 0.05 * r.lift, -L.ray.depth);
        ray.rotation.set(0, Math.PI, -0.18 * r.lift, "YXZ");
        rayWings.forEach((w, i) => w && (w.rotation.x = (i ? 1 : -1) * Math.sin(c.time * 3.2) * (0.08 + 0.4 * r.lift)));
      }
      if (hamour) {
        // the hamour peeks out of the coral and backs in when he is close
        h.out += ((Math.abs(c.x - L.hamour.x) < 4.5 && under ? 0 : 1) - h.out) * Math.min(1, c.dt * 2.2);
        hamour.position.set(L.hamour.x - 0.9 * h.out, L.hamour.height + Math.sin(c.time * 1.4) * 0.03, -L.hamour.depth - 0.9 * (1 - h.out));
      }
      if (dugong) {
        d.x -= c.dt * 0.55;
        if (d.x < L.dugong.x1) d.x = L.dugong.x0;
        dugong.position.set(d.x, L.dugong.height + Math.sin(c.time * 0.5) * 0.3, -L.dugong.depth);
      }
      jellies.forEach((j, i) => {
        const p = Math.sin(c.time * 1.2 + i * 1.9);
        j.position.y = jellyY[i] + Math.sin(c.time * 0.5 + i * 2.3) * 0.35;
        j.scale.set(1 + p * 0.07, 1 - p * 0.09, 1 + p * 0.07).multiplyScalar(jellyS[i]);
      });
    },
  };
}

function snow(scene: THREE.Object3D): Life {
  const L = LEVELS.snow.life;
  const look = watcher(scene, "Owl", "Owlhead", L.owl.x, 9, "owl");
  const fox = bolter(find(scene, "Fox"), { x: L.fox.x, depth: L.fox.y, min: L.fox.min, max: L.fox.max, near: 2.8, run: 6.5, speed: 7, hop: 1.5, height: 0.62 });
  const hare = bolter(find(scene, "Hare"), { x: L.hare.x, depth: L.hare.y, min: L.hare.min, max: L.hare.max, near: 2.4, run: 5, speed: 6.5, hop: 0.85, height: 0.34 });
  const seal = find(scene, "Seal");
  const brush = find(scene, "Foxtail");
  const sealY = seal?.position.y ?? 0;
  const gondola = find(scene, "Gondola");
  const s = { up: 0 };
  const G = L.gondola;
  const floor = (x: number) => (x <= G.x0 || x >= G.x1 ? 0 : G.top * Math.sin((Math.PI * (x - G.x0)) / (G.x1 - G.x0)));
  return {
    update(c) {
      look(c);
      fox(c);
      hare(c);
      if (brush) brush.rotation.y = Math.sin(c.time * 4.2) * 0.35;
      if (seal) {
        // the seal pops up through its hole as he skates by, and watches him
        const before = s.up;
        s.up += ((Math.abs(c.x - L.seal.x) < 6.5 ? 1 : 0) - s.up) * Math.min(1, c.dt * 3);
        if (before < 0.5 && s.up >= 0.5) c.emit("seal");
        seal.position.y = sealY - 0.95 * (1 - s.up) + Math.sin(c.time * 2) * 0.03 * s.up;
        seal.rotation.y += (Math.atan2(1.7, c.x - L.seal.x) - seal.rotation.y) * Math.min(1, c.dt * 3);
      }
      if (gondola) {
        // the cable car carries him over the gorge; it waits at whichever station he is nearer
        const gx = Math.max(G.x0, Math.min(G.x1, c.x));
        gondola.position.set(gx, floor(gx), 0);
        gondola.rotation.z = Math.sin(c.time * 1.3) * 0.012 * (gx > G.x0 && gx < G.x1 ? 1 : 0);
      }
    },
  };
}

/** how far the dragon's head lifts off the ledge when it wakes (radians, about the base of its skull) */
export const DRAGON_LIFT = 0.78;
/** The waking, by seconds: the eye opens, the head rises to look at him, the jaws open for the fire and half close. */
export function dragonWake(t: number) {
  if (t < 0) return { eye: 0, lift: 0, jaw: 0, hatch: 0, perch: 0 };
  const ease = (v: number) => {
    const k = Math.max(0, Math.min(1, v));
    return k * k * (3 - 2 * k);
  };
  // (slowly: the eye, then a long rise as the head comes round to him, then the jaws; the egg hatches after the fire)
  return {
    eye: ease(t / 0.5),
    lift: ease((t - 0.6) / 2.1),
    jaw: ease((t - 2.7) / 0.3) * (1 - 0.7 * ease((t - 4.5) / 0.7)),
    hatch: ease((t - 5.2) / 0.45),
    perch: ease((t - 6.3) / 0.9),
  };
}

function magma(scene: THREE.Object3D): Life {
  const L = LEVELS.magma.life;
  const lizards = findAll(scene, /^Lizard\d*$/).map((n, i) =>
    bolter(n, { x: L.lizards[i] ?? n.position.x, depth: -n.position.z, min: 206, max: 225, near: 2.2, run: 3.4, speed: 9, hop: 0.3, height: 0.03 }),
  );
  const dragon = find(scene, "Dragon");
  const flag = find(scene, "SummitFlag");
  const head = find(scene, "Dragonhead");
  const jaw = find(scene, "Dragonjaw");
  const lid = find(scene, "Dragonlid");
  const baby = find(scene, "Hatchling");
  const babyHome = baby?.position.clone() ?? new THREE.Vector3();
  let hatched = false;
  const f = { k: 0 };
  const k = { eye: 0, lift: 0, jaw: 0 };
  return {
    update(c) {
      lizards.forEach((l) => l(c));
      // the dragon sleeps: its whole body rises and falls with each breath
      if (dragon) dragon.scale.y = 1 + c.breath * 0.018;
      // asleep its eye stays shut (it twitches now and then); when he plants the flag the eye opens, the head
      // comes up off the ledge to look at him, and the jaws open
      const w = dragonWake(c.wake);
      k.eye += (w.eye - k.eye) * Math.min(1, c.dt * 9);
      k.lift += (w.lift - k.lift) * Math.min(1, c.dt * (w.lift > k.lift ? 9 : 3.5));
      k.jaw += (w.jaw - k.jaw) * Math.min(1, c.dt * 10);
      const twitch = Math.max(0, Math.sin(c.time * 0.7) - 0.985) * 12;
      if (lid) lid.scale.y = 1 - 0.9 * Math.max(k.eye, twitch);
      if (head) {
        head.rotation.z = k.lift * DRAGON_LIFT + Math.sin(c.time * 1.4) * 0.03 * k.lift;
        head.rotation.y = -0.55 * k.lift + Math.sin(c.time * 0.9) * 0.05 * k.lift;
      }
      if (jaw) jaw.rotation.z = -0.62 * k.jaw - 0.04 * k.lift;
      // after the fire the egg hatches: the baby dragon pops out of the nest, looks about, and hops onto his head
      if (baby) {
        if (w.hatch > 0.5 && !hatched) c.emit("nest");
        hatched = w.hatch > 0.5;
        const pop = w.hatch * (1 + 0.25 * Math.sin(Math.min(1, w.hatch) * Math.PI));
        baby.scale.setScalar(Math.max(0.0001, pop));
        const p = w.perch;
        baby.position.set(
          babyHome.x + (c.x - 0.08 - babyHome.x) * p,
          babyHome.y + (c.y + 1.97 - babyHome.y) * p + Math.sin(p * Math.PI) * 0.9 + Math.abs(Math.sin(c.time * 3)) * 0.05 * w.hatch,
          babyHome.z + (0.0 - babyHome.z) * p,
        );
        baby.rotation.z = Math.sin(c.time * 2.2) * 0.08 * w.hatch;
      }
      if (flag) {
        // he plants the flag when he reaches the very top
        f.k += ((c.x > L.flag.x - 1.4 && c.y > L.top - 0.4 ? 1 : 0) - f.k) * Math.min(1, c.dt * 4);
        flag.scale.setScalar(Math.max(0.0001, f.k));
        flag.rotation.z = Math.sin(c.time * 2.2) * 0.02;
      }
    },
  };
}

export function createLife(realm: RealmId, scene: THREE.Object3D): Life {
  return realm === "desert" ? desert(scene) : realm === "aqua" ? aqua(scene) : realm === "snow" ? snow(scene) : magma(scene);
}
