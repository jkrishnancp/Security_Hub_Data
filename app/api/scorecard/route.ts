import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Scorecard API: Checking session...');
    const session = await getServerSession(authOptions);
    console.log('👤 Session status:', session ? 'authenticated' : 'not authenticated');
    
    if (!session) {
      console.log('❌ Scorecard API: No valid session found');
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: 'Please log in to access scorecard data'
      }, { status: 401 });
    }

    console.log('✅ Scorecard API: User authenticated:', session.user?.email);

    // Get date parameter from query string
    const { searchParams } = new URL(request.url);
    const selectedDate = searchParams.get('date');

    // Get the selected or latest scorecard rating
    const latestRating = selectedDate 
      ? await prisma.scorecardRating.findFirst({
          where: {
            reportDate: new Date(selectedDate)
          }
        })
      : await prisma.scorecardRating.findFirst({
          orderBy: { reportDate: 'desc' }
        });

    // Get previous rating for trend comparison
    const previousRating = await prisma.scorecardRating.findFirst({
      where: {
        reportDate: { lt: latestRating?.reportDate }
      },
      orderBy: { reportDate: 'desc' }
    });

    console.log('📊 Scorecard API: Latest rating found:', !!latestRating);
    if (latestRating) {
      console.log('  - Report Date:', latestRating.reportDate);
      console.log('  - Threat Score:', latestRating.threatIndicatorsScore);
      console.log('  - Letter Grade:', latestRating.letterGrade);
    }

    if (!latestRating) {
      console.log('❌ Scorecard API: No scorecard data found in database');
      return NextResponse.json({
        error: 'No scorecard data available',
        details: 'Please import a NETGEAR scorecard report first'
      }, { status: 404 });
    }

    // Get detailed issues from the new table (excluding INFO severity)
    // First try to find issues from the exact date
    let issuesRaw = await prisma.scorecardIssueDetail.findMany({
      where: {
        reportDate: latestRating.reportDate,
        status: 'active',
        NOT: {
          issueTypeSeverity: 'INFO'
        }
      },
      take: 50 // Limit to top 50 issues
    });

    // If no issues found for exact date, find issues from the most recent date
    if (issuesRaw.length === 0) {
      console.log('🔍 No issues found for exact rating date, searching for most recent issues...');
      
      // Get the most recent issue date
      const mostRecentIssueDate = await prisma.scorecardIssueDetail.findFirst({
        where: {
          status: 'active',
          NOT: {
            issueTypeSeverity: 'INFO'
          }
        },
        orderBy: { reportDate: 'desc' },
        select: { reportDate: true }
      });

      if (mostRecentIssueDate) {
        console.log(`📅 Found issues from date: ${mostRecentIssueDate.reportDate.toISOString().split('T')[0]}`);
        
        issuesRaw = await prisma.scorecardIssueDetail.findMany({
          where: {
            reportDate: mostRecentIssueDate.reportDate,
            status: 'active',
            NOT: {
              issueTypeSeverity: 'INFO'
            }
          },
          take: 50
        });
      }
    }

    console.log(`📋 Found ${issuesRaw.length} non-INFO issues to display`);

    // Sort issues by severity in proper order (Critical > High > Medium > Low)
    const severityOrder: Record<string, number> = {
      'CRITICAL': 4,
      'HIGH': 3, 
      'MEDIUM': 2,
      'LOW': 1
    };

    const issues = issuesRaw.sort((a, b) => {
      const severityA = severityOrder[a.issueTypeSeverity] || 0;
      const severityB = severityOrder[b.issueTypeSeverity] || 0;
      
      if (severityA !== severityB) {
        return severityB - severityA; // Higher severity first
      }
      
      // If same severity, sort by score impact
      return (b.issueTypeScoreImpact || 0) - (a.issueTypeScoreImpact || 0);
    });

    // Calculate trends for each category
    const calculateTrend = (current: number | null, previous: number | null) => {
      if (!current || !previous) return { change: 0, direction: 'none' as const };
      const change = current - previous;
      return {
        change: Math.abs(change),
        direction: change > 0 ? 'up' as const : change < 0 ? 'down' as const : 'none' as const
      };
    };

    // Build categories from individual scores in the rating (exclude Threat Indicators)
    const categories = [
      {
        name: 'Network Security',
        score: latestRating.networkSecurityScore || 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('network')).length,
        trend: calculateTrend(latestRating.networkSecurityScore, previousRating?.networkSecurityScore || null)
      },
      {
        name: 'DNS Health',
        score: latestRating.dnsHealthScore || 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('dns')).length,
        trend: calculateTrend(latestRating.dnsHealthScore, previousRating?.dnsHealthScore || null)
      },
      {
       name: 'Patching Cadence',
       score: latestRating.patchingCadenceScore ?? 0,  // use ?? instead of ||
       weight: 1.0,
       issues: issues.filter(i => i.factorName.toLowerCase().includes('patching')).length,
       trend: calculateTrend(
      latestRating.patchingCadenceScore ?? null,
       previousRating?.patchingCadenceScore ?? null
       )
       },
      {
        name: 'Endpoint Security',
        score: latestRating.endpointSecurityScore || 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('endpoint')).length,
        trend: calculateTrend(latestRating.endpointSecurityScore, previousRating?.endpointSecurityScore)
      },
      {
        name: 'IP Reputation',
        score: latestRating.ipReputationScore || 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('ip')).length,
        trend: calculateTrend(latestRating.ipReputationScore, previousRating?.ipReputationScore)
      },
      {
        name: 'Application Security',
        score: latestRating.applicationSecurityScore || 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('application')).length,
        trend: calculateTrend(latestRating.applicationSecurityScore, previousRating?.applicationSecurityScore)
      },
      {
        name: 'Cubit Score',
        score: latestRating.cubitScore || 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('cubit')).length,
        trend: calculateTrend(latestRating.cubitScore, previousRating?.cubitScore)
      },
      {
        name: 'Hacker Chatter',
        score: latestRating.hackerChatterScore || 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('hacker')).length,
        trend: calculateTrend(latestRating.hackerChatterScore, previousRating?.hackerChatterScore)
      },
      {
        name: 'Information Leak',
        score: latestRating.informationLeakScore || 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('information') || i.factorName.toLowerCase().includes('leak')).length,
        trend: calculateTrend(latestRating.informationLeakScore, previousRating?.informationLeakScore)
      },
      {
        name: 'Social Engineering',
        score: latestRating.socialEngineeringScore || 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('social')).length,
        trend: calculateTrend(latestRating.socialEngineeringScore, previousRating?.socialEngineeringScore)
      }
    ].sort((a, b) => a.score - b.score); // Sort by score ascending

    // Convert issues to the expected format
    const topIssues = issues.map(issue => ({
      id: issue.id,
      description: issue.issueTypeTitle || issue.description || 'No description',
      severity: issue.issueTypeSeverity,
      category: issue.factorName,
      businessUnit: latestRating.company || 'NETGEAR',
      openedDate: issue.firstSeen?.toISOString() || issue.createdAt.toISOString(),
      impactScore: issue.issueTypeScoreImpact
    }));

    // Get available dates for date picker
    const availableDates = await prisma.scorecardRating.findMany({
      select: {
        reportDate: true
      },
      orderBy: { reportDate: 'desc' }
    });

    const scorecard = {
      overallScore: latestRating.threatIndicatorsScore || 0, // Use Threat Indicators as Overall Security Rating
      letterGrade: latestRating.letterGrade,
      categories,
      topIssues,
      numberOfIpAddressesScanned: latestRating.numberOfIpAddressesScanned || 0,
      numberOfDomainNamesScanned: latestRating.numberOfDomainNamesScanned || 0,
      selectedDate: latestRating.reportDate,
      availableDates: availableDates.map(d => d.reportDate),
      hasPreviousData: !!previousRating
    };

    console.log('✅ Scorecard API: Returning data with', categories.length, 'categories and', topIssues.length, 'issues');
    console.log('📈 Categories:', categories.map(c => `${c.name}: ${c.score}`));
    
    return NextResponse.json(scorecard);

  } catch (error) {
    console.error('Scorecard calculation error:', error);
    return NextResponse.json({
      error: 'Failed to calculate scorecard',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !['ADMIN', 'ANALYST'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      error: 'POST method not implemented for scorecard endpoint',
      details: 'Use GET method to retrieve scorecard data'
    }, { status: 405 });

  } catch (error) {
    console.error('Scorecard update error:', error);
    return NextResponse.json({
      error: 'Failed to update scorecard',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
