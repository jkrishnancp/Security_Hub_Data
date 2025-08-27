import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      role: string;
      businessUnit?: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
      avatar?: string;
      department?: string;
      phone?: string;
      location?: string;
      createdAt?: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    email: string;
    role: string;
    businessUnit?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatar?: string;
    department?: string;
    phone?: string;
    location?: string;
    createdAt?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string;
    businessUnit?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatar?: string;
    department?: string;
    phone?: string;
    location?: string;
    createdAt?: string;
  }
}