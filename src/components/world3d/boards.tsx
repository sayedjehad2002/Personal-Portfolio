"use client";

import { useState } from "react";
import { certificates, currentRole, education, gymQuote, heritage, profile, projects, roles, skillGroups, stack, stats, values, type Role } from "@/data/resume";

/**
 * The resume, as cards pinned to places in the world (the ids match the anchors in public/world/*.json).
 * All wording comes from src/data/resume.ts. The cards are ordinary page elements on top of the 3D world, so the
 * text stays sharp, selectable and readable by screen readers.
 */

const Label = ({ children }: { children: React.ReactNode }) => <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">{children}</p>;

function RoleCard({ role, label }: { role: Role; label: string }) {
  return (
    <>
      <Label>{label}</Label>
      <h3 className="mt-1 font-display text-2xl leading-tight">{role.title}</h3>
      <p className="font-bold text-ink-3">
        {role.company}
        {role.companyNote ? ` (${role.companyNote})` : ""} · {role.period}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[14.5px] leading-snug">
        {role.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </>
  );
}

function Heritage({ id }: { id: string }) {
  const h = heritage.find((x) => x.id === id);
  if (!h) return null;
  return (
    <>
      <Label>Bahrain heritage</Label>
      <h3 className="mt-1 font-display text-2xl leading-tight">{h.name}</h3>
      <p lang="ar" dir="rtl" className="text-lg font-bold text-ink-3">
        {h.arabic}
      </p>
      <p className="mt-1 text-[14.5px] leading-snug">{h.fact}</p>
    </>
  );
}

function Skills({ id }: { id: string }) {
  const g = skillGroups.find((x) => x.id === id);
  if (!g) return null;
  return (
    <>
      <Label>Skills · {g.name}</Label>
      <p className="mt-1 font-bold text-ink-3">{g.note}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {g.skills.map((s) => (
          <li key={s} className="rounded-lg bg-[var(--tint)] px-2.5 py-1 text-sm font-bold">
            {s}
          </li>
        ))}
      </ul>
    </>
  );
}

function Contact() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  const btn = "rounded-full px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
  return (
    <>
      <Label>You reached the nest</Label>
      <h3 className="mt-1 font-display text-3xl leading-tight">Let’s talk</h3>
      <p className="mt-1 text-[15px]">
        {profile.name} · {profile.title} · {profile.base}
      </p>
      <p className="mt-2 break-all font-bold">{profile.email}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={`${btn} bg-[var(--accent)] text-white hover:brightness-110`}>
          {copied ? "Copied" : "Copy email"}
        </button>
        <a href={profile.linkedin} target="_blank" rel="noreferrer" className={`${btn} bg-[var(--tint)] hover:brightness-95`}>
          LinkedIn
        </a>
        <a href={profile.cvHref} download className={`${btn} bg-[var(--tint)] hover:brightness-95`}>
          Download CV
        </a>
      </div>
    </>
  );
}

/** What each anchor shows. `wide` cards hold longer lists. */
export const BOARDS: Record<string, { wide?: boolean; node: React.ReactNode }> = {
  about: {
    node: (
      <>
        <Label>Player 1</Label>
        <h3 className="mt-1 font-display text-3xl leading-tight">{profile.name}</h3>
        <p className="font-bold text-ink-3">{profile.title}</p>
        <p className="mt-3 text-[15px] leading-relaxed">{profile.summary}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {profile.tags.map((t) => (
            <li key={t} className="rounded-full bg-[var(--tint)] px-3 py-1 text-sm font-bold">
              {t}
            </li>
          ))}
        </ul>
      </>
    ),
  },
  stats: {
    node: (
      <>
        <Label>Player stats</Label>
        <dl className="mt-2 divide-y divide-black/10">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-4 py-2">
              <dd className="w-10 font-display text-3xl leading-none text-[var(--accent)]">{s.value}</dd>
              <dt className="text-[15px] font-bold">{s.label}</dt>
            </div>
          ))}
          <div className="flex items-baseline gap-4 py-2">
            <dd className="w-10 text-sm font-bold text-[var(--accent)]">Base</dd>
            <dt className="text-[15px] font-bold">
              {profile.base} · {profile.languages.join(", ")}
            </dt>
          </div>
        </dl>
      </>
    ),
  },
  qalat: { node: <Heritage id="qalat" /> },
  tree: { node: <Heritage id="tree" /> },
  arad: { node: <Heritage id="arad" /> },
  education: {
    node: (
      <>
        <Label>Education</Label>
        <h3 className="mt-1 font-display text-2xl leading-tight">{education.title}</h3>
        <p className="font-bold text-ink-3">{education.minor}</p>
        <p className="mt-1 text-[15px]">
          {education.school} · {education.period}
        </p>
      </>
    ),
  },
  ...Object.fromEntries(roles.map((r, i) => [`role-${i}`, { node: <RoleCard role={r} label={`Road to Lumofy · stop ${i + 1} of ${roles.length}`} /> }])),
  values: {
    wide: true,
    node: (
      <>
        <Label>Discipline Lab</Label>
        <p className="mt-1 font-display text-2xl leading-tight">“{gymQuote}”</p>
        <dl className="mt-3 space-y-2">
          {values.map((v) => (
            <div key={v.motto}>
              <dt className="text-sm font-bold uppercase tracking-wide text-[var(--accent)]">{v.motto}</dt>
              <dd className="text-[14.5px] leading-snug">{v.proof}</dd>
            </div>
          ))}
        </dl>
      </>
    ),
  },
  "skills-build": { node: <Skills id="build" /> },
  "skills-people": { node: <Skills id="people" /> },
  role: { node: <RoleCard role={currentRole} label="AI Lab · now" /> },
  projects: {
    wide: true,
    node: (
      <>
        <Label>Live projects</Label>
        <ul className="mt-2 space-y-2">
          {projects.map((p) => (
            <li key={p.id}>
              <p className="font-bold">
                {p.name} <span className="font-normal text-ink-3">· {p.kind}</span>
              </p>
              <p className="text-[14px] leading-snug">{p.blurb}</p>
              {p.href && (
                <a href={p.href} target="_blank" rel="noreferrer" className="text-[14px] font-bold text-[var(--accent)] underline underline-offset-2">
                  {p.hrefLabel ?? p.href}
                </a>
              )}
            </li>
          ))}
        </ul>
      </>
    ),
  },
  stack: {
    node: (
      <>
        <Label>Stack</Label>
        <ul className="mt-2 flex flex-wrap gap-2">
          {stack.map((s) => (
            <li key={s} className="rounded-lg bg-[var(--tint)] px-3 py-1.5 font-bold">
              {s}
            </li>
          ))}
        </ul>
      </>
    ),
  },
  certificates: {
    wide: true,
    node: (
      <>
        <Label>Certificates</Label>
        <ul className="mt-2 grid grid-cols-2 gap-x-5 gap-y-2">
          {certificates.map((c) => (
            <li key={c.name} className="text-[14px] leading-snug">
              <span className="font-bold">{c.name}</span>
              <span className="block text-ink-3">{[("issuer" in c ? c.issuer : "") || "", c.year].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  contact: { node: <Contact /> },
};
