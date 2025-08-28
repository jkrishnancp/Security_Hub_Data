'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/components/theme-provider';
import AuthGuard from '@/lib/auth-guard';
import NavBar from '@/components/nav-bar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Download, 
  Filter, 
  RefreshCw,
  AlertTriangle,
  Calendar as CalendarIcon,
  Upload,
  BarChart3,
  TrendingUp,
  Shield,
  Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { METALLIC_COLORS } from '@/lib/theme-config';

// Chart colors using metallic theme
const CHART_COLORS = {
  Critical: METALLIC_COLORS.critical,
  High: METALLIC_COLORS.high,
  Medium: METALLIC_COLORS.medium,
  Low: METALLIC_COLORS.low
};

const NETGEAR_COLORS = {
  High: METALLIC_COLORS.high,
  Low: METALLIC_COLORS.low
};

interface ThreatAdvisory {
  id: string;
  threatAdvisoryName: string;
  severity: string;
  netgearSeverity: string;
  impacted: boolean;
  source: string;
  advisoryReleasedDate: string;
  notifiedDate: string;
  remarks: string;
  etaForFix: string;
}

interface ThreatAdvisoryStats {
  total: number;
  bySeverity: Record<string, number>;
  byNetgearSeverity: Record<string, number>;
  impactedCount: number;
}

export default function ThreatAdvisoriesPage() {
  const { data: session } = useSession();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const [threatAdvisories, setThreatAdvisories] = useState<ThreatAdvisory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterNetgearSeverity, setFilterNetgearSeverity] = useState('ALL');
  const [filterImpacted, setFilterImpacted] = useState('ALL');
  const [filterSource, setFilterSource] = useState('ALL');
  const [sortBy, setSortBy] = useState('notifiedDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Date filtering
  const [dateRange, setDateRange] = useState<{from: Date | undefined; to: Date | undefined}>({
    from: undefined,
    to: undefined
  });
  const [datePreset, setDatePreset] = useState('ALL');

  const [stats, setStats] = useState<ThreatAdvisoryStats>({
    total: 0,
    bySeverity: {},
    byNetgearSeverity: {},
    impactedCount: 0
  });

  // Load CSV data
  const loadThreatAdvisoryData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/threat-advisories');
      
      if (!response.ok) {
        throw new Error('Failed to fetch threat advisory data');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setThreatAdvisories(result.data);
        calculateStats(result.data);
      } else {
        console.error('Error from API:', result.error);
      }
    } catch (error) {
      console.error('Failed to load threat advisory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: ThreatAdvisory[]) => {
    const stats: ThreatAdvisoryStats = {
      total: data.length,
      bySeverity: {},
      byNetgearSeverity: {},
      impactedCount: data.filter(item => item.impacted).length
    };

    data.forEach(item => {
      stats.bySeverity[item.severity] = (stats.bySeverity[item.severity] || 0) + 1;
      stats.byNetgearSeverity[item.netgearSeverity] = (stats.byNetgearSeverity[item.netgearSeverity] || 0) + 1;
    });

    setStats(stats);
  };

  // Calculate filtered stats based on current filters
  const getFilteredStats = () => {
    const filteredStats: ThreatAdvisoryStats = {
      total: filteredAdvisories.length,
      bySeverity: {},
      byNetgearSeverity: {},
      impactedCount: filteredAdvisories.filter(item => item.impacted).length
    };

    filteredAdvisories.forEach(item => {
      filteredStats.bySeverity[item.severity] = (filteredStats.bySeverity[item.severity] || 0) + 1;
      filteredStats.byNetgearSeverity[item.netgearSeverity] = (filteredStats.byNetgearSeverity[item.netgearSeverity] || 0) + 1;
    });

    return filteredStats;
  };

  const handleDatePreset = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    
    switch (preset) {
      case 'LAST_7_DAYS':
        setDateRange({ from: subDays(today, 7), to: today });
        break;
      case 'LAST_15_DAYS':
        setDateRange({ from: subDays(today, 15), to: today });
        break;
      case 'LAST_21_DAYS':
        setDateRange({ from: subDays(today, 21), to: today });
        break;
      case 'LAST_30_DAYS':
        setDateRange({ from: subDays(today, 30), to: today });
        break;
      case 'LAST_45_DAYS':
        setDateRange({ from: subDays(today, 45), to: today });
        break;
      case 'LAST_60_DAYS':
        setDateRange({ from: subDays(today, 60), to: today });
        break;
      case 'LAST_90_DAYS':
        setDateRange({ from: subDays(today, 90), to: today });
        break;
      default:
        setDateRange({ from: undefined, to: undefined });
        break;
    }
  };

  const isDateInRange = (dateString: string) => {
    if (!dateRange.from || !dateRange.to) return true;
    
    const date = new Date(dateString);
    return date >= dateRange.from && date <= dateRange.to;
  };

  const filteredAdvisories = threatAdvisories.filter(advisory => {
    const matchesSearch = !searchTerm || 
      advisory.threatAdvisoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      advisory.remarks.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = filterSeverity === 'ALL' || advisory.severity === filterSeverity;
    const matchesNetgearSeverity = filterNetgearSeverity === 'ALL' || advisory.netgearSeverity === filterNetgearSeverity;
    const matchesImpacted = filterImpacted === 'ALL' || 
      (filterImpacted === 'YES' && advisory.impacted) || 
      (filterImpacted === 'NO' && !advisory.impacted);
    const matchesSource = filterSource === 'ALL' || advisory.source === filterSource;
    const matchesDateRange = isDateInRange(advisory.notifiedDate);

    return matchesSearch && matchesSeverity && matchesNetgearSeverity && matchesImpacted && matchesSource && matchesDateRange;
  }).sort((a, b) => {
    const aValue = a[sortBy as keyof ThreatAdvisory];
    const bValue = b[sortBy as keyof ThreatAdvisory];
    
    if (sortBy === 'notifiedDate' || sortBy === 'advisoryReleasedDate') {
      const aDate = new Date(aValue as string);
      const bDate = new Date(bValue as string);
      return sortOrder === 'desc' ? bDate.getTime() - aDate.getTime() : aDate.getTime() - bDate.getTime();
    }
    
    const comparison = String(aValue).localeCompare(String(bValue));
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL': return 'badge-critical';
      case 'HIGH': return 'badge-high';
      case 'MEDIUM': return 'badge-medium';
      case 'LOW': return 'badge-low';
      default: return cn(
        'px-2 py-1 rounded-md text-xs font-medium border',
        isDark ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-gray-100 text-gray-800 border-gray-200'
      );
    }
  };

  // Prepare chart data using filtered stats
  const getSeverityChartData = () => {
    const filteredStats = getFilteredStats();
    return Object.entries(filteredStats.bySeverity).map(([severity, count]) => ({
      name: severity,
      value: count,
      fill: CHART_COLORS[severity as keyof typeof CHART_COLORS] || '#6b7280'
    }));
  };

  const getNetgearSeverityChartData = () => {
    const filteredStats = getFilteredStats();
    return Object.entries(filteredStats.byNetgearSeverity).map(([severity, count]) => ({
      name: `Netgear ${severity}`,
      value: count,
      fill: NETGEAR_COLORS[severity as keyof typeof NETGEAR_COLORS] || '#6b7280'
    }));
  };

  const getImpactChartData = () => {
    const filteredStats = getFilteredStats();
    const impactedCount = filteredStats.impactedCount;
    const notImpactedCount = filteredStats.total - impactedCount;
    return [
      { name: 'Impacted', value: impactedCount, fill: METALLIC_COLORS.open },
      { name: 'Not Impacted', value: notImpactedCount, fill: METALLIC_COLORS.closed }
    ];
  };

  useEffect(() => {
    loadThreatAdvisoryData();
  }, []);

  if (loading) {
    return (
      <AuthGuard>
        <div>
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
                )}>Loading threat advisories...</p>
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
              )}>Threat Advisories</h1>
              <p className={cn(
                "mt-1",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                Monitor and track security threat advisories affecting your environment
              </p>
            </div>
            <div className="flex space-x-3">
              <Button onClick={loadThreatAdvisoryData} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Filters Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className={cn(
                  "h-5 w-5 mr-2",
                  isDark ? "text-blue-400" : "text-blue-500"
                )} />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Input
                  placeholder="Search advisories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
                
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterNetgearSeverity} onValueChange={setFilterNetgearSeverity}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Netgear Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterImpacted} onValueChange={setFilterImpacted}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Impacted" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="YES">Yes</SelectItem>
                    <SelectItem value="NO">No</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={datePreset} onValueChange={handleDatePreset}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Time</SelectItem>
                    <SelectItem value="LAST_7_DAYS">Last 7 Days</SelectItem>
                    <SelectItem value="LAST_15_DAYS">Last 15 Days</SelectItem>
                    <SelectItem value="LAST_21_DAYS">Last 21 Days</SelectItem>
                    <SelectItem value="LAST_30_DAYS">Last 30 Days</SelectItem>
                    <SelectItem value="LAST_45_DAYS">Last 45 Days</SelectItem>
                    <SelectItem value="LAST_60_DAYS">Last 60 Days</SelectItem>
                    <SelectItem value="LAST_90_DAYS">Last 90 Days</SelectItem>
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-64 justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange.from}
                      selected={dateRange}
                      onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className={cn(
                    "p-2 rounded-lg",
                    isDark ? "bg-blue-900/30" : "bg-blue-100"
                  )}>
                    <AlertTriangle className={cn(
                      "h-6 w-6",
                      isDark ? "text-blue-400" : "text-blue-600"
                    )} />
                  </div>
                  <div className="ml-4">
                    <p className={cn(
                      "text-sm font-medium",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>Total Advisories</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      isDark ? "text-white" : "text-gray-900"
                    )}>{getFilteredStats().total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className={cn(
                    "p-2 rounded-lg",
                    isDark ? "bg-red-900/30" : "bg-red-100"
                  )}>
                    <TrendingUp className={cn(
                      "h-6 w-6",
                      isDark ? "text-red-400" : "text-red-600"
                    )} />
                  </div>
                  <div className="ml-4">
                    <p className={cn(
                      "text-sm font-medium",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>Impacted Systems</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      isDark ? "text-white" : "text-gray-900"
                    )}>{getFilteredStats().impactedCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className={cn(
                    "p-2 rounded-lg",
                    isDark ? "bg-orange-900/30" : "bg-orange-100"
                  )}>
                    <Shield className={cn(
                      "h-6 w-6",
                      isDark ? "text-orange-400" : "text-orange-600"
                    )} />
                  </div>
                  <div className="ml-4">
                    <p className={cn(
                      "text-sm font-medium",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>Critical Severity</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      isDark ? "text-white" : "text-gray-900"
                    )}>{getFilteredStats().bySeverity['Critical'] || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className={cn(
                    "p-2 rounded-lg",
                    isDark ? "bg-green-900/30" : "bg-green-100"
                  )}>
                    <BarChart3 className={cn(
                      "h-6 w-6",
                      isDark ? "text-green-400" : "text-green-600"
                    )} />
                  </div>
                  <div className="ml-4">
                    <p className={cn(
                      "text-sm font-medium",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>High Netgear Severity</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      isDark ? "text-white" : "text-gray-900"
                    )}>{getFilteredStats().byNetgearSeverity['High'] || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Severity Distribution</CardTitle>
                <CardDescription>Threat advisories by severity level</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getSeverityChartData()}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {getSeverityChartData().map((entry, index) => (
                          <Cell key={`severity-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Netgear Severity</CardTitle>
                <CardDescription>Internal severity assessment breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getNetgearSeverityChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {getNetgearSeverityChartData().map((entry, index) => (
                          <Cell key={`netgear-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Impact Status</CardTitle>
                <CardDescription>Systems impacted vs not impacted</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getImpactChartData()}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, value, percent }) => 
                          `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                        }
                      >
                        {getImpactChartData().map((entry, index) => (
                          <Cell key={`impact-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Threat Advisories Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className={cn(
                  "h-5 w-5 mr-2",
                  isDark ? "text-orange-400" : "text-orange-500"
                )} />
                Threat Advisories ({filteredAdvisories.length})
              </CardTitle>
              <CardDescription>
                Security threat advisories with filtering and sorting capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Advisories List */}
              <div className="space-y-4">
                {filteredAdvisories.length > 0 ? (
                  filteredAdvisories.map((advisory) => (
                    <div 
                      key={advisory.id} 
                      className={cn(
                        "p-4 rounded-lg border transition-colors",
                        isDark 
                          ? "bg-gray-800 border-gray-700 hover:bg-gray-700" 
                          : "bg-white border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <Badge className={getSeverityColor(advisory.severity)}>
                              {advisory.severity}
                            </Badge>
                            <Badge variant="outline" className={getSeverityColor(advisory.netgearSeverity)}>
                              Netgear: {advisory.netgearSeverity}
                            </Badge>
                            <Badge variant={advisory.impacted ? "destructive" : "secondary"}>
                              {advisory.impacted ? "Impacted" : "Not Impacted"}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {advisory.source}
                            </Badge>
                          </div>
                          <h3 className={cn(
                            "text-sm font-medium mb-2",
                            isDark ? "text-white" : "text-gray-900"
                          )}>
                            {advisory.threatAdvisoryName}
                          </h3>
                          {advisory.remarks && (
                            <p className={cn(
                              "text-sm mb-2",
                              isDark ? "text-gray-300" : "text-gray-600"
                            )}>{advisory.remarks}</p>
                          )}
                          <div className={cn(
                            "flex items-center space-x-4 text-xs",
                            isDark ? "text-gray-400" : "text-gray-500"
                          )}>
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              Released: {new Date(advisory.advisoryReleasedDate).toLocaleDateString()}
                            </span>
                            <span>
                              Notified: {new Date(advisory.notifiedDate).toLocaleDateString()}
                            </span>
                            {advisory.etaForFix !== 'N/A' && (
                              <span>
                                ETA: {advisory.etaForFix}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <AlertTriangle className={cn(
                      "h-12 w-12 mx-auto mb-4",
                      isDark ? "text-gray-600" : "text-gray-300"
                    )} />
                    <p className={cn(
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>
                      {threatAdvisories.length === 0 
                        ? 'No threat advisories found.'
                        : 'No advisories match your current filters.'
                      }
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}