import type { NormalizedAgentRunInput, StreamEvent } from '@/lib/types';
import { nowIso } from '@/lib/create-run-id';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function* createDemoStream(input: NormalizedAgentRunInput): AsyncGenerator<StreamEvent> {
  const targetFileId = input.files?.[0]?.id ?? 'app-page';

  yield {
    type: 'status',
    value: 'Analizando objetivo…',
  };
  await wait(220);

  yield {
    type: 'plan',
    title: 'Plan maestro antes de tocar código',
    steps: [
      'Entender el objetivo y reducirlo a una intención técnica clara.',
      'Proponer cambios pequeños y verificables.',
      'Modificar solo archivos necesarios.',
      'Explicar el porqué de cada decisión.',
      'Generar evidencia final con checklist.',
    ],
  };
  await wait(220);

  yield {
    type: 'teacher',
    message: {
      id: `teach-${Date.now()}`,
      title: 'Primero plan, luego código',
      concept: 'Arquitectura segura',
      body: `Modo ${input.runMode}: antes de volver esto multi-agente, conviene que un agente maestro haga cambios pequeños, trazables y fáciles de revertir.`,
      timestamp: nowIso(),
    },
  };
  await wait(220);

  yield {
    type: 'activity',
    item: {
      id: `log-${Date.now()}`,
      level: 'info',
      message: '$ analizar-prompt --contrato StreamEvent --validacion on',
      timestamp: nowIso(),
    },
  };
  await wait(220);

  yield {
    type: 'terminal',
    item: {
      id: `term-${Date.now()}`,
      command: 'npm run build --dry-run',
      output: 'Simulación: el proyecto está listo para validar estructura, eventos y UI antes de conectar terminal real.',
      exitCode: 0,
      timestamp: nowIso(),
    },
  };
  await wait(220);

  if (input.runMode !== 'plan-only') {
    yield {
      type: 'patch-file',
      fileId: targetFileId,
      reason: 'Demo de cambio controlado por evento patch-file.',
      content: `export default function DemoPage() {\n  return (\n    <main style={{ padding: 32 }}>\n      <h1>Agente Tutor IDE Robusto</h1>\n      <p>Objetivo recibido: ${escapeForCode(input.prompt).slice(0, 180)}</p>\n      <p>Modo: ${input.runMode}</p>\n    </main>\n  );\n}\n`,
    };
    await wait(220);
  }

  yield {
    type: 'build-result',
    item: {
      id: `build-${Date.now()}`,
      passed: true,
      command: 'npm run build',
      output: 'Demo: validación estructural superada. Para terminal real falta conectar sandbox.',
      timestamp: nowIso(),
    },
  };
  await wait(220);

  yield {
    type: 'artifact',
    artifact: {
      id: `artifact-${Date.now()}`,
      kind: 'checklist',
      title: 'Resultado de ejecución demo',
      body: 'Se generó plan, explicación, log, salida de terminal simulada y posible patch-file. La base queda lista para proveedor real y sandbox.',
      timestamp: nowIso(),
    },
  };
  await wait(160);

  yield {
    type: 'done',
    summary: 'Ejecución demo completada con trazabilidad.',
  };
}

function escapeForCode(value: string): string {
  return value.replace(/`/g, '\\`').replace(/\$/g, '\\$');
}
