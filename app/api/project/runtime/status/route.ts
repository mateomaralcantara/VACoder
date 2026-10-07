import { NextResponse } from 'next/server';
import { serializeRuntimeState } from '@/app/api/project/runtime/helpers';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(serializeRuntimeState());
}