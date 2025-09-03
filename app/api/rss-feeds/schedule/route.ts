import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { fetchAllActiveRSSFeeds } from '@/lib/rss-parser';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin can trigger scheduled updates
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Run RSS feed update
    const results = await fetchAllActiveRSSFeeds();
    
    return NextResponse.json({
      message: `Scheduled RSS update completed: ${results.successful} successful, ${results.failed} failed`,
      timestamp: new Date().toISOString(),
      ...results
    });

  } catch (error) {
    console.error('Error running scheduled RSS update:', error);
    return NextResponse.json(
      { error: 'Failed to run scheduled RSS update' },
      { status: 500 }
    );
  }
}