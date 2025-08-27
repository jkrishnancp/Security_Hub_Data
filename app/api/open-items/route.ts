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
    const status = searchParams.get('status');
    const assignee = searchParams.get('assignee');
    const priority = searchParams.get('priority');

    // Build where clause based on filters
    const where: any = {};

    // Date range filter
    if (start || end) {
      where.createdAt = {};
      if (start) where.createdAt.gte = new Date(start);
      if (end) where.createdAt.lte = new Date(end);
    }

    // Search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { assignee: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Assignee filter
    if (assignee) {
      where.assignee = assignee;
    }

    // Priority filter
    if (priority) {
      where.priority = priority;
    }

    // Get open items from database
    const openItems = await prisma.openItem.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json(openItems);
  } catch (error) {
    console.error('Error fetching open items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch open items' },
      { status: 500 }
    );
  }
}