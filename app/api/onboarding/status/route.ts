import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Check if system is already set up by looking for any admin users
    const adminCount = await prisma.user.count({
      where: {
        role: 'ADMIN',
        active: true
      }
    });

    // System is set up if there's at least one active admin
    const isSetup = adminCount > 0;

    return NextResponse.json({
      isSetup,
      needsOnboarding: !isSetup
    });
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    // If database is not accessible, assume system needs onboarding
    return NextResponse.json({
      isSetup: false,
      needsOnboarding: true
    });
  }
}