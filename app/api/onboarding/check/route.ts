import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const adminCount = await prisma.user.count({
      where: {
        role: 'ADMIN',
        active: true
      }
    });

    return NextResponse.json({ needsOnboarding: adminCount === 0 });
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    // On error, assume no onboarding needed to prevent redirect loops
    return NextResponse.json({ needsOnboarding: false });
  }
}