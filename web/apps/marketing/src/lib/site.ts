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

export function waitlistHref(options?: { source?: string; plan?: string }): string {
  const params = new URLSearchParams();
  if (options?.source?.trim()) {
    params.set("source", options.source.trim());
  }
  if (options?.plan?.trim()) {
    params.set("plan", options.plan.trim());
  }

  const query = params.toString();
  return query ? `${WAITLIST_URL}?${query}` : WAITLIST_URL;
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
    title: "Recurring work backed by an RRULE parser",
    category: "Scheduling",
    description: "Donegeon supports recurring schedules from simple daily repeats to advanced RFC 5545 recurrence rules.",
    bullets: [
      "Daily, weekly, monthly, and relative recurrence",
      "Dedicated RRULE parsing endpoint",
      "Supports BYDAY, BYMONTHDAY, INTERVAL, COUNT, UNTIL, and more",
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
    title: "A real game board instead of another Kanban clone",
    category: "Board",
    description: "Drag stacks around a world map, split decks, manage collect piles, and keep backlog pressure visible.",
    bullets: [
      "Stack dragging, deck rows, minimap, and world panning",
      "Live activation requirements and inventory state",
      "Board caching for fast reloads",
    ],
  },
  {
    title: "Quests, rewards, modifiers, and survival loops",
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
    title: "Calendar connections and profile visibility",
    category: "Operations",
    description: "Users can connect calendars, sync workflows, and inspect quest history and board state from profile surfaces.",
    bullets: [
      "Google Calendar connection flow",
      "Manual sync and disconnect controls",
      "Quest history and board runtime visibility",
    ],
  },
  {
    title: "Billing-aware plans and enterprise path",
    category: "Operations",
    description: "Marketing, onboarding, and workspace settings already account for personal, pro trial, pro, and enterprise states.",
    bullets: [
      "14-day pro trial path",
      "Workspace plan visibility in team settings",
      "Enterprise sales and support handoff",
    ],
  },
  {
    title: "TaskManager compatibility where it matters",
    category: "Integrations",
    description: "Donegeon includes a compatibility action endpoint and parity specs to ease migrations from task-focused tools.",
    bullets: [
      "Action-based compatibility endpoint",
      "Coverage specs for implemented parity flows",
      "Focused support for imports and operational continuity",
    ],
  },
];

export const TRUST_POINTS = [
  "Markdown-driven docs and blog content for fast publishing",
  "Built-in onboarding, team setup, and invite flows",
  "Professional pricing, support, and enterprise handoff paths",
  "Feature coverage grounded in the real product, not placeholder marketing copy",
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
    description: "For solo operators who want Donegeon’s task capture, quick add, recurrence, and personal board loop.",
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
    description: "For teams that need shared boards, roles, invite flows, calendar sync, and advanced gameplay operations.",
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
    description: "For larger organizations that need rollout help, access policy design, procurement support, and a tighter migration plan.",
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
        label: "Recurring tasks and RRULE parsing",
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
        label: "Docs and blog knowledge base",
        personal: "Included",
        pro: "Included",
        enterprise: "Included",
      },
      {
        label: "Migration and compatibility help",
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
    question: "Does the marketing site reflect the actual product?",
    answer:
      "Yes. The sections here map directly to shipped Donegeon capabilities, including quick add parsing, board gameplay, quests, team roles, calendar connections, and plan-aware onboarding.",
  },
  {
    question: "How do docs and blog updates work?",
    answer:
      "Both sections are driven by markdown files in the marketing app. Add a new markdown file, include frontmatter, and the site automatically picks it up in the relevant listing and detail page.",
  },
  {
    question: "Can selected docs include videos?",
    answer:
      "Yes. Doc frontmatter supports a video URL so feature walkthroughs can appear inline on article pages alongside the markdown content.",
  },
  {
    question: "What is the difference between Personal and Pro?",
    answer:
      "Personal is focused on solo use and the core board loop. Pro adds team boards, invitations, role controls, and more operational collaboration features, with a 14-day trial path already wired into onboarding.",
  },
];
