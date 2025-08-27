'use client';

import React, { useEffect, useRef } from 'react';
import { X, Calendar, Shield, AlertTriangle, User, Database, Tag, Clock, FileText, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import { getSeverityBadgeClass } from '@/lib/theme-config';

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  type: 'falcon' | 'secureworks' | 'vulnerability' | 'phishing' | 'aws' | 'cloud' | 'threat-advisory' | 'scorecard';
  title: string;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ isOpen, onClose, data, type, title }) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const panelRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // ESC key to close
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !data) {
    return null;
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      // Handle JSON timestamps from Secureworks
      if (dateStr.includes('seconds')) {
        const parsed = JSON.parse(dateStr);
        if (parsed.seconds) {
          return new Date(parsed.seconds * 1000).toLocaleString();
        }
      }
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const parseJsonField = (field: string | null | undefined) => {
    if (!field) return null;
    try {
      return JSON.parse(field);
    } catch {
      return field;
    }
  };

  const renderFalconDetails = () => (
    <div className="space-y-6">
      {/* Basic Information */}
      <div>
        <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
          <Shield className="h-4 w-4 mr-2" />
          Detection Information
        </h3>
        <div className="grid grid-cols-1 gap-3">
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Severity:</span>
            <Badge className={getSeverityBadgeClass(data.Severity || 'Unknown', isDark)}>
              {data.Severity || 'Unknown'}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Tactic:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {data.Tactic || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Technique:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {data.Technique || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Product Type:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {data.ProductType || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Host Information */}
      <div>
        <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
          <Database className="h-4 w-4 mr-2" />
          Host Information
        </h3>
        <div className="grid grid-cols-1 gap-3">
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Hostname:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {data.Hostname || data.ComputerName || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Username:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {data.UserName || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Filename:</span>
            <span className={cn("text-sm font-medium break-all", isDark ? "text-white" : "text-gray-900")}>
              {data.Filename || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Process:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {data.ProcessName || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {(data.PatternDispositionDescription || data.DetectDescription) && (
        <div>
          <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Description
          </h3>
          <p className={cn("text-sm", isDark ? "text-gray-300" : "text-gray-700")}>
            {data.PatternDispositionDescription || data.DetectDescription}
          </p>
        </div>
      )}

      {/* Timestamps */}
      <div>
        <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
          <Clock className="h-4 w-4 mr-2" />
          Timestamps
        </h3>
        <div className="grid grid-cols-1 gap-3">
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Detected:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {formatDate(data.DetectDate_UTC_readable)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Ingested:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {formatDate(data.ingested_on)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecureworksDetails = () => (
    <div className="space-y-6">
      {/* Basic Information */}
      <div>
        <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
          <Shield className="h-4 w-4 mr-2" />
          Alert Information
        </h3>
        <div className="grid grid-cols-1 gap-3">
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Alert ID:</span>
            <span className={cn("text-sm font-medium break-all", isDark ? "text-white" : "text-gray-900")}>
              {data.alert_id}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Severity:</span>
            <Badge className={getSeverityBadgeClass(data.severity || 'Unknown', isDark)}>
              {data.severity || 'Unknown'}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Status:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {data.status || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Confidence:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {data.confidence ? `${(data.confidence * 100).toFixed(0)}%` : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Threat Score:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {data.threat_score ? `${data.threat_score}/10` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div>
          <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Description
          </h3>
          <p className={cn("text-sm", isDark ? "text-gray-300" : "text-gray-700")}>
            {data.description}
          </p>
        </div>
      )}

      {/* Sensor Information */}
      {(() => {
        const sensors = parseJsonField(data.sensor_types);
        return sensors && Array.isArray(sensors) && sensors.length > 0 && (
          <div>
            <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
              <Database className="h-4 w-4 mr-2" />
              Sensor Information
            </h3>
            <div className="flex flex-wrap gap-2">
              {sensors.map((sensor: string, idx: number) => (
                <Badge key={idx} variant="outline" className={cn(isDark ? "border-gray-600" : "border-gray-300")}>
                  {sensor}
                </Badge>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Attack Techniques */}
      {(() => {
        const techniques = parseJsonField(data.attack_technique_ids);
        return techniques && Array.isArray(techniques) && techniques.length > 0 && (
          <div>
            <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
              <Tag className="h-4 w-4 mr-2" />
              MITRE ATT&CK Techniques
            </h3>
            <div className="flex flex-wrap gap-2">
              {techniques.map((technique: string, idx: number) => (
                <Badge key={idx} variant="outline" className={cn(isDark ? "border-red-600 text-red-400" : "border-red-300 text-red-600")}>
                  {technique}
                </Badge>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Resolution */}
      {data.resolution_reason && (
        <div>
          <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
            <User className="h-4 w-4 mr-2" />
            Resolution
          </h3>
          <p className={cn("text-sm", isDark ? "text-gray-300" : "text-gray-700")}>
            {data.resolution_reason}
          </p>
        </div>
      )}

      {/* Timestamps */}
      <div>
        <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
          <Clock className="h-4 w-4 mr-2" />
          Timestamps
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {data.CreatedAt && (
            <div className="flex justify-between">
              <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Created:</span>
              <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
                {formatDate(data.CreatedAt)}
              </span>
            </div>
          )}
          {data.BeganAt && (
            <div className="flex justify-between">
              <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Began:</span>
              <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
                {formatDate(data.BeganAt)}
              </span>
            </div>
          )}
          {data.EndedAt && (
            <div className="flex justify-between">
              <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Ended:</span>
              <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
                {formatDate(data.EndedAt)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Ingested:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {formatDate(data.ingested_on)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderScorecardDetails = () => (
    <div className="space-y-6">
      {/* Issue Information */}
      <div>
        <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
          <Shield className="h-4 w-4 mr-2" />
          Issue Information
        </h3>
        <div className="grid grid-cols-1 gap-3">
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Severity:</span>
            <Badge className={cn(
              data.severity === 'CRITICAL' ? 'bg-red-600 hover:bg-red-700' :
              data.severity === 'HIGH' ? 'bg-orange-600 hover:bg-orange-700' :
              data.severity === 'MEDIUM' ? 'bg-yellow-600 hover:bg-yellow-700' :
              data.severity === 'LOW' ? 'bg-blue-600 hover:bg-blue-700' :
              'bg-gray-600 hover:bg-gray-700'
            )}>
              {data.severity || 'Unknown'}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Category:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {data.category || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Business Unit:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {data.businessUnit || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Impact Score:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-red-400" : "text-red-600")}>
              {data.impactScore ? `${Math.round(data.impactScore * 10) / 10}` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div>
          <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Description
          </h3>
          <p className={cn("text-sm", isDark ? "text-gray-300" : "text-gray-700")}>
            {data.description}
          </p>
        </div>
      )}

      {/* Timeline */}
      <div>
        <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
          <Clock className="h-4 w-4 mr-2" />
          Timeline
        </h3>
        <div className="grid grid-cols-1 gap-3">
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Opened:</span>
            <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
              {formatDate(data.openedDate)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCloudDetails = () => (
    <div className="space-y-6">
      {/* Basic Information */}
      <div>
        <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
          <Shield className="h-4 w-4 mr-2" />
          Control Information
        </h3>
        <div className="grid grid-cols-1 gap-3">
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Control ID:</span>
            <span className={cn("text-sm font-mono", isDark ? "text-blue-400" : "text-blue-600")}>
              {data.controlId || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Severity:</span>
            <Badge className={getSeverityBadgeClass(data.severity || 'Unknown', isDark)}>
              {data.severity || 'Unknown'}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Control Status:</span>
            <Badge variant={data.controlStatus === 'Failed' ? 'destructive' : data.controlStatus === 'Passed' ? 'default' : 'secondary'}>
              {data.controlStatus || 'Unknown'}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>AWS Service:</span>
            <span className={cn("text-sm font-mono", isDark ? "text-green-400" : "text-green-600")}>
              {data.service || data.controlId?.split('.')[0] || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Check Results */}
      <div>
        <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
          <BarChart3 className="h-4 w-4 mr-2" />
          Check Results
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Failed:</span>
            <span className={cn("text-sm font-semibold", 
              data.failedChecks > 0 
                ? (isDark ? "text-red-400" : "text-red-600") 
                : (isDark ? "text-gray-400" : "text-gray-500")
            )}>
              {data.failedChecks || 0}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Passed:</span>
            <span className={cn("text-sm font-semibold", 
              data.passedChecks > 0 
                ? (isDark ? "text-green-400" : "text-green-600") 
                : (isDark ? "text-gray-400" : "text-gray-500")
            )}>
              {data.passedChecks || 0}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Unknown:</span>
            <span className={cn("text-sm", isDark ? "text-gray-300" : "text-gray-700")}>
              {data.unknownChecks || 0}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>Not Available:</span>
            <span className={cn("text-sm", isDark ? "text-gray-300" : "text-gray-700")}>
              {data.notAvailableChecks || 0}
            </span>
          </div>
          <div className="flex justify-between col-span-2 pt-2 border-t border-gray-300">
            <span className={cn("text-sm font-medium", isDark ? "text-gray-300" : "text-gray-700")}>Total Checks:</span>
            <span className={cn("text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>
              {data.totalChecks || ((data.failedChecks || 0) + (data.passedChecks || 0) + (data.unknownChecks || 0) + (data.notAvailableChecks || 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Compliance Information */}
      <div>
        <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
          <Database className="h-4 w-4 mr-2" />
          Compliance & Support
        </h3>
        <div className="space-y-3">
          <div>
            <span className={cn("text-sm block mb-1", isDark ? "text-gray-400" : "text-gray-600")}>Custom Parameters:</span>
            <Badge variant={data.customParameters === 'SUPPORTED' ? 'default' : 'secondary'}>
              {data.customParameters || 'Unknown'}
            </Badge>
          </div>
          <div>
            <span className={cn("text-sm block mb-2", isDark ? "text-gray-400" : "text-gray-600")}>Compliance Frameworks:</span>
            <div className="flex flex-wrap gap-2">
              {data.hasNIST && <Badge variant="outline">NIST</Badge>}
              {data.hasPCI && <Badge variant="outline">PCI</Badge>}
              {data.hasSOC && <Badge variant="outline">SOC</Badge>}
              {data.hasISO && <Badge variant="outline">ISO</Badge>}
              {!data.hasNIST && !data.hasPCI && !data.hasSOC && !data.hasISO && (
                <span className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>None specified</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description and Requirements */}
      {data.title && (
        <div>
          <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
            <FileText className="h-4 w-4 mr-2" />
            Control Title
          </h3>
          <p className={cn("text-sm leading-relaxed", isDark ? "text-gray-300" : "text-gray-700")}>
            {data.title}
          </p>
        </div>
      )}

      {data.relatedRequirements && (
        <div>
          <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
            <Tag className="h-4 w-4 mr-2" />
            Related Requirements
          </h3>
          <p className={cn("text-xs leading-relaxed font-mono break-all", isDark ? "text-gray-400" : "text-gray-600")}>
            {data.relatedRequirements}
          </p>
        </div>
      )}

      {data.description && (
        <div>
          <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
            <FileText className="h-4 w-4 mr-2" />
            Additional Details
          </h3>
          <p className={cn("text-sm leading-relaxed", isDark ? "text-gray-300" : "text-gray-700")}>
            {data.description}
          </p>
        </div>
      )}

      {/* Timestamps */}
      <div>
        <h3 className={cn("font-semibold mb-3 flex items-center", isDark ? "text-white" : "text-gray-900")}>
          <Clock className="h-4 w-4 mr-2" />
          Timeline
        </h3>
        <div className="grid grid-cols-1 gap-2 text-sm">
          <div className="flex justify-between">
            <span className={cn(isDark ? "text-gray-400" : "text-gray-600")}>Found:</span>
            <span className={cn(isDark ? "text-gray-300" : "text-gray-700")}>
              {formatDate(data.foundAt)}
            </span>
          </div>
          {data.resolvedAt && (
            <div className="flex justify-between">
              <span className={cn(isDark ? "text-gray-400" : "text-gray-600")}>Resolved:</span>
              <span className={cn(isDark ? "text-green-400" : "text-green-600")}>
                {formatDate(data.resolvedAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderDetails = () => {
    switch (type) {
      case 'falcon':
        return renderFalconDetails();
      case 'secureworks':
        return renderSecureworksDetails();
      case 'cloud':
        return renderCloudDetails();
      case 'scorecard':
        return renderScorecardDetails();
      default:
        return (
          <div className={cn("text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
            Details not available for this item type.
          </div>
        );
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />
      
      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "fixed right-0 top-0 h-full w-[28rem] z-50 shadow-xl transform transition-transform duration-300",
          isDark ? "bg-gray-800" : "bg-white",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className={cn(
          "p-4 border-b flex justify-between items-center",
          isDark ? "border-gray-700" : "border-gray-200"
        )}>
          <h2 className={cn("text-lg font-semibold truncate pr-4", isDark ? "text-white" : "text-gray-900")}>
            {title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className={cn(
              "flex-shrink-0 h-8 w-8 p-0",
              isDark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-600"
            )}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto h-full pb-20">
          {renderDetails()}
        </div>
      </div>
    </>
  );
};

export default DetailPanel;