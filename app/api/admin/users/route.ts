import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    console.log('Admin users GET - Session:', session?.user);
    
    if (!session || session.user.role !== 'ADMIN') {
      console.log('Admin users GET - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        displayName: true,
        department: true,
        location: true,
        active: true,
        businessUnit: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('Admin users GET - Found users:', users.length);
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, role, firstName, lastName, department } = body;
    
    console.log('Creating user with data:', { email, role, firstName, lastName, department });

    // Validate required fields
    if (!email || !role) {
      console.log('Validation failed: missing email or role');
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['ADMIN', 'ANALYST', 'VIEWER', 'BU_LEAD'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Generate a temporary password (in production, you'd send this via email)
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    console.log('About to create user with data:', {
      email,
      role,
      firstName: firstName || null,
      lastName: lastName || null,
      department: department || null,
    });

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash: hashedPassword,
        role: role as any, // Ensure role is properly typed
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        department: department?.trim() || null,
        active: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        displayName: true,
        department: true,
        location: true,
        active: true,
        businessUnit: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    // In production, you would send the temporary password via email
    console.log(`Temporary password for ${email}: ${tempPassword}`);

    return NextResponse.json({
      ...newUser,
      temporaryPassword: tempPassword // Remove this in production
    });
  } catch (error) {
    console.error('Error creating user:', error);
    
    // Check for specific Prisma errors
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }
    
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: `Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}