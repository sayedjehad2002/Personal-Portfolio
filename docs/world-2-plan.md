# Sayed Jehad World 2: the Four Realms

Status: **shipped.** On 10 Nov 2026 the four-realm world replaced the old ice-world site at `/` (Phase 8). Sayed asked for the old site to be removed, not kept or tagged; it is only in git history (up to commit d2a1d65). The notes below are the history of how it got here, newest first; where they mention `/v2`, `qa-v2.mjs` or story mode, that was the state at the time. Screenshots of the shipped world are in `docs/play/`, the approved look renders in `docs/look/`.

Phase 7 part 2 and Phase 8 (10 Nov 2026, Sayed asked to close every gap, make the realm changes smooth, remove the old site and deploy):
- Character: elbows and knees (17 bones), all 12 animations redone with them, and he does something when he stands still (waves in the Desert, curls at the Discipline Lab, points at the AI Lab, cheers at the top). Animals have moving parts: falcon wings, camel tail, turtle flippers, ray wings, fox tail, fish tails.
- Art: weathered sandstone steps, the AI Lab as an ice cave with racks and a hologram, a layered spire with lava veins under the nest, brighter veins in the obsidian floor.
- Realm changes: the sea's look takes over as the camera sinks under the surface and lets go as it rises; the desert sky turns into the snow sky far out over the Gulf; snow hills and magma ridges rise and sink at their borders (`levelkit.hills(fade=...)`), so no realm's hills stand behind its neighbour's; his outfit changes in a puff at each gate.
- Loading: realms load one after another while he is still near the start and are compiled before they are shown. A static opening shot is in the server HTML and fades out when the Desert has drawn. A browser without WebGL 2 gets the resume as text over that shot.
- Ending: 12 more units of scroll after the top pull the camera back over the whole walk with the four realm names. An upright phone cannot fit it all, so there the shot covers Snow and Magma.
- Accessibility and polish: "Pause animations" and `prefers-reduced-motion` freeze the ambient motion (walking still works), Tab reaches every card and the world travels to it, Quick resume is back in the HUD, a slow machine steps down in quality on its own, HUD jumps no longer leave a section title standing.
- Swap: `/` is the new world, `/v2` is gone, the old world's code, tests, scripts and art are deleted, metadata, the share image and the 404 page are new.
- Checked on the production build (`npm run build:local`, headless Edge on the Intel Iris Xe GPU, sound on, nothing else drawing), with `scripts/qa-world.mjs`, `qa-world-extras.mjs` and `qa-world-jumps.mjs`. No console errors in any run; every way of moving (walk, hop up steps, jump, swim, kick, skate, ride, climb), 26 of the 27 sounds (the one that never fired is a footstep on ice, where he skates instead of stepping), the ending, Tab travel, Quick resume and Pause animations passed at all three sizes; reduced motion, no-WebGL and the 404 passed.

| Size | Frame time p50 | p95 per realm (Desert, Aqua, Snow, Magma) | Worst single frame |
|---|---|---|---|
| 1366x657 (laptop) | 13.3 ms | 13.8, 14.0, 14.0, 13.7 ms | 18.2 ms |
| 1920x969 | 13.3 ms | 13.8, 14.4, 14.3, 14.1 ms | 16.5 ms |
| 390x844 (phone emulation, touch, 2x pixels) | 13.3 ms | 13.6, 13.8, 13.7, 13.8 ms | 53.4 ms (one frame) |

  (13.3 ms is this screen's refresh interval, so the world holds the full frame rate. A first run with the Claude preview pane drawing the same world at the same time read p95 15.6 to 27.7 ms; that was the two competing for the GPU.)
- Not checked by a script, so still open: a real phone (only touch emulation on the laptop), how the music and effects sound to a person, and a play-through by Sayed. Dark mode does not apply: the site declares a light colour scheme only.

Phase 7, part 1 (10 Nov 2026, Sayed asked for phones, sound and effects):
- Phones: the same 3D world now plays on an upright phone instead of falling back to story mode (a change from the plan below). Narrow screens see 13 units of height instead of 8.1, one resume card at a time docks at the top, the HUD shrinks, a sideways swipe walks and a tap on him jumps. Checked at 390x844 with touch emulation on the laptop GPU; not yet on a real phone.
- Sound (`world3d/audio.ts`, synthesized, off by default, the HUD speaker turns it on): a short theme and an air per realm (desert wind, muffled sea, cold wind, volcano rumble), loops for skating, the cable car and the dragon's breath, and effects for steps on each ground, jump, hop, landing, splash in and out, swim kick and strokes, bubbles, the ice crack, cable car start and stop, the dragon's growl and puffs, the nest, the flag fanfare and fireworks, cards appearing, realm gates, and the camel, owl, seal and scurrying animals. Everything is muffled under water.
- Effects (`world3d/fx.ts` plus the frame loop): splashes at the water line, bubbles, ice chips and a camera dip on the ice, breath in the cold, the dragon's smoke puffs in time with its breathing, sparks under his boots and from the lava river, fireworks at the top, a blue cast under water and a glow near the lava.
- Checked with `node scripts/qa-v2.mjs` at 1366x657 and at 390x844: the audio context runs, every sound trigger fired at least once, no console errors, p95 frame time 13.8 to 15.4 ms.
- Still open: reduced-motion handling and a "Pause animations" switch, the static first frame, Tab-to-card keyboard travel, a real-phone test, checks at 1920 and in dark mode. Phase 8 (replacing the live site) waits for Sayed.

Phases 2 to 6 (10 Nov 2026, Sayed asked to go on and finish): the whole world is playable at `/v2` on the dev server, 273.5 units long, as one continuous walk.
- Desert (x 0 to 62): about me, player stats, stone steps, the three heritage cards, the shore. Aqua (62 to 124): swim over the sea bed past the degree and the five earlier roles, surface through the ice. Snow (124 to 204): skate, Discipline Lab, AI Lab, cable car over the gorge. Magma (204 to 273.5): certificates, the climb over the sleeping dragon (tail, back, neck, head), the egg nest with the contact card, the top with the flag and a camera pull-back.
- Built from `blender/scripts/level_*.py` (one per realm, sharing `levelkit.py` and `gamekit.py`), exported to `public/world/<realm>.glb` (Draco-compressed, 193 to 533 KB each) plus `<realm>.json` (floor shapes, camera heights, zones, board anchors). The game is `src/components/world3d/` (`config.ts`, `shaders.ts`, `life.ts`, `boards.tsx`, `World3D.tsx`) and reuses `world/physics.ts` unchanged.
- Checked with `node scripts/qa-v2.mjs` (Edge headless on the Intel Iris Xe GPU, 1366x657): every way of moving works, no console errors. Frame times: p50 13.3 ms; p95 14 to 16 ms per realm in most runs, with single runs up to 30 ms p95 while another process was busy.
- Not built yet (Phase 7): phone and reduced-motion story mode for the new world, the static first frame, sounds, Tab-to-board keyboard travel, light and dark and 1920 and phone checks. Phase 8 (replacing the live site) waits for Sayed.

Phase 1 (10 Nov 2026, look approved by Sayed): the character is rigged and animated. `blender/scripts/sayed.py` builds one skeleton (13 bones) with merged vertex-coloured meshes (Body, Pack, one per realm outfit, Skates) and 12 animations; `export_sayed.py` writes `public/world/sayed.glb` (668 KB, 15,748 triangles) and `blender/sayed.blend`. The dev-only viewer is `/lab/3d` (three.js + React Three Fiber, added to package.json). Waiting for Sayed's approval of the character before Phase 2.

Look pass 2 (10 Nov 2026, at Sayed's request): textured floors (sand ripples, sea-bed light net, snow sparkle, cracked ice, obsidian with glowing lava veins), richer skies (clouds and birds, the sea surface from below, rayed aurora, ash and a volcano plume), more detailed animals, dragon scales and a sleeping eye, soft bounce lighting and glow. The floor and skin patterns are procedural (`blender/scripts/surfaces.py`) and must be baked to small textures or rewritten as game shaders in Phase 2. Physics starts in Phase 2.

## The idea in one paragraph

One continuous walk through four realms, in one unbroken world: the **Desert** of Bahrain at sunrise, the **Aqua** realm under the Gulf at midday, the **Snow** peaks at blue hour, and the **Magma** mountain at night. At the end a huge dragon sleeps curled around the volcano. You climb its tail, back and horns while it breathes, reach the egg nest on the crater rim, then take the last steps to the very top. The whole journey is one day, and every realm is a chapter of the CV.

It stays "Sayed Jehad World": same person, same CV wording, same Bahrain roots, same HUD, same scroll-to-walk feel. The art and the engine underneath are rebuilt.

## What "built with Blender" means

Blender cannot run inside a web page, so it becomes the studio and the level editor:

- **Blender** makes everything you see: the character, the four realms, the dragon, the sky. It also holds the level layout (where the floor is, where each board stands, the camera path).
- **The website** (same Next.js project) plays it in real 3D with three.js (React Three Fiber), with a side-on camera on a rail, so it still plays like a side-scroller.
- **The resume boards stay as real web text** on top of the 3D world. That keeps them sharp, clickable, readable by screen readers and by Google.

Checked on 10 Nov 2026 in the headless Blender 5.2.3 session: an EEVEE render worked (640x360, 20 s including first-time shader compile), a GLB export worked, Draco and Meshopt compression are available, and Rigify is installed. Not checked yet: three.js and React Three Fiber are not installed in the project.

### The one big fork

| | A. Real-time 3D (recommended) | B. Pre-rendered 2.5D |
|---|---|---|
| How | Blender exports 3D models, the browser draws them live | Blender renders pictures and sprite sheets, the current 2D engine shows them |
| Gain | Real depth, a camera that can turn and pull back, a dragon that really breathes, sharp on any screen | Keeps today's engine almost unchanged, lowest performance risk |
| Cost | New rendering engine, needs a graphics budget and a fallback | Every animation is a pre-made image, no camera turns, heavy image downloads |

I recommend A. The dragon climb and the final pull-back over all four realms only work in real 3D.

## The four realms

Chapter ids and CV content stay as they are in `src/data/resume.ts`. Only the setting changes.

| Realm | Time of day | CV content (current level) | How you move | Signature moment |
|---|---|---|---|---|
| 1. Desert | Sunrise | About me, player stats, Bahrain heritage (levels 1 and 2) | Walk, run | The Tree of Life alone on the dunes |
| 2. Aqua | Midday | Education and earlier roles, the "Road to Lumofy" (level 2) | Swim | Each role is a pearl in an oyster that opens as you pass |
| 3. Snow | Blue hour, aurora | Values and skills, then current role, projects and stack (levels 3 and 4) | Walk, skate, cable car | Skating out of the sea onto the frozen Gulf |
| 4. Magma | Night, then stars | Certificates and contact (level 5) | Walk, climb | The "rock ridge" you are walking on starts to breathe |

### Realm 1: Desert, "Where I'm from"
- Opens straight into the world, avatar standing, small how-to-play pill. No loading screen, no drop-in.
- Golden dunes, snow-dusted palms kept as a nod to the ice world, Bab Al Bahrain as the gate, the Manama skyline far off in the haze.
- Heritage trail: Qal'at al-Bahrain, Arad Fort, the Tree of Life, the big waving Bahrain flag.
- Life: the camel with the Sadu blanket, the hare, a falcon overhead, flamingos at the shore.
- Exit: the dunes drop to a shore with dhows. You walk down the pier steps and the camera dips under the waterline.

### Realm 2: Aqua, "The Road to Lumofy"
- Bahrain's pearling story carries the timeline. The year line runs along the sea bed, and each earlier role is a pearl.
- Light shafts from the surface, drifting particles, a dhow hull passing overhead, coral gardens.
- Fish schools part around you and close behind you. Hamour, rays, a turtle, a dugong in the distance.
- He wears a diving mask and carries a pearl diver's basket.
- Exit: the water turns colder and an ice ceiling appears above. You surface through a hole in the ice.

### Realm 3: Snow, "Training and building"
- The current ice world lives here, so nothing of the identity is lost: skating on the frozen Gulf, the gym with the proof posters and the neon quote, the SKILLS hall with plyo boxes and the punching bag.
- The AI Lab moves into an ice cave. Servers like the cold. The whiteboard, stack tiles, hologram screen and drone come along.
- Exit: the red cable car leaves the valley station and crosses a gorge where snow meets black rock and steam rises.

### Realm 4: Magma, "The Dragon's Mountain"
- Obsidian paths, slow lava rivers, ember moths, small fire-lizard hatchlings that scatter as you walk.
- The reveal: the long ridge you are walking on rises and falls. It is the dragon's tail.
- The climb, all by scrolling, with no forced stops:
  1. Tail, then the hind leg.
  2. Back spines as stairs. They lift and sink slowly with each breath.
  3. The folded wing as a ramp. Certificate pennants hang along it.
  4. The neck and the horns. One eye half opens, follows you, and closes again.
  5. A smoke ring from the nostril carries you up to the crater rim.
- **The egg nest:** giant glowing eggs and the contact card with the copy-email button and the CV download.
- **The top:** a few last steps above the nest. He plants the Bahrain flag, ember fireworks go up, the sky clears to stars and aurora, and the camera pulls back to show all four realms in one shot.

## Living worlds (Sayed's request, 10 Nov 2026)

The rule: on every screen of walking, something reacts to you. Each realm has three layers of life.

- **Always moving:** the air, plants, water and light of that realm.
- **Reacts to you:** animals notice you, move, and settle again once you pass.
- **Follows your speed:** walk and the world is calm, run and it stirs.

| Realm | Animals | How they react | How the world reacts |
|---|---|---|---|
| Desert | Camel with the Sadu blanket, hare, falcon, flamingos, spiny-tailed lizard | The camel lifts its head and watches you pass. The hare bolts ahead and waits. The falcon circles, then lands on a post as you near. Flamingos take off if you run at the shore. | Footprints the wind slowly fills, swaying palms, sand lifting off dune crests when you run. |
| Aqua | Fish schools, hamour, turtle, ray, dugong, jellyfish, pearl oysters | A school parts around you and closes behind. The turtle swims beside you for a while. The ray lifts off the sand. The hamour peeks out of the coral and backs in. | A bubble trail, sea grass bending away from you, drifting light shafts, oysters opening. |
| Snow | Arctic fox, snowy owl, snow hare, seal, fish under the ice, bulbuls | The fox pounces into the snow ahead of you. The owl turns its head to follow you. The seal pops up through the ice hole. Fish shadows chase your skates. | Snow prints, breath puffs, ice spray, snow sliding off a pine when you land a jump, aurora. |
| Magma | Fire-lizard hatchlings, ember moths, a rock tortoise with glowing cracks, bats, baby dragons at the nest | Hatchlings scatter and peek back. Moths gather around you like fireflies. The tortoise pulls its head in. The dragon's eye follows you. | Stones glow under each step and cool behind you, lava bubbles pop, sparks rise faster when you run. |

Everything reactive stays ambient. Nothing blocks the scroll, and "Pause animations" stops it all.

## Clean and modern look

- **Soft for soft, sharp for hard.** Sand, snow, animals and Sayed are smooth, rounded shapes. Only rock, ice crystal and obsidian are faceted.
- **One small palette per realm** (about six colours), with his own colours constant in all four.
- **Matte surfaces and soft light.** No outlines, no noisy textures, long gentle shadows.
- **Room to breathe.** Wide sky and empty ground between set pieces.
- **Alive, not busy.** At most three moving things compete for attention on one screen.
- **Boards** become clean cards with one accent colour per realm.

## Character
- A full 3D model of Sayed built from his character sheet, in the same chunky, friendly proportions, with the beanie kept.
- One skeleton, one set of animations: idle, walk, run, skate, jump, wave, lift, point, flag, cheer (all existing), plus swim and climb (new).
- One outfit detail per realm, changed as he passes each gate: desert scarf and sunglasses, diving mask, winter jacket and beanie, a heat cloak with glowing embers.
- Kept from today: fixed screen position, no moonwalk, walk cycle locked to distance, fades when he stands in front of a board.
- `/lab` becomes the 3D pose viewer.

## Sky and background
- One sky for the whole world, blending by scroll position: sunrise gold, turquoise noon, blue hour with aurora, ember-red ash, then clear stars.
- Real depth instead of flat parallax strips: near props, the walk plane, mid hills, far mountains, sky.
- Per-realm air: heat haze, underwater light shafts and caustics, snowfall, falling ash and sparks.
- "Pause animations" still stops every ambient loop.

## What is kept, with no re-debate
- Scroll moves the world 1:1. No holds, no loading screen, no drop-in intro.
- All content from `src/data/resume.ts`, CV wording verbatim, no invented numbers.
- Phone number stays off the site. Founder OS and the Claude Code projects stay on the CV only.
- Sayed's photo in the HUD badge, the level trail, Quick resume, CV download, sound off by default.
- Phones, portrait tablets and reduced motion keep the vertical story mode. Its pictures become Blender renders of the new realms.
- The first paint stays a static picture in the server HTML: a Blender render of the exact opening shot.

## How it is built

```
blender/scripts/      Python that generates every model and level (committed)
blender/*.blend       working files (git-ignored, large)
public/world/         exported .glb models, world.json, rendered stills
src/components/world3d/   the new 3D stage
```

- The level layout comes out of Blender as `world.json` (floor shapes, board anchors, titles, camera path), so the game and the art can never drift apart. It replaces most of `spec.ts`.
- `physics.ts` is ported, not rewritten, so the feel details survive. Swim and climb are added as new modes.
- `sections.tsx` boards are reused and pinned to 3D anchor points.
- Built under a hidden `/v2` route (dev only, like `/lab`). The live site does not change until the swap.

Targets I am setting, not measurements:
- 60 fps at 1366x657 on a laptop with integrated graphics, measured per realm like the 30 Sep 2026 pass.
- Each realm's model file under 2.5 MB, loaded as you approach it.
- Nothing drawn while the camera is still.
- Automatic quality steps (resolution, glow, particles), and story mode as the fallback when WebGL is missing.

## Phases and approval gates

| Phase | What you get | Gate |
|---|---|---|
| 0. Look | One rendered still per realm and a character turnaround | You approve the style |
| 1. Character | Rigged 3D Sayed with all 12 animations in `/lab` | You approve the character |
| 2. Slice | The first two screens of the Desert playable at `/v2`, with frame times measured | It feels at least as good as today |
| 3. Desert | Full realm with boards | Review |
| 4. Aqua | Full realm with swimming | Review |
| 5. Snow | Full realm with skating, gym, lab, cable car | Review |
| 6. Magma | Dragon, climb, nest, top, final pull-back | Review |
| 7. Finish | Story mode renders, first frame, share image, sound, accessibility, QA at 1366x657, 1920x969 and phone width | Review |
| 8. Swap | Replace the old site (Sayed chose not to keep or tag it), push only when you say so | Live check |

Phases 0 to 2 are the cheap part and they answer the two big unknowns. The realms are the bulk of the work, and Magma is the largest.

## Risks
1. **Character and dragon quality.** I model through Python in a headless Blender, which suits a clean low-poly style better than fine sculpted detail. Phase 0 and 1 exist to prove this early. Fallback: start from a base mesh you pick, and I rig and animate it.
2. **Performance on ordinary laptops.** Covered by the targets above and measured in Phase 2 before any realm is built.
3. **Size of the job.** Four realms is roughly four times the art of today's world. Each realm ships to `/v2` on its own, so progress is always visible.
4. **Losing today's polish.** Physics, camera feel and the boards are ported. (The old site was removed at the swap on 10 Nov 2026, at Sayed's request; it is only in git history.)
5. **Blender session.** The headless Blender closes when the PC restarts. I relaunch it, and the scripts rebuild every scene.

## Open choices for Sayed
- The look in `docs/look/` (Phase 0 gate).
- Outfit details per realm, especially the desert one.
