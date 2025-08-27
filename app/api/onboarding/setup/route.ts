import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    // Check if system is already set up
    const existingAdmin = await prisma.user.findFirst({
      where: {
        role: 'ADMIN',
        active: true
      }
    });

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'System is already set up' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      companyName,
      companyDomain,
      adminEmail,
      adminPassword,
      firstName,
      lastName,
      displayName,
      phone,
      department,
      location,
      avatar
    } = body;

    // Validate required fields
    if (!companyName || !companyDomain || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Company name, domain, admin email, and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (adminPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,})+$/;
    if (!domainRegex.test(companyDomain)) {
      return NextResponse.json(
        { error: 'Invalid domain format (e.g., company.com)' },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create the admin user
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail.toLowerCase().trim(),
        passwordHash: hashedPassword,
        role: 'ADMIN',
        active: true,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        displayName: displayName?.trim() || null,
        phone: phone?.trim() || null,
        department: department?.trim() || null,
        location: location?.trim() || null,
        avatar: avatar || null,
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
        createdAt: true
      }
    });

    // You could store company info in a separate table or environment variable
    // For now, we'll just return success
    console.log(`✅ Company "${companyName}" set up with domain "${companyDomain}"`);
    console.log(`✅ Admin user created: ${adminEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Company setup completed successfully',
      admin: adminUser,
      company: {
        name: companyName,
        domain: companyDomain
      }
    });

  } catch (error) {
    console.error('Error during onboarding setup:', error);
    
    // Handle specific Prisma errors
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'An admin user with this email already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to set up the system. Please try again.' },
      { status: 500 }
    );
  }
}