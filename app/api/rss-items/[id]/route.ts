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

    const rssItem = await prisma.rssItem.findUnique({
      where: { id: params.id },
      include: {
        rssFeed: {
          select: {
            name: true,
            category: true,
            url: true
          }
        }
      }
    });

    if (!rssItem) {
      return NextResponse.json(
        { error: 'RSS item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(rssItem);
  } catch (error) {
    console.error('Error fetching RSS item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS item' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { read, bookmarked, severity } = body;

    // Check if RSS item exists
    const existingItem = await prisma.rssItem.findUnique({
      where: { id: params.id }
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'RSS item not found' },
        { status: 404 }
      );
    }

    // Update RSS item
    const updatedItem = await prisma.rssItem.update({
      where: { id: params.id },
      data: {
        ...(typeof read === 'boolean' && { read }),
        ...(typeof bookmarked === 'boolean' && { bookmarked }),
        ...(severity && { severity })
      }
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error updating RSS item:', error);
    return NextResponse.json(
      { error: 'Failed to update RSS item' },
      { status: 500 }
    );
  }
}