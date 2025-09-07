import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    if (!(prisma as any).toolMetricsXdr) {
      throw new Error('Prisma client is out of date. Run: npx prisma generate and restart the server.');
    }
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'latest'; // 'month' | 'quarter' | 'latest'
    const value = searchParams.get('value'); // e.g., '2025-08' or 'Q3 2025'

    let filter: any = {};
    if (mode === 'month' && value) {
      const [y, m] = value.split('-').map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 1));
      filter = { periodMonth: { gte: start, lt: end } };
    } else if (mode === 'quarter' && value) {
      filter = { periodQuarter: value };
    }

    const rows = await prisma.toolMetricsXdr.findMany({
      where: filter,
      orderBy: { periodMonth: 'desc' },
      take: mode === 'latest' ? 1 : undefined,
    });

    // Filters
    const all = await prisma.toolMetricsXdr.findMany({ orderBy: { periodMonth: 'desc' } });
    const months = Array.from(new Set(all.map(r => {
      const d = new Date(r.periodMonth);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
    })));
    const quarters = Array.from(new Set(all.map(r => r.periodQuarter)));

    return NextResponse.json({ success: true, rows, filters: { months, quarters } });
  } catch (e: any) {
    console.error('XDR data error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Failed to load data' }, { status: 500 });
  }
}

