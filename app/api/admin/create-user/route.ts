import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// Simple secure bootstrap endpoint to create a user when you cannot log in.
// Protection: Requires X-Setup-Token header to equal NEXTAUTH_SECRET.
// Usage (example):
// curl -X POST http://localhost:3000/api/admin/create-user \
//  -H 'Content-Type: application/json' \
//  -H 'X-Setup-Token: <NEXTAUTH_SECRET>' \
//  -d '{"email":"admin@example.com","password":"@Bcd12345","role":"ADMIN"}'

export async function POST(request: NextRequest) {
  try {
    const setupToken = request.headers.get('x-setup-token') || request.headers.get('X-Setup-Token');
    const secret = process.env.NEXTAUTH_SECRET;

    if (!secret) {
      return NextResponse.json({ error: 'Server is missing NEXTAUTH_SECRET' }, { status: 500 });
    }

    if (!setupToken || setupToken !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const email = (body.email || 'admin@example.com').toLowerCase().trim();
    const password = body.password || '@Bcd12345';
    const role = (body.role || 'ADMIN').toUpperCase();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role, active: true },
      create: { email, passwordHash, role, active: true },
      select: { id: true, email: true, role: true, active: true, createdAt: true }
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Create-user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

