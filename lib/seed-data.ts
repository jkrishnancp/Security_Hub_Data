import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  try {
    // Note: User creation is now handled through the onboarding wizard
    // No demo users are created automatically - users go through proper setup

    // Create initial scorecard categories based on the PDF baseline
    const categories = [
      { name: 'Overall', baseScore: 90, weight: 1.0 },
      { name: 'Network Security', baseScore: 93, weight: 1.2 },
      { name: 'DNS Security', baseScore: 100, weight: 0.8 },
      { name: 'Patching Cadence', baseScore: 94, weight: 1.3 },
      { name: 'Endpoint Security', baseScore: 100, weight: 1.1 },
      { name: 'IP Reputation', baseScore: 100, weight: 0.9 },
      { name: 'Application Security', baseScore: 82, weight: 1.2 },
      { name: 'Cubit Score', baseScore: 100, weight: 0.7 },
      { name: 'Hacker Chatter', baseScore: 100, weight: 0.6 },
      { name: 'Information Leak', baseScore: 100, weight: 0.8 },
      { name: 'Social Engineering', baseScore: 100, weight: 1.0 },
    ];

    for (const category of categories) {
      await prisma.scorecardCategory.upsert({
        where: { name: category.name },
        update: {},
        create: {
          name: category.name,
          baseScore: category.baseScore,
          currentScore: category.baseScore,
          weight: category.weight,
          description: `${category.name} security category`,
        },
      });
    }

    // Create some sample data
    const sampleVulns = [
      {
        assetName: 'web-server-01',
        businessUnit: 'Consumer',
        cveId: 'CVE-2024-1234',
        severity: 'CRITICAL',
        slaDate: new Date(Date.now() - 86400000), // 1 day overdue
        status: 'OPEN',
        description: 'Critical RCE vulnerability in web application',
        discoveredAt: new Date(Date.now() - 86400000 * 5),
      },
      {
        assetName: 'db-server-02',
        businessUnit: 'Enterprise',
        cveId: 'CVE-2024-5678',
        severity: 'HIGH',
        slaDate: new Date(Date.now() + 86400000 * 7), // 7 days remaining
        status: 'IN_PROGRESS',
        description: 'SQL injection vulnerability in database layer',
        discoveredAt: new Date(Date.now() - 86400000 * 3),
      },
    ];

    for (const vuln of sampleVulns) {
      const created = await prisma.vulnerability.create({
        data: vuln as any,
      });

      // Create corresponding scorecard issue
      await prisma.scorecardIssue.create({
        data: {
          sourceType: 'vulnerability',
          sourceId: created.id,
          severity: vuln.severity as any,
          category: 'Patching Cadence',
          openedDate: vuln.discoveredAt,
          slaDate: vuln.slaDate,
          status: vuln.status as any,
          businessUnit: vuln.businessUnit,
          description: `Vulnerability: ${vuln.cveId} on ${vuln.assetName}`,
          impact: vuln.severity === 'CRITICAL' ? 3 : vuln.severity === 'HIGH' ? 2 : 1,
        },
      });
    }

    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}