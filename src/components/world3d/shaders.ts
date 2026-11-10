import * as THREE from "three";

/**
 * The game's floors: small shader additions on top of three's standard material, picked by the material names
 * Blender gave them (SandGround, SeaReef1, SnowHill2, IceSheet, ObsGround, WaterSurface ...). They are the
 * real-time versions of blender/scripts/surfaces.py. All patterns use world position, so they need no textures.
 */

/** shared clock for every animated floor */
export const TIME = { value: 0 };

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
`;

function patch(m: THREE.MeshStandardMaterial, colour: string, emissive = "") {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>\n${COMMON}`).replace("#include <color_fragment>", `#include <color_fragment>\n${colour}`);
    if (emissive) sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${emissive}`);
  };
  m.needsUpdate = true;
}

const c3 = (hex: string) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

/** wind ripples plus large soft patches of lighter sand */
const sand = (ripple: number, strength: number) => `
  float sandRip = 0.5 + 0.5 * sin(vWPos.z * ${ripple.toFixed(2)} + fNoise(vWPos.xz * 0.35) * 6.0 + vWPos.x * 0.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#CFA067")}, sandRip * ${strength.toFixed(2)});
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#F9E0B4")}, smoothstep(0.35, 0.75, fNoise(vWPos.xz * 0.11)) * 0.4);`;

/** sand ripples and, under the water line, the drifting net of light */
const seabed = (strength: number) => `
  float seaRip = 0.5 + 0.5 * sin(vWPos.z * 9.0 + fNoise(vWPos.xz * 0.4) * 5.0 + vWPos.x * 0.5);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.82, seaRip * 0.3);
  float seaNet = fNet(vWPos.xz * 0.85, uTime * 0.45) * smoothstep(-0.35, -1.2, vWPos.y);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#E4FFF6")}, seaNet * ${strength.toFixed(2)});`;

/** soft blue hollows in the snow */
const snow = `
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#C4D5F3")}, smoothstep(0.3, 0.7, fNoise(vWPos.xz * 0.3)) * 0.65);`;
/** sparkles that twinkle */
const snowGlint = `
  vec2 glintCell = floor(vWPos.xz * 16.0);
  float glint = step(0.986, fHash(glintCell)) * (0.5 + 0.5 * sin(uTime * 2.6 + fHash(glintCell + 7.0) * 40.0));
  totalEmissiveRadiance += vec3(glint) * 0.9;`;

/** glossy ice with fine cracks and darker patches of deep water */
const ice = `
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#86BEE4")}, smoothstep(0.3, 0.7, fNoise(vWPos.xz * 0.2)));
  float crack = max(fVein(vWPos.xz * 0.35 + 3.0, 0.014), fVein(vWPos.xz * 1.1, 0.02) * 0.45);
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#F4FCFF")}, crack);`;

/** cracked black rock: lighter plates, and lava glowing in the cracks, strongest near the lava river */
const obsidian = `
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#3B3140")}, fNoise(floor(vWPos.xz * 0.9) + 0.5) * 0.7);`;
const obsidianGlow = (amount: number) => `
  float vein = max(fVein(vWPos.xz * 0.5, 0.05), fVein(vWPos.xz * 1.3 + 9.0, 0.07) * 0.7);
  float lit = smoothstep(0.3, 0.5, fNoise(vWPos.xz * 0.2 + 5.0)) * (0.35 + 0.65 * smoothstep(-7.0, 3.0, vWPos.z));
  totalEmissiveRadiance += ${c3("#FF7A1F")} * vein * lit * (0.75 + 0.25 * sin(uTime * 1.3 + vWPos.x * 0.5)) * ${amount.toFixed(2)};`;

/** the spire is seen side-on, so its lava veins run down its faces */
const spire = `
  diffuseColor.rgb = mix(diffuseColor.rgb, ${c3("#5A4B5E")}, fNoise(vec2(vWPos.x * 0.7 + vWPos.z * 0.7, vWPos.y * 1.6)) * 0.55);`;
const spireGlow = `
  vec2 sp = vec2(vWPos.x + vWPos.z * 0.8, vWPos.y * 0.45);
  float sv = max(fVein(sp * 0.5, 0.045), fVein(sp * 1.2 + 4.0, 0.06) * 0.6) * smoothstep(0.35, 0.55, fNoise(sp * 0.25 + 2.0));
  totalEmissiveRadiance += ${c3("#FF7A1F")} * sv * (0.75 + 0.25 * sin(uTime * 1.1 + vWPos.y)) * 2.4;`;

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
        float far = smoothstep(-10.0, -44.0, vWPos.z);
        vec3 below = mix(mix(${c3("#7FDCD8")}, ${c3("#F2FFFB")}, n * 0.55), ${c3("#2BA3B5")}, far);
        vec3 c = gl_FrontFacing ? mix(${c3("#3FB6C8")}, ${c3("#E9FFFB")}, n * 0.4) : below;
        gl_FragColor = vec4(c, gl_FrontFacing ? 0.86 : 0.96);
        #include <colorspace_fragment>
      }`,
  });
}

/** Give every named floor in a realm its shader, and set which meshes cast and catch shadows. */
export function dressRealm(scene: THREE.Object3D) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const land = /^(Ground|Dune|Hill|Ridge|Reef|Water|Ice|Volcano|Shafts|GorgeLava)/.test(o.name);
    m.castShadow = !land && !/fx\d*$/.test(o.name);
    m.receiveShadow = /^(Ground|Dune1|Dune2|Hill1|Hill2|Ridge1|Reef1|Reef2|Ice|Static)$/.test(o.name);
    const mat = m.material as THREE.MeshStandardMaterial;
    const n = mat.name;
    if (n === "SandGround") patch(mat, sand(8, 0.4));
    else if (n === "SandDune1") patch(mat, sand(4.2, 0.26));
    else if (n === "SandDune2") patch(mat, sand(2.4, 0.2));
    else if (n === "SeaGround") patch(mat, seabed(0.55));
    else if (n === "SeaReef1") patch(mat, seabed(0.4));
    else if (n === "SeaReef2") patch(mat, seabed(0.24));
    else if (n === "SnowGround" || n === "SnowHill1") patch(mat, snow, snowGlint);
    else if (n === "SnowHill2") patch(mat, snow);
    else if (n === "IceSheet") patch(mat, ice);
    else if (n === "ObsGround") patch(mat, obsidian, obsidianGlow(4.5));
    else if (n === "ObsRidge1") patch(mat, obsidian, obsidianGlow(1.6));
    else if (n === "ObsSpire") patch(mat, spire, spireGlow);
    else if (n === "WaterSurface") {
      m.material = waterMaterial();
      m.renderOrder = 2;
    }
  });
}
