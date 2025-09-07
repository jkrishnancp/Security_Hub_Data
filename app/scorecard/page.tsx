'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/components/theme-provider';
import AuthGuard from '@/lib/auth-guard';
import ScorecardBadge from '@/components/scorecard-badge';
import RadarChart from '@/components/radar-chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Upload,
  Filter, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  AlertTriangle,
  Clock,
  Calendar,
  ArrowUp,
  ArrowDown,
  Minus,
  X,
  Globe,
  Server,
  Shield,
  Bug,
  ChevronDown,
  ChevronRight,
  FileText,
  CheckCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { METALLIC_COLORS, getSeverityBadgeClass } from '@/lib/theme-config';
import DetailPanel from '@/components/detail-panel';

interface ScorecardData {
  overallScore: number;
  letterGrade: string;
  categories: Array<{
    name: string;
    score: number;
    weight: number;
    issues: number;
    trend?: {
      change: number;
      direction: 'up' | 'down' | 'none';
    };
  }>;
  topIssues: Array<{
    id: string;
    description: string;
    severity: string;
    category: string;
    businessUnit: string;
    openedDate: string;
    impactScore: number;
    asset: string;
    count: number;
    groupedIssues?: Array<{
      id: string;
      description: string;
      severity: string;
      impactScore: number;
      openedDate: string;
    }>;
  }>;
  totalIssueCount: number;
  numberOfIpAddressesScanned?: number;
  numberOfDomainNamesScanned?: number;
  selectedDate?: Date;
  availableDates?: Date[];
  hasPreviousData?: boolean;
}

export default function ScorecardPage() {
  const { data: session } = useSession();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('latest');
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<Array<{ filename: string; success: boolean; message: string; type?: string; rowsProcessed?: number }>>([]);
  const [sortBy, setSortBy] = useState<string>('SEVERITY'); // Default: severity

  const fetchScorecard = async (date?: string) => {
    try {
      const url = date ? `/api/scorecard?date=${encodeURIComponent(date)}` : '/api/scorecard';
      console.log('🔍 Fetching scorecard from:', url);
      const response = await fetch(url);
      console.log('📡 Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Scorecard data received:', data);
        setScorecard(data);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ API Error:', response.status, errorData);
        // Show a temporary fallback or error state
        setScorecard(null);
      }
    } catch (error) {
      console.error('❌ Network error fetching scorecard:', error);
      setScorecard(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setLoading(true);
    fetchScorecard(date === 'latest' ? undefined : date);
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <ArrowUp className={cn(
          "h-4 w-4",
          isDark ? "text-green-400" : "text-green-600"
        )} />;
      case 'down':
        return <ArrowDown className={cn(
          "h-4 w-4",
          isDark ? "text-red-400" : "text-red-600"
        )} />;
      default:
        return <Minus className={cn(
          "h-4 w-4",
          isDark ? "text-gray-500" : "text-gray-400"
        )} />;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'up':
        return isDark ? 'text-green-400' : 'text-green-600';
      case 'down':
        return isDark ? 'text-red-400' : 'text-red-600';
      default:
        return isDark ? 'text-gray-500' : 'text-gray-400';
    }
  };

  useEffect(() => {
    fetchScorecard();
  }, []);


  const filteredIssues = scorecard?.topIssues.filter(issue => {
    const matchesSeverity = filterSeverity === 'ALL' || !filterSeverity || issue.severity === filterSeverity;
    const matchesCategory = filterCategory === 'ALL' || !filterCategory || issue.category === filterCategory;
    const matchesSearch = !searchTerm || issue.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSeverity && matchesCategory && matchesSearch;
  }) || [];

  const severityRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const sortedIssues = [...filteredIssues].sort((a, b) => {
    switch (sortBy) {
      case 'SEVERITY': {
        const rA = severityRank[a.severity] || 0;
        const rB = severityRank[b.severity] || 0;
        if (rA !== rB) return rB - rA; // higher severity first
        // tie-breaker: higher impact first
        if (a.impactScore !== b.impactScore) return (b.impactScore || 0) - (a.impactScore || 0);
        return new Date(b.openedDate).getTime() - new Date(a.openedDate).getTime();
      }
      case 'IMPACT':
        return (b.impactScore || 0) - (a.impactScore || 0);
      case 'COUNT':
        return (b.count || 0) - (a.count || 0);
      case 'DATE':
        return new Date(b.openedDate).getTime() - new Date(a.openedDate).getTime();
      default:
        return 0;
    }
  });

  const getSeverityBadge = (severity: string) => getSeverityBadgeClass(severity, isDark);


  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleFileUpload = async (file: File) => {
    if (!session?.user || (session.user as any).role !== 'ADMIN') {
      setUploadResults(prev => ([...prev, { filename: file.name, success: false, message: 'Admin access required for importing scorecard data.' }]));
      return;
    }

    setUploading(true);
    setUploadResults(prev => prev.filter(r => r.filename !== file.name));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok) {
        setUploadResults(prev => ([
          ...prev,
          {
            filename: file.name,
            success: true,
            message: 'Uploaded and processed successfully',
            type: result.type,
            rowsProcessed: result.rowsProcessed,
          }
        ]));
        
        // Refresh scorecard data
        await fetchScorecard();
      } else {
        setUploadResults(prev => ([...prev, { filename: file.name, success: false, message: result.error || 'Upload failed' }]));
      }
    } catch (error) {
      setUploadResults(prev => ([...prev, { filename: file.name, success: false, message: error instanceof Error ? error.message : 'Upload failed' }]));
    } finally {
      setUploading(false);
    }
  };

  const handleMultipleFilesUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setUploadResults(prev => ([...prev, { filename: file.name, success: false, message: 'Only CSV files are supported for this import.' }]));
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await handleFileUpload(file);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center min-h-96">
              <div className="text-center">
                <RefreshCw className={cn(
                  "h-8 w-8 animate-spin mx-auto mb-4",
                  "text-primary"
                )} />
                <p className={cn(
                  isDark ? "text-gray-400" : "text-gray-500"
                )}>Loading scorecard...</p>
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
        
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-8">
            <div className="flex-1">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className={cn(
                    "text-3xl font-bold",
                    isDark ? "text-white" : "text-gray-900"
                  )}>Security Scorecard</h1>
                  <p className={cn(
                    "mt-1",
                    isDark ? "text-gray-400" : "text-gray-500"
                  )}>
                    Comprehensive security posture assessment and trending
                  </p>
                </div>
            <div className="flex space-x-3 items-center">
              {scorecard?.availableDates && scorecard.availableDates.length > 1 && (
                <div className="flex items-center space-x-2">
                  <Calendar className={cn(
                    "h-4 w-4",
                    isDark ? "text-gray-400" : "text-gray-500"
                  )} />
                  <Select value={selectedDate} onValueChange={handleDateChange}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select date..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latest">Latest</SelectItem>
                      {scorecard.availableDates.map((date) => (
                        <SelectItem key={date.toString()} value={date.toString()}>
                          {new Date(date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={() => fetchScorecard(selectedDate === 'latest' ? undefined : selectedDate)} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {session?.user && (session.user as any).role === 'ADMIN' && (
                <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Data
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Import Scorecard Data</DialogTitle>
                      <DialogDescription>
                        Import two SecurityScorecard CSVs to update scores, spider charts, and issues.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                      {/* File Requirements */}
                      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                        <div className="flex items-start">
                          <Info className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="text-sm font-medium text-primary mb-2">Required Files</h4>
                            <p className="text-sm text-primary mb-3">
                              Import requires TWO separate CSV files for complete scorecard functionality:
                            </p>
                            
                            <div className="space-y-4">
                              {/* Scorecard Report File */}
                              <div className="bg-white rounded p-3 border border-primary/20">
                                <div className="flex items-center mb-2">
                                  <FileText className="h-4 w-4 text-primary mr-2" />
                                  <span className="font-medium text-primary">1. Scorecard Summary Report (Field,Value)</span>
                                </div>
                                <p className="text-sm text-primary mb-2">
                                  <strong>Filename:</strong> <code className="bg-primary/15 px-1 rounded">NETGEAR_Scorecard_Report_YYYYMMDD.csv</code>
                                </p>
                                <p className="text-sm text-primary">Contains overall scores and metrics powering the spider chart.</p>
                                <div className="mt-2 text-xs text-primary">
                                  <strong>Sample rows:</strong> Company,NETGEAR • Generated Date,August 24, 2025 • Generated By,Jane Doe • Threat Indicators Score,89 • Network Security Score,93 • DNS Health Score,100 • Patching Cadence Score,92 • Endpoint Security Score,100 • IP Reputation Score,100 • Application Security Score,81 • Cubit Score,100 • Hacker Chatter Score,100 • Information Leak Score,100 • Social Engineering Score,100 • Industry,Technology • Company Website,netgear.com • Findings on Open Ports,17 • Site Vulnerabilities,111 • Malware Discovered,0 • Leaked Information,0 • Number of IP address Scanned,1870 • Number of Domain names Scanned,162
                                </div>
                              </div>

                              {/* Full Issues Report File */}
                              <div className="bg-white rounded p-3 border border-primary/20">
                                <div className="flex items-center mb-2">
                                  <FileText className="h-4 w-4 text-primary mr-2" />
                                  <span className="font-medium text-primary">2. Full Issues Report</span>
                                </div>
                                <p className="text-sm text-primary mb-2">
                                  <strong>Filename:</strong> <code className="bg-primary/15 px-1 rounded">NETGEAR_FullIssues_Report_YYYYMMDD.csv</code>
                                </p>
                                <p className="text-sm text-primary">Contains detailed issues used to populate the Issues list and grouping.</p>
                                <div className="mt-2 text-xs text-primary">
                                  <strong>Key columns:</strong> ISSUE ID, FACTOR NAME, ISSUE TYPE TITLE, ISSUE TYPE CODE, ISSUE TYPE SEVERITY, ISSUE RECOMMENDATION, FIRST SEEN, LAST SEEN, IP ADDRESSES, HOSTNAME, SUBDOMAIN, TARGET, PORTS, STATUS, CVE, DESCRIPTION, TIME SINCE PUBLISHED, TIME OPEN SINCE PUBLISHED, COOKIE NAME, DATA, COMMON NAME, KEY LENGTH, USING RC4?, ISSUER ORGANIZATION NAME, PROVIDER, DETECTED SERVICE, PRODUCT, VERSION, PLATFORM, BROWSER, DESTINATION IPS, MALWARE FAMILY, MALWARE TYPE, DETECTION METHOD, LABEL, INITIAL URL, FINAL URL, REQUEST CHAIN, HEADERS, ANALYSIS, % OF SIMILAR COMPANIES WITH THE ISSUE, AVERAGE FINDINGS (similar companies), ISSUE TYPE SCORE IMPACT.
                                </div>
                                <p className="mt-2 text-xs text-primary">Tip: The system auto-detects file type by filename; order does not matter.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* File Upload Section */}
                      <div className="space-y-4">
                        <h4 className="font-medium">Upload Files</h4>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Upload className="h-8 w-8 mx-auto mb-4 text-gray-400" />
                          <p className="text-sm text-gray-600 mb-2">{uploading ? 'Processing...' : 'Drop files here or click to select up to 2 CSVs'}</p>
                          <input
                            type="file"
                            accept=".csv"
                            multiple
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleMultipleFilesUpload(e.target.files);
                              }
                            }}
                            disabled={uploading}
                            className="hidden"
                            id="scorecard-file-input"
                          />
                          <label
                            htmlFor="scorecard-file-input"
                            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 disabled:opacity-50"
                          >
                            Select CSV File(s)
                          </label>
                        </div>

                        {/* Upload Result */}
                        {uploadResults.length > 0 && (
                          <div className="space-y-2">
                            {uploadResults.map((res, idx) => (
                              <div key={`${res.filename}-${idx}`} className={`p-3 rounded-lg border ${res.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                <div className="flex items-center">
                                  {res.success ? (
                                    <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                  ) : (
                                    <X className="h-4 w-4 mr-2 text-red-600" />
                                  )}
                                  <span className={`text-sm ${res.success ? 'text-green-700' : 'text-red-700'}`}>
                                    {res.filename}: {res.message}
                                  </span>
                                </div>
                                {res.success && res.type && (
                                  <div className="mt-2 text-xs text-green-600">
                                    Detected: {res.type} {typeof res.rowsProcessed === 'number' ? `• Rows: ${res.rowsProcessed}` : ''}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
                </div>
              </div>

              {scorecard ? (
            <>
              {/* Scorecard Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-center">Overall Security Rating</CardTitle>
                    <CardDescription className="text-center">
                      Current threat indicators assessment
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center space-y-4">
                    <ScorecardBadge 
                      score={scorecard.overallScore} 
                      letterGrade={scorecard.letterGrade} 
                      size="lg" 
                    />
                    <div className="text-center">
                      <p className={cn(
                        "text-2xl font-bold",
                        isDark ? "text-white" : "text-gray-900"
                      )}>
                        {Math.round(scorecard.overallScore)}
                      </p>
                      <p className={cn(
                        "text-sm",
                        isDark ? "text-gray-400" : "text-gray-500"
                      )}>
                        Threat Indicators Score
                      </p>
                    </div>
                    
                    {/* Scan Coverage Stats */}
                    <div className={cn(
                      "w-full pt-4 border-t",
                      isDark ? "border-gray-700" : "border-gray-200"
                    )}>
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <p className={cn(
                            "text-lg font-semibold",
                            isDark ? "text-white" : "text-gray-900"
                          )}>
                            {scorecard.numberOfIpAddressesScanned || 0}
                          </p>
                          <p className={cn(
                            "text-xs",
                            isDark ? "text-gray-400" : "text-gray-500"
                          )}>
                            IP Addresses Scanned
                          </p>
                        </div>
                        <div>
                          <p className={cn(
                            "text-lg font-semibold",
                            isDark ? "text-white" : "text-gray-900"
                          )}>
                            {scorecard.numberOfDomainNamesScanned || 0}
                          </p>
                          <p className={cn(
                            "text-xs",
                            isDark ? "text-gray-400" : "text-gray-500"
                          )}>
                            Domain Names Scanned
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Category Breakdown</CardTitle>
                    <CardDescription>
                      Security performance across all domains
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <RadarChart categories={scorecard.categories} className="h-full" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Category Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {scorecard.categories.map((category) => (
                  <Card key={category.name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {category.name}
                          {scorecard.hasPreviousData && category.trend && (
                            <div className={`flex items-center space-x-1 ${getTrendColor(category.trend.direction)}`}>
                              {getTrendIcon(category.trend.direction)}
                              {category.trend.change > 0 && (
                                <span className="text-xs font-medium">
                                  {Math.round(category.trend.change)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <ScorecardBadge 
                          score={category.score} 
                          letterGrade={category.score >= 90 ? 'A' : category.score >= 80 ? 'B' : category.score >= 70 ? 'C' : category.score >= 60 ? 'D' : 'F'} 
                          size="sm" 
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className={cn(
                            "text-sm font-medium",
                            isDark ? "text-gray-400" : "text-gray-500"
                          )}>Current Score</span>
                          <span className={cn(
                            "text-lg font-bold",
                            isDark ? "text-white" : "text-gray-900"
                          )}>
                            {Math.round(category.score)}
                          </span>
                        </div>
                        
                        <div className={cn(
                          "w-full rounded-full h-2",
                          isDark ? "bg-gray-700" : "bg-gray-200"
                        )}>
                          <div 
                            className="h-2 rounded-full"
                            style={{ 
                              width: `${Math.min(category.score, 100)}%`,
                              backgroundColor: category.score >= 90 ? METALLIC_COLORS.low :
                                               category.score >= 80 ? METALLIC_COLORS.info :
                                               category.score >= 70 ? METALLIC_COLORS.medium :
                                               category.score >= 60 ? METALLIC_COLORS.high :
                                               METALLIC_COLORS.critical
                            }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-sm">
                          <span className={cn(
                            isDark ? "text-gray-400" : "text-gray-500"
                          )}>Open Issues</span>
                          <Badge 
                            variant={category.issues > 0 ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {category.issues}
                          </Badge>
                        </div>
                        
                        <div className="flex justify-between items-center text-sm">
                          <span className={cn(
                            isDark ? "text-gray-400" : "text-gray-500"
                          )}>Weight</span>
                          <span className={cn(
                            "font-medium",
                            isDark ? "text-gray-200" : "text-gray-900"
                          )}>{category.weight}x</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Issues Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertTriangle className={cn(
                      "h-5 w-5 mr-2",
                      isDark ? "text-orange-400" : "text-orange-500"
                    )} />
                    Open Issues ({scorecard.totalIssueCount})
                  </CardTitle>
                  <CardDescription>
                    Security issues currently impacting your scorecard rating
                    {filteredIssues.length !== scorecard.totalIssueCount && (
                      <span className={cn(
                        "ml-2 text-sm text-primary"
                      )}>
                        (Showing {filteredIssues.length} of {scorecard.totalIssueCount} total issues)
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="flex flex-wrap gap-4 mb-6">
                    <div className="flex items-center space-x-2">
                      <Filter className={cn(
                        "h-4 w-4",
                        isDark ? "text-gray-400" : "text-gray-500"
                      )} />
                      <span className="text-sm font-medium">Filters:</span>
                    </div>
                    
                    <Input
                      placeholder="Search issues..."
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
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="LOW">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Categories</SelectItem>
                        {scorecard.categories.map(cat => (
                          <SelectItem key={cat.name} value={cat.name}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SEVERITY">Severity (Critical → Low)</SelectItem>
                        <SelectItem value="IMPACT">Impact score (desc)</SelectItem>
                        <SelectItem value="COUNT">Total issues (desc)</SelectItem>
                        <SelectItem value="DATE">Opened date (newest)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Issues List */}
                  <div className="space-y-4">
                    {sortedIssues.length > 0 ? (
                      sortedIssues.map((issue) => (
                        <div key={issue.id} className="space-y-2">
                          <div 
                            className={cn(
                              "p-4 rounded-lg border transition-colors",
                              isDark 
                                ? "bg-gray-800 border-gray-700 hover:bg-gray-700" 
                                : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                            )}
                            data-issue-card
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                        <Badge className={getSeverityBadge(issue.severity)}>
                                          {issue.severity}
                                        </Badge>
                                  <Badge variant="outline">
                                    {issue.category}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {issue.businessUnit}
                                  </Badge>
                                  {issue.count > 1 && (
                                    <Badge variant="outline" className={cn(
                                      "text-xs",
                                      isDark ? "bg-primary/20 text-primary border-primary/30" : "bg-primary/15 text-primary border-primary/30"
                                    )}>
                                      {issue.count} issues
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-start space-x-2">
                                  {issue.count > 1 && issue.groupedIssues && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleGroupExpansion(issue.id);
                                      }}
                                      className={cn(
                                        "mt-0.5 p-0.5 rounded hover:bg-gray-200",
                                        isDark ? "hover:bg-gray-600" : "hover:bg-gray-200"
                                      )}
                                    >
                                      {expandedGroups.has(issue.id) ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </button>
                                  )}
                                  <div className="flex-1">
                                    <p 
                                      className={cn(
                                        "text-sm mb-2 cursor-pointer",
                                        isDark ? "text-white" : "text-gray-900"
                                      )}
                                      onClick={() => {
                                        setSelectedIssue(issue);
                                        setDetailPanelOpen(true);
                                      }}
                                    >{issue.description}</p>
                                  </div>
                                </div>
                                <div className={cn(
                                  "mb-2 text-xs",
                                  isDark ? "text-gray-400" : "text-gray-600"
                                )}>
                                  <span className="font-medium">Asset: </span>
                                  <span className={cn(
                                    "font-mono px-1.5 py-0.5 rounded text-xs",
                                    isDark ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-800"
                                  )}>
                                    {issue.asset}
                                  </span>
                                </div>
                                <div className={cn(
                                  "flex items-center space-x-4 text-xs",
                                  isDark ? "text-gray-400" : "text-gray-500"
                                )}>
                                  <span>
                                    Opened: {new Date(issue.openedDate).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <div className={cn(
                                  "text-sm font-medium",
                                  isDark ? "text-white" : "text-gray-900"
                                )}>
                                  Impact: {Math.round(issue.impactScore * 10) / 10}
                                </div>
                                <div className={cn(
                                  "text-xs mt-1",
                                  isDark ? "text-gray-400" : "text-gray-500"
                                )}>
                                  {issue.count > 1 ? 'Total Impact' : 'Score Impact'}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Expanded grouped issues */}
                          {issue.count > 1 && issue.groupedIssues && expandedGroups.has(issue.id) && (
                            <div className={cn(
                              "ml-8 space-y-2 border-l-2 pl-4",
                              isDark ? "border-gray-700" : "border-gray-200"
                            )}>
                              {issue.groupedIssues.map((subIssue, index) => (
                                <div 
                                  key={subIssue.id}
                                  className={cn(
                                    "p-3 rounded border text-sm cursor-pointer transition-colors",
                                    isDark 
                                      ? "bg-gray-800 border-gray-700 hover:bg-gray-700" 
                                      : "bg-white border-gray-200 hover:bg-gray-50"
                                  )}
                                  onClick={() => {
                                    setSelectedIssue(subIssue);
                                    setDetailPanelOpen(true);
                                  }}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-1">
                                      <Badge className={getSeverityBadge(subIssue.severity)}>
                                        {subIssue.severity}
                                      </Badge>
                                      </div>
                                      <p className={cn(
                                        "mb-1",
                                        isDark ? "text-gray-200" : "text-gray-800"
                                      )}>
                                        {subIssue.description}
                                      </p>
                                      <div className={cn(
                                        "text-xs",
                                        isDark ? "text-gray-400" : "text-gray-500"
                                      )}>
                                        Opened: {new Date(subIssue.openedDate).toLocaleDateString()}
                                      </div>
                                    </div>
                                    <div className="text-right ml-4">
                                      <div className={cn(
                                        "text-xs font-medium",
                                        isDark ? "text-gray-200" : "text-gray-700"
                                      )}>
                                        {Math.round(subIssue.impactScore * 10) / 10}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
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
                          {scorecard.topIssues.length === 0 
                            ? 'No open issues found. Excellent work!'
                            : 'No issues match your current filters.'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12">
              <AlertTriangle className={cn(
                "h-12 w-12 mx-auto mb-4",
                isDark ? "text-orange-400" : "text-orange-500"
              )} />
              <h3 className={cn(
                "text-lg font-medium mb-2",
                isDark ? "text-white" : "text-gray-900"
              )}>No Scorecard Data Available</h3>
              <p className={cn(
                "mb-4",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                No SecurityScorecard data found. Please import a SecurityScorecard report or check the console for errors.
              </p>
              <Button onClick={() => fetchScorecard()} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          )}
            </div>
          </div>
        </div>
        
        <DetailPanel
          isOpen={detailPanelOpen}
          onClose={() => {
            setDetailPanelOpen(false);
            setSelectedIssue(null);
          }}
          data={selectedIssue}
          type="scorecard"
          title={selectedIssue ? `${selectedIssue.severity} - ${selectedIssue.category}` : 'Issue Details'}
        />
      </div>
    </AuthGuard>
  );
}
