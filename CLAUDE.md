# Sayed Jehad World (Porto 2)

Sayed's personal portfolio: a 3D side-scrolling interactive resume, one continuous walk through four realms (Desert, Aqua, Snow, Magma) that ends with a climb over a sleeping dragon to the egg nest and the top. Personal project, not a Lumofy product, so Lumofy brand rules do not apply here.

It replaced the earlier ice-themed 2D site on 10 Nov 2026, at Sayed's request. He did not want the old site kept: its code, tests and art were deleted and it was not tagged (it is only in git history, up to commit d2a1d65). Do not bring it back.

## Stack and commands
- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5.9 · Tailwind 4 · three 0.187 + @react-three/fiber 9 + @react-three/drei 10 · Lenis 1.3 · Phosphor icons · Blender 5.2 for the models.
- `npm run dev` (port 3000, also in `.claude/launch.json` as "dev") · `npm run typecheck` · `npm run build`.
- Stop the dev server before `npm run build` (they share `.next`). `npm run build:local` + `npm run start:local` (launch config "prod", port 3001) build and serve a production copy in `.next-prod` beside a running dev server; stop "prod" before building again.
- Repo: `github.com/sayedjehad2002/Personal-Portfolio` (Sayed's personal GitHub account `sayedjehad2002`), branch `main`. A push to `main` deploys to Vercel production (Sayed's personal team `sayed-jehad-personal-new`, project `personal-portfolio`): live at https://sayedjehad-portfolio.vercel.app. Push only when Sayed asks in the current turn. `.vercelignore` keeps `blender/`, `docs/`, `scripts/` and the reference folder out of an upload; set `NEXT_PUBLIC_SITE_URL` if the domain is not the Vercel production one (metadata, robots, sitemap use `src/lib/site.ts`).

## Settled decisions (no re-debate)
- Scroll maps 1:1 to where he is. No holds, no loading screen, no drop-in intro: the page opens straight into the world.
- Content lives only in `src/data/resume.ts`, taken from the CV (wording kept verbatim, incl. serial commas). No invented numbers. The phone number is not shown on the site (it is in the PDF). Founder OS is confidential: only the public-safe wording already in `resume.ts`.
- Every realm feels alive (animals that react to him) and the look stays clean and modern: see the living-world and clean-look rules in `docs/world-2-plan.md`. The approved look renders are in `docs/look/`.

## The walk (x runs 0 to 273.5, one coordinate for all four realms)
- **Desert** 0-62, title ABOUT ME: cards about, stats, Qal’at al-Bahrain, Tree of Life, Arad Fort. Sandstone steps at x 24-31. Camel, hare, falcon, flamingos.
- **Aqua** 62-124, title ROAD TO LUMOFY: he wades in, swims (zone 63.2-123.2) past education and the five earlier roles, then stands under the hole in the ice and hops out. Fish schools, turtle, ray, hamour, dugong, jellyfish.
- **Snow** 124-204, titles DISCIPLINE LAB and AI LAB: skating on the frozen Gulf (124-141.4), values, skills, current role, projects, stack, then the cable car (190.5-203.5) over the gorge. Owl, fox, hare, seal.
- **Magma** 204-273.5, title DRAGON'S MOUNTAIN: certificates, the climb over the dragon (tail at 226, head at 261), the nest with the contact card (266.6), the flag at the top (273.3). Lizards, the dragon breathes.
- **Epilogue**: `EPILOGUE` (12) more units of scroll after the top pull the camera back over the whole walk with the four realm names (an upright phone only fits Snow and Magma).

## Game side: `src/components/world3d/`
- `World3D.tsx` is the stage and the frame loop. Scroll (Lenis, float `animatedScroll`) gives x; `physics.ts` + `solids.ts` (a small 2D body on two feet, fed centimetres with y down) give y; zones from the realm JSONs switch how he moves (swim, skate, ride, climb). It also drives the camera (side-on, lens shifted up, follows a height profile, shake spring), the sky and light cross-fade, outfits, prints/dust/bubbles, the cards, the HUD, the epilogue and the QA hook `window.__world` (`sim`, `goto(x)`, `stats()`, `audio()`).
- `config.ts` merges `public/world/<realm>.json` (solids, camera height profile, zones, anchors, titles, life) and holds each realm's sky, light, outfit layers and accent. `realmWeights(x, under, out)`: realms cross-fade by place, except the sea, whose look takes over as the camera sinks below the surface. `gestureAt(x)`: what he does after standing still 1.6 s (wave, lift, point; cheer at the top).
- `shaders.ts` patches floors and hills by material name with `onBeforeCompile` (`SandGround`, `SandDune1-4`, `SeaGround`, `SeaReef1-3`, `WaterSurface`, `SnowGround`, `SnowHill1-3`, `IceSheet`, `ObsGround`, `ObsRidge1-3`, `ObsSpire`) and wiggles the instanced fish. A glTF export cannot carry Blender's procedural materials, glow sheets or bloom, so those live here.
- `life.ts` finds animals by node name (`Camel.head`, `Falcon.wingL`, `Turtle.flipL`, `Fox.tail` ... the exporter drops the dot) and makes them move and react. `boards.tsx` holds the resume cards (DOM, pinned to anchors, `data-x` so Tab can travel to them). `fx.ts` is one instanced particle pool. `audio.ts` synthesizes everything (a theme and an air per realm, loops, one-shots, muffled under water); it shares the on/off switch of `lib/sfx.ts`, is off by default and counts every trigger in `audio.counts` for QA.
- First paint: `FirstFrame` (a `<picture>` of `public/world/first-frame.jpg` / `first-frame-phone.jpg`, preloaded in `page.tsx`) is in the server HTML and fades out once the Desert has drawn. No WebGL 2: `PlainResume` (the opening shot + `ResumeText`).
- Loading: the Desert first, then the other realms one after another about 1.2 s apart (at once if he jumps ahead), each compiled with `gl.compileAsync` before it is shown, so no realm loads while he walks into it. Realms more than 95 units from the camera are hidden.
- Calm mode (`sim.calm`): "Pause animations" (`lib/motion.ts`) or `prefers-reduced-motion` freeze the ambient clock (animals, water, snow, embers, breath, shake); walking still works.
- Quality tiers: if the median frame time stays above 27 ms, the pixel ratio and shadow map drop, then shadows go off (`sim.qa.quality`).
- Inputs: wheel / trackpad, hold ← → or A D (Shift hurries), ↑ / W / Space or a click on him jumps (a kick upwards in the water), sideways touch swipes. Phones run the same 3D world: `viewHFor` shows up to 13 units of height, one card docks at a time, the realm chips move to a second row.
- Kept from before: `SmoothScroll.tsx` (Lenis), `QuickResume.tsx`, `ui/Icon.tsx`, `ui/WheelHint.tsx`, `lib/sfx.ts`, `lib/motion.ts`, `lib/site.ts`, `data/resume.ts`.
- `/lab/3d` (dev only, 404 in production) shows the character's 12 animations and 4 outfits.

## Blender side: `blender/scripts/*.py` generate everything
- `kit.py` helpers, `surfaces.py` look-render materials, `sayed.py` + `export_sayed.py` the rigged character (`public/world/sayed.glb`: 17 bones with elbows and knees, 12 animations, outfit layers toggled by mesh name), `level_<realm>.py` + `levelkit.py` + `gamekit.py` each realm's `public/world/<realm>.glb` (Draco; the decoder is in `public/draco/`) and `<realm>.json`, `props*.py` / `life*.py` / `dragon.py` the pieces, `look_*.py` the look renders.
- Run them inside Blender 5.2 through the Blender MCP: start it headless with `blender.exe --background --command blender_mcp` (port 9876; no window, so only renders and exports work). In `execute_blender_code`: put `blender/scripts` on `sys.path`, `importlib.reload` the modules in dependency order (kit, surfaces, sayed, gamekit, levelkit, props*, life*, dragon, level_*), then call `level_<realm>.export(r"...\public\world")` inside `logging.disable(logging.CRITICAL)` and `contextlib.redirect_stdout`, or the output floods the tool.
- World axes: X along the walk, Y into the screen, Z up. `levelkit.hills(..., fade=(in0, in1, out0, out1))` makes a realm's hill rows rise and sink at its borders, so one realm's hills never stand behind its neighbour's (the Desert dunes do the same with `shore`).

## QA
- `node scripts/qa-world.mjs [outDir] [width] [height]` (a server must be running; `QA_URL=http://localhost:3001/` for the production copy) walks the whole world in headless Edge on the real GPU with the sound on, checks each way of moving, each sound trigger, the epilogue, Tab travel, Quick resume and Pause animations, writes screenshots and prints frame times. A width under 700 runs it as a phone. `qa-world-extras.mjs`: server HTML, reduced motion, no WebGL, 404. `qa-world-jumps.mjs`: the HUD realm chips. `qa-world-trace.mjs` and `qa-world-frames.mjs` are narrower helpers. `first-frame.mjs` remakes the opening shots and `src/app/opengraph-image.jpg` (run it against the production copy, then rebuild).
- The Claude browser pane pauses `requestAnimationFrame` when hidden, so use these scripts for anything 3D.
- Measured 10 Nov 2026 on Sayed's laptop (Intel Iris Xe, headless Edge, production build): see the table in `docs/world-2-plan.md`.
- Not checked by a script: a real phone, and how it sounds and feels to a person.

## Gotchas found
- Lenis' `targetScroll` equals `animatedScroll` while a key is held, so the physics is told "unknown" then (it hops at the step).
- `camera.lookAt` leaves `matrixWorldInverse` half updated; call `updateMatrixWorld()` before projecting points in the same frame.
- If new Tailwind classes do not appear on a new route, stop the dev server, delete `.next` and start it again. After deleting routes, delete `.next`, `.next-prod` and `tsconfig.tsbuildinfo` (stale generated types fail the typecheck).
- Bash heredocs with Python triple quotes break here: write the script to a file and run it.
