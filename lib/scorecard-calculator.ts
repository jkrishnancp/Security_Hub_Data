import { prisma } from './prisma';
import { SeverityLevel, IssueStatus } from '@prisma/client';

interface CategoryScore {
  name: string;
  score: number;
  weight: number;
  issues: number;
}

interface ScorecardResult {
  overallScore: number;
  letterGrade: string;
  categories: CategoryScore[];
  topIssues: any[];
}

const SEVERITY_WEIGHTS = {
  CRITICAL: 10,
  HIGH: 5,
  MEDIUM: 2,
  LOW: 1,
  INFO: 0.5,
};

const SLA_DAYS = {
  CRITICAL: 7,
  HIGH: 30,
  MEDIUM: 90,
  LOW: 180,
  INFO: 365,
};

export class ScorecardCalculator {
  static async calculateScorecard(businessUnit?: string): Promise<ScorecardResult> {
    // Get all active scorecard issues
    const whereClause = businessUnit ? { businessUnit } : {};
    
    const issues = await prisma.scorecardIssue.findMany({
      where: {
        ...whereClause,
        status: {
          in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS],
        },
      },
      include: {
        vulnerability: true,
        detectionFalcon: true,
        detectionSecureworks: true,
        phishingJira: true,
        awsSecurityHubFinding: true,
        actionItem: true,
        threatAdvisory: true,
        issueReport: true,
      },
    });

    // Get scorecard categories
    const categories = await prisma.scorecardCategory.findMany({
      orderBy: { name: 'asc' },
    });

    // Calculate category scores
    const categoryScores: CategoryScore[] = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const category of categories) {
      const categoryIssues = issues.filter(issue => issue.category === category.name);
      const score = this.calculateCategoryScore(category, categoryIssues);
      
      categoryScores.push({
        name: category.name,
        score,
        weight: category.weight,
        issues: categoryIssues.length,
      });

      totalWeightedScore += score * category.weight;
      totalWeight += category.weight;
    }

    const overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 100;
    const letterGrade = this.getLetterGrade(overallScore);

    // Get top issues impacting score
    const topIssues = issues
      .map(issue => ({
        ...issue,
        impactScore: this.calculateIssueImpact(issue),
      }))
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 10);

    return {
      overallScore: Math.round(overallScore * 10) / 10,
      letterGrade,
      categories: categoryScores,
      topIssues,
    };
  }

  private static calculateCategoryScore(category: any, issues: any[]): number {
    if (issues.length === 0) {
      return category.baseScore;
    }

    let totalImpact = 0;
    let maxPossibleImpact = 0;

    for (const issue of issues) {
      const severityWeight = SEVERITY_WEIGHTS[issue.severity] || 1;
      const slaMultiplier = this.getSlaMultiplier(issue);
      const impact = severityWeight * slaMultiplier;
      
      totalImpact += impact;
      maxPossibleImpact += SEVERITY_WEIGHTS.CRITICAL * 2; // Max possible impact
    }

    // Calculate score reduction based on issue impact
    const impactPercentage = totalImpact / Math.max(maxPossibleImpact, 1);
    const scoreReduction = Math.min(impactPercentage * 30, 50); // Max 50 point reduction
    
    return Math.max(category.baseScore - scoreReduction, 0);
  }

  private static getSlaMultiplier(issue: any): number {
    if (!issue.slaDate) return 1;
    
    const now = new Date();
    const slaDate = new Date(issue.slaDate);
    
    if (now <= slaDate) return 1; // Within SLA
    
    const daysOverdue = Math.floor((now.getTime() - slaDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.min(1 + (daysOverdue / 30), 3); // Up to 3x impact for severely overdue
  }

  private static calculateIssueImpact(issue: any): number {
    const severityWeight = SEVERITY_WEIGHTS[issue.severity] || 1;
    const slaMultiplier = this.getSlaMultiplier(issue);
    return severityWeight * slaMultiplier * (issue.impact || 1);
  }

  private static getLetterGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  static async updateCategoryScores(businessUnit?: string) {
    const result = await this.calculateScorecard(businessUnit);
    
    // Update category scores in database
    for (const category of result.categories) {
      await prisma.scorecardCategory.updateMany({
        where: { name: category.name },
        data: {
          currentScore: category.score,
          lastCalculated: new Date(),
        },
      });
    }

    // Save rating snapshot
    await prisma.scorecardRating.upsert({
      where: { 
        reportDate: new Date(new Date().toDateString()), // Today's date
      },
      update: {
        overallScore: result.overallScore,
        letterGrade: result.letterGrade,
        breakdown: JSON.stringify(result.categories),
        businessUnit: businessUnit || null,
      },
      create: {
        reportDate: new Date(new Date().toDateString()),
        overallScore: result.overallScore,
        letterGrade: result.letterGrade,
        breakdown: JSON.stringify(result.categories),
        businessUnit: businessUnit || null,
      },
    });

    return result;
  }
}