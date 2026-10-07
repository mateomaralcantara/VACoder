import Link from "next/link";
import { signInAction } from "@/app/login/actions";

const cardStyle: React.CSSProperties = {
  width: "min(460px, 92vw)",
  background: "#FFFFFF",
  borderRadius: 28,
  padding: 30,
  boxShadow: "0 24px 70px rgba(15,23,42,.12)",
};

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "linear-gradient(135deg,#061427,#0B1F3A,#1D4ED8)",
      }}
    >
      <section style={cardStyle}>
        <p
          style={{
            color: "#D72638",
            fontWeight: 900,
            margin: 0,
          }}
        >
          VACoder LIVE
        </p>

        <h1>Entrar a Coder</h1>

        <p style={{ color: "#64748B" }}>
          Accede a tus organizaciones,
          proyectos y agentes.
        </p>

        <form
          action={signInAction}
          style={{
            display: "grid",
            gap: 14,
          }}
        >
          <label>
            <strong>Email</strong>
            <input
              name="email"
              type="email"
              required
              style={{
                width: "100%",
                padding: 12,
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid #CBD5E1",
              }}
            />
          </label>

          <label>
            <strong>Contrasena</strong>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              style={{
                width: "100%",
                padding: 12,
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid #CBD5E1",
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              padding: 13,
              border: 0,
              borderRadius: 14,
              background: "#D72638",
              color: "#FFFFFF",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Entrar
          </button>
        </form>

        <p>
          No tienes cuenta?{" "}
          <Link href="/signup">
            Crear cuenta
          </Link>
        </p>
      </section>
    </main>
  );
}
