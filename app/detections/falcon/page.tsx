"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from 'next-auth/react';
import { useTheme } from '@/components/theme-provider';
import AuthGuard from '@/lib/auth-guard';
import NavBar from '@/components/nav-bar';
import { Filter, RefreshCw, ArrowUpDown, Eye, BarChart3, Shield, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { METALLIC_COLORS, getSeverityColor, getSeverityBadgeClass } from '@/lib/theme-config';
import DetailPanel from '@/components/detail-panel';
import ImportDataDialog from '@/components/import-data-dialog';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

/**
 * Detections – Falcon (Session 1)
 *
 * Data source: backend API fed by CSV import (admin flow). This page does not upload files.
 * The backend should stamp imported rows with today's ingest date.
 *
 * API (expected): GET /api/detections/falcon?start=ISO&end=ISO
 * Should return JSON array with fields:
 *   DetectDate_UTC_readable (string date),
 *   Severity (string: Critical|High|Medium|Low|Informational),
 *   Tactic (string),
 *   ProductType (string),
 *   Hostname (string),
 *   Filename (string),
 *   PatternDispositionDescription (string),
 *   false_positive (boolean | "true" | "false" | 0/1)
 *
 * This UI will ALWAYS filter out false positives before computing charts/tables.
 */

const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString() : "—");
const toDay = (d: any) => {
  if (!d) return "";
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`; // YYYY-MM-DD
};

const ranges = [
  { label: "All Items", days: null },
  { label: "Last 7 days", days: 7 },
  { label: "Last 15 days", days: 15 },
  { label: "Last 21 days", days: 21 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 45 days", days: 45 },
  { label: "Last 60 days", days: 60 },
  { label: "Last 90 days", days: 90 },
];

function getRange(days: number | null) {
  if (days === null) {
    // Return a very wide range for "All Items"
    return {
      start: new Date('2020-01-01'),
      end: new Date()
    };
  }
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

// Use metallic theme colors
const severityColors = {
  Critical: METALLIC_COLORS.critical,
  High: METALLIC_COLORS.high,
  Medium: METALLIC_COLORS.medium,
  Low: METALLIC_COLORS.low,
  Informational: METALLIC_COLORS.info,
  Unknown: METALLIC_COLORS.tertiary,
};

const tacticColors = [
  METALLIC_COLORS.high,        // Orange-red
  METALLIC_COLORS.medium,      // Peach/orange  
  METALLIC_COLORS.low,         // Emerald green
  METALLIC_COLORS.info,        // Steel blue
  METALLIC_COLORS.open,        // Crimson
  METALLIC_COLORS.closed,      // Forest green
  METALLIC_COLORS.inProgress,  // Dark orange
  METALLIC_COLORS.pending,     // Dark orchid
  METALLIC_COLORS.resolved,    // Lime green
];

function colorFor(name: string, i: number) {
  return tacticColors[i % tacticColors.length];
}

export default function FalconDetections() {
  const { data: session } = useSession();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const apiUrl = "/api/detections/falcon";
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [selectedRange, setSelectedRange] = useState<string>("30");
  const [startDate, setStartDate] = useState<Date>(getRange(30).start);
  const [endDate, setEndDate] = useState<Date>(getRange(30).end);
  const [query, setQuery] = useState<string>(""); // optional global search
  
  // Table filters
  const [tableSeverityFilter, setTableSeverityFilter] = useState<string>("ALL");
  const [tableProductTypeFilter, setTableProductTypeFilter] = useState<string>("ALL");
  const [tableTacticFilter, setTableTacticFilter] = useState<string>("ALL");
  const [tableHostnameFilter, setTableHostnameFilter] = useState<string>("ALL");
  
  // Detail panel state
  const [selectedDetection, setSelectedDetection] = useState<any>(null);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  const handleRowClick = (detection: any) => {
    setSelectedDetection(detection);
    setIsPanelOpen(true);
  };

  const handlePanelClose = () => {
    setIsPanelOpen(false);
    setSelectedDetection(null);
  };

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const url = new URL(apiUrl, window.location.origin);
      if (startDate) url.searchParams.set("start", startDate.toISOString());
      if (endDate) url.searchParams.set("end", endDate.toISOString());
      if (query.trim()) url.searchParams.set("search", query.trim());
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Unable to load Falcon detections.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate?.toISOString(), endDate?.toISOString(), apiUrl]);

  // Filter out false positives and by date window + optional search
  const filtered = useMemo(() => {
    const s = startDate ? startDate.getTime() : -Infinity;
    const e = endDate ? endDate.getTime() : Infinity;
    const q = query.trim().toLowerCase();
    const isFalsePos = (v: any) => {
      if (v === true || v === 1 || v === "1") return true;
      if (typeof v === "string") return v.toLowerCase() === "true" || v.toLowerCase() === "yes" || v.toLowerCase() === "y" || v.toLowerCase() === "false_positive";
      return false;
    };
    return rows
      .filter((r) => !isFalsePos(r.false_positive))
      .filter((r) => (r.Severity || "").toLowerCase() !== "informational")
      .filter((r) => {
        const t = new Date(r.DetectDate_UTC_readable || r.detected_at || r.Timestamp).getTime();
        return t >= s && t <= e;
      })
      .filter((r) => {
        if (!q) return true;
        return [r.Severity, r.Tactic, r.ProductType, r.Hostname, r.Filename, r.PatternDispositionDescription]
          .filter(Boolean)
          .map(String)
          .some((v) => v.toLowerCase().includes(q));
      });
  }, [rows, startDate, endDate, query]);

  // Charts data
  const severityCounts = useMemo(() => {
    const m = new Map();
    for (const r of filtered) {
      const k = r.Severity || "Unknown";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m, ([name, value]) => ({ name, value, fill: severityColors[name as keyof typeof severityColors] || severityColors.Unknown }));
  }, [filtered]);

  const tacticCounts = useMemo(() => {
    const m = new Map();
    for (const r of filtered) {
      const k = r.Tactic || "Unknown";
      m.set(k, (m.get(k) || 0) + 1);
    }
    // Sort by count and take top 5, group the rest as "Others"
    const sorted = Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);
    const othersCount = others.reduce((sum, item) => sum + item.value, 0);
    
    let result = top5.map((item, i) => ({ ...item, fill: colorFor(item.name, i) }));
    if (othersCount > 0) {
      result.push({ name: "Others", value: othersCount, fill: colorFor("Others", 5) });
    }
    return result;
  }, [filtered]);

  const productCounts = useMemo(() => {
    const m = new Map();
    for (const r of filtered) {
      const k = r.ProductType || "Unknown";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m, ([name, value], i) => ({ name, value, fill: colorFor(name, i) }));
  }, [filtered]);

  const trendingByDay = useMemo(() => {
    const m = new Map();
    for (const r of filtered) {
      const d = toDay(r.DetectDate_UTC_readable || r.detected_at || r.Timestamp);
      if (!d) continue;
      m.set(d, (m.get(d) || 0) + 1);
    }
    const arr = Array.from(m, ([day, count]) => ({ day, count })).sort((a, b) => (a.day < b.day ? -1 : 1));
    return arr;
  }, [filtered]);

  // Table rows: only Critical/High/Medium with additional filters
  const tableRows = useMemo(() => {
    const wanted = new Set(["critical", "high", "medium"]);
    return filtered
      .filter((r) => wanted.has(String(r.Severity || "").toLowerCase()))
      .filter((r) => tableSeverityFilter === "ALL" || (r.Severity || "").toLowerCase() === tableSeverityFilter.toLowerCase())
      .filter((r) => tableProductTypeFilter === "ALL" || (r.ProductType || "").toLowerCase().includes(tableProductTypeFilter.toLowerCase()))
      .filter((r) => tableTacticFilter === "ALL" || (r.Tactic || "").toLowerCase().includes(tableTacticFilter.toLowerCase()))
      .filter((r) => tableHostnameFilter === "ALL" || (r.Hostname || "").toLowerCase().includes(tableHostnameFilter.toLowerCase()))
      .sort((a, b) => new Date(b.DetectDate_UTC_readable).getTime() - new Date(a.DetectDate_UTC_readable).getTime());
  }, [filtered, tableSeverityFilter, tableProductTypeFilter, tableTacticFilter, tableHostnameFilter]);

  // Extract unique values for filter dropdowns from the base filtered data
  const uniqueSeverities = useMemo(() => {
    const severities = new Set<string>();
    filtered.forEach(r => {
      const sev = r.Severity || "Unknown";
      if (["critical", "high", "medium"].includes(sev.toLowerCase())) {
        severities.add(sev);
      }
    });
    return Array.from(severities).sort();
  }, [filtered]);

  const uniqueProductTypes = useMemo(() => {
    const types = new Set<string>();
    filtered.forEach(r => {
      if (r.ProductType) types.add(r.ProductType);
    });
    return Array.from(types).sort();
  }, [filtered]);

  const uniqueTactics = useMemo(() => {
    const tactics = new Set<string>();
    filtered.forEach(r => {
      if (r.Tactic) tactics.add(r.Tactic);
    });
    return Array.from(tactics).sort();
  }, [filtered]);

  const uniqueHostnames = useMemo(() => {
    const hostnames = new Set<string>();
    filtered.forEach(r => {
      if (r.Hostname) hostnames.add(r.Hostname);
    });
    return Array.from(hostnames).sort();
  }, [filtered]);

  function handleRangeChange(value: string) {
    setSelectedRange(value);
    if (value === "all") {
      const { start, end } = getRange(null);
      setStartDate(start);
      setEndDate(end);
    } else {
      const days = parseInt(value, 10);
      const { start, end } = getRange(days);
      setStartDate(start);
      setEndDate(end);
    }
  }

  function handleSearch() {
    fetchData();
  }

  if (loading && rows.length === 0) {
    return (
      <AuthGuard>
        <div className={cn(
          "min-h-screen transition-colors duration-200",
          isDark ? "bg-gray-900" : "bg-gray-50"
        )}>
          <NavBar />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center min-h-96">
              <div className="text-center">
                <RefreshCw className={cn(
                  "h-8 w-8 animate-spin mx-auto mb-4",
                  "text-primary"
                )} />
                <p className={cn(
                  isDark ? "text-gray-400" : "text-gray-500"
                )}>Loading Falcon detections...</p>
              </div>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className={cn(
        "min-h-screen transition-colors duration-200",
        isDark ? "bg-gray-900" : "bg-gray-50"
      )}>
        <NavBar />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className={cn(
                "text-3xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}>Detections — Falcon</h1>
              <p className={cn(
                "mt-1",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                CrowdStrike Falcon endpoint detections and threat analytics
              </p>
            </div>
            <div className="flex space-x-3 items-center">
              <Button onClick={fetchData} variant="outline" disabled={loading}>
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
              <ImportDataDialog highlight={['falcon']} allowed={['falcon']} />
            </div>
          </div>

          {/* Search Bar */}
          <Card className={cn(
            "mb-6 shadow-sm border",
            isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-64">
                  <Input
                    placeholder="Search severity, tactic, host, file, disposition…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className={cn(
                      isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                    )}
                  />
                </div>
                <Button onClick={handleSearch} disabled={loading} variant="secondary">
                  <Eye className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Date Range Filters */}
          <Card className={cn(
            "mb-6 shadow-sm border",
            isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardHeader className="pb-3">
              <CardTitle className={cn(
                "flex items-center gap-2 text-lg",
                isDark ? "text-white" : "text-gray-900"
              )}>
                <Filter className="h-5 w-5"/>
                Date Range Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <label className={cn(
                    "text-sm font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}>Date Range</label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="date" 
                      value={startDate.toISOString().slice(0,10)} 
                      onChange={(e)=>setStartDate(new Date(e.target.value))}
                      className={cn(
                        "flex-1",
                        isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                      )}
                    />
                    <span className={cn(
                      "text-sm",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>to</span>
                    <Input 
                      type="date" 
                      value={endDate.toISOString().slice(0,10)} 
                      onChange={(e)=>{ const d = new Date(e.target.value); d.setHours(23,59,59,999); setEndDate(d); }}
                      className={cn(
                        "flex-1",
                        isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                      )}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={cn(
                    "text-sm font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}>Quick Range</label>
                  <Select value={selectedRange} onValueChange={handleRangeChange}>
                    <SelectTrigger className={cn(
                      isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                    )}>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {ranges.map(r => (
                        <SelectItem key={r.days || 'all'} value={r.days ? String(r.days) : 'all'}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={()=>fetchData()} disabled={loading} className="w-full">
                    <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                    Apply Filters
                  </Button>
                </div>
              </div>
              {error && (
                <div className={cn(
                  "mt-4 p-3 rounded-md border",
                  isDark 
                    ? "bg-red-900/20 border-red-800 text-red-300" 
                    : "bg-red-50 border-red-200 text-red-800"
                )}>
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Charts Row 1: Severity (pie) + Tactic (bar) + ProductType (bar) */}
          <div className="mb-8 grid gap-6 lg:grid-cols-3">
            <Card className={cn(
              "shadow-sm border",
              isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <CardHeader className="pb-3">
                <CardTitle className={cn(
                  "flex items-center gap-2 text-base font-semibold",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  <BarChart3 className="h-4 w-4" />
                  Detections by Severity
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={severityCounts} 
                      dataKey="value" 
                      nameKey="name" 
                      outerRadius={85}
                      innerRadius={35}
                      paddingAngle={2}
                      label={({name, value, percent}) => 
                        value > 0 ? `${name}: ${value} (${(percent * 100).toFixed(1)}%)` : ''
                      }
                      labelLine={false}
                    >
                      {severityCounts.map((d, i) => (
                        <Cell 
                          key={i} 
                          fill={d.fill} 
                          stroke={isDark ? '#374151' : '#e5e7eb'}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: isDark ? '#1f2937' : '#ffffff',
                        border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                        borderRadius: '8px',
                        color: isDark ? '#f9fafb' : '#111827'
                      }}
                      formatter={(value: number, name: string) => [
                        `${value} detections`,
                        name
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className={cn(
              "shadow-sm border",
              isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <CardHeader className="pb-3">
                <CardTitle className={cn(
                  "flex items-center gap-2 text-base font-semibold",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  <Shield className="h-4 w-4" />
                  Detections by Tactic
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tacticCounts} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke={isDark ? '#374151' : '#e5e7eb'} 
                      opacity={0.5}
                    />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }} 
                      angle={-45} 
                      height={60} 
                      interval={0} 
                      textAnchor="end"
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      allowDecimals={false} 
                      tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: isDark ? '#1f2937' : '#ffffff',
                        border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                        borderRadius: '8px',
                        color: isDark ? '#f9fafb' : '#111827'
                      }}
                      formatter={(value: number, name: string) => [
                        `${value} detections`,
                        name
                      ]}
                      cursor={{ fill: isDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.3)' }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {tacticCounts.map((d, i) => (
                        <Cell 
                          key={i} 
                          fill={d.fill}
                          stroke={isDark ? '#374151' : '#e5e7eb'}
                          strokeWidth={1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className={cn(
              "shadow-sm border",
              isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <CardHeader className="pb-3">
                <CardTitle className={cn(
                  "flex items-center gap-2 text-base font-semibold",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  <Eye className="h-4 w-4" />
                  Detections by Product Type
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productCounts} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke={isDark ? '#374151' : '#e5e7eb'} 
                      opacity={0.5}
                    />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }} 
                      angle={-45}
                      height={60}
                      interval={0}
                      textAnchor="end"
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: isDark ? '#1f2937' : '#ffffff',
                        border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                        borderRadius: '8px',
                        color: isDark ? '#f9fafb' : '#111827'
                      }}
                      formatter={(value: number, name: string) => [
                        `${value} detections`,
                        name
                      ]}
                      cursor={{ fill: isDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.3)' }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {productCounts.map((d, i) => (
                        <Cell 
                          key={i} 
                          fill={d.fill}
                          stroke={isDark ? '#374151' : '#e5e7eb'}
                          strokeWidth={1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2: Trending per day */}
          <Card className={cn(
            "mb-8 shadow-sm border",
            isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardHeader className="pb-3">
              <CardTitle className={cn(
                "flex items-center gap-2 text-base font-semibold",
                isDark ? "text-white" : "text-gray-900"
              )}>
                <TrendingUp className="h-4 w-4" />
                Detection Trending (per day)
              </CardTitle>
              <CardDescription className={cn(
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                Daily detection volume over the selected time period
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendingByDay} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={isDark ? '#374151' : '#e5e7eb'} 
                    opacity={0.5}
                  />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: isDark ? '#1f2937' : '#ffffff',
                      border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      color: isDark ? '#f9fafb' : '#111827'
                    }}
                    labelFormatter={(label) => `Date: ${label}`}
                    formatter={(value: number) => [`${value} detections`, 'Count']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke={METALLIC_COLORS.high}
                    strokeWidth={3} 
                    dot={{ fill: METALLIC_COLORS.high, strokeWidth: 2, r: 4, stroke: '#ffffff' }}
                    activeDot={{ r: 6, fill: METALLIC_COLORS.critical, stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Table Filters */}
          <Card className={cn(
            "mb-4 shadow-sm border",
            isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardHeader className="pb-3">
              <CardTitle className={cn(
                "flex items-center gap-2 text-base font-semibold",
                isDark ? "text-white" : "text-gray-900"
              )}>
                <Filter className="h-4 w-4" />
                Table Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className={cn(
                    "text-sm font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}>Severity</label>
                  <Select value={tableSeverityFilter} onValueChange={setTableSeverityFilter}>
                    <SelectTrigger className={cn(
                      isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Severities</SelectItem>
                      {uniqueSeverities.map(severity => (
                        <SelectItem key={severity} value={severity}>{severity}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className={cn(
                    "text-sm font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}>Product Type</label>
                  <Select value={tableProductTypeFilter} onValueChange={setTableProductTypeFilter}>
                    <SelectTrigger className={cn(
                      isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Product Types</SelectItem>
                      {uniqueProductTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className={cn(
                    "text-sm font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}>Tactic</label>
                  <Select value={tableTacticFilter} onValueChange={setTableTacticFilter}>
                    <SelectTrigger className={cn(
                      isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Tactics</SelectItem>
                      {uniqueTactics.map(tactic => (
                        <SelectItem key={tactic} value={tactic}>{tactic}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className={cn(
                    "text-sm font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}>Hostname</label>
                  <Select value={tableHostnameFilter} onValueChange={setTableHostnameFilter}>
                    <SelectTrigger className={cn(
                      isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Hostnames</SelectItem>
                      {uniqueHostnames.map(hostname => (
                        <SelectItem key={hostname} value={hostname}>{hostname}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setTableSeverityFilter("ALL");
                    setTableProductTypeFilter("ALL");
                    setTableTacticFilter("ALL");
                    setTableHostnameFilter("ALL");
                  }}
                >
                  Clear Filters
                </Button>
                <div className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}>
                  Showing {tableRows.length} detections
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table: Critical, High, Medium */}
          <Card className={cn(
            "shadow-sm border",
            isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardHeader className="pb-3">
              <CardTitle className={cn(
                "flex items-center gap-2 text-lg font-semibold",
                isDark ? "text-white" : "text-gray-900"
              )}>
                <Clock className="h-5 w-5" />
                Recent Detections (Critical / High / Medium) — {tableRows.length}
              </CardTitle>
              <CardDescription className={cn(
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                Latest high-priority detections (false positives excluded automatically)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DetectionsTable items={tableRows} isDark={isDark} onRowClick={handleRowClick} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail Panel */}
      <DetailPanel
        isOpen={isPanelOpen}
        onClose={handlePanelClose}
        data={selectedDetection}
        type="falcon"
        title={selectedDetection ? selectedDetection.PatternDispositionDescription || selectedDetection.DetectDescription || 'Falcon Detection' : ''}
      />
    </AuthGuard>
  );
}

function SortButton({ label, active, direction, onClick, isDark }: { label: string; active: boolean; direction: string; onClick: () => void; isDark: boolean }) {
  return (
    <button 
      onClick={onClick} 
      className={cn(
        "flex items-center gap-1 hover:bg-opacity-10 hover:bg-gray-500 px-2 py-1 rounded transition-colors",
        active 
          ? (isDark ? "text-white" : "text-gray-900")
          : (isDark ? "text-gray-400" : "text-gray-600")
      )}
    >
      <span className="font-medium">{label}</span>
      <ArrowUpDown className={cn(
        "h-3.5 w-3.5",
        active ? "opacity-100" : "opacity-60"
      )} />
      <span className="sr-only">Sort</span>
    </button>
  );
}

function DetectionsTable({ items, isDark, onRowClick }: { items: any[]; isDark: boolean; onRowClick?: (item: any) => void }) {
  const [sortKey, setSortKey] = useState<string>("DetectDate_UTC_readable");
  const [sortDir, setSortDir] = useState<string>("desc");

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case "Severity":
          // Sort by severity priority: Critical > High > Medium > Low > Unknown
          const severityOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1, 'Unknown': 0 };
          av = severityOrder[a.Severity as keyof typeof severityOrder] || 0;
          bv = severityOrder[b.Severity as keyof typeof severityOrder] || 0;
          break;
        case "ProductType":
        case "Hostname":
        case "Filename":
        case "PatternDispositionDescription":
          av = (a[sortKey] || "").toString().toLowerCase();
          bv = (b[sortKey] || "").toString().toLowerCase();
          break;
        case "DetectDate_UTC_readable":
        default:
          av = new Date(a.DetectDate_UTC_readable || 0).getTime();
          bv = new Date(b.DetectDate_UTC_readable || 0).getTime();
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [items, sortKey, sortDir]);

  function toggleSort(key: string) {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(key === "DetectDate_UTC_readable" ? "desc" : "asc");
      return key;
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className={cn(
        "w-full border-collapse text-sm",
        isDark ? "bg-gray-800" : "bg-white"
      )}>
        <thead>
          <tr className={cn(
            "text-left border-b",
            isDark ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
          )}>
            <th className="p-3">
              <SortButton 
                label="Detect Date (UTC)" 
                active={sortKey === "DetectDate_UTC_readable"} 
                direction={sortDir} 
                onClick={() => toggleSort("DetectDate_UTC_readable")}
                isDark={isDark}
              />
            </th>
            <th className="p-3">
              <SortButton 
                label="Severity" 
                active={sortKey === "Severity"} 
                direction={sortDir} 
                onClick={() => toggleSort("Severity")}
                isDark={isDark}
              />
            </th>
            <th className="p-3">
              <SortButton 
                label="Product Type" 
                active={sortKey === "ProductType"} 
                direction={sortDir} 
                onClick={() => toggleSort("ProductType")}
                isDark={isDark}
              />
            </th>
            <th className="p-3">
              <SortButton 
                label="Hostname" 
                active={sortKey === "Hostname"} 
                direction={sortDir} 
                onClick={() => toggleSort("Hostname")}
                isDark={isDark}
              />
            </th>
            <th className="p-3">
              <SortButton 
                label="Filename" 
                active={sortKey === "Filename"} 
                direction={sortDir} 
                onClick={() => toggleSort("Filename")}
                isDark={isDark}
              />
            </th>
            <th className="p-3">
              <SortButton 
                label="Disposition" 
                active={sortKey === "PatternDispositionDescription"} 
                direction={sortDir} 
                onClick={() => toggleSort("PatternDispositionDescription")}
                isDark={isDark}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={6} className={cn(
                "p-8 text-center",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No detections found in this period.
              </td>
            </tr>
          ) : (
            sorted.map((r, idx) => (
              <tr key={`${r.DetectDate_UTC_readable}-${r.Hostname}-${idx}`} 
                  onClick={() => onRowClick?.(r)}
                  className={cn(
                    "border-b transition-colors cursor-pointer",
                    isDark 
                      ? "border-gray-700 hover:bg-gray-700/50" 
                      : "border-gray-200 hover:bg-gray-50"
                  )}>
                <td className={cn(
                  "p-3 whitespace-nowrap",
                  isDark ? "text-gray-300" : "text-gray-900"
                )}>
                  {fmtDate(r.DetectDate_UTC_readable)}
                </td>
                <td className="p-3 whitespace-nowrap">
                  <Badge className={getSeverityBadgeClass(r.Severity || 'Unknown', isDark)}>
                    {r.Severity || 'Unknown'}
                  </Badge>
                </td>
                <td className={cn(
                  "p-3 whitespace-nowrap",
                  isDark ? "text-gray-300" : "text-gray-900"
                )}>
                  {r.ProductType || "—"}
                </td>
                <td className={cn(
                  "p-3 whitespace-nowrap font-mono text-xs",
                  isDark ? "text-gray-300" : "text-gray-900"
                )}>
                  {r.Hostname || "—"}
                </td>
                <td className={cn(
                  "p-3 whitespace-nowrap font-mono text-xs",
                  isDark ? "text-gray-300" : "text-gray-900"
                )}>
                  {r.Filename || "—"}
                </td>
                <td className={cn(
                  "p-3 max-w-md truncate",
                  isDark ? "text-gray-300" : "text-gray-900"
                )} title={r.PatternDispositionDescription}>
                  {r.PatternDispositionDescription || "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
