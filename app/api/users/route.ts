import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !['ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all users from database
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        active: true,
        businessUnit: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      users 
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !['ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, role, businessUnit, tempPassword } = body;

    if (!email || !role || !tempPassword) {
      return NextResponse.json(
        { success: false, error: 'Email, role, and password are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash the temporary password
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        email,
        role,
        businessUnit: businessUnit || null,
        passwordHash,
        active: true
      },
      select: {
        id: true,
        email: true,
        role: true,
        active: true,
        businessUnit: true,
        createdAt: true
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      user: newUser,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !['ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, userIds } = body;

    if (!action || !userIds || !Array.isArray(userIds)) {
      return NextResponse.json(
        { success: false, error: 'Action and userIds array are required' },
        { status: 400 }
      );
    }

    let updateData: any = {};
    let message = '';

    switch (action) {
      case 'enable':
        updateData = { active: true };
        message = `Enabled ${userIds.length} user(s)`;
        break;
      case 'disable':
        updateData = { active: false };
        message = `Disabled ${userIds.length} user(s)`;
        break;
      case 'reset-password':
        // Generate a temporary password
        const tempPassword = Math.random().toString(36).slice(-8);
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        updateData = { passwordHash };
        message = `Password reset for ${userIds.length} user(s). Temporary password: ${tempPassword}`;
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Update users
    const result = await prisma.user.updateMany({
      where: {
        id: { in: userIds }
      },
      data: updateData
    });
    
    return NextResponse.json({ 
      success: true, 
      count: result.count,
      message
    });
  } catch (error) {
    console.error('Error updating users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update users' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !['ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userIds = searchParams.get('ids')?.split(',') || [];

    if (userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User IDs are required' },
        { status: 400 }
      );
    }

    // Prevent deleting the current user
    const currentUserId = session.user.id;
    if (userIds.includes(currentUserId)) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Delete users
    const result = await prisma.user.deleteMany({
      where: {
        id: { in: userIds }
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      count: result.count,
      message: `Deleted ${result.count} user(s)`
    });
  } catch (error) {
    console.error('Error deleting users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete users' },
      { status: 500 }
    );
  }
}