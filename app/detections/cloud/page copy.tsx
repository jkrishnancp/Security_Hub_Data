"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from 'next-auth/react';
import { useTheme } from '@/components/theme-provider';
import AuthGuard from '@/lib/auth-guard';
import NavBar from '@/components/nav-bar';
import { Filter, RefreshCw, ArrowUpDown, Eye, BarChart3, Shield, Clock, TrendingUp, Cloud, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { METALLIC_COLORS, getSeverityColor, getSeverityBadgeClass } from '@/lib/theme-config';
import DetailPanel from '@/components/detail-panel';
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
 * Cloud Security - AWS Security Hub Findings
 *
 * Data source: backend API fed by CSV import (admin flow). This page does not upload files.
 * The backend should stamp imported rows with today's ingest date.
 *
 * API (expected): GET /api/detections/cloud?start=ISO&end=ISO
 * Should return JSON array with fields from AWS Security Hub:
 *   controlId (string: "Config.1", "S3.8"),
 *   title (string),
 *   controlStatus (string: Failed|Passed),
 *   severity (string: Critical|High|Medium|Low),
 *   failedChecks, unknownChecks, notAvailableChecks, passedChecks (numbers),
 *   relatedRequirements (string: NIST compliance mappings),
 *   customParameters (string: SUPPORTED|UNSUPPORTED),
 *   status (Open/Closed/etc)
 *
 * This UI will focus on Failed controls for main analytics.
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
  Info: METALLIC_COLORS.info,
  Unknown: METALLIC_COLORS.tertiary,
};

const statusColors = {
  Failed: METALLIC_COLORS.critical,
  Passed: METALLIC_COLORS.primary, // Use primary instead of success
  Unknown: METALLIC_COLORS.tertiary,
};

const serviceColors = [
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
  return serviceColors[i % serviceColors.length];
}

export default function CloudSecurity() {
  const { data: session } = useSession();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const apiUrl = "/api/detections/cloud";
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [selectedRange, setSelectedRange] = useState<string>("30");
  const [startDate, setStartDate] = useState<Date>(getRange(30).start);
  const [endDate, setEndDate] = useState<Date>(getRange(30).end);
  const [query, setQuery] = useState<string>(""); // optional global search
  
  // Table filters
  const [tableSeverityFilter, setTableSeverityFilter] = useState<string>("ALL");
  const [tableControlStatusFilter, setTableControlStatusFilter] = useState<string>("ALL");
  const [tableServiceFilter, setTableServiceFilter] = useState<string>("ALL");
  const [tableComplianceFilter, setTableComplianceFilter] = useState<string>("ALL");
  
  // Detail panel state
  const [selectedFinding, setSelectedFinding] = useState<any>(null);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  const handleRowClick = (finding: any) => {
    setSelectedFinding(finding);
    setIsPanelOpen(true);
  };

  const handlePanelClose = () => {
    setIsPanelOpen(false);
    setSelectedFinding(null);
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
      setError("Unable to load AWS Security Hub findings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate?.toISOString(), endDate?.toISOString(), apiUrl]);

  // Filter data by date window + optional search
  const filtered = useMemo(() => {
    const s = startDate ? startDate.getTime() : -Infinity;
    const e = endDate ? endDate.getTime() : Infinity;
    const q = query.trim().toLowerCase();
    
    return rows
      .filter((r) => {
        const t = new Date(r.foundAt || r.createdAt || Date.now()).getTime();
        return t >= s && t <= e;
      })
      .filter((r) => {
        if (!q) return true;
        return [r.controlId, r.title, r.severity, r.controlStatus, r.customParameters, r.relatedRequirements]
          .filter(Boolean)
          .map(String)
          .some((v) => v.toLowerCase().includes(q));
      });
  }, [rows, startDate, endDate, query]);

  // Charts data
  const severityCounts = useMemo(() => {
    const m = new Map();
    for (const r of filtered) {
      const k = r.severity || "Unknown";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m, ([name, value]) => ({ name, value, fill: severityColors[name] || severityColors.Unknown }));
  }, [filtered]);

  const statusCounts = useMemo(() => {
    const m = new Map();
    for (const r of filtered) {
      const k = r.controlStatus || "Unknown";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m, ([name, value]) => ({ name, value, fill: statusColors[name] || statusColors.Unknown }));
  }, [filtered]);

  // Extract AWS service from controlId (e.g., "S3.8" -> "S3", "EC2.9" -> "EC2")
  const serviceCounts = useMemo(() => {
    const m = new Map();
    for (const r of filtered) {
      const controlId = r.controlId || "";
      const service = controlId.split('.')[0] || "Unknown";
      m.set(service, (m.get(service) || 0) + 1);
    }
    // Sort by count and take top 8, group the rest as "Others"
    const sorted = Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const top8 = sorted.slice(0, 8);
    const others = sorted.slice(8);
    const othersCount = others.reduce((sum, item) => sum + item.value, 0);
    
    let result = top8.map((item, i) => ({ ...item, fill: colorFor(item.name, i) }));
    if (othersCount > 0) {
      result.push({ name: "Others", value: othersCount, fill: colorFor("Others", 8) });
    }
    return result;
  }, [filtered]);

  const trendingByDay = useMemo(() => {
    const m = new Map();
    for (const r of filtered) {
      const d = toDay(r.foundAt || r.createdAt);
      if (!d) continue;
      m.set(d, (m.get(d) || 0) + 1);
    }
    const arr = Array.from(m, ([day, count]) => ({ day, count })).sort((a, b) => (a.day < b.day ? -1 : 1));
    return arr;
  }, [filtered]);

  // Compliance breakdown - extract first NIST requirement for grouping
  const complianceCounts = useMemo(() => {
    const m = new Map();
    for (const r of filtered) {
      const requirements = r.relatedRequirements || "";
      const firstReq = requirements.split(',')[0]?.trim() || "No Compliance";
      // Extract framework (e.g., "NIST.800-53.r5 AC-3" -> "NIST AC")
      const simplified = firstReq.includes('NIST') ? 
        `NIST ${firstReq.split(' ')[1]?.split('-')[0] || ''}` : 
        firstReq.substring(0, 20); // Truncate long requirements
      m.set(simplified, (m.get(simplified) || 0) + 1);
    }
    return Array.from(m, ([name, value], i) => ({ name, value, fill: colorFor(name, i) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10
  }, [filtered]);

  // Table rows: show Critical/High priority items by default, with additional filters
  const tableRows = useMemo(() => {
    const highPriority = new Set(["critical", "high"]);
    return filtered
      .filter((r) => tableSeverityFilter === "ALL" || (r.severity || "").toLowerCase() === tableSeverityFilter.toLowerCase())
      .filter((r) => tableControlStatusFilter === "ALL" || (r.controlStatus || "").toLowerCase() === tableControlStatusFilter.toLowerCase())
      .filter((r) => {
        if (tableServiceFilter === "ALL") return true;
        const service = (r.controlId || "").split('.')[0] || "";
        return service.toLowerCase() === tableServiceFilter.toLowerCase();
      })
      .filter((r) => {
        if (tableComplianceFilter === "ALL") return true;
        const requirements = (r.relatedRequirements || "").toLowerCase();
        return requirements.includes(tableComplianceFilter.toLowerCase());
      })
      .sort((a, b) => {
        // Sort by severity first, then by failed checks
        const severityOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
        const aSev = severityOrder[a.severity] || 0;
        const bSev = severityOrder[b.severity] || 0;
        if (aSev !== bSev) return bSev - aSev;
        return (b.failedChecks || 0) - (a.failedChecks || 0);
      });
  }, [filtered, tableSeverityFilter, tableControlStatusFilter, tableServiceFilter, tableComplianceFilter]);

  // Extract unique values for filter dropdowns
  const uniqueSeverities = useMemo(() => {
    const severities = new Set<string>();
    filtered.forEach(r => {
      if (r.severity) severities.add(r.severity);
    });
    return Array.from(severities).sort();
  }, [filtered]);

  const uniqueControlStatuses = useMemo(() => {
    const statuses = new Set<string>();
    filtered.forEach(r => {
      if (r.controlStatus) statuses.add(r.controlStatus);
    });
    return Array.from(statuses).sort();
  }, [filtered]);

  const uniqueServices = useMemo(() => {
    const services = new Set<string>();
    filtered.forEach(r => {
      const service = (r.controlId || "").split('.')[0];
      if (service) services.add(service);
    });
    return Array.from(services).sort();
  }, [filtered]);

  const uniqueCompliances = useMemo(() => {
    const compliances = new Set<string>();
    filtered.forEach(r => {
      const requirements = r.relatedRequirements || "";
      if (requirements.includes('NIST')) compliances.add('NIST');
      if (requirements.includes('PCI')) compliances.add('PCI');
      if (requirements.includes('SOC')) compliances.add('SOC');
      if (requirements.includes('ISO')) compliances.add('ISO');
    });
    return Array.from(compliances).sort();
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
                  isDark ? "text-blue-400" : "text-blue-600"
                )} />
                <p className={cn(
                  isDark ? "text-gray-400" : "text-gray-500"
                )}>Loading cloud security findings...</p>
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
              )}>Cloud Security — AWS Security Hub</h1>
              <p className={cn(
                "mt-1",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                AWS Security Hub compliance findings and security posture analytics
              </p>
            </div>
            <div className="flex space-x-3">
              <Button onClick={fetchData} variant="outline" disabled={loading}>
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
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
                    placeholder="Search control ID, title, severity, status, compliance…"
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

          {/* Charts Row 1: Severity (pie) + Control Status (pie) + AWS Services (bar) */}
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
                  <AlertTriangle className="h-4 w-4" />
                  Findings by Severity
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
                  Control Status
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={statusCounts} 
                      dataKey="value" 
                      nameKey="name" 
                      outerRadius={85} 
                      label={({name, value}) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {statusCounts.map((d, i) => (
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
                  <Cloud className="h-4 w-4" />
                  Findings by AWS Service
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serviceCounts} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
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
                      {serviceCounts.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2: Compliance Framework Breakdown + Trending */}
          <div className="mb-8 grid gap-6 lg:grid-cols-2">
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
                  Top Compliance Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={complianceCounts} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 10, fill: isDark ? '#9ca3af' : '#6b7280' }} 
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
                      {complianceCounts.map((d, i) => (
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
                  <TrendingUp className="h-4 w-4" />
                  Finding Trends (per day)
                </CardTitle>
                <CardDescription className={cn(
                  isDark ? "text-gray-400" : "text-gray-600"
                )}>
                  Daily security finding volume over the selected time period
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72">
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
                      formatter={(value, name) => [value, 'Findings']}
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
          </div>

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
                  )}>Control Status</label>
                  <Select value={tableControlStatusFilter} onValueChange={setTableControlStatusFilter}>
                    <SelectTrigger className={cn(
                      isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      {uniqueControlStatuses.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className={cn(
                    "text-sm font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}>AWS Service</label>
                  <Select value={tableServiceFilter} onValueChange={setTableServiceFilter}>
                    <SelectTrigger className={cn(
                      isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Services</SelectItem>
                      {uniqueServices.map(service => (
                        <SelectItem key={service} value={service}>{service}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className={cn(
                    "text-sm font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}>Compliance</label>
                  <Select value={tableComplianceFilter} onValueChange={setTableComplianceFilter}>
                    <SelectTrigger className={cn(
                      isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Frameworks</SelectItem>
                      {uniqueCompliances.map(compliance => (
                        <SelectItem key={compliance} value={compliance}>{compliance}</SelectItem>
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
                    setTableControlStatusFilter("ALL");
                    setTableServiceFilter("ALL");
                    setTableComplianceFilter("ALL");
                  }}
                >
                  Clear Filters
                </Button>
                <div className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}>
                  Showing {tableRows.length} findings
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table: Security Findings */}
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
                Security Findings — {tableRows.length}
              </CardTitle>
              <CardDescription className={cn(
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                AWS Security Hub compliance and security findings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FindingsTable items={tableRows} isDark={isDark} onRowClick={handleRowClick} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail Panel */}
      <DetailPanel
        isOpen={isPanelOpen}
        onClose={handlePanelClose}
        data={selectedFinding}
        type="cloud"
        title={selectedFinding ? selectedFinding.title || selectedFinding.controlId || 'AWS Security Finding' : ''}
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

function FindingsTable({ items, isDark, onRowClick }: { items: any[]; isDark: boolean; onRowClick?: (item: any) => void }) {
  const [sortKey, setSortKey] = useState<string>("foundAt");
  const [sortDir, setSortDir] = useState<string>("desc");

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case "severity":
          // Sort by severity priority: Critical > High > Medium > Low > Unknown
          const severityOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1, 'Unknown': 0 };
          av = severityOrder[a.severity] || 0;
          bv = severityOrder[b.severity] || 0;
          break;
        case "controlStatus":
        case "controlId":
        case "title":
        case "customParameters":
          av = (a[sortKey] || "").toString().toLowerCase();
          bv = (b[sortKey] || "").toString().toLowerCase();
          break;
        case "failedChecks":
        case "passedChecks":
          av = a[sortKey] || 0;
          bv = b[sortKey] || 0;
          break;
        case "foundAt":
        default:
          av = new Date(a.foundAt || a.createdAt || 0).getTime();
          bv = new Date(b.foundAt || b.createdAt || 0).getTime();
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
      setSortDir(key === "foundAt" ? "desc" : "asc");
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
                label="Control ID" 
                active={sortKey === "controlId"} 
                direction={sortDir} 
                onClick={() => toggleSort("controlId")}
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
                label="Status" 
                active={sortKey === "controlStatus"} 
                direction={sortDir} 
                onClick={() => toggleSort("controlStatus")}
                isDark={isDark}
              />
            </th>
            <th className="p-3">
              <SortButton 
                label="Failed" 
                active={sortKey === "failedChecks"} 
                direction={sortDir} 
                onClick={() => toggleSort("failedChecks")}
                isDark={isDark}
              />
            </th>
            <th className="p-3">
              <SortButton 
                label="Passed" 
                active={sortKey === "passedChecks"} 
                direction={sortDir} 
                onClick={() => toggleSort("passedChecks")}
                isDark={isDark}
              />
            </th>
            <th className="p-3">
              <SortButton 
                label="Support" 
                active={sortKey === "customParameters"} 
                direction={sortDir} 
                onClick={() => toggleSort("customParameters")}
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
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={7} className={cn(
                "p-8 text-center",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                <Cloud className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No security findings found.
              </td>
            </tr>
          ) : (
            sorted.map((r, idx) => (
              <tr key={`${r.controlId}-${idx}`} 
                  onClick={() => onRowClick?.(r)}
                  className={cn(
                    "border-b transition-colors cursor-pointer",
                    isDark 
                      ? "border-gray-700 hover:bg-gray-700/50" 
                      : "border-gray-200 hover:bg-gray-50"
                  )}>
                <td className={cn(
                  "p-3 whitespace-nowrap font-mono text-sm",
                  isDark ? "text-blue-400" : "text-blue-600"
                )}>
                  {r.controlId || "—"}
                </td>
                <td className="p-3 whitespace-nowrap">
                  <Badge className={getSeverityBadgeClass(r.severity || 'Unknown', isDark)}>
                    {r.severity || 'Unknown'}
                  </Badge>
                </td>
                <td className="p-3 whitespace-nowrap">
                  <Badge variant={r.controlStatus === 'Failed' ? 'destructive' : r.controlStatus === 'Passed' ? 'default' : 'secondary'}>
                    {r.controlStatus || 'Unknown'}
                  </Badge>
                </td>
                <td className={cn(
                  "p-3 whitespace-nowrap font-semibold",
                  r.failedChecks > 0 
                    ? (isDark ? "text-red-400" : "text-red-600") 
                    : (isDark ? "text-gray-400" : "text-gray-500")
                )}>
                  {r.failedChecks || 0}
                </td>
                <td className={cn(
                  "p-3 whitespace-nowrap font-semibold",
                  r.passedChecks > 0 
                    ? (isDark ? "text-green-400" : "text-green-600") 
                    : (isDark ? "text-gray-400" : "text-gray-500")
                )}>
                  {r.passedChecks || 0}
                </td>
                <td className="p-3 whitespace-nowrap">
                  <Badge variant={r.customParameters === 'SUPPORTED' ? 'default' : 'secondary'}>
                    {r.customParameters || 'Unknown'}
                  </Badge>
                </td>
                <td className={cn(
                  "p-3 max-w-lg truncate",
                  isDark ? "text-gray-300" : "text-gray-900"
                )} title={r.title}>
                  {r.title || "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}