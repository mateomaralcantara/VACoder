import { NextResponse } from "next/server";
import {
  createBackup,
  deleteProjectFile,
  exists,
  readProjectFile,
  rollbackBackup,
  saveSnapshot,
  validateProject,
  writeProjectFile,
} from "@/lib/vacoder/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FileOperation = {
  path: string;
  content?: string;
  action?: "upsert" | "delete";
};

type ApplyRequest = {
  projectPath?: string;
  prompt?: string;
  files?: FileOperation[];
  validate?: boolean;
  autoRollback?: boolean;
  snapshotName?: string;
};

const bookUploadComponent = String.raw`"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

type UploadedBook = {
  id: string;
  name: string;
  size: string;
  type: string;
  unlocked: boolean;
};

function formatSize(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return mb.toFixed(2) + " MB";
}

function createReadingText(bookName: string, unlocked: boolean) {
  if (unlocked) {
    return (
      "Iniciando lectura completa del libro " +
      bookName +
      ". Esta versiÃ³n estÃ¡ desbloqueada para el usuario."
    );
  }

  return (
    "Iniciando lectura de muestra del libro " +
    bookName +
    ". Esta es una vista previa gratuita. " +
    "Para escuchar la lectura completa debes desbloquear este libro."
  );
}

export default function BookUploadArea() {
  const [books, setBooks] = useState<UploadedBook[]>([]);
  const [readingBookId, setReadingBookId] = useState<string | null>(null);
  const [checkoutBookId, setCheckoutBookId] = useState<string | null>(null);
  const [status, setStatus] = useState("Listo para leer");

  const checkoutBook = useMemo(() => {
    return books.find((book) => book.id === checkoutBookId) ?? null;
  }, [books, checkoutBookId]);

  function handleFiles(files: FileList | null) {
    if (!files) {
      return;
    }

    const selectedBooks = Array.from(files)
      .filter((file) => {
        const lower = file.name.toLowerCase();

        return (
          lower.endsWith(".pdf") ||
          lower.endsWith(".epub") ||
          lower.endsWith(".txt") ||
          lower.endsWith(".docx")
        );
      })
      .map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: formatSize(file.size),
        type: file.type || "Archivo de libro",
        unlocked: false,
      }));

    setBooks((current) => [...selectedBooks, ...current]);
    setStatus(selectedBooks.length + " libro(s) cargado(s).");
  }

  function startReading(book: UploadedBook) {
    if (!("speechSynthesis" in window)) {
      setStatus("Este navegador no soporta lectura por voz.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      createReadingText(book.name, book.unlocked),
    );

    utterance.lang = "es-ES";
    utterance.rate = 0.95;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setReadingBookId(book.id);
      setStatus(
        book.unlocked ? "Leyendo versiÃ³n completa" : "Leyendo muestra gratuita",
      );
    };

    utterance.onend = () => {
      setReadingBookId(null);
      setStatus("Lectura finalizada");
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function pauseReading() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.pause();
      setStatus("Lectura pausada");
    }
  }

  function resumeReading() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.resume();
      setStatus("Continuando lectura");
    }
  }

  function stopReading() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setReadingBookId(null);
      setStatus("Lectura detenida");
    }
  }

  function unlockBook(bookId: string) {
    setBooks((current) =>
      current.map((book) =>
        book.id === bookId
          ? {
              ...book,
              unlocked: true,
            }
          : book,
      ),
    );

    setCheckoutBookId(null);
    setStatus("Lectura completa desbloqueada en modo mock.");
  }

  return (
    <section style={styles.wrapper}>
      <div style={styles.header}>
        <p style={styles.badge}>Biblioteca de libros</p>
        <h2 style={styles.title}>Cargar libros para narrar</h2>
        <p style={styles.text}>
          Sube PDF, EPUB, TXT o DOCX. Luego puedes iniciar lectura gratuita o
          desbloquear la lectura completa con checkout mock.
        </p>
      </div>

      <label style={styles.uploadBox}>
        <input
          type="file"
          multiple
          accept=".pdf,.epub,.txt,.docx"
          onChange={(event) => handleFiles(event.target.files)}
          style={styles.fileInput}
        />

        <span style={styles.uploadIcon}>ðŸ“š</span>
        <strong>Haz clic para cargar libros</strong>
        <small>PDF, EPUB, TXT o DOCX</small>
      </label>

      <p style={styles.status}>{status}</p>

      <div style={styles.list}>
        {books.length === 0 ? (
          <div style={styles.empty}>TodavÃ­a no has cargado libros.</div>
        ) : (
          books.map((book) => (
            <article key={book.id} style={styles.card}>
              <div style={styles.bookIcon}>ðŸ“˜</div>

              <div style={styles.bookInfo}>
                <strong>{book.name}</strong>
                <span>
                  {book.size} Â· {book.type}
                </span>
                <small>
                  {book.unlocked
                    ? "Lectura completa desbloqueada"
                    : "Muestra gratuita disponible"}
                </small>
              </div>

              <div style={styles.actions}>
                <button style={styles.readButton} onClick={() => startReading(book)}>
                  â–¶ Iniciar lectura
                </button>

                <button style={styles.controlButton} onClick={pauseReading}>
                  â¸ Pausar
                </button>

                <button style={styles.controlButton} onClick={resumeReading}>
                  â–¶ Continuar
                </button>

                <button style={styles.stopButton} onClick={stopReading}>
                  â¹ Detener
                </button>

                <button
                  style={styles.payButton}
                  onClick={() => setCheckoutBookId(book.id)}
                >
                  ðŸ’³ Pagar lectura completa
                </button>
              </div>

              {readingBookId === book.id && (
                <div style={styles.readingPill}>Leyendo ahora</div>
              )}
            </article>
          ))
        )}
      </div>

      {checkoutBook && (
        <div style={styles.checkout}>
          <div>
            <p style={styles.badge}>Checkout mock</p>
            <h3>Desbloquear lectura completa</h3>
            <p style={styles.checkoutText}>
              Para escuchar la lectura completa debes desbloquear este libro.
            </p>
            <strong>Libro: {checkoutBook.name}</strong>
            <p style={styles.price}>Precio demo: US$4.99</p>
          </div>

          <div style={styles.checkoutActions}>
            <button style={styles.payButton} onClick={() => unlockBook(checkoutBook.id)}>
              Simular pago aprobado
            </button>

            <button style={styles.controlButton} onClick={() => setCheckoutBookId(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    margin: "40px 7vw",
    padding: 28,
    borderRadius: 28,
    background: "#FFFFFF",
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.09)",
  },
  header: {
    marginBottom: 22,
  },
  badge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(215, 38, 56, 0.12)",
    color: "#D72638",
    fontWeight: 800,
    margin: 0,
  },
  title: {
    color: "#0B1F3A",
    fontSize: "2rem",
    margin: "14px 0 8px",
  },
  text: {
    color: "#4B5563",
    lineHeight: 1.7,
  },
  uploadBox: {
    minHeight: 180,
    border: "2px dashed #123B6D",
    borderRadius: 24,
    background: "#F5F7FA",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    gap: 8,
    cursor: "pointer",
    color: "#0B1F3A",
    padding: 24,
  },
  fileInput: {
    display: "none",
  },
  uploadIcon: {
    fontSize: 48,
  },
  status: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    background: "#EFF6FF",
    color: "#123B6D",
    fontWeight: 800,
  },
  list: {
    display: "grid",
    gap: 14,
    marginTop: 22,
  },
  empty: {
    padding: 18,
    borderRadius: 16,
    background: "#F5F7FA",
    color: "#6B7280",
  },
  card: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "48px 1fr",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
  },
  bookIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "#0B1F3A",
    color: "#FFFFFF",
    display: "grid",
    placeItems: "center",
    fontSize: 24,
  },
  bookInfo: {
    display: "grid",
    gap: 4,
    color: "#1F2937",
  },
  actions: {
    gridColumn: "1 / -1",
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  readButton: {
    border: 0,
    borderRadius: 14,
    padding: "12px 16px",
    background: "#0B1F3A",
    color: "#FFFFFF",
    fontWeight: 900,
    cursor: "pointer",
  },
  controlButton: {
    border: "1px solid #CBD5E1",
    borderRadius: 14,
    padding: "12px 16px",
    background: "#FFFFFF",
    color: "#0B1F3A",
    fontWeight: 900,
    cursor: "pointer",
  },
  stopButton: {
    border: 0,
    borderRadius: 14,
    padding: "12px 16px",
    background: "#111827",
    color: "#FFFFFF",
    fontWeight: 900,
    cursor: "pointer",
  },
  payButton: {
    border: 0,
    borderRadius: 14,
    padding: "12px 16px",
    background: "#D72638",
    color: "#FFFFFF",
    fontWeight: 900,
    cursor: "pointer",
  },
  readingPill: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: "8px 10px",
    borderRadius: 999,
    background: "#ECFDF5",
    color: "#047857",
    fontWeight: 900,
    fontSize: 12,
  },
  checkout: {
    marginTop: 22,
    padding: 22,
    borderRadius: 22,
    background: "#FFF4F5",
    border: "1px solid rgba(215, 38, 56, 0.25)",
    display: "grid",
    gap: 16,
  },
  checkoutText: {
    color: "#7F1D1D",
    lineHeight: 1.7,
  },
  price: {
    color: "#0B1F3A",
    fontWeight: 900,
  },
  checkoutActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
};
`;

function promptRequestsBookReading(prompt: string) {
  const lower = prompt.toLowerCase();

  return (
    lower.includes("iniciar lectura") ||
    lower.includes("lectura") ||
    lower.includes("libro") ||
    lower.includes("cargar libros") ||
    lower.includes("pagar lectura")
  );
}

async function buildBookReadingOperations(projectPath: string): Promise<FileOperation[]> {
  const operations: FileOperation[] = [
    {
      path: "components/BookUploadArea.tsx",
      content: bookUploadComponent,
      action: "upsert",
    },
  ];

  const pageExists = await exists(projectPath + "\\app\\page.tsx");

  if (!pageExists) {
    operations.push({
      path: "app/page.tsx",
      action: "upsert",
      content:
        'import BookUploadArea from "@/components/BookUploadArea";\n\nexport default function HomePage() {\n  return (\n    <main>\n      <BookUploadArea />\n    </main>\n  );\n}\n',
    });

    return operations;
  }

  let source = await readProjectFile(projectPath, "app/page.tsx");

  if (!source.includes("BookUploadArea")) {
    if (source.startsWith('"use client";') || source.startsWith("'use client';")) {
      source = source.replace(
        /(["']use client["'];\s*)/,
        '$1\nimport BookUploadArea from "@/components/BookUploadArea";\n',
      );
    } else {
      source = 'import BookUploadArea from "@/components/BookUploadArea";\n' + source;
    }
  }

  if (!source.includes("<BookUploadArea />")) {
    if (source.includes("</main>")) {
      source = source.replace("</main>", "      <BookUploadArea />\n    </main>");
    } else {
      source =
        source +
        '\n\nexport function BookUploadAreaMount() {\n  return <BookUploadArea />;\n}\n';
    }
  }

  operations.push({
    path: "app/page.tsx",
    content: source,
    action: "upsert",
  });

  return operations;
}

function normalizeOperations(files: unknown): FileOperation[] {
  if (!Array.isArray(files)) {
    return [];
  }

  const operations: FileOperation[] = [];

  for (const item of files) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const value = item as Partial<FileOperation>;

    if (typeof value.path !== "string" || value.path.trim().length === 0) {
      continue;
    }

    if (value.action === "delete") {
      operations.push({
        path: value.path,
        action: "delete",
      });

      continue;
    }

    operations.push({
      path: value.path,
      content: typeof value.content === "string" ? value.content : "",
      action: "upsert",
    });
  }

  return operations;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ApplyRequest;

    const projectPath = String(body.projectPath || "");
    const prompt = String(body.prompt || "");
    const shouldValidate = body.validate !== false;
    const autoRollback = body.autoRollback !== false;
    const snapshotName = typeof body.snapshotName === "string" ? body.snapshotName : "before-patch";

    await saveSnapshot(projectPath, snapshotName);

    let operations = normalizeOperations(body.files);

    if (operations.length === 0 && promptRequestsBookReading(prompt)) {
      operations = await buildBookReadingOperations(projectPath);
    }

    if (operations.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No hay operaciones de archivo. EnvÃ­a files[] o un prompt reconocido por la receta actual.",
          example: {
            projectPath: "C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares",
            validate: true,
            autoRollback: true,
            files: [
              {
                path: "app/page.tsx",
                action: "upsert",
                content: "export default function Page(){ return <main>Hola</main> }",
              },
            ],
          },
        },
        { status: 400 },
      );
    }

    const backup = await createBackup(
      projectPath,
      operations.map((operation) => operation.path),
    );

    const changedFiles: string[] = [];

    for (const operation of operations) {
      if (operation.action === "delete") {
        await deleteProjectFile(projectPath, operation.path);
        changedFiles.push(operation.path);
        continue;
      }

      await writeProjectFile(projectPath, operation.path, operation.content || "");
      changedFiles.push(operation.path);
    }

    const validation = shouldValidate ? await validateProject(projectPath) : null;

    if (validation && !validation.ok && autoRollback) {
      await rollbackBackup(projectPath, backup.id);

      return NextResponse.json({
        ok: false,
        status: "patched-validation-failed-rolled-back",
        projectPath,
        backupId: backup.id,
        changedFiles: Array.from(new Set(changedFiles)),
        validation,
        rollback: {
          ok: true,
          restoredFromBackup: backup.id,
        },
      });
    }

    return NextResponse.json({
      ok: validation ? validation.ok : true,
      status: validation
        ? validation.ok
          ? "patched-and-validated"
          : "patched-with-validation-errors"
        : "patched-not-validated",
      projectPath,
      snapshotName,
      backupId: backup.id,
      changedFiles: Array.from(new Set(changedFiles)),
      validation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo aplicar el cambio.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "patch-agent-ready",
    message: "Patch Agent con backup, snapshot, validaciÃ³n y rollback activo.",
    usage: {
      method: "POST",
      body: {
        projectPath: "C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares",
        prompt: "Agrega botÃ³n Iniciar lectura a cada libro cargado.",
        validate: true,
        autoRollback: true,
      },
    },
  });
}

