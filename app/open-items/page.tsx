'use client';

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, ArrowUpDown, Upload, FileText, X, Edit, MessageSquare, Clock, CheckCircle, AlertCircle, Filter, RefreshCw, Eye } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useSession } from 'next-auth/react';
import { useTheme } from '@/components/theme-provider';
import AuthGuard from '@/lib/auth-guard';
import { 
  METALLIC_COLORS, 
  getSeverityColor, 
  getStatusColor, 
  getAssigneeColor, 
  getSeverityBadgeClass, 
  getStatusBadgeClass 
} from '@/lib/theme-config';
import { cn } from '@/lib/utils';
import ImportDataDialog from '@/components/import-data-dialog';

interface OpenItem {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  priority?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  issueType?: string;
  labels?: string;
  epic?: string;
  sprint?: string;
  storyPoints?: number;
  dueDate?: string;
  resolution?: string;
  reporter?: string;
  reportDate?: string;
}

const isClosed = (s = "") => s.toLowerCase() === "closed" || s.toLowerCase() === "done" || s.toLowerCase() === "resolved" || s.toLowerCase() === "complete" || s.toLowerCase() === "finished";
const isOpen = (s = "") => ["to do", "todo", "in progress", "inprogress", "hold", "blocked", "backlog", "open"].includes(s.toLowerCase());
const isTodo = (s = "") => ["to do", "todo"].includes(s.toLowerCase());
const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString() : "—");

// Date range helper functions from Falcon page
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

export default function OpenItemsPage() {
  const { data: session } = useSession();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  
  // Data states
  const [items, setItems] = useState<OpenItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Filter states - using standardized approach
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");
  const [issueTypeFilter, setIssueTypeFilter] = useState("ALL");
  
  // Date filter states - using Falcon page style
  const [selectedRange, setSelectedRange] = useState<string>("30");
  const [startDate, setStartDate] = useState<Date>(() => getRange(30).start);
  const [endDate, setEndDate] = useState<Date>(() => getRange(30).end);
  
  // Sort states
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Get sort icon for column
  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    }
    return sortOrder === 'asc' 
      ? <ArrowUpDown className="h-4 w-4 rotate-180" />
      : <ArrowUpDown className="h-4 w-4" />;
  };
  
  // UI states
  const [showStats, setShowStats] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [selectedItem, setSelectedItem] = useState<OpenItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editComment, setEditComment] = useState("");
  const [saving, setSaving] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN';

  // Handle range change - from Falcon page
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

  // Data fetching
  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const url = new URL('/api/open-items', window.location.origin);
      if (startDate) url.searchParams.set("start", startDate.toISOString());
      if (endDate) url.searchParams.set("end", endDate.toISOString());
      if (searchTerm) url.searchParams.set("search", searchTerm);
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Failed to load data from server");
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  }

  // File upload handler
  async function handleFileUpload() {
    if (!uploadFile) return;
    
    setUploading(true);
    setUploadMessage("");
    
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      
      const res = await fetch('/api/open-items/import', {
        method: 'POST',
        body: formData,
      });
      
      const result = await res.json();
      
      if (result.success) {
        setUploadMessage(`Successfully imported ${result.count} items`);
        setUploadFile(null);
        await fetchData();
      } else {
        setUploadMessage(`Import failed: ${result.error}`);
      }
    } catch (error) {
      setUploadMessage(`Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  }

  // Filter and sort data
  const filteredAndSortedItems = useMemo(() => {
    let filtered = items.filter(item => {
      // Date range filter
      const itemDate = new Date(item.createdAt);
      if (startDate && itemDate < startDate) return false;
      if (endDate && itemDate > endDate) return false;
      
      // Search filter
      if (searchTerm && !item.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !(item.assignee?.toLowerCase().includes(searchTerm.toLowerCase())) &&
          !(item.description?.toLowerCase().includes(searchTerm.toLowerCase()))) {
        return false;
      }
      
      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      
      // Priority filter
      if (priorityFilter !== 'ALL' && item.priority !== priorityFilter) return false;
      
      // Assignee filter
      if (assigneeFilter !== 'ALL' && item.assignee !== assigneeFilter) return false;
      
      // Issue type filter
      if (issueTypeFilter !== 'ALL' && item.issueType !== issueTypeFilter) return false;
      
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue = a[sortBy as keyof OpenItem];
      let bValue = b[sortBy as keyof OpenItem];
      
      if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'closedAt') {
        aValue = aValue ? new Date(aValue as string).getTime() : 0;
        bValue = bValue ? new Date(bValue as string).getTime() : 0;
      }
      
      const comparison = String(aValue || '').localeCompare(String(bValue || ''));
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [items, searchTerm, statusFilter, priorityFilter, assigneeFilter, issueTypeFilter, startDate, endDate, sortBy, sortOrder]);

  // Categorize items by status
  const openItems = useMemo(() => 
    filteredAndSortedItems.filter(item => 
      item.status && (
        item.status.toLowerCase() === 'open' || 
        item.status.toLowerCase() === 'in progress' ||
        item.status.toLowerCase() === 'backlog'
      )
    ),
    [filteredAndSortedItems]
  );
  
  const todoItems = useMemo(() => 
    filteredAndSortedItems.filter(item => 
      item.status && (
        item.status.toLowerCase() === 'to do' ||
        item.status.toLowerCase() === 'todo'
      )
    ),
    [filteredAndSortedItems]
  );
  
  const closedItems = useMemo(() => 
    filteredAndSortedItems.filter(item => 
      item.status && (
        item.status.toLowerCase() === 'closed' ||
        item.status.toLowerCase() === 'done' ||
        item.status.toLowerCase() === 'resolved'
      )
    ),
    [filteredAndSortedItems]
  );

  // Active items for charts (Open + In Progress + Todo)
  const activeItems = useMemo(() => 
    [...openItems, ...todoItems],
    [openItems, todoItems]
  );

  // Chart data
  const statusChartData = useMemo(() => [
    { name: "Open", value: openItems.length, fill: getStatusColor("open") },
    { name: "To Do", value: todoItems.length, fill: getStatusColor("todo") },
    { name: "Closed", value: closedItems.length, fill: getStatusColor("closed") },
  ], [openItems.length, todoItems.length, closedItems.length]);

  const priorityChartData = useMemo(() => {
    const priorities = ['Critical', 'High', 'Medium', 'Low', 'Minor (P4)'];
    return priorities.map(priority => ({
      name: priority,
      value: activeItems.filter(item => item.priority === priority).length,
      fill: getSeverityColor(priority.toLowerCase().replace(' (p4)', ''))
    })).filter(item => item.value > 0);
  }, [activeItems]);

  const assigneeChartData = useMemo(() => {
    const assigneeCounts = activeItems.reduce((acc, item) => {
      const assignee = item.assignee || 'Unassigned';
      acc[assignee] = (acc[assignee] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(assigneeCounts).map(([assignee, count]) => ({
      name: assignee,
      value: count,
      fill: getAssigneeColor(assignee)
    }));
  }, [activeItems]);

  // Get unique values for filters
  const uniqueStatuses = useMemo(() => 
    Array.from(new Set(items.map(item => item.status).filter(Boolean))),
    [items]
  );
  
  const uniquePriorities = useMemo(() => 
    Array.from(new Set(items.map(item => item.priority).filter(Boolean))),
    [items]
  );
  
  const uniqueAssignees = useMemo(() => 
    Array.from(new Set(items.map(item => item.assignee).filter(Boolean))),
    [items]
  );
  
  const uniqueIssueTypes = useMemo(() => 
    Array.from(new Set(items.map(item => item.issueType).filter(Boolean))),
    [items]
  );

  // Export function
  const exportData = () => {
    const csv = [
      ['ID', 'Title', 'Assignee', 'Priority', 'Status', 'Created', 'Updated', 'Closed'].join(','),
      ...filteredAndSortedItems.map(item => [
        item.id,
        `"${item.title.replace(/"/g, '""')}"`,
        item.assignee || '',
        item.priority || '',
        item.status,
        item.createdAt,
        item.updatedAt || '',
        item.closedAt || ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `open-items-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Handle item selection and sidebar
  const handleItemClick = (item: OpenItem) => {
    setSelectedItem(item);
    setEditComment(item.description || '');
    setSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
    setSelectedItem(null);
    setEditComment('');
  };

  // Update item status
  const updateItemStatus = async (newStatus: string) => {
    if (!selectedItem) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/open-items/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus,
          description: editComment 
        }),
      });

      if (response.ok) {
        await fetchData(); // Refresh data
        setSelectedItem(prev => prev ? { ...prev, status: newStatus, description: editComment } : null);
      }
    } catch (error) {
      console.error('Failed to update item:', error);
    } finally {
      setSaving(false);
    }
  };

  // Save comment changes
  const saveComment = async () => {
    if (!selectedItem) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/open-items/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editComment }),
      });

      if (response.ok) {
        await fetchData();
        setSelectedItem(prev => prev ? { ...prev, description: editComment } : null);
      }
    } catch (error) {
      console.error('Failed to save comment:', error);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  return (
    <AuthGuard>
      <div className={cn(
        "min-h-screen w-full transition-colors duration-200",
        isDark ? "bg-gray-900" : "bg-gray-50"
      )}>
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className={cn(
              "text-4xl font-bold tracking-tight mb-2",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Open Items ({new Date().toISOString().slice(0, 10)})
            </h1>
            <p className={cn(
              "text-lg",
              isDark ? "text-gray-300" : "text-gray-600"
            )}>
              Track and manage security-related action items and tasks
            </p>
            </div>
            <div className="flex items-center gap-3">
              <ImportDataDialog highlight={['open_items']} allowed={['open_items']} />
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
                    placeholder="Search open items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={cn(
                      isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                    )}
                  />
                </div>
                <Button onClick={fetchData} disabled={loading} variant="secondary">
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
                Date Filter
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
                    Apply Filter
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

          {/* Unified importer available via dialog; hidden direct upload removed */}

          {/* Stats/Charts Section */}
          {showStats && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8"
            >
              {/* Status Chart */}
              <Card className={cn(
                "chart-container transition-colors duration-200",
                isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              )}>
                <CardHeader>
                  <CardTitle className={cn(
                    "text-responsive-lg",
                    isDark ? "text-white" : "text-gray-900"
                  )}>
                    Open vs Closed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({name, value}) => `${name}: ${value}`}
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: isDark ? '#374151' : '#ffffff',
                          border: isDark ? '1px solid #4B5563' : '1px solid #E5E7EB',
                          borderRadius: '8px',
                          color: isDark ? '#F9FAFB' : '#111827'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Priority Chart */}
              <Card className={cn(
                "chart-container transition-colors duration-200",
                isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              )}>
                <CardHeader>
                  <CardTitle className={cn(
                    "text-responsive-lg",
                    isDark ? "text-white" : "text-gray-900"
                  )}>
                    Active Items by Priority
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={priorityChartData}>
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12, fill: isDark ? '#9CA3AF' : '#6B7280' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: isDark ? '#9CA3AF' : '#6B7280' }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: isDark ? '#374151' : '#ffffff',
                          border: isDark ? '1px solid #4B5563' : '1px solid #E5E7EB',
                          borderRadius: '8px',
                          color: isDark ? '#F9FAFB' : '#111827'
                        }}
                      />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Assignee Chart */}
              <Card className={cn(
                "chart-container transition-colors duration-200",
                isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              )}>
                <CardHeader>
                  <CardTitle className={cn(
                    "text-responsive-lg",
                    isDark ? "text-white" : "text-gray-900"
                  )}>
                    Active Items by Assignee
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={assigneeChartData}>
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 10, fill: isDark ? '#9CA3AF' : '#6B7280' }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: isDark ? '#9CA3AF' : '#6B7280' }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: isDark ? '#374151' : '#ffffff',
                          border: isDark ? '1px solid #4B5563' : '1px solid #E5E7EB',
                          borderRadius: '8px',
                          color: isDark ? '#F9FAFB' : '#111827'
                        }}
                      />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Items Tables */}
          <div className="space-y-8">
            {/* Open Items */}
            <Card className={cn(
              "transition-colors duration-200",
              isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <CardHeader>
                <CardTitle className={cn(
                  "text-responsive-xl flex items-center justify-between",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  <span>Open Items ({openItems.length})</span>
                  <Badge 
                    className={cn(
                      "badge-open px-3 py-1 text-sm font-medium"
                    )}
                  >
                    {openItems.length} Open
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full">
                    <thead>
                      <tr className={cn(
                        "border-b text-left text-responsive-sm font-medium",
                        isDark ? "border-gray-700 text-gray-300" : "border-gray-200 text-gray-600"
                      )}>
                        <th 
                          className="py-3 pr-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('title')}
                        >
                          <div className="flex items-center gap-1">
                            Title
                            {getSortIcon('title')}
                          </div>
                        </th>
                        <th 
                          className="py-3 px-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('assignee')}
                        >
                          <div className="flex items-center gap-1">
                            Assignee
                            {getSortIcon('assignee')}
                          </div>
                        </th>
                        <th 
                          className="py-3 px-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('priority')}
                        >
                          <div className="flex items-center gap-1">
                            Priority
                            {getSortIcon('priority')}
                          </div>
                        </th>
                        <th 
                          className="py-3 px-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('status')}
                        >
                          <div className="flex items-center gap-1">
                            Status
                            {getSortIcon('status')}
                          </div>
                        </th>
                        <th 
                          className="py-3 px-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('createdAt')}
                        >
                          <div className="flex items-center gap-1">
                            Created
                            {getSortIcon('createdAt')}
                          </div>
                        </th>
                        <th 
                          className="py-3 pl-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('dueDate')}
                        >
                          <div className="flex items-center gap-1">
                            Due Date
                            {getSortIcon('dueDate')}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {openItems.map((item, index) => (
                        <motion.tr
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleItemClick(item)}
                          className={cn(
                            "border-b transition-colors hover:bg-opacity-50 cursor-pointer",
                            isDark 
                              ? "border-gray-700 hover:bg-gray-700" 
                              : "border-gray-100 hover:bg-gray-50"
                          )}
                        >
                          <td className="py-4 pr-4">
                            <div>
                              <div className={cn(
                                "font-medium text-responsive-sm",
                                isDark ? "text-white" : "text-gray-900"
                              )}>
                                {item.title}
                              </div>
                              {item.description && (
                                <div className={cn(
                                  "text-xs mt-1 truncate max-w-xs",
                                  isDark ? "text-gray-400" : "text-gray-500"
                                )}>
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              "text-responsive-sm",
                              isDark ? "text-gray-300" : "text-gray-600"
                            )}>
                              {item.assignee || "Unassigned"}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            {item.priority && (
                              <Badge className={getSeverityBadgeClass(item.priority, isDark)}>
                                {item.priority}
                              </Badge>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <Badge className={getStatusBadgeClass(item.status, isDark)}>
                              {item.status}
                            </Badge>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              "text-responsive-sm",
                              isDark ? "text-gray-400" : "text-gray-500"
                            )}>
                              {fmt(item.createdAt)}
                            </span>
                          </td>
                          <td className="py-4 pl-4">
                            <span className={cn(
                              "text-responsive-sm",
                              isDark ? "text-gray-400" : "text-gray-500"
                            )}>
                              {fmt(item.dueDate)}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {openItems.length === 0 && (
                    <div className={cn(
                      "text-center py-12",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>
                      No open items found with current filters
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* To Do Items */}
            <Card className={cn(
              "transition-colors duration-200",
              isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <CardHeader>
                <CardTitle className={cn(
                  "text-responsive-xl flex items-center justify-between",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  <span>To Do Items ({todoItems.length})</span>
                  <Badge 
                    className={cn(
                      "badge-todo px-3 py-1 text-sm font-medium bg-yellow-500 text-white"
                    )}
                  >
                    {todoItems.length} To Do
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full">
                    <thead>
                      <tr className={cn(
                        "border-b text-left text-responsive-sm font-medium",
                        isDark ? "border-gray-700 text-gray-300" : "border-gray-200 text-gray-600"
                      )}>
                        <th 
                          className="py-3 pr-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('title')}
                        >
                          <div className="flex items-center gap-1">
                            Title
                            {getSortIcon('title')}
                          </div>
                        </th>
                        <th 
                          className="py-3 px-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('assignee')}
                        >
                          <div className="flex items-center gap-1">
                            Assignee
                            {getSortIcon('assignee')}
                          </div>
                        </th>
                        <th 
                          className="py-3 px-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('priority')}
                        >
                          <div className="flex items-center gap-1">
                            Priority
                            {getSortIcon('priority')}
                          </div>
                        </th>
                        <th 
                          className="py-3 px-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('status')}
                        >
                          <div className="flex items-center gap-1">
                            Status
                            {getSortIcon('status')}
                          </div>
                        </th>
                        <th 
                          className="py-3 px-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('createdAt')}
                        >
                          <div className="flex items-center gap-1">
                            Created
                            {getSortIcon('createdAt')}
                          </div>
                        </th>
                        <th 
                          className="py-3 pl-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('dueDate')}
                        >
                          <div className="flex items-center gap-1">
                            Due Date
                            {getSortIcon('dueDate')}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {todoItems.map((item, index) => (
                        <motion.tr
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleItemClick(item)}
                          className={cn(
                            "border-b transition-colors hover:bg-opacity-50 cursor-pointer",
                            isDark 
                              ? "border-gray-700 hover:bg-gray-700" 
                              : "border-gray-100 hover:bg-gray-50"
                          )}
                        >
                          <td className="py-4 pr-4">
                            <div>
                              <div className={cn(
                                "font-medium text-responsive-sm",
                                isDark ? "text-white" : "text-gray-900"
                              )}>
                                {item.title}
                              </div>
                              {item.description && (
                                <div className={cn(
                                  "text-xs mt-1 truncate max-w-xs",
                                  isDark ? "text-gray-400" : "text-gray-500"
                                )}>
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              "text-responsive-sm",
                              isDark ? "text-gray-300" : "text-gray-600"
                            )}>
                              {item.assignee || "Unassigned"}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            {item.priority && (
                              <Badge className={getSeverityBadgeClass(item.priority, isDark)}>
                                {item.priority}
                              </Badge>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <Badge className={getStatusBadgeClass(item.status, isDark)}>
                              {item.status}
                            </Badge>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              "text-responsive-sm",
                              isDark ? "text-gray-400" : "text-gray-500"
                            )}>
                              {fmt(item.createdAt)}
                            </span>
                          </td>
                          <td className="py-4 pl-4">
                            <span className={cn(
                              "text-responsive-sm",
                              isDark ? "text-gray-400" : "text-gray-500"
                            )}>
                              {fmt(item.dueDate)}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {todoItems.length === 0 && (
                    <div className={cn(
                      "text-center py-12",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>
                      No to do items found with current filters
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Closed Items */}
            <Card className={cn(
              "transition-colors duration-200",
              isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <CardHeader>
                <CardTitle className={cn(
                  "text-responsive-xl flex items-center justify-between",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  <span>Closed Items ({closedItems.length})</span>
                  <Badge 
                    className={cn(
                      "badge-closed px-3 py-1 text-sm font-medium"
                    )}
                  >
                    {closedItems.length} Closed
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full">
                    <thead>
                      <tr className={cn(
                        "border-b text-left text-responsive-sm font-medium",
                        isDark ? "border-gray-700 text-gray-300" : "border-gray-200 text-gray-600"
                      )}>
                        <th 
                          className="py-3 pr-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('title')}
                        >
                          <div className="flex items-center gap-1">
                            Title
                            {getSortIcon('title')}
                          </div>
                        </th>
                        <th 
                          className="py-3 px-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('assignee')}
                        >
                          <div className="flex items-center gap-1">
                            Assignee
                            {getSortIcon('assignee')}
                          </div>
                        </th>
                        <th 
                          className="py-3 px-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('priority')}
                        >
                          <div className="flex items-center gap-1">
                            Priority
                            {getSortIcon('priority')}
                          </div>
                        </th>
                        <th 
                          className="py-3 px-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('status')}
                        >
                          <div className="flex items-center gap-1">
                            Status
                            {getSortIcon('status')}
                          </div>
                        </th>
                        <th 
                          className="py-3 px-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('createdAt')}
                        >
                          <div className="flex items-center gap-1">
                            Created
                            {getSortIcon('createdAt')}
                          </div>
                        </th>
                        <th 
                          className="py-3 pl-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('closedAt')}
                        >
                          <div className="flex items-center gap-1">
                            Closed
                            {getSortIcon('closedAt')}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedItems.map((item, index) => (
                        <motion.tr
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleItemClick(item)}
                          className={cn(
                            "border-b transition-colors hover:bg-opacity-50 cursor-pointer",
                            isDark 
                              ? "border-gray-700 hover:bg-gray-700" 
                              : "border-gray-100 hover:bg-gray-50"
                          )}
                        >
                          <td className="py-4 pr-4">
                            <div>
                              <div className={cn(
                                "font-medium text-responsive-sm",
                                isDark ? "text-white" : "text-gray-900"
                              )}>
                                {item.title}
                              </div>
                              {item.description && (
                                <div className={cn(
                                  "text-xs mt-1 truncate max-w-xs",
                                  isDark ? "text-gray-400" : "text-gray-500"
                                )}>
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              "text-responsive-sm",
                              isDark ? "text-gray-300" : "text-gray-600"
                            )}>
                              {item.assignee || "Unassigned"}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            {item.priority && (
                              <Badge className={getSeverityBadgeClass(item.priority, isDark)}>
                                {item.priority}
                              </Badge>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <Badge className={getStatusBadgeClass(item.status, isDark)}>
                              {item.status}
                            </Badge>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              "text-responsive-sm",
                              isDark ? "text-gray-400" : "text-gray-500"
                            )}>
                              {fmt(item.createdAt)}
                            </span>
                          </td>
                          <td className="py-4 pl-4">
                            <span className={cn(
                              "text-responsive-sm",
                              isDark ? "text-gray-400" : "text-gray-500"
                            )}>
                              {fmt(item.closedAt)}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {closedItems.length === 0 && (
                    <div className={cn(
                      "text-center py-12",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>
                      No closed items found with current filters
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Loading and Error States */}
          {loading && (
            <div className={cn(
              "text-center py-12",
              isDark ? "text-gray-400" : "text-gray-500"
            )}>
              Loading open items...
            </div>
          )}
          
          {error && (
            <div className={cn(
              "text-center py-12",
              isDark ? "text-red-400" : "text-red-600"
            )}>
              {error}
            </div>
          )}

          {/* Upload Message */}
          {uploadMessage && (
            <div className={cn(
              "mt-4 p-4 rounded-md",
              uploadMessage.includes('Success') 
                ? isDark 
                  ? "bg-green-900 text-green-200 border border-green-700"
                  : "bg-green-50 text-green-800 border border-green-200"
                : isDark 
                  ? "bg-red-900 text-red-200 border border-red-700"
                  : "bg-red-50 text-red-800 border border-red-200"
            )}>
              {uploadMessage}
            </div>
          )}
        </div>

        {/* Side Panel for Editing */}
        {sidebarOpen && selectedItem && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleCloseSidebar} />
            <div className={cn(
              "absolute right-0 top-0 h-full w-96 shadow-xl transition-transform",
              isDark ? "bg-gray-800" : "bg-white"
            )}>
              <div className="flex h-full flex-col">
                {/* Header */}
                <div className={cn(
                  "flex items-center justify-between border-b p-4",
                  isDark ? "border-gray-700" : "border-gray-200"
                )}>
                  <h3 className={cn(
                    "text-lg font-semibold",
                    isDark ? "text-white" : "text-gray-900"
                  )}>
                    Edit Item
                  </h3>
                  <Button variant="ghost" size="sm" onClick={handleCloseSidebar}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Title */}
                  <div>
                    <label className={cn(
                      "text-sm font-medium mb-2 block",
                      isDark ? "text-gray-300" : "text-gray-700"
                    )}>
                      Title
                    </label>
                    <div className={cn(
                      "p-3 rounded-md text-sm",
                      isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                    )}>
                      {selectedItem.title}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className={cn(
                      "text-sm font-medium mb-2 block",
                      isDark ? "text-gray-300" : "text-gray-700"
                    )}>
                      Status
                    </label>
                    <Select 
                      value={selectedItem.status} 
                      onValueChange={updateItemStatus}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Open">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            Open
                          </div>
                        </SelectItem>
                        <SelectItem value="To Do">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-yellow-500" />
                            To Do
                          </div>
                        </SelectItem>
                        <SelectItem value="Closed">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Closed
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className={cn(
                      "text-sm font-medium mb-2 block",
                      isDark ? "text-gray-300" : "text-gray-700"
                    )}>
                      Priority
                    </label>
                    <div className={cn(
                      "p-3 rounded-md text-sm",
                      isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                    )}>
                      {selectedItem.priority || 'Not set'}
                    </div>
                  </div>

                  {/* Assignee */}
                  <div>
                    <label className={cn(
                      "text-sm font-medium mb-2 block",
                      isDark ? "text-gray-300" : "text-gray-700"
                    )}>
                      Assignee
                    </label>
                    <div className={cn(
                      "p-3 rounded-md text-sm",
                      isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                    )}>
                      {selectedItem.assignee || 'Unassigned'}
                    </div>
                  </div>

                  {/* Description/Comments */}
                  <div>
                    <label className={cn(
                      "text-sm font-medium mb-2 block",
                      isDark ? "text-gray-300" : "text-gray-700"
                    )}>
                      <MessageSquare className="h-4 w-4 inline mr-1" />
                      Comments
                    </label>
                    <Textarea
                      value={editComment}
                      onChange={(e) => setEditComment(e.target.value)}
                      placeholder="Add comments or notes..."
                      rows={6}
                      className={cn(
                        "resize-none",
                        isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white"
                      )}
                    />
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className={cn(
                        "text-sm font-medium mb-2 block",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}>
                        Created
                      </label>
                      <div className={cn(
                        "p-3 rounded-md text-sm",
                        isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                      )}>
                        {fmt(selectedItem.createdAt)}
                      </div>
                    </div>
                    
                    {selectedItem.dueDate && (
                      <div>
                        <label className={cn(
                          "text-sm font-medium mb-2 block",
                          isDark ? "text-gray-300" : "text-gray-700"
                        )}>
                          Due Date
                        </label>
                        <div className={cn(
                          "p-3 rounded-md text-sm",
                          isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                        )}>
                          {fmt(selectedItem.dueDate)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className={cn(
                  "border-t p-4 space-y-3",
                  isDark ? "border-gray-700" : "border-gray-200"
                )}>
                  <Button 
                    onClick={saveComment} 
                    disabled={saving}
                    className="w-full"
                  >
                    {saving ? 'Saving...' : 'Save Comments'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
