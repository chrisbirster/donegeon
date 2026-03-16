import {
  pricingCatalog,
  publicPlanDefinitions,
  type FAQ,
  type PlanFamily,
  type PricingMatrixGroup as SharedPricingMatrixGroup,
} from "../../../../shared/pricing/catalog";

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
    description: "Marketing, onboarding, and workspace settings now align around Free, Pro, and Enterprise packaging.",
    bullets: [
      "Free for solo use and personal board workflow",
      "Pro trial and paid Pro states for team operations",
      "Enterprise sales and support handoff for larger rollouts",
    ],
  },
  {
    title: "Migration planning when your team is switching tools",
    category: "Support",
    description: "Donegeon can support rollouts with guided migration planning without pretending there is already a one-click import product.",
    bullets: [
      "Guided rollout help for Pro teams",
      "Priority migration planning for Enterprise customers",
      "Clear separation between shipped product and support-led services",
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
  id: PlanFamily;
  name: string;
  price: string;
  cadence: string;
  description: string;
  ctaLabel: string;
  waitlistLabel: string;
  href: string;
  loginPlan?: "personal" | "pro_trial";
  featured?: boolean;
  bullets: string[];
};

export const PLAN_SUMMARIES: PlanSummary[] = publicPlanDefinitions().map((plan) => {
  const loginPlan = plan.loginPlan === "pro_trial" || plan.loginPlan === "personal" ? plan.loginPlan : undefined;
  return {
    id: plan.id,
    name: plan.label,
    price: plan.price,
    cadence: plan.cadence,
    description: plan.description,
    ctaLabel: plan.ctaLabel,
    waitlistLabel: plan.waitlistLabel,
    href: plan.contactHref || (loginPlan ? planHref(loginPlan) : PLAN_LINKS.enterprise),
    loginPlan,
    featured: plan.featured,
    bullets: [...plan.bullets],
  };
});

export type PricingMatrixGroup = SharedPricingMatrixGroup;

export const PRICING_MATRIX: PricingMatrixGroup[] = pricingCatalog.pricingMatrix.map((group) => ({
  title: group.title,
  rows: group.rows.map((row) => ({ ...row })),
}));

export const FAQS: FAQ[] = pricingCatalog.faqs.map((item) => ({ ...item }));
