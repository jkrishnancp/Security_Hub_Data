import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['ADMIN', 'ANALYST'].includes((session as any).user?.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const cursor = searchParams.get('cursor') || undefined;

    const logs = await prisma.ingestionLog.findMany({
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { importedDate: 'desc' },
      select: {
        id: true,
        filename: true,
        fileType: true,
        source: true,
        rowsProcessed: true,
        reportDate: true,
        importedDate: true,
        status: true,
        errorLog: true,
      },
    });

    return NextResponse.json({ success: true, logs });
  } catch (e: any) {
    console.error('ingestion-logs GET error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Failed to fetch logs' }, { status: 500 });
  }
}

