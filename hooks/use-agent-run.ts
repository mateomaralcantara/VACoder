'use client';

import { useRef, useState } from 'react';
import { parseStreamEvent } from '@/lib/stream-event-schema';
import type { AgentRunInput, StreamEvent } from '@/lib/types';

interface UseAgentRunOptions {
  onEvent: (event: StreamEvent) => void;
}

export function useAgentRun({ onEvent }: UseAgentRunOptions) {
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsRunning(false);
    onEvent({ type: 'status', value: 'Ejecución cancelada por el usuario.' });
  };

  const run = async (input: AgentRunInput) => {
    if (isRunning) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);

    try {
      const response = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || 'No se pudo iniciar el stream.');
      }

      if (!response.body) {
        throw new Error('La respuesta no contiene body de stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const event = parseStreamEvent(trimmed);

          if (event) {
            onEvent(event);
          } else {
            onEvent({
              type: 'activity',
              item: {
                id: `bad-line-${Date.now()}`,
                level: 'warning',
                message: `Evento NDJSON ignorado porque no cumple contrato: ${trimmed.slice(0, 180)}`,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }

      if (buffer.trim()) {
        const event = parseStreamEvent(buffer.trim());
        if (event) onEvent(event);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      onEvent({
        type: 'error',
        message: error instanceof Error ? error.message : 'Fallo inesperado durante la ejecución.',
      });
    } finally {
      abortRef.current = null;
      setIsRunning(false);
    }
  };

  return { isRunning, run, stop };
}
