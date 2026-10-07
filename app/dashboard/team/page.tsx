import {
  createOrganizationAction,
} from "@/app/dashboard/actions";
import {
  getLiveOrganizations,
} from "@/lib/live1/data";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const organizations =
    await getLiveOrganizations();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "minmax(320px,.8fr) minmax(360px,1.2fr)",
        gap: 18,
      }}
    >
      <section
        style={{
          background: "#FFFFFF",
          borderRadius: 28,
          padding: 24,
        }}
      >
        <p
          style={{
            color: "#D72638",
            fontWeight: 900,
          }}
        >
          ORGANIZATIONS
        </p>

        <h1>Crear workspace</h1>

        <form
          action={createOrganizationAction}
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          <label>
            <strong>Nombre</strong>

            <input
              name="name"
              required
              placeholder="Mi empresa"
              style={{
                width: "100%",
                marginTop: 7,
                padding: 12,
                borderRadius: 12,
                border:
                  "1px solid #CBD5E1",
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              border: 0,
              borderRadius: 14,
              padding: 13,
              background: "#D72638",
              color: "#FFFFFF",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Crear organizacion
          </button>
        </form>
      </section>

      <section
        style={{
          background: "#FFFFFF",
          borderRadius: 28,
          padding: 24,
        }}
      >
        <h2>Mis organizaciones</h2>

        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {organizations.map(
            (organization) => (
              <article
                key={organization.id}
                style={{
                  border:
                    "1px solid #E5E7EB",
                  padding: 14,
                  borderRadius: 16,
                }}
              >
                <strong>
                  {organization.name}
                </strong>

                <p>
                  Role: {organization.role}
                </p>

                <small>
                  Plan: {organization.plan}
                </small>
              </article>
            ),
          )}

          {!organizations.length ? (
            <p>
              Aun no perteneces a ninguna
              organizacion.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
