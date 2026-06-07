'use client';

import { useMemo, useState } from 'react';
import type { VirtualFile } from '@/lib/types';

interface CodePanelProps {
  files: VirtualFile[];
  selectedFileId: string;
  onSelectFile: (fileId: string) => void;
  onChangeContent: (fileId: string, content: string) => void;
  onRevertFile: (fileId: string) => void;
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

export function CodePanel({ files, selectedFileId, onSelectFile, onChangeContent, onRevertFile }: CodePanelProps) {
  const [query, setQuery] = useState('');
  const selectedFile = files.find((file) => file.id === selectedFileId) ?? files[0];

  const filteredFiles = useMemo(() => {
    const q = normalize(query);

    if (!q) {
      return files;
    }

    return files.filter((file) => {
      return normalize(`${file.path} ${file.language} ${file.description}`).includes(q);
    });
  }, [files, query]);

  if (!selectedFile) {
    return <section className="panel empty-state">No hay archivos cargados.</section>;
  }

  const copyCurrentFile = async () => {
    await navigator.clipboard.writeText(selectedFile.content);
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Código</h2>
          <p>Editor controlado con búsqueda, estado limpio/modificado y reversión por archivo.</p>
        </div>
        <span className={`pill ${selectedFile.dirty ? 'warning' : 'success'}`}>
          {selectedFile.dirty ? 'modificado' : 'sin cambios'}
        </span>
      </div>

      <div className="code-layout">
        <aside className="panel file-sidebar">
          <div className="panel-header" style={{ marginBottom: 10 }}>
            <div>
              <h3>Archivos</h3>
              <p>{filteredFiles.length} de {files.length}</p>
            </div>
          </div>

          <input
            className="file-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar archivo…"
            aria-label="Buscar archivo"
          />

          <div className="file-list">
            {filteredFiles.map((file) => {
              const isActive = file.id === selectedFile.id;

              return (
                <button
                  key={file.id}
                  type="button"
                  className={`file-btn ${isActive ? 'active' : ''} ${file.dirty ? 'dirty' : ''}`}
                  onClick={() => onSelectFile(file.id)}
                >
                  <strong className="file-path">{file.path}</strong>
                  <div className="file-meta">
                    <span>{file.language}</span>
                    <span>{file.dirty ? 'editado' : file.description}</span>
                  </div>
                </button>
              );
            })}

            {filteredFiles.length === 0 ? <div className="empty-state">No encontré archivos con ese filtro.</div> : null}
          </div>
        </aside>

        <div className="editor-card">
          <div className="editor-toolbar">
            <div>
              <strong>{selectedFile.path}</strong>
              <div className="muted">{selectedFile.description}</div>
            </div>
            <div className="toolbar-actions">
              <button className="ghost-btn compact-btn" type="button" onClick={copyCurrentFile}>
                Copiar
              </button>
              <button className="ghost-btn compact-btn" type="button" onClick={() => onRevertFile(selectedFile.id)} disabled={!selectedFile.dirty}>
                Revertir
              </button>
              <code>{selectedFile.language}</code>
            </div>
          </div>

          <textarea
            className="editor-area"
            value={selectedFile.content}
            onChange={(event) => onChangeContent(selectedFile.id, event.target.value)}
            spellCheck={false}
          />
        </div>
      </div>
    </section>
  );
}
