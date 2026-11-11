// Politica de acceso a las herramientas locales (/api/project/* y /api/supreme/*).
//
// Estas rutas leen y escriben el disco del servidor y ejecutan procesos, asi que
// solo deben responder en la maquina del desarrollador o en un despliegue donde
// se hayan habilitado de forma explicita.
//
// Este modulo no importa nada de Next ni de Node para poder usarse tanto en el
// middleware (edge) como en pruebas unitarias.

export type LocalToolsAccessInput = {
  /** NODE_ENV === "production" */
  isProduction: boolean;
  /** VACODER_LOCAL_TOOLS_ENABLED === "true" */
  enabledInProduction: boolean;
  /** Hay URL y llave publica de Supabase configuradas. */
  authConfigured: boolean;
  /** La peticion trae una sesion valida de Supabase. */
  hasUser: boolean;
};

export type LocalToolsAccessDecision =
  | { allowed: true }
  | { allowed: false; status: 401 | 403; code: string; error: string };

export const LOCAL_TOOLS_PREFIXES = ["/api/project", "/api/supreme"] as const;

export function isLocalToolsPath(pathname: string) {
  const lower = pathname.toLowerCase();

  return LOCAL_TOOLS_PREFIXES.some(
    (prefix) => lower === prefix || lower.startsWith(prefix + "/"),
  );
}

export function evaluateLocalToolsAccess(
  input: LocalToolsAccessInput,
): LocalToolsAccessDecision {
  if (input.isProduction && !input.enabledInProduction) {
    return {
      allowed: false,
      status: 403,
      code: "LOCAL_TOOLS_DISABLED",
      error:
        "Las herramientas locales estan desactivadas en produccion. " +
        "Define VACODER_LOCAL_TOOLS_ENABLED=true solo en un entorno aislado.",
    };
  }

  if (!input.authConfigured) {
    // Sin Supabase no hay forma de identificar a nadie: se permite unicamente
    // en desarrollo local, nunca en produccion.
    if (input.isProduction) {
      return {
        allowed: false,
        status: 403,
        code: "AUTH_NOT_CONFIGURED",
        error:
          "Supabase no esta configurado; las herramientas locales no pueden " +
          "exponerse en produccion sin autenticacion.",
      };
    }

    return { allowed: true };
  }

  if (!input.hasUser) {
    return {
      allowed: false,
      status: 401,
      code: "UNAUTHENTICATED",
      error: "Inicia sesion para usar las herramientas del proyecto.",
    };
  }

  return { allowed: true };
}

// ------------------------------------------------------
// Agente de IA (/api/agent/*)
// ------------------------------------------------------
// En modo demo no se llama a ningun proveedor, asi que puede ser publico. Con
// proveedores reales cada peticion gasta creditos de la cuenta: exige sesion.

export type AgentAccessInput = {
  /** DEMO_MODE distinto de "false": respuestas simuladas. */
  demoMode: boolean;
  isProduction: boolean;
  authConfigured: boolean;
  hasUser: boolean;
};

export function isAgentPath(pathname: string) {
  const lower = pathname.toLowerCase();

  return lower === "/api/agent" || lower.startsWith("/api/agent/");
}

export function evaluateAgentAccess(
  input: AgentAccessInput,
): LocalToolsAccessDecision {
  if (input.demoMode) {
    return { allowed: true };
  }

  if (!input.authConfigured) {
    if (input.isProduction) {
      return {
        allowed: false,
        status: 403,
        code: "AUTH_NOT_CONFIGURED",
        error:
          "Supabase no esta configurado; el agente con proveedores reales " +
          "no puede exponerse en produccion sin autenticacion.",
      };
    }

    return { allowed: true };
  }

  if (!input.hasUser) {
    return {
      allowed: false,
      status: 401,
      code: "UNAUTHENTICATED",
      error: "Inicia sesion para usar el agente.",
    };
  }

  return { allowed: true };
}
