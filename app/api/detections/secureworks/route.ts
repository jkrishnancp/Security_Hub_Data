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
    const chartDataOnly = searchParams.get('chartDataOnly') === 'true'; // Get all data for charts
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1; // Page number (1-based)
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 50; // Default 50 per page
    const skip = (page - 1) * pageSize;
    
    // Additional filter parameters
    const severityFilter = searchParams.get('severity');
    const statusFilter = searchParams.get('status');
    const titleFilter = searchParams.get('title');
    const sensorTypeFilter = searchParams.get('sensorType');
    
    // Build the where clause
    const where: any = {
      false_positive: false, // Always exclude false positives
    };
    
    // Add date filtering if provided
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        where.created_at = {
          gte: startDate,
          lte: endDate,
        };
      }
    }
    
    // Add search filtering if provided (case-insensitive for SQLite)
    if (search && search.trim()) {
      // For SQLite, we'll use a simpler approach - search the original data as-is
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { alert_id: { contains: search } },
        { detector: { contains: search } },
        { sensor_type: { contains: search } },
        { hostname: { contains: search } },
        { source_ip: { contains: search } },
      ];
    }
    
    // Add additional filters - now supports multiple values (comma-separated)
    if (severityFilter) {
      const severities = severityFilter.split(',').filter(Boolean);
      if (severities.length > 0) {
        where.severity = { in: severities };
      }
    }
    
    if (statusFilter) {
      const statuses = statusFilter.split(',').filter(Boolean);
      if (statuses.length > 0) {
        where.status = { in: statuses };
      }
    }
    
    if (titleFilter) {
      const titles = titleFilter.split(',').filter(Boolean);
      if (titles.length > 0) {
        // For title filter, we want ANY of the selected titles to match
        const titleConditions = titles.map(title => ({ title: { contains: title } }));
        if (where.OR) {
          // If there's already an OR clause (from search), combine them properly
          where.AND = [
            { OR: where.OR }, // Search conditions
            { OR: titleConditions } // Title conditions
          ];
          delete where.OR; // Remove the original OR to avoid conflicts
        } else {
          where.OR = titleConditions;
        }
      }
    }
    
    if (sensorTypeFilter) {
      const sensorTypes = sensorTypeFilter.split(',').filter(Boolean);
      if (sensorTypes.length > 0) {
        where.sensor_type = { in: sensorTypes };
      }
    }
    
    console.log('🔍 Secureworks API called with params:', { start, end, search, chartDataOnly, page, pageSize });
    console.log('📝 Where clause:', JSON.stringify(where, null, 2));

    // First, check total count
    const totalCount = await prisma.secureworksAlert.count();
    const filteredCount = await prisma.secureworksAlert.count({ where });
    console.log('📊 Total alerts in DB:', totalCount);
    console.log('📊 Alerts matching filter:', filteredCount);

    // Fetch detections - all data for charts, paginated for table
    const detections = await prisma.secureworksAlert.findMany({
      where,
      orderBy: [
        { created_at: 'desc' }
      ],
      ...(chartDataOnly ? {} : { skip: skip, take: pageSize }) // No pagination for chart data
    });
    
    console.log('✅ Found', detections.length, 'Secureworks alerts');
    
    if (detections.length > 0) {
      console.log('📋 Sample alert:');
      console.log('- ID:', detections[0].id);
      console.log('- Alert ID:', detections[0].alert_id);
      console.log('- Title:', detections[0].title);
      console.log('- Severity:', detections[0].severity);
      console.log('- Status:', detections[0].status);
      console.log('- Detector:', detections[0].detector);
      console.log('- Sensor Type:', detections[0].sensor_type);
      console.log('- Created:', detections[0].created_at);
      console.log('- False Positive:', detections[0].false_positive);
    }

    if (chartDataOnly) {
      // For chart data, return all records without pagination
      console.log('📊 Returning all data for charts:', detections.length, 'alerts');
      return NextResponse.json(detections);
    } else {
      // For table data, return paginated response
      const totalPages = Math.ceil(filteredCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      const response = {
        data: detections,
        pagination: {
          page,
          pageSize,
          total: filteredCount,
          totalPages,
          hasNextPage,
          hasPrevPage
        }
      };

      console.log('✅ Returning paginated response:');
      console.log('- Page', page, 'of', totalPages);
      console.log('- Showing', detections.length, 'of', filteredCount, 'total alerts');
      
      return NextResponse.json(response);
    }
  } catch (error) {
    console.error('Error fetching Secureworks alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Secureworks alerts: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}