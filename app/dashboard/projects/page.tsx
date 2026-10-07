import Link from "next/link";
import { getLiveProjects } from "@/lib/live1/data";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await getLiveProjects();

  return (
    <section
      style={{
        background: "#FFFFFF",
        borderRadius: 28,
        padding: 26,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              color: "#D72638",
              fontWeight: 900,
            }}
          >
            CONTROL PLANE
          </p>

          <h1>Proyectos</h1>
        </div>

        <Link href="/dashboard/projects/new">
          Crear proyecto
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          marginTop: 20,
        }}
      >
        {projects.map((project) => (
          <Link
            key={project.id}
            href={
              "/dashboard/projects/" +
              project.id
            }
            style={{
              padding: 16,
              borderRadius: 18,
              border: "1px solid #E5E7EB",
              textDecoration: "none",
              color: "#0B1F3A",
            }}
          >
            <strong>{project.name}</strong>

            <p style={{ color: "#64748B" }}>
              {project.description ||
                "Sin descripcion"}
            </p>

            <small>
              {project.status} Â·{" "}
              {project.default_branch}
            </small>
          </Link>
        ))}

        {!projects.length ? (
          <p>No hay proyectos registrados.</p>
        ) : null}
      </div>
    </section>
  );
}
