"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSession } from 'next-auth/react';
import { useTheme } from '@/components/theme-provider';
import AuthGuard from '@/lib/auth-guard';
import NavBar from '@/components/nav-bar';
import { Filter, RefreshCw, ArrowUpDown, Eye, BarChart3, Shield, Clock, TrendingUp, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { METALLIC_COLORS, getSeverityBadgeClass } from '@/lib/theme-config';
import DetailPanel from '@/components/detail-panel';
import { MultiSelectFilter } from '@/components/multi-select-filter';

// Helper function to parse JSON fields
const parseJsonField = (field: string | null | undefined): any[] => {
  if (!field) return [];
  try {
    const parsed = JSON.parse(field);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

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
 * Detections – Secureworks
 *
 * Data source: backend API fed by CSV import (admin flow). This page does not upload files.
 * The backend should stamp imported rows with today's ingest date.
 *
 * API (expected): GET /api/detections/secureworks?start=ISO&end=ISO
 * Should return JSON array with fields from SecureworksAlert model
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

// Use metallic theme colors
const severityColors = {
  CRITICAL: METALLIC_COLORS.critical,
  HIGH: METALLIC_COLORS.high,
  MEDIUM: METALLIC_COLORS.medium,
  LOW: METALLIC_COLORS.low,
  INFO: METALLIC_COLORS.info,
  Unknown: METALLIC_COLORS.tertiary,
};

const statusColors = [
  METALLIC_COLORS.primary,
  METALLIC_COLORS.secondary,
  METALLIC_COLORS.tertiary,
  METALLIC_COLORS.user1,
  METALLIC_COLORS.user2,
  METALLIC_COLORS.user3,
  METALLIC_COLORS.user4,
  METALLIC_COLORS.user5,
  METALLIC_COLORS.user6,
];

function colorFor(name: string, i: number) {
  return statusColors[i % statusColors.length];
}

export default function SecureworksDetections() {
  const { data: session } = useSession();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const apiUrl = "/api/detections/secureworks";
  const [rows, setRows] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]); // Separate state for chart data
  const [loading, setLoading] = useState<boolean>(false);
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // ✅ Default to last 30 days and enforce date filtering
  const DEFAULT_DAYS = 30;
  const def = getRange(DEFAULT_DAYS);
  const [selectedRange, setSelectedRange] = useState<string>(String(DEFAULT_DAYS));
  const [startDate, setStartDate] = useState<Date>(def.start);
  const [endDate, setEndDate] = useState<Date>(def.end);

  const [query, setQuery] = useState<string>(""); // optional global search
  const [debouncedQuery, setDebouncedQuery] = useState<string>(""); // debounced search
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [pagination, setPagination] = useState<any>(null);
  
  // Table filters - now support multiple selections
  const [tableSeverityFilter, setTableSeverityFilter] = useState<string[]>([]);
  const [tableStatusFilter, setTableStatusFilter] = useState<string[]>([]);
  const [tableTitleFilter, setTableTitleFilter] = useState<string[]>([]);
  const [tableSensorTypeFilter, setTableSensorTypeFilter] = useState<string[]>([]);
  
  // Detail panel state
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  const handleRowClick = (alert: any) => {
    setSelectedAlert(alert);
    setIsPanelOpen(true);
  };

  const handlePanelClose = () => {
    setIsPanelOpen(false);
    setSelectedAlert(null);
  };

  async function fetchChartData() {
    setChartLoading(true);
    try {
      const url = new URL(apiUrl, window.location.origin);
      if (startDate) url.searchParams.append('start', startDate.toISOString());
      if (endDate) url.searchParams.append('end', endDate.toISOString());
      if (debouncedQuery.trim()) url.searchParams.append('search', debouncedQuery.trim());
      if (tableSeverityFilter.length > 0) url.searchParams.append('severity', tableSeverityFilter.join(','));
      if (tableStatusFilter.length > 0) url.searchParams.append('status', tableStatusFilter.join(','));
      if (tableTitleFilter.length > 0) url.searchParams.append('title', tableTitleFilter.join(','));
      if (tableSensorTypeFilter.length > 0) url.searchParams.append('sensorType', tableSensorTypeFilter.join(','));
      url.searchParams.append('chartDataOnly', 'true');
      const res = await fetch(url.toString());
      if (!res.ok) {
        // fail silently for charts
        setChartData([]);
      } else {
        const data = await res.json();
        const processedChartData = Array.isArray(data) ? data.map(row => ({
          ...row,
          // For simplified schema, sensor_type is already a simple string, no need to parse JSON
          sensor_types_parsed: row.sensor_type ? [row.sensor_type] : [],
          attack_technique_ids_parsed: row.mitre_attack ? [row.mitre_attack] : [],
          tags_parsed: [], // No tags field in simplified schema
        })) : [];
        setChartData(processedChartData);
      }
    } catch (e) {
      setChartData([]);
    } finally {
      setChartLoading(false);
    }
  }

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const url = new URL(apiUrl, window.location.origin);
      if (startDate) url.searchParams.append('start', startDate.toISOString());
      if (endDate) url.searchParams.append('end', endDate.toISOString());
      if (debouncedQuery.trim()) url.searchParams.append('search', debouncedQuery.trim());
      if (tableSeverityFilter.length > 0) url.searchParams.append('severity', tableSeverityFilter.join(','));
      if (tableStatusFilter.length > 0) url.searchParams.append('status', tableStatusFilter.join(','));
      if (tableTitleFilter.length > 0) url.searchParams.append('title', tableTitleFilter.join(','));
      if (tableSensorTypeFilter.length > 0) url.searchParams.append('sensorType', tableSensorTypeFilter.join(','));
      url.searchParams.append('page', currentPage.toString());
      url.searchParams.append('pageSize', pageSize.toString());
      const res = await fetch(url.toString());
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${errorText}`);
      }
      const response = await res.json();
      const dataArray = response.data || response;
      const paginationInfo = response.pagination || null;
      const processedData = Array.isArray(dataArray) ? dataArray.map(row => ({
        ...row,
        // For simplified schema, sensor_type is already a simple string, no need to parse JSON
        sensor_types_parsed: row.sensor_type ? [row.sensor_type] : [],
        attack_technique_ids_parsed: row.mitre_attack ? [row.mitre_attack] : [],
        tags_parsed: [], // No tags field in simplified schema
      })) : [];
      setRows(processedData);
      setPagination(paginationInfo);
    } catch (e: any) {
      setError(`Unable to load Secureworks alerts: ${e?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  // Fetch data when filters change (reset to page 1 when filters change)
  useEffect(() => {
    setCurrentPage(1); // Reset pagination when filters change
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, pageSize, debouncedQuery, tableSeverityFilter, tableStatusFilter, tableTitleFilter, tableSensorTypeFilter, apiUrl]);

  // Fetch data when page changes (but keep filters)
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Fetch charts when filters change
  useEffect(() => {
    fetchChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, debouncedQuery, tableSeverityFilter, tableStatusFilter, tableTitleFilter, tableSensorTypeFilter, apiUrl]);

  // No need for frontend filtering - all filtering is done by the API now
  // Just process the data for display
  const filtered = useMemo(() => {
    return rows; // Data is already filtered by the API
  }, [rows]);

  const filteredChartData = useMemo(() => {
    return chartData; // Chart data is already filtered by the API
  }, [chartData]);

  // Charts data (using complete dataset)
  const severityCounts = useMemo(() => {
    const m = new Map();
    for (const r of filteredChartData) {
      const k = r.severity || "Unknown";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m, ([name, value]) => ({ name, value, fill: severityColors[name as keyof typeof severityColors] || severityColors.Unknown }));
  }, [filteredChartData]);

  const statusCounts = useMemo(() => {
    const m = new Map();
    for (const r of filteredChartData) {
      const k = r.status || "Unknown";
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
  }, [filteredChartData]);

  const sensorCounts = useMemo(() => {
    const m = new Map();
    for (const r of filteredChartData) {
      const sensors = r.sensor_types_parsed || ["Unknown"];
      for (const sensor of sensors) {
        const k = sensor || "Unknown";
        m.set(k, (m.get(k) || 0) + 1);
      }
    }
    return Array.from(m, ([name, value], i) => ({ name, value, fill: colorFor(name, i) }));
  }, [filteredChartData]);

  const trendingByDay = useMemo(() => {
    const m = new Map();
    for (const r of filteredChartData) {
      const d = toDay(r.created_at);
      if (!d) continue;
      m.set(d, (m.get(d) || 0) + 1);
    }
    const arr = Array.from(m, ([day, count]) => ({ day, count })).sort((a, b) => (a.day < b.day ? -1 : 1));
    return arr;
  }, [filteredChartData]);

  // Table rows: data is already filtered by API, just sort by date
  const tableRows = useMemo(() => {
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [filtered]);

  // Extract unique values for filter dropdowns from chart data (complete dataset)
  const uniqueSeverities = useMemo(() => {
    const severities = new Set<string>();
    chartData.forEach(r => {
      if (r.severity) severities.add(r.severity);
    });
    return Array.from(severities).sort();
  }, [chartData]);

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    chartData.forEach(r => { if (r.status) statuses.add(r.status); });
    return Array.from(statuses).sort();
  }, [chartData]);

  const uniqueTitles = useMemo(() => {
    const titles = new Set<string>();
    chartData.forEach(r => { if (r.title) titles.add(r.title); });
    return Array.from(titles).sort().slice(0, 50); // Limit to first 50 for dropdown performance
  }, [chartData]);

  const uniqueSensorTypes = useMemo(() => {
    const set = new Set<string>();
    chartData.forEach(r => {
      if (r.sensor_type) set.add(r.sensor_type);
    });
    return Array.from(set).sort();
  }, [chartData]);

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
    // Reset pagination when range changes
    setCurrentPage(1);
  }

  // Debounce search input to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [query]);

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
                  isDark ? "text-blue-400" : "text-blue-600"
                )} />
                <p className={cn(
                  isDark ? "text-gray-400" : "text-gray-500"
                )}>Loading Secureworks alerts...</p>
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
              )}>Detections — Secureworks</h1>
              <p className={cn(
                "mt-1",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                Secureworks security detection alerts and threat analytics
              </p>
            </div>
            <div className="flex space-x-3">
              <Button onClick={() => { fetchData(); fetchChartData(); }} variant="outline" disabled={loading || chartLoading}>
                <RefreshCw className={cn("h-4 w-4 mr-2", (loading || chartLoading) && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          {/* ✅ Date Range Filters – moved to the top and defaulted to last 30 days */}
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
              <CardDescription className={cn(isDark ? "text-gray-400" : "text-gray-600")}>Enforced across charts, trending, and table.</CardDescription>
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
                      onChange={(e)=>{ setStartDate(new Date(e.target.value)); setCurrentPage(1);} }
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
                      onChange={(e)=>{ const d = new Date(e.target.value); d.setHours(23,59,59,999); setEndDate(d); setCurrentPage(1);} }
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
                  <Button onClick={()=>{ setCurrentPage(1); fetchData(); fetchChartData(); }} disabled={loading || chartLoading} className="w-full">
                    <RefreshCw className={cn("mr-2 h-4 w-4", (loading || chartLoading) && "animate-spin")} />
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

          {/* Search Bar */}
          <Card className={cn(
            "mb-6 shadow-sm border",
            isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-64">
                  <Input
                    placeholder="Search titles, descriptions, detectors, IPs... (case sensitive)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    // Search is automatic - no need for Enter handler
                    className={cn(
                      isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                    )}
                  />
                </div>
                {/* Search is now automatic - no button needed */}
              </div>
            </CardContent>
          </Card>

          {/* Charts Row 1: Severity (pie) + Status (bar) + Sensor Types (bar) */}
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
                  Alerts by Severity
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
                      label={({name, value}) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {severityCounts.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: isDark ? '#374151' : '#ffffff',
                        border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`,
                        borderRadius: '8px',
                        color: isDark ? '#f3f4f6' : '#111827'
                      }}
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
                  Alerts by Status
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusCounts} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }} 
                      angle={-45} 
                      height={60} 
                      interval={0} 
                      textAnchor="end"
                    />
                    <YAxis 
                      allowDecimals={false} 
                      tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: isDark ? '#374151' : '#ffffff',
                        border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`,
                        borderRadius: '8px',
                        color: isDark ? '#f3f4f6' : '#111827'
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {statusCounts.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
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
                  Alerts by Sensor Type
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sensorCounts} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }} 
                      angle={-45}
                      height={60}
                      interval={0}
                      textAnchor="end"
                    />
                    <YAxis 
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: isDark ? '#374151' : '#ffffff',
                        border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`,
                        borderRadius: '8px',
                        color: isDark ? '#f3f4f6' : '#111827'
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {sensorCounts.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
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
                Alert Trending (per day)
              </CardTitle>
              <CardDescription className={cn(
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                Daily alert volume over the selected time period
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendingByDay} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }}
                  />
                  <YAxis 
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: isDark ? '#374151' : '#ffffff',
                      border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      color: isDark ? '#f3f4f6' : '#111827'
                    }}
                    labelFormatter={(label) => `Date: ${label}`}
                    formatter={(value, name) => [value, 'Alerts']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke={METALLIC_COLORS.primary}
                    strokeWidth={3} 
                    dot={{ fill: METALLIC_COLORS.primary, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: METALLIC_COLORS.secondary }}
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
                <MultiSelectFilter
                  label="Severity"
                  options={uniqueSeverities}
                  selectedValues={tableSeverityFilter}
                  onSelectionChange={setTableSeverityFilter}
                  isDark={isDark}
                  placeholder="Select severities"
                />
                <MultiSelectFilter
                  label="Status"
                  options={uniqueStatuses}
                  selectedValues={tableStatusFilter}
                  onSelectionChange={setTableStatusFilter}
                  isDark={isDark}
                  placeholder="Select statuses"
                />
                <MultiSelectFilter
                  label="Alert Title"
                  options={uniqueTitles}
                  selectedValues={tableTitleFilter}
                  onSelectionChange={setTableTitleFilter}
                  isDark={isDark}
                  placeholder="Select titles"
                  maxDisplayItems={1}
                />
                <MultiSelectFilter
                  label="Sensor Types"
                  options={uniqueSensorTypes}
                  selectedValues={tableSensorTypeFilter}
                  onSelectionChange={setTableSensorTypeFilter}
                  isDark={isDark}
                  placeholder="Select sensor types"
                />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setTableSeverityFilter([]);
                    setTableStatusFilter([]);
                    setTableTitleFilter([]);
                    setTableSensorTypeFilter([]);
                  }}
                >
                  Clear Filters
                </Button>
                <div className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}>
                  Showing {tableRows.length} alerts
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
                Recent Alerts (All Severities) — {tableRows.length}
              </CardTitle>
              <CardDescription className={cn(
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                Latest high-priority alerts (false positives excluded automatically)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertsTable items={tableRows} isDark={isDark} onRowClick={handleRowClick} />
              
              {/* ✅ Pagination Controls with page-size dropdown and last-page */}
              {pagination && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 gap-3">
                  <div className={cn(
                    "text-sm",
                    isDark ? "text-gray-400" : "text-gray-600"
                  )}>
                    Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total alerts)
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm", isDark ? "text-gray-300" : "text-gray-700")}>Rows per page</span>
                      <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v, 10)); setCurrentPage(1); }}>
                        <SelectTrigger className={cn("h-8 w-[84px]", isDark ? "bg-gray-700 border-gray-600" : "bg-white")}> 
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[20,50,100,200].map(n => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={pagination.page <= 1 || loading}
                        title="First page"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={!pagination.hasPrevPage || loading}
                      >
                        Previous
                      </Button>
                      <div className={cn(
                        "px-3 py-1 text-sm",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}>
                        Page {currentPage}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={!pagination.hasNextPage || loading}
                      >
                        Next
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(pagination.totalPages)}
                        disabled={pagination.page >= pagination.totalPages || loading}
                        title="Last page"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail Panel */}
      <DetailPanel
        isOpen={isPanelOpen}
        onClose={handlePanelClose}
        data={selectedAlert}
        type="secureworks"
        title={selectedAlert ? selectedAlert.title || 'Secureworks Alert' : ''}
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

function AlertsTable({ items, isDark, onRowClick }: { items: any[]; isDark: boolean; onRowClick?: (item: any) => void }) {
  const [sortKey, setSortKey] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<string>("desc");

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "severity":
          // Sort by severity priority: Critical > High > Medium > Low > Unknown
          const severityOrder: Record<string, number> = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'Unknown': 0 };
          av = severityOrder[a.severity?.toUpperCase()] || 0;
          bv = severityOrder[b.severity?.toUpperCase()] || 0;
          break;
        case "title":
        case "description":
        case "status":
          av = (a[sortKey] || "").toString().toLowerCase();
          bv = (b[sortKey] || "").toString().toLowerCase();
          break;
        case "created_at":
        default:
          av = new Date(a.created_at || 0).getTime();
          bv = new Date(b.created_at || 0).getTime();
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
      setSortDir(key === "created_at" ? "desc" : "asc");
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
                label="Created Date" 
                active={sortKey === "created_at"} 
                direction={sortDir} 
                onClick={() => toggleSort("created_at")}
                isDark={isDark}
              />
            </th>
            <th className="p-3">
              <SortButton 
                label="Severity" 
                active={sortKey === "severity"} 
                direction={sortDir} 
                onClick={() => toggleSort("severity")}
                isDark={isDark}
              />
            </th>
            <th className="p-3">
              <SortButton 
                label="Title" 
                active={sortKey === "title"} 
                direction={sortDir} 
                onClick={() => toggleSort("title")}
                isDark={isDark}
              />
            </th>
            <th className="p-3">
              <SortButton 
                label="Status" 
                active={sortKey === "status"} 
                direction={sortDir} 
                onClick={() => toggleSort("status")}
                isDark={isDark}
              />
            </th>
            {/* ✅ New column for Sensor Types */}
            <th className="p-3">Sensor Types</th>
            <th className="p-3">
              <SortButton 
                label="Description" 
                active={sortKey === "description"} 
                direction={sortDir} 
                onClick={() => toggleSort("description")}
                isDark={isDark}
              />
            </th>
            <th className="p-3">Threat Score</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={7} className={cn(
                "p-8 text-center",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No alerts found in this period.
              </td>
            </tr>
          ) : (
            sorted.map((r, idx) => (
              <tr key={`${r.alert_id}-${idx}`} 
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
                  {fmtDate(r.created_at)}
                </td>
                <td className="p-3 whitespace-nowrap">
                  <Badge className={getSeverityBadgeClass(r.severity || 'Unknown', isDark)}>
                    {r.severity || 'Unknown'}
                  </Badge>
                </td>
                <td className={cn(
                  "p-3 max-w-sm truncate",
                  isDark ? "text-gray-300" : "text-gray-900"
                )} title={r.title}>
                  {r.title || "—"}
                </td>
                <td className={cn(
                  "p-3 whitespace-nowrap",
                  isDark ? "text-gray-300" : "text-gray-900"
                )}>
                  {r.status || "—"}
                </td>
                {/* ✅ Render Sensor Types */}
                <td className={cn(
                  "p-3 max-w-xs truncate",
                  isDark ? "text-gray-300" : "text-gray-900"
                )} title={(r.sensor_types_parsed || []).join(', ')}>
                  {(r.sensor_types_parsed || []).join(', ') || '—'}
                </td>
                <td className={cn(
                  "p-3 max-w-md truncate",
                  isDark ? "text-gray-300" : "text-gray-900"
                )} title={r.description}>
                  {r.description || "—"}
                </td>
                <td className={cn(
                  "p-3 whitespace-nowrap",
                  isDark ? "text-gray-300" : "text-gray-900"
                )}>
                  {r.threat_score ? Number(r.threat_score).toFixed(1) : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
