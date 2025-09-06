"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from '@/components/theme-provider';
import AuthGuard from '@/lib/auth-guard';
import NavBar from '@/components/nav-bar';
import { Filter, RefreshCw, Clock, Cloud, ArrowUpDown, ChevronDown, ChevronUp, ChevronDown as ChevronDownIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { METALLIC_COLORS, getSeverityBadgeClass } from '@/lib/theme-config';
import DetailPanel from '@/components/detail-panel';

// -------------------- Page --------------------
export default function CloudFindings() {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  const apiUrl = "/api/detections/cloud";

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  // Table filters (no time filter, and Support/Sensor Type removed)
  const [tableSeverityFilter, setTableSeverityFilter] = useState<string[]>([]);
  const [tableControlStatusFilter, setTableControlStatusFilter] = useState<string>("ALL");
  const [tableServiceFilter, setTableServiceFilter] = useState<string>("ALL");
  const [tableComplianceFilter, setTableComplianceFilter] = useState<string>("ALL");

  const [selectedFinding, setSelectedFinding] = useState<any>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const handleRowClick = (finding: any) => { setSelectedFinding(finding); setIsPanelOpen(true); };
  const handlePanelClose = () => { setIsPanelOpen(false); setSelectedFinding(null); };

  // Fetch all data (no date params)
  async function fetchData() {
    setLoading(true); setError("");
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Unable to load security findings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  // Search (free-text) only — no time-based filtering
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.controlId, r.title, r.severity, r.controlStatus, r.relatedRequirements]
      .filter(Boolean).map(String).some(v => v.toLowerCase().includes(q))
    );
  }, [rows, query]);

  // -------- Overview metrics (respond to search) --------
  const controlsRollup = useMemo(() => {
    const priority = ["Failed", "Passed", "No data", "Unknown", "Disabled"];
    const bestForControl = new Map<string, string>();
    for (const r of searched) {
      const id = String(r.controlId || ""); if (!id) continue;
      const status = (r.controlStatus || "Unknown").trim();
      const cur = bestForControl.get(id);
      if (!cur || priority.indexOf(status) < priority.indexOf(cur)) bestForControl.set(id, status);
    }
    const counts: Record<string, number> = { Passed: 0, Failed: 0, "No data": 0, Unknown: 0, Disabled: 0 };
    Array.from(bestForControl.values()).forEach(s => counts[s] = (counts[s] || 0) + 1);
    const total = bestForControl.size;
    const passed = counts.Passed || 0;
    const failed = counts.Failed || 0;
    const noData = counts["No data"] || 0;
    const unknown = counts.Unknown || 0;
    const disabled = counts.Disabled || 0;
    const score = Math.round((passed / Math.max(1, total)) * 100);
    return { total, passed, failed, noData, unknown, disabled, score };
  }, [searched]);

  const checksRollup = useMemo(() => {
    let failed = 0, total = 0;
    for (const r of searched) {
      const f = Number(r.failedChecks || 0);
      const p = Number(r.passedChecks || 0);
      failed += f; total += f + p;
    }
    return { failed, total };
  }, [searched]);

  const failedBySeverity = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of searched) {
      if ((r.controlStatus || '').toLowerCase() !== 'failed') continue;
      const sev = String(r.severity || 'Unknown').toUpperCase();
      const f = Number(r.failedChecks || 0);
      m.set(sev, (m.get(sev) || 0) + f);
    }
    return {
      CRITICAL: m.get('CRITICAL') || 0,
      HIGH: m.get('HIGH') || 0,
      MEDIUM: m.get('MEDIUM') || 0,
      LOW: m.get('LOW') || 0,
    };
  }, [searched]);

  // -------- Table rows (search + filters) - NO SORTING HERE, let table handle it --------
  const tableRows = useMemo(() => {
    return searched
      .filter((r) => tableSeverityFilter.length === 0 || tableSeverityFilter.includes(r.severity || 'Unknown'))
      .filter((r) => tableControlStatusFilter === "ALL" || (r.controlStatus || '').toLowerCase() === tableControlStatusFilter.toLowerCase())
      .filter((r) => {
        if (tableServiceFilter === "ALL") return true;
        const service = (r.controlId || '').split('.')[0] || '';
        return service.toLowerCase() === tableServiceFilter.toLowerCase();
      })
      .filter((r) => {
        if (tableComplianceFilter === "ALL") return true;
        const requirements = String(r.relatedRequirements || '').toLowerCase();
        return requirements.includes(tableComplianceFilter.toLowerCase());
      });
      // Removed sorting - let the table component handle all sorting
  }, [searched, tableSeverityFilter, tableControlStatusFilter, tableServiceFilter, tableComplianceFilter]);

  const uniqueSeverities = useMemo(() => {
    const s = new Set<string>(); searched.forEach(r => r.severity && s.add(r.severity));
    return Array.from(s).sort();
  }, [searched]);
  const uniqueStatuses = useMemo(() => {
    const s = new Set<string>(); searched.forEach(r => r.controlStatus && s.add(r.controlStatus));
    return Array.from(s).sort();
  }, [searched]);
  const uniqueServices = useMemo(() => {
    const s = new Set<string>(); searched.forEach(r => { const svc = (r.controlId || '').split('.')[0]; if (svc) s.add(svc); });
    return Array.from(s).sort();
  }, [searched]);
  const uniqueCompliances = useMemo(() => {
    const s = new Set<string>();
    searched.forEach(r => {
      const requirements = String(r.relatedRequirements || "");
      if (/nist/i.test(requirements)) s.add('NIST');
      if (/pci/i.test(requirements)) s.add('PCI');
      if (/soc/i.test(requirements)) s.add('SOC');
      if (/iso/i.test(requirements)) s.add('ISO');
    });
    return Array.from(s).sort();
  }, [searched]);

  // -------------------- Render --------------------
  if (loading && rows.length === 0) {
    return (
      <AuthGuard>
        <div className={cn("min-h-screen transition-colors duration-200", isDark ? "bg-gray-900" : "bg-gray-50")}></div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className={cn("min-h-screen transition-colors duration-200", isDark ? "bg-gray-900" : "bg-gray-50")}> 
        <NavBar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header + Search */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className={cn("text-3xl font-bold", isDark ? "text-white" : "text-gray-900")}>Cloud Security — AWS Security Hub</h1>
              <p className={cn("mt-1", isDark ? "text-gray-400" : "text-gray-500")}>Security posture and compliance overview powered by live data</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 min-w-64">
                <Input
                  placeholder="Search control ID, title, severity, status, compliance…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchData(); }}
                  className={cn(isDark ? "bg-gray-700 border-gray-600" : "bg-white")}
                />
              </div>
              <Button onClick={fetchData} variant="outline" disabled={loading}>
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Overview (numbers update from DB) */}
          <Card className={cn("mb-8 shadow-sm border", isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}> 
            <CardHeader className="pb-2">
              <CardTitle className={cn("text-lg font-semibold", isDark ? "text-white" : "text-gray-900")}>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <div className={cn("text-sm font-medium mb-1", "text-primary")}>Security score</div>
                  <div className={cn("text-5xl font-extrabold leading-none", isDark ? "text-white" : "text-gray-900")}>{controlsRollup.score}%</div>
                  <div className={cn("mt-1 text-sm", isDark ? "text-gray-300" : "text-gray-600")}>{controlsRollup.passed} of {controlsRollup.total} controls passed</div>

                  <div className={cn("mt-6 text-sm font-medium mb-2", "text-primary")}>Control status</div>
                  <div className="w-full h-3 rounded bg-gray-200 overflow-hidden dark:bg-gray-700">
                    <div className="h-full" style={{ width: `${(controlsRollup.passed / Math.max(1, controlsRollup.total)) * 100}%`, backgroundColor: METALLIC_COLORS.primary, display: 'inline-block' }} title="Passed" />
                    <div className="h-full" style={{ width: `${(controlsRollup.failed / Math.max(1, controlsRollup.total)) * 100}%`, backgroundColor: METALLIC_COLORS.critical, display: 'inline-block' }} title="Failed" />
                    <div className="h-full" style={{ width: `${(controlsRollup.noData / Math.max(1, controlsRollup.total)) * 100}%`, backgroundColor: '#3B82F6', display: 'inline-block' }} title="No data" />
                    <div className="h-full" style={{ width: `${(controlsRollup.unknown / Math.max(1, controlsRollup.total)) * 100}%`, backgroundColor: '#F59E0B', display: 'inline-block' }} title="Unknown" />
                    <div className="h-full" style={{ width: `${(controlsRollup.disabled / Math.max(1, controlsRollup.total)) * 100}%`, backgroundColor: '#9CA3AF', display: 'inline-block' }} title="Disabled" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                    <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: METALLIC_COLORS.primary }} /> <span className={cn(isDark ? "text-gray-200" : "text-gray-700")}>{controlsRollup.passed} Passed</span></div>
                    <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: METALLIC_COLORS.critical }} /> <span className={cn(isDark ? "text-gray-200" : "text-gray-700")}>{controlsRollup.failed} Failed</span></div>
                    <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded bg-primary" /> <span className={cn(isDark ? "text-gray-200" : "text-gray-700")}>{controlsRollup.noData} No data</span></div>
                    <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded bg-amber-500" /> <span className={cn(isDark ? "text-gray-200" : "text-gray-700")}>{controlsRollup.unknown} Unknown</span></div>
                    <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded bg-gray-400" /> <span className={cn(isDark ? "text-gray-200" : "text-gray-700")}>{controlsRollup.disabled} Disabled</span></div>
                  </div>
                </div>

                <div>
                  <div className={cn("text-sm font-medium mb-1", "text-primary")}>Failed checks</div>
                  <div className={cn("text-5xl font-extrabold leading-none", isDark ? "text-white" : "text-gray-900")}>{checksRollup.failed.toLocaleString()} <span className={cn("text-2xl font-semibold ml-2", isDark ? "text-gray-300" : "text-gray-600")}>/ {checksRollup.total.toLocaleString()}</span></div>

                  <div className={cn("mt-6 text-sm font-medium mb-2", "text-primary")}>Failed checks by severity</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1"><div className="inline-block px-2 py-0.5 rounded text-xs font-bold tracking-wide" style={{ backgroundColor: METALLIC_COLORS.critical, color: '#fff' }}>CRITICAL</div><div className={cn("text-xl font-semibold", isDark ? "text-white" : "text-gray-900")}>{failedBySeverity.CRITICAL.toLocaleString()}</div></div>
                    <div className="space-y-1"><div className="inline-block px-2 py-0.5 rounded text-xs font-bold tracking-wide" style={{ backgroundColor: METALLIC_COLORS.high, color: '#fff' }}>HIGH</div><div className={cn("text-xl font-semibold", isDark ? "text-white" : "text-gray-900")}>{failedBySeverity.HIGH.toLocaleString()}</div></div>
                    <div className="space-y-1"><div className="inline-block px-2 py-0.5 rounded text-xs font-bold tracking-wide" style={{ backgroundColor: METALLIC_COLORS.medium, color: '#111' }}>MEDIUM</div><div className={cn("text-xl font-semibold", isDark ? "text-white" : "text-gray-900")}>{failedBySeverity.MEDIUM.toLocaleString()}</div></div>
                    <div className="space-y-1"><div className="inline-block px-2 py-0.5 rounded text-xs font-bold tracking-wide" style={{ backgroundColor: METALLIC_COLORS.low, color: '#111' }}>LOW</div><div className={cn("text-xl font-semibold", isDark ? "text-white" : "text-gray-900")}>{failedBySeverity.LOW.toLocaleString()}</div></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters (Support & Sensor Type removed) */}
          <Card className={cn("mb-4 shadow-sm border", isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}> 
            <CardHeader className="pb-3">
              <CardTitle className={cn("flex items-center gap-2 text-base font-semibold", isDark ? "text-white" : "text-gray-900")}> <Filter className="h-4 w-4" /> Filters </CardTitle>
              <CardDescription className={cn(isDark ? "text-gray-400" : "text-gray-600")}>Refine the issues list below</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className={cn("text-sm font-medium", isDark ? "text-gray-300" : "text-gray-700")}>Severity</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-between",
                          isDark ? "bg-gray-700 border-gray-600 hover:bg-gray-600" : "bg-white hover:bg-gray-50"
                        )}
                      >
                        <span className="text-left">
                          {tableSeverityFilter.length === 0 
                            ? "All Severities" 
                            : tableSeverityFilter.length === 1 
                            ? tableSeverityFilter[0] 
                            : `${tableSeverityFilter.length} selected`
                          }
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className={cn("w-64 p-3", isDark ? "bg-gray-800 border-gray-700" : "bg-white")}>
                      <div className="space-y-2">
                        <div className={cn("text-sm font-medium", isDark ? "text-gray-300" : "text-gray-700")}>Select Severities</div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {uniqueSeverities.map(severity => (
                            <div key={severity} className="flex items-center space-x-2">
                              <Checkbox
                                id={`severity-${severity}`}
                                checked={tableSeverityFilter.includes(severity)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setTableSeverityFilter(prev => [...prev, severity]);
                                  } else {
                                    setTableSeverityFilter(prev => prev.filter(s => s !== severity));
                                  }
                                }}
                                className={cn(isDark ? "border-gray-600" : "border-gray-300")}
                              />
                              <label 
                                htmlFor={`severity-${severity}`} 
                                className={cn("text-sm cursor-pointer", isDark ? "text-gray-300" : "text-gray-700")}
                              >
                                {severity}
                              </label>
                            </div>
                          ))}
                        </div>
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTableSeverityFilter([])}
                            className="w-full h-8 text-xs"
                          >
                            Clear Selection
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <label className={cn("text-sm font-medium", isDark ? "text-gray-300" : "text-gray-700")}>Control Status</label>
                  <Select value={tableControlStatusFilter} onValueChange={setTableControlStatusFilter}>
                    <SelectTrigger className={cn(isDark ? "bg-gray-700 border-gray-600" : "bg-white")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      {uniqueStatuses.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className={cn("text-sm font-medium", isDark ? "text-gray-300" : "text-gray-700")}>AWS Service</label>
                  <Select value={tableServiceFilter} onValueChange={setTableServiceFilter}>
                    <SelectTrigger className={cn(isDark ? "bg-gray-700 border-gray-600" : "bg-white")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Services</SelectItem>
                      {uniqueServices.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className={cn("text-sm font-medium", isDark ? "text-gray-300" : "text-gray-700")}>Compliance</label>
                  <Select value={tableComplianceFilter} onValueChange={setTableComplianceFilter}>
                    <SelectTrigger className={cn(isDark ? "bg-gray-700 border-gray-600" : "bg-white")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Frameworks</SelectItem>
                      {uniqueCompliances.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => { setTableSeverityFilter([]); setTableControlStatusFilter("ALL"); setTableServiceFilter("ALL"); setTableComplianceFilter("ALL"); }}
                >
                  Clear Filters
                </Button>
                <div className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Showing {tableRows.length} issues</div>
              </div>
              {error && (
                <div className={cn("mt-4 p-3 rounded-md border", isDark ? "bg-red-900/20 border-red-800 text-red-300" : "bg-red-50 border-red-200 text-red-800")}>{error}</div>
              )}
            </CardContent>
          </Card>

          {/* Issues table */}
          <Card className={cn("shadow-sm border", isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}> 
            <CardHeader className="pb-3">
              <CardTitle className={cn("flex items-center gap-2 text-lg font-semibold", isDark ? "text-white" : "text-gray-900")}> <Clock className="h-5 w-5" /> Issues — {tableRows.length}</CardTitle>
              <CardDescription className={cn(isDark ? "text-gray-400" : "text-gray-600")}>Sorted by severity and failed checks</CardDescription>
            </CardHeader>
            <CardContent>
              <FindingsTable items={tableRows} isDark={isDark} onRowClick={(r)=>{ setSelectedFinding(r); setIsPanelOpen(true); }} />
            </CardContent>
          </Card>
        </div>
      </div>

      <DetailPanel isOpen={isPanelOpen} onClose={handlePanelClose} data={selectedFinding} type="cloud" title={selectedFinding ? (selectedFinding.title || selectedFinding.controlId || 'Issue') : ''} />
    </AuthGuard>
  );
}

// -------------------- Table --------------------
function SortButton({ label, active, direction, onClick, isDark }: { label: string; active: boolean; direction: string; onClick: () => void; isDark: boolean }) {
  return (
    <button 
      onClick={onClick} 
      className={cn(
        "flex items-center gap-1 hover:bg-opacity-10 hover:bg-gray-500 px-2 py-1 rounded transition-colors",
        active ? (isDark ? "text-white" : "text-gray-900") : (isDark ? "text-gray-400" : "text-gray-600")
      )}
    >
      <span className="font-medium">{label}</span>
      {active ? (
        direction === "asc" ? 
          <ChevronUp className="h-3.5 w-3.5" /> : 
          <ChevronDownIcon className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
      )}
      <span className="sr-only">Sort {active ? (direction === "asc" ? "ascending" : "descending") : ""}</span>
    </button>
  );
}

function FindingsTable({ items, isDark, onRowClick }: { items: any[]; isDark: boolean; onRowClick?: (item: any) => void }) {
  const [sortKey, setSortKey] = useState<string>("foundAt");
  const [sortDir, setSortDir] = useState<string>("desc");
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);
  const [page, setPage] = useState<number>(1); // 1-based

  // Reset pagination when items change (due to filtering)
  useEffect(() => {
    setPage(1);
  }, [items]);

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "severity": {
          const order: Record<string, number> = { 
            'CRITICAL': 4, 'Critical': 4,
            'HIGH': 3, 'High': 3,
            'MEDIUM': 2, 'Medium': 2,
            'LOW': 1, 'Low': 1
          };
          av = order[a.severity] || 0; 
          bv = order[b.severity] || 0; 
          break;
        }
        case "controlStatus":
        case "controlId":
        case "title": {
          av = String(a[sortKey] || "").toLowerCase().trim();
          bv = String(b[sortKey] || "").toLowerCase().trim();
          break;
        }
        case "failedChecks":
        case "passedChecks": {
          av = a[sortKey] || 0; bv = b[sortKey] || 0; break;
        }
        case "foundAt":
        default: {
          av = new Date(a.foundAt || a.createdAt || 0).getTime();
          bv = new Date(b.foundAt || b.createdAt || 0).getTime();
        }
      }
      let cmp: number;
      if (typeof av === 'string' && typeof bv === 'string') {
        cmp = av.localeCompare(bv);
      } else {
        cmp = av < bv ? -1 : av > bv ? 1 : 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [items, sortKey, sortDir]);

  // Pagination calculations
  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const paged = sorted.slice(startIndex, startIndex + rowsPerPage);

  function toggleSort(key: string) {
    setPage(1); // Reset to first page when sorting changes
    setSortKey((prev) => {
      if (prev === key) { 
        setSortDir((d) => d === "asc" ? "desc" : "asc"); 
        return prev; 
      }
      // Set default sort direction based on field type
      setSortDir(key === "foundAt" || key === "failedChecks" || key === "passedChecks" || key === "severity" ? "desc" : "asc");
      return key;
    });
  }

  function changeRowsPerPage(val: string) {
    const n = parseInt(val, 10) || 50;
    setRowsPerPage(n);
    setPage(1); // reset to first page when size changes
  }

  function goFirst() { setPage(1); }
  function goPrev() { setPage((p) => Math.max(1, p - 1)); }
  function goNext() { setPage((p) => Math.min(totalPages, p + 1)); }
  function goLast() { setPage(totalPages); }

  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", isDark ? "bg-gray-800" : "bg-white")}> 
        <thead>
          <tr className={cn("text-left border-b", isDark ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200")}> 
            <th className="p-3"><SortButton label="Control ID" active={sortKey === "controlId"} direction={sortDir} onClick={() => toggleSort("controlId")} isDark={isDark} /></th>
            <th className="p-3"><SortButton label="Severity" active={sortKey === "severity"} direction={sortDir} onClick={() => toggleSort("severity")} isDark={isDark} /></th>
            <th className="p-3"><SortButton label="Status" active={sortKey === "controlStatus"} direction={sortDir} onClick={() => toggleSort("controlStatus")} isDark={isDark} /></th>
            <th className="p-3"><SortButton label="Failed" active={sortKey === "failedChecks"} direction={sortDir} onClick={() => toggleSort("failedChecks")} isDark={isDark} /></th>
            <th className="p-3"><SortButton label="Passed" active={sortKey === "passedChecks"} direction={sortDir} onClick={() => toggleSort("passedChecks")} isDark={isDark} /></th>
            <th className="p-3"><SortButton label="Title" active={sortKey === "title"} direction={sortDir} onClick={() => toggleSort("title")} isDark={isDark} /></th>
          </tr>
        </thead>
        <tbody>
          {paged.length === 0 ? (
            <tr><td colSpan={6} className={cn("p-8 text-center", isDark ? "text-gray-400" : "text-gray-500")}><Cloud className="h-8 w-8 mx-auto mb-2 opacity-50" />No issues found.</td></tr>
          ) : (
            paged.map((r, idx) => (
              <tr key={`${r.controlId || 'id'}-${startIndex + idx}`} onClick={() => onRowClick?.(r)} className={cn("border-b transition-colors cursor-pointer", isDark ? "border-gray-700 hover:bg-gray-700/50" : "border-gray-200 hover:bg-gray-50")}> 
                <td className={cn("p-3 whitespace-nowrap font-mono text-sm", "text-primary")}>{r.controlId || "—"}</td>
                <td className="p-3 whitespace-nowrap"><Badge className={getSeverityBadgeClass(r.severity || 'Unknown', isDark)}>{r.severity || 'Unknown'}</Badge></td>
                <td className="p-3 whitespace-nowrap"><Badge variant={r.controlStatus === 'Failed' ? 'destructive' : r.controlStatus === 'Passed' ? 'default' : 'secondary'}>{r.controlStatus || 'Unknown'}</Badge></td>
                <td className={cn("p-3 whitespace-nowrap font-semibold", (r.failedChecks||0)>0 ? (isDark?"text-red-400":"text-red-600") : (isDark?"text-gray-400":"text-gray-500"))}>{r.failedChecks || 0}</td>
                <td className={cn("p-3 whitespace-nowrap font-semibold", (r.passedChecks||0)>0 ? (isDark?"text-green-400":"text-green-600") : (isDark?"text-gray-400":"text-gray-500"))}>{r.passedChecks || 0}</td>
                <td className={cn("p-3 max-w-lg truncate", isDark ? "text-gray-300" : "text-gray-900")} title={r.title}>{r.title || "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination footer */}
      <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3", isDark ? "text-gray-300" : "text-gray-700")}> 
        <div>
          Showing page {safePage} of {totalPages} ({totalItems.toLocaleString()} total alerts)
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-1">Rows per page</span>
          <Select value={String(rowsPerPage)} onValueChange={changeRowsPerPage}>
            <SelectTrigger className={cn("h-8 w-24", isDark ? "bg-gray-700 border-gray-600" : "bg-white")}> 
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-2 flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goFirst} disabled={safePage === 1}>{"«"}</Button>
            <Button variant="outline" size="sm" onClick={goPrev} disabled={safePage === 1}>Previous</Button>
            <span className={cn("px-2", isDark ? "text-gray-300" : "text-gray-700")}>Page {safePage}</span>
            <Button variant="outline" size="sm" onClick={goNext} disabled={safePage === totalPages}>Next</Button>
            <Button variant="outline" size="sm" onClick={goLast} disabled={safePage === totalPages}>{"»"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
