import * as ExcelJS from 'exceljs';
import * as csv from 'fast-csv';
import * as pdfParse from 'pdf-parse';
import { SeverityLevel, IssueStatus } from '@prisma/client';

export interface ParsedData {
  type: string;
  data: any[];
  errors: string[];
}

export class FileParser {
  static async parseFile(file: File): Promise<ParsedData> {
    const fileName = file.name.toLowerCase();
    
    try {
      if (fileName.endsWith('.csv')) {
        return await this.parseCsv(file);
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        return await this.parseExcel(file);
      } else if (fileName.endsWith('.pdf')) {
        return await this.parsePdf(file);
      } else if (fileName.endsWith('.txt')) {
        return await this.parseTxt(file);
      } else {
        throw new Error('Unsupported file format');
      }
    } catch (error) {
      return {
        type: 'error',
        data: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  private static async parseCsv(file: File): Promise<ParsedData> {
    return new Promise((resolve) => {
      const data: any[] = [];
      const errors: string[] = [];
      const text = file.text();
      
      text.then((content) => {
        csv.parseString(content, { headers: true })
          .on('data', (row) => data.push(row))
          .on('error', (error) => errors.push(error.message))
          .on('end', () => {
            const type = this.detectDataType(file.name, data[0]);
            resolve({
              type,
              data: this.normalizeData(type, data),
              errors,
            });
          });
      });
    });
  }

  private static async parseExcel(file: File): Promise<ParsedData> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0];
    const data: any[] = [];
    const headers = worksheet.getRow(1).values as string[];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const rowData: any = {};
        row.values.forEach((value, index) => {
          rowData[headers[index]] = value;
        });
        data.push(rowData);
      }
    });
    
    const type = this.detectDataType(file.name, data[0] as any);
    
    return {
      type,
      data: this.normalizeData(type, data),
      errors: [],
    };
  }

  private static async parsePdf(file: File): Promise<ParsedData> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfData = await pdfParse(arrayBuffer);
    
    // Parse scorecard PDF format
    if (file.name.toLowerCase().includes('scorecard')) {
      return this.parseScorecardPdf(pdfData.text);
    }
    
    return {
      type: 'pdf_text',
      data: [{ content: pdfData.text }],
      errors: [],
    };
  }

  private static async parseTxt(file: File): Promise<ParsedData> {
    const content = await file.text();
    
    // Parse threat advisory format
    if (file.name.toLowerCase().includes('advisory')) {
      return this.parseThreatAdvisoryTxt(content);
    }
    
    return {
      type: 'text',
      data: [{ content }],
      errors: [],
    };
  }

  private static detectDataType(fileName: string, firstRow: any): string {
    const name = fileName.toLowerCase();
    
    if (name.includes('vulnerabilit')) return 'vulnerabilities';
    if (name.includes('falcon')) return 'falcon_detections';
    if (name.includes('secureworks')) return 'secureworks_detections';
    if (name.includes('jira') || name.includes('phishing')) return 'phishing_jira';
    if (name.includes('aws') || name.includes('security_hub')) return 'aws_security_hub';
    if (name.includes('issue') && name.includes('report')) return 'issue_reports';
    if (name.includes('scorecard')) return 'scorecard_pdf';
    if (name.includes('advisory')) return 'threat_advisories';
    
    // Try to detect by column headers
    if (firstRow) {
      const headers = Object.keys(firstRow).map(h => h.toLowerCase());
      
      if (headers.includes('cve') || headers.includes('vulnerability')) return 'vulnerabilities';
      if (headers.includes('detection') || headers.includes('falcon')) return 'falcon_detections';
      if (headers.includes('phishing') || headers.includes('jira')) return 'phishing_jira';
    }
    
    return 'generic';
  }

  private static normalizeData(type: string, data: any[]): any[] {
    switch (type) {
      case 'vulnerabilities':
        return data.map(row => this.normalizeVulnerability(row));
      case 'falcon_detections':
        return data.map(row => this.normalizeFalconDetection(row));
      case 'secureworks_detections':
        return data.map(row => this.normalizeSecureworksDetection(row));
      case 'phishing_jira':
        return data.map(row => this.normalizePhishingJira(row));
      case 'aws_security_hub':
        return data.map(row => this.normalizeAwsSecurityHub(row));
      case 'issue_reports':
        return data.map(row => this.normalizeIssueReport(row));
      default:
        return data;
    }
  }

  private static normalizeVulnerability(row: any): any {
    return {
      assetName: row['Asset'] || row['asset_name'] || row['Asset Name'] || 'Unknown',
      businessUnit: row['BU'] || row['Business Unit'] || row['business_unit'] || 'Unknown',
      cveId: row['CVE'] || row['CVE ID'] || row['cve_id'] || null,
      severity: this.normalizeSeverity(row['Severity'] || row['severity']),
      slaDate: this.parseDate(row['SLA Date'] || row['sla_date']),
      status: this.normalizeStatus(row['Status'] || row['status']),
      description: row['Description'] || row['description'] || null,
      discoveredAt: this.parseDate(row['Discovered'] || row['discovered_at']) || new Date(),
    };
  }

  private static normalizeFalconDetection(row: any): any {
    return {
      eventId: row['Event ID'] || row['event_id'] || `falcon_${Date.now()}_${Math.random()}`,
      hostname: row['Host'] || row['hostname'] || row['Hostname'] || 'Unknown',
      username: row['User'] || row['username'] || row['Username'] || null,
      severity: this.normalizeSeverity(row['Severity'] || row['severity']),
      tactic: row['Tactic'] || row['tactic'] || null,
      technique: row['Technique'] || row['technique'] || null,
      status: this.normalizeStatus(row['Status'] || row['status']),
      description: row['Description'] || row['description'] || null,
      detectedAt: this.parseDate(row['Detected'] || row['detected_at']) || new Date(),
    };
  }

  private static normalizeSecureworksDetection(row: any): any {
    return {
      eventId: row['Event ID'] || row['event_id'] || `sw_${Date.now()}_${Math.random()}`,
      category: row['Category'] || row['category'] || 'Unknown',
      severity: this.normalizeSeverity(row['Severity'] || row['severity']),
      responseAction: row['Response Action'] || row['response_action'] || null,
      status: this.normalizeStatus(row['Status'] || row['status']),
      description: row['Description'] || row['description'] || null,
      detectedAt: this.parseDate(row['Detected'] || row['detected_at']) || new Date(),
    };
  }

  private static normalizePhishingJira(row: any): any {
    return {
      issueId: row['Issue ID'] || row['issue_id'] || row['Key'] || `jira_${Date.now()}`,
      status: this.normalizeStatus(row['Status'] || row['status']),
      priority: this.normalizeSeverity(row['Priority'] || row['priority']),
      businessUnit: row['BU'] || row['Business Unit'] || row['business_unit'] || 'Unknown',
      timeToResolution: this.parseTimeToResolution(row['Time to Resolution'] || row['time_to_resolution']),
      description: row['Description'] || row['Summary'] || row['description'] || null,
      reportedAt: this.parseDate(row['Reported'] || row['Created'] || row['reported_at']) || new Date(),
    };
  }

  private static normalizeAwsSecurityHub(row: any): any {
    return {
      findingId: row['Finding ID'] || row['finding_id'] || `aws_${Date.now()}_${Math.random()}`,
      account: row['Account'] || row['account'] || 'Unknown',
      region: row['Region'] || row['region'] || 'us-east-1',
      controlId: row['Control ID'] || row['control_id'] || 'Unknown',
      complianceStatus: row['Compliance Status'] || row['compliance_status'] || 'FAILED',
      severity: this.normalizeSeverity(row['Severity'] || row['severity']),
      status: this.normalizeStatus(row['Status'] || row['status']),
      description: row['Description'] || row['description'] || null,
      foundAt: this.parseDate(row['Found'] || row['found_at']) || new Date(),
    };
  }

  private static normalizeIssueReport(row: any): any {
    return {
      issueId: row['Issue ID'] || row['issue_id'] || row['ID'] || `issue_${Date.now()}`,
      severity: this.normalizeSeverity(row['Severity'] || row['severity']),
      category: row['Category'] || row['category'] || 'Unknown',
      status: this.normalizeStatus(row['Status'] || row['status']),
      businessUnit: row['BU'] || row['Business Unit'] || row['business_unit'] || 'Unknown',
      description: row['Description'] || row['description'] || 'No description',
      openedDate: this.parseDate(row['Opened Date'] || row['opened_date']) || new Date(),
    };
  }

  private static normalizeSeverity(severity: string | null | undefined): SeverityLevel {
    if (!severity) return SeverityLevel.LOW;
    
    const s = severity.toString().toLowerCase();
    if (s.includes('critical') || s.includes('urgent')) return SeverityLevel.CRITICAL;
    if (s.includes('high') || s.includes('important')) return SeverityLevel.HIGH;
    if (s.includes('medium') || s.includes('moderate')) return SeverityLevel.MEDIUM;
    if (s.includes('low') || s.includes('minor')) return SeverityLevel.LOW;
    if (s.includes('info') || s.includes('informational')) return SeverityLevel.INFO;
    
    return SeverityLevel.LOW;
  }

  private static normalizeStatus(status: string | null | undefined): IssueStatus {
    if (!status) return IssueStatus.OPEN;
    
    const s = status.toString().toLowerCase();
    if (s.includes('open') || s.includes('new') || s.includes('active')) return IssueStatus.OPEN;
    if (s.includes('progress') || s.includes('assigned') || s.includes('working')) return IssueStatus.IN_PROGRESS;
    if (s.includes('resolved') || s.includes('fixed') || s.includes('completed')) return IssueStatus.RESOLVED;
    if (s.includes('closed') || s.includes('done')) return IssueStatus.CLOSED;
    if (s.includes('wont') || s.includes('rejected') || s.includes('invalid')) return IssueStatus.WONT_FIX;
    
    return IssueStatus.OPEN;
  }

  private static parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  private static parseTimeToResolution(timeStr: string | null | undefined): number | null {
    if (!timeStr) return null;
    
    const hours = parseFloat(timeStr.toString());
    return isNaN(hours) ? null : hours;
  }

  private static parseScorecardPdf(text: string): ParsedData {
    const categories = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      // Look for score patterns like "Network 93" or "Patching 94"
      const match = line.match(/([A-Za-z\s]+)\s+(\d+)/);
      if (match) {
        const [, category, score] = match;
        categories.push({
          name: category.trim(),
          score: parseInt(score),
          weight: 1.0,
        });
      }
    }
    
    return {
      type: 'scorecard_categories',
      data: categories,
      errors: [],
    };
  }

  private static parseThreatAdvisoryTxt(text: string): ParsedData {
    const advisories = [];
    const sections = text.split(/\n\s*\n/); // Split by empty lines
    
    for (const section of sections) {
      const lines = section.split('\n');
      const advisory: any = {};
      
      for (const line of lines) {
        if (line.includes('Advisory:')) {
          advisory.advisoryName = line.replace('Advisory:', '').trim();
        } else if (line.includes('Severity:')) {
          advisory.severity = this.normalizeSeverity(line.replace('Severity:', '').trim());
        } else if (line.includes('Netgear Severity:')) {
          advisory.netgearSeverity = this.normalizeSeverity(line.replace('Netgear Severity:', '').trim());
        } else if (line.includes('Impacted:')) {
          advisory.impacted = line.replace('Impacted:', '').trim().toLowerCase() === 'yes';
        } else if (line.includes('ETA:')) {
          advisory.eta = this.parseDate(line.replace('ETA:', '').trim());
        } else if (line.includes('Remarks:')) {
          advisory.remarks = line.replace('Remarks:', '').trim();
        }
      }
      
      if (advisory.advisoryName) {
        advisories.push(advisory);
      }
    }
    
    return {
      type: 'threat_advisories',
      data: advisories,
      errors: [],
    };
  }
}