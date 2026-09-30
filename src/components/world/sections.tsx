"use client";

/* eslint-disable @next/next/no-img-element */
import { memo, useState, type CSSProperties, type ReactNode } from "react";
import { certificates, currentRole, education, heritage, profile, projects, roles, skillGroups, stack, stats, values } from "@/data/resume";
import { worldStore } from "@/lib/progress";
import { focusHudLevel, openQuickResume } from "../Hud";
import { Icon, type IconName } from "../ui/Icon";
import { Px } from "../ui/Px";
import type { World } from "./spec";

/**
 * Resume content placed in the world. Every [data-pop] element animates in
 * (rise / drop / pop / slide / swing) when its data-x reaches the right side
 * of the screen, and back out once it is behind you, replaying whenever it
 * re-enters from either side, like the boards in Robby Leonardi's resume.
 * [data-item] children stagger in afterwards.
 */

function Pop({
  x,
  kind = "rise",
  style,
  className = "",
  zoom = 1,
  children,
}: {
  x: number;
  kind?: "rise" | "drop" | "pop" | "slide" | "swing";
  style: CSSProperties;
  className?: string;
  /** scale the board up on tall screens (from its top centre, so it stays on its anchor) */
  zoom?: number;
  children: ReactNode;
}) {
  return (
    <div data-pop={kind} data-x={Math.round(x)} className={`absolute ${className}`} style={style}>
      {zoom !== 1 ? <div style={{ transform: `scale(${zoom})`, transformOrigin: "50% 0" }}>{children}</div> : children}
    </div>
  );
}

/** Two wooden posts from the bottom of a board down into the ground. */
function Posts({ height, zoom = 1 }: { height: number; zoom?: number }) {
  height /= zoom;
  return (
    <div aria-hidden="true" className="absolute inset-x-[18%] top-full flex justify-between" style={{ height }}>
      {[0, 1].map((k) => (
        <span key={k} className="block w-[clamp(10px,1.5vh,16px)] rounded-b-sm border-x-2 border-[#3a200c] bg-linear-to-r from-wood-3 via-wood to-wood-2" />
      ))}
    </div>
  );
}

function Ribbon({ children, tone = "wood", color }: { children: ReactNode; tone?: "wood" | "red"; color?: string }) {
  return (
    <div
      className={`absolute -top-5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border-[3px] px-4 py-1 font-display text-[clamp(15px,2.3vh,24px)] tracking-wide text-white tabular-nums shadow-[0_6px_0_-2px_rgba(0,0,0,0.35)] ${
        color ? "" : tone === "red" ? "border-[#7a0d12] bg-flag" : "border-[#4a2a12] bg-wood"
      }`}
      style={{ textShadow: "0 2px 0 rgba(0,0,0,0.35)", ...(color ? { background: color, borderColor: "rgb(0 0 0 / 0.45)" } : {}) }}
    >
      {children}
    </div>
  );
}

const txt = "text-[clamp(12px,1.6vh,15.5px)] leading-snug";
/** Player 1's character sheet: who he is (the counts are on the stat crystals just ahead). */
const SHEET: { icon: IconName; label: string; value: string }[] = [
  { icon: "robot", label: "Class", value: currentRole.title },
  { icon: "buildings", label: "Guild", value: `${currentRole.company} · ${currentRole.companyNote}` },
  { icon: "graduation-cap", label: "Trained at", value: education.school },
  { icon: "map-pin", label: "Home", value: profile.base },
  { icon: "translate", label: "Languages", value: profile.languages.join(" · ") },
];
const STOP_ICONS: IconName[] = ["graduation-cap", "target", "target", "users", "users", "users"];
const NOTE_COLOURS = ["#fff3a3", "#bfe6ff", "#ffd1dc", "#c9f5d4"];
/** An item icon per skill, like slots in a game inventory (same order as skillGroups). */
const SKILL_ICONS: IconName[][] = [
  ["code", "sparkle", "database", "rocket", "flow-arrow"],
  ["users", "kanban", "handshake", "chart-line-up", "notebook"],
];
/** One colour per place on the road to Lumofy, so the employers read apart at a glance. */
const COMPANY: Record<string, string> = {
  "University of Bahrain": "#94650f",
  "Takhlees Mobile Application": "#0b7d72",
  "Vamonos Hygiene Services": "#25774a",
  Lumofy: "#215bea",
};
/** First date of a period, for the year markers in the ice ("09/2025 – 02/2026" → "09/2025"). */
const startOf = (period: string) => period.split("–")[0].trim();

export const Sections = memo(function Sections({ world: W }: { world: World }) {
  const u = W.u;
  const a = W.anchors;
  const R = W.ride;
  const boardW = (f: number, min = 300, max = 560) => Math.max(min, Math.min(max, f * u));
  /** board top in screen px, kept clear of the HUD (its ribbon pokes 20px above the board) */
  const safe = (f: number) => Math.max(f * u, 104);
  /** boards (px-sized, readable at laptop heights) grow with tall screens: 1 up to ~950px tall, max 1.6 */
  const Z = Math.min(1.6, Math.max(1, W.vh / 950));

  const playerW = boardW(0.56, 320, 470);
  const playerTop = safe(0.14);
  const aboutW = boardW(0.62, 320, 520);
  const aboutTop = safe(0.2);
  const crystalGap = u * 0.2;
  const crystalMax = u * 0.42;
  const stopW = boardW(0.8, 340, 620);
  const stopTop = safe(0.15);

  // the road to Lumofy: education first, then every earlier role
  const stops = [
    { id: education.id, period: education.period, title: education.title, company: education.school, note: education.minor, points: [] as string[] },
    ...roles.map((r) => ({ id: r.id, period: r.period, title: r.title, company: r.company, note: r.companyNote, points: r.points })),
  ];

  return (
    <div className="absolute left-0 top-0">
      {/* Section titles, planted in the world like Robby's giant letters; the letters pop up one by one.
          Decorative: the text resume carries the real headings. */}
      {W.titles.map((t) => (
        <Pop key={t.text} x={t.x + W.vw * 0.05} kind="rise" className="pointer-events-none" style={{ left: t.x, top: t.ground - t.h * (t.tone === "neon" ? 1.5 : 1.12) }}>
          <div aria-hidden="true" className={t.tone === "neon" ? "neon-title" : "ice-title"} style={{ fontSize: t.h }}>
            {t.text.split(" ").map((word, w) => (
              <span key={w} className="inline-block whitespace-nowrap">
                {w > 0 && <span className="inline-block w-[0.32em]" />}
                {word.split("").map((ch, i) => (
                  <span key={i} data-item className="title-letter">
                    {ch}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </Pop>
      ))}

      {/* ================= Level 1: Base Camp ================= */}
      <Pop x={a.player.x - playerW * 0.5} zoom={Z} style={{ left: a.player.x - playerW / 2, top: playerTop, width: playerW }}>
        <div className="frost relative p-5 pt-8">
          <Ribbon>Player 1</Ribbon>
          <h2 className="mt-2 font-display text-[clamp(26px,4.1vh,42px)] leading-[0.95] tracking-wide text-ink">{profile.name}</h2>
          <p className="mt-1.5 text-[clamp(13px,1.7vh,16px)] font-bold text-ink/80">{profile.subtitle}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {profile.tags.map((t) => (
              <li key={t} data-item className="rounded-lg border-2 border-ice-300 bg-ice-100 px-2 py-0.5 text-xs font-extrabold text-[#0c69ad]">
                {t}
              </li>
            ))}
          </ul>
          <dl className="mt-3 grid gap-1.5 text-[clamp(12px,1.55vh,15px)]">
            {SHEET.map((row) => (
              <div key={row.label} data-item className="flex items-center gap-2">
                <Icon name={row.icon} className="size-4 shrink-0 text-ice-600" />
                <dt className="text-ink/70">{row.label}</dt>
                <dd className="ml-auto text-right font-extrabold text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Posts height={a.player.ground - playerTop} zoom={Z} />
      </Pop>

      <Pop x={a.about.x - aboutW * 0.5} kind="drop" zoom={Z} style={{ left: a.about.x - aboutW / 2, top: aboutTop, width: aboutW }}>
        <div className="wood relative px-5 pb-5 pt-8">
          <Ribbon tone="red">About me</Ribbon>
          <p className="frost p-4 text-[clamp(13px,1.7vh,16px)] font-semibold leading-relaxed text-ink/85">{profile.summary}</p>
        </div>
        <Posts height={a.about.ground - aboutTop} zoom={Z} />
      </Pop>

      <Pop x={a.stats.x} kind="pop" style={{ left: a.stats.x, top: Math.max(104, a.stats.ground - crystalMax * 0.86 - u * 0.135), width: crystalGap * 4 }}>
        <h2 className="wood mx-auto w-max px-4 py-1.5 font-display text-[clamp(16px,2.4vh,24px)] tracking-wide">Player stats</h2>
      </Pop>
      {stats.map((c, k) => {
        const cx = a.stats.x + k * crystalGap + crystalGap * 0.3;
        const h = crystalMax * (k % 2 ? 0.8 : 0.86);
        return (
          <Pop key={c.label} x={cx} style={{ left: cx - u * 0.08, top: a.stats.ground - h, width: u * 0.16, height: h }}>
            <div className="relative h-full w-full">
              <img
                src="/props/ice-crystal.svg"
                alt=""
                aria-hidden="true"
                className="absolute bottom-0 left-1/2 h-[78%] w-auto max-w-none -translate-x-1/2 drop-shadow-[0_0_18px_rgba(143,211,255,0.85)]"
              />
              <div className="absolute left-1/2 top-0 -translate-x-1/2 text-center" style={{ width: crystalGap * 0.9 }}>
                <p className="font-display text-[clamp(30px,5.4vh,56px)] leading-none text-white text-outline">{c.value}</p>
                <p className="mx-auto mt-1 rounded-md bg-ink/85 px-2 py-0.5 text-center text-[clamp(12px,1.5vh,14px)] font-bold leading-tight text-balance text-white" style={{ width: crystalGap * 0.92 }}>
                  {c.label}
                </p>
              </div>
            </div>
          </Pop>
        );
      })}

      {/* ================= Level 2: the Bahrain heritage trail ================= */}
      {heritage.map((h, k) => {
        const s = a[`heritage-${k}`];
        const w = boardW(0.66, 320, 470);
        const top = safe(0.1);
        return (
          <Pop key={h.id} x={s.x - w * 0.5} kind="drop" zoom={Z} style={{ left: s.x - w / 2, top, width: w }}>
            <article className="heritage-card px-5 pb-4 pt-8">
              <Ribbon tone="red">Bahrain heritage</Ribbon>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h3 className="font-display text-[clamp(20px,3vh,30px)] leading-tight tracking-wide">{h.name}</h3>
                <p lang="ar" dir="rtl" className="text-[clamp(15px,2.2vh,21px)] font-bold text-[#8a1f24]">
                  {h.arabic}
                </p>
              </div>
              <p className={`mt-1.5 text-[#4a3018] ${txt}`}>{h.fact}</p>
            </article>
          </Pop>
        );
      })}

      {/* ================= Level 2: Bahrain: skating the road to Lumofy ================= */}
      {stops.map((r, k) => {
        const s = a[`stop-${k}`];
        const top = stopTop + (k % 2 && r.points.length < 3 ? u * 0.05 : 0);
        return (
          <Pop key={r.id} x={s.x - stopW * 0.5} kind={k % 2 ? "drop" : "rise"} zoom={Z} style={{ left: s.x - stopW / 2, top, width: stopW }}>
            <article className="frost relative p-4 pt-8" style={{ boxShadow: `0 0 0 2px ${COMPANY[r.company] ?? "#0f78c4"}33` }}>
              <Ribbon color={COMPANY[r.company]}>{r.period}</Ribbon>
              <p className="text-[12px] font-extrabold tracking-[0.08em] text-ink/65 uppercase">
                Stop <span className="tabular-nums">{k + 1}</span> of <span className="tabular-nums">{stops.length}</span>
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-[clamp(15px,2.15vh,20px)] font-extrabold leading-tight" style={{ color: COMPANY[r.company] }}>
                <Icon name={STOP_ICONS[k]} className="size-[1.1em] shrink-0" />
                {r.company}
              </p>
              <h3 className="mt-0.5 font-display text-[clamp(20px,3vh,30px)] leading-tight tracking-wide text-ink">
                {r.title}
                <span className="sr-only"> at {r.company}</span>
              </h3>
              {r.note && <p className="text-[clamp(12px,1.5vh,14px)] font-bold text-ink/65">{r.note}</p>}
              {r.points.length > 0 && (
                <ul className={`mt-2 grid gap-1 text-ink/85 ${txt}`}>
                  {r.points.map((p) => (
                    <li key={p} data-item className="flex gap-2">
                      <Icon name="snowflake" className="mt-[3px] size-3.5 shrink-0 text-ice-500" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
            <Posts height={s.ground - top} zoom={Z} />
          </Pop>
        );
      })}

      {/* ================= Level 3: Discipline Lab ================= */}
      {(() => {
        // The gym's three painted slogans get their proof as a caption ON the art: over the poster's
        // pictogram (left and right) and on the window glass under NO EXCUSES, all above his head.
        const gym = W.scenes.find((sc) => sc.id === "gym")!;
        const boxes: { vi: number; x0: number; x1: number; y0: number }[] = [
          { vi: 0, x0: 0.074, x1: 0.197, y0: 0.415 },
          { vi: 2, x0: 0.33, x1: 0.67, y0: 0.4 },
          { vi: 1, x0: 0.804, x1: 0.927, y0: 0.415 },
        ];
        return boxes.map(({ vi, x0, x1, y0 }) => {
          const left = gym.x + x0 * gym.w;
          const width = (x1 - x0) * gym.w;
          return (
            <Pop key={vi} x={left} kind="pop" style={{ left, top: y0 * gym.h, width }}>
              <div className={`poster-caption ${vi === 2 ? "px-3 py-2 text-center" : "px-2 py-1.5"}`}>
                <h3 className="sr-only">{values[vi].motto}</h3>
                <p className={vi === 2 ? "text-[clamp(12px,1.75vh,24px)] leading-snug" : "text-[clamp(10.5px,1.45vh,20px)] leading-snug"}>
                  {vi === 2 ? values[vi].proof : values[vi].short}
                </p>
              </div>
            </Pop>
          );
        });
      })()}

      {skillGroups.map((g, k) => {
        const s = a[k === 0 ? "skills-build" : "skills-people"];
        // wide and two-column so the card ends well above the avatar's beanie
        const w = boardW(0.95, 380, 720);
        const top = safe(0.13);
        const n = g.skills.length;
        return (
          <Pop key={g.id} x={s.x - w * 0.5} kind="slide" zoom={Z} style={{ left: s.x - w / 2, top, width: w }}>
            <div className="night px-5 pb-5 pt-4">
              <div className="flex items-center gap-2">
                <Icon name={k === 0 ? "code" : "users"} className="size-5 text-flag" />
                <h3 className="font-display text-[clamp(18px,2.8vh,28px)] tracking-wide text-white">{g.name} loadout</h3>
                <span className="ml-auto text-[12px] font-extrabold tracking-[0.08em] text-ice-200 uppercase">
                  <span className="tabular-nums">{n}</span> skills
                </span>
              </div>
              <p className="text-[12px] text-ice-100/85">{g.note}</p>
              {/* one plate / dumbbell per skill, loaded as the list staggers in */}
              <svg viewBox="0 0 300 44" className="mt-2 h-[clamp(30px,4.4vh,44px)] w-full" aria-hidden="true">
                {k === 0 ? (
                  <>
                    <rect x="6" y="19" width="288" height="6" rx="3" fill="#8a93a8" stroke="#0b1020" strokeWidth="2" />
                    <rect x="84" y="15" width="8" height="14" rx="2" fill="#5e6678" />
                    <rect x="208" y="15" width="8" height="14" rx="2" fill="#5e6678" />
                    {Array.from({ length: n }, (_, i) => {
                      const left = i % 2 === 0;
                      const slot = Math.floor(i / 2);
                      const x = left ? 70 - slot * 14 : 222 + slot * 14;
                      return (
                        <g key={i} data-item>
                          <rect x={x} y={2} width={10} height={40} rx={3} fill={i % 2 ? "#d7262e" : "#1d2230"} stroke="#0b1020" strokeWidth="2" />
                          <rect x={x + 2} y={6} width={2} height={32} fill="#ffffff" opacity="0.25" />
                        </g>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <rect x="10" y="36" width="280" height="6" rx="2" fill="#2b3446" stroke="#0b1020" strokeWidth="2" />
                    {Array.from({ length: n }, (_, i) => {
                      const cx = 34 + i * (232 / Math.max(1, n - 1));
                      return (
                        <g key={i} data-item>
                          <rect x={cx - 16} y={21} width={32} height={5} rx={2} fill="#8a93a8" stroke="#0b1020" strokeWidth="1.5" />
                          <path d={`M${cx - 26} 16 h10 v16 h-10 z M${cx + 16} 16 h10 v16 h-10 z`} fill={i % 2 ? "#d7262e" : "#1d2230"} stroke="#0b1020" strokeWidth="2" strokeLinejoin="round" />
                        </g>
                      );
                    })}
                  </>
                )}
              </svg>
              <ul className="mt-3 grid grid-cols-2 gap-1.5">
                {g.skills.map((sk, i) => (
                  <li
                    key={sk}
                    data-item
                    className="skill-slot flex items-center gap-2.5 rounded-lg border border-ice-300/25 bg-white/5 px-2.5 py-2 text-[clamp(12px,1.6vh,15px)] font-semibold leading-tight text-ice-50"
                  >
                    <span className={`item-slot grid size-[clamp(30px,4.4vh,40px)] shrink-0 place-items-center rounded-lg ${k === 0 ? "item-slot-build" : "item-slot-people"}`}>
                      <Icon name={SKILL_ICONS[k][i] ?? "barbell"} weight="duotone" className="size-[58%]" />
                    </span>
                    {sk}
                  </li>
                ))}
              </ul>
            </div>
          </Pop>
        );
      })}

      {/* ================= Level 4: AI Lab ================= */}
      {(() => {
        const s = a.role;
        const w = boardW(0.72, 330, 560);
        const top = safe(0.14);
        return (
          <Pop x={s.x - w * 0.5} kind="drop" zoom={Z} style={{ left: s.x - w / 2, top, width: w }}>
            <div className="frost relative p-5 pt-8">
              <Ribbon tone="red">Current quest</Ribbon>
              <p className="text-[12px] font-extrabold tracking-[0.08em] text-[#0c69ad] uppercase tabular-nums">{currentRole.period}</p>
              <h2 className="font-display text-[clamp(24px,3.8vh,40px)] leading-none tracking-wide text-[#1d3f8f]">{currentRole.title}</h2>
              <p className="mt-1 text-[clamp(13px,1.7vh,16px)] font-bold text-flag-2">
                {currentRole.company} · {currentRole.companyNote}
              </p>
              <ul className={`mt-2 grid gap-1 text-ink/85 ${txt}`}>
                {currentRole.points.map((p) => (
                  <li key={p} data-item className="flex gap-2">
                    <Icon name="lightning" weight="fill" className="mt-[3px] size-3.5 shrink-0 text-ice-600" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </Pop>
        );
      })()}

      {(() => {
        // Sticky notes on the office whiteboard (x .482–.866, y .222–.624 of the art).
        const office = W.scenes.find((s) => s.id === "lab")!;
        const left = office.x + 0.492 * office.w;
        const width = 0.364 * office.w;
        const top = 0.235 * W.vh;
        const height = 0.37 * W.vh;
        return (
          <Pop x={left + width * 0.2} kind="pop" style={{ left, top, width, minHeight: height }}>
            <h3 className="sr-only">What I built at Lumofy</h3>
            <div className="grid grid-cols-2 gap-[4%]" style={{ minHeight: height, gridAutoRows: "1fr" }}>
              {projects.map((p, k) => (
                <article
                  key={p.id}
                  data-item
                  style={{ background: NOTE_COLOURS[k], rotate: `${[-2, 1.5, 1, -1.5][k]}deg` }}
                  className="sticky-note relative flex flex-col rounded-[4px] px-[6%] pb-[6%] pt-[18px] text-ink shadow-[0_10px_18px_-8px_rgba(0,0,0,0.45)]"
                >
                  <span aria-hidden="true" className="absolute left-1/2 top-1 size-3.5 -translate-x-1/2 rounded-full border-2 border-[#8d1016] bg-flag shadow-[0_2px_0_rgba(0,0,0,0.25)]" />
                  <p className="text-[clamp(12px,1.35vh,18px)] font-extrabold tracking-[0.05em] text-ink/75 uppercase">{p.kind}</p>
                  <h4 className="font-display text-[clamp(14px,2.1vh,30px)] leading-tight tracking-wide">{p.name}</h4>
                  {p.href && (
                    <a
                      href={p.href}
                      target="_blank"
                      rel="noreferrer"
                      className="-my-1 inline-flex min-h-6 w-max max-w-full items-center gap-1 py-1 text-[clamp(12px,1.45vh,20px)] font-extrabold text-[#1d3f8f] underline decoration-2 underline-offset-2 hover:text-flag-2"
                    >
                      <span className="truncate">{p.hrefLabel}</span> <Icon name="arrow-up-right" className="size-3.5 shrink-0" />
                    </a>
                  )}
                  <p className="mt-1 text-[clamp(12px,1.45vh,20px)] leading-snug text-ink/85">{p.blurb}</p>
                </article>
              ))}
            </div>
          </Pop>
        );
      })()}

      {(() => {
        const s = a.stack;
        const cols = 3;
        const sw = Math.max(110, u * 0.2);
        const w = sw * cols + 24 * (cols - 1);
        const top = safe(0.2);
        return (
          <Pop x={s.x - w * 0.3} kind="pop" zoom={Z} style={{ left: s.x - w / 2 + u * 0.3, top, width: w }}>
            <h3 className="night mx-auto mb-3 w-max px-4 py-1.5 font-display text-[clamp(16px,2.4vh,24px)] tracking-wide text-white">The stack I ship with</h3>
            <ul className="grid grid-cols-3 gap-6">
              {stack.map((t) => (
                <li
                  key={t}
                  data-item
                  className="stack-tile grid place-items-center rounded-xl border-2 border-ice-300/80 bg-linear-to-b from-[#1d5f9a]/85 to-[#123e6b]/85 px-2 py-4 text-center font-display text-[clamp(15px,2.2vh,22px)] tracking-wide text-white shadow-[0_0_24px_rgba(79,186,245,0.45)] backdrop-blur-sm"
                  style={{ textShadow: "0 0 12px rgba(143,211,255,0.9)" }}
                >
                  {t}
                </li>
              ))}
            </ul>
          </Pop>
        );
      })()}

      {/* ================= Level 5: certificates on the ride up ================= */}
      {certificates.map((c, i) => {
        // anchor = top-left of a pennant hanging from a little cloud, placed beside the cable car's path
        const s = a[`cert-${i}`];
        const w = Math.max(180, Math.min(236, u * 0.28));
        const cloudH = w * 0.3;
        return (
          <Pop key={c.name} x={s.x - W.vw * 0.1} kind="swing" zoom={Z} style={{ left: s.x, top: s.ground, width: w, transformOrigin: "50% 0%" }}>
            <div className="fx-float" style={{ animationDelay: `${-i * 0.7}s` }}>
              {i === 0 && <h3 className="sr-only">Certificates</h3>}
              <img src="/props/cloud-a.svg" alt="" aria-hidden="true" className="relative z-10 mx-auto block max-w-none" style={{ width: w * 0.86, height: cloudH }} />
              <div aria-hidden="true" className="mx-auto flex justify-between" style={{ width: w * 0.6, height: u * 0.035, marginTop: -cloudH * 0.28 }}>
                <span className="block w-[3px] bg-[#6b4a2b]" />
                <span className="block w-[3px] bg-[#6b4a2b]" />
              </div>
              <div
                className="relative w-full bg-flag px-4 pb-8 pt-3 text-center text-white shadow-[0_14px_24px_-12px_rgba(0,0,0,0.5)]"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 84%, 0 100%)", outline: "3px solid #fff", outlineOffset: -7 }}
              >
                <span aria-hidden="true" className="absolute inset-x-2 top-0 h-2 rounded-b bg-wood" />
                <Icon name="medal" weight="fill" className="mx-auto mt-1 size-6 text-gold" />
                <p className="mt-1 font-display text-[clamp(15px,2.1vh,20px)] leading-tight tracking-wide">{c.name}</p>
                <p className="mt-1 text-[13px] font-bold text-white">{[c.issuer, c.year].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
          </Pop>
        );
      })}

      {/* ================= Level 5: the summit ================= */}
      {(() => {
        const s = a.contact;
        const w = Math.max(300, Math.min(390, 0.29 * W.vw));
        const left = s.x + W.charH * 0.75;
        return (
          <Pop x={s.x - W.vw * 0.3} kind="slide" zoom={Z} style={{ left, top: R.Sy + safe(0.14), width: w }}>
            <div className="frost shimmer p-6">
              <span className="shine" />
              <Px className="text-[12px] text-[#0c69ad]">Level 5 · Complete</Px>
              <h2 className="mt-1 font-display text-[clamp(26px,4.2vh,44px)] leading-[0.95] tracking-wide text-ink">You reached the top!</h2>
              <p className="mt-2 text-[clamp(13px,1.7vh,16px)] font-semibold text-ink/80">
                Hiring for AI-powered internal tools, HR tech, or someone who ships end to end? Let’s talk.
              </p>
              <div className="mt-5 grid gap-3">
                <a data-item className="game-btn justify-center" data-tone="linkedin" href={profile.linkedin} target="_blank" rel="noreferrer">
                  <Icon name="linkedin" weight="fill" className="size-5" /> Connect on LinkedIn
                </a>
                <a data-item className="game-btn justify-center" href={profile.cvHref} download>
                  <Icon name="file-arrow-down" className="size-5" /> Download CV
                </a>
                <a data-item className="game-btn justify-center" data-tone="ice" href={`mailto:${profile.email}`}>
                  <Icon name="envelope" className="size-5" /> Email me
                </a>
              </div>
              <CopyEmail />
              <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    worldStore.goTo(0);
                    focusHudLevel(0);
                  }}
                  className="inline-flex items-center gap-1.5 font-bold text-[#0c69ad] hover:underline"
                >
                  <Icon name="arrow-counter-clockwise" className="size-4" /> Play again
                </button>
                <button type="button" onClick={openQuickResume} className="inline-flex items-center gap-1.5 font-bold text-[#0c69ad] hover:underline">
                  <Icon name="list" className="size-4" /> Quick resume
                </button>
              </div>
            </div>
          </Pop>
        );
      })()}
    </div>
  );
});

/** The address in plain text (for webmail users) with a copy button. */
function CopyEmail() {
  const [copied, setCopied] = useState(false);
  return (
    <p data-item className="mt-3 flex items-center justify-center gap-2 text-[clamp(12px,1.55vh,14px)] font-bold text-ink/80">
      <span className="select-all">{profile.email}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(profile.email).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            },
            () => {},
          );
        }}
        aria-label="Copy email address"
        className="grid size-9 place-items-center rounded-lg border-2 border-ice-300 bg-ice-100 text-[#0c69ad] transition-colors hover:bg-ice-200"
      >
        <Icon name={copied ? "check" : "copy"} className="size-4" />
      </button>
      <span role="status" className="sr-only">
        {copied ? "Email address copied" : ""}
      </span>
    </p>
  );
}

/**
 * A glowing timeline frozen into the Gulf ice under the stops: a year marker under each board, lit up
 * to wherever he has skated (WorldStage sets the width of [data-ruler-fill] every frame).
 */
export const GulfTimeline = memo(function GulfTimeline({ world: W }: { world: World }) {
  const a = W.anchors;
  const stopsN = roles.length + 1;
  const x0 = a["stop-0"].x - W.u * 0.55;
  const x1 = a[`stop-${stopsN - 1}`].x + W.u * 0.6;
  const y = a["stop-0"].ground + W.u * 0.045;
  const periods = [education.period, ...roles.map((r) => r.period)];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0">
      <div className="absolute h-[3px] rounded-full bg-white/35" style={{ left: x0, top: y, width: x1 - x0 }} />
      <div data-ruler-fill data-x0={Math.round(x0)} className="absolute h-[4px] origin-left rounded-full bg-linear-to-r from-white via-ice-100 to-gold shadow-[0_0_10px_rgba(255,187,51,0.9)] will-change-transform" style={{ left: x0, top: y - 0.5, width: x1 - x0, transform: "scaleX(0)" }} />
      {periods.map((p, k) => {
        const sx = a[`stop-${k}`].x;
        return (
          <div key={k} className="absolute -translate-x-1/2 text-center" style={{ left: sx, top: y - 5 }}>
            <span className="mx-auto block size-[13px] rounded-full border-2 border-white bg-ice-500 shadow-[0_0_8px_rgba(143,211,255,0.9)]" />
            <span className="mt-1 block whitespace-nowrap font-display text-[clamp(13px,2vh,19px)] tracking-wide text-white text-outline tabular-nums">{startOf(p)}</span>
          </div>
        );
      })}
      <div className="absolute flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap font-display text-[clamp(13px,2vh,19px)] tracking-wide text-gold text-outline" style={{ left: x1 + 8, top: y + 1 }}>
        {startOf(currentRole.period)}: AI System Developer <Icon name="arrow-right" className="size-[1em]" />
      </div>
    </div>
  );
});
