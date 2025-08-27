import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { database, days, mode } = body;

    if (!database || days === undefined || !mode) {
      return NextResponse.json({ 
        error: 'Missing required parameters',
        details: ['database, days, and mode are required'] 
      }, { status: 400 });
    }

    if (!['keep_recent', 'delete_old'].includes(mode)) {
      return NextResponse.json({ 
        error: 'Invalid cleanup mode',
        details: ['mode must be either "keep_recent" or "delete_old"'] 
      }, { status: 400 });
    }

    // Calculate the cutoff date based on mode
    let cutoffDate = new Date();
    let operationDescription = '';
    
    if (mode === 'keep_recent') {
      // Keep data from the last X days (delete older than X days ago)
      cutoffDate.setDate(cutoffDate.getDate() - days);
      operationDescription = `Keep data from last ${days} days (delete older than ${cutoffDate.toLocaleDateString()})`;
    } else if (mode === 'delete_old') {
      // Delete data from the last X days (keep older than X days ago)  
      cutoffDate.setDate(cutoffDate.getDate() - days);
      operationDescription = `Delete data from last ${days} days (keep older than ${cutoffDate.toLocaleDateString()})`;
    }

    let deletedCount = 0;
    let tableName = '';

    // Handle different database cleanup operations
    switch (database) {
      case 'secureworks':
        tableName = 'Secureworks Alerts';
        const secureworksResult = await prisma.secureworksAlert.deleteMany({
          where: {
            created_at: mode === 'keep_recent' 
              ? { lt: cutoffDate }  // Delete older than cutoff (keep recent)
              : { gt: cutoffDate }  // Delete newer than cutoff (delete recent, keep old)
          }
        });
        deletedCount = secureworksResult.count;
        break;

      case 'falcon':
        tableName = 'Falcon Detections';
        const falconResult = await prisma.falconDetection.deleteMany({
          where: {
            createdAt: mode === 'keep_recent' 
              ? { lt: cutoffDate }
              : { gt: cutoffDate }
          }
        });
        deletedCount = falconResult.count;
        break;

      case 'aws_security_hub':
        tableName = 'AWS Security Hub Findings';
        const awsResult = await prisma.awsSecurityHubFinding.deleteMany({
          where: {
            foundAt: mode === 'keep_recent' 
              ? { lt: cutoffDate }
              : { gt: cutoffDate }
          }
        });
        deletedCount = awsResult.count;
        break;

      case 'scorecard_ratings':
        tableName = 'Scorecard Ratings';
        const ratingsResult = await prisma.scorecardRating.deleteMany({
          where: {
            reportDate: mode === 'keep_recent' 
              ? { lt: cutoffDate }
              : { gt: cutoffDate }
          }
        });
        deletedCount = ratingsResult.count;
        break;

      case 'scorecard_issues':
        tableName = 'Scorecard Issues';
        const issuesResult = await prisma.scorecardIssueDetail.deleteMany({
          where: {
            reportDate: mode === 'keep_recent' 
              ? { lt: cutoffDate }
              : { gt: cutoffDate }
          }
        });
        deletedCount = issuesResult.count;
        break;

      case 'open_items':
        tableName = 'Open Items';
        const openItemsResult = await prisma.openItem.deleteMany({
          where: {
            createdAt: mode === 'keep_recent' 
              ? { lt: cutoffDate }
              : { gt: cutoffDate }
          }
        });
        deletedCount = openItemsResult.count;
        break;

      case 'threat_advisories':
        tableName = 'Threat Advisories';
        const threatResult = await prisma.threatAdvisory.deleteMany({
          where: {
            createdAt: mode === 'keep_recent' 
              ? { lt: cutoffDate }
              : { gt: cutoffDate }
          }
        });
        deletedCount = threatResult.count;
        break;

      case 'ingestion_logs':
        tableName = 'Ingestion Logs';
        const logsResult = await prisma.ingestionLog.deleteMany({
          where: {
            createdAt: mode === 'keep_recent' 
              ? { lt: cutoffDate }
              : { gt: cutoffDate }
          }
        });
        deletedCount = logsResult.count;
        break;

      case 'all_security':
        tableName = 'All Security Data';
        // Clean all security tables in parallel based on mode
        const dateCondition = mode === 'keep_recent' 
          ? { lt: cutoffDate }
          : { gt: cutoffDate };
          
        const [secureworks, falcon, aws, ratings, issues, openItems, threats] = await Promise.all([
          prisma.secureworksAlert.deleteMany({ where: { created_at: dateCondition } }),
          prisma.falconDetection.deleteMany({ where: { createdAt: dateCondition } }),
          prisma.awsSecurityHubFinding.deleteMany({ where: { foundAt: dateCondition } }),
          prisma.scorecardRating.deleteMany({ where: { reportDate: dateCondition } }),
          prisma.scorecardIssueDetail.deleteMany({ where: { reportDate: dateCondition } }),
          prisma.openItem.deleteMany({ where: { createdAt: dateCondition } }),
          prisma.threatAdvisory.deleteMany({ where: { createdAt: dateCondition } })
        ]);
        
        deletedCount = secureworks.count + falcon.count + aws.count + 
                      ratings.count + issues.count + openItems.count + threats.count;
        break;

      default:
        return NextResponse.json({ 
          error: 'Invalid database type',
          details: ['Supported types: secureworks, falcon, aws_security_hub, scorecard_ratings, scorecard_issues, open_items, threat_advisories, ingestion_logs, all_security'] 
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully cleaned ${tableName}`,
      deletedCount,
      cutoffDate: cutoffDate.toISOString(),
      days: days,
      mode: mode,
      operationDescription: operationDescription,
      tableName: tableName
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({
      error: 'Database cleanup failed',
      details: [error instanceof Error ? error.message : 'Unknown error']
    }, { status: 500 });
  }
}

// GET method to return available databases and their record counts
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get record counts for all tables
    const [
      secureworksCount,
      falconCount,
      awsCount,
      ratingsCount,
      issuesCount,
      openItemsCount,
      threatsCount,
      logsCount
    ] = await Promise.all([
      prisma.secureworksAlert.count(),
      prisma.falconDetection.count(),
      prisma.awsSecurityHubFinding.count(),
      prisma.scorecardRating.count(),
      prisma.scorecardIssueDetail.count(),
      prisma.openItem.count(),
      prisma.threatAdvisory.count(),
      prisma.ingestionLog.count()
    ]);

    const databases = [
      { 
        value: 'secureworks', 
        label: 'Secureworks Alerts', 
        count: secureworksCount,
        description: 'Security detection alerts with threat scores and MITRE techniques'
      },
      { 
        value: 'falcon', 
        label: 'Falcon Detections', 
        count: falconCount,
        description: 'CrowdStrike Falcon endpoint detection events'
      },
      { 
        value: 'aws_security_hub', 
        label: 'AWS Security Hub Findings', 
        count: awsCount,
        description: 'Cloud security compliance findings and controls'
      },
      { 
        value: 'scorecard_ratings', 
        label: 'Scorecard Ratings', 
        count: ratingsCount,
        description: 'Security scorecard summary ratings and grades'
      },
      { 
        value: 'scorecard_issues', 
        label: 'Scorecard Issues', 
        count: issuesCount,
        description: 'Detailed security scorecard issue findings'
      },
      { 
        value: 'open_items', 
        label: 'Open Items', 
        count: openItemsCount,
        description: 'Jira-tracked security tasks and action items'
      },
      { 
        value: 'threat_advisories', 
        label: 'Threat Advisories', 
        count: threatsCount,
        description: 'Threat intelligence advisories and impact assessments'
      },
      { 
        value: 'ingestion_logs', 
        label: 'Ingestion Logs', 
        count: logsCount,
        description: 'File upload and processing history logs'
      },
      { 
        value: 'all_security', 
        label: 'All Security Data', 
        count: secureworksCount + falconCount + awsCount + ratingsCount + issuesCount + openItemsCount + threatsCount,
        description: 'All security data tables (excludes user accounts and ingestion logs)'
      }
    ];

    return NextResponse.json({
      databases: databases.filter(db => db.count > 0), // Only show tables with data
      totalRecords: databases.reduce((sum, db) => sum + db.count, 0)
    });

  } catch (error) {
    console.error('Error fetching database info:', error);
    return NextResponse.json({
      error: 'Failed to fetch database information',
      details: [error instanceof Error ? error.message : 'Unknown error']
    }, { status: 500 });
  }
}