// Single source of truth for all resume content.
// Every fact here comes from Sayed's CV (public/Sayed-Jehad-Saeed-CV.pdf, Sep 2026).
// Do not add numbers or claims that are not on the CV.

export const profile = {
  name: "Sayed Jehad Saeed",
  shortName: "Sayed Jehad",
  title: "AI System Developer",
  subtitle: "AI System Developer · Human Resources",
  tags: ["AI Systems", "Human Resources", "Web Apps"],
  base: "Bahrain",
  languages: ["English", "Arabic"],
  email: "sayedjehad2002@gmail.com",
  linkedin: "https://www.linkedin.com/in/sayed-jehad-saeed-1729b3150",
  linkedinLabel: "linkedin.com/in/sayed-jehad-saeed-1729b3150",
  cvHref: "/Sayed-Jehad-Saeed-CV.pdf",
  summary:
    "AI System Developer with a Human Resources background. I design, build, and ship production-grade web applications and internal tools using a modern AI-powered stack. I’m the sole developer across 5 live projects at Lumofy, each owned from requirements through to deployment.",
};

export type Role = {
  id: string;
  title: string;
  company: string;
  companyNote?: string;
  period: string;
  points: string[];
};

export const education = {
  id: "uob",
  title: "Bachelor of Business Management",
  minor: "Minor in Marketing",
  school: "University of Bahrain",
  period: "2020 – 2025",
};

/** Earlier roles, oldest first: the order you pass them on the road to Lumofy. */
export const roles: Role[] = [
  {
    id: "takhlees",
    title: "Sales Intern",
    company: "Takhlees Mobile Application",
    period: "2024",
    points: [
      "Conducted market research and competitive analysis that informed the development and marketing strategy for the Takhlees application.",
    ],
  },
  {
    id: "vamonos-sales",
    title: "Sales Intern",
    company: "Vamonos Hygiene Services",
    period: "2025",
    points: ["Introduced pest control services to prospective clients and supported follow-ups and client communication."],
  },
  {
    id: "vamonos-hr",
    title: "Human Resources Intern",
    company: "Vamonos Hygiene Services",
    period: "2025",
    points: [
      "Supported HRMS administration, employee data management, and compliance processes (LMRA, SIO, Bahrain Labour Law).",
      "Assisted with recruitment, onboarding, and documentation to ensure efficient HR operations.",
    ],
  },
  {
    id: "lumofy-hr",
    title: "Human Resources Intern",
    company: "Lumofy",
    companyNote: "HRTech SaaS, B2B",
    period: "09/2025 – 02/2026",
    points: [
      "Designed KPI frameworks to track and evaluate employee performance.",
      "Maintained employee records in the JISR HRMS system and built a competency-based Talent Pool database in Excel.",
      "Organised HR documentation in Notion, creating centralised knowledge bases and streamlined workflows.",
    ],
  },
  {
    id: "lumofy-ta",
    title: "Talent Acquisition & Onboarding Specialist",
    company: "Lumofy",
    companyNote: "HRTech SaaS, B2B",
    period: "02/2026 – 04/2026",
    points: [
      "Managed end-to-end recruitment, including sourcing, screening, interviewing, and offer management.",
      "Built talent pipelines and ran onboarding programs aligned with HR policies, using ATS and HRIS tools.",
      "Applied prompt engineering and low-code / no-code development to automate recruitment and onboarding workflows.",
      "Delivered a structured handover of the talent acquisition function to the HR team while transitioning into the AI System Developer role.",
    ],
  },
];

export const currentRole: Role = {
  id: "lumofy-ai",
  title: "AI System Developer",
  company: "Lumofy",
  companyNote: "HRTech SaaS, B2B",
  period: "04/2026 – Present",
  points: [
    "Sole developer across 5 live projects, owning each from requirements gathering through to production deployment.",
    "Work across a modern AI-powered development stack: Lovable, Claude Code, Supabase, Firebase, Vercel, and Netlify.",
  ],
};

/** Every role on the CV, newest first (for the plain-text resume). */
export const allRoles: Role[] = [currentRole, ...[...roles].reverse()];

export type Project = {
  id: string;
  name: string;
  kind: string;
  blurb: string;
  href?: string;
  hrefLabel?: string;
};

export const projects: Project[] = [
  {
    id: "careers",
    name: "Lumofy Careers",
    kind: "Public website",
    blurb: "Built and deployed Lumofy’s public-facing careers page for candidates to browse open roles and apply.",
    href: "https://careers.lumofy.ai",
    hrefLabel: "careers.lumofy.ai",
  },
  {
    id: "pulse",
    name: "Lumofy HR",
    kind: "Internal HR system",
    blurb: "Built and deployed the company-wide HR attendance and leave management system, now the organisation’s primary internal tool.",
    href: "https://lumofypulse.netlify.app",
    hrefLabel: "lumofypulse.netlify.app",
  },
  {
    id: "dispatch",
    name: "Dispatching Tool",
    kind: "L&D internal tool",
    blurb: "Delivered for the L&D team: SCORM and proxy provisioning.",
  },
  {
    id: "curator",
    name: "AI Curator",
    kind: "L&D internal tool",
    blurb: "Delivered for the L&D team: AI-assisted course development.",
  },
];

/** Projects named on the CV vs the total it states. */
export const liveProjectCount = 5;

export const stack = ["Lovable", "Claude Code", "Supabase", "Firebase", "Vercel", "Netlify"];

export const skillGroups = [
  {
    id: "build",
    name: "Builder",
    note: "From automating recruitment to shipping production apps",
    skills: [
      "Web Application Development (Lovable, Claude Code)",
      "Prompt Engineering & AI-Assisted Development",
      "Backend & Auth (Supabase, Firebase)",
      "Web Deployment (Vercel, Netlify)",
      "Workflow & Process Automation",
    ],
  },
  {
    id: "people",
    name: "People",
    note: "Earned across HR and talent roles",
    skills: [
      "Full Cycle Recruitment",
      "Applicant Tracking Systems (ATS) & HRIS",
      "Employee Onboarding Coordination",
      "KPI & Performance Tracking",
      "Notion HR Documentation",
    ],
  },
];

export const certificates = [
  { name: "Market Research and Consumer Behavior", issuer: "Coursera", year: "2024" },
  { name: "Principles of Compliance", issuer: "Pearl Initiative", year: "2023" },
  { name: "Innovation Camp Program", issuer: "INJAZ Bahrain", year: "2023–2024" },
  { name: "Building a Customer Persona", year: "2025" },
  { name: "Fundamentals of Marketing Analytics", year: "2025" },
  { name: "Become an AI-Powered Marketer", year: "2025" },
  { name: "Leadership & People Management", year: "2025" },
  { name: "Content Marketing Principles for Business", year: "2025" },
];

/** Headline counts, each one derived directly from the CV. */
export const stats = [
  { value: String(liveProjectCount), label: "Live projects shipped solo" },
  { value: String(roles.length + 1), label: "Roles across 3 companies" },
  { value: String(certificates.length), label: "Certificates" },
  { value: "2", label: "Languages" },
];

/** The three gym posters from Sayed's art, each tied to something on the CV. */
export const values = [
  {
    motto: "Discipline builds freedom",
    proof: "From Lumofy HR intern (09/2025) to AI System Developer (04/2026) in seven months.",
    short: "Lumofy HR intern (09/2025) to AI System Developer (04/2026): seven months.",
  },
  {
    motto: "Better than yesterday",
    proof: "Every role added a layer: sales, HR operations, recruitment, automation, then production web apps.",
    short: "Each role added a layer: sales, HR ops, recruiting, automation, then web apps.",
  },
  {
    motto: "No excuses",
    proof: "Sole owner of 5 live projects from requirements to production, plus a structured handover of the talent acquisition function.",
    short: "Sole owner of 5 live projects, requirements to production.",
  },
];

/**
 * Three historic places on the Bahrain heritage trail (Level 2). General, well-documented facts only.
 */
export const heritage = [
  {
    id: "qalat",
    name: "Qal’at al-Bahrain",
    arabic: "قلعة البحرين",
    fact: "The ancient harbour and capital of Dilmun, lived in from about 2300 BC. A UNESCO World Heritage Site since 2005.",
  },
  {
    id: "arad",
    name: "Arad Fort",
    arabic: "قلعة عراد",
    fact: "A 15th-century fort in Muharraq, built in the traditional Islamic style with round corner towers.",
  },
  {
    id: "tree",
    name: "Tree of Life",
    arabic: "شجرة الحياة",
    fact: "A mesquite tree about 400 years old, still green in the desert with no obvious source of water.",
  },
];

export const chapters = [
  { id: "base-camp", level: 1, name: "Base Camp", tagline: "Welcome to Sayed Jehad World" },
  { id: "bahrain", level: 2, name: "Bahrain", tagline: "Roots, heritage & first roles" },
  { id: "gym", level: 3, name: "Discipline Lab", tagline: "Training arc: HR\u00a0→\u00a0AI" },
  { id: "ai-lab", level: 4, name: "AI Lab", tagline: "Building at Lumofy" },
  { id: "summit", level: 5, name: "The Summit", tagline: "Ride up & let’s\u00a0talk" },
] as const;

export type ChapterId = (typeof chapters)[number]["id"];
