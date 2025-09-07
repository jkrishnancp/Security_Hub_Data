import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Accept either:
// 1) XDR_Secureworks_MMYYYY.csv (e.g., XDR_Secureworks_082025.csv)
// 2) ToolMetrics_Secureworks_QuarterXX_MMYYYY.csv (e.g., ToolMetrics_Secureworks_Quarter03_092025.csv)
const FILE_RE_A = /^XDR_Secureworks_((0[1-9]|1[0-2]))(\d{4})\.csv$/i;
const FILE_RE_B = /^ToolMetrics_Secureworks_Quarter(0[1-4])_((0[1-9]|1[0-2]))(\d{4})\.csv$/i;

export async function POST(request: NextRequest) {
  try {
    if (!(prisma as any).toolMetricsXdr) {
      throw new Error('Prisma client is out of date. Run: npx prisma generate and restart the server.');
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

    let mm: number, yyyy: number, periodQuarter: string;
    let m = file.name.match(FILE_RE_A);
    if (m) {
      mm = parseInt(m[1], 10);
      yyyy = parseInt(m[3], 10);
      const q = Math.floor((mm - 1) / 3) + 1;
      periodQuarter = `Q${q} ${yyyy}`;
    } else {
      m = file.name.match(FILE_RE_B);
      if (!m) {
        return NextResponse.json({ success: false, error: 'Invalid filename. Expected XDR_Secureworks_MMYYYY.csv or ToolMetrics_Secureworks_QuarterXX_MMYYYY.csv' }, { status: 400 });
      }
      const qNum = parseInt(m[1], 10);
      mm = parseInt(m[2], 10);
      yyyy = parseInt(m[4], 10);
      periodQuarter = `Q${qNum} ${yyyy}`;
    }
    const periodMonth = new Date(Date.UTC(yyyy, mm - 1, 1));
    const reportLabel = `${String(mm).padStart(2, '0')}${yyyy}`;

    const csvText = await file.text();
    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      return NextResponse.json({ success: false, error: 'CSV must have header and at least one row' }, { status: 400 });
    }
    const headersRaw = lines[0].replace(/\uFEFF/g, '');
    const headers = parseCSVRow(headersRaw).map(h => h.trim().toLowerCase());
    const idxName = headers.findIndex(h => h === 'name');
    const idxCount = headers.findIndex(h => h === 'count');
    if (idxName === -1 || idxCount === -1) {
      return NextResponse.json({ success: false, error: 'CSV must contain headers: Name,Count' }, { status: 400 });
    }

    const map: Record<string, number> = {};
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVRow(lines[i]);
      if (row.length === 0) continue;
      const name = (row[idxName] || '').toString().trim().toLowerCase();
      const countStr = (row[idxCount] || '').toString().trim();
      map[name] = parseCount(countStr);
    }

    const events = map['events'] || 0;
    const detections = Math.round(map['detections'] || 0);
    const triaged = Math.round(map['triaged events'] || 0);
    const investigations = Math.round(map['investigations'] || 0);
    const incidents = Math.round(map['incidents'] || 0);

    // Store raw event count (no TB conversion); UI will format K/M/B
    const eventsCount = Math.round(events);

    await prisma.toolMetricsXdr.upsert({
      where: { periodMonth },
      update: {
        periodQuarter,
        reportLabel,
        eventsTb: eventsCount,
        detections,
        triagedEvents: triaged,
        investigations,
        incidents,
        raw_json: JSON.stringify({ filename: file.name }),
      },
      create: {
        periodMonth,
        periodQuarter,
        reportLabel,
        eventsTb: eventsCount,
        detections,
        triagedEvents: triaged,
        investigations,
        incidents,
        raw_json: JSON.stringify({ filename: file.name }),
      },
    });

    return NextResponse.json({ success: true, periodMonth, periodQuarter, rowsProcessed: 5 });
  } catch (error: any) {
    console.error('XDR import error:', error);
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

function parseCount(input: string): number {
  // Parse a number that may include commas; ignore words/units
  const m = String(input).trim().match(/([0-9][0-9,\. ]*)/);
  if (!m) return 0;
  const n = Number(m[1].replace(/[ ,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
