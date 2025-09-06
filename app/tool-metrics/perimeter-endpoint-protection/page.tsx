"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/components/theme-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { AlertCircle, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';

export default function ToolMetricsPerimeterEndpointProtection() {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const { data: session } = useSession();

  // Filters
  const [mode, setMode] = useState<'latest' | 'month' | 'quarter'>('latest');
  const [value, setValue] = useState<string>('');
  const [months, setMonths] = useState<string[]>([]);
  const [quarters, setQuarters] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [rows, setRows] = useState<any[]>([]);
  const [perimeterRows, setPerimeterRows] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const fetchData = async (m: 'latest'|'month'|'quarter' = mode, v = value) => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('mode', m);
      if (v) qs.set('value', v);
      const res = await fetch(`/api/tool-metrics/perimeter-endpoint-protection/data?${qs.toString()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load');
      setRows(data.rows || []);
      setPerimeterRows(data.perimeter || []);
      setMonths(data.filters?.months || []);
      setQuarters(data.filters?.quarters || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData('latest'); }, []);

  const selected = rows[0] || null;
  
  // When viewing a quarter, aggregate rows on the client
  const emailAgg = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    if (mode !== 'quarter') return rows[0];
    return rows.reduce((acc: any, r: any) => ({
      ...r,
      inboundEmails: (acc.inboundEmails || 0) + (r.inboundEmails || 0),
      blockedProofpoint: (acc.blockedProofpoint || 0) + (r.blockedProofpoint || 0),
      blockedMS365: (acc.blockedMS365 || 0) + (r.blockedMS365 || 0),
      deliveredEmails: (acc.deliveredEmails || 0) + (r.deliveredEmails || 0),
    }), {});
  }, [rows, mode]);
  // Color palette aligned with the provided image
  const COLORS = {
    email: {
      inbound: '#E0B43B',    // gold
      blockedPP: '#BDBDBD',  // gray
      blockedMS: '#F2994A',  // orange
      delivered: '#2E7D32',  // green
    },
    perimeter: {
      allowed: '#1F6A84',    // teal/blue ring
      blocked: '#F0862D',    // orange slice
    },
  } as const;
  const selectedPerimeter = perimeterRows[0] || null;
  const funnelData = useMemo(() => {
    if (!emailAgg) return [];
    return [
      { name: 'Total Inbound Emails', value: emailAgg.inboundEmails ?? 0, fill: COLORS.email.inbound },
      { name: 'Blocked by Proofpoint', value: emailAgg.blockedProofpoint ?? 0, fill: COLORS.email.blockedPP },
      { name: 'Blocked by MS365', value: emailAgg.blockedMS365 ?? 0, fill: COLORS.email.blockedMS },
      { name: 'Total Emails Delivered', value: emailAgg.deliveredEmails ?? 0, fill: COLORS.email.delivered },
    ];
  }, [emailAgg]);

  const fmtM = (n: number) => `${(n / 1_000_000).toFixed(2)} M`;
  
  // Perimeter aggregation
  const perimeterAgg = useMemo(() => {
    if (!perimeterRows || perimeterRows.length === 0) return null;
    if (mode !== 'quarter') return perimeterRows[0];
    return perimeterRows.reduce((acc: any, r: any) => ({
      ...r,
      totalInbound: (acc.totalInbound || 0) + (r.totalInbound || 0),
      totalBlocked: (acc.totalBlocked || 0) + (r.totalBlocked || 0),
      delivered: (acc.delivered || 0) + (r.delivered || 0),
    }), {});
  }, [perimeterRows, mode]);

  // Render inside-slice labels for the donut chart
  const renderPieLabel = (props: any) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, name, value } = props || {};
    const r = (innerRadius ?? 0) + ((outerRadius ?? 0) - (innerRadius ?? 0)) * 0.6;
    const x = (cx ?? 0) + r * Math.cos(-midAngle * RADIAN);
    const y = (cy ?? 0) + r * Math.sin(-midAngle * RADIAN);
    const label = String(name ?? '');
    const val = fmtM(Number(value) || 0);
    const isAllowed = /Allowed/i.test(label);
    const textFill = '#111827';
    return (
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={textFill}>
        <tspan x={x} dy={-4} fontSize="12">{label}</tspan>
        <tspan x={x} dy={16} fontSize="14" fontWeight={700}>{val}</tspan>
      </text>
    );
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/tool-metrics/perimeter-endpoint-protection/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Import failed');
      setFile(null);
      await fetchData(mode, value);
    } catch (e: any) {
      setError(e?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  // Custom 3-stage inverted funnel SVG component (segmented trapezoids)
  const InvertedFunnelSVG: React.FC<{
    stages: { label: string; value: number; fill: string }[];
    delivered: { label: string; value: number; fill: string };
  }> = ({ stages, delivered }) => {
    const cw = 1000; // viewBox width
    const ch = 640;  // taller viewBox for readability
    const padX = 24; // tighter side padding to maximize width
    const padY = 12;
    const gap = 12; // vertical gap between stages
    const deliveredH = 120; // taller delivered rectangle for readability
    const innerW = cw - padX * 2;
    const cx = cw / 2;
    const stageCount = Math.min(3, stages.length);
    const values = stages.slice(0, stageCount).map(s => Math.max(0, Number(s.value) || 0));
    const maxVal = Math.max(1, ...values);
    const minStageRatio = 0.45; // ensure each stage wide enough for labels
    const widths = values
      .map(v => (v / maxVal) * innerW)
      .map(w => Math.max(w, innerW * minStageRatio));

    const totalGaps = gap * (stageCount - 1);
    const stageH = Math.max(110, Math.floor((ch - padY * 2 - totalGaps - deliveredH) / stageCount));

    // Top-of-chart width (for the very first trapezoid top edge)
    const W0 = innerW; // start at full width

    // Compute trapezoid polygons for each stage
    let y = padY;
    const polys: { points: string; fill: string; label: string; cx: number; cy: number; value: number }[] = [];
    for (let i = 0; i < stageCount; i++) {
      const topW = i === 0 ? W0 : widths[i - 1];
      const botW = widths[i];
      const y0 = y;
      const y1 = y0 + stageH;
      const x0L = cx - topW / 2;
      const x0R = cx + topW / 2;
      const x1L = cx - botW / 2;
      const x1R = cx + botW / 2;
      const points = `${x0L},${y0} ${x0R},${y0} ${x1R},${y1} ${x1L},${y1}`;
      const cy = (y0 + y1) / 2;
      polys.push({
        points,
        fill: stages[i].fill,
        label: stages[i].label,
        cx,
        cy,
        value: values[i],
      });
      y = y1 + gap;
    }

    // Bottom of funnel and width for delivered bar
    const bottomY = y - gap;
    const bottomW = widths[Math.max(0, stageCount - 1)] || innerW;
    const minDeliveredRatio = 0.8; // ensure the delivered bar is visually substantial
    const deliveredW = Math.max(bottomW, innerW * minDeliveredRatio);
    const deliveredX = cx - deliveredW / 2;

    return (
      <svg viewBox={`0 0 ${cw} ${ch}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {polys.map((p, idx) => (
          <g key={idx}>
            <polygon points={p.points} fill={p.fill} />
            <text x={p.cx} y={p.cy} textAnchor="middle" dominantBaseline="middle" fill="#000000">
              <tspan x={p.cx} dy="-0.3em" fontSize="18">{p.label}</tspan>
              <tspan x={p.cx} dy="1.8em" fontSize="24" fontWeight={800}>{fmtM(p.value)}</tspan>
            </text>
          </g>
        ))}
        {/* Delivered rectangle attached to funnel bottom */}
        <g>
          <rect x={deliveredX} y={bottomY} width={deliveredW} height={deliveredH} fill={delivered.fill} />
          <text x={cx} y={bottomY + deliveredH / 2} textAnchor="middle" dominantBaseline="middle" fill="#ffffff">
            <tspan x={cx} dy="-0.3em" fontSize="18">{delivered.label}</tspan>
            <tspan x={cx} dy="1.8em" fontSize="24" fontWeight={800}>{fmtM(delivered.value)}</tspan>
          </text>
        </g>
      </svg>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Filters and Import */}
        <Card className={cn(isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200', 'mb-3')}>
          <CardHeader className="pb-0">
            <CardTitle className={cn('text-center', isDark ? 'text-white' : 'text-gray-900')}>Filters</CardTitle>
          </CardHeader>
          <CardContent className="pt-1 pb-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Select value={mode} onValueChange={(v:any)=>{ setMode(v); setValue(''); }}>
                <SelectTrigger className={cn(isDark ? 'bg-gray-700 border-gray-600' : '')}>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest</SelectItem>
                  <SelectItem value="quarter">By Quarter</SelectItem>
                  <SelectItem value="month">By Month</SelectItem>
                </SelectContent>
              </Select>
              {mode === 'quarter' && (
                <Select value={value} onValueChange={(v)=>{ setValue(v); }}>
                  <SelectTrigger className={cn(isDark ? 'bg-gray-700 border-gray-600' : '')}>
                    <SelectValue placeholder="Select quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    {quarters.map(q => (<SelectItem key={q} value={q}>{q}</SelectItem>))}
                  </SelectContent>
                </Select>
              )}
              {mode === 'month' && (
                <Select value={value} onValueChange={(v)=>{ setValue(v); }}>
                  <SelectTrigger className={cn(isDark ? 'bg-gray-700 border-gray-600' : '')}>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(m => {
                      const [y, mm] = m.split('-').map(Number);
                      const dt = new Date(Date.UTC(y, (mm||1)-1, 1));
                      const label = dt.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
                      return (<SelectItem key={m} value={m}>{label}</SelectItem>);
                    })}
                  </SelectContent>
                </Select>
              )}
              <Button variant="default" onClick={()=>fetchData(mode, value)} disabled={loading || (mode !== 'latest' && !value)}>Apply</Button>

              {/* Admin-only import */}
              {session?.user.role === 'ADMIN' && (
                <div className="ml-auto flex items-center gap-2">
                  <Input type="file" accept=".csv" onChange={(e)=> setFile(e.target.files?.[0] ?? null)} />
                  <Button onClick={handleUpload} disabled={!file || loading}>
                    <Upload className="h-4 w-4 mr-2" /> Import CSV
                  </Button>
                </div>
              )}
            </div>

            {error && (
              <Alert variant="destructive" className="mb-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Charts moved below into two-column grid */}
          </CardContent>
        </Card>

        {/* Charts two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Email Protection – Inverted Funnel */}
          <Card className={cn(isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
            <CardHeader className="pb-0">
              <CardTitle className={cn('text-center', isDark ? 'text-white' : 'text-gray-900')}>Email Protection</CardTitle>
            </CardHeader>
            <CardContent className="pt-1 pb-1">
              <div className="w-full h-[640px] mt-1 mb-0">
                {emailAgg && (
                  <InvertedFunnelSVG
                    stages={[
                      { label: 'Total Inbound Emails', value: emailAgg.inboundEmails || 0, fill: COLORS.email.inbound },
                      { label: 'Blocked by Proofpoint', value: emailAgg.blockedProofpoint || 0, fill: COLORS.email.blockedPP },
                      { label: 'Blocked by MS365', value: emailAgg.blockedMS365 || 0, fill: COLORS.email.blockedMS },
                    ]}
                    delivered={{ label: 'Total Emails Delivered', value: emailAgg.deliveredEmails || 0, fill: COLORS.email.delivered }}
                  />
                )}
              </div>
              

              {/* Summary bullets */}
              {emailAgg && (
                <div className={cn('mt-1 text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Total Inbound Emails: {fmtM(emailAgg.inboundEmails || 0)}</li>
                    <li>Total Blocked (Proofpoint + MS365): {fmtM((emailAgg.blockedProofpoint||0) + (emailAgg.blockedMS365||0))}</li>
                    <li>Blocked %: {(((emailAgg.blockedProofpoint||0) + (emailAgg.blockedMS365||0)) / Math.max(1, emailAgg.inboundEmails||0) * 100).toFixed(1)} %</li>
                    <li>Total Delivered: {fmtM(emailAgg.deliveredEmails || 0)}</li>
                    <li>Delivered %: {((emailAgg.deliveredEmails||0) / Math.max(1, emailAgg.inboundEmails||0) * 100).toFixed(1)} %</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Perimeter Protection – Donut */}
          <Card className={cn(isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
            <CardHeader className="pb-0">
              <CardTitle className={cn('text-center', isDark ? 'text-white' : 'text-gray-900')}>Perimeter Protection</CardTitle>
            </CardHeader>
            <CardContent className="pt-1 pb-1">
              <div className="w-full h-[480px] mt-1 mb-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip formatter={(v:any, n:any)=>[fmtM(Number(v)), n]} />
                    {perimeterAgg && (
                      <Pie
                        data={[
                          { name: 'Total Inbound Allowed', value: perimeterAgg.delivered ?? 0 },
                          { name: 'Total Blocked', value: perimeterAgg.totalBlocked ?? 0 },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={110}
                        outerRadius={160}
                        stroke={isDark ? '#111827' : '#ffffff'}
                        label={renderPieLabel}
                        labelLine={false}
                      >
                        <Cell key="allowed" fill={COLORS.perimeter.allowed} />
                        <Cell key="blocked" fill={COLORS.perimeter.blocked} />
                      </Pie>
                    )}
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {perimeterAgg && (
                <div className={cn('mt-2 text-center text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>
                  <div>Total Blocked : <span className="font-semibold">{fmtM(perimeterAgg.totalBlocked || 0)}</span></div>
                  <div>Total Inbound Allowed : <span className="font-semibold">{fmtM(perimeterAgg.delivered || 0)}</span></div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
