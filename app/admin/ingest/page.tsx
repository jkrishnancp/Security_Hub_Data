'use client';

import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import AuthGuard from '@/lib/auth-guard';
import NavBar from '@/components/nav-bar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Upload, 
  File, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  FileText,
  Table,
  FileImage,
  Info,
  Trash2,
  Database,
  Calendar,
  Shield
} from 'lucide-react';
import { getFileNamingRules, generateExampleFilenames, getTodaysDateString } from '@/lib/file-naming-patterns';

interface UploadResult {
  success: boolean;
  type: string;
  rowsProcessed: number;
  ingestionId: string;
  error?: string;
  details?: string[];
}

interface DatabaseInfo {
  value: string;
  label: string;
  count: number;
  description: string;
}

interface CleanupResult {
  success: boolean;
  message: string;
  deletedCount: number;
  cutoffDate: string;
  days: number;
  mode: string;
  operationDescription: string;
  tableName: string;
  error?: string;
  details?: string[];
}

export default function IngestPage() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Database cleanup state
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string>('');
  const [days, setDays] = useState<number>(30);
  const [cleanupMode, setCleanupMode] = useState<'keep_recent' | 'delete_old'>('keep_recent');
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [cleaning, setCleaning] = useState(false);

  // Fetch available databases on component mount
  useEffect(() => {
    fetchDatabases();
  }, []);

  const fetchDatabases = async () => {
    try {
      const response = await fetch('/api/cleanup');
      if (response.ok) {
        const data = await response.json();
        setDatabases(data.databases || []);
      }
    } catch (error) {
      console.error('Failed to fetch databases:', error);
    }
  };

  const handleCleanup = async () => {
    if (!selectedDatabase || days < 0) {
      alert('Please select a database and enter a valid number of days.');
      return;
    }

    const databaseLabel = databases.find(db => db.value === selectedDatabase)?.label || selectedDatabase;
    
    let confirmMessage = '';
    if (cleanupMode === 'keep_recent') {
      confirmMessage = `🔄 KEEP RECENT DATA MODE

Are you sure you want to delete all data OLDER than ${days} days from ${databaseLabel}?

This will:
• KEEP data from the last ${days} days
• DELETE data older than ${new Date(Date.now() - days * 24 * 60 * 60 * 1000).toLocaleDateString()}

This action cannot be undone. Old data will be permanently removed from the database.`;
    } else {
      confirmMessage = `⚠️ DELETE RECENT DATA MODE

Are you sure you want to delete all data from the LAST ${days} days from ${databaseLabel}?

This will:
• DELETE data from the last ${days} days (most recent data)
• KEEP data older than ${new Date(Date.now() - days * 24 * 60 * 60 * 1000).toLocaleDateString()}

⚠️ WARNING: This will delete your most recent data! Use this mode to undo accidental uploads.

This action cannot be undone. Recent data will be permanently removed from the database.`;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    setCleaning(true);
    setCleanupResult(null);

    try {
      const response = await fetch('/api/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          database: selectedDatabase,
          days: days,
          mode: cleanupMode,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setCleanupResult(result);
        // Refresh database info to show updated counts
        await fetchDatabases();
      } else {
        setCleanupResult({
          success: false,
          message: '',
          deletedCount: 0,
          cutoffDate: '',
          days: 0,
          mode: '',
          operationDescription: '',
          tableName: '',
          error: result.error,
          details: result.details,
        });
      }
    } catch (error) {
      setCleanupResult({
        success: false,
        message: '',
        deletedCount: 0,
        cutoffDate: '',
        days: 0,
        mode: '',
        operationDescription: '',
        tableName: '',
        error: 'Network error during cleanup',
        details: [error instanceof Error ? error.message : 'Unknown error'],
      });
    } finally {
      setCleaning(false);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();
      
      if (response.ok) {
        setUploadResult(result);
      } else {
        setUploadResult({
          success: false,
          type: 'error',
          rowsProcessed: 0,
          ingestionId: '',
          error: result.error,
          details: result.details,
        });
      }
    } catch (error) {
      setUploadResult({
        success: false,
        type: 'error',
        rowsProcessed: 0,
        ingestionId: '',
        error: 'Upload failed',
        details: [error instanceof Error ? error.message : 'Unknown error'],
      });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
    },
  });

  const getFileIcon = (type: string) => {
    if (type.includes('csv') || type.includes('spreadsheet')) return <Table className="h-6 w-6" />;
    if (type.includes('pdf')) return <FileImage className="h-6 w-6" />;
    return <FileText className="h-6 w-6" />;
  };

  const getDataTypeDescription = (type: string) => {
    switch (type) {
      case 'vulnerabilities': return 'Vulnerability data with CVE information, SLA dates, and business units';
      case 'falcon_detections': return 'CrowdStrike Falcon detection events with tactics and techniques';
      case 'secureworks_detections': return 'Secureworks security detection alerts with threat scores, MITRE ATT&CK techniques, and response details';
      case 'phishing_jira': return 'Jira-tracked phishing incidents and resolution times';
      case 'aws_security_hub': return 'AWS Security Hub findings and compliance status';
      case 'issue_reports': return 'Cross-cutting security issues and their current status';
      case 'threat_advisories': return 'Threat intelligence advisories and impact assessments';
      case 'scorecard_categories': return 'Security scorecard baseline scores from PDF reports';
      case 'scorecard_report': return 'NETGEAR scorecard summary with individual category scores';
      case 'scorecard_issues': return 'Detailed security issues from NETGEAR full issues report';
      default: return 'Unknown data type - please verify file format';
    }
  };

  return (
    <AuthGuard requiredRole="ANALYST">
      <div className="min-h-screen bg-gray-50">
        <NavBar />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Data Ingestion</h1>
            <p className="text-gray-500 mt-1">
              Upload CSV, Excel, PDF, or TXT files to update security data
            </p>
          </div>

          {/* Upload Area */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Upload Security Data</CardTitle>
              <CardDescription>
                Drag and drop files or click to browse. Files must follow specific naming conventions.
              </CardDescription>
              
              {/* File Naming Requirements Alert */}
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mt-4">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-primary mb-2">File Naming Requirements</h4>
                    <p className="text-sm text-primary mb-4">
                      All files must follow specific naming patterns that include the date in YYYYMMDD format.
                    </p>
                    
                    <div className="space-y-3 text-sm">
                      <div className="grid gap-3">
                        <div className="bg-white rounded p-3 border border-primary/20">
                          <p className="font-medium text-primary mb-1">Vulnerability Reports (Tenable):</p>
                          <p className="text-primary">Pattern: <code className="bg-primary/15 px-1 rounded">Tenable_XXXX_YYYYMMDD.csv</code></p>
                        </div>
                        
                        <div className="bg-white rounded p-3 border border-primary/20">
                          <p className="font-medium text-primary mb-1">Falcon Detections:</p>
                          <p className="text-primary">Pattern: <code className="bg-primary/15 px-1 rounded">Falcon_XXXX_YYYYMMDD.csv</code></p>
                        </div>
                        
                        <div className="bg-white rounded p-3 border border-primary/20">
                          <p className="font-medium text-primary mb-1">Secureworks Detection Alerts:</p>
                          <p className="text-primary mb-1">Pattern: <code className="bg-primary/15 px-1 rounded">Secureworks_XXXX_YYYYMMDD.csv</code></p>
                          <p className="text-xs text-primary mt-1">Expected columns: Created At, Title, Severity, Threat Score, Detector, Sensor Type, Domain, Combined Username, Source IP, Destination IP, Hostname, Investigations, Confidence, MITRE ATT&CK, Status, Status Reason, Tenant, Occurrence Count, Description</p>
                        </div>
                        
                        <div className="bg-white rounded p-3 border border-primary/20">
                          <p className="font-medium text-primary mb-1">Phishing Reports:</p>
                          <p className="text-primary">Pattern: <code className="bg-primary/15 px-1 rounded">Phishing_XXXX_YYYYMMDD.csv</code></p>
                        </div>

                        <div className="bg-white rounded p-3 border border-primary/20">
                          <p className="font-medium text-primary mb-1">AWS Security Hub Findings:</p>
                          <p className="text-primary mb-1">Pattern: <code className="bg-primary/15 px-1 rounded">AWS_Security_Hub_XXXX_YYYYMMDD.csv</code></p>
                          <p className="text-xs text-primary mt-1">Expected columns: ID, Title, Control Status, Severity, Failed checks, Unknown checks, Not available checks, Passed checks, Related requirements, Custom parameters</p>
                        </div>
                        
                        <div className="bg-white rounded p-3 border border-primary/20">
                          <p className="font-medium text-primary mb-1">Security Scorecard Files:</p>
                          <p className="text-primary mb-1">Scorecard Report: <code className="bg-primary/15 px-1 rounded">NETGEAR_Scorecard_Report_YYYYMMDD.csv</code></p>
                          <p className="text-primary">Full Issues Report: <code className="bg-primary/15 px-1 rounded">NETGEAR_FullIssues_Report_YYYYMMDD.csv</code></p>
                        </div>
                      </div>
                      
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <p className="text-yellow-800 text-xs font-medium mb-1">Important Notes:</p>
                        <ul className="text-yellow-700 text-xs space-y-1">
                          <li>• XXXX can be any descriptive text (e.g., MONTHLY, Q4, ALERTS, DETECTIONS)</li>
                          <li>• Date must be in YYYYMMDD format (e.g., 20241224 for Dec 24, 2024)</li>
                          <li>• File extensions are case-insensitive (.csv, .CSV, .pdf, .PDF all work)</li>
                          <li>• The date in the filename represents when the report was generated</li>
                          <li>• Secureworks files should include all 19 required columns in the specified order</li>
                        </ul>
                      </div>
                      
                      {/* Secureworks Example Section */}
                      <div className="bg-teal-50 border border-teal-200 rounded p-3 mt-3">
                        <p className="text-teal-800 text-xs font-medium mb-2">Secureworks CSV Example:</p>
                        <div className="bg-white rounded p-2 border border-teal-100">
                          <p className="text-xs text-teal-700 mb-1"><strong>Valid filename:</strong> <code>Secureworks_ALERTS_20250827.csv</code></p>
                          <p className="text-xs text-teal-700 mb-2"><strong>Expected header row:</strong></p>
                          <code className="text-xs text-teal-600 bg-teal-100 p-1 rounded block">
                            Created At,Title,Severity,Threat Score,Detector,Sensor Type,Domain,Combined Username,Source IP,Destination IP,Hostname,Investigations,Confidence,MITRE ATT&CK,Status,Status Reason,Tenant,Occurrence Count,Description
                          </code>
                          <p className="text-xs text-teal-600 mt-2"><strong>Example data row:</strong></p>
                          <code className="text-xs text-teal-600 bg-teal-100 p-1 rounded block">
                            2025/08/27 02:29:55 UTC,O97M/Kangatang.gen!A,MEDIUM,5,Antivirus Watchlist,MICROSOFT_OFFICE_MANAGEMENT,,SHAREPOINT\system,,,,,0,0.7,,OPEN,,Netgear Inc. (143085),1,An antivirus event was detected...
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? 'border-primary/40 bg-primary/5' 
                    : 'border-gray-300 hover:border-gray-400'
                } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                {isDragActive ? (
                  <p className="text-primary font-medium">Drop the file here</p>
                ) : (
                  <>
                    <p className="text-gray-600 font-medium mb-2">
                      {uploading ? 'Processing file...' : 'Drop files here or click to browse'}
                    </p>
                    <p className="text-sm text-gray-400">
                      Maximum file size: 500MB
                    </p>
                  </>
                )}
              </div>

              {/* Progress Bar */}
              {uploading && (
                <div className="mt-4">
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-gray-500 mt-2">
                    Uploading and processing... {uploadProgress}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload Result */}
          {uploadResult && (
            <Card className={`mb-8 ${uploadResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  {uploadResult.success ? (
                    <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 mr-2 text-red-600" />
                  )}
                  {uploadResult.success ? 'Upload Successful' : 'Upload Failed'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {uploadResult.success ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Data Type:</span>
                      <Badge variant="secondary">{uploadResult.type}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Rows Processed:</span>
                      <span className="text-sm">{uploadResult.rowsProcessed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Ingestion ID:</span>
                      <code className="text-xs bg-gray-200 px-2 py-1 rounded">
                        {uploadResult.ingestionId}
                      </code>
                    </div>
                    <div className="mt-4 p-3 bg-white rounded border">
                      <p className="text-sm text-gray-600">
                        {getDataTypeDescription(uploadResult.type)}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center text-sm text-green-700">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Security scorecard has been automatically recalculated
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center text-red-700">
                      <XCircle className="h-4 w-4 mr-2" />
                      <span className="font-medium">{uploadResult.error}</span>
                    </div>
                    {uploadResult.details && uploadResult.details.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Error Details:</p>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {uploadResult.details.map((detail, index) => (
                            <li key={index} className="flex items-start">
                              <AlertCircle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0 mt-0.5" />
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Database Cleanup Section */}
          <Card className="mb-8 border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trash2 className="h-5 w-5 mr-2 text-orange-600" />
                Database Cleanup
              </CardTitle>
              <CardDescription>
                Remove old data to free up storage space and improve system performance. Only administrators can perform cleanup operations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="database-select">Database/Table</Label>
                  <Select
                    value={selectedDatabase}
                    onValueChange={setSelectedDatabase}
                    disabled={cleaning}
                  >
                    <SelectTrigger id="database-select">
                      <SelectValue placeholder="Select database to clean" />
                    </SelectTrigger>
                    <SelectContent>
                      {databases.map((db) => (
                        <SelectItem key={db.value} value={db.value}>
                          <div className="flex items-center justify-between w-full">
                            <span>{db.label}</span>
                            <Badge variant="secondary" className="ml-2">
                              {db.count.toLocaleString()} records
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cleanup-mode">Cleanup Mode</Label>
                  <Select
                    value={cleanupMode}
                    onValueChange={(value) => setCleanupMode(value as 'keep_recent' | 'delete_old')}
                    disabled={cleaning}
                  >
                    <SelectTrigger id="cleanup-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep_recent">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-green-600" />
                          <div>
                            <div className="font-medium">Keep Recent Data</div>
                            <div className="text-xs text-gray-500">Delete old data (normal cleanup)</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="delete_old">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <div>
                            <div className="font-medium">Delete Recent Data</div>
                            <div className="text-xs text-gray-500">Undo accidental uploads</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="days-input">{cleanupMode === 'keep_recent' ? 'Days to Keep' : 'Days to Delete'}</Label>
                  <Input
                    id="days-input"
                    type="number"
                    min="0"
                    max="365"
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value) || 0)}
                    disabled={cleaning}
                    placeholder="30"
                  />
                  <p className="text-xs text-gray-500">
                    {cleanupMode === 'keep_recent' 
                      ? 'Data older than this many days will be deleted'
                      : 'Data from the last X days will be deleted (recent data)'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button
                    onClick={handleCleanup}
                    disabled={!selectedDatabase || cleaning || databases.length === 0}
                    variant="destructive"
                    className={`w-full ${cleanupMode === 'delete_old' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                  >
                    {cleaning ? (
                      <>
                        <Database className="h-4 w-4 mr-2 animate-spin" />
                        Cleaning...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clean Database
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Cleanup Progress/Info */}
              {selectedDatabase && databases.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-orange-200">
                  {(() => {
                    const db = databases.find(d => d.value === selectedDatabase);
                    if (!db) return null;

                    const cutoffDate = new Date();
                    cutoffDate.setDate(cutoffDate.getDate() - days);

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Selected Database:</span>
                          <span className="text-sm">{db.label}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Current Records:</span>
                          <span className="text-sm">{db.count.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Cleanup Mode:</span>
                          <Badge variant={cleanupMode === 'keep_recent' ? 'secondary' : 'destructive'}>
                            {cleanupMode === 'keep_recent' ? 'Keep Recent' : 'Delete Recent'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {cleanupMode === 'keep_recent' ? 'Keep Data After:' : 'Delete Data After:'}
                          </span>
                          <span className="text-sm">{cutoffDate.toLocaleDateString()}</span>
                        </div>
                        <div className={`mt-3 p-3 rounded border ${
                          cleanupMode === 'keep_recent' 
                            ? 'bg-orange-100 border-orange-200' 
                            : 'bg-red-100 border-red-200'
                        }`}>
                          <p className={`text-sm ${cleanupMode === 'keep_recent' ? 'text-orange-800' : 'text-red-800'}`}>
                            <strong>Description:</strong> {db.description}
                          </p>
                          <p className={`text-xs mt-2 ${cleanupMode === 'keep_recent' ? 'text-orange-700' : 'text-red-700'}`}>
                            <strong>Action:</strong> {
                              cleanupMode === 'keep_recent' 
                                ? `Will delete data older than ${days} days (routine cleanup)`
                                : `Will delete data from the last ${days} days (undo recent uploads)`
                            }
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Cleanup Result */}
              {cleanupResult && (
                <div className={`mt-4 p-4 rounded-lg border ${
                  cleanupResult.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center mb-2">
                    {cleanupResult.success ? (
                      <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 mr-2 text-red-600" />
                    )}
                    <span className="font-medium">
                      {cleanupResult.success ? 'Cleanup Successful' : 'Cleanup Failed'}
                    </span>
                  </div>
                  
                  {cleanupResult.success ? (
                    <div className="space-y-2 text-sm text-green-700">
                      <div className="flex items-center justify-between">
                        <span>Records Deleted:</span>
                        <span className="font-medium">{cleanupResult.deletedCount.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Database Cleaned:</span>
                        <span className="font-medium">{cleanupResult.tableName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Cleanup Mode:</span>
                        <Badge variant={cleanupResult.mode === 'keep_recent' ? 'secondary' : 'destructive'} className="text-xs">
                          {cleanupResult.mode === 'keep_recent' ? 'Keep Recent' : 'Delete Recent'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Cutoff Date:</span>
                        <span>{new Date(cleanupResult.cutoffDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Days Processed:</span>
                        <span>{cleanupResult.days} days</span>
                      </div>
                      <div className="mt-3 p-3 bg-white rounded border border-green-200">
                        <p className="text-sm font-medium text-green-800">{cleanupResult.operationDescription}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-red-700">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        <span className="font-medium">{cleanupResult.error}</span>
                      </div>
                      {cleanupResult.details && cleanupResult.details.length > 0 && (
                        <ul className="text-red-600 space-y-1 ml-6">
                          {cleanupResult.details.map((detail, index) => (
                            <li key={index} className="list-disc">
                              {detail}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Warning Message */}
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Shield className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800 mb-2">Important Safety Information</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      <li>• This action permanently deletes data and cannot be undone</li>
                      <li>• User accounts are never deleted by this operation</li>
                      <li>• <strong>Keep Recent Mode:</strong> Deletes old data (normal cleanup operation)</li>
                      <li>• <strong>Delete Recent Mode:</strong> Deletes recent data (use to undo accidental uploads)</li>
                      <li>• Consider backing up important data before cleanup</li>
                      <li>• Weekly automated cleanup with "Keep Recent" mode is recommended for production</li>
                      <li>• "All Security Data" option cleans everything except user accounts and ingestion logs</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Supported File Types */}
          <Card>
            <CardHeader>
              <CardTitle>Supported Data Sources</CardTitle>
              <CardDescription>
                The following file types and data sources are supported
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
                    <Table className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Vulnerability Reports</p>
                      <p className="text-sm text-gray-500">CSV/Excel with CVE data</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
                    <Table className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="font-medium">Falcon Detections</p>
                      <p className="text-sm text-gray-500">CrowdStrike detection events</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
                    <Table className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium">Phishing Reports</p>
                      <p className="text-sm text-gray-500">Jira-tracked incidents</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
                    <Table className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">AWS Security Hub</p>
                      <p className="text-sm text-gray-500">Cloud security findings</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
                    <Table className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-medium">Security Scorecards</p>
                      <p className="text-sm text-gray-500">CSV scorecard and issues reports</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
                    <FileText className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="font-medium">Threat Advisories</p>
                      <p className="text-sm text-gray-500">TXT format advisories</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
                    <Table className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Issue Reports</p>
                      <p className="text-sm text-gray-500">Cross-cutting security issues</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
                    <Table className="h-5 w-5 text-teal-600" />
                    <div>
                      <p className="font-medium">Secureworks Detections</p>
                      <p className="text-sm text-gray-500">Security alerts with threat scores, MITRE techniques</p>
                      <p className="text-xs text-gray-400 mt-1">Supports multi-select filtering by severity, status, sensor type</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}
