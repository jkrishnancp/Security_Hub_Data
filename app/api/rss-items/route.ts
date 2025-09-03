import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Simple in-memory cache
const rssCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes for RSS items

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
    const severity = searchParams.get('severity');
    const category = searchParams.get('category');
    const read = searchParams.get('read');
    const feedId = searchParams.get('feedId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // Cap at 100
    const offset = parseInt(searchParams.get('offset') || '0');

    // Create cache key from all parameters
    const cacheKey = `rss-${JSON.stringify({ start, end, search, severity, category, read, feedId, limit, offset })}`;
    const cached = rssCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    // Build where clause based on filters
    const where: any = {};

    // Date range filter
    if (start || end) {
      where.pubDate = {};
      if (start) where.pubDate.gte = new Date(start);
      if (end) where.pubDate.lte = new Date(end);
    }

    // Search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Severity filter
    if (severity) {
      where.severity = severity;
    }

    // Category filter (via RSS feed)
    if (category) {
      where.rssFeed = {
        category
      };
    }

    // Read status filter
    if (read !== null) {
      where.read = read === 'true';
    }

    // Feed filter
    if (feedId) {
      where.feedId = feedId;
    }

    // Use Promise.all to run count and data queries in parallel
    const [total, rssItems] = await Promise.all([
      prisma.rssItem.count({ where }),
      prisma.rssItem.findMany({
        where,
        include: {
          rssFeed: {
            select: {
              name: true,
              category: true,
              url: true
            }
          }
        },
        orderBy: {
          pubDate: 'desc'
        },
        take: limit,
        skip: offset
      })
    ]);

    const result = {
      items: rssItems,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };

    // Cache the result
    rssCache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching RSS items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS items' },
      { status: 500 }
    );
  }
}