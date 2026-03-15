const DEFAULT_APP_URL = import.meta.env.DEV ? "http://localhost:5173" : "https://app.donegeon.com";

export const APP_URL = (import.meta.env.VITE_DONEGEON_APP_URL || DEFAULT_APP_URL).replace(/\/+$/, "");
export const LOGIN_URL = `${APP_URL}/login`;
export const WAITLIST_URL = `${APP_URL}/waitlist`;

export const PLAN_LINKS = {
  personal: `${LOGIN_URL}?plan=personal`,
  proTrial: `${LOGIN_URL}?plan=pro_trial`,
  enterprise: "mailto:sales@donegeon.com?subject=Donegeon%20Enterprise",
} as const;

export type MarketingPublicConfig = {
  openBeta: boolean;
  openBetaStartsAt: string;
  openBetaStartsLabel: string;
};

export function defaultPublicConfig(): MarketingPublicConfig {
  return {
    openBeta: import.meta.env.DEV,
    openBetaStartsAt: "2026-06-01",
    openBetaStartsLabel: "June 1, 2026",
  };
}

function localOverrideQueryValue(): "open" | "closed" | null {
  if (typeof window === "undefined") return null;

  const host = window.location.hostname.trim().toLowerCase();
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
  if (!isLocal) return null;

  const stored = (window.localStorage.getItem("donegeon.local-open-beta") || "").trim().toLowerCase();
  if (stored === "true") return "open";
  if (stored === "false") return "closed";
  return null;
}

function withLocalOverride(url: string): string {
  const override = localOverrideQueryValue();
  if (!override) return url;

  const next = new URL(url);
  next.searchParams.set("local_beta", override);
  return next.toString();
}

export function loginHref(options?: { plan?: string }): string {
  const next = new URL(LOGIN_URL);
  if (options?.plan?.trim()) {
    next.searchParams.set("plan", options.plan.trim());
  }
  return withLocalOverride(next.toString());
}

export function planHref(plan: "personal" | "pro_trial"): string {
  return loginHref({ plan });
}

export function waitlistHref(options?: { source?: string; plan?: string }): string {
  const next = new URL(WAITLIST_URL);
  if (options?.source?.trim()) {
    next.searchParams.set("source", options.source.trim());
  }
  if (options?.plan?.trim()) {
    next.searchParams.set("plan", options.plan.trim());
  }
  return withLocalOverride(next.toString());
}

export type SiteFeature = {
  title: string;
  category: string;
  description: string;
  bullets: string[];
};

export const FEATURES: SiteFeature[] = [
  {
    title: "Quick add that understands real task language",
    category: "Capture",
    description: "Create tasks with projects, labels, assignees, priority, due dates, deadlines, and recurrence in a single line.",
    bullets: [
      "Project, label, assignee, and priority tokens",
      "Natural language due dates and deadline parsing",
      "Preview-first workflow before saving",
    ],
  },
  {
    title: "Recurring schedules for real-world routines",
    category: "Scheduling",
    description: "Set up daily, weekly, monthly, and more advanced repeating work without rebuilding the same tasks over and over.",
    bullets: [
      "Daily, weekly, monthly, and flexible repeat options",
      "Handles more advanced schedule rules when you need them",
      "Keeps recurring work visible and consistent",
    ],
  },
  {
    title: "Inbox and board views for the same work",
    category: "Execution",
    description: "Capture everything in task lists, then move into the live board when work becomes active and tactical.",
    bullets: [
      "Shared task and board workflow",
      "Due/deadline validation and schedule metadata",
      "Multiple board-aware projects and views",
    ],
  },
  {
    title: "A shared board that makes priorities visible",
    category: "Board",
    description: "Drag stacks around a world map, split decks, manage collect piles, and keep backlog pressure visible.",
    bullets: [
      "Stack dragging, deck rows, minimap, and world panning",
      "Live activation requirements and inventory state",
      "Board caching for fast reloads",
    ],
  },
  {
    title: "Quests and rewards that keep teams engaged",
    category: "Board",
    description: "Board gameplay turns work into progression with daily, story, seasonal, boss, and failure quest types.",
    bullets: [
      "Quest objectives tied to task and board actions",
      "Reward claims, inventory, villager stamina, and zombie pressure",
      "Deck progression and collectible modifiers",
    ],
  },
  {
    title: "Team boards with roles and invitations",
    category: "Collaboration",
    description: "Teams can collaborate on shared boards with owner, admin, editor, and reader role controls.",
    bullets: [
      "Workspace invites and pending invitation management",
      "Role updates and member removal flows",
      "Personal and team board setup during onboarding",
    ],
  },
  {
    title: "Calendar sync and personal activity history",
    category: "Operations",
    description: "Users can connect calendars, sync their schedules, and review quest history and board progress from their profile.",
    bullets: [
      "Google Calendar connection flow",
      "Manual sync and disconnect controls",
      "Quest history and board runtime visibility",
    ],
  },
  {
    title: "Plans that support solo use, teams, and larger rollouts",
    category: "Operations",
    description: "Marketing, onboarding, and workspace settings already account for personal, pro trial, pro, and enterprise states.",
    bullets: [
      "14-day pro trial path",
      "Workspace plan visibility in team settings",
      "Enterprise sales and support handoff",
    ],
  },
  {
    title: "Migration help when you're moving from another tool",
    category: "Integrations",
    description: "Donegeon includes compatibility support for teams that need a smoother move from another task-focused product.",
    bullets: [
      "Support for key compatibility flows",
      "Migration-friendly product coverage",
      "Help preserving continuity during rollout",
    ],
  },
];

export const TRUST_POINTS = [
  "Fast setup for solo work or team onboarding",
  "Shared boards, invites, and roles when you need to collaborate",
  "Clear pricing, support, and an enterprise path as you grow",
  "A workflow that feels more engaging than another flat task list",
];

export type PlanSummary = {
  name: string;
  price: string;
  cadence: string;
  description: string;
  ctaLabel: string;
  href: string;
  featured?: boolean;
  bullets: string[];
};

export const PLAN_SUMMARIES: PlanSummary[] = [
  {
    name: "Personal",
    price: "$0",
    cadence: "forever",
    description: "For individuals who want faster task capture, recurring work, and a personal board that keeps priorities visible.",
    ctaLabel: "Start Free",
    href: PLAN_LINKS.personal,
    bullets: [
      "Single workspace and personal board",
      "Quick add parsing and scheduling controls",
      "Core quests, decks, and board progression",
    ],
  },
  {
    name: "Pro",
    price: "$12",
    cadence: "per user / month",
    description: "For teams that need shared boards, roles, invites, calendar sync, and a more collaborative workflow.",
    ctaLabel: "Start Pro Trial",
    href: PLAN_LINKS.proTrial,
    featured: true,
    bullets: [
      "14-day trial before billing",
      "Shared team boards and role management",
      "Advanced board operations and collaboration",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "annual",
    description: "For larger organizations that need rollout help, procurement support, and a smoother path to adoption.",
    ctaLabel: "Talk to Sales",
    href: PLAN_LINKS.enterprise,
    bullets: [
      "Security and admin review support",
      "Priority onboarding and migration planning",
      "Procurement, invoicing, and custom rollout",
    ],
  },
];

export type PricingMatrixGroup = {
  title: string;
  rows: Array<{
    label: string;
    personal: string;
    pro: string;
    enterprise: string;
  }>;
};

export const PRICING_MATRIX: PricingMatrixGroup[] = [
  {
    title: "Core workflow",
    rows: [
      {
        label: "Quick add parser with schedule tokens",
        personal: "Included",
        pro: "Included",
        enterprise: "Included",
      },
      {
        label: "Recurring tasks and advanced schedules",
        personal: "Included",
        pro: "Included",
        enterprise: "Included",
      },
      {
        label: "Personal board gameplay",
        personal: "Included",
        pro: "Included",
        enterprise: "Included",
      },
    ],
  },
  {
    title: "Team operations",
    rows: [
      {
        label: "Shared team board",
        personal: "No",
        pro: "Included",
        enterprise: "Included",
      },
      {
        label: "Invites and role management",
        personal: "No",
        pro: "Included",
        enterprise: "Included",
      },
      {
        label: "Calendar connections and sync",
        personal: "Optional",
        pro: "Included",
        enterprise: "Included",
      },
    ],
  },
  {
    title: "Launch and support",
    rows: [
      {
        label: "Guides and product updates",
        personal: "Included",
        pro: "Included",
        enterprise: "Included",
      },
      {
        label: "Migration help",
        personal: "Self-serve",
        pro: "Guided",
        enterprise: "Priority",
      },
      {
        label: "Security review and procurement",
        personal: "No",
        pro: "Lightweight",
        enterprise: "Full support",
      },
    ],
  },
];

export const FAQS = [
  {
    question: "What is included today?",
    answer:
      "Donegeon includes fast task capture, recurring schedules, a shared board experience, collaboration features, calendar connections, and onboarding paths for solo users and teams.",
  },
  {
    question: "Can we learn the product before signing up?",
    answer:
      "Yes. The docs and blog cover core workflows, feature walkthroughs, and product updates so teams can understand how Donegeon works before they commit.",
  },
  {
    question: "Are walkthrough videos available?",
    answer:
      "Yes. Selected guides can include videos so new users can see features in action instead of relying on screenshots and text alone.",
  },
  {
    question: "What is the difference between Personal and Pro?",
    answer:
      "Personal is designed for solo use and the core board workflow. Pro adds shared boards, invitations, role controls, and stronger team collaboration, with a 14-day trial to get started.",
  },
];
