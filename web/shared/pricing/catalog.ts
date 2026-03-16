import catalogData from "./tiers.json";

export type WorkspacePlan = "personal" | "pro_trial" | "pro" | "enterprise";
export type PlanFamily = "free" | "pro" | "enterprise";
export type BillingState = "none" | "trial" | "paid" | "sales";
export type Availability = PlanFamily | "separate_add_on" | "not_yet_publicly_tiered";

export type WorkspacePlanMapping = {
  planFamily: PlanFamily;
  billingState: BillingState;
};

export type PlanFamilyDefinition = {
  label: string;
  comparisonLabel: string;
  price: string;
  cadence: string;
  description: string;
  ctaLabel: string;
  waitlistLabel: string;
  loginPlan?: WorkspacePlan;
  contactHref?: string;
  featured?: boolean;
  bullets: string[];
  entitlements: string[];
};

export type PricingMatrixRow = {
  key: string;
  label: string;
  free: string;
  pro: string;
  enterprise: string;
};

export type PricingMatrixGroup = {
  title: string;
  rows: PricingMatrixRow[];
};

export type FAQ = {
  question: string;
  answer: string;
};

export type FeatureInventoryItem = {
  key: string;
  label: string;
  category: string;
  availability: Availability;
  status: "implemented" | "service" | "internal";
};

export type PricingCatalog = {
  version: number;
  workspacePlanMappings: Record<WorkspacePlan, WorkspacePlanMapping>;
  publicPlanOrder: PlanFamily[];
  planFamilies: Record<PlanFamily, PlanFamilyDefinition>;
  pricingMatrix: PricingMatrixGroup[];
  faqs: FAQ[];
  featureInventory: FeatureInventoryItem[];
  separateAddOns: Array<{ key: string; label: string }>;
  notYetPubliclyTiered: Array<{ key: string; label: string }>;
};

export type WorkspacePlanProfile = {
  workspacePlan: WorkspacePlan;
  planFamily: PlanFamily;
  billingState: BillingState;
  label: string;
  entitlements: string[];
};

export const pricingCatalog = catalogData as PricingCatalog;

export function normalizeWorkspacePlan(raw: string | null | undefined): WorkspacePlan {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "free" || value === "personal") return "personal";
  if (value === "pro_trial") return "pro_trial";
  if (value === "pro") return "pro";
  if (value === "enterprise") return "enterprise";
  return "personal";
}

export function workspacePlanProfile(raw: string | null | undefined): WorkspacePlanProfile {
  const workspacePlan = normalizeWorkspacePlan(raw);
  const mapping = pricingCatalog.workspacePlanMappings[workspacePlan];
  const family = pricingCatalog.planFamilies[mapping.planFamily];
  return {
    workspacePlan,
    planFamily: mapping.planFamily,
    billingState: mapping.billingState,
    label: family.label,
    entitlements: [...family.entitlements],
  };
}

export function workspacePlanLabel(raw: string | null | undefined): string {
  return workspacePlanProfile(raw).label;
}

export function hasEntitlement(entitlements: readonly string[] | undefined, key: string): boolean {
  if (!entitlements || !key.trim()) return false;
  return entitlements.some((value) => value.trim() === key.trim());
}

export function publicPlanDefinitions(): Array<PlanFamilyDefinition & { id: PlanFamily }> {
  return pricingCatalog.publicPlanOrder.map((id) => ({
    id,
    ...pricingCatalog.planFamilies[id],
  }));
}
