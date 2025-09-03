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
    const category = searchParams.get('category');
    const active = searchParams.get('active');

    // Build where clause based on filters
    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (active !== null) {
      where.active = active === 'true';
    }

    // Get RSS feeds from database
    const rssFeeds = await prisma.rssFeed.findMany({
      where,
      include: {
        _count: {
          select: { rssItems: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json(rssFeeds);
  } catch (error) {
    console.error('Error fetching RSS feeds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS feeds' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, url, category } = body;

    if (!name || !url || !category) {
      return NextResponse.json(
        { error: 'Name, URL, and category are required' },
        { status: 400 }
      );
    }

    // Check if feed already exists
    const existingFeed = await prisma.rssFeed.findUnique({
      where: { url }
    });

    if (existingFeed) {
      return NextResponse.json(
        { error: 'RSS feed with this URL already exists' },
        { status: 409 }
      );
    }

    // Create new RSS feed
    const rssFeed = await prisma.rssFeed.create({
      data: {
        name,
        url,
        category,
        active: true,
      }
    });

    return NextResponse.json(rssFeed, { status: 201 });
  } catch (error) {
    console.error('Error creating RSS feed:', error);
    return NextResponse.json(
      { error: 'Failed to create RSS feed' },
      { status: 500 }
    );
  }
}