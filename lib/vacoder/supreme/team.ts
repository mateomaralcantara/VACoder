import type {
  SupremeAgentFinding,
  SupremeProductScore,
} from "@/lib/vacoder/supreme/types";

export function runSupremeTeamReview(score: SupremeProductScore): SupremeAgentFinding[] {
  const findings: SupremeAgentFinding[] = [];

  if (!score.readyToSell) {
    findings.push({
      role: "CEO",
      title: "Producto aun no esta listo para venta fuerte",
      priority: "high",
      recommendation:
        "Completar las piezas de monetizacion, onboarding, trust y deploy antes de venderlo como SaaS premium.",
    });
  }

  if (score.missing.some((item) => item.toLowerCase().includes("auth"))) {
    findings.push({
      role: "CTO",
      title: "Falta autenticacion real",
      priority: "high",
      recommendation:
        "Agregar Supabase Auth o proveedor equivalente con roles, sesiones y proteccion de rutas.",
    });
  }

  if (score.missing.some((item) => item.toLowerCase().includes("pagos"))) {
    findings.push({
      role: "CEO",
      title: "Falta motor de ingresos",
      priority: "high",
      recommendation:
        "Instalar checkout PayPal/Stripe y registrar compras o suscripciones.",
    });
  }

  if (score.missing.some((item) => item.toLowerCase().includes("dashboard"))) {
    findings.push({
      role: "Designer",
      title: "Falta dashboard de control",
      priority: "medium",
      recommendation:
        "Crear un dashboard con metricas, acciones principales, estados vacios y navegacion clara.",
    });
  }

  if (score.items.some((item) => item.area === "Quality" && item.status !== "ok")) {
    findings.push({
      role: "QA",
      title: "Faltan garantias de calidad",
      priority: "medium",
      recommendation:
        "Agregar prueba visual, revision responsive y validacion de rutas criticas.",
    });
  }

  if (score.percent >= 90) {
    findings.push({
      role: "DevOps",
      title: "Listo para preparar release",
      priority: "medium",
      recommendation:
        "Crear commit, configurar variables, desplegar y verificar URL publica.",
    });
  }

  findings.push({
    role: "Security",
    title: "Escaneo de seguridad continuo",
    priority: "medium",
    recommendation:
      "Mantener scanner de secretos, rutas permitidas, rollback y auditoria por cada cambio aplicado.",
  });

  return findings;
}
