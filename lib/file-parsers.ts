import * as ExcelJS from 'exceljs';
import * as csv from 'fast-csv';
import pdfParse from 'pdf-parse';
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
        if (row.values && Array.isArray(row.values)) {
          (row.values as any[]).forEach((value, index) => {
            if (headers[index]) {
              rowData[headers[index]] = value;
            }
          });
        }
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
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await pdfParse(buffer);
    
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
    
    // NETGEAR Scorecard files - be specific about these
    if (name.includes('netgear') && name.includes('fullissues') && name.includes('report')) return 'scorecard_issues';
    if (name.includes('netgear') && name.includes('scorecard') && name.includes('report') && !name.includes('fullissues')) return 'scorecard_report';
    
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
      
      // Check for NETGEAR scorecard issue headers
      if (headers.includes('issue id') && headers.includes('factor name') && headers.includes('issue type title')) {
        return 'scorecard_issues';
      }
      
      // Check for NETGEAR scorecard rating headers  
      if (headers.includes('overall score') || headers.includes('letter grade') || headers.includes('threat indicators')) {
        return 'scorecard_report';
      }
      
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
      case 'scorecard_issues':
        return data.map(row => this.normalizeScorecardIssue(row));
      case 'scorecard_report':
        return data.map(row => this.normalizeScorecardReport(row));
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

  private static normalizeScorecardIssue(row: any): any {
    return {
      issueId: row['ISSUE ID'] || row['Issue ID'] || row['issue_id'] || `scorecard_${Date.now()}_${Math.random()}`,
      factorName: row['FACTOR NAME'] || row['Factor Name'] || row['factor_name'] || 'Unknown',
      issueTypeTitle: row['ISSUE TYPE TITLE'] || row['Issue Type Title'] || row['issue_type_title'] || 'No Title',
      issueTypeCode: row['ISSUE TYPE CODE'] || row['Issue Type Code'] || row['issue_type_code'] || null,
      issueTypeSeverity: this.normalizeSeverity(row['ISSUE TYPE SEVERITY'] || row['Issue Type Severity'] || row['issue_type_severity']),
      issueRecommendation: row['ISSUE RECOMMENDATION'] || row['Issue Recommendation'] || row['issue_recommendation'] || null,
      firstSeen: this.parseDate(row['FIRST SEEN'] || row['First Seen'] || row['first_seen']),
      lastSeen: this.parseDate(row['LAST SEEN'] || row['Last Seen'] || row['last_seen']),
      ipAddresses: row['IP ADDRESSES'] || row['IP Addresses'] || row['ip_addresses'] || null,
      hostname: row['HOSTNAME'] || row['Hostname'] || row['hostname'] || null,
      subdomain: row['SUBDOMAIN'] || row['Subdomain'] || row['subdomain'] || null,
      target: row['TARGET'] || row['Target'] || row['target'] || null,
      ports: row['PORTS'] || row['Ports'] || row['ports'] || null,
      status: row['STATUS'] || row['Status'] || row['status'] || 'active',
      cveId: row['CVE'] || row['cve'] || null,
      description: row['DESCRIPTION'] || row['Description'] || row['description'] || null,
      timeSincePublished: row['TIME SINCE PUBLISHED'] || row['Time Since Published'] || row['time_since_published'] || null,
      timeOpenSincePublished: row['TIME OPEN SINCE PUBLISHED'] || row['Time Open Since Published'] || row['time_open_since_published'] || null,
      cookieName: row['COOKIE NAME'] || row['Cookie Name'] || row['cookie_name'] || null,
      data: row['DATA'] || row['Data'] || row['data'] || null,
      commonName: row['COMMON NAME'] || row['Common Name'] || row['common_name'] || null,
      keyLength: row['KEY LENGTH'] || row['Key Length'] || row['key_length'] || null,
      usingRC4: this.parseBoolean(row['USING RC4?'] || row['Using RC4?'] || row['using_rc4']),
      issuerOrganizationName: row['ISSUER ORGANIZATION NAME'] || row['Issuer Organization Name'] || row['issuer_organization_name'] || null,
      provider: row['PROVIDER'] || row['Provider'] || row['provider'] || null,
      detectedService: row['DETECTED SERVICE'] || row['Detected Service'] || row['detected_service'] || null,
      product: row['PRODUCT'] || row['Product'] || row['product'] || null,
      version: row['VERSION'] || row['Version'] || row['version'] || null,
      platform: row['PLATFORM'] || row['Platform'] || row['platform'] || null,
      browser: row['BROWSER'] || row['Browser'] || row['browser'] || null,
      destinationIps: row['DESTINATION IPS'] || row['Destination IPs'] || row['destination_ips'] || null,
      malwareFamily: row['MALWARE FAMILY'] || row['Malware Family'] || row['malware_family'] || null,
      malwareType: row['MALWARE TYPE'] || row['Malware Type'] || row['malware_type'] || null,
      detectionMethod: row['DETECTION METHOD'] || row['Detection Method'] || row['detection_method'] || null,
      label: row['LABEL'] || row['Label'] || row['label'] || null,
      initialUrl: row['INITIAL URL'] || row['Initial URL'] || row['initial_url'] || null,
      finalUrl: row['FINAL URL'] || row['Final URL'] || row['final_url'] || null,
      requestChain: row['REQUEST CHAIN'] || row['Request Chain'] || row['request_chain'] || null,
      headers: row['HEADERS'] || row['Headers'] || row['headers'] || null,
      analysis: row['ANALYSIS'] || row['Analysis'] || row['analysis'] || null,
      percentSimilarCompanies: this.parseFloat(row['% OF SIMILAR COMPANIES WITH THE ISSUE'] || row['% of Similar Companies with the Issue'] || row['percent_similar_companies']),
      averageFindings: this.parseFloat(row['AVERAGE FINDINGS (similar companies)'] || row['Average Findings (similar companies)'] || row['average_findings']),
      issueTypeScoreImpact: this.parseFloat(row['ISSUE TYPE SCORE IMPACT'] || row['Issue Type Score Impact'] || row['issue_type_score_impact']) || 0.0,
    };
  }

  private static normalizeScorecardReport(row: any): any {
    return {
      company: row['COMPANY'] || row['Company'] || row['company'] || 'NETGEAR',
      generatedBy: row['GENERATED BY'] || row['Generated By'] || row['generated_by'] || 'SecurityScorecard',
      overallScore: this.parseFloat(row['OVERALL SCORE'] || row['Overall Score'] || row['overall_score']) || 0,
      letterGrade: row['LETTER GRADE'] || row['Letter Grade'] || row['letter_grade'] || 'F',
      breakdown: row['BREAKDOWN'] || row['Breakdown'] || row['breakdown'] || null,
      threatIndicatorsScore: this.parseFloat(row['THREAT INDICATORS'] || row['Threat Indicators'] || row['threat_indicators']),
      networkSecurityScore: this.parseFloat(row['NETWORK SECURITY'] || row['Network Security'] || row['network_security']),
      dnsHealthScore: this.parseFloat(row['DNS HEALTH'] || row['DNS Health'] || row['dns_health']),
      patchingCadenceScore: this.parseFloat(row['PATCHING CADENCE'] || row['Patching Cadence'] || row['patching_cadence']),
      endpointSecurityScore: this.parseFloat(row['ENDPOINT SECURITY'] || row['Endpoint Security'] || row['endpoint_security']),
      ipReputationScore: this.parseFloat(row['IP REPUTATION'] || row['IP Reputation'] || row['ip_reputation']),
      applicationSecurityScore: this.parseFloat(row['APPLICATION SECURITY'] || row['Application Security'] || row['application_security']),
      cubitScore: this.parseFloat(row['CUBIT'] || row['Cubit'] || row['cubit']),
      hackerChatterScore: this.parseFloat(row['HACKER CHATTER'] || row['Hacker Chatter'] || row['hacker_chatter']),
      informationLeakScore: this.parseFloat(row['INFORMATION LEAK'] || row['Information Leak'] || row['information_leak']),
      socialEngineeringScore: this.parseFloat(row['SOCIAL ENGINEERING'] || row['Social Engineering'] || row['social_engineering']),
      industry: row['INDUSTRY'] || row['Industry'] || row['industry'] || null,
      companyWebsite: row['COMPANY WEBSITE'] || row['Company Website'] || row['company_website'] || null,
      findingsOnOpenPorts: this.parseFloat(row['FINDINGS ON OPEN PORTS'] || row['Findings on Open Ports'] || row['findings_on_open_ports']),
      siteVulnerabilities: this.parseFloat(row['SITE VULNERABILITIES'] || row['Site Vulnerabilities'] || row['site_vulnerabilities']),
      malwareDiscovered: this.parseFloat(row['MALWARE DISCOVERED'] || row['Malware Discovered'] || row['malware_discovered']),
      leakedInformation: this.parseFloat(row['LEAKED INFORMATION'] || row['Leaked Information'] || row['leaked_information']),
      numberOfIpAddressesScanned: this.parseInt(row['NUMBER OF IP ADDRESSES SCANNED'] || row['Number of IP Addresses Scanned'] || row['number_of_ip_addresses_scanned']),
      numberOfDomainNamesScanned: this.parseInt(row['NUMBER OF DOMAIN NAMES SCANNED'] || row['Number of Domain Names Scanned'] || row['number_of_domain_names_scanned']),
      businessUnit: row['BUSINESS UNIT'] || row['Business Unit'] || row['business_unit'] || 'NETGEAR',
    };
  }

  private static parseFloat(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseFloat(value.toString());
    return isNaN(parsed) ? null : parsed;
  }

  private static parseInt(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseInt(value.toString());
    return isNaN(parsed) ? null : parsed;
  }

  private static parseBoolean(value: any): boolean | null {
    if (value === null || value === undefined || value === '') return null;
    const str = value.toString().toLowerCase();
    if (str === 'true' || str === 'yes' || str === '1') return true;
    if (str === 'false' || str === 'no' || str === '0') return false;
    return null;
  }
}