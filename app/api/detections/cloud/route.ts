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
    
    // Build the where clause - focus on relevant findings
    const where: any = {
      status: {
        not: "CLOSED" // Only show open findings by default
      }
    };
    
    // Date filtering based on foundAt or createdAt
    if (start || end) {
      const dateField = 'foundAt'; // Primary date field
      where[dateField] = {};
      
      if (start) {
        const startDate = new Date(start);
        startDate.setHours(0, 0, 0, 0);
        where[dateField].gte = startDate;
      }
      
      if (end) {
        const endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);
        where[dateField].lte = endDate;
      }
    }
    
    // Search filtering - search across multiple text fields
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { controlId: { contains: searchTerm, mode: 'insensitive' } },
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { severity: { contains: searchTerm, mode: 'insensitive' } },
            { controlStatus: { contains: searchTerm, mode: 'insensitive' } },
            { customParameters: { contains: searchTerm, mode: 'insensitive' } },
            { relatedRequirements: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ]
        }
      ];
    }

    // Fetch AWS Security Hub findings with the filters applied
    const findings = await prisma.awsSecurityHubFinding.findMany({
      where,
      select: {
        id: true,
        controlId: true,
        title: true,
        controlStatus: true,
        severity: true,
        failedChecks: true,
        unknownChecks: true,
        notAvailableChecks: true,
        passedChecks: true,
        relatedRequirements: true,
        customParameters: true,
        status: true,
        description: true,
        reportDate: true,
        foundAt: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { foundAt: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 10000, // Reasonable limit to prevent performance issues
    });

    // Transform the data to ensure consistent format for the frontend
    const transformedFindings = findings.map(finding => ({
      ...finding,
      // Ensure these fields always exist for the frontend
      controlId: finding.controlId || 'Unknown',
      title: finding.title || 'Untitled Control',
      controlStatus: finding.controlStatus || 'Unknown',
      severity: finding.severity || 'MEDIUM',
      failedChecks: finding.failedChecks || 0,
      unknownChecks: finding.unknownChecks || 0,
      notAvailableChecks: finding.notAvailableChecks || 0,
      passedChecks: finding.passedChecks || 0,
      relatedRequirements: finding.relatedRequirements || '',
      customParameters: finding.customParameters || 'UNKNOWN',
      // Add computed fields for better frontend handling
      totalChecks: (finding.failedChecks || 0) + (finding.passedChecks || 0) + (finding.unknownChecks || 0) + (finding.notAvailableChecks || 0),
      // Extract service from controlId (e.g., "S3.8" -> "S3")
      service: finding.controlId ? finding.controlId.split('.')[0] : 'Unknown',
      // Compliance framework extraction
      hasNIST: (finding.relatedRequirements || '').includes('NIST'),
      hasPCI: (finding.relatedRequirements || '').includes('PCI'),
      hasSOC: (finding.relatedRequirements || '').includes('SOC'),
      hasISO: (finding.relatedRequirements || '').includes('ISO'),
    }));

    return NextResponse.json(transformedFindings);
  } catch (error) {
    console.error('Error fetching AWS Security Hub findings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AWS Security Hub findings: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}