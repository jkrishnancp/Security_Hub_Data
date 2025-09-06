"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Log = {
  id: string;
  filename: string;
  fileType: string | null;
  source: string | null;
  rowsProcessed: number;
  reportDate: string | null;
  importedDate: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
  errorLog?: string | null;
};

export default function ImportsAdminPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/ingestion-logs?limit=100');
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statusBadge = (s: Log['status']) => {
    const m: Record<Log['status'], string> = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      SUCCESS: 'bg-green-100 text-green-800 border-green-200',
      FAILED: 'bg-red-100 text-red-800 border-red-200',
      PARTIAL: 'bg-blue-100 text-blue-800 border-blue-200',
    } as const;
    return <span className={`text-xs px-2 py-0.5 rounded border ${m[s]}`}>{s}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Recent Imports</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-sm text-gray-500">No imports found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Filename</th>
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2 pr-4">Rows</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Imported</th>
                    <th className="py-2 pr-4">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => {
                    const done = l.status === 'SUCCESS';
                    const pct = done ? 100 : l.status === 'PENDING' ? 10 : 0;
                    return (
                      <tr key={l.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 max-w-[420px] truncate" title={l.filename}>{l.filename}</td>
                        <td className="py-2 pr-4">{l.source || l.fileType}</td>
                        <td className="py-2 pr-4 tabular-nums">{l.rowsProcessed?.toLocaleString?.() || 0}</td>
                        <td className="py-2 pr-4">{statusBadge(l.status)}</td>
                        <td className="py-2 pr-4">{new Date(l.importedDate).toLocaleString()}</td>
                        <td className="py-2 pr-4">
                          <div className="h-2 w-40 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full ${done ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{pct}%</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

