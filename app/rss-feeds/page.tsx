'use client';

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, ArrowUpDown, Upload, FileText, X, Edit, MessageSquare, Clock, CheckCircle, AlertCircle, Filter, RefreshCw, Eye, Rss, Plus, Trash2, ExternalLink } from "lucide-react";
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
import NavBar from '@/components/nav-bar';
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

interface RssFeed {
  id: string;
  name: string;
  url: string;
  category: string;
  active: boolean;
  lastFetched?: string;
  fetchError?: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    rssItems: number;
  };
}

interface RssItem {
  id: string;
  feedId: string;
  title: string;
  description?: string;
  link: string;
  pubDate?: string;
  author?: string;
  category?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  tags?: string;
  content?: string;
  read: boolean;
  bookmarked: boolean;
  cves?: string;
  cvssScore?: number;
  affectedProducts?: string;
  fetchedAt: string;
  createdAt: string;
  updatedAt: string;
  rssFeed: {
    name: string;
    category: string;
    url: string;
  };
}

const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString() : "—");

// Date range helper functions
const ranges = [
  { label: "All Items", days: null },
  { label: "Last 7 days", days: 7 },
  { label: "Last 15 days", days: 15 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 60 days", days: 60 },
  { label: "Last 90 days", days: 90 },
];

function getRange(days: number | null) {
  if (days === null) {
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

export default function RssFeedsPage() {
  const { data: session } = useSession();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  
  // Data states
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [items, setItems] = useState<RssItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [readFilter, setReadFilter] = useState("ALL");
  const [feedFilter, setFeedFilter] = useState("ALL");
  
  // Date filter states
  const [selectedRange, setSelectedRange] = useState<string>("30");
  const [startDate, setStartDate] = useState<Date>(() => getRange(30).start);
  const [endDate, setEndDate] = useState<Date>(() => getRange(30).end);
  
  // Sort states
  const [sortBy, setSortBy] = useState("pubDate");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // UI states
  const [showStats, setShowStats] = useState(true);
  const [showItems, setShowItems] = useState(true);
  const [selectedItem, setSelectedItem] = useState<RssItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newFeed, setNewFeed] = useState({ name: '', url: '', category: '' });
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [fetchingFeeds, setFetchingFeeds] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN';

  // Handle range change
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

  // Data fetching
  async function fetchFeeds() {
    try {
      const res = await fetch('/api/rss-feeds');
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setFeeds(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching feeds:', e);
    }
  }

  async function fetchItems() {
    setLoading(true);
    setError("");
    try {
      const url = new URL('/api/rss-items', window.location.origin);
      if (startDate) url.searchParams.set("start", startDate.toISOString());
      if (endDate) url.searchParams.set("end", endDate.toISOString());
      if (searchTerm) url.searchParams.set("search", searchTerm);
      if (severityFilter !== 'ALL') url.searchParams.set("severity", severityFilter);
      if (categoryFilter !== 'ALL') url.searchParams.set("category", categoryFilter);
      if (readFilter !== 'ALL') url.searchParams.set("read", readFilter === 'READ' ? 'true' : 'false');
      if (feedFilter !== 'ALL') url.searchParams.set("feedId", feedFilter);
      url.searchParams.set("limit", "100");
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      setError("Failed to load RSS items from server");
      console.error('Error fetching items:', e);
    } finally {
      setLoading(false);
    }
  }

  // Add new RSS feed
  async function addFeed() {
    if (!newFeed.name || !newFeed.url || !newFeed.category) return;
    
    try {
      const res = await fetch('/api/rss-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFeed),
      });
      
      if (res.ok) {
        setNewFeed({ name: '', url: '', category: '' });
        setShowAddFeed(false);
        await fetchFeeds();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to add feed');
      }
    } catch (error) {
      alert('Failed to add feed');
    }
  }

  // Delete RSS feed
  async function deleteFeed(feedId: string) {
    if (!confirm('Are you sure you want to delete this RSS feed?')) return;
    
    try {
      const res = await fetch(`/api/rss-feeds/${feedId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        await fetchFeeds();
        await fetchItems(); // Refresh items too
      }
    } catch (error) {
      console.error('Failed to delete feed:', error);
    }
  }

  // Toggle feed active status
  async function toggleFeedActive(feedId: string, active: boolean) {
    try {
      const res = await fetch(`/api/rss-feeds/${feedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !active }),
      });
      
      if (res.ok) {
        await fetchFeeds();
      }
    } catch (error) {
      console.error('Failed to update feed:', error);
    }
  }

  // Fetch RSS feeds content
  async function fetchAllFeeds() {
    setFetchingFeeds(true);
    try {
      const res = await fetch('/api/rss-feeds/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      
      const result = await res.json();
      alert(result.message);
      await fetchItems(); // Refresh items
    } catch (error) {
      alert('Failed to fetch RSS feeds');
    } finally {
      setFetchingFeeds(false);
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
      
      const res = await fetch('/api/rss-feeds/import', {
        method: 'POST',
        body: formData,
      });
      
      const result = await res.json();
      setUploadMessage(result.message);
      setUploadFile(null);
      await fetchFeeds();
    } catch (error) {
      setUploadMessage(`Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  }

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = items.filter(item => {
      // Date range filter
      const itemDate = item.pubDate ? new Date(item.pubDate) : new Date(item.createdAt);
      if (startDate && itemDate < startDate) return false;
      if (endDate && itemDate > endDate) return false;
      
      // Search filter
      if (searchTerm && !item.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !(item.description?.toLowerCase().includes(searchTerm.toLowerCase())) &&
          !(item.author?.toLowerCase().includes(searchTerm.toLowerCase()))) {
        return false;
      }
      
      // Severity filter
      if (severityFilter !== 'ALL' && item.severity !== severityFilter) return false;
      
      // Category filter
      if (categoryFilter !== 'ALL' && item.rssFeed.category !== categoryFilter) return false;
      
      // Read filter
      if (readFilter === 'READ' && !item.read) return false;
      if (readFilter === 'UNREAD' && item.read) return false;
      
      // Feed filter
      if (feedFilter !== 'ALL' && item.feedId !== feedFilter) return false;
      
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof RssItem];
      let bValue: any = b[sortBy as keyof RssItem];
      
      if (sortBy === 'pubDate' || sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }
      
      const comparison = String(aValue || '').localeCompare(String(bValue || ''));
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [items, searchTerm, severityFilter, categoryFilter, readFilter, feedFilter, startDate, endDate, sortBy, sortOrder]);

  // Chart data
  const severityChartData = useMemo(() => {
    const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    return severities.map(severity => ({
      name: severity,
      value: filteredAndSortedItems.filter(item => item.severity === severity).length,
      fill: getSeverityColor(severity.toLowerCase())
    })).filter(item => item.value > 0);
  }, [filteredAndSortedItems]);

  const categoryChartData = useMemo(() => {
    const categoryCounts = filteredAndSortedItems.reduce((acc, item) => {
      const category = item.rssFeed.category;
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0', '#ffb347', '#50c878'];

    return Object.entries(categoryCounts).map(([category, count], index) => ({
      name: category,
      value: count,
      fill: colors[index % colors.length]
    }));
  }, [filteredAndSortedItems]);

  // Get unique values for filters
  const uniqueCategories = useMemo(() => 
    Array.from(new Set(feeds.map(feed => feed.category).filter(Boolean))),
    [feeds]
  );

  // Handle item selection
  const handleItemClick = (item: RssItem) => {
    setSelectedItem(item);
    setSidebarOpen(true);
    
    // Mark as read if unread
    if (!item.read) {
      markAsRead(item.id, true);
    }
  };

  // Mark item as read/unread
  const markAsRead = async (itemId: string, read: boolean) => {
    try {
      const res = await fetch(`/api/rss-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read }),
      });
      
      if (res.ok) {
        setItems(prev => prev.map(item => 
          item.id === itemId ? { ...item, read } : item
        ));
        if (selectedItem?.id === itemId) {
          setSelectedItem(prev => prev ? { ...prev, read } : null);
        }
      }
    } catch (error) {
      console.error('Failed to update read status:', error);
    }
  };

  // Toggle bookmark
  const toggleBookmark = async (itemId: string, bookmarked: boolean) => {
    try {
      const res = await fetch(`/api/rss-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmarked: !bookmarked }),
      });
      
      if (res.ok) {
        setItems(prev => prev.map(item => 
          item.id === itemId ? { ...item, bookmarked: !bookmarked } : item
        ));
        if (selectedItem?.id === itemId) {
          setSelectedItem(prev => prev ? { ...prev, bookmarked: !bookmarked } : null);
        }
      }
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  };

  useEffect(() => {
    fetchFeeds();
    fetchItems();
  }, [startDate, endDate]);

  return (
    <AuthGuard>
      <NavBar />
      <div className={cn(
        "min-h-screen w-full transition-colors duration-200",
        isDark ? "bg-gray-900" : "bg-gray-50"
      )}>
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className={cn(
              "text-4xl font-bold tracking-tight mb-2",
              isDark ? "text-white" : "text-gray-900"
            )}>
              RSS Feeds ({new Date().toISOString().slice(0, 10)})
            </h1>
            <p className={cn(
              "text-lg",
              isDark ? "text-gray-300" : "text-gray-600"
            )}>
              Security RSS feed aggregator and news monitoring
            </p>
          </div>

          {/* Controls */}
          <Card className={cn(
            "mb-6 shadow-sm border",
            isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex-1 min-w-64">
                  <Input
                    placeholder="Search RSS items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={cn(
                      isDark ? "bg-gray-700 border-gray-600" : "bg-white"
                    )}
                  />
                </div>
                <Button onClick={fetchItems} disabled={loading} variant="secondary">
                  <Eye className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
              
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                  <Button onClick={() => setShowAddFeed(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Feed
                  </Button>
                  
                  <Button onClick={fetchAllFeeds} disabled={fetchingFeeds} size="sm" variant="outline">
                    <RefreshCw className={cn("h-4 w-4 mr-2", fetchingFeeds && "animate-spin")} />
                    {fetchingFeeds ? 'Fetching...' : 'Fetch All Feeds'}
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      fetchFeeds();
                      fetchItems();
                    }} 
                    size="sm" 
                    variant="outline"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh View
                  </Button>
                  <ImportDataDialog highlight={['aws_security_hub','secureworks','falcon','threat_advisory','open_items']} triggerLabel="Import Data" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Filters */}
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
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className={cn(
                    "text-sm font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}>Severity</label>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className={cn(isDark ? "bg-gray-700 border-gray-600" : "bg-white")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Severities</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="INFO">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className={cn(
                    "text-sm font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}>Category</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className={cn(isDark ? "bg-gray-700 border-gray-600" : "bg-white")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Categories</SelectItem>
                      {uniqueCategories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className={cn(
                    "text-sm font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}>Read Status</label>
                  <Select value={readFilter} onValueChange={setReadFilter}>
                    <SelectTrigger className={cn(isDark ? "bg-gray-700 border-gray-600" : "bg-white")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Items</SelectItem>
                      <SelectItem value="UNREAD">Unread Only</SelectItem>
                      <SelectItem value="READ">Read Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className={cn(
                    "text-sm font-medium",
                    isDark ? "text-gray-300" : "text-gray-700"
                  )}>Date Range</label>
                  <Select value={selectedRange} onValueChange={handleRangeChange}>
                    <SelectTrigger className={cn(isDark ? "bg-gray-700 border-gray-600" : "bg-white")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ranges.map(r => (
                        <SelectItem key={r.days || 'all'} value={r.days ? String(r.days) : 'all'}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

              {uploadMessage && (
                <div className={cn(
                  "mt-4 p-3 rounded-md border",
                  uploadMessage.includes('Success') || uploadMessage.includes('completed')
                    ? isDark 
                      ? "bg-green-900/20 border-green-800 text-green-300" 
                      : "bg-green-50 border-green-200 text-green-800"
                    : isDark 
                      ? "bg-red-900/20 border-red-800 text-red-300"
                      : "bg-red-50 border-red-200 text-red-800"
                )}>
                  {uploadMessage}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          {showStats && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
            >
              {/* Severity Chart */}
              <Card className={cn(
                "chart-container transition-colors duration-200",
                isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              )}>
                <CardHeader>
                  <CardTitle className={cn(
                    "text-responsive-lg",
                    isDark ? "text-white" : "text-gray-900"
                  )}>
                    Items by Severity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={severityChartData}>
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

              {/* Category Chart */}
              <Card className={cn(
                "chart-container transition-colors duration-200",
                isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              )}>
                <CardHeader>
                  <CardTitle className={cn(
                    "text-responsive-lg",
                    isDark ? "text-white" : "text-gray-900"
                  )}>
                    Items by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({name, value}) => `${name}: ${value}`}
                      >
                        {categoryChartData.map((entry, index) => (
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
            </motion.div>
          )}


          {/* RSS Items */}
          <Card className={cn(
            "transition-colors duration-200",
            isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <CardHeader>
              <CardTitle className={cn(
                "text-responsive-xl flex items-center justify-between",
                isDark ? "text-white" : "text-gray-900"
              )}>
                <span>RSS Items ({filteredAndSortedItems.length})</span>
                <Button onClick={() => setShowItems(!showItems)} variant="ghost" size="sm">
                  {showItems ? <X className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </CardTitle>
            </CardHeader>
            {showItems && (
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
                          onClick={() => handleSort('severity')}
                        >
                          <div className="flex items-center gap-1">
                            Severity
                            {getSortIcon('severity')}
                          </div>
                        </th>
                        <th className="py-3 px-4">Feed</th>
                        <th 
                          className="py-3 px-4 cursor-pointer hover:bg-opacity-50 select-none"
                          onClick={() => handleSort('pubDate')}
                        >
                          <div className="flex items-center gap-1">
                            Published
                            {getSortIcon('pubDate')}
                          </div>
                        </th>
                        <th className="py-3 pl-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedItems.map((item, index) => (
                        <motion.tr
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          onClick={() => handleItemClick(item)}
                          className={cn(
                            "border-b transition-colors hover:bg-opacity-50 cursor-pointer",
                            isDark 
                              ? "border-gray-700 hover:bg-gray-700" 
                              : "border-gray-100 hover:bg-gray-50",
                            !item.read && "font-medium"
                          )}
                        >
                          <td className="py-4 pr-4">
                            <div>
                              <div className={cn(
                                "text-responsive-sm",
                                !item.read 
                                  ? isDark ? "text-white" : "text-gray-900"
                                  : isDark ? "text-gray-300" : "text-gray-600"
                              )}>
                                {item.title}
                              </div>
                              {item.description && (
                                <div className={cn(
                                  "text-xs mt-1 truncate max-w-md",
                                  isDark ? "text-gray-400" : "text-gray-500"
                                )}>
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge className={getSeverityBadgeClass(item.severity, isDark)}>
                              {item.severity}
                            </Badge>
                          </td>
                          <td className="py-4 px-4">
                            <div>
                              <div className={cn(
                                "text-xs",
                                isDark ? "text-gray-300" : "text-gray-600"
                              )}>
                                {item.rssFeed.name}
                              </div>
                              <div className={cn(
                                "text-xs",
                                isDark ? "text-gray-400" : "text-gray-500"
                              )}>
                                {item.rssFeed.category}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              "text-responsive-sm",
                              isDark ? "text-gray-400" : "text-gray-500"
                            )}>
                              {fmt(item.pubDate)}
                            </span>
                          </td>
                          <td className="py-4 pl-4">
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(item.id, !item.read);
                                }}
                                size="sm"
                                variant="ghost"
                                className={cn(
                                  "text-xs",
                                  item.read ? "text-gray-400" : "text-primary"
                                )}
                              >
                                {item.read ? 'Mark Unread' : 'Mark Read'}
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(item.link, '_blank');
                                }}
                                size="sm"
                                variant="ghost"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {filteredAndSortedItems.length === 0 && !loading && (
                    <div className={cn(
                      "text-center py-12",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>
                      No RSS items found with current filters
                    </div>
                  )}
                  
                  {loading && (
                    <div className={cn(
                      "text-center py-12",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>
                      Loading RSS items...
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Add Feed Modal */}
        {showAddFeed && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowAddFeed(false)} />
            <div className={cn(
              "absolute left-1/2 top-1/2 w-96 -translate-x-1/2 -translate-y-1/2 shadow-xl rounded-lg",
              isDark ? "bg-gray-800" : "bg-white"
            )}>
              <div className="p-6">
                <h3 className={cn(
                  "text-lg font-semibold mb-4",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  Add RSS Feed
                </h3>
                <div className="space-y-4">
                  <Input
                    placeholder="Feed Name"
                    value={newFeed.name}
                    onChange={(e) => setNewFeed(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Input
                    placeholder="RSS URL"
                    value={newFeed.url}
                    onChange={(e) => setNewFeed(prev => ({ ...prev, url: e.target.value }))}
                  />
                  <Input
                    placeholder="Category"
                    value={newFeed.category}
                    onChange={(e) => setNewFeed(prev => ({ ...prev, category: e.target.value }))}
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <Button onClick={addFeed} className="flex-1">
                    Add Feed
                  </Button>
                  <Button onClick={() => setShowAddFeed(false)} variant="outline">
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Item Detail Sidebar */}
        {sidebarOpen && selectedItem && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)} />
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
                    Article Details
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Title */}
                  <div>
                    <h4 className={cn(
                      "font-medium mb-2",
                      isDark ? "text-white" : "text-gray-900"
                    )}>
                      {selectedItem.title}
                    </h4>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className={getSeverityBadgeClass(selectedItem.severity, isDark)}>
                        {selectedItem.severity}
                      </Badge>
                      {selectedItem.bookmarked && (
                        <Badge className="bg-yellow-500 text-white">
                          Bookmarked
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Feed Info */}
                  <div>
                    <label className={cn(
                      "text-sm font-medium mb-2 block",
                      isDark ? "text-gray-300" : "text-gray-700"
                    )}>
                      Source
                    </label>
                    <div className={cn(
                      "p-3 rounded-md text-sm",
                      isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                    )}>
                      {selectedItem.rssFeed.name} - {selectedItem.rssFeed.category}
                    </div>
                  </div>

                  {/* Description */}
                  {selectedItem.description && (
                    <div>
                      <label className={cn(
                        "text-sm font-medium mb-2 block",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}>
                        Description
                      </label>
                      <div className={cn(
                        "p-3 rounded-md text-sm whitespace-pre-wrap",
                        isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                      )}>
                        {selectedItem.description}
                      </div>
                    </div>
                  )}

                  {/* Author */}
                  {selectedItem.author && (
                    <div>
                      <label className={cn(
                        "text-sm font-medium mb-2 block",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}>
                        Author
                      </label>
                      <div className={cn(
                        "p-3 rounded-md text-sm",
                        isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                      )}>
                        {selectedItem.author}
                      </div>
                    </div>
                  )}

                  {/* CVE Information */}
                  {selectedItem.cves && selectedItem.cves !== 'null' && selectedItem.cves !== null && JSON.parse(selectedItem.cves).length > 0 && (
                    <div>
                      <label className={cn(
                        "text-sm font-medium mb-2 block",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}>
                        CVE IDs
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {JSON.parse(selectedItem.cves || '[]').map((cve: string, index: number) => (
                          <Badge key={index} className="bg-red-100 text-red-800 border-red-200 text-xs">
                            <a
                              href={`https://cve.mitre.org/cgi-bin/cvename.cgi?name=${cve}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {cve}
                            </a>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CVSS Score */}
                  {selectedItem.cvssScore && (
                    <div>
                      <label className={cn(
                        "text-sm font-medium mb-2 block",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}>
                        CVSS Score
                      </label>
                      <div className={cn(
                        "p-3 rounded-md text-sm flex items-center justify-between",
                        isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                      )}>
                        <span className="font-mono text-lg">{selectedItem.cvssScore}</span>
                        <Badge 
                          className={cn(
                            "ml-2",
                            selectedItem.cvssScore >= 9.0 ? "bg-red-500 text-white" :
                            selectedItem.cvssScore >= 7.0 ? "bg-orange-500 text-white" :
                            selectedItem.cvssScore >= 4.0 ? "bg-yellow-500 text-black" :
                            "bg-green-500 text-white"
                          )}
                        >
                          {selectedItem.cvssScore >= 9.0 ? "Critical" :
                           selectedItem.cvssScore >= 7.0 ? "High" :
                           selectedItem.cvssScore >= 4.0 ? "Medium" : "Low"}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Affected Products */}
                  {selectedItem.affectedProducts && selectedItem.affectedProducts !== 'null' && JSON.parse(selectedItem.affectedProducts).length > 0 && (
                    <div>
                      <label className={cn(
                        "text-sm font-medium mb-2 block",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}>
                        Affected Products/Applications
                      </label>
                      <div className={cn(
                        "p-3 rounded-md text-sm",
                        isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                      )}>
                        <div className="flex flex-wrap gap-1">
                          {JSON.parse(selectedItem.affectedProducts || '[]').map((product: string, index: number) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {product}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {selectedItem.tags && JSON.parse(selectedItem.tags || '[]').length > 0 && (
                    <div>
                      <label className={cn(
                        "text-sm font-medium mb-2 block",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}>
                        Security Tags
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {JSON.parse(selectedItem.tags || '[]').map((tag: string, index: number) => (
                          <Badge 
                            key={index} 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              tag === 'Zero-Day' || tag === 'APT' || tag === 'Ransomware' ? "border-red-500 text-red-500" :
                              tag === 'CVE' || tag === 'CVSS' || tag === 'Exploit' ? "border-orange-500 text-orange-500" :
                              tag === 'Patch' || tag === 'Disclosure' ? "border-primary text-primary" :
                              ""
                            )}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Content */}
                  {selectedItem.content && (
                    <div>
                      <label className={cn(
                        "text-sm font-medium mb-2 block",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}>
                        Full Content
                      </label>
                      <div className={cn(
                        "p-3 rounded-md text-sm max-h-48 overflow-y-auto",
                        isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                      )}>
                        <div dangerouslySetInnerHTML={{ __html: selectedItem.content }} />
                      </div>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className={cn(
                        "text-sm font-medium mb-2 block",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}>
                        Published
                      </label>
                      <div className={cn(
                        "p-3 rounded-md text-sm",
                        isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                      )}>
                        {fmt(selectedItem.pubDate)}
                      </div>
                    </div>
                    
                    <div>
                      <label className={cn(
                        "text-sm font-medium mb-2 block",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}>
                        Added to System
                      </label>
                      <div className={cn(
                        "p-3 rounded-md text-sm",
                        isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                      )}>
                        {fmt(selectedItem.createdAt)}
                      </div>
                    </div>

                    <div>
                      <label className={cn(
                        "text-sm font-medium mb-2 block",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}>
                        Fetched At
                      </label>
                      <div className={cn(
                        "p-3 rounded-md text-sm",
                        isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                      )}>
                        {fmt(selectedItem.fetchedAt)}
                      </div>
                    </div>
                  </div>

                  {/* Vulnerability Analysis */}
                  <div>
                    <label className={cn(
                      "text-sm font-medium mb-2 block",
                      isDark ? "text-gray-300" : "text-gray-700"
                    )}>
                      Vulnerability Analysis
                    </label>
                    <div className={cn(
                      "p-3 rounded-md text-sm space-y-2",
                      isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                    )}>
                      <div className="flex justify-between">
                        <span>CVE Count:</span>
                        <span className="font-medium">
                          {selectedItem.cves && selectedItem.cves !== 'null' ? JSON.parse(selectedItem.cves).length : 0}
                        </span>
                      </div>
                      {selectedItem.cvssScore && (
                        <div className="flex justify-between">
                          <span>CVSS Score:</span>
                          <span className="font-mono font-medium">{selectedItem.cvssScore}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Affected Products:</span>
                        <span className="font-medium">
                          {selectedItem.affectedProducts && selectedItem.affectedProducts !== 'null' ? JSON.parse(selectedItem.affectedProducts).length : 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Security Tags:</span>
                        <span className="font-medium">
                          {selectedItem.tags ? JSON.parse(selectedItem.tags || '[]').length : 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Risk Level:</span>
                        <Badge 
                          className={cn(
                            "ml-2",
                            selectedItem.severity === 'CRITICAL' ? "bg-red-500 text-white" :
                            selectedItem.severity === 'HIGH' ? "bg-orange-500 text-white" :
                            selectedItem.severity === 'MEDIUM' ? "bg-yellow-500 text-black" :
                            selectedItem.severity === 'LOW' ? "bg-green-500 text-white" :
                            "bg-gray-500 text-white"
                          )}
                        >
                          {selectedItem.severity}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Article Statistics */}
                  <div>
                    <label className={cn(
                      "text-sm font-medium mb-2 block",
                      isDark ? "text-gray-300" : "text-gray-700"
                    )}>
                      Article Information
                    </label>
                    <div className={cn(
                      "p-3 rounded-md text-sm space-y-2",
                      isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"
                    )}>
                      <div className="flex justify-between">
                        <span>Read Status:</span>
                        <span className={selectedItem.read ? "text-green-500" : "text-primary"}>
                          {selectedItem.read ? "Read" : "Unread"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bookmarked:</span>
                        <span className={selectedItem.bookmarked ? "text-yellow-500" : "text-gray-400"}>
                          {selectedItem.bookmarked ? "Yes" : "No"}
                        </span>
                      </div>
                      {selectedItem.description && (
                        <div className="flex justify-between">
                          <span>Description Length:</span>
                          <span>{selectedItem.description.length} chars</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Title Length:</span>
                        <span>{selectedItem.title.length} chars</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className={cn(
                  "border-t p-4 space-y-3",
                  isDark ? "border-gray-700" : "border-gray-200"
                )}>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => markAsRead(selectedItem.id, !selectedItem.read)}
                      variant="outline"
                      className="flex-1"
                    >
                      {selectedItem.read ? 'Mark Unread' : 'Mark Read'}
                    </Button>
                    <Button 
                      onClick={() => toggleBookmark(selectedItem.id, selectedItem.bookmarked)}
                      variant="outline"
                      className="flex-1"
                    >
                      {selectedItem.bookmarked ? 'Remove Bookmark' : 'Bookmark'}
                    </Button>
                  </div>
                  <Button 
                    onClick={() => window.open(selectedItem.link, '_blank')}
                    className="w-full"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Original
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
