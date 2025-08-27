import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    
    // Validate the update data
    const updateData: any = {};
    
    if (body.status !== undefined) {
      updateData.status = body.status;
      
      // Update closed date based on status
      if (body.status.toLowerCase() === 'closed' || body.status.toLowerCase() === 'done' || body.status.toLowerCase() === 'resolved') {
        updateData.closedAt = new Date();
      } else {
        updateData.closedAt = null;
      }
    }
    
    if (body.description !== undefined) {
      updateData.description = body.description;
    }
    
    if (body.assignee !== undefined) {
      updateData.assignee = body.assignee;
    }
    
    if (body.priority !== undefined) {
      updateData.priority = body.priority;
    }

    // Always update the system updated timestamp
    updateData.updatedAtSystem = new Date();

    // Update the item in the database
    const updatedItem = await prisma.openItem.update({
      where: { id: id },
      data: updateData,
    });

    return NextResponse.json({ 
      success: true, 
      item: updatedItem 
    });

  } catch (error) {
    console.error('Error updating open item:', error);
    
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const item = await prisma.openItem.findUnique({
      where: { id: id },
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      item: item 
    });

  } catch (error) {
    console.error('Error fetching open item:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch item' },
      { status: 500 }
    );
  }
}