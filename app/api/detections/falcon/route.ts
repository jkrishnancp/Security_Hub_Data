import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const search = searchParams.get('search');
    
    // Build the where clause
    const where: any = {
      false_positive: false, // Always exclude false positives
      Severity: {
        not: "Informational" // Also exclude Informational severity
      }
    };
    
    // Date filtering
    if (start || end) {
      where.DetectDate_UTC_readable = {};
      
      if (start) {
        // Convert start date to beginning of day
        const startDate = new Date(start);
        where.OR = [
          {
            DetectDate_UTC_readable: {
              gte: startDate.toISOString().split('T')[0], // YYYY-MM-DD format
            }
          }
        ];
      }
      
      if (end) {
        // Convert end date to end of day
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);
        
        if (!where.OR) {
          where.OR = [];
        }
        
        where.OR.push({
          DetectDate_UTC_readable: {
            lte: endDate.toISOString().split('T')[0], // YYYY-MM-DD format
          }
        });
        
        // If both start and end are provided, combine them with AND
        if (start) {
          delete where.OR;
          const startDate = new Date(start);
          where.DetectDate_UTC_readable = {
            gte: startDate.toISOString().split('T')[0],
            lte: endDate.toISOString().split('T')[0]
          };
        }
      }
    }
    
    // Search filtering - search across multiple text fields (use AND with existing conditions)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { Severity: { contains: searchTerm, mode: 'insensitive' } },
            { Tactic: { contains: searchTerm, mode: 'insensitive' } },
            { ProductType: { contains: searchTerm, mode: 'insensitive' } },
            { Hostname: { contains: searchTerm, mode: 'insensitive' } },
            { Filename: { contains: searchTerm, mode: 'insensitive' } },
            { PatternDispositionDescription: { contains: searchTerm, mode: 'insensitive' } },
            { ComputerName: { contains: searchTerm, mode: 'insensitive' } },
            { UserName: { contains: searchTerm, mode: 'insensitive' } },
            { ProcessName: { contains: searchTerm, mode: 'insensitive' } },
          ]
        }
      ];
    }

    // Fetch detections with the filters applied
    const detections = await prisma.falconDetection.findMany({
      where,
      select: {
        id: true,
        DetectDate_UTC_readable: true,
        Severity: true,
        Tactic: true,
        ProductType: true,
        Hostname: true,
        Filename: true,
        PatternDispositionDescription: true,
        DetectDescription: true,
        ComputerName: true,
        UserName: true,
        ProcessName: true,
        CommandLine: true,
        IOCType: true,
        IOCValue: true,
        Confidence: true,
        Technique: true,
        PolicyName: true,
        PolicyType: true,
        ingested_on: true,
        createdAt: true,
      },
      orderBy: [
        { DetectDate_UTC_readable: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 10000, // Reasonable limit to prevent performance issues
    });

    // Transform the data to ensure consistent format for the frontend
    const transformedDetections = detections.map(detection => ({
      ...detection,
      // Ensure these fields always exist for the frontend
      DetectDate_UTC_readable: detection.DetectDate_UTC_readable || detection.createdAt?.toISOString(),
      Severity: detection.Severity || 'Unknown',
      Tactic: detection.Tactic || 'Unknown',
      ProductType: detection.ProductType || 'Unknown',
      Hostname: detection.Hostname || detection.ComputerName || '—',
      Filename: detection.Filename || '—',
      PatternDispositionDescription: detection.PatternDispositionDescription || detection.DetectDescription || '—',
      false_positive: false, // Always false since we filter them out
    }));

    return NextResponse.json(transformedDetections);
  } catch (error) {
    console.error('Error fetching Falcon detections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Falcon detections: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}