'use client';

import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface CategoryScore {
  name: string;
  score: number;
  weight: number;
  issues: number;
}

interface RadarChartProps {
  categories: CategoryScore[];
  className?: string;
}

export default function RadarChart({ categories, className }: RadarChartProps) {
  const chartRef = useRef<ChartJS<'radar'>>(null);

  const data = {
    labels: categories.map(cat => cat.name),
    datasets: [
      {
        label: 'Current Score',
        data: categories.map(cat => cat.score),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(59, 130, 246)',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        min: 0,
        ticks: {
          stepSize: 20,
          callback: function(value: any) {
            return value + '%';
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        angleLines: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        pointLabels: {
          font: {
            size: 12,
          },
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const category = categories[context.dataIndex];
            return [
              `Score: ${Math.round(context.raw)}%`,
              `Open Issues: ${category.issues}`,
              `Weight: ${category.weight}x`,
            ];
          },
        },
      },
    },
  };

  return (
    <div className={className}>
      <Radar ref={chartRef} data={data} options={options} />
    </div>
  );
}