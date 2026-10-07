import Link from "next/link";
import {
  getLiveOrganizations,
  getLiveProjects,
} from "@/lib/live1/data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [organizations, projects] =
    await Promise.all([
      getLiveOrganizations(),
      getLiveProjects(),
    ]);

  return (
    <div
      style={{
        display: "grid",
        gap: 20,
      }}
    >
      <section
        style={{
          background:
            "linear-gradient(135deg,#FFFFFF,#F8FAFC,#EEF2FF)",
          borderRadius: 30,
          padding: 28,
        }}
      >
        <p
          style={{
            color: "#D72638",
            fontWeight: 900,
          }}
        >
          LIVE CONTROL PLANE
        </p>

        <h1
          style={{
            fontSize: 42,
            margin: "8px 0",
          }}
        >
          Coder SaaS Dashboard
        </h1>

        <p style={{ color: "#64748B" }}>
          Usuarios, organizaciones y proyectos
          persistentes.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: 14,
        }}
      >
        <Metric
          title="Organizaciones"
          value={organizations.length}
        />

        <Metric
          title="Proyectos"
          value={projects.length}
        />

        <Metric
          title="Runtime"
          value="Supreme 2"
        />

        <Metric
          title="SaaS Core"
          value="LIVE 1"
        />
      </section>

      {!organizations.length ? (
        <section style={cardStyle}>
          <h2>Crea tu primera organizacion</h2>

          <p>
            Antes de crear proyectos necesitas
            un workspace.
          </p>

          <Link href="/dashboard/team">
            Crear organizacion
          </Link>
        </section>
      ) : null}

      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                color: "#D72638",
                fontWeight: 900,
              }}
            >
              PROJECTS
            </p>

            <h2>Proyectos recientes</h2>
          </div>

          <Link href="/dashboard/projects/new">
            Nuevo proyecto
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {projects.slice(0, 8).map((project) => (
            <Link
              key={project.id}
              href={
                "/dashboard/projects/" +
                project.id
              }
              style={{
                padding: 14,
                borderRadius: 16,
                border: "1px solid #E5E7EB",
                textDecoration: "none",
                color: "#0B1F3A",
              }}
            >
              <strong>{project.name}</strong>

              <div
                style={{
                  color: "#64748B",
                  marginTop: 5,
                }}
              >
                {project.status} Â·{" "}
                {project.framework || "unknown"}
              </div>
            </Link>
          ))}

          {!projects.length ? (
            <p>No hay proyectos todavia.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Metric({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <article style={cardStyle}>
      <span style={{ color: "#64748B" }}>
        {title}
      </span>

      <strong
        style={{
          display: "block",
          fontSize: 30,
          marginTop: 8,
        }}
      >
        {value}
      </strong>
    </article>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 24,
  padding: 20,
  boxShadow:
    "0 16px 45px rgba(15,23,42,.06)",
};
