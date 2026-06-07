'use client';

import type { BuildResult, TerminalOutput, TestResult } from '@/lib/types';

interface TerminalPanelProps {
  terminals: TerminalOutput[];
  tests: TestResult[];
  builds: BuildResult[];
}

export function TerminalPanel({ terminals, tests, builds }: TerminalPanelProps) {
  const total = terminals.length + tests.length + builds.length;
  const failures = tests.filter((item) => !item.passed).length + builds.filter((item) => !item.passed).length;

  return (
    <section className="panel terminal-panel">
      <div className="panel-header">
        <div>
          <h2>Terminal / Validación</h2>
          <p>Evidencia técnica preparada para comandos, pruebas y build real.</p>
        </div>
        <span className={`pill ${failures > 0 ? 'error' : 'success'}`}>{failures > 0 ? `${failures} fallo(s)` : 'ok'}</span>
      </div>

      <div className="terminal-header-row">
        <span className="pill neutral">salidas: {total}</span>
        <span className="pill neutral">tests: {tests.length}</span>
        <span className="pill neutral">builds: {builds.length}</span>
      </div>

      <div className="console terminal-console">
        {total === 0 ? <span className="console-line info">$ esperando validación…</span> : null}

        {terminals.map((item) => (
          <span key={item.id} className={`console-line ${item.exitCode === 0 ? 'success' : 'warning'}`}>
            $ {item.command}\n{item.output}
          </span>
        ))}

        {tests.map((item) => (
          <span key={item.id} className={`console-line ${item.passed ? 'success' : 'error'}`}>
            test {item.name}: {item.passed ? 'PASÓ' : 'FALLÓ'}\n{item.output}
          </span>
        ))}

        {builds.map((item) => (
          <span key={item.id} className={`console-line ${item.passed ? 'success' : 'error'}`}>
            $ {item.command}\n{item.output}
          </span>
        ))}
      </div>
    </section>
  );
}
