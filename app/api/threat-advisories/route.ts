import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get threat advisories from database
    const threatAdvisories = await prisma.threatAdvisory.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Convert to frontend format
    const formattedAdvisories = threatAdvisories.map((advisory, index) => ({
      id: advisory.id,
      threatAdvisoryName: advisory.threatAdvisoryName,
      severity: advisory.severity,
      netgearSeverity: advisory.netgearSeverity,
      impacted: advisory.impacted,
      source: advisory.source,
      advisoryReleasedDate: advisory.advisoryReleasedDate,
      notifiedDate: advisory.notifiedDate,
      remarks: advisory.remarks || '',
      etaForFix: advisory.etaForFix || 'N/A'
    }));
    
    return NextResponse.json({ 
      success: true, 
      data: formattedAdvisories,
      count: formattedAdvisories.length
    });
  } catch (error) {
    console.error('Error reading threat advisory data from database:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load threat advisory data from database' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !['ADMIN', 'ANALYST'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        { success: false, error: 'Only CSV files are supported for threat advisories' },
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
    console.log('CSV Headers:', headers);
    
    let processedCount = 0;
    const errors = [];
    
    // Create ingestion log
    const ingestionLog = await prisma.ingestionLog.create({
      data: {
        filename: file.name,
        originalName: file.name,
        fileType: 'csv',
        checksum: await generateChecksum(file),
        source: 'threat_advisories',
        rowsProcessed: 0,
        reportDate: new Date(),
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
        
        if (values.length < 9) {
          errors.push(`Row ${i}: Insufficient columns (expected 9, got ${values.length})`);
          continue;
        }

        // Create threat advisory record
        const threatAdvisory = await prisma.threatAdvisory.upsert({
          where: { 
            // Use a combination of name and notified date as unique identifier
            id: `${values[0]}-${values[6]}`.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 50) + '-' + i
          },
          update: {
            threatAdvisoryName: values[0] || '',
            severity: values[1] || '',
            netgearSeverity: values[2] || '',
            impacted: values[3] === 'Yes',
            source: values[4] || '',
            advisoryReleasedDate: values[5] || '',
            notifiedDate: values[6] || '',
            remarks: values[7] || null,
            etaForFix: values[8] || null,
            reportDate: new Date(),
          },
          create: {
            id: `${values[0]}-${values[6]}`.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 50) + '-' + i,
            threatAdvisoryName: values[0] || '',
            severity: values[1] || '',
            netgearSeverity: values[2] || '',
            impacted: values[3] === 'Yes',
            source: values[4] || '',
            advisoryReleasedDate: values[5] || '',
            notifiedDate: values[6] || '',
            remarks: values[7] || null,
            etaForFix: values[8] || null,
            reportDate: new Date(),
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
    
    return NextResponse.json({ 
      success: true, 
      count: processedCount,
      ingestionId: ingestionLog.id,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined // Show first 5 errors
    });
  } catch (error) {
    console.error('Error processing threat advisory file:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process threat advisory data: ' + (error instanceof Error ? error.message : 'Unknown error') },
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
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}