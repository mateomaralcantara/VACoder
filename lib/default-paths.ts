// Rutas de ejemplo que la interfaz propone por defecto.
//
// NEXT_PUBLIC_VACODER_APPS_ROOT debe apuntar a la misma carpeta que
// VACODER_APPS_ROOT (la que el servidor permite); aqui solo sirve para
// rellenar formularios.

const FALLBACK_APPS_ROOT = "C:\\Users\\martin\\Desktop\\VSC\\APPS";

export const DEFAULT_APPS_ROOT =
  process.env.NEXT_PUBLIC_VACODER_APPS_ROOT?.trim().replace(/[\\/]+$/, "") ||
  FALLBACK_APPS_ROOT;

export function defaultProjectPath(name: string) {
  const separator =
    DEFAULT_APPS_ROOT.includes("/") && !DEFAULT_APPS_ROOT.includes("\\") ? "/" : "\\";

  return DEFAULT_APPS_ROOT + separator + name;
}
