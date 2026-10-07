import { NextResponse } from 'next/server';
import { serializeRuntimeState } from '@/app/api/project/runtime/helpers';
import {
  getRuntimeState,
  pushRuntimeLog,
  setRuntimeStatus,
} from '@/app/api/project/runtime/state';

export const runtime = 'nodejs';

export async function POST() {
  const state = getRuntimeState();

  if (state.process && !state.process.killed) {
    pushRuntimeLog('Deteniendo runtime...');

    try {
      state.process.kill();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo detener el proceso.';
      pushRuntimeLog(`Error deteniendo runtime: ${message}`);
    }
  }

  state.process = null;
  state.error = undefined;

  setRuntimeStatus('stopped');

  return NextResponse.json(serializeRuntimeState());
}