import { NextResponse } from 'next/server';
import {
  serializeProductionState,
  stopProductionProcess,
} from '@/app/api/project/production/state';

export const runtime = 'nodejs';

export async function POST() {
  stopProductionProcess();

  return NextResponse.json(serializeProductionState());
}