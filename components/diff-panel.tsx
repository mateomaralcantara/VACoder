'use client';

import { createSimpleLineDiff } from '@/lib/diff-utils';
import type { VirtualFile } from '@/lib/types';

interface DiffPanelProps {
  file?: VirtualFile;
}

export function DiffPanel({ file }: DiffPanelProps) {
  if (!file) {
    return <section className="panel diff-panel empty-state">Selecciona un archivo para ver diferencias.</section>;
  }

  const diff = createSimpleLineDiff(file);
  const hasChanges = diff.additions > 0 || diff.deletions > 0;

  return (
    <section className="panel diff-panel">
      <div className="panel-header">
        <div>
          <h2>Diff</h2>
          <p>Comparación visible antes de aceptar cambios de mayor riesgo.</p>
        </div>
        <div className="status-row" style={{ marginTop: 0 }}>
          <span className="pill success">+{diff.additions}</span>
          <span className="pill error">-{diff.deletions}</span>
        </div>
      </div>

      {hasChanges ? <pre className="diff-box">{diff.unified}</pre> : <div className="empty-state">Este archivo no tiene cambios pendientes.</div>}
    </section>
  );
}
