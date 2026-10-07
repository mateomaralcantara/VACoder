import { addSupremeModule } from "@/lib/vacoder/supreme/memory";
import { writeSupremeFile } from "@/lib/vacoder/supreme/fs";
import type { SupremeModule } from "@/lib/vacoder/supreme/types";

export const supremeModules: SupremeModule[] = [
  {
    id: "supabase-auth",
    name: "Supabase Auth Premium",
    category: "Auth",
    description: "Login, registro, sesiones, middleware y roles base.",
    businessValue: "Permite vender apps con usuarios reales.",
    files: ["lib/supabase/client.ts", "app/login/page.tsx", "app/dashboard/page.tsx"],
  },
  {
    id: "payments-paypal-stripe",
    name: "Pagos PayPal / Stripe",
    category: "Revenue",
    description: "Checkout, ordenes, captura de pago y registro de compras.",
    businessValue: "Permite cobrar desde el primer dia.",
    files: ["app/api/payments/create/route.ts", "app/checkout/page.tsx"],
  },
  {
    id: "admin-dashboard",
    name: "Admin Dashboard",
    category: "Operations",
    description: "Panel admin con metricas, usuarios, ventas y actividad.",
    businessValue: "Convierte la app en sistema administrable.",
    files: ["app/admin/page.tsx", "components/admin-metrics.tsx"],
  },
  {
    id: "pdf-documents",
    name: "PDF Documents",
    category: "Documents",
    description: "Generacion de recibos, expedientes, contratos y reportes PDF.",
    businessValue: "Clave para legal, migracion, financiera e inmobiliaria.",
    files: ["lib/pdf/generator.ts", "app/api/pdf/route.ts"],
  },
  {
    id: "appointment-system",
    name: "Sistema de Citas",
    category: "CRM",
    description: "Agenda, disponibilidad, reservas, clientes y estados.",
    businessValue: "Ideal para oficinas, migracion, medicos y servicios.",
    files: ["app/citas/page.tsx", "app/api/appointments/route.ts"],
  },
  {
    id: "product-seo",
    name: "SEO / Landing Premium",
    category: "Growth",
    description: "Metadatos, landing, secciones de conversion y trust blocks.",
    businessValue: "Ayuda a vender y captar clientes.",
    files: ["app/page.tsx", "app/layout.tsx"],
  },
];

export async function installSupremeModule(projectPath: string, moduleId: string) {
  const module = supremeModules.find((item) => item.id === moduleId);

  if (!module) {
    throw new Error("Modulo no encontrado: " + moduleId);
  }

  const content =
    "# Modulo Supreme instalado\n\n" +
    "Modulo: " +
    module.name +
    "\n\n" +
    "Categoria: " +
    module.category +
    "\n\n" +
    "Valor de negocio: " +
    module.businessValue +
    "\n\n" +
    "Archivos sugeridos:\n" +
    module.files.map((file) => "- " + file).join("\n") +
    "\n\n" +
    "Descripcion:\n" +
    module.description +
    "\n";

  await writeSupremeFile(projectPath, ".vacoder/supreme/modules/" + module.id + ".md", content);
  await addSupremeModule(projectPath, module.id);

  return {
    ok: true,
    module,
    message: "Modulo registrado en memoria. Proxima fase: instalador de codigo real por modulo.",
  };
}
