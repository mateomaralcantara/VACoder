import { getLiveOrganizations } from "@/lib/live1/data";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const organizations =
    await getLiveOrganizations();

  return (
    <section
      style={{
        background: "#FFFFFF",
        borderRadius: 28,
        padding: 28,
      }}
    >
      <p
        style={{
          color: "#D72638",
          fontWeight: 900,
        }}
      >
        BILLING FOUNDATION
      </p>

      <h1>Planes y consumo</h1>

      <p>
        La estructura de subscriptions,
        credits y usage_events queda creada
        en LIVE 1.
      </p>

      <div
        style={{
          display: "grid",
          gap: 10,
          marginTop: 20,
        }}
      >
        {organizations.map(
          (organization) => (
            <article
              key={organization.id}
              style={{
                border:
                  "1px solid #E5E7EB",
                borderRadius: 18,
                padding: 16,
              }}
            >
              <strong>
                {organization.name}
              </strong>

              <p>
                Plan actual:{" "}
                {organization.plan}
              </p>
            </article>
          ),
        )}
      </div>
    </section>
  );
}
