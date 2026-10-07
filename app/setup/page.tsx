import { getSupabasePublicEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const env = getSupabasePublicEnv();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#EEF2F7",
        padding: "40px 6vw",
        color: "#0B1F3A",
      }}
    >
      <section
        style={{
          maxWidth: 900,
          margin: "0 auto",
          background: "#FFFFFF",
          padding: 30,
          borderRadius: 28,
        }}
      >
        <p
          style={{
            color: "#D72638",
            fontWeight: 900,
          }}
        >
          LIVE 1 SETUP
        </p>

        <h1>Configurar Coder SaaS Core</h1>

        <p>
          Estado de variables:{" "}
          <strong>
            {env.configured
              ? "CONFIGURADAS"
              : "PENDIENTES"}
          </strong>
        </p>

        <h2>Variables requeridas</h2>

        <pre
          style={{
            background: "#111827",
            color: "#E5E7EB",
            padding: 18,
            borderRadius: 16,
            overflow: "auto",
          }}
        >
{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000`}
        </pre>

        <h2>Migration SQL</h2>

        <p>
          Ejecuta el archivo:
        </p>

        <pre
          style={{
            background: "#F8FAFC",
            padding: 16,
            borderRadius: 14,
          }}
        >
          supabase/migrations/20260817_live1_saas_core.sql
        </pre>
      </section>
    </main>
  );
}
