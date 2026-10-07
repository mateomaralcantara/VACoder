import Link from "next/link";
import { getLiveOrganizations } from "@/lib/live1/data";
import { createProjectAction } from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const organizations =
    await getLiveOrganizations();

  if (!organizations.length) {
    return (
      <section
        style={{
          background: "#FFFFFF",
          borderRadius: 28,
          padding: 28,
        }}
      >
        <h1>No existe una organizacion</h1>

        <p>
          Crea primero tu workspace.
        </p>

        <Link href="/dashboard/team">
          Ir a Equipo
        </Link>
      </section>
    );
  }

  return (
    <section
      style={{
        maxWidth: 760,
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
        NEW PROJECT
      </p>

      <h1>Crear proyecto SaaS</h1>

      <form
        action={createProjectAction}
        style={{
          display: "grid",
          gap: 16,
        }}
      >
        <label>
          <strong>Organizacion</strong>

          <select
            name="organizationId"
            required
            style={inputStyle}
          >
            {organizations.map(
              (organization) => (
                <option
                  key={organization.id}
                  value={organization.id}
                >
                  {organization.name}
                </option>
              ),
            )}
          </select>
        </label>

        <label>
          <strong>Nombre</strong>

          <input
            name="name"
            required
            style={inputStyle}
          />
        </label>

        <label>
          <strong>Descripcion</strong>

          <textarea
            name="description"
            rows={5}
            style={inputStyle}
          />
        </label>

        <label>
          <strong>Framework</strong>

          <select
            name="framework"
            style={inputStyle}
            defaultValue="nextjs"
          >
            <option value="nextjs">
              Next.js
            </option>

            <option value="react">
              React
            </option>

            <option value="vite">
              Vite
            </option>

            <option value="node">
              Node
            </option>
          </select>
        </label>

        <button
          type="submit"
          style={{
            padding: 14,
            border: 0,
            borderRadius: 14,
            background: "#D72638",
            color: "#FFFFFF",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Crear proyecto
        </button>
      </form>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginTop: 7,
  borderRadius: 12,
  border: "1px solid #CBD5E1",
};
