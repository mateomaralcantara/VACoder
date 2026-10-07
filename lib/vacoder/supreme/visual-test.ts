import { writeSupremeFile } from "@/lib/vacoder/supreme/fs";
import type { SupremeVisualResult } from "@/lib/vacoder/supreme/types";

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return match ? match[1].trim() : "";
}

function stripHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function runSupremeVisualTest(args: {
  projectPath: string;
  url: string;
}) {
  const url = args.url || "http://localhost:3000";
  const findings: string[] = [];

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    const html = await response.text();
    const text = stripHtml(html);
    const title = extractTitle(html);
    const looksBlank = text.length < 40;

    if (response.status >= 400) {
      findings.push("La URL responde con status HTTP " + response.status + ".");
    }

    if (!title) {
      findings.push("No se encontro titulo HTML.");
    }

    if (looksBlank) {
      findings.push("La pagina parece vacia o con muy poco contenido visible.");
    }

    if (html.includes("Application error")) {
      findings.push("Se detecto texto de error de aplicacion.");
    }

    if (html.includes("NEXT_NOT_FOUND")) {
      findings.push("Se detecto posible ruta no encontrada.");
    }

    const result: SupremeVisualResult = {
      ok: response.ok && !looksBlank && findings.length === 0,
      url,
      statusCode: response.status,
      title,
      bodyLength: text.length,
      looksBlank,
      findings,
    };

    await writeSupremeFile(
      args.projectPath,
      ".vacoder/supreme/visual-test-latest.json",
      JSON.stringify(result, null, 2),
    ).catch(() => null);

    return result;
  } catch (error) {
    const result: SupremeVisualResult = {
      ok: false,
      url,
      looksBlank: true,
      findings: [
        error instanceof Error ? error.message : "No se pudo ejecutar visual test.",
      ],
    };

    await writeSupremeFile(
      args.projectPath,
      ".vacoder/supreme/visual-test-latest.json",
      JSON.stringify(result, null, 2),
    ).catch(() => null);

    return result;
  }
}
