// Raiz de proyectos: la unica carpeta del servidor que las herramientas
// locales pueden leer, modificar o usar como directorio de trabajo.

import os from "node:os";
import path from "node:path";

const WINDOWS_DEFAULT_ROOT = "C:\\Users\\martin\\Desktop\\VSC\\APPS";

export function resolveAppsRoot(
  env: Record<string, string | undefined> = process.env,
  platform: string = process.platform,
) {
  const configured = env.VACODER_APPS_ROOT?.trim();

  if (configured) {
    return configured;
  }

  return platform === "win32"
    ? WINDOWS_DEFAULT_ROOT
    : path.join(os.homedir(), "vacoder-apps");
}

export function isInsideRoot(
  rootInput: string,
  targetInput: string,
  pathApi: Pick<typeof path, "resolve" | "sep"> = path,
  caseInsensitive: boolean = process.platform === "win32",
) {
  let root = pathApi.resolve(rootInput);
  let target = pathApi.resolve(targetInput);

  if (caseInsensitive) {
    root = root.toLowerCase();
    target = target.toLowerCase();
  }

  // Con separador final: sin el, "APPS-otra" pasaria como si estuviera
  // dentro de "APPS".
  const rootWithSep = root.endsWith(pathApi.sep) ? root : root + pathApi.sep;

  return target === root || target.startsWith(rootWithSep);
}

export function assertInsideAppsRoot(projectPath: unknown) {
  if (!projectPath || typeof projectPath !== "string") {
    throw new Error("projectPath es obligatorio.");
  }

  if (projectPath.includes("\0")) {
    throw new Error("Ruta invalida.");
  }

  const root = path.resolve(resolveAppsRoot());
  const resolved = path.resolve(projectPath);

  if (!isInsideRoot(root, resolved)) {
    throw new Error(
      "Ruta insegura. Solo se permite trabajar con proyectos dentro de " +
        root +
        " (configurable con VACODER_APPS_ROOT).",
    );
  }

  return resolved;
}
