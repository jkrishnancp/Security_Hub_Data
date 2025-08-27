'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/components/theme-provider';
import AuthGuard from '@/lib/auth-guard';
import NavBar from '@/components/nav-bar';
import ScorecardBadge from '@/components/scorecard-badge';
import RadarChart from '@/components/radar-chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Download, 
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
  Bug
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { METALLIC_COLORS } from '@/lib/theme-config';
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
  }>;
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
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


  const exportScorecard = async () => {
    // This would implement PDF/CSV export functionality
    console.log('Exporting scorecard...');
  };

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
        <NavBar />
        
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
              <Button onClick={exportScorecard}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
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
                    Open Issues ({filteredIssues.length})
                  </CardTitle>
                  <CardDescription>
                    Security issues currently impacting your scorecard rating
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
                  </div>

                  {/* Issues List */}
                  <div className="space-y-4">
                    {filteredIssues.length > 0 ? (
                      filteredIssues.map((issue) => (
                        <div 
                          key={issue.id} 
                          className={cn(
                            "p-4 rounded-lg border cursor-pointer transition-colors",
                            isDark 
                              ? "bg-gray-800 border-gray-700 hover:bg-gray-700" 
                              : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                          )}
                          onClick={() => {
                            setSelectedIssue(issue);
                            setDetailPanelOpen(true);
                          }}
                          data-issue-card
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <Badge className={getSeverityColor(issue.severity)}>
                                  {issue.severity}
                                </Badge>
                                <Badge variant="outline">
                                  {issue.category}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {issue.businessUnit}
                                </Badge>
                              </div>
                              <p className={cn(
                                "text-sm mb-2",
                                isDark ? "text-white" : "text-gray-900"
                              )}>{issue.description}</p>
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
                                Score Impact
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