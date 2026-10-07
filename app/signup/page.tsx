import Link from "next/link";
import { signUpAction } from "@/app/signup/actions";

export default function SignupPage() {
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
      <section
        style={{
          width: "min(480px,92vw)",
          background: "#FFFFFF",
          borderRadius: 28,
          padding: 30,
          boxShadow:
            "0 24px 70px rgba(15,23,42,.12)",
        }}
      >
        <p
          style={{
            color: "#D72638",
            fontWeight: 900,
          }}
        >
          VACoder LIVE
        </p>

        <h1>Crear cuenta</h1>

        <form
          action={signUpAction}
          style={{
            display: "grid",
            gap: 14,
          }}
        >
          <label>
            <strong>Nombre</strong>
            <input
              name="fullName"
              type="text"
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
            Crear cuenta
          </button>
        </form>

        <p>
          Ya tienes cuenta?{" "}
          <Link href="/login">
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
