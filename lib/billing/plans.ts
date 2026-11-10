// Planes de VACoder.
//
// Los limites de proyectos estan duplicados en la base de datos
// (public.plan_project_limit, migracion 20261110_billing_hardening.sql), que
// es quien los hace cumplir. Si cambias un numero aqui, cambialo alli.

export type PlanId = "free" | "pro" | "business" | "agency" | "enterprise";

export type Plan = {
  id: PlanId;
  name: string;
  description: string;
  /** null = sin limite */
  maxProjects: number | null;
  /** Variable de entorno con el price_... de Stripe. Sin ella no se vende. */
  priceEnv?: "STRIPE_PRICE_PRO" | "STRIPE_PRICE_BUSINESS" | "STRIPE_PRICE_AGENCY";
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    description: "Para probar VACoder con un proyecto.",
    maxProjects: 2,
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Para un desarrollador con varios productos.",
    maxProjects: 10,
    priceEnv: "STRIPE_PRICE_PRO",
  },
  business: {
    id: "business",
    name: "Business",
    description: "Para equipos que construyen en paralelo.",
    maxProjects: 50,
    priceEnv: "STRIPE_PRICE_BUSINESS",
  },
  agency: {
    id: "agency",
    name: "Agency",
    description: "Para agencias con muchos clientes.",
    maxProjects: 200,
    priceEnv: "STRIPE_PRICE_AGENCY",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Contrato a medida. Se asigna manualmente.",
    maxProjects: null,
  },
};

export const PAID_PLAN_IDS = ["pro", "business", "agency"] as const;

export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

type Env = Record<string, string | undefined>;

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && Object.hasOwn(PLANS, value);
}

export function isPaidPlanId(value: unknown): value is PaidPlanId {
  return (PAID_PLAN_IDS as readonly unknown[]).includes(value);
}

export function getPlan(value: unknown): Plan {
  return isPlanId(value) ? PLANS[value] : PLANS.free;
}

export function priceIdForPlan(plan: PaidPlanId, env: Env = process.env) {
  const key = PLANS[plan].priceEnv;

  return (key && env[key]?.trim()) || null;
}

export function planForPriceId(priceId: unknown, env: Env = process.env): PaidPlanId | null {
  if (typeof priceId !== "string" || !priceId) {
    return null;
  }

  return PAID_PLAN_IDS.find((plan) => priceIdForPlan(plan, env) === priceId) ?? null;
}

export function canCreateProject(plan: unknown, currentProjects: number) {
  const limit = getPlan(plan).maxProjects;

  return limit === null || currentProjects < limit;
}
