'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import AuthGuard from '@/lib/auth-guard';
import NavBar from '@/components/nav-bar';
import ScorecardBadge from '@/components/scorecard-badge';
import RadarChart from '@/components/radar-chart';
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
  RefreshCw
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
  }>;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  if (loading) {
    return (
      <AuthGuard>
        <div>
          <NavBar />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center min-h-96">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
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
        <NavBar />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Security Dashboard</h1>
              <p className="text-gray-500 mt-1">
                Welcome back, {session?.user.email} 
                {session?.user.businessUnit && (
                  <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {scorecard.categories.map((category) => (
                  <Card key={category.name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center justify-between">
                        {category.name}
                        <ScorecardBadge 
                          score={category.score} 
                          letterGrade={category.score >= 90 ? 'A' : category.score >= 80 ? 'B' : category.score >= 70 ? 'C' : category.score >= 60 ? 'D' : 'F'} 
                          size="sm" 
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-500">Score</span>
                        <span className="font-medium">{Math.round(category.score)}%</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-500">Open Issues</span>
                        <Badge variant={category.issues > 0 ? 'destructive' : 'secondary'}>
                          {category.issues}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Weight</span>
                        <span className="text-sm font-medium">{category.weight}x</span>
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
                        <div key={issue.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <Badge className={getSeverityColor(issue.severity)}>
                                {issue.severity}
                              </Badge>
                              <Badge variant="outline">
                                {issue.category}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm text-gray-900">{issue.description}</p>
                          </div>
                          <div className="text-right">
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
                      <FileText className="h-8 w-8 text-blue-500" />
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
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}