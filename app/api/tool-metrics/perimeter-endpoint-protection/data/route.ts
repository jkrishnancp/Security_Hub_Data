import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Ensure generated Prisma client includes Tool Metrics models
    if (!(prisma as any).toolMetricsEmail || !(prisma as any).toolMetricsPerimeter) {
      throw new Error('Prisma client is out of date. Restart the server after running: npx prisma generate');
    }
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'latest'; // 'month' | 'quarter' | 'latest'
    const value = searchParams.get('value'); // e.g., '2025-02' or 'Q1 2025'

    let filter: any = {};
    if (mode === 'month' && value) {
      const [y, m] = value.split('-').map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 1));
      filter = { periodMonth: { gte: start, lt: end } };
    } else if (mode === 'quarter' && value) {
      filter = { periodQuarter: value };
    }

    const rows = await prisma.toolMetricsEmail.findMany({
      where: filter,
      orderBy: { periodMonth: 'desc' },
      take: mode === 'latest' ? 1 : undefined,
    });

    // Fetch perimeter rows that align with returned months for convenience
    const perims = await prisma.toolMetricsPerimeter.findMany({
      where: rows.length > 0 ? { periodMonth: { in: rows.map(r => r.periodMonth) } } : undefined,
    });
    const perimByMonth = new Map(perims.map(p => [p.periodMonth.toISOString(), p]));

    // Derive available months/quarters for filters
    const all = await prisma.toolMetricsEmail.findMany({ orderBy: { periodMonth: 'desc' } });
    const months = Array.from(new Set(all.map(r => {
      const d = new Date(r.periodMonth);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
    })));
    const quarters = Array.from(new Set(all.map(r => r.periodQuarter)));

    return NextResponse.json({ success: true, rows, perimeter: rows.map(r => perimByMonth.get(r.periodMonth.toISOString()) || null), filters: { months, quarters } });
  } catch (e: any) {
    console.error('Tool Metrics data error:', e);
    const message = e?.message || 'Failed to load data';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
