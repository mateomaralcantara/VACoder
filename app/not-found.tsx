export default function NotFoundPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 32,
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 720,
          borderRadius: 24,
          padding: 32,
          background: "#ffffff",
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.12)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            display: "inline-flex",
            padding: "8px 12px",
            borderRadius: 999,
            background: "rgba(215, 38, 56, 0.12)",
            color: "#D72638",
            fontWeight: 800,
            margin: 0,
          }}
        >
          VACoder Agent OS
        </p>

        <h1 style={{ fontSize: "2.5rem", margin: "18px 0 10px" }}>
          Página no encontrada
        </h1>

        <p style={{ color: "#475569", lineHeight: 1.7 }}>
          La ruta solicitada no existe o todavía no ha sido generada por el sistema.
        </p>

        <a
          href="/"
          style={{
            display: "inline-flex",
            marginTop: 20,
            padding: "12px 18px",
            borderRadius: 14,
            background: "#0B1F3A",
            color: "#ffffff",
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          Volver al inicio
        </a>
      </section>
    </main>
  );
}
