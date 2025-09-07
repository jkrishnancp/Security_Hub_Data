"use client";

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ImportProgressProps {
  value: number; // 0-100
  label?: string;
  className?: string;
}

export default function ImportProgress({ value, label = 'Import Progress', className }: ImportProgressProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="w-56">
        <Progress value={pct} />
      </div>
      <div className="text-sm tabular-nums min-w-14">{pct}%</div>
      {label && <div className="text-xs text-muted-foreground">{label}</div>}
    </div>
  );
}

