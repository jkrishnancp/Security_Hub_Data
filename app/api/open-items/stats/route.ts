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

    // Build where clause based on filters
    const where: any = {};

    // Date range filter
    if (start || end) {
      where.createdAt = {};
      if (start) where.createdAt.gte = new Date(start);
      if (end) where.createdAt.lte = new Date(end);
    }

    // Get all items for stats calculation
    const allItems = await prisma.openItem.findMany({
      where,
      select: {
        id: true,
        status: true,
        assignee: true,
        priority: true,
        createdAt: true,
        closedAt: true,
      }
    });

    // Calculate stats
    const totalItems = allItems.length;
    
    // Open vs Closed items
    const openStatuses = ['to do', 'todo', 'in progress', 'inprogress', 'hold', 'blocked', 'backlog', 'open'];
    const closedStatuses = ['closed', 'done', 'resolved', 'complete', 'finished'];
    
    const openItems = allItems.filter(item => {
      const status = (item.status || '').toLowerCase();
      return openStatuses.includes(status) || (!closedStatuses.includes(status) && !item.closedAt);
    });
    
    const closedItems = allItems.filter(item => {
      const status = (item.status || '').toLowerCase();
      return closedStatuses.includes(status) || !!item.closedAt;
    });

    // Count by assignee (open items only)
    const assigneeStats = openItems.reduce((acc, item) => {
      const assignee = item.assignee || 'Unassigned';
      acc[assignee] = (acc[assignee] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Count by priority (open items only)
    const priorityStats = openItems.reduce((acc, item) => {
      const priority = item.priority || 'Unspecified';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Count by status
    const statusStats = allItems.reduce((acc, item) => {
      const status = item.status || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Items created over time (last 30 days, grouped by day)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentItems = allItems.filter(item => 
      new Date(item.createdAt) >= thirtyDaysAgo
    );
    
    const dailyCreation = recentItems.reduce((acc, item) => {
      const dateKey = new Date(item.createdAt).toISOString().split('T')[0];
      acc[dateKey] = (acc[dateKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Resolution time stats for closed items
    const closedItemsWithResolutionTime = closedItems
      .filter(item => item.closedAt)
      .map(item => {
        const created = new Date(item.createdAt);
        const closed = new Date(item.closedAt!);
        const resolutionDays = Math.ceil((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return resolutionDays;
      });

    const avgResolutionTime = closedItemsWithResolutionTime.length > 0
      ? Math.round(closedItemsWithResolutionTime.reduce((sum, days) => sum + days, 0) / closedItemsWithResolutionTime.length)
      : 0;

    const stats = {
      summary: {
        total: totalItems,
        open: openItems.length,
        closed: closedItems.length,
        avgResolutionDays: avgResolutionTime,
      },
      
      // Format for charts
      openVsClosed: [
        { name: 'Open', value: openItems.length },
        { name: 'Closed', value: closedItems.length },
      ],
      
      byAssignee: Object.entries(assigneeStats).map(([name, value]) => ({
        name,
        value,
      })),
      
      byPriority: Object.entries(priorityStats).map(([name, value]) => ({
        name,
        value,
      })),
      
      byStatus: Object.entries(statusStats).map(([name, value]) => ({
        name,
        value,
      })),
      
      dailyCreation: Object.entries(dailyCreation).map(([date, count]) => ({
        date,
        count,
      })).sort((a, b) => a.date.localeCompare(b.date)),
    };
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching open items stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch open items statistics' },
      { status: 500 }
    );
  }
}