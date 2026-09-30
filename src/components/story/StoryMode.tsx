"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  certificates,
  chapters,
  currentRole,
  education,
  heritage,
  liveProjectCount,
  profile,
  projects,
  roles,
  skillGroups,
  stack,
  stats,
  values,
} from "@/data/resume";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { worldStore } from "@/lib/progress";
import { Character, type CharacterHandle } from "../character/Character";
import { scrollToY, useLenis } from "../SmoothScroll";
import { snowControl } from "../Snow";
import { Icon, type IconName } from "../ui/Icon";
import { Px } from "../ui/Px";
import { SCENES } from "../world/scenes";

const NOTE_COLOURS = ["#fff3a3", "#bfe6ff", "#ffd1dc", "#c9f5d4"];

/**
 * Vertical scrollytelling for phones, portrait tablets and reduced motion.
 * Each level is a full-bleed illustration with the avatar standing in it,
 * followed by its content. The avatar walks in as the level scrolls into view
 * (on the summit it drops onto the peak instead: there is no ground to walk on).
 */
export function StoryMode({ introReady = true }: { introReady?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const playIntro = useRef<(() => void) | null>(null);
  const heroes = useRef<(CharacterHandle | null)[]>([]);
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  lenisRef.current = lenis;

  useEffect(() => {
    if (introReady) playIntro.current?.();
  }, [introReady]);

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const sections = gsap.utils.toArray<HTMLElement>("[data-level]", root.current);
      const avatars = sections.map((s) => s.querySelector<HTMLElement>("[data-avatar]"));
      const walk = sections.map(() => ({ p: reduce ? 1 : 0 }));
      const last = sections.map(() => -1);
      const near = sections.map(() => false);
      const phases = sections.map(() => 0);
      const facing = sections.map(() => 1 as 1 | -1);
      const landed = sections.map(() => false);
      // art width and px per character unit, for a walk cycle locked to the distance travelled
      const sizes = sections.map(() => ({ art: 0, unit: 0 }));
      const measure = () =>
        avatars.forEach((el, i) => {
          if (!el) return;
          sizes[i] = { art: el.parentElement?.offsetWidth ?? 0, unit: el.offsetHeight / 264 };
        });
      measure();
      window.addEventListener("resize", measure);
      const dropIn = (i: number) => SCENES[i].feet >= 1; // summit: no walkable floor at the edges

      sections.forEach((sec, i) => {
        ScrollTrigger.create({
          trigger: sec,
          start: "top 55%",
          end: "bottom 55%",
          onToggle: (self) => {
            if (self.isActive) {
              worldStore.setChapter(i);
              snowControl.intensity = reduce ? 0 : SCENES[i].snow * 0.8;
            }
          },
        });
        // Only animate avatars that are on or near the screen.
        ScrollTrigger.create({ trigger: sec, start: "top bottom+=200", end: "bottom top-=200", onToggle: (self) => (near[i] = self.isActive) });
        if (reduce) return;
        if (i > 0) gsap.fromTo(walk[i], { p: 0 }, { p: 1, ease: "none", scrollTrigger: { trigger: sec, start: "top 85%", end: "top 25%", scrub: 0.6 } });
        // Cards stay in the accessibility tree (opacity only, never visibility:hidden).
        gsap.utils.toArray<HTMLElement>("[data-rise]", sec).forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 36,
            duration: 0.7,
            ease: "back.out(1.4)",
            scrollTrigger: { trigger: el, start: "top 90%", toggleActions: "play none none reverse" },
          });
          el.addEventListener("focusin", () => gsap.to(el, { opacity: 1, y: 0, duration: 0.2, overwrite: true }));
        });
      });

      ScrollTrigger.create({
        trigger: root.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => worldStore.setProgress(self.progress),
      });
      // HUD markers at each level's real start (recomputed when the layout changes)
      const setMarks = () => {
        const total = document.documentElement.scrollHeight - window.innerHeight;
        worldStore.setCheckpoints(sections.map((s) => Math.min(1, Math.max(0, (s.offsetTop - 72) / Math.max(1, total)))));
      };
      setMarks();
      ScrollTrigger.addEventListener("refresh", setMarks);

      worldStore.setNav({
        goTo: (i, immediate) => {
          const el = sections[Math.max(0, Math.min(sections.length - 1, i))];
          if (!el) return;
          scrollToY(lenisRef.current, i === 0 ? 0 : el.getBoundingClientRect().top + window.scrollY - 72, immediate);
        },
      });

      const pose = (i: number, time: number, dt: number, moving: boolean, dir: number) => {
        if (dropIn(i)) {
          // falls onto the peak (facing the view), lands with a squash, then does the scene pose
          const drop = 1 - Math.min(1, walk[i].p * 1.4);
          const touch = drop <= 0.001;
          const impact = touch && !landed[i] ? 0.8 : 0;
          landed[i] = touch;
          heroes.current[i]?.update({ state: touch ? (walk[i].p > 0.98 ? SCENES[i].pose : "idle") : "jump", phase: 0, facing: 1, air: drop * 160, time, dt, impact });
          return;
        }
        if (moving) facing[i] = dir < 0 ? -1 : 1;
        heroes.current[i]?.update({
          state: moving ? "walk" : walk[i].p > 0.98 ? SCENES[i].pose : "idle",
          phase: phases[i],
          facing: facing[i],
          air: 0,
          time,
          dt,
        });
      };

      if (reduce) {
        // Still frame: each avatar in its scene pose, no loop running.
        sections.forEach((_, i) => {
          avatars[i]?.style.setProperty("--walk", "1");
          heroes.current[i]?.update({ state: SCENES[i].pose === "lift" ? "idle" : SCENES[i].pose, phase: 0, facing: 1, air: 0, time: 0.4, dt: 1 });
        });
        return () => {
          ScrollTrigger.removeEventListener("refresh", setMarks);
          window.removeEventListener("resize", measure);
          worldStore.setNav(null);
        };
      }

      // Level 1 is on screen at load: he walks in once the page is ready
      walk[0].p = 0;
      playIntro.current = () => {
        playIntro.current = null;
        gsap.fromTo(walk[0], { p: 0 }, { p: 1, duration: 1.8, ease: "power1.inOut", delay: 0.2 });
      };

      const tick = (time: number, deltaMs: number) => {
        const dt = Math.min(0.05, deltaMs / 1000);
        for (let i = 0; i < sections.length; i++) {
          if (!near[i]) continue;
          const p = walk[i].p;
          const dp = last[i] < 0 ? 0 : p - last[i];
          const moving = Math.abs(dp) > 0.0004;
          if (p !== last[i]) {
            last[i] = p;
            const el = avatars[i];
            if (el) {
              if (dropIn(i)) {
                el.style.setProperty("--drop", String(1 - Math.min(1, p * 1.4)));
                el.style.opacity = String(Math.min(1, p * 10));
              } else el.style.setProperty("--walk", String(p));
            }
          }
          if (!dropIn(i) && sizes[i].unit > 0) phases[i] += ((dp * SCENES[i].stand * sizes[i].art) / (68 * sizes[i].unit)) * Math.PI * 2;
          pose(i, time, dt, moving && !dropIn(i), dp);
        }
      };
      gsap.ticker.add(tick);
      return () => {
        ScrollTrigger.removeEventListener("refresh", setMarks);
        gsap.ticker.remove(tick);
        window.removeEventListener("resize", measure);
        worldStore.setNav(null);
        playIntro.current = null;
      };
    },
    { scope: root },
  );

  return (
    <div ref={root} className="bg-ink pt-[76px] text-ice-50">
      {SCENES.map((s, i) => {
        const drop = s.feet >= 1;
        return (
          <section
            key={s.id}
            data-level={i}
            aria-labelledby={`lvl-${s.id}`}
            className={i === 2 || i === 3 ? "bg-[#161d2b]" : "bg-linear-to-b from-[#1aa6f2] to-[#8fd3ff]"}
          >
            <div className="mx-auto" style={{ width: `min(100%, calc(64vh * ${s.w} / ${s.h}))` }}>
              <SceneHeader index={i} />
            </div>
            {/* Art box keeps the image's aspect so the avatar coordinates hold; capped (and framed) on wide screens. */}
            <div
              className="relative mx-auto overflow-hidden md:rounded-2xl md:border-4 md:border-white/70 md:shadow-[0_24px_60px_-20px_rgba(4,20,45,0.6)]"
              style={{ width: `min(100%, calc(64vh * ${s.w} / ${s.h}))`, aspectRatio: `${s.w} / ${s.h}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.src} alt={s.alt} width={s.w} height={s.h} loading={i < 2 ? "eager" : "lazy"} className="block h-full w-full" />
              {s.id === "ai-lab" && (
                <div aria-hidden="true" className="absolute grid grid-cols-2 gap-[3%]" style={{ left: "51%", top: "26%", width: "33%", height: "32%" }}>
                  {NOTE_COLOURS.map((c, k) => (
                    <span key={c} className="rounded-[2px] shadow-sm" style={{ background: c, rotate: `${[-3, 2, 1.5, -2][k]}deg` }} />
                  ))}
                </div>
              )}
              <div
                data-avatar
                aria-hidden="true"
                className="absolute"
                style={{
                  left: drop ? `${(s.stand * 100).toFixed(2)}%` : `calc(${(s.stand * 100).toFixed(2)}% * var(--walk, 1) - 4%)`,
                  top: `${((s.standFeet ?? s.feet) * 100).toFixed(2)}%`,
                  height: "30%",
                  aspectRatio: "200 / 264",
                  transform: drop ? "translate(-38%, calc(-98.5% - var(--drop, 0) * 120%))" : "translate(-38%, -98.5%)",
                }}
              >
                <Character
                  ref={(h) => {
                    heroes.current[i] = h;
                  }}
                  className="h-full w-full"
                />
              </div>
            </div>
            <div className="mx-auto grid max-w-2xl gap-4 px-4 pb-14 pt-6">
              <LevelContent index={i} />
            </div>
          </section>
        );
      })}
      <footer className="bg-ink px-4 pb-10 pt-6 text-center text-xs text-ice-200/80">
        © {new Date().getFullYear()} {profile.name} · Built with Next.js, GSAP and Lenis
      </footer>
    </div>
  );
}

function SceneHeader({ index }: { index: number }) {
  const c = chapters[index];
  return (
    <div className="flex items-end justify-between gap-3 px-4 pb-3 pt-8">
      <div>
        <p className="mb-1 inline-block rounded-md bg-ink/75 px-2 py-0.5">
          <Px className="text-[12px] text-gold">{`Level ${c.level}`}</Px>
        </p>
        <h2 id={`lvl-${c.id}`} className="font-display text-[34px] leading-none tracking-wide text-white text-outline">
          {c.name}
        </h2>
      </div>
      <p className="max-w-[52%] rounded-lg bg-ink/70 px-2.5 py-1 text-right text-sm font-bold text-balance text-white">{c.tagline}</p>
    </div>
  );
}

function Card({ children, tone = "frost", className = "" }: { children: ReactNode; tone?: "frost" | "night" | "wood"; className?: string }) {
  return (
    <div data-rise className={`${tone} p-4 ${className}`}>
      {children}
    </div>
  );
}

const HERITAGE_ART: Record<string, string> = {
  qalat: "/props/heritage/qalat-al-bahrain.svg",
  arad: "/props/heritage/arad-fort.svg",
  tree: "/props/heritage/tree-of-life.svg",
};

const ROUTE_ICONS: IconName[] = ["target", "target", "users", "users", "users"];

function LevelContent({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <>
          <Card>
            <Px className="text-[12px] text-[#0c69ad]">Player 1 · Ready</Px>
            <p className="mt-1 font-display text-4xl leading-[0.95] tracking-wide text-ink">{profile.name}</p>
            <p className="mt-1.5 font-bold text-ink/80">{profile.subtitle}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink/80">{profile.summary}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {profile.tags.map((t) => (
                <li key={t} className="rounded-lg border-2 border-ice-300 bg-ice-100 px-2 py-0.5 text-xs font-extrabold text-[#0c69ad]">
                  {t}
                </li>
              ))}
            </ul>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="text-ink/70">{s.label}</dt>
                  <dd className="font-display text-2xl text-ink">{s.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <p className="flex items-center justify-center gap-2 text-sm font-bold text-ink/85">
            <Icon name="mouse-scroll" className="animate-bob size-5 pointer-coarse:hidden" />
            <Icon name="caret-double-down" className="animate-bob hidden size-5 pointer-coarse:inline" />
            <span className="pointer-coarse:hidden">Scroll to start the climb</span>
            <span className="hidden pointer-coarse:inline">Swipe up to start the climb</span>
          </p>
        </>
      );
    case 1:
      return (
        <>
        {/* the Bahrain heritage trail, as in the world */}
        <section data-rise aria-labelledby="heritage-title" className="heritage-card p-4 pt-5">
          <h3 id="heritage-title" className="font-display text-2xl tracking-wide">Bahrain heritage</h3>
          <ul className="mt-2 grid gap-3">
            {heritage.map((h) => (
              <li key={h.id} className="flex gap-3">
                <img src={HERITAGE_ART[h.id]} alt="" aria-hidden="true" className="h-14 w-20 shrink-0 object-contain" />
                <div>
                  <p className="flex flex-wrap items-baseline gap-x-2 font-bold">
                    {h.name}
                    <span lang="ar" dir="rtl" className="font-bold text-[#8a1f24]">
                      {h.arabic}
                    </span>
                  </p>
                  <p className="text-sm leading-snug text-[#4a3018]">{h.fact}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <ol className="grid gap-3">
          <li>
            <Card>
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border-[3px] border-wood-2 bg-gold text-ink">
                  <Icon name="graduation-cap" className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-extrabold tabular-nums text-[#0c69ad]">{education.period}</p>
                  <h3 className="font-display text-xl leading-tight tracking-wide text-ink">{education.title}</h3>
                  <p className="text-sm font-bold text-ink/75">
                    {education.school} · {education.minor}
                  </p>
                </div>
              </div>
            </Card>
          </li>
          {roles.map((r, k) => (
            <li key={r.id}>
              <Card>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border-[3px] border-wood-2 bg-gold text-ink">
                    <Icon name={ROUTE_ICONS[k]} className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-extrabold tabular-nums text-[#0c69ad]">{r.period}</p>
                    <h3 className="font-display text-xl leading-tight tracking-wide text-ink">
                      {r.title}
                      <span className="sr-only"> at {r.company}</span>
                    </h3>
                    <p className="text-sm font-bold text-ink/75">
                      {r.company}
                      {r.companyNote ? ` · ${r.companyNote}` : ""}
                    </p>
                    <ul className="mt-2 grid gap-1 text-sm leading-snug text-ink/85">
                      {r.points.map((p) => (
                        <li key={p} className="flex gap-2">
                          <Icon name="snowflake" className="mt-[3px] size-3.5 shrink-0 text-ice-500" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
        </>
      );
    case 2:
      return (
        <>
          {values.map((v) => (
            <Card key={v.motto} tone="night">
              <h3 className="font-display text-xl uppercase leading-none tracking-wide text-white">{v.motto}</h3>
              <p className="mt-2 text-sm leading-snug text-ice-100">{v.proof}</p>
            </Card>
          ))}
          <Card tone="night">
            <h3 className="flex items-center gap-2 font-display text-2xl tracking-wide text-white">
              <Icon name="barbell" className="size-5 text-flag" /> Skill loadout
            </h3>
            {skillGroups.map((g) => (
              <div key={g.id} className="mt-3">
                <p className="text-[12px] font-extrabold tracking-[0.1em] text-ice-200 uppercase">{g.name}</p>
                <ul className="mt-1.5 grid gap-1.5">
                  {g.skills.map((s) => (
                    <li key={s} className="flex items-center gap-2 rounded-lg border border-ice-300/25 bg-white/5 px-2.5 py-1.5 text-sm font-semibold text-ice-50">
                      <span className="size-2 shrink-0 rotate-45 bg-ice-300" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>
        </>
      );
    case 3:
      return (
        <>
          <Card>
            <p className="text-xs font-extrabold tracking-[0.1em] text-[#0c69ad] uppercase">
              Current quest · <span className="tabular-nums">{currentRole.period}</span>
            </p>
            <h3 className="font-display text-3xl leading-none tracking-wide text-[#1d3f8f]">{currentRole.title}</h3>
            <p className="mt-1 font-bold text-flag-2">
              {currentRole.company} · {currentRole.companyNote}
            </p>
            <ul className="mt-2 grid gap-1 text-sm leading-snug text-ink/85">
              {currentRole.points.map((p) => (
                <li key={p} className="flex gap-2">
                  <Icon name="lightning" weight="fill" className="mt-[3px] size-3.5 shrink-0 text-ice-600" />
                  {p}
                </li>
              ))}
            </ul>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((p, k) => (
              <article
                key={p.id}
                data-rise
                style={{ background: NOTE_COLOURS[k] }}
                className="relative rounded-md p-4 text-ink shadow-[0_10px_18px_-8px_rgba(0,0,0,0.45)]"
              >
                <p className="text-[12px] font-extrabold tracking-[0.08em] text-ink/75 uppercase">{p.kind}</p>
                <h3 className="font-display text-xl leading-tight tracking-wide">{p.name}</h3>
                <p className="mt-0.5 text-sm leading-snug text-ink/85">{p.blurb}</p>
                {p.href && (
                  <a href={p.href} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-extrabold text-[#1d3f8f] underline decoration-2 underline-offset-2">
                    {p.hrefLabel} <Icon name="arrow-up-right" className="size-3.5" />
                  </a>
                )}
              </article>
            ))}
          </div>
          <p className="text-center text-sm font-bold text-ice-100">
            {projects.length} of {liveProjectCount} live projects shown
          </p>
          <Card tone="night" className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[12px] font-extrabold tracking-[0.1em] text-ice-200 uppercase">Stack</span>
            {stack.map((s) => (
              <span key={s} className="rounded-lg border border-ice-300/30 bg-white/10 px-2.5 py-1 text-sm font-bold text-white">
                {s}
              </span>
            ))}
          </Card>
        </>
      );
    case 4:
      return (
        <>
          <Card tone="night">
            <h3 className="flex items-center gap-2 font-display text-2xl tracking-wide text-white">
              <Icon name="trophy" className="size-5 text-gold" /> Certificates on the way up
            </h3>
            <ul className="mt-3 grid gap-2">
              {certificates.map((c) => (
                <li key={c.name} className="flex items-start gap-2.5 rounded-xl border border-gold/25 bg-gold/5 px-3 py-2">
                  <Icon name="medal" weight="fill" className="mt-0.5 size-5 shrink-0 text-gold" />
                  <div className="leading-tight">
                    <p className="text-sm font-bold text-ice-50">{c.name}</p>
                    <p className="text-xs text-ice-100/80">{[c.issuer, c.year].filter(Boolean).join(" · ")}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <Px className="text-[12px] text-[#0c69ad]">Level 5 · Complete</Px>
            <h3 className="mt-1 font-display text-4xl leading-[0.95] tracking-wide text-ink">You reached the top!</h3>
            <p className="mt-2 font-semibold text-ink/80">Hiring for AI-powered internal tools, HR tech, or someone who ships end to end? Let’s talk.</p>
            <div className="mt-5 grid gap-3">
              <a className="game-btn justify-center" data-tone="linkedin" href={profile.linkedin} target="_blank" rel="noreferrer">
                <Icon name="linkedin" weight="fill" className="size-5" /> Connect on LinkedIn
              </a>
              <a className="game-btn justify-center" href={profile.cvHref} download>
                <Icon name="file-arrow-down" className="size-5" /> Download CV
              </a>
              <a className="game-btn justify-center !text-base" data-tone="ice" href={`mailto:${profile.email}`}>
                <Icon name="envelope" className="size-5" /> Email me
              </a>
            </div>
            <p className="mt-3 text-center text-sm font-semibold text-ink/75">{profile.email}</p>
          </Card>
        </>
      );
    default:
      return null;
  }
}
