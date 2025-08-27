import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FileParser } from '@/lib/file-parsers';
import { ScorecardCalculator } from '@/lib/scorecard-calculator';

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

    // TODO: Add filename validation back
    const reportDate = new Date();

    // Parse the file
    const parsed = await FileParser.parseFile(file);
    
    if (parsed.errors.length > 0) {
      return NextResponse.json({
        error: 'File parsing errors',
        details: parsed.errors,
      }, { status: 400 });
    }

    // Create ingestion log
    const ingestionLog = await prisma.ingestionLog.create({
      data: {
        filename: file.name,
        originalName: file.name,
        fileType: file.name.split('.').pop() || 'unknown',
        checksum: await generateChecksum(file),
        source: parsed.type,
        rowsProcessed: parsed.data.length,
        reportDate: reportDate,
        importedDate: new Date(),
        status: 'SUCCESS',
      },
    });

    // Ingest data based on type
    let ingestedCount = 0;
    
    try {
      switch (parsed.type) {
        case 'vulnerabilities':
          ingestedCount = await ingestVulnerabilities(parsed.data);
          break;
        case 'falcon_detections':
          ingestedCount = await ingestFalconDetections(parsed.data);
          break;
        case 'secureworks_detections':
          ingestedCount = await ingestSecureworksDetections(parsed.data);
          break;
        case 'phishing_jira':
          ingestedCount = await ingestPhishingJira(parsed.data);
          break;
        case 'aws_security_hub':
          ingestedCount = await ingestAwsSecurityHub(parsed.data);
          break;
        case 'issue_reports':
          ingestedCount = await ingestIssueReports(parsed.data);
          break;
        case 'threat_advisories':
          ingestedCount = await ingestThreatAdvisories(parsed.data);
          break;
        case 'scorecard_categories':
          ingestedCount = await ingestScorecardCategories(parsed.data);
          break;
        default:
          throw new Error(`Unsupported data type: ${parsed.type}`);
      }

      // Update ingestion log with success
      await prisma.ingestionLog.update({
        where: { id: ingestionLog.id },
        data: { rowsProcessed: ingestedCount },
      });

      // Recalculate scorecard
      await ScorecardCalculator.updateCategoryScores();

      return NextResponse.json({
        success: true,
        type: parsed.type,
        rowsProcessed: ingestedCount,
        ingestionId: ingestionLog.id,
      });

    } catch (error) {
      // Update ingestion log with error
      await prisma.ingestionLog.update({
        where: { id: ingestionLog.id },
        data: {
          status: 'FAILED',
          errorLog: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

async function generateChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function ingestVulnerabilities(data: any[]): Promise<number> {
  let count = 0;
  
  for (const item of data) {
    try {
      await prisma.vulnerability.create({
        data: item,
      });
      
      // Create scorecard issue
      await prisma.scorecardIssue.create({
        data: {
          sourceType: 'vulnerability',
          sourceId: item.id,
          severity: item.severity,
          category: 'Patching Cadence',
          openedDate: item.discoveredAt,
          slaDate: item.slaDate,
          status: item.status,
          businessUnit: item.businessUnit,
          description: `Vulnerability: ${item.cveId || 'Unknown'} on ${item.assetName}`,
          impact: item.severity === 'CRITICAL' ? 3 : item.severity === 'HIGH' ? 2 : 1,
        },
      });
      
      count++;
    } catch (error) {
      console.error('Error ingesting vulnerability:', error);
    }
  }
  
  return count;
}

async function ingestFalconDetections(data: any[]): Promise<number> {
  let count = 0;
  
  for (const item of data) {
    try {
      await prisma.detectionFalcon.create({
        data: item,
      });
      
      await prisma.scorecardIssue.create({
        data: {
          sourceType: 'detection_falcon',
          sourceId: item.id,
          severity: item.severity,
          category: 'Endpoint Security',
          openedDate: item.detectedAt,
          status: item.status,
          businessUnit: 'Unknown', // Falcon detections may not have BU
          description: `Falcon Detection: ${item.tactic || 'Unknown'} on ${item.hostname}`,
          impact: item.severity === 'CRITICAL' ? 2 : 1,
        },
      });
      
      count++;
    } catch (error) {
      console.error('Error ingesting Falcon detection:', error);
    }
  }
  
  return count;
}

async function ingestSecureworksDetections(data: any[]): Promise<number> {
  let count = 0;
  
  for (const item of data) {
    try {
      await prisma.detectionSecureworks.create({
        data: item,
      });
      
      await prisma.scorecardIssue.create({
        data: {
          sourceType: 'detection_secureworks',
          sourceId: item.id,
          severity: item.severity,
          category: 'Network Security',
          openedDate: item.detectedAt,
          status: item.status,
          businessUnit: 'Unknown',
          description: `Secureworks Detection: ${item.category}`,
          impact: item.severity === 'CRITICAL' ? 2 : 1,
        },
      });
      
      count++;
    } catch (error) {
      console.error('Error ingesting Secureworks detection:', error);
    }
  }
  
  return count;
}

async function ingestPhishingJira(data: any[]): Promise<number> {
  let count = 0;
  
  for (const item of data) {
    try {
      await prisma.phishingJira.create({
        data: item,
      });
      
      await prisma.scorecardIssue.create({
        data: {
          sourceType: 'phishing_jira',
          sourceId: item.id,
          severity: item.priority,
          category: 'Social Engineering',
          openedDate: item.reportedAt,
          status: item.status,
          businessUnit: item.businessUnit,
          description: `Phishing Report: ${item.issueId}`,
          impact: 1,
        },
      });
      
      count++;
    } catch (error) {
      console.error('Error ingesting phishing Jira:', error);
    }
  }
  
  return count;
}

async function ingestAwsSecurityHub(data: any[]): Promise<number> {
  let count = 0;
  
  for (const item of data) {
    try {
      await prisma.awsSecurityHubFinding.create({
        data: item,
      });
      
      await prisma.scorecardIssue.create({
        data: {
          sourceType: 'aws_security_hub',
          sourceId: item.id,
          severity: item.severity,
          category: 'Network Security',
          openedDate: item.foundAt,
          status: item.status,
          businessUnit: item.account,
          description: `AWS Security Hub: ${item.controlId} in ${item.region}`,
          impact: 1,
        },
      });
      
      count++;
    } catch (error) {
      console.error('Error ingesting AWS Security Hub finding:', error);
    }
  }
  
  return count;
}

async function ingestIssueReports(data: any[]): Promise<number> {
  let count = 0;
  
  for (const item of data) {
    try {
      await prisma.issueReport.create({
        data: item,
      });
      
      await prisma.scorecardIssue.create({
        data: {
          sourceType: 'issue_report',
          sourceId: item.id,
          severity: item.severity,
          category: item.category,
          openedDate: item.openedDate,
          status: item.status,
          businessUnit: item.businessUnit,
          description: item.description,
          impact: item.severity === 'CRITICAL' ? 3 : item.severity === 'HIGH' ? 2 : 1,
        },
      });
      
      count++;
    } catch (error) {
      console.error('Error ingesting issue report:', error);
    }
  }
  
  return count;
}

async function ingestThreatAdvisories(data: any[]): Promise<number> {
  let count = 0;
  
  for (const item of data) {
    try {
      await prisma.threatAdvisory.create({
        data: item,
      });
      
      if (item.impacted) {
        await prisma.scorecardIssue.create({
          data: {
            sourceType: 'threat_advisory',
            sourceId: item.id,
            severity: item.netgearSeverity || item.severity,
            category: 'Application Security',
            openedDate: new Date(),
            status: 'OPEN',
            businessUnit: 'All',
            description: `Threat Advisory: ${item.advisoryName}`,
            impact: item.severity === 'CRITICAL' ? 3 : 2,
          },
        });
      }
      
      count++;
    } catch (error) {
      console.error('Error ingesting threat advisory:', error);
    }
  }
  
  return count;
}

async function ingestScorecardCategories(data: any[]): Promise<number> {
  let count = 0;
  
  for (const item of data) {
    try {
      await prisma.scorecardCategory.upsert({
        where: { name: item.name },
        update: {
          baseScore: item.score,
          currentScore: item.score,
          weight: item.weight || 1.0,
        },
        create: {
          name: item.name,
          baseScore: item.score,
          currentScore: item.score,
          weight: item.weight || 1.0,
        },
      });
      
      count++;
    } catch (error) {
      console.error('Error ingesting scorecard category:', error);
    }
  }
  
  return count;
}