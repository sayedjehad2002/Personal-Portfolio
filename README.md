# Sayed Jehad World

An ice-themed, side-scrolling interactive resume in the spirit of Robby Leonardi's. Scroll (or use ← →) and Sayed's avatar walks through five levels. The world moves 1:1 with the wheel, he turns round when you scroll back up, and he stops when you stop.

1. **Base Camp**: who he is, the player card and stats.
2. **Bahrain**: through Bab Al Bahrain and Manama, along a heritage trail (Qal’at al-Bahrain, Arad Fort, the Tree of Life and the flag), then skating the frozen Gulf past his education and every earlier role.
3. **Discipline Lab**: the gym, with the proof of each value printed on its poster, then a skills inventory, plyo boxes and a punching bag.
4. **AI Lab**: the current role, the live projects on the whiteboard, and the stack.
5. **The Summit**: a cable car up the Ice Mountain past the certificates, then the flag, LinkedIn, CV and email.

Phones, portrait tablets and `prefers-reduced-motion` get a vertical story version with the same content. A plain-text "Quick resume" is one click (or one Tab) away everywhere. Sound effects are optional and off by default, and the HUD can pause the ambient animations.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. `/lab` (dev only) shows every avatar pose. Stop the dev server before `npm run build`, because both use `.next`.

## Test it

```bash
npm run build
npm run test:e2e
```

Playwright (with the Chrome installed on the machine) starts the production server on port 3100 and checks that the world opens with the mouse-wheel hint, the wheel walks the avatar, the summit contact card, keyboard access to the in-world links, the Quick resume dialog, phone story mode, the CV download, the 404 page, and axe-core accessibility scans in both modes.

## Deploy

Built for Vercel. Set `NEXT_PUBLIC_SITE_URL` to the final domain if it is not the Vercel production domain (share previews, robots and sitemap use it). `.vercelignore` keeps the reference material out of the upload.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · GSAP 3 + ScrollTrigger · Lenis · Phosphor icons. See `CLAUDE.md` for how the engine works.
