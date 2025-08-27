import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        });

        if (!user || !user.active) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          businessUnit: user.businessUnit ?? undefined,
          firstName: user.firstName ?? undefined,
          lastName: user.lastName ?? undefined,
          displayName: user.displayName ?? undefined,
          avatar: user.avatar ?? undefined,
          department: user.department ?? undefined,
          phone: user.phone ?? undefined,
          location: user.location ?? undefined,
          createdAt: user.createdAt?.toISOString(),
        };
      }
    })
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        token.role = user.role;
        token.businessUnit = user.businessUnit;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.displayName = user.displayName;
        token.avatar = user.avatar;
        token.department = user.department;
        token.phone = user.phone;
        token.location = user.location;
        token.createdAt = user.createdAt;
      }
      
      // Handle session updates (for profile changes)
      if (trigger === 'update' && session) {
        token.firstName = session.firstName;
        token.lastName = session.lastName;
        token.displayName = session.displayName;
        token.avatar = session.avatar;
        token.department = session.department;
        token.phone = session.phone;
        token.location = session.location;
      }
      
      return token;
    },
    session: async ({ session, token }) => {
      if (token) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.businessUnit = token.businessUnit;
        session.user.firstName = token.firstName;
        session.user.lastName = token.lastName;
        session.user.displayName = token.displayName;
        session.user.avatar = token.avatar;
        session.user.department = token.department;
        session.user.phone = token.phone;
        session.user.location = token.location;
        session.user.createdAt = token.createdAt;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
  },
  session: {
    strategy: 'jwt',
  },
};