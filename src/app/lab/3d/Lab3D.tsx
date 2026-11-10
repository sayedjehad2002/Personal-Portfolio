"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import type { Group, Mesh, SkinnedMesh } from "three";

// Exported from Blender by blender/scripts/export_sayed.py.
const MODEL = "/world/sayed.glb";

const ANIMS = ["idle", "walk", "run", "skate", "jump", "wave", "lift", "point", "flag", "cheer", "swim", "climb"] as const;
type Anim = (typeof ANIMS)[number];

// Each realm shows its outfit meshes and lights him the way that realm does (colours from blender/scripts/look_*.py).
const REALMS = {
  desert: { label: "Desert", layers: ["Pack", "Desert"], sky: ["#8DB7DB", "#FCE9C8"], floor: "#EEC88F", sun: "#FFE2B8", fill: "#C6D6EC", power: 2.6, dark: false },
  aqua: { label: "Aqua", layers: ["Aqua", "Aqua_glow"], sky: ["#62D2D2", "#147590"], floor: "#86CDBE", sun: "#EAFFF7", fill: "#49BCC8", power: 2.3, dark: false },
  snow: { label: "Snow", layers: ["Pack"], sky: ["#596DB6", "#DCCFE6"], floor: "#EAF1FB", sun: "#D5E3FF", fill: "#7088CC", power: 2.1, dark: false },
  magma: { label: "Magma", layers: ["Pack", "Magma", "Magma_glow"], sky: ["#140B1B", "#93302A"], floor: "#2E2632", sun: "#FF9552", fill: "#4A2C48", power: 2.3, dark: true },
} as const;
type Realm = keyof typeof REALMS;

type Stats = { triangles: number; bones: number; clips: number };

function Sayed({ anim, realm, speed, onStats }: { anim: Anim; realm: Realm; speed: number; onStats: (s: Stats) => void }) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(MODEL);
  const { actions } = useAnimations(animations, group);

  // what the file really holds, counted from the loaded model
  useEffect(() => {
    let triangles = 0;
    let bones = 0;
    scene.traverse((o) => {
      const m = o as SkinnedMesh;
      if (!m.isMesh) return;
      triangles += (m.geometry.index?.count ?? 0) / 3;
      bones = Math.max(bones, m.skeleton?.bones.length ?? 0);
      m.castShadow = true;
      m.frustumCulled = false; // the bind-pose bounds don't cover the swim pose
    });
    onStats({ triangles, bones, clips: animations.length });
  }, [scene, animations, onStats]);

  // for QA scripts (this page only exists in dev)
  useEffect(() => {
    (window as unknown as { __lab3d?: unknown }).__lab3d = { scene, actions };
  }, [scene, actions]);

  useEffect(() => {
    const show = new Set<string>(["Body", "Body_glow", ...REALMS[realm].layers, ...(anim === "skate" ? ["Skates"] : [])]);
    scene.traverse((o) => {
      if ((o as Mesh).isMesh) o.visible = show.has(o.name);
    });
  }, [scene, realm, anim]);

  useEffect(() => {
    const action = actions[anim];
    if (!action) return;
    action.reset().fadeIn(0.25).play();
    return () => {
      action.fadeOut(0.25);
    };
  }, [actions, anim]);

  useEffect(() => {
    for (const a of Object.values(actions)) if (a) a.timeScale = speed;
  }, [actions, speed]);

  // he faces +X; turn him a little towards the camera, and float him while he swims
  return <primitive ref={group} object={scene} rotation-y={-0.5} position-y={anim === "swim" ? 0.75 : 0} />;
}
useGLTF.preload(MODEL);

function Chip({ on, dark, onClick, children }: { on: boolean; dark: boolean; onClick: () => void; children: React.ReactNode }) {
  const idle = dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-slate-900/[0.06] text-slate-800 hover:bg-slate-900/[0.12]";
  const active = dark ? "bg-white text-slate-900" : "bg-slate-900 text-white";
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${on ? active : idle}`}
    >
      {children}
    </button>
  );
}

export function Lab3D() {
  const [anim, setAnim] = useState<Anim>("walk");
  const [realm, setRealm] = useState<Realm>("snow");
  const [slow, setSlow] = useState(false);
  const [turn, setTurn] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const r = REALMS[realm];
  const background = useMemo(() => `linear-gradient(180deg, ${r.sky[0]} 0%, ${r.sky[1]} 62%, ${r.floor} 62%)`, [r]);
  const ink = r.dark ? "text-white" : "text-slate-900";
  const panel = r.dark ? "bg-black/35 ring-white/15" : "bg-white/70 ring-slate-900/10";

  return (
    <main className={`relative h-dvh w-full overflow-hidden transition-colors ${ink}`} style={{ background }}>
      <Canvas flat shadows dpr={[1, 2]} camera={{ position: [0, 1.0, 8.4], fov: 26 }} gl={{ antialias: true, alpha: true }}>
        <hemisphereLight args={[r.fill, r.floor, 1.6]} />
        <directionalLight position={[3.2, 5, 4.5]} intensity={r.power} color={r.sun} castShadow shadow-mapSize={[1024, 1024]} />
        <Suspense fallback={null}>
          <Sayed anim={anim} realm={realm} speed={slow ? 0.35 : 1} onStats={setStats} />
        </Suspense>
        <ContactShadows position={[0, 0.001, 0]} opacity={r.dark ? 0.6 : 0.32} scale={7} blur={2.2} far={2.4} />
        <OrbitControls
          target={[0, 0.45, 0]}
          enablePan={false}
          minDistance={4}
          maxDistance={12}
          minPolarAngle={0.9}
          maxPolarAngle={1.62}
          autoRotate={turn}
          autoRotateSpeed={3}
        />
      </Canvas>

      <header className="pointer-events-none absolute left-5 top-4">
        <h1 className="text-lg font-semibold tracking-tight">Sayed 3D lab</h1>
        <p className="text-sm opacity-70">World 2 character. Drag to turn him.</p>
      </header>
      {stats && (
        <p className="pointer-events-none absolute right-5 top-5 text-sm tabular-nums opacity-70" data-stats>
          {stats.triangles.toLocaleString("en-US")} triangles · {stats.bones} bones · {stats.clips} animations
        </p>
      )}

      <section className={`absolute inset-x-0 bottom-4 mx-auto flex w-[min(100%-2rem,56rem)] flex-col gap-3 rounded-2xl p-4 ring-1 ${panel}`}>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Animation">
          <span className="w-20 text-xs font-semibold uppercase tracking-wide opacity-60">Animation</span>
          {ANIMS.map((a) => (
            <Chip key={a} on={anim === a} dark={r.dark} onClick={() => setAnim(a)}>
              {a}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Realm outfit">
          <span className="w-20 text-xs font-semibold uppercase tracking-wide opacity-60">Realm</span>
          {(Object.keys(REALMS) as Realm[]).map((k) => (
            <Chip key={k} on={realm === k} dark={r.dark} onClick={() => setRealm(k)}>
              {REALMS[k].label}
            </Chip>
          ))}
          <span className="mx-1 h-5 w-px bg-current opacity-20" />
          <Chip on={slow} dark={r.dark} onClick={() => setSlow((v) => !v)}>
            Slow motion
          </Chip>
          <Chip on={turn} dark={r.dark} onClick={() => setTurn((v) => !v)}>
            Turntable
          </Chip>
        </div>
      </section>
    </main>
  );
}
