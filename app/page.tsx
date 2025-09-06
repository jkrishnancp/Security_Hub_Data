'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Shield, ArrowRight, BarChart, FileText, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSetup, setIsSetup] = useState<boolean | null>(null);

  // Check if system is set up (has any users)
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await fetch('/api/onboarding/status');
        if (response.ok) {
          const { isSetup } = await response.json();
          setIsSetup(isSetup);
        }
      } catch (error) {
        console.error('Error checking setup status:', error);
        setIsSetup(false); // Assume not set up on error
      }
    };

    // Only check setup status if user is not logged in
    if (status !== 'loading' && !session) {
      checkSetupStatus();
    }
  }, [status, session]);

  if (status === 'loading' || (isSetup === null && !session)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 animate-pulse mx-auto mb-4 text-primary" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is logged in, show the dashboard home page
  if (session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Section */}
          <div className="text-center mb-12">
            <div className="flex justify-center items-center mb-6">
              <Shield className="h-16 w-16 text-primary mr-4" />
              <div>
                <h1 className="text-4xl font-bold text-gray-900">Security DataHub</h1>
                <p className="text-lg text-gray-600 mt-2">
                  Welcome back, {session.user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Work in Progress Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-yellow-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-800">Work in Progress</h3>
                <p className="text-yellow-700 mt-1">
                  The Security DataHub is currently under active development. New features and improvements are being added regularly.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Quick Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <a href="/open-items" className="block p-6 bg-primary/10 border-2 border-primary/30 rounded-lg hover:bg-primary/15 transition-colors">
              <div className="flex items-center mb-3">
                <FileText className="h-6 w-6 text-primary mr-3" />
                <h3 className="text-lg font-semibold text-primary">Open Items</h3>
              </div>
              <p className="text-sm text-primary opacity-80">Track and manage current work items and tasks</p>
            </a>

            <a href="/issues" className="block p-6 bg-red-50 border-2 border-red-200 rounded-lg hover:bg-red-100 transition-colors">
              <div className="flex items-center mb-3">
                <Shield className="h-6 w-6 text-red-600 mr-3" />
                <h3 className="text-lg font-semibold text-red-800">Threat Advisories</h3>
              </div>
              <p className="text-sm text-red-700 opacity-80">Monitor security threats and advisories</p>
            </a>

            <a href="/scorecard" className="block p-6 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition-colors">
              <div className="flex items-center mb-3">
                <BarChart className="h-6 w-6 text-green-600 mr-3" />
                <h3 className="text-lg font-semibold text-green-800">Security Scorecard</h3>
              </div>
              <p className="text-sm text-green-700 opacity-80">View security posture and metrics</p>
            </a>

            <a href="/dashboard" className="block p-6 bg-primary/10 border-2 border-primary/30 rounded-lg hover:bg-primary/15 transition-colors">
              <div className="flex items-center mb-3">
                <BarChart className="h-6 w-6 text-primary mr-3" />
                <h3 className="text-lg font-semibold text-primary">Analytics Dashboard</h3>
              </div>
              <p className="text-sm text-primary opacity-80">Security metrics and reporting</p>
            </a>

            <a href="/admin/activity" className="block p-6 bg-purple-50 border-2 border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
              <div className="flex items-center mb-3">
                <Users className="h-6 w-6 text-purple-600 mr-3" />
                <h3 className="text-lg font-semibold text-purple-800">Admin Activity</h3>
              </div>
              <p className="text-sm text-purple-700 opacity-80">User management and system administration</p>
            </a>

            <a href="/detections" className="block p-6 bg-cyan-50 border-2 border-cyan-200 rounded-lg hover:bg-cyan-100 transition-colors">
              <div className="flex items-center mb-3">
                <Shield className="h-6 w-6 text-cyan-600 mr-3" />
                <h3 className="text-lg font-semibold text-cyan-800">Detections</h3>
              </div>
              <p className="text-sm text-cyan-700 opacity-80">Review security detections and alerts</p>
            </a>
          </div>

          {/* Status Section */}
          <div className="text-center">
            <div className="bg-white rounded-lg shadow-sm border p-8">
              <BarChart className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">System Status</h3>
              <p className="text-gray-600">All security monitoring systems are operational</p>
              <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                All Systems Operational
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
              <Shield className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Security DataHub + Scorecard
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Comprehensive security posture management with automated data ingestion, 
            real-time scoring, and detailed analytics for enterprise security teams.
          </p>
          <div className="flex justify-center space-x-4">
            <Button 
              size="lg" 
              onClick={() => router.push(isSetup ? '/auth/login' : '/onboarding')}
              className="flex items-center space-x-2"
            >
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-8 text-center">
              <BarChart className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-3">Real-time Scorecard</h3>
              <p className="text-gray-600">
                Automated security scoring with weighted categories, trend analysis, 
                and drill-down capabilities into specific issues.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-3">Multi-format Ingestion</h3>
              <p className="text-gray-600">
                Support for CSV, XLSX, PDF, and TXT files from multiple security tools 
                including Falcon, Secureworks, and AWS Security Hub.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-3">Role-based Access</h3>
              <p className="text-gray-600">
                Comprehensive RBAC with Admin, Analyst, Viewer, and BU Lead roles, 
                each with appropriate data access and functionality.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Data Sources */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Supported Data Sources</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="p-4">
              <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <FileText className="h-8 w-8 text-red-600" />
              </div>
              <p className="font-medium">Vulnerabilities</p>
              <p className="text-sm text-gray-500">CVE tracking & SLA</p>
            </div>
            <div className="p-4">
              <div className="w-16 h-16 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Shield className="h-8 w-8 text-orange-600" />
              </div>
              <p className="font-medium">Falcon Detections</p>
              <p className="text-sm text-gray-500">EDR alerts & tactics</p>
            </div>
            <div className="p-4">
              <div className="w-16 h-16 bg-primary/15 rounded-lg flex items-center justify-center mx-auto mb-3">
                <BarChart className="h-8 w-8 text-primary" />
              </div>
              <p className="font-medium">AWS Security Hub</p>
              <p className="text-sm text-gray-500">Cloud compliance</p>
            </div>
            <div className="p-4">
              <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <p className="font-medium">Phishing Reports</p>
              <p className="text-sm text-gray-500">Jira-tracked incidents</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to enhance your security posture?</h2>
          <p className="text-gray-600 mb-8">
            Join security teams using our platform to gain comprehensive visibility 
            and actionable insights into their security landscape.
          </p>
          <Button 
            size="lg" 
            onClick={() => router.push(isSetup ? '/auth/login' : '/onboarding')}
            className="flex items-center space-x-2 mx-auto"
          >
            <span>Start Your Security Journey</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
