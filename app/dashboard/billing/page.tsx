import { getLiveOrganizations } from "@/lib/live1/data";
import { requireLiveUser } from "@/lib/live1/auth";
import {
  PAID_PLAN_IDS,
  PLANS,
  getPlan,
  priceIdForPlan,
} from "@/lib/billing/plans";
import { stripeEnv } from "@/lib/billing/stripe";
import {
  openBillingPortalAction,
  startCheckoutAction,
} from "@/app/dashboard/billing/actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  organizacion: "Falta la organizacion.",
  permiso: "Solo un owner o admin de la organizacion puede cambiar el plan.",
  stripe: "La facturacion aun no esta configurada (falta STRIPE_SECRET_KEY).",
  plan: "Ese plan no se puede contratar desde aqui.",
  precio: "Ese plan no tiene precio configurado en Stripe.",
  checkout: "No se pudo abrir el pago. Intenta de nuevo.",
  portal: "No se pudo abrir el portal de facturacion.",
  limite: "Llegaste al limite de proyectos de tu plan. Cambia de plan para crear mas.",
  "sin-cliente": "Esta organizacion todavia no tiene una suscripcion de pago.",
};

const card = {
  border: "1px solid #E5E7EB",
  borderRadius: 18,
  padding: 16,
} as const;

const button = {
  background: "#111827",
  color: "#FFFFFF",
  border: 0,
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
} as const;

type SubscriptionRow = {
  organization_id: string;
  status: string;
  current_period_end: string | null;
  provider_customer_id: string | null;
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; checkout?: string }>;
}) {
  const params = await searchParams;
  const organizations = await getLiveOrganizations();
  const { supabase } = await requireLiveUser();
  const billingReady = stripeEnv().configured;

  const ids = organizations.map((organization) => organization.id);

  const [{ data: subscriptions }, { data: projects }] = await Promise.all([
    ids.length
      ? supabase
          .from("subscriptions")
          .select("organization_id, status, current_period_end, provider_customer_id")
          .in("organization_id", ids)
      : Promise.resolve({ data: [] as SubscriptionRow[] }),
    ids.length
      ? supabase.from("projects").select("organization_id").in("organization_id", ids)
      : Promise.resolve({ data: [] as { organization_id: string }[] }),
  ]);

  const subscriptionByOrg = new Map(
    ((subscriptions || []) as SubscriptionRow[]).map((row) => [row.organization_id, row]),
  );

  const projectCount = new Map<string, number>();

  for (const row of projects || []) {
    projectCount.set(row.organization_id, (projectCount.get(row.organization_id) || 0) + 1);
  }

  const notice = params.error
    ? MESSAGES[params.error] || "No se pudo completar la operacion."
    : params.checkout === "success"
      ? "Pago recibido. El plan se actualiza en unos segundos, cuando Stripe lo confirma."
      : params.checkout === "cancelled"
        ? "Pago cancelado. No se hizo ningun cargo."
        : "";

  return (
    <section
      style={{
        background: "#FFFFFF",
        borderRadius: 28,
        padding: 28,
      }}
    >
      <p style={{ color: "#D72638", fontWeight: 900 }}>BILLING</p>

      <h1>Planes y consumo</h1>

      {notice ? (
        <p
          role="status"
          style={{
            ...card,
            background: params.error ? "#FEF2F2" : "#F0FDF4",
            marginTop: 16,
          }}
        >
          {notice}
        </p>
      ) : null}

      {!billingReady ? (
        <p style={{ ...card, background: "#FFFBEB", marginTop: 16 }}>
          La facturacion no esta configurada en este entorno. Define
          STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET y los STRIPE_PRICE_* para
          vender planes.
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
        {organizations.map((organization) => {
          const plan = getPlan(organization.plan);
          const subscription = subscriptionByOrg.get(organization.id);
          const used = projectCount.get(organization.id) || 0;
          const canManage = ["owner", "admin"].includes(organization.role);

          return (
            <article key={organization.id} style={card}>
              <strong>{organization.name}</strong>

              <p>
                Plan actual: <strong>{plan.name}</strong>
                {subscription?.status && subscription.status !== "active"
                  ? " (" + subscription.status + ")"
                  : ""}
              </p>

              <p>
                Proyectos: {used} de{" "}
                {plan.maxProjects === null ? "ilimitados" : plan.maxProjects}
              </p>

              {subscription?.current_period_end ? (
                <p>
                  Periodo actual hasta:{" "}
                  {new Date(subscription.current_period_end).toLocaleDateString("es")}
                </p>
              ) : null}

              {!canManage ? (
                <p>Pide a un owner o admin que gestione el plan.</p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  {PAID_PLAN_IDS.filter((id) => id !== plan.id).map((id) => {
                    const available = billingReady && Boolean(priceIdForPlan(id));

                    return (
                      <form action={startCheckoutAction} key={id}>
                        <input name="organizationId" type="hidden" value={organization.id} />
                        <input name="plan" type="hidden" value={id} />
                        <button
                          disabled={!available}
                          style={{ ...button, opacity: available ? 1 : 0.4 }}
                          title={PLANS[id].description}
                          type="submit"
                        >
                          Cambiar a {PLANS[id].name} ({PLANS[id].maxProjects} proyectos)
                        </button>
                      </form>
                    );
                  })}

                  {subscription?.provider_customer_id ? (
                    <form action={openBillingPortalAction}>
                      <input name="organizationId" type="hidden" value={organization.id} />
                      <button
                        disabled={!billingReady}
                        style={{ ...button, background: "#FFFFFF", color: "#111827", border: "1px solid #111827" }}
                        type="submit"
                      >
                        Facturas, tarjeta y cancelacion
                      </button>
                    </form>
                  ) : null}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
