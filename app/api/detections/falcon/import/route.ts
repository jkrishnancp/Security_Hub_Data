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
        { success: false, error: 'Only CSV files are supported for Falcon detections import' },
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
    console.log('Falcon Detections CSV Headers:', headers);
    
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
        source: 'falcon_detections',
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
        const detectionData: any = {
          // Primary fields expected by the UI
          DetectDate_UTC_readable: values[getColumnIndex(headers, ['DetectDate_UTC_readable', 'Detect Date', 'Detection Date', 'Timestamp', 'Date'])] || null,
          Severity: values[getColumnIndex(headers, ['Severity', 'Alert Severity', 'Risk Level'])] || null,
          Tactic: values[getColumnIndex(headers, ['Tactic', 'MITRE Tactic', 'Attack Tactic'])] || null,
          ProductType: values[getColumnIndex(headers, ['ProductType', 'Product Type', 'Product', 'Service'])] || null,
          Hostname: values[getColumnIndex(headers, ['Hostname', 'Host Name', 'Computer Name', 'ComputerName', 'Device Name'])] || null,
          Filename: values[getColumnIndex(headers, ['Filename', 'File Name', 'FileName', 'File Path'])] || null,
          PatternDispositionDescription: values[getColumnIndex(headers, ['PatternDispositionDescription', 'Description', 'Alert Description', 'Detection Description'])] || null,
          
          // Additional CrowdStrike-specific fields
          DetectDescription: values[getColumnIndex(headers, ['DetectDescription', 'Detection Description'])] || null,
          ComputerName: values[getColumnIndex(headers, ['ComputerName', 'Computer Name'])] || null,
          UserName: values[getColumnIndex(headers, ['UserName', 'User Name', 'Username'])] || null,
          ProcessName: values[getColumnIndex(headers, ['ProcessName', 'Process Name'])] || null,
          CommandLine: values[getColumnIndex(headers, ['CommandLine', 'Command Line'])] || null,
          IOCType: values[getColumnIndex(headers, ['IOCType', 'IOC Type', 'Indicator Type'])] || null,
          IOCValue: values[getColumnIndex(headers, ['IOCValue', 'IOC Value', 'Indicator Value'])] || null,
          Confidence: values[getColumnIndex(headers, ['Confidence', 'Confidence Level'])] || null,
          Technique: values[getColumnIndex(headers, ['Technique', 'MITRE Technique', 'Attack Technique'])] || null,
          PolicyName: values[getColumnIndex(headers, ['PolicyName', 'Policy Name'])] || null,
          PolicyType: values[getColumnIndex(headers, ['PolicyType', 'Policy Type'])] || null,
          
          // System fields
          raw_json: JSON.stringify(rawJson),
          ingested_on: new Date(),
          false_positive: false // Default to false, can be updated manually later
        };

        // Handle false positive detection from various possible column names
        const fpValue = values[getColumnIndex(headers, ['false_positive', 'False Positive', 'FP', 'Disposition'])];
        if (fpValue) {
          detectionData.false_positive = isFalsePositive(fpValue);
        }

        // Create detection record - use a combination of fields to create unique identifier
        const uniqueId = generateDetectionId(rawJson, i);
        
        await prisma.falconDetection.upsert({
          where: { id: uniqueId },
          update: detectionData,
          create: {
            id: uniqueId,
            ...detectionData,
          }
        });

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
    console.error('Error processing Falcon detections file:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process Falcon detections data: ' + (error instanceof Error ? error.message : 'Unknown error') },
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
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"(.*)"$/, '$1'));
      current = '';
    } else {
      current += char;
    }
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

function isFalsePositive(value: string): boolean {
  if (!value) return false;
  const v = value.toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y' || v === 'false positive' || v === 'fp';
}

function generateDetectionId(rawJson: any, rowIndex: number): string {
  // Try to create a deterministic ID from detection data
  const identifiers = [
    rawJson['Detection ID'],
    rawJson['Event ID'],
    rawJson['Alert ID'],
    rawJson['ID'],
    rawJson['Unique ID']
  ].filter(Boolean);
  
  if (identifiers.length > 0) {
    return identifiers[0].toString().replace(/[^a-zA-Z0-9-]/g, '-');
  }
  
  // Fallback to a hash of key fields + timestamp
  const keyFields = [
    rawJson['Hostname'] || rawJson['ComputerName'],
    rawJson['DetectDate_UTC_readable'] || rawJson['Timestamp'],
    rawJson['Severity'],
    rawJson['Tactic']
  ].filter(Boolean).join('|');
  
  if (keyFields) {
    return `falcon-${hashString(keyFields)}-${rowIndex}`;
  }
  
  return `falcon-${Date.now()}-${rowIndex}`;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
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