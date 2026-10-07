import { NextResponse } from 'next/server';
import { getProductionJob } from '@/app/api/project/builder/production/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId') || undefined;
  const job = getProductionJob(jobId);

  if (!job) {
    return NextResponse.json(
      {
        error: 'No hay pipeline activo todavía.',
      },
      { status: 404 },
    );
  }

  return NextResponse.json(job);
}
