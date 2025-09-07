"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressPieProps {
  value: number; // 0-100
  size?: number; // px
  thickness?: number; // px for the inner cutout margin
  className?: string;
  showLabel?: boolean;
}

export default function ProgressPie({ value, size = 64, thickness = 10, className, showLabel = true }: ProgressPieProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const angle = pct * 3.6;
  const fg = 'hsl(var(--primary))';
  const bg = 'hsl(var(--muted-foreground))';

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <div
        aria-label={`progress ${pct}%`}
        className="rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${fg} ${angle}deg, ${bg} 0deg)`,
        }}
      />
      <div
        className="absolute rounded-full bg-background flex items-center justify-center"
        style={{
          width: Math.max(0, size - thickness * 2),
          height: Math.max(0, size - thickness * 2),
        }}
      >
        {showLabel && (
          <span className="text-xs tabular-nums text-foreground">{pct}%</span>
        )}
      </div>
    </div>
  );
}

