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
        { success: false, error: 'Only CSV files are supported for open items import' },
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
    console.log('Open Items CSV Headers:', headers);
    
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
        source: 'open_items',
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

        // Map CSV columns to our data structure
        // Common Jira CSV columns: Summary, Issue Type, Status, Priority, Assignee, Created, Updated, etc.
        const openItemData: any = {
          title: values[getColumnIndex(headers, ['Summary', 'Title', 'Subject'])] || `Untitled Issue ${i}`,
          description: values[getColumnIndex(headers, ['Description', 'Details'])] || null,
          assignee: values[getColumnIndex(headers, ['Assignee', 'Assigned To'])] || null,
          priority: values[getColumnIndex(headers, ['Priority'])] || null,
          status: values[getColumnIndex(headers, ['Status', 'State'])] || 'Open',
          issueType: values[getColumnIndex(headers, ['Issue Type', 'Type'])] || null,
          labels: values[getColumnIndex(headers, ['Labels'])] || null,
          epic: values[getColumnIndex(headers, ['Epic Link', 'Epic'])] || null,
          sprint: values[getColumnIndex(headers, ['Sprint'])] || null,
          reporter: values[getColumnIndex(headers, ['Reporter', 'Created By'])] || null,
          resolution: values[getColumnIndex(headers, ['Resolution'])] || null,
          reportDate: reportDate,
        };

        // Parse dates
        const createdStr = values[getColumnIndex(headers, ['Created', 'Created Date', 'Creation Date'])];
        const updatedStr = values[getColumnIndex(headers, ['Updated', 'Updated Date', 'Last Updated'])];
        const dueDateStr = values[getColumnIndex(headers, ['Due Date', 'Due'])];
        const closedStr = values[getColumnIndex(headers, ['Resolved', 'Closed', 'Resolved Date'])];
        
        openItemData.createdAt = createdStr ? parseDate(createdStr) : new Date();
        openItemData.updatedAt = updatedStr ? parseDate(updatedStr) : null;
        openItemData.dueDate = dueDateStr ? parseDate(dueDateStr) : null;
        openItemData.closedAt = closedStr ? parseDate(closedStr) : null;

        // Parse story points
        const storyPointsStr = values[getColumnIndex(headers, ['Story Points', 'Points'])];
        openItemData.storyPoints = storyPointsStr ? parseInt(storyPointsStr) || null : null;

        // Create or update open item record
        const itemId = values[getColumnIndex(headers, ['Issue Key', 'Key', 'ID'])] || `item-${Date.now()}-${i}`;
        
        await prisma.openItem.upsert({
          where: { 
            id: itemId.replace(/[^a-zA-Z0-9-]/g, '-') 
          },
          update: openItemData,
          create: {
            id: itemId.replace(/[^a-zA-Z0-9-]/g, '-'),
            ...openItemData,
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
    console.error('Error processing open items file:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process open items data: ' + (error instanceof Error ? error.message : 'Unknown error') },
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

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
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
    
    // Try standard date formats
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch (e) {
    console.warn(`Failed to parse date: ${dateStr}`, e);
  }
  
  return null;
}