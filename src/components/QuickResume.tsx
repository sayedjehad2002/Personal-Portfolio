"use client";

import { useEffect, useRef } from "react";
import { allRoles, certificates, currentRole, education, liveProjectCount, profile, projects, skillGroups, stack } from "@/data/resume";
import { useLenis } from "./SmoothScroll";
import { Icon } from "./ui/Icon";

/**
 * The whole resume as plain, scannable text. For recruiters in a hurry and for
 * assistive tech. `tabbable={false}` keeps its links out of the Tab order (used
 * for the screen-reader-only copy that sits behind the visual world).
 */
export function ResumeText({ headingLevel = 2, tabbable = true }: { headingLevel?: 2 | 3; tabbable?: boolean }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const tab = tabbable ? undefined : -1;
  const link = "underline decoration-ice-400 underline-offset-4 hover:text-ice-600";
  return (
    <div className="grid gap-8 text-[15px] leading-relaxed text-ink">
      <section>
        <H className="sr-only">About and contact</H>
        <p className="text-xs font-extrabold tracking-[0.12em] text-[#0c69ad] uppercase">{profile.subtitle}</p>
        <p className="mt-2 max-w-prose text-ink/85">{profile.summary}</p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold">
          <li>
            <a className={link} href={`mailto:${profile.email}`} tabIndex={tab}>
              {profile.email}
            </a>
          </li>
          <li>
            <a className={link} href={profile.linkedin} target="_blank" rel="noreferrer" tabIndex={tab}>
              LinkedIn
            </a>
          </li>
          <li>
            Based in {profile.base} · Languages: {profile.languages.join(" · ")}
          </li>
        </ul>
      </section>

      <section>
        <H className="font-display text-2xl tracking-wide text-ink">Experience</H>
        <ol className="mt-3 grid gap-5">
          {allRoles.map((r) => (
            <li key={r.id} className="grid gap-1 border-l-4 border-ice-300 pl-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="font-bold">
                  {r.title} <span className="font-semibold text-ink/70">· {r.company}</span>
                  {r.companyNote && <span className="font-semibold text-ink/70"> ({r.companyNote})</span>}
                </p>
                <p className="text-sm font-extrabold tabular-nums text-[#0c69ad]">{r.period}</p>
              </div>
              <ul className="list-disc pl-5 text-ink/80 marker:text-ice-400">
                {r.id === currentRole.id && (
                  <li>
                    Shipped: {projects.map((p) => p.name).join(", ")} (see “What I built at Lumofy” below).
                  </li>
                )}
                {r.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <H className="font-display text-2xl tracking-wide text-ink">What I built at Lumofy</H>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id} className="rounded-xl border border-ice-200 bg-white/70 p-3">
              <p className="font-bold">{p.name}</p>
              <p className="text-sm text-ink/75">{p.blurb}</p>
              {p.href && (
                <a
                  className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#0c69ad] hover:underline"
                  href={p.href}
                  target="_blank"
                  rel="noreferrer"
                  tabIndex={tab}
                >
                  {p.hrefLabel} <Icon name="arrow-up-right" className="size-3.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink/75">
          {projects.length} of {liveProjectCount} live projects named on the CV. Stack: {stack.join(" · ")}
        </p>
      </section>

      <section>
        <H className="font-display text-2xl tracking-wide text-ink">Education</H>
        <p className="mt-2">
          <span className="font-bold">
            {education.title}, {education.minor}
          </span>{" "}
          · {education.school} <span className="tabular-nums text-ink/70">({education.period})</span>
        </p>
      </section>

      <section>
        <H className="font-display text-2xl tracking-wide text-ink">Skills</H>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {skillGroups.map((g) => (
            <div key={g.id}>
              <p className="text-xs font-extrabold tracking-[0.12em] text-[#0c69ad] uppercase">{g.name}</p>
              <ul className="mt-1 list-disc pl-5 text-ink/80 marker:text-ice-400">
                {g.skills.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <H className="font-display text-2xl tracking-wide text-ink">Certificates</H>
        <ul className="mt-2 grid gap-1 text-ink/80 sm:grid-cols-2">
          {certificates.map((c) => (
            <li key={c.name}>
              {c.name}
              <span className="text-ink/70"> ({[c.issuer, c.year].filter(Boolean).join(", ")})</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function QuickResumeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const lenis = useLenis();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      if (body.current) body.current.scrollTop = 0;
      // Land on the scrollable text so arrow keys / PageDown scroll it straight away.
      body.current?.focus();
    }
    if (!open && d.open) d.close();
    // the page (and the world) behind the modal must not move while it is open
    document.documentElement.style.overflow = open ? "hidden" : "";
    if (open) lenis?.stop();
    else lenis?.start();
    return () => {
      document.documentElement.style.overflow = "";
      lenis?.start();
    };
  }, [open, lenis]);

  return (
    <dialog
      ref={ref}
      id="quick-resume"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="quick-resume-title"
      className="m-auto w-[min(920px,calc(100vw-32px))] max-h-[min(88vh,960px)] overflow-hidden rounded-3xl border-2 border-white bg-ice-50 p-0 text-ink shadow-2xl backdrop:bg-ink/60 backdrop:backdrop-blur-sm open:flex open:flex-col"
      data-lenis-prevent
    >
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-ice-200 bg-white px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#0c69ad] uppercase">Quick resume</p>
          <h2 id="quick-resume-title" className="font-display text-xl leading-tight tracking-wide sm:text-2xl">
            {profile.name}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a className="game-btn min-h-11 !px-3 !py-2 !text-sm" href={profile.cvHref} download aria-label="Download CV (PDF)">
            <Icon name="download" className="size-4" /> <span className="hidden min-[380px]:inline">CV</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-xl border-2 border-ice-200 bg-white text-ink transition hover:border-ice-400 hover:bg-ice-100"
            aria-label="Close quick resume"
          >
            <Icon name="x" className="size-5" />
          </button>
        </div>
      </div>
      <div
        ref={body}
        tabIndex={0}
        role="region"
        aria-label="Resume text"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 focus-visible:shadow-[inset_0_0_0_3px_var(--color-ink),inset_0_0_0_6px_#fff] focus-visible:outline-none sm:px-6"
        data-lenis-prevent
      >
        <ResumeText headingLevel={3} />
      </div>
    </dialog>
  );
}
