export interface FileNamingRule {
  source: string;
  pattern: RegExp;
  description: string;
  examples: string[];
  fileType: string;
}

// File naming patterns based on your requirements
export const FILE_NAMING_RULES: FileNamingRule[] = [
  {
    source: 'tenable',
    pattern: /^Tenable_.*_\d{8}\.csv$/i,
    description: 'Tenable vulnerability reports',
    examples: ['Tenable_SCAN123_20241224.csv', 'Tenable_MONTHLY_20241201.csv'],
    fileType: 'csv'
  },
  {
    source: 'falcon',
    pattern: /^Falcon_.*_\d{8}\.csv$/i,
    description: 'Falcon detection reports',
    examples: ['Falcon_DETECTIONS_20241224.csv', 'Falcon_ALERTS_20241201.csv'],
    fileType: 'csv'
  },
  {
    source: 'secureworks',
    pattern: /^Secureworks_.*_\d{8}\.csv$/i,
    description: 'Secureworks security alerts',
    examples: ['Secureworks_ALERTS_20241224.csv', 'Secureworks_DETECTIONS_20241201.csv'],
    fileType: 'csv'
  },
  {
    source: 'phishing',
    pattern: /^Phishing_.*_\d{8}\.csv$/i,
    description: 'Phishing reports from JIRA',
    examples: ['Phishing_MONTHLY_20241224.csv', 'Phishing_INCIDENTS_20241201.csv'],
    fileType: 'csv'
  },
  {
    source: 'aws_security_hub',
    pattern: /^AWS_Security_Hub_.*_\d{8}\.csv$/i,
    description: 'AWS Security Hub compliance findings',
    examples: ['AWS_Security_Hub_FINDINGS_20241224.csv', 'AWS_Security_Hub_COMPLIANCE_20241201.csv'],
    fileType: 'csv'
  },
  {
    source: 'scorecard-pdf',
    pattern: /^NETGEAR-Scorecard-.*_\d{8}\.pdf$/i,
    description: 'Security Scorecard PDF reports',
    examples: ['NETGEAR-Scorecard-Q4_20241224.PDF', 'NETGEAR-Scorecard-MONTHLY_20241201.pdf'],
    fileType: 'pdf'
  },
  {
    source: 'scorecard-csv',
    pattern: /^NETGEAR_FullIssues_.*_\d{8}\.csv$/i,
    description: 'Security Scorecard detailed issues CSV',
    examples: ['NETGEAR_FullIssues_Report_20250824.csv', 'NETGEAR_FullIssues_MONTHLY_20241201.csv'],
    fileType: 'csv'
  },
  {
    source: 'scorecard-report',
    pattern: /^NETGEAR_Scorecard_Report_\d{8}\.csv$/i,
    description: 'NETGEAR scorecard summary report CSV',
    examples: ['NETGEAR_Scorecard_Report_20250824.csv', 'NETGEAR_Scorecard_Report_20241201.csv'],
    fileType: 'csv'
  },
  {
    source: 'threat-advisory',
    pattern: /^.*[Tt]hreat.*[Aa]dvisory.*\.csv$/i,
    description: 'Threat Advisory reports',
    examples: ['threat_advisory_report.csv', 'Threat_Advisory_20241224.csv'],
    fileType: 'csv'
  },
  {
    source: 'open-items',
    pattern: /^.*[Oo]pen[Ii]tems.*\.csv$/i,
    description: 'Open Items reports from Jira',
    examples: ['CorpSec_BiWeekly_OpenItems (Jira).csv', 'OpenItems_Report.csv'],
    fileType: 'csv'
  }
];

export interface FileValidationResult {
  isValid: boolean;
  source?: string;
  fileType?: string;
  extractedDate?: string;
  error?: string;
  rule?: FileNamingRule;
}

/**
 * Validates a filename against the defined naming patterns
 * @param filename - The filename to validate
 * @returns FileValidationResult with validation details
 */
export function validateFileName(filename: string): FileValidationResult {
  if (!filename || filename.trim().length === 0) {
    return {
      isValid: false,
      error: 'Filename cannot be empty'
    };
  }

  // Check each naming rule
  for (const rule of FILE_NAMING_RULES) {
    if (rule.pattern.test(filename)) {
      // Extract date from filename (YYYYMMDD format)
      const dateMatch = filename.match(/_(\d{8})\./);
      const extractedDate = dateMatch ? dateMatch[1] : undefined;
      
      // Validate date format if found
      if (extractedDate) {
        const year = extractedDate.substring(0, 4);
        const month = extractedDate.substring(4, 6);
        const day = extractedDate.substring(6, 8);
        
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const isValidDate = date.getFullYear() == parseInt(year) && 
                           date.getMonth() == parseInt(month) - 1 && 
                           date.getDate() == parseInt(day);
        
        if (!isValidDate) {
          return {
            isValid: false,
            error: `Invalid date format in filename: ${extractedDate}. Expected YYYYMMDD format.`
          };
        }
      }

      return {
        isValid: true,
        source: rule.source,
        fileType: rule.fileType,
        extractedDate,
        rule
      };
    }
  }

  // Generate error message with expected patterns
  const expectedFormats = FILE_NAMING_RULES.map(rule => 
    `${rule.description}: ${rule.examples[0]}`
  ).join('\n');

  return {
    isValid: false,
    error: `Filename does not match any expected pattern. Expected formats:\n\n${expectedFormats}\n\nNote: Date must be in YYYYMMDD format`
  };
}

/**
 * Extracts the date from a valid filename
 * @param filename - The filename to extract date from
 * @returns Date object or null if not found
 */
export function extractDateFromFilename(filename: string): Date | null {
  const validation = validateFileName(filename);
  
  if (validation.isValid && validation.extractedDate) {
    const year = parseInt(validation.extractedDate.substring(0, 4));
    const month = parseInt(validation.extractedDate.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(validation.extractedDate.substring(6, 8));
    
    return new Date(year, month, day);
  }
  
  return null;
}

/**
 * Get file naming rules for display in UI
 */
export function getFileNamingRules(): FileNamingRule[] {
  return FILE_NAMING_RULES;
}

/**
 * Generate today's date in YYYYMMDD format for filename suggestions
 */
export function getTodaysDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  return `${year}${month}${day}`;
}

/**
 * Generate example filenames for today's date
 */
export function generateExampleFilenames(): { [key: string]: string[] } {
  const todayDate = getTodaysDateString();
  
  return {
    tenable: [`Tenable_SCAN_${todayDate}.csv`, `Tenable_MONTHLY_${todayDate}.csv`],
    falcon: [`Falcon_DETECTIONS_${todayDate}.csv`, `Falcon_ALERTS_${todayDate}.csv`],
    secureworks: [`Secureworks_ALERTS_${todayDate}.csv`, `Secureworks_DETECTIONS_${todayDate}.csv`],
    phishing: [`Phishing_MONTHLY_${todayDate}.csv`, `Phishing_INCIDENTS_${todayDate}.csv`],
    scorecard: [
      `NETGEAR-Scorecard-MONTHLY_${todayDate}.pdf`,
      `NETGEAR_FullIssues_Report_${todayDate}.csv`,
      `NETGEAR_Scorecard_Report_${todayDate}.csv`
    ]
  };
}