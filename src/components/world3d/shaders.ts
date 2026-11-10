import * as THREE from "three";
import type { RealmId } from "./config";

/**
 * The game's surfaces: small shader additions on top of three's standard material.
 *  - Floors and hill rows are picked by the material names Blender gave them (SandGround, SeaReef1, SnowHill2,
 *    IceSheet, ObsGround, WaterSurface ...). They are the real-time versions of blender/scripts/surfaces.py.
 *  - Everything made of flat vertex colours (props, animals, him) gets a fine grain, a soft rim light in the
 *    realm's colour and, for leaves, a sway in the wind (`detail`).
 * All patterns use positions, so they need no textures.
 *
 * Every patched material carries its own `customProgramCacheKey`: three keys compiled programs by the text of
 * `onBeforeCompile`, which is the same for all of these, so without a key of their own they would all be drawn
 * with whichever one was compiled first.
 */

/** shared clock for every animated surface */
export const TIME = { value: 0 };
/** the rim light on him: the frame loop blends it from realm to realm */
export const HERO_RIM = { value: new THREE.Color("#FFE2B0") };

const COMMON = `
varying vec3 vWPos;
uniform float uTime;
float fHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), f.x), mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// the net of light the sea surface throws: thin bright lines that drift
float fNet(vec2 p, float t) {
  vec2 q = p;
  for (int i = 0; i < 3; i++) q += vec2(sin(q.y * 1.7 + t), cos(q.x * 1.3 - t)) * 0.55;
  return pow(1.0 - abs(sin(q.x * 1.1) + sin(q.y * 1.1)) * 0.5, 5.0);
}
// thin wandering lines (cracks, veins): where a noise field crosses its middle value
float fVein(vec2 p, float w) { return 1.0 - smoothstep(0.0, w, abs(fNoise(p) - 0.5)); }
// sparse points of light that twinkle, each in its own time
float fGlint(vec2 p, float cells, float rare, float speed) {
  vec2 c = floor(p * cells);
  return step(rare, fHash(c)) * (0.5 + 0.5 * sin(uTime * speed + fHash(c + 7.0) * 40.0));
}
`;

let patches = 0;
function patch(m: THREE.MeshStandardMaterial, colour: string, emissive = "") {
  const key = `floor-${m.name}-${patches++}`;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>\n${COMMON}`).replace("#include <color_fragment>", `#include <color_fragment>\n${colour}`);
    if (emissive) sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${emissive}`);
  };
  m.customProgramCacheKey = () => key;
  m.needsUpdate = true;
}

const c3 = (hex: string) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};
const f = (n: number) => n.toFixed(3);

/** a hill row seen from the side: its crest catches the light, its foot sits in the haze */
const rise = (lo: number, hi: number, crest: string, amount: number, foot = "", footAmount = 0) => `
  // where a hill row has sunk away at the edge of its realm it lies just under sea level: not drawn, or it would
  // show from under the water as a band across the sea
  if (vWPos.y < -0.2) discard;
  float riseK = smoothstep(${f(lo)}, ${f(hi)}, vWPos.y);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3(crest)}, riseK * ${f(amount)});
  ${foot ? `diffuseColor.rgb = mix(diffuseColor.rgb, ${c3(foot)}, (1.0 - riseK) * ${f(footAmount)});` : ""}`;

/** wind ripples plus large soft patches of lighter sand, and sand blowing across in slow streaks */
const sand = (ripple: number, strength: number) => `
  float sandRip = 0.5 + 0.5 * sin(vWPos.z * ${ripple.toFixed(2)} + fNoise(vWPos.xz * 0.35) * 6.0 + vWPos.x * 0.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#CFA067")}, sandRip * ${strength.toFixed(2)});
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#F9E0B4")}, smoothstep(0.35, 0.75, fNoise(vWPos.xz * 0.11)) * 0.4);
  float sandBlow = smoothstep(0.6, 0.92, fNoise(vec2(vWPos.x * 0.22 - uTime * 0.3, vWPos.z * 1.5)));
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#FFEFCF")}, sandBlow * 0.2);`;
/** the walked ground: single grains, and darker wet sand where it meets the Gulf */
const sandNear = `
  diffuseColor.rgb *= 0.955 + 0.09 * fHash(floor(vWPos.xz * 34.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#B78B58")}, smoothstep(56.5, 62.0, vWPos.x) * 0.6);`;
const sandGlint = `
  totalEmissiveRadiance += ${c3("#FFE6B0")} * fGlint(vWPos.xz, 20.0, 0.992, 3.1) * 0.55;`;

/** the one colour of the sea: everything under water melts into it with distance, and so do the sky behind and the
 * far surface above, so the Gulf is one body of water and not layers of different blues */
export const SEA = "#38AEC0";
const seaFog = `
  float seaFogK = smoothstep(5.0, 30.0, -vWPos.z) * 0.96 * smoothstep(0.1, -0.5, vWPos.y);
  diffuseColor.rgb *= 1.0 - seaFogK;
  totalEmissiveRadiance += ${c3(SEA)} * seaFogK;`;

/** sand ripples, pebbles and shells and, under the water line, the drifting net of light; bluer with depth */
const seabed = (strength: number, pebbles = false) => `
  float seaRip = 0.5 + 0.5 * sin(vWPos.z * 9.0 + fNoise(vWPos.xz * 0.4) * 5.0 + vWPos.x * 0.5);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.82, seaRip * 0.3);
  ${
    pebbles
      ? `diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.7, smoothstep(0.74, 0.82, fNoise(vWPos.xz * 3.6)) * 0.55);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#FFF4DC")}, smoothstep(0.86, 0.9, fNoise(vWPos.xz * 6.5 + 20.0)) * 0.7);`
      : ""
  }
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#2C8FA3")}, smoothstep(-1.4, -3.8, vWPos.y) * 0.22);
  float seaNet = fNet(vWPos.xz * 0.85, uTime * 0.45) * smoothstep(-0.35, -1.2, vWPos.y);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#E4FFF6")}, seaNet * ${strength.toFixed(2)});`;

/** soft blue hollows in the snow, drifts the wind has combed, and loose snow blowing over it */
const snow = `
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#C4D5F3")}, smoothstep(0.3, 0.7, fNoise(vWPos.xz * 0.3)) * 0.65);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#FFFFFF")}, smoothstep(0.55, 0.85, fNoise(vec2(vWPos.x * 0.45, vWPos.z * 2.3))) * 0.45);
  float snowBlow = smoothstep(0.62, 0.92, fNoise(vec2(vWPos.x * 0.28 - uTime * 0.55, vWPos.z * 1.9)));
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#FFFFFF")}, snowBlow * 0.3);`;
/** sparkles that twinkle, large and small */
const snowGlint = `
  totalEmissiveRadiance += vec3(fGlint(vWPos.xz, 16.0, 0.986, 2.6) * 0.9 + fGlint(vWPos.xz + 3.7, 34.0, 0.991, 4.2) * 0.6);`;
/** the far hills catch a little of the aurora */
const auroraGlow = `
  totalEmissiveRadiance += mix(${c3("#63F0BE")}, ${c3("#B58CFF")}, 0.5 + 0.5 * sin(vWPos.x * 0.06 + uTime * 0.2)) * smoothstep(1.2, 4.6, vWPos.y) * (0.6 + 0.4 * sin(uTime * 0.35 + vWPos.x * 0.04)) * 0.09;`;

/** glossy ice with fine cracks, darker patches of deep water, snow dusted over it, and the aurora mirrored in it */
const ice = `
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#86BEE4")}, smoothstep(0.3, 0.7, fNoise(vWPos.xz * 0.2)));
  float crack = max(fVein(vWPos.xz * 0.35 + 3.0, 0.014), fVein(vWPos.xz * 1.1, 0.02) * 0.45);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#F4FCFF")}, crack);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#FFFFFF")}, smoothstep(0.62, 0.8, fNoise(vWPos.xz * 0.8 + 11.0)) * 0.4);`;
const iceGlow = `
  // seen from below (he swims under it) the ice is the same bright ceiling as the open water beside it, a little
  // whiter and with its cracks showing, so the sea reads as one sea all the way to the hole he climbs out of
  float underIce = step(vWPos.y, -0.3);
  float iceNet = fNet(vWPos.xz * 0.7, uTime * 0.4);
  vec3 iceBelow = mix(mix(${c3("#7AD6D6")}, ${c3("#F3FFFC")}, iceNet * 0.5 + crack * 0.5), ${c3(SEA)}, smoothstep(-5.0, -30.0, vWPos.z));
  diffuseColor.rgb *= 1.0 - underIce;
  totalEmissiveRadiance += iceBelow * underIce;
  float sheen = smoothstep(0.4, 0.8, fNoise(vec2(vWPos.x * 0.09 + uTime * 0.04, vWPos.z * 0.45)));
  totalEmissiveRadiance += mix(${c3("#63F0BE")}, ${c3("#B58CFF")}, fNoise(vWPos.xz * 0.05 + 4.0)) * sheen * 0.13 * (1.0 - underIce);`;

/** cracked black rock: lighter plates and specks of ash, and lava glowing in the cracks, strongest near the lava river */
const obsidian = `
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#3B3140")}, fNoise(floor(vWPos.xz * 0.9) + 0.5) * 0.7);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#6C5F6E")}, smoothstep(0.8, 0.88, fNoise(vWPos.xz * 5.0)) * 0.35);`;
const obsidianGlow = (amount: number) => `
  float vein = max(fVein(vWPos.xz * 0.5, 0.05), fVein(vWPos.xz * 1.3 + 9.0, 0.07) * 0.7);
  float lit = smoothstep(0.3, 0.5, fNoise(vWPos.xz * 0.2 + 5.0)) * (0.35 + 0.65 * smoothstep(-7.0, 3.0, vWPos.z));
  totalEmissiveRadiance += ${c3("#FF7A1F")} * vein * lit * (0.75 + 0.25 * sin(uTime * 1.3 + vWPos.x * 0.5)) * ${amount.toFixed(2)};`;
/** the foot of a ridge glows with the heat of the ground below it */
const heat = (top: number, amount: number) => `
  totalEmissiveRadiance += ${c3("#FF5A1F")} * (1.0 - smoothstep(0.0, ${f(top)}, vWPos.y)) * (0.8 + 0.2 * sin(uTime * 0.9 + vWPos.x * 0.3)) * ${f(amount)};`;

/** the spire is seen side-on, so its lava veins run down its faces */
const spire = `
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#5A4B5E")}, fNoise(vec2(vWPos.x * 0.7 + vWPos.z * 0.7, vWPos.y * 1.6)) * 0.55);
  diffuseColor.rgb *= 0.9 + 0.2 * fNoise(vec2(vWPos.x * 3.0 + vWPos.z * 3.0, vWPos.y * 7.0));`;
const spireGlow = `
  vec2 sp = vec2(vWPos.x + vWPos.z * 0.8, vWPos.y * 0.45);
  float sv = max(fVein(sp * 0.5, 0.045), fVein(sp * 1.2 + 4.0, 0.06) * 0.6) * smoothstep(0.35, 0.55, fNoise(sp * 0.25 + 2.0));
  totalEmissiveRadiance += ${c3("#FF7A1F")} * sv * (0.75 + 0.25 * sin(uTime * 1.1 + vWPos.y)) * 2.4;`;

/**
 * For everything made of flat vertex colours: a fine grain and soft mottling so no face is one dead colour, and a
 * rim of light in the realm's colour along its edges. With `sway`, green vertices (leaves, grass, seaweed, pine
 * needles) move in the wind, more the higher they are above `base`.
 */
export function detail(m: THREE.MeshStandardMaterial, rim: { value: THREE.Color }, sway = 0, base = 0, sea = false) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME;
    sh.uniforms.uRim = rim;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vDPos;\nvarying float vWorldZ;\nuniform float uTime;").replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vDPos = position;
      vWorldZ = (modelMatrix * vec4(position, 1.0)).z;
      ${
        sway
          ? `#ifdef USE_COLOR
        float leaf = step(color.r * 1.15, color.g) * step(color.b * 1.08, color.g);
        vec3 swp = (modelMatrix * vec4(position, 1.0)).xyz;
        float swh = clamp((position.y - ${f(base)}) * 0.5, 0.0, 1.0) * leaf;
        transformed.x += (sin(uTime * 1.7 + swp.x * 0.9 + swp.z * 0.7) + 0.4 * sin(uTime * 3.1 + swp.x * 2.3)) * ${f(sway)} * swh;
        transformed.z += cos(uTime * 1.3 + swp.x * 0.6) * ${f(sway * 0.5)} * swh;
      #endif`
          : ""
      }`,
    );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vDPos;
        varying float vWorldZ;
        uniform vec3 uRim;
        float dHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float dNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(dHash(i), dHash(i + vec2(1.0, 0.0)), f.x), mix(dHash(i + vec2(0.0, 1.0)), dHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        diffuseColor.rgb *= 0.93 + 0.075 * dNoise(vDPos.xy * 9.0 + vDPos.z * 6.3) + 0.065 * dNoise(vDPos.xz * 1.9 + vDPos.y * 1.3);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        // one rule of light for everything in every realm: faces that look up are a little brighter, faces that
        // look down a little darker (the camera is side-on, so the view's up is the world's up)
        diffuseColor.rgb *= 0.9 + 0.13 * normal.y;
        float rimK = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.6);
        totalEmissiveRadiance += diffuseColor.rgb * uRim * rimK * 0.6;
        ${
          sea
            ? `float seaK = smoothstep(5.0, 30.0, -vWorldZ) * 0.96;
        diffuseColor.rgb *= 1.0 - seaK;
        totalEmissiveRadiance = totalEmissiveRadiance * (1.0 - seaK) + ${c3(SEA)} * seaK;`
            : ""
        }`,
      );
  };
  m.customProgramCacheKey = () => `detail-${sway}-${base}-${sea}`;
  m.needsUpdate = true;
  return m;
}

/** Fish drawn as one instanced mesh swish their tails: the back half of each fish sways, each one out of step. */
export function fishWiggle(m: THREE.Material) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          transformed.z += sin(uTime * 9.0 + instanceMatrix[3].x * 2.3 + position.x * 9.0) * 0.045 * smoothstep(0.06, -0.3, position.x);
        #endif`,
      );
  };
  m.customProgramCacheKey = () => "fish";
  m.needsUpdate = true;
  return m;
}

/** The surface of the Gulf: a bright drifting net seen from below, calmer blue with glints seen from above. */
export function waterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: TIME },
    side: THREE.DoubleSide,
    transparent: true,
    vertexShader: `varying vec3 vWPos;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWPos = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `${COMMON}
      void main() {
        float n = fNet(vWPos.xz * 0.7, uTime * 0.4);
        // seen from below, the far surface melts into the colour of deep water
        float far = smoothstep(-5.0, -30.0, vWPos.z);
        vec3 below = mix(mix(${c3("#6FD0D2")}, ${c3("#EFFFFB")}, n * 0.5), ${c3(SEA)}, far);
        // seen from above: the net, points of sunlight, and a line of foam where it meets the sand
        vec3 above = mix(${c3("#3FB6C8")}, ${c3("#E9FFFB")}, n * 0.4) + vec3(fGlint(vWPos.xz, 9.0, 0.975, 3.4) * 0.5);
        above = mix(above, ${c3("#FFFFFF")}, smoothstep(0.55, 0.0, vWPos.x - 60.6 - 0.25 * sin(uTime * 0.9 + vWPos.z * 0.8)) * 0.8);
        gl_FragColor = vec4(gl_FrontFacing ? above : below, gl_FrontFacing ? 0.86 : 0.96);
        #include <colorspace_fragment>
      }`,
  });
}

/** what the vertex-coloured things of each realm get: the colour of their rim light, and how the leaves move */
const DETAIL: Record<RealmId, { rim: string; sway: number; base: number }> = {
  desert: { rim: "#FFE2B0", sway: 0.07, base: 0 },
  aqua: { rim: "#BFFFF4", sway: 0.1, base: -3.4 },
  snow: { rim: "#BFD4FF", sway: 0.022, base: 0 },
  magma: { rim: "#FF9A4A", sway: 0, base: 0 },
};
export const RIMS = (Object.keys(DETAIL) as RealmId[]).map((id) => new THREE.Color(DETAIL[id].rim));

/** Give every surface in a realm its shader, and set which meshes cast and catch shadows. */
export function dressRealm(scene: THREE.Object3D, realm: RealmId) {
  const d = DETAIL[realm];
  const rim = { value: new THREE.Color(d.rim) };
  // the vertex-colour material is shared by the realm's props and animals: one copy that sways for what is
  // rooted (the merged props, the palms), one that does not for what walks, swims and flies
  let still: THREE.MeshStandardMaterial | null = null;
  let rooted: THREE.MeshStandardMaterial | null = null;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const land = /^(Ground|Dune|Hill|Ridge|Reef|Water|Ice|Volcano|Shafts|GorgeLava)/.test(o.name);
    m.castShadow = !land && !/fx\d*$/.test(o.name);
    m.receiveShadow = /^(Ground|Dune1|Dune2|Hill1|Hill2|Ridge1|Reef1|Reef2|Ice|Static)$/.test(o.name);
    const mat = m.material as THREE.MeshStandardMaterial;
    const n = mat.name;
    if (n === "SayedColor") {
      if (d.sway && /^(Static|Palm)/.test(o.name)) m.material = rooted ??= detail(mat.clone(), rim, d.sway, d.base, realm === "aqua");
      else m.material = still ??= detail(mat.clone(), rim, 0, 0, realm === "aqua");
    } else if (n === "SandGround") patch(mat, sand(8, 0.4) + sandNear, sandGlint);
    else if (n === "SandDune1") patch(mat, sand(4.2, 0.26) + rise(0.2, 1.7, "#FFEBC6", 0.3));
    else if (n === "SandDune2") patch(mat, sand(2.4, 0.2) + rise(0.4, 3.2, "#FFEBC6", 0.3));
    else if (n === "SandDune3") patch(mat, sand(1.3, 0.12) + rise(0.6, 5.6, "#FFF0D2", 0.34, "#E9CDA2", 0.25));
    else if (n === "SandDune4") patch(mat, rise(1.0, 8.8, "#FFF3DC", 0.36, "#E6D2B6", 0.3));
    else if (n === "SeaGround") patch(mat, seabed(0.55, true), seaFog);
    else if (n === "SeaReef1") patch(mat, seabed(0.4, true), seaFog);
    else if (n === "SeaReef2") patch(mat, seabed(0.24), seaFog);
    else if (n === "SeaReef3") patch(mat, seabed(0.12), seaFog);
    else if (n === "SnowGround") patch(mat, snow, snowGlint);
    else if (n === "SnowHill1") patch(mat, snow + rise(0.1, 1.2, "#FFFFFF", 0.35), snowGlint);
    else if (n === "SnowHill2") patch(mat, snow + rise(0.4, 3.0, "#FFFFFF", 0.35, "#AEC0EA", 0.3), auroraGlow);
    else if (n === "SnowHill3") patch(mat, rise(0.8, 4.8, "#F4F8FF", 0.4, "#9FB0DE", 0.35), auroraGlow);
    else if (n === "IceSheet") patch(mat, ice, iceGlow);
    else if (n === "ObsGround") patch(mat, obsidian, obsidianGlow(1.35));
    else if (n === "ObsRidge1") patch(mat, obsidian + rise(0.6, 3.6, "#57465A", 0.4), obsidianGlow(1.6) + heat(1.6, 0.3));
    else if (n === "ObsRidge2") patch(mat, rise(1.0, 6.4, "#5E4A5C", 0.4), heat(3.4, 0.22));
    else if (n === "ObsRidge3") patch(mat, rise(1.5, 9.6, "#6B5364", 0.4), heat(5.5, 0.16));
    else if (n === "ObsSpire") patch(mat, spire, spireGlow);
    else if (n === "WaterSurface") {
      m.material = waterMaterial();
      m.renderOrder = 2;
    }
  });
}
