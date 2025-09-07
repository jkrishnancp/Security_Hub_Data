"use client";

import React, { useEffect, useRef, useState } from 'react';
import ProgressPie from '@/components/ui/progress-pie';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, CheckCircle, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';

type UploadResult = { filename: string; success: boolean; message: string; type?: string; rowsProcessed?: number };

interface ImportDataDialogProps {
  triggerClassName?: string;
  highlight?: Array<'scorecard' | 'falcon' | 'secureworks' | 'aws_security_hub' | 'threat_advisory' | 'open_items'>;
  // If provided, only these sections will be shown; otherwise all are shown
  allowed?: Array<'scorecard' | 'falcon' | 'secureworks' | 'aws_security_hub' | 'threat_advisory' | 'open_items'>;
  triggerLabel?: string;
}

export default function ImportDataDialog({ triggerClassName, highlight = [], allowed, triggerLabel = 'Import Data' }: ImportDataDialogProps) {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);

  const handleMultipleFilesUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      // eslint-disable-next-line no-await-in-loop
      await handleFileUpload(file);
    }
  };

  const startProgress = () => {
    setProgress(10);
    if (progressTimer.current) clearInterval(progressTimer.current);
    // Simulate progress up to 90% while waiting for server
    progressTimer.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + 2 : p));
    }, 150);
  };

  const stopProgress = (finalValue = 100) => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setProgress(finalValue);
  };

  // Cleanup progress timer on unmount
  useEffect(() => {
    return () => { if (progressTimer.current) clearInterval(progressTimer.current); };
  }, []);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    startProgress();
    setUploadResults(prev => prev.filter(r => r.filename !== file.name));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok) {
        setUploadResults(prev => ([
          ...prev,
          {
            filename: file.name,
            success: true,
            message: 'Uploaded and processed successfully',
            type: result.type,
            rowsProcessed: result.rowsProcessed,
          }
        ]));
      } else {
        setUploadResults(prev => ([...prev, { filename: file.name, success: false, message: result.error || 'Upload failed' }]));
      }
    } catch (error) {
      setUploadResults(prev => ([...prev, { filename: file.name, success: false, message: error instanceof Error ? error.message : 'Upload failed' }]));
    } finally {
      stopProgress(100);
      setUploading(false);
    }
  };

  const isAllowed = (id: string) => !allowed || (allowed && allowed.includes(id as any));

  const sec = (id: string, title: string, content: React.ReactNode) => (
    <div id={id} className={cn('rounded-lg border p-4', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('h-2 w-2 rounded-full', highlight.includes(id as any) ? 'bg-primary' : isDark ? 'bg-gray-600' : 'bg-gray-300')} />
        <h4 className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>{title}</h4>
      </div>
      <div className={cn('text-sm leading-relaxed', isDark ? 'text-gray-300' : 'text-gray-700')}>
        {content}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={triggerClassName}>
          <Upload className="h-4 w-4 mr-2" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Data</DialogTitle>
          <DialogDescription>
            Upload one or more files. Filenames must follow the naming rules; some sources require ADMIN.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className={cn('flex items-start gap-2 rounded-md p-3', isDark ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary')}>
            <Info className="h-4 w-4 mt-0.5" />
            <div>
              <div className="font-medium">Supported sources and filename rules</div>
              <div className="text-xs opacity-90">Date in YYYYMMDD is required in filenames.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isAllowed('scorecard') && sec('scorecard', 'SecurityScorecard — Full Issues CSV', (
              <ul className="list-disc ml-5">
                <li>Filename: NETGEAR_FullIssues_XXXX_YYYYMMDD.csv (ADMIN only)</li>
                <li>Key fields: ISSUE ID, FACTOR NAME, ISSUE TYPE TITLE/CODE/SEVERITY, STATUS, IP/HOSTNAME/SUBDOMAIN, TARGET/URL, PORTS, ISSUE TYPE SCORE IMPACT</li>
              </ul>
            ))}
            {isAllowed('scorecard') && sec('scorecard', 'SecurityScorecard — Scorecard Report CSV', (
              <ul className="list-disc ml-5">
                <li>Filename: NETGEAR_Scorecard_Report_YYYYMMDD.csv (ADMIN only)</li>
                <li>Key fields: Category names with numeric scores; company metadata</li>
              </ul>
            ))}
            {isAllowed('scorecard') && sec('scorecard', 'SecurityScorecard — PDF', (
              <ul className="list-disc ml-5">
                <li>Filename: NETGEAR-Scorecard-XXXX_YYYYMMDD.pdf (ADMIN only)</li>
                <li>Key values: category scores and summary metrics</li>
              </ul>
            ))}
            {isAllowed('threat_advisory') && sec('threat_advisory', 'Threat Advisories CSV', (
              <ul className="list-disc ml-5">
                <li>Filename: Threat_Advisory_YYYYMMDD.csv</li>
                <li>Key fields: THREAT ADVISORY NAME, SEVERITY, NETGEAR SEVERITY, IMPACTED, SOURCE, RELEASED DATE, NOTIFIED DATE, REMARKS, ETA FOR FIX</li>
              </ul>
            ))}
            {isAllowed('open_items') && sec('open_items', 'Open Items CSV (Jira export)', (
              <ul className="list-disc ml-5">
                <li>Filename: OpenItems_XXXX.csv</li>
                <li>Key fields: Summary/Title, Status, Priority, Assignee, Created/Updated/Resolved/Due dates, Story Points, Description</li>
              </ul>
            ))}
            {isAllowed('falcon') && sec('falcon', 'Falcon Detections CSV', (
              <ul className="list-disc ml-5">
                <li>Filename: Falcon_XXXX_YYYYMMDD.csv</li>
                <li>Key fields: DetectDate, Severity, Tactic/Technique, ProductType, Hostname, Filename, PatternDispositionDescription</li>
              </ul>
            ))}
            {isAllowed('secureworks') && sec('secureworks', 'Secureworks Alerts CSV', (
              <ul className="list-disc ml-5">
                <li>Filename: Secureworks_XXXX_YYYYMMDD.csv</li>
                <li>Key fields: alert_id, severity, threat_score, mitre_attack, sensor_type, domain, hostname, created_at</li>
              </ul>
            ))}
            {isAllowed('aws_security_hub') && sec('aws_security_hub', 'AWS Security Hub CSV', (
              <ul className="list-disc ml-5">
                <li>Filename: AWS_Security_Hub_XXXX_YYYYMMDD.csv</li>
                <li>Key fields: ID, Title, Control Status, Severity, Failed/Unknown/Not available/Passed checks, Related requirements</li>
              </ul>
            ))}
          </div>

          <div className={cn('rounded-lg border p-4 text-center', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
            <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className={cn('text-sm mb-2', isDark ? 'text-gray-300' : 'text-gray-600')}>{uploading ? 'Processing...' : 'Drop files here or click to select files'}</p>
            {uploading && (
              <div className="flex justify-center mb-2">
                <ProgressPie value={progress} />
              </div>
            )}
            <input
              type="file"
              accept=".csv,.pdf"
              multiple
              onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleMultipleFilesUpload(e.target.files); }}
              disabled={uploading}
              className="hidden"
              id="global-import-file-input"
            />
            <label
              htmlFor="global-import-file-input"
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 disabled:opacity-50"
            >
              Select File(s)
            </label>
          </div>

          {uploadResults.length > 0 && (
            <div className="space-y-2">
              {uploadResults.map((res, idx) => (
                <div key={`${res.filename}-${idx}`} className={cn('p-3 rounded-lg border', res.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
                  <div className="flex items-center">
                    {res.success ? (
                      <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 mr-2 text-red-600" />
                    )}
                    <span className={cn('text-sm', res.success ? 'text-green-700' : 'text-red-700')}>
                      {res.filename}: {res.message} {res.type ? `— ${res.type}` : ''} {typeof res.rowsProcessed === 'number' ? `• Rows: ${res.rowsProcessed}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
