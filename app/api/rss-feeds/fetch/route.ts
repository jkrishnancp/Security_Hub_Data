import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { fetchAndParseRSSFeed, fetchAllActiveRSSFeeds } from '@/lib/rss-parser';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { feedId, all } = body;

    if (all) {
      // Fetch all active RSS feeds
      const results = await fetchAllActiveRSSFeeds();
      
      return NextResponse.json({
        message: `Fetched ${results.total} feeds: ${results.successful} successful, ${results.failed} failed`,
        ...results
      });
    } else if (feedId) {
      // Fetch specific RSS feed
      const result = await fetchAndParseRSSFeed(feedId);
      
      if (result.success) {
        return NextResponse.json({
          message: `Successfully fetched ${result.count} new items`,
          count: result.count
        });
      } else {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Either feedId or all=true must be provided' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error fetching RSS feeds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS feeds' },
      { status: 500 }
    );
  }
}