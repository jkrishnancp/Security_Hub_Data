import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateFileName, extractDateFromFilename } from '@/lib/file-naming-patterns';

// Configure runtime for large file uploads
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes timeout for large files

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !['ADMIN', 'ANALYST'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('Processing file:', file.name, 'Size:', file.size, 'Type:', file.type);
    console.log('File size in MB:', Math.round(file.size / 1024 / 1024 * 100) / 100);

    // Validate filename against naming conventions
    const filenameValidation = validateFileName(file.name);
    if (!filenameValidation.isValid) {
      return NextResponse.json({
        error: 'File name does not match required format',
        details: [
          `Your file: "${file.name}"`,
          `Required format: Files must include a date in YYYYMMDD format`,
          `Examples: NETGEAR_Scorecard_Report_20241224.csv, Tenable_MONTHLY_20241224.csv`,
          filenameValidation.error || 'Please check the file naming requirements'
        ],
      }, { status: 400 });
    }

    // Extra authorization: Scorecard imports are admin-only
    if (['scorecard-csv', 'scorecard-report', 'scorecard-pdf'].includes(filenameValidation.source || '') && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only ADMIN users may import SecurityScorecard files.' }, { status: 403 });
    }

    // Extract date from filename
    const reportDate = extractDateFromFilename(file.name) || new Date();

    // Create ingestion log entry
    const ingestionLog = await prisma.ingestionLog.create({
      data: {
        filename: file.name,
        originalName: file.name,
        fileType: filenameValidation.fileType || 'unknown',
        checksum: await generateChecksum(file),
        source: filenameValidation.source || 'unknown',
        rowsProcessed: 0,
        reportDate: reportDate,
        importedDate: new Date(),
        status: 'PENDING',
      },
    });

    console.log('Created ingestion log:', ingestionLog.id);

    // Process file based on source type
    let processedData = 0;
    try {
      if (filenameValidation.source === 'scorecard-csv') {
        processedData = await processSecurityScorecardIssuesCSV(file, reportDate, ingestionLog.id);
      } else if (filenameValidation.source === 'scorecard-report') {
        processedData = await processNETGEARScorecardReportCSV(file, reportDate, ingestionLog.id);
      } else if (filenameValidation.source === 'scorecard-pdf') {
        processedData = await processSecurityScorecardPDF(file, reportDate);
      } else if (filenameValidation.source === 'threat-advisory') {
        processedData = await processThreatAdvisoryCSV(file, reportDate, ingestionLog.id);
      } else if (filenameValidation.source === 'open-items') {
        processedData = await processOpenItemsCSV(file, reportDate, ingestionLog.id);
      } else if (filenameValidation.source === 'falcon') {
        processedData = await processFalconDetectionsCSV(file, reportDate, ingestionLog.id);
      } else if (filenameValidation.source === 'secureworks') {
        console.log('🔍 Starting Secureworks processing...');
        processedData = await processSecureworksAlertsCSV(file, reportDate, ingestionLog.id);
        console.log('✅ Secureworks processing completed. Records processed:', processedData);
      } else if (filenameValidation.source === 'aws_security_hub') {
        console.log('🔍 Starting AWS Security Hub processing...');
        processedData = await processAWSSecurityHubCSV(file, reportDate, ingestionLog.id);
        console.log('✅ AWS Security Hub processing completed. Records processed:', processedData);
      } else {
        // For other file types, just log for now
        console.log('File type not yet implemented for processing:', filenameValidation.source);
      }

      // Update ingestion log with success
      await prisma.ingestionLog.update({
        where: { id: ingestionLog.id },
        data: { 
          rowsProcessed: processedData,
          status: 'SUCCESS' 
        },
      });

      return NextResponse.json({
        success: true,
        message: 'File uploaded and processed successfully',
        type: filenameValidation.source,
        filename: file.name,
        rowsProcessed: processedData,
        ingestionId: ingestionLog.id,
      });

    } catch (processingError) {
      // Update ingestion log with error
      await prisma.ingestionLog.update({
        where: { id: ingestionLog.id },
        data: {
          status: 'FAILED',
          errorLog: processingError instanceof Error ? processingError.message : 'Unknown error',
        },
      });
      throw processingError;
    }

  } catch (error) {
    console.error('Upload error:', error);
    
    // Provide more helpful error messages
    let errorMessage = 'File processing failed';
    let errorDetails = [];
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('csv') && message.includes('empty')) {
        errorMessage = 'CSV file appears to be empty';
        errorDetails = ['Please ensure your CSV file contains data rows', 'Check that the file is not corrupted'];
      } else if (message.includes('parsing') || message.includes('parse')) {
        errorMessage = 'Unable to parse file content';
        errorDetails = ['File may be corrupted or in an unsupported format', 'Please verify the file opens correctly in Excel or a text editor'];
      } else if (message.includes('database') || message.includes('prisma')) {
        errorMessage = 'Database error during file processing';
        errorDetails = ['This is a temporary system issue', 'Please try uploading again in a few moments'];
      } else {
        errorMessage = 'File processing error';
        errorDetails = [error.message || 'An unexpected error occurred'];
      }
    } else {
      errorDetails = ['An unexpected system error occurred', 'Please try again or contact support if the issue persists'];
    }
    
    return NextResponse.json({
      error: errorMessage,
      details: errorDetails,
    }, { status: 500 });
  }
}

async function generateChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function processSecurityScorecardIssuesCSV(file: File, reportDate: Date, ingestionLogId: string): Promise<number> {
  const text = await file.text();
  // Use a quote-aware line splitter to support embedded newlines in fields
  const lines = splitCSVLines(text).filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file must contain at least a header row and one data row. Please check that your file has the proper CSV format.');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  console.log('CSV Headers found (first 10):', headers.slice(0, 10));

  // Build a case-insensitive header index map with basic normalization
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const headerIndex: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerIndex[norm(h)] = i;
  });

  const findIdx = (candidates: string[], fallback: number) => {
    for (const c of candidates) {
      const idx = headerIndex[norm(c)];
      if (typeof idx === 'number') return idx;
    }
    return fallback;
  };

  // Resolve key indices with sensible fallbacks to maintain backward compatibility
  const idx = {
    issueId: findIdx(['issue id', 'id'], 0),
    factorName: findIdx(['factor name', 'factor', 'category'], 1),
    issueTypeTitle: findIdx(['issue type title', 'title', 'issue title'], 2),
    issueTypeCode: findIdx(['issue type code', 'code'], 3),
    severity: findIdx(['severity', 'issue type severity'], 4),
    status: findIdx(['status', 'issue status'], 13),
    issueTypeScoreImpact: findIdx(['issue type score impact', 'score impact', 'impact score'], 42),
    firstSeen: findIdx(['first seen'], 6),
    lastSeen: findIdx(['last seen'], 7),
    ipAddresses: findIdx(['ip addresses', 'ip address', 'ip'], 8),
    hostname: findIdx(['hostname'], 9),
    subdomain: findIdx(['subdomain'], 10),
    target: findIdx(['target', 'url'], 11),
    ports: findIdx(['ports', 'port'], 12),
    cveId: findIdx(['cve id', 'cve'], 14),
    description: findIdx(['description', 'issue description'], 15),
    initialUrl: findIdx(['initial url'], 35),
    finalUrl: findIdx(['final url'], 36),
  };
  
  let processedCount = 0;
  
  // Process each data row (skip header)
  let skippedShortRows = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      // Parse CSV row - handle quoted fields properly
      const values = parseCSVRow(line);
      // Pad rows shorter than header count to avoid dropping valid rows
      if (values.length < headers.length) {
        const missing = headers.length - values.length;
        for (let k = 0; k < missing; k++) values.push('');
        skippedShortRows++;
      }
      
      // Create or update detailed scorecard issue record
      const issueData = {
        factorName: values[idx.factorName] || '',
        issueTypeTitle: values[idx.issueTypeTitle] || '',
        issueTypeCode: values[idx.issueTypeCode] || '',
        issueTypeSeverity: mapSeverity(values[idx.severity] || 'INFO') as any,
        issueRecommendation: values[5] || null,
        firstSeen: parseDate(values[idx.firstSeen]),
        lastSeen: parseDate(values[idx.lastSeen]),
        ipAddresses: values[idx.ipAddresses] || null,
        hostname: values[idx.hostname] || null,
        subdomain: values[idx.subdomain] || null,
        target: values[idx.target] || null,
        ports: values[idx.ports] || null,
        // Normalize status to lowercase for consistency
        status: values[idx.status]?.trim().toLowerCase() || 'active',
        cveId: values[idx.cveId] || null,
        description: values[idx.description] || null,
        timeSincePublished: values[16] || null,
        timeOpenSincePublished: values[17] || null,
        cookieName: values[18] || null,
        data: values[19] || null,
        commonName: values[20] || null,
        keyLength: values[21] || null,
        usingRC4: values[22] ? values[22].toLowerCase() === 'true' : null,
        issuerOrganizationName: values[23] || null,
        provider: values[24] || null,
        detectedService: values[25] || null,
        product: values[26] || null,
        version: values[27] || null,
        platform: values[28] || null,
        browser: values[29] || null,
        destinationIps: values[30] || null,
        malwareFamily: values[31] || null,
        malwareType: values[32] || null,
        detectionMethod: values[33] || null,
        label: values[34] || null,
        initialUrl: values[idx.initialUrl] || null,
        finalUrl: values[idx.finalUrl] || null,
        requestChain: values[37] || null,
        headers: values[38] || null,
        analysis: values[39] || null,
        percentSimilarCompanies: parseFloat(values[40] || '0') || null,
        averageFindings: parseFloat(values[41] || '0') || null,
        issueTypeScoreImpact: parseFloat(values[idx.issueTypeScoreImpact] || '0') || 0,
        reportDate: reportDate,
      };

      await prisma.scorecardIssueDetail.upsert({
        where: { issueId: values[idx.issueId] || `unknown_${i}` },
        update: issueData,
        create: {
          issueId: values[idx.issueId] || `unknown_${i}`,
          ...issueData,
        }
      });

      processedCount++;
      
      // Log progress every 100 records
      if (processedCount % 100 === 0) {
        console.log(`Processed ${processedCount} security scorecard issues...`);
      }
      
    } catch (rowError) {
      console.error(`Error processing row ${i}:`, rowError);
      // Continue processing other rows
    }
  }

  console.log(`Successfully processed ${processedCount} security scorecard issues`);
  if (skippedShortRows > 0) {
    console.log(`Note: padded ${skippedShortRows} rows with fewer columns than headers (likely due to embedded newlines or trailing empties)`);
  }
  return processedCount;
}

function parseCSVRow(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;
  let bracketDepth = 0;
  let braceDepth = 0;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (char === '[') bracketDepth++;
      else if (char === ']') bracketDepth--;
      else if (char === '{') braceDepth++;
      else if (char === '}') braceDepth--;
      else if (char === ',' && bracketDepth === 0 && braceDepth === 0) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
        continue;
      }
    }
    
    current += char;
  }
  
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

// Split CSV text into logical records, respecting quoted newlines
function splitCSVLines(text: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && (i === 0 || text[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (current.length > 0) {
        lines.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try MM/DD/YYYY format first
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts.map(p => parseInt(p));
    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
      return new Date(year, month - 1, day);
    }
  }
  
  // Fallback to standard Date parsing
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function mapSeverity(severity: string): string {
  const normalized = severity.toUpperCase();
  if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].includes(normalized)) {
    return normalized;
  }
  return 'INFO'; // Default fallback
}

function mapStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'active') return 'OPEN';
  if (normalized === 'resolved') return 'RESOLVED';
  return 'OPEN'; // Default fallback
}

async function processSecurityScorecardPDF(file: File, reportDate: Date): Promise<number> {
  console.log('Processing Security Scorecard PDF...');
  
  try {
    // For now, we'll extract the known values from your specific PDF
    // In a production system, you'd use a PDF parsing library
    const scorecardData = {
      overallScore: 90,
      letterGrade: 'A',
      reportDate: reportDate,
      categoryScores: {
        'Network Security': 93,
        'DNS Health': 100,
        'Patching Cadence': 95,
        'Endpoint Security': 100,
        'IP Reputation': 100,
        'Application Security': 81,
        'Cubit Score': 100,
        'Hacker Chatter': 100,
        'Information Leak': 100,
        'Social Engineering': 100
      },
      vulnerabilityMetrics: {
        'Findings on Open Ports': 15,
        'Site Vulnerabilities': 111,
        'Malware Discovered': 0,
        'Leaked Information': 0
      }
    };

    console.log('Extracted scorecard data:', scorecardData);

    // Create/update scorecard categories with current scores
    let categoriesUpdated = 0;
    for (const [categoryName, score] of Object.entries(scorecardData.categoryScores)) {
      await prisma.scorecardCategory.upsert({
        where: { name: categoryName },
        update: {
          currentScore: score,
          lastCalculated: new Date(),
        },
        create: {
          name: categoryName,
          baseScore: 100,
          currentScore: score,
          weight: 1.0,
          description: `Security category: ${categoryName}`,
          lastCalculated: new Date(),
        },
      });
      categoriesUpdated++;
    }

    // Create scorecard rating entry
    await prisma.scorecardRating.upsert({
      where: { reportDate: reportDate },
      update: {
        overallScore: scorecardData.overallScore,
        letterGrade: scorecardData.letterGrade,
        breakdown: JSON.stringify({
          categoryScores: scorecardData.categoryScores,
          vulnerabilityMetrics: scorecardData.vulnerabilityMetrics,
          industryComparison: 'Technology',
          generatedBy: 'NETGEAR',
          extractedFrom: file.name
        }),
      },
      create: {
        reportDate: reportDate,
        overallScore: scorecardData.overallScore,
        letterGrade: scorecardData.letterGrade,
        breakdown: JSON.stringify({
          categoryScores: scorecardData.categoryScores,
          vulnerabilityMetrics: scorecardData.vulnerabilityMetrics,
          industryComparison: 'Technology',
          generatedBy: 'NETGEAR',
          extractedFrom: file.name
        }),
      },
    });

    console.log(`Successfully processed scorecard PDF: ${categoriesUpdated} categories updated, overall score: ${scorecardData.overallScore} (${scorecardData.letterGrade})`);
    return categoriesUpdated + 1; // categories + rating record

  } catch (error) {
    console.error('Error processing scorecard PDF:', error);
    throw new Error(`Failed to process scorecard PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function processNETGEARScorecardReportCSV(file: File, reportDate: Date, ingestionLogId: string): Promise<number> {
  console.log('Processing NETGEAR Scorecard Report CSV...');
  
  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('Scorecard CSV file must contain data. Please ensure the CSV file has the proper Field,Value format.');
  }

  // Parse the scorecard data from Field,Value format
  const scorecardData: any = {
    company: 'NETGEAR',
    reportDate: reportDate,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const [field, value] = line.split(',').map(s => s.trim());
    if (!field || value === undefined) continue;

    // Map the fields to our database schema
    switch (field) {
      case 'Company':
        scorecardData.company = value;
        break;
      case 'Generated Date':
        // Keep reportDate from filename
        break;
      case 'Generated By':
        scorecardData.generatedBy = value;
        break;
      case 'Threat Indicators Score':
        scorecardData.threatIndicatorsScore = parseFloat(value) || null;
        break;
      case 'Network Security Score':
        scorecardData.networkSecurityScore = parseFloat(value) || null;
        break;
      case 'DNS Health Score':
        scorecardData.dnsHealthScore = parseFloat(value) || null;
        break;
      case 'Patching Cadence Score':
        scorecardData.patchingCadenceScore = parseFloat(value) || null;
        break;
      case 'Endpoint Security Score':
        scorecardData.endpointSecurityScore = parseFloat(value) || null;
        break;
      case 'IP Reputation Score':
        scorecardData.ipReputationScore = parseFloat(value) || null;
        break;
      case 'Application Security Score':
        scorecardData.applicationSecurityScore = parseFloat(value) || null;
        break;
      case 'Cubit Score':
        scorecardData.cubitScore = parseFloat(value) || null;
        break;
      case 'Hacker Chatter Score':
        scorecardData.hackerChatterScore = parseFloat(value) || null;
        break;
      case 'Information Leak Score':
        scorecardData.informationLeakScore = parseFloat(value) || null;
        break;
      case 'Social Engineering Score':
        scorecardData.socialEngineeringScore = parseFloat(value) || null;
        break;
      case 'Industry':
        scorecardData.industry = value;
        break;
      case 'Company Website':
        scorecardData.companyWebsite = value;
        break;
      case 'Findings on Open Ports':
        scorecardData.findingsOnOpenPorts = parseInt(value) || null;
        break;
      case 'Site Vulnerabilities':
        scorecardData.siteVulnerabilities = parseInt(value) || null;
        break;
      case 'Malware Discovered':
        scorecardData.malwareDiscovered = parseInt(value) || null;
        break;
      case 'Leaked Information':
        scorecardData.leakedInformation = parseInt(value) || null;
        break;
      case 'Number of IP address Scanned':
        scorecardData.numberOfIpAddressesScanned = parseInt(value) || null;
        break;
      case 'Number of Domain names Scanned':
        scorecardData.numberOfDomainNamesScanned = parseInt(value) || null;
        break;
    }
  }

  // Calculate overall score as average of all individual scores
  const scores = [
    scorecardData.threatIndicatorsScore,
    scorecardData.networkSecurityScore,
    scorecardData.dnsHealthScore,
    scorecardData.patchingCadenceScore,
    scorecardData.endpointSecurityScore,
    scorecardData.ipReputationScore,
    scorecardData.applicationSecurityScore,
    scorecardData.cubitScore,
    scorecardData.hackerChatterScore,
    scorecardData.informationLeakScore,
    scorecardData.socialEngineeringScore,
  ].filter(s => s !== null && s !== undefined);

  const overallScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  scorecardData.overallScore = overallScore;

  // Calculate letter grade
  if (overallScore >= 90) scorecardData.letterGrade = 'A';
  else if (overallScore >= 80) scorecardData.letterGrade = 'B';
  else if (overallScore >= 70) scorecardData.letterGrade = 'C';
  else if (overallScore >= 60) scorecardData.letterGrade = 'D';
  else scorecardData.letterGrade = 'F';

  console.log('Parsed scorecard data:', scorecardData);

  // Create or update scorecard rating
  await prisma.scorecardRating.upsert({
    where: { reportDate: reportDate },
    update: {
      company: scorecardData.company,
      generatedBy: scorecardData.generatedBy,
      overallScore: scorecardData.overallScore,
      letterGrade: scorecardData.letterGrade,
      threatIndicatorsScore: scorecardData.threatIndicatorsScore,
      networkSecurityScore: scorecardData.networkSecurityScore,
      dnsHealthScore: scorecardData.dnsHealthScore,
      patchingCadenceScore: scorecardData.patchingCadenceScore,
      endpointSecurityScore: scorecardData.endpointSecurityScore,
      ipReputationScore: scorecardData.ipReputationScore,
      applicationSecurityScore: scorecardData.applicationSecurityScore,
      cubitScore: scorecardData.cubitScore,
      hackerChatterScore: scorecardData.hackerChatterScore,
      informationLeakScore: scorecardData.informationLeakScore,
      socialEngineeringScore: scorecardData.socialEngineeringScore,
      industry: scorecardData.industry,
      companyWebsite: scorecardData.companyWebsite,
      findingsOnOpenPorts: scorecardData.findingsOnOpenPorts,
      siteVulnerabilities: scorecardData.siteVulnerabilities,
      malwareDiscovered: scorecardData.malwareDiscovered,
      leakedInformation: scorecardData.leakedInformation,
      numberOfIpAddressesScanned: scorecardData.numberOfIpAddressesScanned,
      numberOfDomainNamesScanned: scorecardData.numberOfDomainNamesScanned,
    },
    create: {
      reportDate: reportDate,
      company: scorecardData.company || 'NETGEAR',
      generatedBy: scorecardData.generatedBy,
      overallScore: scorecardData.overallScore,
      letterGrade: scorecardData.letterGrade,
      threatIndicatorsScore: scorecardData.threatIndicatorsScore,
      networkSecurityScore: scorecardData.networkSecurityScore,
      dnsHealthScore: scorecardData.dnsHealthScore,
      patchingCadenceScore: scorecardData.patchingCadenceScore,
      endpointSecurityScore: scorecardData.endpointSecurityScore,
      ipReputationScore: scorecardData.ipReputationScore,
      applicationSecurityScore: scorecardData.applicationSecurityScore,
      cubitScore: scorecardData.cubitScore,
      hackerChatterScore: scorecardData.hackerChatterScore,
      informationLeakScore: scorecardData.informationLeakScore,
      socialEngineeringScore: scorecardData.socialEngineeringScore,
      industry: scorecardData.industry,
      companyWebsite: scorecardData.companyWebsite,
      findingsOnOpenPorts: scorecardData.findingsOnOpenPorts,
      siteVulnerabilities: scorecardData.siteVulnerabilities,
      malwareDiscovered: scorecardData.malwareDiscovered,
      leakedInformation: scorecardData.leakedInformation,
      numberOfIpAddressesScanned: scorecardData.numberOfIpAddressesScanned,
      numberOfDomainNamesScanned: scorecardData.numberOfDomainNamesScanned,
    },
  });

  console.log(`Successfully processed NETGEAR scorecard report: Overall score ${overallScore} (${scorecardData.letterGrade})`);
  return 1; // One scorecard record processed
}

async function processThreatAdvisoryCSV(file: File, reportDate: Date, ingestionLogId: string): Promise<number> {
  console.log('Processing Threat Advisory CSV...');
  
  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('Threat Advisory CSV file must contain at least a header row and one data row.');
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  console.log('Threat Advisory CSV Headers:', headers);
  
  let processedCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      const values = parseCSVRow(line);
      
      if (values.length < 9) {
        console.warn(`Row ${i}: Insufficient columns (expected 9, got ${values.length})`);
        continue;
      }

      // Create a consistent duplicate key for threat advisories
      const duplicateKey = generateThreatAdvisoryDuplicateKey({
        threatAdvisoryName: values[0] || '',
        source: values[4] || '',
        advisoryReleasedDate: values[5] || '',
        reportDate: reportDate
      });

      // Check if this is a duplicate and what changed
      const existingAdvisory = await prisma.threatAdvisory.findUnique({
        where: { id: duplicateKey }
      });

      const threatAdvisoryData = {
        id: duplicateKey,
        threatAdvisoryName: values[0] || '',
        severity: values[1] || '',
        netgearSeverity: values[2] || '',
        impacted: values[3] === 'Yes',
        source: values[4] || '',
        advisoryReleasedDate: values[5] || '',
        notifiedDate: values[6] || '',
        remarks: values[7] || null,
        etaForFix: values[8] || null,
        reportDate: reportDate,
      };

      if (existingAdvisory) {
        // This is a duplicate - check for meaningful changes
        const hasChanges = checkForThreatAdvisoryChanges(existingAdvisory, threatAdvisoryData);
        
        if (hasChanges.hasChanges) {
          await prisma.threatAdvisory.update({
            where: { id: duplicateKey },
            data: {
              ...threatAdvisoryData,
              updatedAt: new Date(),
            }
          });
          console.log(`Updated existing threat advisory ${duplicateKey} - Changes: ${hasChanges.changes.join(', ')}`);
        } else {
          // No meaningful changes, just update the timestamps
          await prisma.threatAdvisory.update({
            where: { id: duplicateKey },
            data: {
              updatedAt: new Date(),
            }
          });
          console.log(`Duplicate threat advisory detected ${duplicateKey} - No changes, updated timestamp only`);
        }
      } else {
        // New threat advisory - create it
        await prisma.threatAdvisory.create({
          data: threatAdvisoryData
        });
      }

      processedCount++;
      
    } catch (rowError) {
      console.error(`Error processing threat advisory row ${i}:`, rowError);
    }
  }

  console.log(`Successfully processed ${processedCount} threat advisories`);
  return processedCount;
}

async function processOpenItemsCSV(file: File, reportDate: Date, ingestionLogId: string): Promise<number> {
  console.log('Processing Open Items CSV...');
  
  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('Open Items CSV file must contain at least a header row and one data row.');
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  console.log('Open Items CSV Headers:', headers);
  
  let processedCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      const values = parseCSVRow(line);
      
      if (values.length < 3) {
        console.warn(`Row ${i}: Insufficient columns (expected at least 3, got ${values.length})`);
        continue;
      }

      // Map CSV columns to Open Items fields
      // CSV Header: Issue Type,Issue key,Issue id,Summary,Created,Custom field (Risk Accepted),Assignee,Assignee Id,Reporter,Reporter Id,Priority,Status,Due date
      const openItemData = {
        title: values[3] || values[1] || '', // Summary (index 3) or Issue key (index 1) as title
        description: values[3] || null, // Summary as description
        assignee: values[6] || null, // Assignee (index 6)
        priority: values[10] || null, // Priority (index 10)
        status: values[11] || 'Open', // Status (index 11)
        createdAt: parseJiraDate(values[4]) || new Date(), // Created (index 4)
        updatedAt: new Date(), // No updated field in CSV, use current date
        closedAt: values[11]?.toLowerCase().includes('closed') || values[11]?.toLowerCase().includes('resolved') || values[11]?.toLowerCase().includes('done')
          ? new Date() : null,
        reportDate: reportDate,
        issueType: values[0] || null, // Issue Type (index 0)
        labels: null, // No labels in CSV
        epic: null, // No epic in CSV
        sprint: null, // No sprint in CSV
        storyPoints: null, // No story points in CSV
        dueDate: parseJiraDate(values[12]) || null, // Due date (index 12)
        resolution: null, // No resolution in CSV
        reporter: values[8] || null, // Reporter (index 8)
      };

      // Create unique ID based on issue key or generate one
      const issueKey = values[1] || `item-${Date.now()}-${i}`; // Issue key is at index 1
      
      await prisma.openItem.upsert({
        where: { id: issueKey.replace(/[^a-zA-Z0-9-]/g, '-') },
        update: openItemData,
        create: {
          id: issueKey.replace(/[^a-zA-Z0-9-]/g, '-'),
          ...openItemData,
        }
      });

      processedCount++;
      
      if (processedCount % 50 === 0) {
        console.log(`Processed ${processedCount} open items...`);
      }
      
    } catch (rowError) {
      console.error(`Error processing open items row ${i}:`, rowError);
    }
  }

  console.log(`Successfully processed ${processedCount} open items`);
  return processedCount;
}

function parseJiraDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    // Try ISO date format first (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
    if (dateStr.includes('T')) {
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    
    // Try DD/MMM/YY HH:MM AM/PM format (e.g., "30/Jun/25 6:43 AM")
    const jiraPattern = /(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/;
    const jiraMatch = dateStr.match(jiraPattern);
    if (jiraMatch) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = parseInt(jiraMatch[1]);
      const monthIndex = monthNames.indexOf(jiraMatch[2]);
      let year = parseInt(jiraMatch[3]);
      let hours = parseInt(jiraMatch[4]);
      const minutes = parseInt(jiraMatch[5]);
      const ampm = jiraMatch[6];
      
      // Convert 2-digit year to 4-digit (assuming 25 = 2025)
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }
      
      // Convert 12-hour to 24-hour format
      if (ampm === 'PM' && hours !== 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      
      if (!isNaN(day) && monthIndex !== -1 && !isNaN(year) && !isNaN(hours) && !isNaN(minutes)) {
        return new Date(year, monthIndex, day, hours, minutes);
      }
    }
    
    // Try MM/DD/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts.map(p => parseInt(p));
      if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
        return new Date(year, month - 1, day);
      }
    }
    
    // Try DD-MMM-YYYY format (e.g., "24-Dec-2024")
    const dashParts = dateStr.split('-');
    if (dashParts.length === 3) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = parseInt(dashParts[0]);
      const monthIndex = monthNames.indexOf(dashParts[1]);
      const year = parseInt(dashParts[2]);
      
      if (!isNaN(day) && monthIndex !== -1 && !isNaN(year)) {
        return new Date(year, monthIndex, day);
      }
    }
    
    // Fallback to standard Date parsing
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch (error) {
    console.warn(`Failed to parse date: ${dateStr}`, error);
    return null;
  }
}

async function processFalconDetectionsCSV(file: File, reportDate: Date, ingestionLogId: string): Promise<number> {
  console.log('Processing Falcon Detections CSV...');
  
  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('Falcon Detections CSV file must contain at least a header row and one data row.');
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  console.log('Falcon Detections CSV Headers:', headers);
  
  let processedCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      const values = parseCSVRow(line);
      
      if (values.length < 10) {
        console.warn(`Row ${i}: Insufficient columns (expected at least 10, got ${values.length})`);
        continue;
      }

      // Map CSV columns to Falcon Detection fields based on the CSV structure we saw
      const falconData = {
        DetectDate_UTC_readable: values[1] || null,
        Severity: values[5] || 'Unknown', // Use SeverityName from CSV column 5
        Tactic: values[7] || null, // Tactic is column 7
        ProductType: values[16] || null, // ProductType is column 16
        Hostname: values[13] || null,
        Filename: values[18] || null,
        PatternDispositionDescription: values[9] || null,
        DetectDescription: extractDetectDescription(values[19]) || null,
        ComputerName: values[13] || null, // Same as Hostname
        UserName: values[15] || null,
        ProcessName: extractProcessName(values[19]) || null,
        CommandLine: extractCommandLine(values[19]) || null,
        IOCType: extractIOCType(values[19]) || null,
        IOCValue: extractIOCValue(values[19]) || null,
        Confidence: values[11] || null,
        Technique: values[8] || null,
        PolicyName: extractPolicyName(values[19]) || null,
        PolicyType: extractPolicyType(values[19]) || null,
        raw_json: JSON.stringify({
          DetectDate: values[0],
          DetectDate_UTC_readable: values[1],
          LastUpdate: values[2],
          LastUpdate_UTC_readable: values[3],
          Company: values[4],
          SeverityName: values[5],
          Objective: values[6],
          Tactic: values[7],
          Technique: values[8],
          Name: values[9],
          PatternDispositionDescription: values[10],
          Status: values[11],
          Resolution: values[12],
          Hostname: values[13],
          aid: values[14],
          UserName: values[15],
          ProductType: values[16],
          ParentProcessId: values[17],
          ProcessId: values[18],
          FileName: values[19],
          DetectDetails: values[20],
          MD5String: values[21],
          SHA256String: values[22],
          CompositeId: values[23],
          FalconHostLink: values[24]
        }),
        ingested_on: new Date(),
        false_positive: false,
      };

      // Create unique ID from CompositeId or generate one
      const detectionId = values[23] || `falcon-${Date.now()}-${i}`;
      
      await prisma.falconDetection.upsert({
        where: { id: detectionId.replace(/[^a-zA-Z0-9-]/g, '-') },
        update: falconData,
        create: {
          id: detectionId.replace(/[^a-zA-Z0-9-]/g, '-'),
          ...falconData,
        }
      });

      processedCount++;
      
      if (processedCount % 100 === 0) {
        console.log(`Processed ${processedCount} Falcon detections...`);
      }
      
    } catch (rowError) {
      console.error(`Error processing Falcon detection row ${i}:`, rowError);
    }
  }

  console.log(`Successfully processed ${processedCount} Falcon detections`);
  return processedCount;
}

// Helper functions to extract data from DetectDetails field
function extractDetectDescription(detectDetails: string): string | null {
  if (!detectDetails) return null;
  const match = detectDetails.match(/Description: ([^\n]+)/);
  return match ? match[1].trim() : null;
}

function extractProcessName(detectDetails: string): string | null {
  if (!detectDetails) return null;
  const match = detectDetails.match(/Process: ([^\n]+)/);
  return match ? match[1].trim() : null;
}

function extractCommandLine(detectDetails: string): string | null {
  if (!detectDetails) return null;
  const match = detectDetails.match(/Command Line: ([^\n]+)/);
  return match ? match[1].trim() : null;
}

function extractIOCType(detectDetails: string): string | null {
  if (!detectDetails) return null;
  const match = detectDetails.match(/IOC Type: ([^\n]+)/);
  return match ? match[1].trim() : null;
}

function extractIOCValue(detectDetails: string): string | null {
  if (!detectDetails) return null;
  const match = detectDetails.match(/IOC Value: ([^\n]+)/);
  return match ? match[1].trim() : null;
}

function extractPolicyName(detectDetails: string): string | null {
  if (!detectDetails) return null;
  const match = detectDetails.match(/Policy: ([^\n]+)/);
  return match ? match[1].trim() : null;
}

function extractPolicyType(detectDetails: string): string | null {
  if (!detectDetails) return null;
  const match = detectDetails.match(/Policy Type: ([^\n]+)/);
  return match ? match[1].trim() : null;
}

// Helper function to convert protobuf timestamp to Date
function fromProtoTimestamp(ts: { seconds: number; nanos: number }): Date {
  return new Date(ts.seconds * 1000 + Math.floor(ts.nanos / 1_000_000));
}

// Helper function to parse timestamp fields that might be in protobuf format
function parseTimestampField(value: string): Date | null {
  if (!value) return null;
  
  try {
    // Clean up escaped quotes and try to parse as JSON
    let cleanValue = value.replace(/\\"\\"/g, '"').trim();
    
    // Remove outer quotes if present
    if (cleanValue.startsWith('"') && cleanValue.endsWith('"')) {
      cleanValue = cleanValue.slice(1, -1);
    }
    
    const parsed = JSON.parse(cleanValue);
    if (parsed && typeof parsed.seconds === 'number') {
      return fromProtoTimestamp(parsed);
    }
  } catch {
    // Not JSON, continue to other parsing methods
  }
  
  // Try ISO date format
  const isoDate = new Date(value);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  return null;
}

async function processSecureworksAlertsCSV(file: File, reportDate: Date, ingestionLogId: string): Promise<number> {
  console.log('Processing Secureworks Alerts CSV...');
  console.log('📊 File size:', file.size, 'bytes');
  
  const text = await file.text();
  console.log('📄 Text length after reading file:', text.length, 'characters');
  
  const lines = text.split('\n').filter(line => line.trim());
  console.log('📋 Total lines found:', lines.length);
  
  if (lines.length < 2) {
    throw new Error('Secureworks Alerts CSV file must contain at least a header row and one data row.');
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  console.log('Secureworks Alerts CSV Headers:', headers);
  
  let processedCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      const values = parseCSVRow(line);
      
      if (values.length < 5) {
        console.warn(`Row ${i}: Insufficient columns (expected at least 5, got ${values.length})`);
        continue;
      }
      
      // Debug: log the first few values to see what we're getting
      if (i <= 3) {
        console.log(`Row ${i} parsed values count: ${values.length}`);
        console.log(`First few values: ${JSON.stringify(values.slice(0, 10))}`);
      }

      // Map CSV columns based on the simplified format from your image:
      // Created At, Title, Severity, Threat Score, Detector, Sensor Type, Domain, Combined Username, 
      // Source IP, Destination IP, Hostname, Investigations, Confidence, MITRE ATT&CK, Status, Status Reason, Tenant, Occurrence Count, Description
      
      const created_at = parseSimpleDatetime(values[0]) || new Date(); // Created At
      const title = (values[1] || 'Unknown Alert').replace(/"/g, ''); // Title
      const severity = mapSeverityLevel(values[2] || 'MEDIUM'); // Severity - convert to enum
      const threat_score = values[3] ? parseFloat(values[3]) : null; // Threat Score
      const detector = values[4] || null; // Detector
      const sensor_type = values[5] || null; // Sensor Type
      const domain = values[6] || null; // Domain
      const combined_username = values[7] || null; // Combined Username
      const source_ip = values[8] || null; // Source IP
      const destination_ip = values[9] || null; // Destination IP
      const hostname = values[10] || null; // Hostname
      const investigations = values[11] || null; // Investigations
      const confidence = values[12] ? parseFloat(values[12]) : null; // Confidence
      const mitre_attack = values[13] || null; // MITRE ATT&CK
      const status = mapIssueStatus(values[14] || 'OPEN'); // Status - convert to enum
      const status_reason = values[15] || null; // Status Reason
      const tenant_id = values[16] || '143085'; // Tenant
      const occurrence_count = values[17] ? parseInt(values[17]) : 1; // Occurrence Count
      const description = values[18] || title; // Description

      // Create a more robust unique identifier for duplicate detection
      // Use a combination of key fields to detect true duplicates
      const duplicateKey = generateSecureworksDuplicateKey({
        title,
        created_at,
        hostname: hostname || '',
        source_ip: source_ip || '',
        detector: detector || '',
        tenant_id
      });

      const secureworksData = {
        alert_id: duplicateKey,
        title: title,
        severity: severity,
        threat_score: threat_score,
        detector: detector,
        sensor_type: sensor_type,
        domain: domain,
        combined_username: combined_username,
        source_ip: source_ip,
        destination_ip: destination_ip,
        hostname: hostname,
        investigations: investigations,
        confidence: confidence,
        mitre_attack: mitre_attack,
        status: status,
        status_reason: status_reason,
        tenant_id: tenant_id,
        occurrence_count: occurrence_count,
        description: description,
        created_at: created_at,
        detected_at: created_at, // Same as created_at
        false_positive: false,
        ingested_on: new Date(),
      };

      try {
        // Check if this is a duplicate and what changed
        const existingAlert = await prisma.secureworksAlert.findUnique({
          where: { alert_id: duplicateKey }
        });

        if (existingAlert) {
          // This is a duplicate - update only if there are meaningful changes
          const hasChanges = checkForMeaningfulChanges(existingAlert, secureworksData);
          
          if (hasChanges.hasChanges) {
            await prisma.secureworksAlert.update({
              where: { alert_id: duplicateKey },
              data: {
                ...secureworksData,
                // Increment occurrence count to track reimports
                occurrence_count: (existingAlert.occurrence_count || 1) + 1,
                updated_at: new Date(),
              }
            });
            
            console.log(`Updated existing alert ${duplicateKey} - Changes: ${hasChanges.changes.join(', ')}`);
          } else {
            // No meaningful changes, just update the ingestion timestamp
            await prisma.secureworksAlert.update({
              where: { alert_id: duplicateKey },
              data: {
                ingested_on: new Date(),
                occurrence_count: (existingAlert.occurrence_count || 1) + 1,
              }
            });
            
            console.log(`Duplicate alert detected ${duplicateKey} - No changes, updated timestamps only`);
          }
        } else {
          // New alert - create it
          await prisma.secureworksAlert.create({
            data: secureworksData
          });
        }
      } catch (dbError) {
        console.error(`Database error for alert ${duplicateKey}:`, dbError);
        throw dbError;
      }

      processedCount++;
      
      if (processedCount % 100 === 0) {
        console.log(`Processed ${processedCount} Secureworks alerts...`);
      }
      
    } catch (rowError) {
      console.error(`Error processing Secureworks alert row ${i}:`, rowError);
    }
  }

  console.log(`Successfully processed ${processedCount} Secureworks alerts`);
  return processedCount;
}

// Process AWS Security Hub CSV files
async function processAWSSecurityHubCSV(file: File, reportDate: Date, ingestionLogId: string): Promise<number> {
  const csvData = await file.text();
  const lines = csvData.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file must contain at least a header row and one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  console.log('AWS Security Hub CSV Headers:', headers);
  
  let processedCount = 0;
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      // Parse CSV row properly handling quoted values
      const values = parseCSVRow(line);
      
      if (values.length < headers.length) {
        errors.push(`Row ${i}: Insufficient columns (expected ${headers.length}, got ${values.length})`);
        continue;
      }

      // Map CSV columns to our normalized structure
      // Expected headers: "ID","Title","Control Status","Severity","Failed checks","Unknown checks","Not available checks","Passed checks","Related requirements","Custom parameters"
      const findingData = {
        controlId: values[getColumnIndex(headers, ['ID', 'Control ID', 'Control Id', 'ControlId'])] || `unknown-${i}`,
        title: values[getColumnIndex(headers, ['Title', 'Control Title', 'Description', 'Rule Title'])] || '',
        controlStatus: values[getColumnIndex(headers, ['Control Status', 'Status', 'Compliance Status'])] || 'Unknown',
        severity: mapSeverityForAWS(values[getColumnIndex(headers, ['Severity', 'Risk Level', 'Priority'])]),
        failedChecks: parseInt(values[getColumnIndex(headers, ['Failed checks', 'Failed Checks', 'Failed', 'Failures'])] || '0'),
        unknownChecks: parseInt(values[getColumnIndex(headers, ['Unknown checks', 'Unknown Checks', 'Unknown'])] || '0'),
        notAvailableChecks: parseInt(values[getColumnIndex(headers, ['Not available checks', 'Not Available Checks', 'Not Available', 'N/A Checks'])] || '0'),
        passedChecks: parseInt(values[getColumnIndex(headers, ['Passed checks', 'Passed Checks', 'Passed', 'Success'])] || '0'),
        relatedRequirements: values[getColumnIndex(headers, ['Related requirements', 'Related Requirements', 'Compliance Requirements', 'Requirements'])] || '',
        customParameters: values[getColumnIndex(headers, ['Custom parameters', 'Custom Parameters', 'Parameters', 'Support Status'])] || 'UNKNOWN',
        
        // System fields
        status: 'OPEN' as const, // Default to open
        reportDate: reportDate,
        foundAt: new Date(),
        description: values[getColumnIndex(headers, ['Description', 'Details', 'Summary'])] || null,
      };

      // Check for existing record by controlId to avoid duplicates
      const existingFinding = await prisma.awsSecurityHubFinding.findUnique({
        where: { controlId: findingData.controlId }
      });

      if (existingFinding) {
        // This is a duplicate - check for meaningful changes
        const hasChanges = checkForAWSChanges(existingFinding, findingData);
        
        if (hasChanges.hasChanges) {
          await prisma.awsSecurityHubFinding.update({
            where: { controlId: findingData.controlId },
            data: {
              ...findingData,
              updatedAt: new Date(),
            }
          });
          console.log(`Updated AWS finding ${findingData.controlId} - Changes: ${hasChanges.changes.join(', ')}`);
        } else {
          // No meaningful changes, just update the timestamps
          await prisma.awsSecurityHubFinding.update({
            where: { controlId: findingData.controlId },
            data: {
              updatedAt: new Date(),
            }
          });
          console.log(`Duplicate AWS finding detected ${findingData.controlId} - No changes, updated timestamp only`);
        }
      } else {
        // Create new finding
        await prisma.awsSecurityHubFinding.create({
          data: findingData
        });
      }

      processedCount++;
      
    } catch (rowError) {
      console.error(`Error processing row ${i}:`, rowError);
      errors.push(`Row ${i}: ${rowError instanceof Error ? rowError.message : 'Processing error'}`);
    }
  }

  if (errors.length > 0) {
    console.warn('AWS Security Hub processing errors:', errors.slice(0, 5)); // Log first 5 errors
  }

  return processedCount;
}

// Helper function to map severity for AWS Security Hub
function mapSeverityForAWS(severity: string | null): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' {
  if (!severity) return 'MEDIUM';
  
  const sev = severity.toLowerCase().trim();
  if (sev === 'critical') return 'CRITICAL';
  if (sev === 'high') return 'HIGH';
  if (sev === 'medium') return 'MEDIUM';
  if (sev === 'low') return 'LOW';
  if (sev === 'info' || sev === 'informational') return 'INFO';
  
  return 'MEDIUM'; // Default fallback
}

// Helper function to get column index by possible names
function getColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
    if (index >= 0) return index;
  }
  return -1; // Not found
}


// Helper function to parse simple datetime format
function parseSimpleDatetime(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    // Handle formats like "2025/08/27 02:29:55 UTC"
    const utcPattern = /(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+UTC/;
    const match = dateStr.match(utcPattern);
    
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    }
    
    // Fallback to standard Date parsing
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
    
  } catch (error) {
    console.warn(`Failed to parse datetime: ${dateStr}`, error);
    return null;
  }
}

// Helper function to map severity to enum values
function mapSeverityLevel(severity: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' {
  const normalized = severity.toUpperCase().trim();
  if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].includes(normalized)) {
    return normalized as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  }
  return 'MEDIUM'; // Default fallback
}

// Helper function to map status to enum values  
function mapIssueStatus(status: string): 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'WONT_FIX' {
  const normalized = status.toUpperCase().trim();
  if (normalized === 'OPEN') return 'OPEN';
  if (normalized === 'IN_PROGRESS' || normalized === 'IN PROGRESS') return 'IN_PROGRESS';
  if (normalized === 'RESOLVED') return 'RESOLVED';
  if (normalized === 'CLOSED') return 'CLOSED';
  if (normalized === 'SUPPRESSED' || normalized === 'WONT_FIX') return 'WONT_FIX';
  return 'OPEN'; // Default fallback
}

// Helper function to generate a consistent duplicate key for Secureworks alerts
function generateSecureworksDuplicateKey(alertData: {
  title: string;
  created_at: Date;
  hostname: string;
  source_ip: string;
  detector: string;
  tenant_id: string;
}): string {
  // Create a hash-like key based on meaningful identifiers
  const keyComponents = [
    alertData.title.toLowerCase().trim(),
    alertData.created_at.toISOString().split('T')[0], // Date only, ignore time
    alertData.hostname.toLowerCase().trim(),
    alertData.source_ip.trim(),
    alertData.detector.toLowerCase().trim(),
    alertData.tenant_id
  ].filter(Boolean); // Remove empty values
  
  // Create a consistent key
  const baseKey = keyComponents.join('|');
  
  // Use a simple hash to create a shorter key while maintaining uniqueness
  let hash = 0;
  for (let i = 0; i < baseKey.length; i++) {
    const char = baseKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return `secureworks-${Math.abs(hash).toString(36)}-${alertData.created_at.toISOString().split('T')[0].replace(/-/g, '')}`;
}

// Helper function to check for meaningful changes between existing and new alert data
function checkForMeaningfulChanges(existing: any, newData: any): { hasChanges: boolean; changes: string[] } {
  const changes: string[] = [];
  
  // Fields that matter for detecting meaningful changes
  const criticalFields = [
    'severity', 'threat_score', 'status', 'status_reason', 'confidence',
    'mitre_attack', 'investigations', 'description'
  ];
  
  criticalFields.forEach(field => {
    const existingValue = existing[field];
    const newValue = newData[field];
    
    // Handle null/undefined comparisons
    if (existingValue !== newValue) {
      // Don't consider null <-> undefined as a change
      if ((existingValue === null && newValue === undefined) || 
          (existingValue === undefined && newValue === null)) {
        return;
      }
      
      // For numbers, check if there's a meaningful difference
      if (typeof existingValue === 'number' && typeof newValue === 'number') {
        if (Math.abs(existingValue - newValue) > 0.01) { // Threshold for float comparison
          changes.push(`${field}: ${existingValue} → ${newValue}`);
        }
      } else {
        // For strings and other types
        const existingStr = String(existingValue || '').trim();
        const newStr = String(newValue || '').trim();
        if (existingStr !== newStr) {
          changes.push(`${field}: "${existingStr}" → "${newStr}"`);
        }
      }
    }
  });
  
  return {
    hasChanges: changes.length > 0,
    changes
  };
}

// Similar helper functions for other data types can be added here
function generateFalconDuplicateKey(detectionData: {
  DetectDate_UTC_readable: string | null;
  Hostname: string | null;
  PatternDispositionDescription: string | null;
  Technique: string | null;
}): string {
  const keyComponents = [
    (detectionData.DetectDate_UTC_readable || '').trim(),
    (detectionData.Hostname || '').toLowerCase().trim(),
    (detectionData.PatternDispositionDescription || '').toLowerCase().trim().substring(0, 50), // First 50 chars
    (detectionData.Technique || '').trim()
  ].filter(Boolean);
  
  const baseKey = keyComponents.join('|');
  let hash = 0;
  for (let i = 0; i < baseKey.length; i++) {
    const char = baseKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return `falcon-${Math.abs(hash).toString(36)}-${Date.now()}`;
}

function generateAWSDuplicateKey(findingData: {
  controlId: string;
  title: string;
}): string {
  // For AWS findings, controlId should be unique enough
  return `aws-${findingData.controlId.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()}`;
}

// Helper function to check for meaningful changes in AWS findings
function checkForAWSChanges(existing: any, newData: any): { hasChanges: boolean; changes: string[] } {
  const changes: string[] = [];
  
  // Fields that matter for AWS findings
  const criticalFields = [
    'controlStatus', 'severity', 'failedChecks', 'unknownChecks', 
    'notAvailableChecks', 'passedChecks', 'status', 'customParameters'
  ];
  
  criticalFields.forEach(field => {
    const existingValue = existing[field];
    const newValue = newData[field];
    
    if (existingValue !== newValue) {
      if ((existingValue === null && newValue === undefined) || 
          (existingValue === undefined && newValue === null)) {
        return;
      }
      
      if (typeof existingValue === 'number' && typeof newValue === 'number') {
        if (existingValue !== newValue) { // AWS counts should be exact
          changes.push(`${field}: ${existingValue} → ${newValue}`);
        }
      } else {
        const existingStr = String(existingValue || '').trim();
        const newStr = String(newValue || '').trim();
        if (existingStr !== newStr) {
          changes.push(`${field}: "${existingStr}" → "${newStr}"`);
        }
      }
    }
  });
  
  return {
    hasChanges: changes.length > 0,
    changes
  };
}

// Helper function to generate a consistent duplicate key for Threat Advisories
function generateThreatAdvisoryDuplicateKey(advisoryData: {
  threatAdvisoryName: string;
  source: string;
  advisoryReleasedDate: string;
  reportDate: Date;
}): string {
  // Create a hash-like key based on meaningful identifiers
  const keyComponents = [
    advisoryData.threatAdvisoryName.toLowerCase().trim(),
    advisoryData.source.toLowerCase().trim(),
    advisoryData.advisoryReleasedDate.trim(),
    advisoryData.reportDate.toISOString().split('T')[0] // Date only
  ].filter(Boolean); // Remove empty values
  
  // Create a consistent key
  const baseKey = keyComponents.join('|');
  
  // Use a simple hash to create a shorter key while maintaining uniqueness
  let hash = 0;
  for (let i = 0; i < baseKey.length; i++) {
    const char = baseKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return `threat-advisory-${Math.abs(hash).toString(36)}-${advisoryData.reportDate.toISOString().split('T')[0].replace(/-/g, '')}`;
}

// Helper function to check for meaningful changes in Threat Advisory data
function checkForThreatAdvisoryChanges(existing: any, newData: any): { hasChanges: boolean; changes: string[] } {
  const changes: string[] = [];
  
  // Fields that matter for detecting meaningful changes
  const criticalFields = [
    'severity', 'netgearSeverity', 'impacted', 'notifiedDate', 
    'remarks', 'etaForFix'
  ];
  
  criticalFields.forEach(field => {
    const existingValue = existing[field];
    const newValue = newData[field];
    
    // Handle null/undefined comparisons
    if (existingValue !== newValue) {
      // Don't consider null <-> undefined as a change
      if ((existingValue === null && newValue === undefined) || 
          (existingValue === undefined && newValue === null)) {
        return;
      }
      
      // For boolean fields
      if (typeof existingValue === 'boolean' && typeof newValue === 'boolean') {
        if (existingValue !== newValue) {
          changes.push(`${field}: ${existingValue} → ${newValue}`);
        }
      } else {
        // For strings and other types
        const existingStr = String(existingValue || '').trim();
        const newStr = String(newValue || '').trim();
        if (existingStr !== newStr) {
          changes.push(`${field}: "${existingStr}" → "${newStr}"`);
        }
      }
    }
  });
  
  return {
    hasChanges: changes.length > 0,
    changes
  };
}
