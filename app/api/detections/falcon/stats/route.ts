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
    
    // Build the base where clause
    const baseWhere: any = {
      false_positive: false, // Always exclude false positives
      Severity: {
        not: "Informational" // Also exclude Informational severity
      }
    };
    
    // Date filtering
    if (start || end) {
      baseWhere.DetectDate_UTC_readable = {};
      
      if (start && end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);
        
        baseWhere.DetectDate_UTC_readable = {
          gte: startDate.toISOString().split('T')[0],
          lte: endDate.toISOString().split('T')[0]
        };
      } else if (start) {
        const startDate = new Date(start);
        baseWhere.DetectDate_UTC_readable = {
          gte: startDate.toISOString().split('T')[0]
        };
      } else if (end) {
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);
        baseWhere.DetectDate_UTC_readable = {
          lte: endDate.toISOString().split('T')[0]
        };
      }
    }

    // Get all detections matching the date filter
    const detections = await prisma.falconDetection.findMany({
      where: baseWhere,
      select: {
        Severity: true,
        Tactic: true,
        ProductType: true,
        DetectDate_UTC_readable: true,
        createdAt: true,
      }
    });

    // Calculate stats
    const severityCounts: Record<string, number> = {};
    const tacticCounts: Record<string, number> = {};
    const productTypeCounts: Record<string, number> = {};
    const dailyCounts: Record<string, number> = {};

    detections.forEach(detection => {
      // Severity counts
      const severity = detection.Severity || 'Unknown';
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;

      // Tactic counts
      const tactic = detection.Tactic || 'Unknown';
      tacticCounts[tactic] = (tacticCounts[tactic] || 0) + 1;

      // ProductType counts
      const productType = detection.ProductType || 'Unknown';
      productTypeCounts[productType] = (productTypeCounts[productType] || 0) + 1;

      // Daily trending - extract date part
      let dateKey = '';
      if (detection.DetectDate_UTC_readable) {
        try {
          // Handle various date formats
          const date = new Date(detection.DetectDate_UTC_readable);
          if (!isNaN(date.getTime())) {
            dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
          } else {
            // Try parsing as string date format
            dateKey = detection.DetectDate_UTC_readable.split(' ')[0]; // Take first part if space-separated
            if (dateKey && !dateKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // If not in YYYY-MM-DD format, use created date
              dateKey = detection.createdAt?.toISOString().split('T')[0] || '';
            }
          }
        } catch (e) {
          dateKey = detection.createdAt?.toISOString().split('T')[0] || '';
        }
      } else {
        dateKey = detection.createdAt?.toISOString().split('T')[0] || '';
      }
      
      if (dateKey) {
        dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
      }
    });

    // Transform counts to arrays with proper format
    const severityStats = Object.entries(severityCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Group tactics to show top 5, then "Others"
    const tacticArray = Object.entries(tacticCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    
    const top5Tactics = tacticArray.slice(0, 5);
    const otherTactics = tacticArray.slice(5);
    const othersCount = otherTactics.reduce((sum, item) => sum + item.value, 0);
    
    let tacticStats = [...top5Tactics];
    if (othersCount > 0) {
      tacticStats.push({ name: "Others", value: othersCount });
    }

    const productTypeStats = Object.entries(productTypeCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const dailyTrending = Object.entries(dailyCounts)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day)); // Sort chronologically

    const stats = {
      total: detections.length,
      severity: severityStats,
      tactic: tacticStats,
      productType: productTypeStats,
      dailyTrending: dailyTrending,
      // Summary stats for quick access
      summary: {
        totalDetections: detections.length,
        criticalCount: severityCounts['Critical'] || 0,
        highCount: severityCounts['High'] || 0,
        mediumCount: severityCounts['Medium'] || 0,
        lowCount: severityCounts['Low'] || 0,
        uniqueTactics: Object.keys(tacticCounts).length,
        uniqueProductTypes: Object.keys(productTypeCounts).length,
        dateRange: {
          earliest: dailyTrending[0]?.day || null,
          latest: dailyTrending[dailyTrending.length - 1]?.day || null,
        }
      }
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching Falcon detection stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Falcon detection stats: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}