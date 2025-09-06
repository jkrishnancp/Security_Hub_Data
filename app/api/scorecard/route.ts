import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Simple in-memory cache
const scorecardCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: 'Please log in to access scorecard data'
      }, { status: 401 });
    }

    // Get date parameter from query string
    const { searchParams } = new URL(request.url);
    const selectedDate = searchParams.get('date');

    // Check cache first (bump version to invalidate older cached results)
    const cacheKey = `scorecard-v3-${selectedDate || 'latest'}`;
    const cached = scorecardCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    // Get the selected or latest scorecard rating WITH previous rating in one optimized query
    const ratings = selectedDate 
      ? await prisma.scorecardRating.findMany({
          where: {
            reportDate: { lte: new Date(selectedDate) }
          },
          orderBy: { reportDate: 'desc' },
          take: 2
        })
      : await prisma.scorecardRating.findMany({
          orderBy: { reportDate: 'desc' },
          take: 2
        });

    const latestRating = ratings[0];
    const previousRating = ratings[1];

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

    // Determine the most recent relevant date: use the newer of rating date and latest issue date
    const latestIssue = await prisma.scorecardIssueDetail.findMany({
      orderBy: { reportDate: 'desc' },
      take: 1
    });
    const latestIssueDate = latestIssue[0]?.reportDate ?? latestRating.reportDate;
    const effectiveDate = latestIssueDate > latestRating.reportDate ? latestIssueDate : latestRating.reportDate;

    // Get detailed issues in one optimized query
    const issuesRaw = await prisma.scorecardIssueDetail.findMany({
      where: {
        reportDate: {
          lte: effectiveDate
        },
        // Do not filter by status; files use ACTIVE consistently
        issueTypeSeverity: {
          in: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] // Exclude INFO
        }
      },
      orderBy: [
        { reportDate: 'desc' },
        { issueTypeScoreImpact: 'desc' }
      ],
      // Get all issues for proper grouping - no limit
    });

    console.log(`📋 Found ${issuesRaw.length} non-INFO issues to display`);
    
    // Log category breakdown
    const categoryStats = issuesRaw.reduce((acc, issue) => {
      acc[issue.factorName] = (acc[issue.factorName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('📊 Issues by category:', categoryStats);
    
    // Log unique factorName values to debug
    const uniqueFactorNames = Array.from(new Set(issuesRaw.map(i => i.factorName)));
    console.log('🏷️ All unique factorName values:', uniqueFactorNames);
    
    // Log detailed breakdown to understand the exact factorName patterns
    console.log('🔍 Detailed factorName analysis:');
    Object.entries(categoryStats).forEach(([factorName, count]) => {
      console.log(`  - "${factorName}": ${count} issues`);
      // Check if this might be Application Security related
      if (factorName.toLowerCase().includes('app') || 
          factorName.toLowerCase().includes('web') || 
          factorName.toLowerCase().includes('ssl') ||
          factorName.toLowerCase().includes('tls') ||
          factorName.toLowerCase().includes('certificate') ||
          factorName.toLowerCase().includes('security') ||
          count > 50) { // High count might indicate Application Security
        console.log(`    ⚠️  Potential Application Security category: "${factorName}"`);
      }
    });

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
      return (b.issueTypeScoreImpact ?? 0) - (a.issueTypeScoreImpact ?? 0);
    });

    // Helper: normalize possibly-undefined numbers to number|null
    const n = (v: number | null | undefined): number | null => v ?? null;

    // Calculate trends for each category (treat only null as "missing")
    const calculateTrend = (current: number | null, previous: number | null) => {
      if (current === null || previous === null) {
        return { change: 0, direction: 'none' as const };
      }
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
        score: latestRating.networkSecurityScore ?? 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('network')).length,
        trend: calculateTrend(n(latestRating.networkSecurityScore), n(previousRating?.networkSecurityScore))
      },
      {
        name: 'DNS Health',
        score: latestRating.dnsHealthScore ?? 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('dns')).length,
        trend: calculateTrend(n(latestRating.dnsHealthScore), n(previousRating?.dnsHealthScore))
      },
      {
        name: 'Patching Cadence',
        score: latestRating.patchingCadenceScore ?? 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('patching')).length,
        trend: calculateTrend(n(latestRating.patchingCadenceScore), n(previousRating?.patchingCadenceScore))
      },
      {
        name: 'Endpoint Security',
        score: latestRating.endpointSecurityScore ?? 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('endpoint')).length,
        trend: calculateTrend(n(latestRating.endpointSecurityScore), n(previousRating?.endpointSecurityScore))
      },
      {
        name: 'IP Reputation',
        score: latestRating.ipReputationScore ?? 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('ip')).length,
        trend: calculateTrend(n(latestRating.ipReputationScore), n(previousRating?.ipReputationScore))
      },
      {
        name: 'Application Security',
        score: latestRating.applicationSecurityScore ?? 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('application')).length,
        trend: calculateTrend(n(latestRating.applicationSecurityScore), n(previousRating?.applicationSecurityScore))
      },
      {
        name: 'Cubit Score',
        score: latestRating.cubitScore ?? 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('cubit')).length,
        trend: calculateTrend(n(latestRating.cubitScore), n(previousRating?.cubitScore))
      },
      {
        name: 'Hacker Chatter',
        score: latestRating.hackerChatterScore ?? 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('hacker')).length,
        trend: calculateTrend(n(latestRating.hackerChatterScore), n(previousRating?.hackerChatterScore))
      },
      {
        name: 'Information Leak',
        score: latestRating.informationLeakScore ?? 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('information') || i.factorName.toLowerCase().includes('leak')).length,
        trend: calculateTrend(n(latestRating.informationLeakScore), n(previousRating?.informationLeakScore))
      },
      {
        name: 'Social Engineering',
        score: latestRating.socialEngineeringScore ?? 0,
        weight: 1.0,
        issues: issues.filter(i => i.factorName.toLowerCase().includes('social')).length,
        trend: calculateTrend(n(latestRating.socialEngineeringScore), n(previousRating?.socialEngineeringScore))
      }
    ].sort((a, b) => a.score - b.score); // Sort by score ascending

    // Helper function to determine asset display value
    const getAssetDisplay = (issue: any) => {
      if (issue.finalUrl) {
        return issue.finalUrl;
      } else if (issue.subdomain) {
        return issue.subdomain;
      } else if (issue.hostname) {
        return issue.hostname;
      } else if (issue.target) {
        return issue.target;
      } else if (issue.ipAddresses) {
        return issue.ipAddresses;
      } else {
        return 'No Asset Information Available';
      }
    };

    // Group issues by category and asset
    const groupedIssuesMap = new Map<string, {
      groupKey: string;
      category: string;
      asset: string;
      issues: any[];
      severity: string; // Highest severity in the group
      totalImpactScore: number;
      earliestOpenedDate: string;
      businessUnit: string;
      description: string;
      count: number;
    }>();

    // Log first few Application Security issues to debug
    const appSecIssues = issues.filter(i => i.factorName.toLowerCase().includes('application'));
    console.log(`🔍 Found ${appSecIssues.length} Application Security issues for grouping`);
    if (appSecIssues.length > 0) {
      console.log('📝 First 3 App Security issues:', appSecIssues.slice(0, 3).map(i => ({
        id: i.id,
        factorName: i.factorName,
        severity: i.issueTypeSeverity,
        title: i.issueTypeTitle
      })));
    }

    issues.forEach(issue => {
      const asset = getAssetDisplay(issue);
      
      // If no valid asset info, create individual ungrouped entries (unique ID per issue)
      // Otherwise, group by category + asset
      const groupKey = asset === 'No Asset Information Available' 
        ? `${issue.factorName}|NO_ASSET|${issue.id}` // Unique key for each issue without asset
        : `${issue.factorName}|${asset}`;
      
      if (groupedIssuesMap.has(groupKey)) {
        const existing = groupedIssuesMap.get(groupKey)!;
        existing.issues.push(issue);
        existing.count++;
        existing.totalImpactScore += (issue.issueTypeScoreImpact ?? 0);
        
        // Update to highest severity (Critical > High > Medium > Low)
        const severityOrder: Record<string, number> = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        if ((severityOrder[issue.issueTypeSeverity] ?? 0) > (severityOrder[existing.severity] ?? 0)) {
          existing.severity = issue.issueTypeSeverity;
        }
        
        // Keep earliest opened date
        const issueDate = issue.firstSeen?.toISOString() || issue.createdAt.toISOString();
        if (issueDate < existing.earliestOpenedDate) {
          existing.earliestOpenedDate = issueDate;
        }
      } else {
        groupedIssuesMap.set(groupKey, {
          groupKey,
          category: issue.factorName,
          asset,
          issues: [issue],
          severity: issue.issueTypeSeverity,
          totalImpactScore: issue.issueTypeScoreImpact ?? 0,
          earliestOpenedDate: issue.firstSeen?.toISOString() || issue.createdAt.toISOString(),
          businessUnit: latestRating.company || 'NETGEAR',
          description: issue.issueTypeTitle || issue.description || 'No description',
          count: 1
        });
      }
    });

    console.log(`🔗 Grouped ${issuesRaw.length} issues into ${groupedIssuesMap.size} groups`);
    
    // Log group breakdown
    const groupStats = {
      totalGroups: groupedIssuesMap.size,
      groupedIssues: 0,
      ungroupedIssues: 0,
      assetlessIssues: 0
    };
    
    Array.from(groupedIssuesMap.values()).forEach(group => {
      if (group.count > 1) {
        console.log(`📦 Group: ${group.category} | ${group.asset} = ${group.count} issues`);
        groupStats.groupedIssues += group.count;
      } else {
        groupStats.ungroupedIssues++;
        if (group.asset === 'No Asset Information Available') {
          groupStats.assetlessIssues++;
        }
      }
    });
    
    console.log('📊 Grouping Stats:', groupStats);
    console.log(`✅ Total issues processed: ${issuesRaw.length}`);
    console.log(`📋 Total groups/items to display: ${groupedIssuesMap.size}`);

    // Convert grouped issues to the expected format, sorted by total impact score
    const topIssues = Array.from(groupedIssuesMap.values())
      .sort((a, b) => b.totalImpactScore - a.totalImpactScore)
      // Show all grouped issues - no limit
      .map(group => ({
        id: group.groupKey,
        description: group.count > 1 
          ? `${group.description} (${group.count} issues)` 
          : group.description,
        severity: group.severity,
        category: group.category,
        businessUnit: group.businessUnit,
        openedDate: group.earliestOpenedDate,
        impactScore: group.totalImpactScore,
        asset: group.asset,
        count: group.count,
        groupedIssues: group.issues.map(issue => ({
          id: issue.id,
          description: issue.issueTypeTitle || issue.description || 'No description',
          severity: issue.issueTypeSeverity,
          impactScore: issue.issueTypeScoreImpact ?? 0,
          openedDate: issue.firstSeen?.toISOString() || issue.createdAt.toISOString()
        }))
      }));

    // Get available dates for date picker (cache this too since it rarely changes)
    const availableDatesCache = scorecardCache.get('available-dates');
    let availableDates;
    
    if (availableDatesCache && Date.now() - availableDatesCache.timestamp < CACHE_DURATION * 2) {
      availableDates = availableDatesCache.data;
    } else {
      const dateResults = await prisma.scorecardRating.findMany({
        select: {
          reportDate: true
        },
        orderBy: { reportDate: 'desc' },
        take: 10 // Limit to last 10 dates for performance
      });
      availableDates = dateResults.map(d => d.reportDate);
      scorecardCache.set('available-dates', { data: availableDates, timestamp: Date.now() });
    }

    const scorecard = {
      overallScore: latestRating.threatIndicatorsScore ?? 0,
      letterGrade: latestRating.letterGrade,
      categories,
      topIssues,
      totalIssueCount: issuesRaw.length, // Total individual issues from database
      numberOfIpAddressesScanned: latestRating.numberOfIpAddressesScanned ?? 0,
      numberOfDomainNamesScanned: latestRating.numberOfDomainNamesScanned ?? 0,
      selectedDate: latestRating.reportDate,
      availableDates,
      hasPreviousData: !!previousRating
    };

    // Cache the result
    scorecardCache.set(cacheKey, { data: scorecard, timestamp: Date.now() });
    
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
    
    if (!session || !['ADMIN', 'ANALYST'].includes((session.user as any).role)) {
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
