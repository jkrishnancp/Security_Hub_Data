"use client";

import React from 'react';
import { useTheme } from '@/components/theme-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function ToolMetricsEndpointProtectionCrowdstrike() {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className={cn(isDark ? 'bg-gray-800 border-gray-700' : 'bg-white')}>
        <CardHeader>
          <CardTitle className={cn(isDark ? 'text-white' : 'text-gray-900')}>
            TOOL METRICS – END POINT PROTECTION (CROWDSTRIKE)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn(isDark ? 'text-gray-300' : 'text-gray-600')}>
            Placeholder page scaffolded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
