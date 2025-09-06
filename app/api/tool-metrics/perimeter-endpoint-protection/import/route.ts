import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Filename example: Perimeter_Protection_Quarter01_022025.csv
// Groups: 1=quarter (01-04), 2=month (01-12), 3=year (YYYY)
const FILE_RE = /^Perimeter_Protection_Quarter(0[1-4])_((0[1-9]|1[0-2]))(\d{4})\.csv$/i;

export async function POST(request: NextRequest) {
  try {
    // Ensure generated Prisma client includes Tool Metrics models
    if (!(prisma as any).toolMetricsEmail || !(prisma as any).toolMetricsPerimeter) {
      throw new Error('Prisma client is out of date. Restart the server after running: npx prisma generate');
    }
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ success: false, error: 'Only CSV files are supported' }, { status: 400 });
    }

    const match = file.name.match(FILE_RE);
    if (!match) {
      return NextResponse.json({ success: false, error: 'Invalid filename. Expected Perimeter_Protection_QuarterXX_MMYYYY.csv' }, { status: 400 });
    }

    const quarterNum = parseInt(match[1], 10); // 01-04
    const mm = parseInt(match[2], 10); // 01-12
    const yyyy = parseInt(match[4], 10);

    // Build month date as first day of month at UTC
    const periodMonth = new Date(Date.UTC(yyyy, mm - 1, 1));
    // Trust the quarter in the filename (e.g., Quarter01 -> Q1)
    const periodQuarter = `Q${quarterNum} ${yyyy}`;
    const reportLabel = `${match[2]}${match[4]}`;

    const csvText = await file.text();
    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      return NextResponse.json({ success: false, error: 'CSV must have header and at least one row' }, { status: 400 });
    }
    // Normalize header row (strip BOM if present)
    const headersRaw = lines[0].replace(/\uFEFF/g, '');
    const headers = parseCSVRow(headersRaw).map(h => h.trim());
    let idxCategory = headers.findIndex(h => h.toLowerCase() === 'category');
    let idxItem = headers.findIndex(h => h.toLowerCase() === 'item');
    let idxCount = headers.findIndex(h => h.toLowerCase() === 'count');
    // Fallback: handle files that omit header names but keep 3 columns with Count as the 3rd
    if ((idxCategory === -1 || idxItem === -1) && idxCount === 2 && headers.length >= 3 && headers[2].toLowerCase() === 'count') {
      idxCategory = 0;
      idxItem = 1;
    }
    if (idxCategory === -1 || idxItem === -1 || idxCount === -1) {
      return NextResponse.json({ success: false, error: 'CSV must contain headers: Category, Item, Count' }, { status: 400 });
    }

    // Accumulators (Email)
    let inbound = 0, blockedPP = 0, blockedMS = 0, delivered = 0;
    // Accumulators (Perimeter/Network)
    let perimInboundAllowed = 0, perimBlocked = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVRow(lines[i]);
      if (row.length === 0) continue;
      const category = (row[idxCategory] || '').trim().toLowerCase();
      const item = (row[idxItem] || '').trim().toLowerCase();
      const countRaw = (row[idxCount] || '').toString().replace(/[, ]/g, '');
      const count = Number(countRaw) || 0;

      if (category === 'email') {
        if (item.includes('total inbound')) inbound += count;
        else if (item.includes('blocked') && item.includes('proofpoint')) blockedPP += count;
        else if (item.includes('blocked') && (item.includes('o365') || item.includes('ms365'))) blockedMS += count;
        else if (item.includes('total delivered')) delivered += count;
      } else if (category.startsWith('network')) {
        if (item.includes('total inbound allowed')) perimInboundAllowed += count;
        else if (item.includes('total blocked')) perimBlocked += count;
      }
    }

    // Upsert email metrics for the month
    const emailData = {
      periodMonth,
      periodQuarter,
      reportLabel,
      inboundEmails: inbound,
      blockedProofpoint: blockedPP,
      blockedMS365: blockedMS,
      deliveredEmails: delivered,
      raw_json: JSON.stringify({ filename: file.name }),
    } as const;

    await prisma.toolMetricsEmail.upsert({
      where: { periodMonth },
      update: emailData,
      create: emailData,
    });

    // Optionally parse and store perimeter metrics if present (generic fields)
    const perimInbound = (perimInboundAllowed || 0) + (perimBlocked || 0);
    const perimDelivered = perimInboundAllowed || 0;

    await prisma.toolMetricsPerimeter.upsert({
      where: { periodMonth },
      update: {
        periodQuarter,
        reportLabel,
        totalInbound: perimInbound || null,
        totalBlocked: perimBlocked || null,
        delivered: perimDelivered || null,
        raw_json: JSON.stringify({ filename: file.name }),
      },
      create: {
        periodMonth,
        periodQuarter,
        reportLabel,
        totalInbound: perimInbound || null,
        totalBlocked: perimBlocked || null,
        delivered: perimDelivered || null,
        raw_json: JSON.stringify({ filename: file.name }),
      }
    });

    return NextResponse.json({ success: true, periodMonth, periodQuarter, totals: { inbound, blockedPP, blockedMS, delivered } });
  } catch (error: any) {
    console.error('Tool Metrics import error:', error);
    const message = error?.message || 'Failed to import file';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function parseCSVRow(line: string): string[] {
  const res: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { res.push(trimQuotes(cur)); cur = ''; }
    else cur += ch;
  }
  res.push(trimQuotes(cur));
  return res;
}

function trimQuotes(s: string) { return s.trim().replace(/^"|"$/g, ''); }
function normalize(s: string) { return s.toLowerCase().trim(); }
function toNum(map: Record<string,string>, keys: string[]): number {
  for (const k of keys) {
    const v = map[normalize(k)] ?? map[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      const n = Number(String(v).replace(/[, ]/g, ''));
      if (!isNaN(n)) return n;
    }
  }
  return 0;
}
