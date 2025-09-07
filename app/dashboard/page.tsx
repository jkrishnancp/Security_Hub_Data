'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import AuthGuard from '@/lib/auth-guard';
import ScorecardBadge from '@/components/scorecard-badge';
import RadarChart from '@/components/radar-chart';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Shield, 
  Eye, 
  FileText,
  RefreshCw,
  Rss,
  ExternalLink
} from 'lucide-react';

interface ScorecardData {
  overallScore: number;
  letterGrade: string;
  categories: Array<{
    name: string;
    score: number;
    weight: number;
    issues: number;
  }>;
  topIssues: Array<{
    id: string;
    description: string;
    severity: string;
    category: string;
    impactScore: number;
    asset: string;
  }>;
}

interface RssItem {
  id: string;
  title: string;
  description?: string;
  link: string;
  pubDate?: string;
  severity: string;
  read: boolean;
  rssFeed: {
    name: string;
    category: string;
  };
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [rssItems, setRssItems] = useState<RssItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const fetchScorecard = async () => {
    try {
      const response = await fetch('/api/scorecard');
      if (response.ok) {
        const data = await response.json();
        setScorecard(data);
      }
    } catch (error) {
      console.error('Failed to fetch scorecard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRssItems = async () => {
    try {
      const response = await fetch('/api/rss-items?limit=5');
      if (response.ok) {
        const data = await response.json();
        setRssItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch RSS items:', error);
    }
  };

  const refreshScorecard = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/scorecard', { method: 'POST' });
      if (response.ok) {
        await fetchScorecard();
      }
    } catch (error) {
      console.error('Failed to refresh scorecard:', error);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchScorecard();
    fetchRssItems();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Memoize expensive computations
  const { availableSeverities, availableCategories, filteredRssItems } = useMemo(() => {
    const severities = new Set<string>();
    const categories = new Set<string>();
    
    const filtered = rssItems.filter(item => {
      severities.add(item.severity);
      categories.add(item.rssFeed.category);
      
      const severityMatch = selectedSeverities.length === 0 || selectedSeverities.includes(item.severity);
      const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(item.rssFeed.category);
      return severityMatch && categoryMatch;
    });

    return {
      availableSeverities: Array.from(severities),
      availableCategories: Array.from(categories),
      filteredRssItems: filtered
    };
  }, [rssItems, selectedSeverities, selectedCategories]);

  if (loading) {
    return (
      <AuthGuard>
        <div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center min-h-96">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-gray-500">Loading dashboard...</p>
              </div>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Security Dashboard</h1>
              <p className="text-gray-500 mt-1">
                Welcome back, {session?.user.email} 
                {session?.user.businessUnit && (
                  <span className="ml-2 text-sm bg-primary/15 text-primary px-2 py-1 rounded">
                    {session.user.businessUnit}
                  </span>
                )}
              </p>
            </div>
            <Button 
              onClick={refreshScorecard} 
              disabled={refreshing}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>

          {scorecard && (
            <>
              {/* Overall Score Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-center">Overall Security Score</CardTitle>
                    <CardDescription className="text-center">
                      Current rating based on all security categories
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <ScorecardBadge 
                      score={scorecard.overallScore} 
                      letterGrade={scorecard.letterGrade} 
                      size="lg" 
                    />
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Security Categories</CardTitle>
                    <CardDescription>
                      Performance across different security domains
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <RadarChart categories={scorecard.categories} className="h-full" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Category Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-8">
                {scorecard.categories.map((category) => (
                  <Card key={category.name} className="relative">
                    <CardHeader className="pb-2 px-4 pt-4">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span className="truncate pr-2">{category.name}</span>
                        <ScorecardBadge 
                          score={category.score} 
                          letterGrade={category.score >= 90 ? 'A' : category.score >= 80 ? 'B' : category.score >= 70 ? 'C' : category.score >= 60 ? 'D' : 'F'} 
                          size="sm" 
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-1 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Current Score</span>
                        <span className="font-semibold text-lg">{Math.round(category.score)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Open Issues</span>
                        <Badge variant={category.issues > 0 ? 'destructive' : 'secondary'} className="text-xs px-2 py-0">
                          {category.issues}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Weight</span>
                        <span className="text-xs font-medium">{category.weight}x</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Top Issues */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                    Top Issues Impacting Score
                  </CardTitle>
                  <CardDescription>
                    Critical issues that need immediate attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {scorecard.topIssues.length > 0 ? (
                    <div className="space-y-4">
                      {scorecard.topIssues.slice(0, 5).map((issue) => (
                        <div key={issue.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <Badge className={getSeverityColor(issue.severity)}>
                                {issue.severity}
                              </Badge>
                              <Badge variant="outline">
                                {issue.category}
                              </Badge>
                            </div>
                            <p className="mb-2 text-sm text-gray-900">{issue.description}</p>
                            <div className="text-xs text-gray-600">
                              <span className="font-medium">Asset: </span>
                              <span className="font-mono bg-gray-200 px-1 py-0.5 rounded text-xs">
                                {issue.asset}
                              </span>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              Impact: {Math.round(issue.impactScore * 10) / 10}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No critical issues found. Great work!</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <AlertTriangle className="h-8 w-8 text-red-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">Critical Issues</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {scorecard.topIssues.filter(i => i.severity === 'CRITICAL').length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <Eye className="h-8 w-8 text-orange-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">High Priority</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {scorecard.topIssues.filter(i => i.severity === 'HIGH').length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <FileText className="h-8 w-8 text-primary" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">Total Issues</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {scorecard.topIssues.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center">
                      <Shield className="h-8 w-8 text-green-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">Categories</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {scorecard.categories.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* RSS Feed Widget */}
              <Card className="mt-8">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Rss className="h-5 w-5 mr-2 text-orange-500" />
                      Latest Security News
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open('/rss-feeds', '_blank')}
                    >
                      View All
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    Recent updates from your RSS security feeds
                  </CardDescription>
                  {rssItems.length > 0 && (
                    <div className="flex gap-4 mt-4">
                      <div className="flex-1">
                        <MultiSelectFilter
                          label="Severity"
                          options={availableSeverities}
                          selectedValues={selectedSeverities}
                          onSelectionChange={setSelectedSeverities}
                          isDark={false}
                          placeholder="All severities"
                        />
                      </div>
                      <div className="flex-1">
                        <MultiSelectFilter
                          label="Category"
                          options={availableCategories}
                          selectedValues={selectedCategories}
                          onSelectionChange={setSelectedCategories}
                          isDark={false}
                          placeholder="All categories"
                        />
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {rssItems.length > 0 ? (
                    filteredRssItems.length > 0 ? (
                      <div className="space-y-4">
                        {filteredRssItems.slice(0, 5).map((item) => (
                        <div key={item.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge className={getSeverityColor(item.severity)}>
                                {item.severity}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {item.rssFeed.category}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {item.rssFeed.name}
                              </span>
                              {!item.read && (
                                <div className="w-2 h-2 bg-primary rounded-full"></div>
                              )}
                            </div>
                            <h4 className="font-medium text-gray-900 mb-1 line-clamp-2">
                              {item.title}
                            </h4>
                            {item.description && (
                              <p className="text-sm text-gray-600 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                            <div className="mt-2 text-xs text-gray-500">
                              {item.pubDate ? new Date(item.pubDate).toLocaleDateString() : 'No date'}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(item.link, '_blank')}
                            className="ml-4 flex-shrink-0"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        <Rss className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No RSS items match the selected filters.</p>
                        <p className="text-sm mt-2">Try adjusting your severity or category filters.</p>
                      </div>
                    )
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <Rss className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No RSS feeds configured yet.</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => window.open('/rss-feeds', '_blank')}
                      >
                        Configure RSS Feeds
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
