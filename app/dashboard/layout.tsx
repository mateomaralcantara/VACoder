import Link from "next/link";
import type { ReactNode } from "react";
import { requireLiveUser } from "@/lib/live1/auth";
import { signOutAction } from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await requireLiveUser();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#EEF2F7",
        color: "#0B1F3A",
      }}
    >
      <header
        style={{
          padding: "14px 4vw",
          background: "#061427",
          color: "#FFFFFF",
          display: "flex",
          justifyContent: "space-between",
          gap: 18,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong style={{ fontSize: 22 }}>
            VACoder LIVE
          </strong>

          <span
            style={{
              marginLeft: 12,
              color: "#93C5FD",
            }}
          >
            {user.email}
          </span>
        </div>

        <nav
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/dashboard"
            style={navStyle}
          >
            Inicio
          </Link>

          <Link
            href="/dashboard/projects"
            style={navStyle}
          >
            Proyectos
          </Link>

          <Link
            href="/dashboard/team"
            style={navStyle}
          >
            Equipo
          </Link>

          <Link
            href="/dashboard/billing"
            style={navStyle}
          >
            Billing
          </Link>

          <Link
            href="/supreme"
            style={navStyle}
          >
            Supreme
          </Link>

          <Link
            href="/runtime"
            style={navStyle}
          >
            Runtime
          </Link>

          <form action={signOutAction}>
            <button
              type="submit"
              style={{
                ...navStyle,
                border: "1px solid rgba(255,255,255,.15)",
                cursor: "pointer",
              }}
            >
              Salir
            </button>
          </form>
        </nav>
      </header>

      <section
        style={{
          padding: "28px 4vw 60px",
        }}
      >
        {children}
      </section>
    </main>
  );
}

const navStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "9px 12px",
  borderRadius: 12,
  background: "rgba(255,255,255,.08)",
  color: "#FFFFFF",
  textDecoration: "none",
  fontWeight: 800,
};
