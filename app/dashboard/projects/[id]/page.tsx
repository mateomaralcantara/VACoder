import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicProjectContext } from "@/lib/control-plane/project";
export const dynamic = "force-dynamic";
export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let context;
  try { context = await getPublicProjectContext(id); } catch { notFound(); }
  return <div style={{ display: "grid", gap: 18 }}>
    <section style={{ background: "linear-gradient(135deg,#071426,#0B1F3A,#1D4ED8)", color: "#fff", borderRadius: 30, padding: 28 }}>
      <p style={{ color: "#93C5FD", fontWeight: 900 }}>LIVE 2 PROJECT CONTROL</p>
      <h1 style={{ fontSize: 42, marginBottom: 5 }}>{context.project.name}</h1>
      <p style={{ color: "#DCE8FF" }}>{context.project.description || "Sin descripcion"}</p>
      <p style={{ fontFamily: "Consolas,monospace", color: "#93C5FD" }}>{context.project.id}</p>
    </section>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
      <Metric name="Status" value={context.project.status} /><Metric name="Framework" value={context.project.framework || "unknown"} /><Metric name="Workspace" value={context.workspace.linked ? "LINKED" : "UNLINKED"} /><Metric name="Environment" value={context.environment.name} /><Metric name="Runtime" value={context.environment.status} /><Metric name="Repository" value={context.project.repositoryUrl || "Not connected"} />
    </section>
    <section style={{ background: "#fff", borderRadius: 24, padding: 22 }}>
      <h2>Project Control Plane</h2><p style={{ color: "#64748B" }}>Desde LIVE 2 las operaciones usan projectId; la ruta local queda encapsulada en Workspace Registry.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Nav href={`/dashboard/projects/${id}/control`}>Control Plane</Nav><Nav href={`/dashboard/projects/${id}/market`}>Market</Nav><Nav href={`/dashboard/projects/${id}/supreme`}>Supreme</Nav><Nav href={`/dashboard/projects/${id}/runtime`}>Runtime</Nav>
      </div>
    </section>
  </div>;
}
function Metric({ name, value }: { name: string; value: string }) { return <article style={{ background: "#fff", borderRadius: 20, padding: 18, wordBreak: "break-word" }}><span style={{ color: "#64748B" }}>{name}</span><strong style={{ display: "block", marginTop: 8 }}>{value}</strong></article>; }
function Nav({ href, children }: { href: string; children: React.ReactNode }) { return <Link href={href} style={{ display: "inline-flex", padding: "10px 13px", borderRadius: 12, background: "#0B1F3A", color: "#fff", textDecoration: "none", fontWeight: 900 }}>{children}</Link>; }
