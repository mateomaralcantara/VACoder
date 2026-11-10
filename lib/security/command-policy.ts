// Lista blanca de comandos para la terminal y el runtime de Supreme.
//
// El comando termina en un shell (cmd.exe / PowerShell), asi que primero se
// rechaza cualquier caracter con significado para el shell y despues se exige
// que el comando coincida con una forma conocida. Todo lo que no este listado
// aqui se rechaza.

export type CommandPolicyResult =
  | { ok: true; command: string; tokens: string[] }
  | { ok: false; reason: string };

// Letras, digitos y la puntuacion que usan flags, rutas relativas, versiones y
// nombres de paquetes. Quedan fuera: & | ; < > ^ % $ ` ( ) { } [ ] ! * ? ~ # ' " \
const SAFE_TOKEN = /^[A-Za-z0-9_@.\/:=,+-]+$/;
const SCRIPT_NAME = /^[A-Za-z0-9][A-Za-z0-9_:.-]*$/;
const MAX_COMMAND_LENGTH = 300;

const NPM_PLAIN = new Set([
  "install",
  "i",
  "ci",
  "test",
  "t",
  "start",
  "ls",
  "list",
  "outdated",
  "audit",
  "--version",
  "-v",
]);

const NPM_INSTALL = new Set(["install", "i", "ci"]);

// Solo binarios de proyecto conocidos: `npx <cualquier-paquete>` descargaria y
// ejecutaria codigo arbitrario.
const NPX_TOOLS = new Set(["tsc", "next", "eslint", "prettier", "vitest", "jest"]);

// Subcomandos de git de solo lectura.
const GIT_READONLY = new Set(["status", "diff", "log", "branch", "show", "rev-parse"]);

// `git branch` solo para listar.
const GIT_BRANCH_FLAGS = new Set(["-a", "-r", "-v", "-vv", "--list", "--show-current"]);

// Flags de git que escriben archivos o ejecutan programas externos.
const GIT_BLOCKED_FLAG = /^(--output|--ext-diff|--textconv|-o$|-c$|--exec|--upload-pack)/i;

function hasPathTraversal(token: string) {
  return token.split(/[\/=]/).includes("..");
}

function isAbsolutePathToken(token: string) {
  const value = token.includes("=") ? token.slice(token.indexOf("=") + 1) : token;

  return value.startsWith("/") || /^[A-Za-z]:/.test(value);
}

export function validateTerminalCommand(input: unknown): CommandPolicyResult {
  const command = typeof input === "string" ? input.trim() : "";

  if (!command) {
    return { ok: false, reason: "El comando es obligatorio." };
  }

  if (command.length > MAX_COMMAND_LENGTH) {
    return { ok: false, reason: "El comando es demasiado largo." };
  }

  const tokens = command.split(/[ \t]+/);

  for (const token of tokens) {
    if (!SAFE_TOKEN.test(token)) {
      return {
        ok: false,
        reason:
          "Comando bloqueado: contiene caracteres no permitidos (" + token + ").",
      };
    }

    if (hasPathTraversal(token) || isAbsolutePathToken(token)) {
      return {
        ok: false,
        reason: "Comando bloqueado: solo se permiten rutas dentro del proyecto.",
      };
    }
  }

  const [rawProgram, sub = "", ...rest] = tokens;
  const program = rawProgram.toLowerCase();
  const allowed = { ok: true as const, command: tokens.join(" "), tokens };
  const denied = {
    ok: false as const,
    reason:
      "Comando no permitido: " +
      command +
      ". Permitidos: npm install|ci|test|start|run <script>, " +
      "npx tsc|next|eslint|prettier|vitest|jest, git status|diff|log|branch|show, node --version.",
  };

  if (program === "npm") {
    if (sub === "run" || sub === "run-script") {
      return rest.length > 0 && SCRIPT_NAME.test(rest[0]) ? allowed : denied;
    }

    if (!NPM_PLAIN.has(sub)) {
      return denied;
    }

    // `npm install <paquete>` ejecutaria los scripts de instalacion de un
    // paquete arbitrario: install/ci solo aceptan flags.
    if (NPM_INSTALL.has(sub) && rest.some((token) => !token.startsWith("-"))) {
      return {
        ok: false,
        reason:
          "npm " + sub + " solo instala las dependencias declaradas en package.json.",
      };
    }

    return allowed;
  }

  if (program === "npx") {
    return NPX_TOOLS.has(sub) ? allowed : denied;
  }

  if (program === "git") {
    if (!GIT_READONLY.has(sub)) {
      return denied;
    }

    if (sub === "branch" && rest.some((token) => !GIT_BRANCH_FLAGS.has(token))) {
      return denied;
    }

    return rest.some((token) => GIT_BLOCKED_FLAG.test(token)) ? denied : allowed;
  }

  if (program === "node") {
    return tokens.length === 2 && (sub === "--version" || sub === "-v")
      ? allowed
      : denied;
  }

  return denied;
}

// El runtime arranca un servidor de desarrollo: solo scripts del proyecto o
// `next dev|start`.
export function validateRuntimeCommand(input: unknown): CommandPolicyResult {
  const result = validateTerminalCommand(input);

  if (!result.ok) {
    return result;
  }

  const [program, sub, third] = result.tokens.map((token) => token.toLowerCase());

  const isNpmScript =
    program === "npm" && (sub === "run" || sub === "run-script" || sub === "start");
  const isNextServer =
    program === "npx" && sub === "next" && (third === "dev" || third === "start");

  if (!isNpmScript && !isNextServer) {
    return {
      ok: false,
      reason:
        "El runtime solo acepta `npm run <script>`, `npm start` o `npx next dev|start`.",
    };
  }

  return result;
}

export function assertTerminalCommand(input: unknown) {
  const result = validateTerminalCommand(input);

  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.command;
}

export function assertRuntimeCommand(input: unknown) {
  const result = validateRuntimeCommand(input);

  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.command;
}
