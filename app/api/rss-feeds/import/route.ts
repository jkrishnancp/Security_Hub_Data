import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as csv from 'fast-csv';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { error: 'File must be a CSV' },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const results: any[] = [];
    let processed = 0;
    let errors: string[] = [];

    return new Promise<NextResponse>((resolve) => {
      csv
        .parseString(csvText, { headers: true })
        .on('data', async (row: any) => {
          try {
            const category = row.Category || row.category;
            const url = row['RSS URL'] || row.url || row.URL;
            
            if (!category || !url) {
              errors.push(`Row ${processed + 1}: Missing category or URL`);
              return;
            }

            // Create a name from URL if not provided
            const name = row.Name || row.name || url.replace(/^https?:\/\//, '').split('/')[0];

            // Check if feed already exists
            const existingFeed = await prisma.rssFeed.findUnique({
              where: { url }
            });

            if (existingFeed) {
              errors.push(`Row ${processed + 1}: RSS feed already exists: ${url}`);
              return;
            }

            // Create new RSS feed
            const rssFeed = await prisma.rssFeed.create({
              data: {
                name,
                url,
                category,
                active: true,
              }
            });

            results.push(rssFeed);
          } catch (error) {
            console.error(`Error processing row ${processed + 1}:`, error);
            errors.push(`Row ${processed + 1}: Failed to process - ${error}`);
          }
          processed++;
        })
        .on('end', () => {
          resolve(NextResponse.json({
            message: `Import completed. ${results.length} feeds added, ${errors.length} errors.`,
            successful: results.length,
            errors: errors.length,
            errorDetails: errors.slice(0, 10) // Limit error details
          }));
        })
        .on('error', (error: Error) => {
          console.error('CSV parsing error:', error);
          resolve(NextResponse.json(
            { error: 'Failed to parse CSV file' },
            { status: 400 }
          ));
        });
    });

  } catch (error) {
    console.error('Error importing RSS feeds:', error);
    return NextResponse.json(
      { error: 'Failed to import RSS feeds' },
      { status: 500 }
    );
  }
}