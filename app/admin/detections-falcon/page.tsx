"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AdminFalconDetectionsImport() {
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        setError('Please select a CSV file');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError('');
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/detections/falcon/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        setFile(null);
        // Reset file input
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadErrorCsv = () => {
    if (result?.errorCsv) {
      const blob = new Blob([result.errorCsv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `falcon-detections-errors-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // Check if user is admin
  if (!session || session.user.role !== 'ADMIN') {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Access denied. Admin privileges required to import Falcon detections.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Falcon Detections Import</h1>
        <p className="text-muted-foreground mt-2">
          Upload Falcon Detections CSV for this page only.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            CSV File Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-input">Select CSV File</Label>
            <Input
              id="file-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <div className="text-sm text-muted-foreground space-y-1">
              <p><span className="font-medium">File type:</span> Falcon Detections CSV</p>
              <p><span className="font-medium">Filename:</span> Falcon_XXXX_YYYYMMDD.csv</p>
              <p>
                <span className="font-medium">Key fields:</span> DetectDate, Severity, Tactic/Technique, ProductType, Hostname, Filename, PatternDispositionDescription
              </p>
            </div>
          </div>

          {file && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">{file.name}</span>
              <span className="text-sm text-muted-foreground">
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
          )}

          <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
            {uploading ? 'Importing...' : 'Import Detections'}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert className={result.success ? 'border-green-500' : 'border-red-500'}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {result.success ? (
                  <div className="space-y-2">
                    <p className="font-medium">Import completed successfully!</p>
                    <ul className="text-sm space-y-1">
                      <li>• {result.count} records processed</li>
                      <li>• Ingestion ID: {result.ingestionId}</li>
                      {result.errors && result.errors.length > 0 && (
                        <li className="text-amber-600">
                          • {result.errors.length} errors encountered (see details below)
                        </li>
                      )}
                    </ul>
                  </div>
                ) : (
                  <p>Import failed: {result.error}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {result?.errors && result.errors.length > 0 && (
            <Card className="border-amber-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-amber-700">Import Errors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  The following rows had issues during import:
                </div>
                <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.slice(0, 10).map((error: string, index: number) => (
                    <li key={index} className="text-amber-700">• {error}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li className="text-muted-foreground">
                      ... and {result.errors.length - 10} more errors
                    </li>
                  )}
                </ul>
                {result.errorCsv && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadErrorCsv}
                    className="mt-2"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Error Report (CSV)
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CSV Format Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Required Columns (case-insensitive):</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>DetectDate</strong> - Detection timestamp</li>
                <li><strong>Severity</strong> - Critical, High, Medium, Low, Informational</li>
                <li><strong>Tactic/Technique</strong> - MITRE ATT&CK tactic or technique</li>
                <li><strong>ProductType</strong> - Product/service that detected</li>
                <li><strong>Hostname</strong> - Affected hostname</li>
                <li><strong>Filename</strong> - Affected filename</li>
                <li><strong>PatternDispositionDescription</strong> - Detection description</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Notes:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Use filename pattern Falcon_XXXX_YYYYMMDD.csv</li>
                <li>Data availability: imports are treated as up to today. Next import should include only new data from tomorrow onward (exclude duplicates for today).</li>
                <li>All data is stamped with today's ingestion date</li>
                <li>False positives are automatically excluded from reports</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
