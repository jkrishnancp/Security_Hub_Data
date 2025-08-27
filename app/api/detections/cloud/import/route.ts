import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Admin-only import restriction
    if (!session || !['ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'Only CSV files are supported for AWS Security Hub import' },
        { status: 400 }
      );
    }
    
    const csvData = await file.text();
    
    // Parse CSV data
    const lines = csvData.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: 'CSV file must contain at least a header row and one data row' },
        { status: 400 }
      );
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('AWS Security Hub CSV Headers:', headers);
    
    let processedCount = 0;
    const errors = [];
    const reportDate = new Date();
    
    // Create ingestion log
    const ingestionLog = await prisma.ingestionLog.create({
      data: {
        filename: file.name,
        originalName: file.name,
        fileType: 'csv',
        checksum: await generateChecksum(file),
        source: 'aws_security_hub',
        rowsProcessed: 0,
        reportDate: reportDate,
        importedDate: new Date(),
        status: 'PENDING',
      },
    });

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

        // Create raw JSON for the full row
        const rawJson: any = {};
        headers.forEach((header, index) => {
          rawJson[header] = values[index] || null;
        });

        // Map CSV columns to our normalized structure
        // Expected headers: "ID","Title","Control Status","Severity","Failed checks","Unknown checks","Not available checks","Passed checks","Related requirements","Custom parameters"
        const findingData: any = {
          controlId: values[getColumnIndex(headers, ['ID', 'Control ID', 'Control Id', 'ControlId'])] || `unknown-${i}`,
          title: values[getColumnIndex(headers, ['Title', 'Control Title', 'Description', 'Rule Title'])] || '',
          controlStatus: values[getColumnIndex(headers, ['Control Status', 'Status', 'Compliance Status'])] || 'Unknown',
          severity: mapSeverity(values[getColumnIndex(headers, ['Severity', 'Risk Level', 'Priority'])]),
          failedChecks: parseInt(values[getColumnIndex(headers, ['Failed checks', 'Failed Checks', 'Failed', 'Failures'])] || '0'),
          unknownChecks: parseInt(values[getColumnIndex(headers, ['Unknown checks', 'Unknown Checks', 'Unknown'])] || '0'),
          notAvailableChecks: parseInt(values[getColumnIndex(headers, ['Not available checks', 'Not Available Checks', 'Not Available', 'N/A Checks'])] || '0'),
          passedChecks: parseInt(values[getColumnIndex(headers, ['Passed checks', 'Passed Checks', 'Passed', 'Success'])] || '0'),
          relatedRequirements: values[getColumnIndex(headers, ['Related requirements', 'Related Requirements', 'Compliance Requirements', 'Requirements'])] || '',
          customParameters: values[getColumnIndex(headers, ['Custom parameters', 'Custom Parameters', 'Parameters', 'Support Status'])] || 'UNKNOWN',
          
          // System fields
          status: 'OPEN', // Default to open
          reportDate: reportDate,
          foundAt: new Date(),
          description: values[getColumnIndex(headers, ['Description', 'Details', 'Summary'])] || null,
        };

        // Check for existing record by controlId to avoid duplicates
        const existingFinding = await prisma.awsSecurityHubFinding.findUnique({
          where: { controlId: findingData.controlId }
        });

        if (existingFinding) {
          // Update existing finding
          await prisma.awsSecurityHubFinding.update({
            where: { controlId: findingData.controlId },
            data: {
              ...findingData,
              updatedAt: new Date(),
            }
          });
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

    // Update ingestion log
    await prisma.ingestionLog.update({
      where: { id: ingestionLog.id },
      data: {
        rowsProcessed: processedCount,
        status: processedCount > 0 ? 'SUCCESS' : 'FAILED',
        errorLog: errors.length > 0 ? errors.join('; ') : null,
      },
    });

    // If there were errors, create an error CSV for download
    let errorCsvData = null;
    if (errors.length > 0) {
      errorCsvData = createErrorCSV(errors);
    }
    
    return NextResponse.json({ 
      success: true, 
      count: processedCount,
      ingestionId: ingestionLog.id,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Show first 10 errors
      errorCsv: errorCsvData
    });
  } catch (error) {
    console.error('Error processing AWS Security Hub file:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process AWS Security Hub data: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

// Helper functions
async function generateChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
        result.push(current.trim().replace(/^"(.*)"$/, '$1'));
        current = '';
        continue;
      }
    }
    
    current += char;
  }
  
  result.push(current.trim().replace(/^"(.*)"$/, '$1'));
  return result;
}

function getColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
    if (index >= 0) return index;
  }
  return -1; // Not found
}

function mapSeverity(severity: string | null): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' {
  if (!severity) return 'MEDIUM';
  
  const sev = severity.toLowerCase().trim();
  if (sev === 'critical') return 'CRITICAL';
  if (sev === 'high') return 'HIGH';
  if (sev === 'medium') return 'MEDIUM';
  if (sev === 'low') return 'LOW';
  if (sev === 'info' || sev === 'informational') return 'INFO';
  
  return 'MEDIUM'; // Default fallback
}

function createErrorCSV(errors: string[]): string {
  const csvHeader = 'Row,Error\n';
  const csvRows = errors.map(error => {
    const [row, ...messageParts] = error.split(':');
    const message = messageParts.join(':').trim();
    return `"${row}","${message.replace(/"/g, '""')}"`;
  }).join('\n');
  
  return csvHeader + csvRows;
}