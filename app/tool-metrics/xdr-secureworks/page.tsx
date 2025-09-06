"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type XdrRow = {
  period: string; // YYYY-MM
  events_tb: number;
  detections: number;
  triaged_events: number;
  investigations: number;
  incidents: number;
};

type Highlight = { id: string; date: string; text: string };

const DATA_KEY = "xdr_data_v1";
const HIGHLIGHTS_KEY = "xdr_highlights_v1";

type NameCount = { Name: string; Count: string | number };

function parseCSV(text: string): XdrRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const required = [
    "period",
    "events_tb",
    "detections",
    "triaged_events",
    "investigations",
    "incidents",
  ];
  const missing = required.filter((k) => !header.includes(k));
  if (missing.length) throw new Error(`CSV missing headers: ${missing.join(", ")}`);
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const rows: XdrRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (!cols.length || !cols[idx.period]) continue;
    rows.push({
      period: cols[idx.period],
      events_tb: Number(cols[idx.events_tb] || 0) || 0,
      detections: Number(cols[idx.detections] || 0) || 0,
      triaged_events: Number(cols[idx.triaged_events] || 0) || 0,
      investigations: Number(cols[idx.investigations] || 0) || 0,
      incidents: Number(cols[idx.incidents] || 0) || 0,
    });
  }
  return rows;
}

function coerceArrayJson(input: any): XdrRow[] {
  if (Array.isArray(input)) return input as XdrRow[];
  if (typeof input === "object" && input) return [input as XdrRow];
  throw new Error("JSON must be an object or array of objects");
}

function parseNameCountCSV(text: string): NameCount[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nIdx = header.findIndex((h) => h === "name");
  const cIdx = header.findIndex((h) => h === "count");
  if (nIdx === -1 || cIdx === -1) throw new Error("CSV must have Name,Count headers");
  const out: NameCount[] = [];
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    // naive CSV parse for two fields; handles quoted numbers with commas
    let name = "";
    let count = "";
    if (raw.includes('"')) {
      // Split on first comma not inside quotes
      const m = raw.match(/^([^,]+),(.+)$/);
      if (m) {
        name = m[1].replace(/^\"|\"$/g, "").trim();
        count = m[2].replace(/^\"|\"$/g, "").trim();
      }
    } else {
      const parts = raw.split(",");
      name = (parts[0] || "").trim();
      count = (parts.slice(1).join(",") || "").trim();
    }
    if (!name) continue;
    out.push({ Name: name, Count: count });
  }
  return out;
}

function parseNameCountJSON(text: string): NameCount[] {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data as NameCount[];
  if (typeof data === "object" && data) return [data as NameCount];
  throw new Error("JSON must be an object or array of {Name,Count}");
}

function parseHumanNumber(input: string | number): number {
  if (typeof input === "number") return input;
  const s = String(input).trim();
  const m = s.match(/([0-9][0-9,\. ]*)/);
  if (!m) throw new Error(`Unable to parse number: ${input}`);
  const n = Number(m[1].replace(/[ ,]/g, ""));
  if (Number.isFinite(n)) return n;
  throw new Error(`Unable to parse number: ${input}`);
}

function formatNum(n: number): string {
  // Show counts exactly with thousands separators (no K/M rounding)
  return Math.round(n).toLocaleString();
}

// Generate a UUID that works even when `crypto.randomUUID` is unavailable
function genId(): string {
  try {
    const g: any = globalThis as any;
    if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  } catch {}
  // RFC4122-ish fallback using Math.random (sufficient for client-only keys)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Abbreviate large counts (K/M/B), else use thousands separators
function formatTB(n: number): string {
  const abs = Math.abs(n);
  const trim = (v: number) => v.toFixed(1).replace(/\.0$/, "");
  if (abs >= 1_000_000_000) return `${trim(n / 1_000_000_000)} B`;
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)} M`;
  if (abs >= 1_000) return `${trim(n / 1_000)} K`;
  return Math.round(n).toLocaleString();
}

function monthToQuarter(period: string): string {
  // period: YYYY-MM
  const [y, m] = period.split("-").map((x) => parseInt(x, 10));
  if (!y || !m) return period;
  const q = Math.floor((m - 1) / 3) + 1;
  return `${y}-Q${q}`;
}

function getQuarterMonths(periodQuarter: string): string[] {
  // Support 'YYYY-Qn' or 'Qn YYYY'
  let y: number | null = null;
  let q: number | null = null;
  let match = periodQuarter.match(/^(\d{4})-Q([1-4])$/);
  if (match) {
    y = parseInt(match[1], 10);
    q = parseInt(match[2], 10);
  } else {
    match = periodQuarter.match(/^Q([1-4])\s+(\d{4})$/);
    if (match) {
      q = parseInt(match[1], 10);
      y = parseInt(match[2], 10);
    }
  }
  if (!y || !q) return [];
  const startMonth = (q - 1) * 3 + 1;
  return [0, 1, 2].map((i) => `${y}-${String(startMonth + i).padStart(2, "0")}`);
}

function byPeriodDesc(a: string, b: string) {
  return a < b ? 1 : a > b ? -1 : 0;
}

const DEFAULT_DATA: XdrRow[] = [
  { period: "2025-06", events_tb: 14_300_000_000, detections: 310_900, triaged_events: 100_900, investigations: 72, incidents: 3 },
  { period: "2025-07", events_tb: 15_100_000_000, detections: 332_500, triaged_events: 110_200, investigations: 68, incidents: 2 },
  { period: "2025-08", events_tb: 16_700_000_000, detections: 351_900, triaged_events: 121_100, investigations: 65, incidents: 0 },
];

export default function XdrSecureworksPage() {
  const { data: session } = useSession();
  const [rows, setRows] = useState<XdrRow[]>([]);
  const [mode, setMode] = useState<"month" | "quarter">("month");
  const [selected, setSelected] = useState<string>("");
  const [monthsSorted, setMonthsSorted] = useState<string[]>([]);
  const [quartersSorted, setQuartersSorted] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [hlText, setHlText] = useState("");
  const [hlDate, setHlDate] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<Array<{ filename: string; success: boolean; message: string; rowsProcessed?: number }>>([]);
  const ProgressPie = require('@/components/ui/progress-pie').default;

  // Load highlights + initial server data
  useEffect(() => {
    try {
      const H = typeof window !== "undefined" ? localStorage.getItem(HIGHLIGHTS_KEY) : null;
      setHighlights(H ? (JSON.parse(H) as Highlight[]) : []);
    } catch {
      setHighlights([]);
    }
    fetchData('latest');
  }, []);

  // When mode/selected changes, refresh data for that scope
  useEffect(() => {
    if (!selected) return;
    fetchData(mode, selected);
  }, [mode, selected]);

  // Ensure a valid selection exists when switching modes
  useEffect(() => {
    if (mode === 'month') {
      if (!selected || !monthsSorted.includes(selected)) {
        if (monthsSorted.length > 0) setSelected(monthsSorted[0]);
      }
    } else {
      if (!selected || !quartersSorted.includes(selected)) {
        if (quartersSorted.length > 0) setSelected(quartersSorted[0]);
      }
    }
  }, [mode, monthsSorted, quartersSorted]);

  async function fetchData(fetchMode: 'latest' | 'month' | 'quarter', value?: string) {
    try {
      const params = new URLSearchParams();
      params.set('mode', fetchMode);
      if (value) params.set('value', value);
      const res = await fetch(`/api/tool-metrics/xdr-secureworks/data?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const srvRows = (data.rows || []).map((r: any) => ({
        period: toYYYYMM(r.periodMonth),
        events_tb: Number(r.eventsTb || 0),
        detections: Number(r.detections || 0),
        triaged_events: Number(r.triagedEvents || 0),
        investigations: Number(r.investigations || 0),
        incidents: Number(r.incidents || 0),
      })) as XdrRow[];
      setRows(srvRows);
      if (Array.isArray(data.filters?.months)) setMonthsSorted(data.filters.months);
      if (Array.isArray(data.filters?.quarters)) setQuartersSorted(data.filters.quarters);
      if (fetchMode === 'latest') {
        const months = data.filters?.months || [];
        if (months.length) setSelected((s: string) => (s && months.includes(s) ? s : months[0]));
      }
    } catch (e) {
      // ignore
    }
  }

  function toYYYYMM(dateStr: string): string {
    const d = new Date(dateStr);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  // Aggregation per selection
  const current = useMemo(() => {
    if (!rows.length || !selected) return null;
    if (mode === "month") {
      const r = rows.find((x) => x.period === selected);
      return r || null;
    }
    // Aggregate only months that belong to the selected quarter
    const months = new Set(getQuarterMonths(selected));
    const agg = rows
      .filter((r) => months.has(r.period))
      .reduce(
      (acc, r) => ({
        period: selected,
        events_tb: acc.events_tb + r.events_tb,
        detections: acc.detections + r.detections,
        triaged_events: acc.triaged_events + r.triaged_events,
        investigations: acc.investigations + r.investigations,
        incidents: acc.incidents + r.incidents,
      }),
      { period: selected, events_tb: 0, detections: 0, triaged_events: 0, investigations: 0, incidents: 0 }
    );
    return agg;
  }, [rows, selected, mode]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    setProgress(10);
    const t = setInterval(() => setProgress((p) => (p < 90 ? p + 2 : p)), 150);
    setUploadResults((prev) => prev.filter((r) => r.filename !== f.name));
    try {
      const formData = new FormData();
      formData.append('file', f);
      const res = await fetch('/api/tool-metrics/xdr-secureworks/import', { method: 'POST', body: formData });
      const result = await res.json();
      if (res.ok && result.success) {
        setUploadResults((prev) => ([...prev, { filename: f.name, success: true, message: 'Imported successfully', rowsProcessed: result.rowsProcessed }]));
        await fetchData('latest');
      } else {
        setUploadResults((prev) => ([...prev, { filename: f.name, success: false, message: result.error || 'Upload failed' }]));
      }
    } catch (error: any) {
      setUploadResults((prev) => ([...prev, { filename: f.name, success: false, message: error?.message || 'Upload failed' }]));
    } finally {
      clearInterval(t);
      setProgress(100);
      setUploading(false);
      e.target.value = '';
    }
  }

  function applyNameCountToPeriod(existing: XdrRow[], period: string, pairs: NameCount[]): XdrRow[] {
    const normKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const map = new Map<string, number>();
    for (const p of pairs) {
      const key = normKey(String(p.Name));
      const valRaw = parseHumanNumber(p.Count);
      map.set(key, valRaw);
    }
    const idx = existing.findIndex((r) => r.period === period);
    const base: XdrRow = idx >= 0 ? { ...existing[idx] } : { period, events_tb: 0, detections: 0, triaged_events: 0, investigations: 0, incidents: 0 };

    // Events: store raw event count
    if (map.has("events")) {
      const v = map.get("events")!;
      base.events_tb = Math.round(Number(v));
    }
    if (map.has("detections")) base.detections = Math.round(map.get("detections")!);
    if (map.has("triaged events")) base.triaged_events = Math.round(map.get("triaged events")!);
    if (map.has("investigations")) base.investigations = Math.round(map.get("investigations")!);
    if (map.has("incidents")) base.incidents = Math.round(map.get("incidents")!);

    const next = existing.slice();
    if (idx >= 0) next[idx] = base; else next.push(base);
    return next;
  }

  function saveHighlight() {
    if (!hlDate || !hlText.trim()) return;
    const item: Highlight = { id: genId(), date: hlDate, text: hlText.trim() };
    const next = [item, ...highlights];
    setHighlights(next);
    localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(next));
    setHlText("");
  }

  function deleteHighlight(id: string) {
    const next = highlights.filter((h) => h.id !== id);
    setHighlights(next);
    localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(next));
  }

  const filteredHighlights = useMemo(() => {
    if (!selected) return highlights.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    if (mode === "month") {
      return highlights
        .filter((h) => h.date.startsWith(selected))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
    }
    const months = new Set(getQuarterMonths(selected));
    return highlights
      .filter((h) => months.has(h.date.slice(0, 7)))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [highlights, mode, selected]);

  // Chart sizes
  // Increased overall size and ring thickness to make each onion wider
  const size = 840; // svg width/height
  const cx = size / 2;
  const cy = size / 2 + 14;
  const baseR = 380; // outer radius
  const ringWidth = 75; // thicker rings (approx 1.5x)
  const labels = useMemo(() => {
    const c = current || {
      period: "-",
      events_tb: 0,
      detections: 0,
      triaged_events: 0,
      investigations: 0,
      incidents: 0,
    };
    return [
      { key: "events_tb", name: `Events – ${formatTB(c.events_tb)}`, color: "#e67e22" },
      { key: "detections", name: `Detections – ${formatTB(c.detections)}`, color: "#2e7d32" },
      { key: "triaged_events", name: `Triaged Events – ${formatTB(c.triaged_events)}`, color: "#1e88e5" },
      { key: "investigations", name: `Investigations – ${formatNum(c.investigations)}`, color: "#8e44ad" },
      { key: "incidents", name: `Incidents – ${formatNum(c.incidents)}`, color: "#7cb342" },
    ];
  }, [current]);

  function wrapLabel(text: string, maxChars: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      if ((line + (line ? " " : "") + w).length <= maxChars) {
        line = line ? line + " " + w : w;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="title">XDR – From Volume to Incidents</h1>

        {/* Global filter and Import */}
        <div className="toolbar">
          <div className="field-group">
            <label className="label">View</label>
            <div className="segmented">
              <button
                className={`seg ${mode === "month" ? "active" : ""}`}
                onClick={() => setMode("month")}
              >
                Month
              </button>
              <button
                className={`seg ${mode === "quarter" ? "active" : ""}`}
                onClick={() => setMode("quarter")}
              >
                Quarter
              </button>
            </div>
          </div>
          <div className="field-group">
            <label className="label">Period</label>
            <select
              className="select"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {(mode === "month" ? monthsSorted : quartersSorted).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="spacer" />
          {session?.user && (session.user as any).role === 'ADMIN' && (
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <button className="btn">Import Data</button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import XDR Metrics</DialogTitle>
                <DialogDescription>
                  Upload CSV for the selected Month. Quarter view is read-only.
                </DialogDescription>
              </DialogHeader>
              <div className="muted" style={{ marginBottom: 8 }}>
                CSV format: file named like <code>XDR_Secureworks_MMYYYY.csv</code> or <code>ToolMetrics_Secureworks_QuarterXX_MMYYYY.csv</code> with headers <code>Name,Count</code>.
                Names must be one of: Events, Detections, Triaged Events, Investigations, Incidents.
                For Events, Count should be a raw number (commas allowed), e.g., <code>81,207,388,268</code>. The UI displays counts as K/M/B.
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={mode === "quarter" || uploading}>
                  Select CSV/JSON
                </button>
                {mode === "quarter" && (
                  <span className="muted">Switch to Month to import period data.</span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={onFileChange}
                />
              </div>

              {uploadResults.length > 0 && (
                <div className="hlList" style={{ marginTop: 10 }}>
                  {uploading && (
                    <div className="mb-2 flex items-center">
                      <ProgressPie value={progress} />
                    </div>
                  )}
                  {uploadResults.map((res, idx) => (
                    <div key={res.filename + idx} className="hlItem" style={{ gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 13 }}>
                        {res.success ? '✅' : '❌'} {res.filename}: {res.message}
                        {typeof res.rowsProcessed === 'number' ? ` • Rows: ${res.rowsProcessed}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="subHeader">Add Highlight</div>
              <div className="hlForm">
                <input
                  className="input"
                  type="date"
                  value={hlDate}
                  onChange={(e) => setHlDate(e.target.value)}
                />
                <textarea
                  className="textarea"
                  placeholder="Add highlight notes..."
                  value={hlText}
                  onChange={(e) => setHlText(e.target.value)}
                  rows={3}
                />
                <button className="btn" onClick={saveHighlight}>
                  Save
                </button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>

        {/* Layout: left copy – chart – right copy */}
        <div className="grid3">
          <div className="copy">
            <h3>Events –</h3>
            <p>
              Raw data from various log sources such as CrowdStrike, Office 365,
              Proofpoint, Zscaler, etc.
            </p>

            <h3>Triaged Events –</h3>
            <p>
              Correlations, severity, and impact assessed to determine if further
              investigation is needed.
            </p>
          </div>

          {/* SVG Onion Chart */}
          <div className="chartCard">
            <svg width={size} height={size} role="img" aria-label="XDR Onion Chart">
              {/* Rings from outside to inside */}
              {labels.map((l, i) => {
                const rOuter = baseR - i * ringWidth;
                const rInner = rOuter - ringWidth + 1;
                const ty = cy - rOuter + ringWidth / 2;
                const charCaps = [26, 20, 18, 16, 14];
                const lines = wrapLabel(l.name, charCaps[i] || 14);
                return (
                  <g key={l.key}>
                    <circle cx={cx} cy={cy} r={rOuter} fill={l.color} opacity={0.9} />
                    {i > 0 && (
                      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="#ffffff" strokeWidth={2} />
                    )}
                    <text
                      x={cx}
                      y={(i === labels.length - 1 ? cy : ty) - (lines.length - 1) * 10}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#ffffff"
                      fontSize={i < 2 ? 18 : 16}
                      fontWeight={600}
                    >
                      {lines.map((ln, j) => (
                        <tspan key={j} x={cx} dy={j === 0 ? 0 : 20}>
                          {ln}
                        </tspan>
                      ))}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="copy">
            <h3>Detections –</h3>
            <p>
              Security-related patterns or behaviors based on rules or machine
              learning models.
            </p>

            <h3>Investigations –</h3>
            <p>
              Detailed analysis for potential threats and suspicious activities.
              Review workstations, servers and remediate.
            </p>

            <h3>Incidents –</h3>
            <p>
              Confirmed security events requiring response and remediation.
            </p>
          </div>
        </div>

        {/* Highlights only */}
        <div className="card">
          <div className="cardHeader">Highlights</div>
          <div className="cardBody">
            <div className="hlList">
              {filteredHighlights.length === 0 ? (
                <div className="muted">No highlights yet.</div>
              ) : (
                filteredHighlights.map((h) => (
                  <div key={h.id} className="hlItem">
                    <div>
                      <div className="hlDate">{h.date}</div>
                      <div className="hlText">{h.text}</div>
                    </div>
                    <button className="link" onClick={() => deleteHighlight(h.id)}>
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      {/* Minimal CSS */}
      <style jsx>{`
        /* Standardize to global theme; remove page/container overrides */
        .title { text-align: center; font-weight: 700; font-size: 22px; margin-bottom: 16px; }
        .toolbar { display: flex; gap: 16px; align-items: end; background: #0f172a; padding: 12px; border-radius: 10px; border: 1px solid #1f2a44; }
        .field-group { display: flex; flex-direction: column; gap: 6px; }
        .label { font-size: 12px; color: #93a3b8; }
        .segmented { display: inline-flex; background: #111827; padding: 4px; border-radius: 8px; border: 1px solid #1f2a44; }
        .seg { font-size: 13px; color: #cbd5e1; background: transparent; border: 0; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
        .seg.active { background: #1f2937; color: white; }
        .select { background: #0b132b; color: #e5e7eb; border: 1px solid #1f2a44; border-radius: 8px; padding: 8px 10px; min-width: 160px; }
        .spacer { flex: 1; }
        .btn { background: #2563eb; color: white; padding: 8px 12px; border-radius: 8px; border: 0; cursor: pointer; }
        .btn:hover { background: #1d4ed8; }
        .btn[disabled] { background: #334155; cursor: not-allowed; }
        .hidden { display: none; }
        .grid3 { display: grid; grid-template-columns: 1fr auto 1fr; gap: 24px; align-items: center; margin: 20px 0; }
        .copy h3 { margin: 0 0 6px 0; font-size: 16px; font-weight: 700; }
        .copy p { margin: 0 0 16px 0; color: #cbd5e1; font-size: 14px; }
        .chartCard { background: #0f172a; border: 1px solid #1f2a44; border-radius: 16px; padding: 8px; }
        .card { background: #0f172a; border: 1px solid #1f2a44; border-radius: 12px; margin-top: 12px; }
        .cardHeader { padding: 12px 16px; font-weight: 600; border-bottom: 1px solid #1f2a44; }
        .cardBody { padding: 12px 16px; }
        .subHeader { margin-top: 14px; margin-bottom: 6px; font-weight: 600; }
        .importInfo code { background: #0b1320; padding: 1px 6px; border-radius: 6px; border: 1px solid #1f2a44; }
        .hlForm { display: grid; grid-template-columns: 160px 1fr auto; gap: 10px; }
        .input, .textarea { background: #0b132b; color: #e5e7eb; border: 1px solid #1f2a44; border-radius: 8px; padding: 8px 10px; }
        .textarea { resize: vertical; }
        .hlList { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
        .hlItem { display: flex; justify-content: space-between; align-items: start; padding: 10px; border: 1px solid #1f2a44; border-radius: 8px; background: #0b1320; }
        .hlDate { font-size: 12px; color: #93a3b8; margin-bottom: 4px; }
        .hlText { white-space: pre-wrap; }
        .link { background: transparent; color: #60a5fa; border: 0; cursor: pointer; padding: 0; }
        .link:hover { text-decoration: underline; }

        @media (max-width: 1100px) {
          .grid3 { grid-template-columns: 1fr; }
          .chartCard { justify-self: center; }
        }
      `}</style>
    </div>
  );
}
