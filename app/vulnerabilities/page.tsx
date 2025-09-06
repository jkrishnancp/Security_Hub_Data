"use client";

import React from 'react';
import { useTheme } from '@/components/theme-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function VulnerabilitiesPage() {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-200",
      isDark ? "bg-gray-900" : "bg-gray-50"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className={cn(isDark ? 'bg-gray-800 border-gray-700' : 'bg-white')}>
          <CardHeader>
            <CardTitle className={cn(isDark ? 'text-white' : 'text-gray-900')}>Vulnerabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(isDark ? 'text-gray-300' : 'text-gray-600')}>
              This section will aggregate vulnerability data. Coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
