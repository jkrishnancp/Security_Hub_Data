import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rssFeed = await prisma.rssFeed.findUnique({
      where: { id: params.id },
      include: {
        rssItems: {
          orderBy: {
            pubDate: 'desc'
          },
          take: 50 // Limit to recent items
        }
      }
    });

    if (!rssFeed) {
      return NextResponse.json(
        { error: 'RSS feed not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(rssFeed);
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS feed' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, url, category, active } = body;

    // Check if RSS feed exists
    const existingFeed = await prisma.rssFeed.findUnique({
      where: { id: params.id }
    });

    if (!existingFeed) {
      return NextResponse.json(
        { error: 'RSS feed not found' },
        { status: 404 }
      );
    }

    // Check if URL is being changed and conflicts with another feed
    if (url && url !== existingFeed.url) {
      const conflictingFeed = await prisma.rssFeed.findUnique({
        where: { url }
      });

      if (conflictingFeed) {
        return NextResponse.json(
          { error: 'RSS feed with this URL already exists' },
          { status: 409 }
        );
      }
    }

    // Update RSS feed
    const updatedFeed = await prisma.rssFeed.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(url && { url }),
        ...(category && { category }),
        ...(typeof active === 'boolean' && { active })
      }
    });

    return NextResponse.json(updatedFeed);
  } catch (error) {
    console.error('Error updating RSS feed:', error);
    return NextResponse.json(
      { error: 'Failed to update RSS feed' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if RSS feed exists
    const existingFeed = await prisma.rssFeed.findUnique({
      where: { id: params.id }
    });

    if (!existingFeed) {
      return NextResponse.json(
        { error: 'RSS feed not found' },
        { status: 404 }
      );
    }

    // Delete RSS feed (cascade will delete related items)
    await prisma.rssFeed.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: 'RSS feed deleted successfully' });
  } catch (error) {
    console.error('Error deleting RSS feed:', error);
    return NextResponse.json(
      { error: 'Failed to delete RSS feed' },
      { status: 500 }
    );
  }
}