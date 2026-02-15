import { NextAuthOptions, getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './db';
import { verifyPassword } from './crypto';

// --- IP-based rate limiting (5 attempts, 15 min lockout) ---
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function getClientIp(): string {
  const h = headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim()
    || h.get('x-real-ip')
    || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; remainingMs?: number } {
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };

  if (record.lockedUntil > Date.now()) {
    return { allowed: false, remainingMs: record.lockedUntil - Date.now() };
  }

  // Lockout expired, reset
  if (record.lockedUntil > 0 && record.lockedUntil <= Date.now()) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedAttempt(ip: string): void {
  const record = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  record.count++;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION;
  }

  loginAttempts.set(ip, record);
}

function clearAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

// Behind Caddy TLS-terminating proxy: cookies must not use __Secure-/__Host-
// prefixes or secure flag since Next.js receives plain HTTP from the proxy.
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: false,
};

export const authOptions: NextAuthOptions = {
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: cookieOptions,
    },
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: { ...cookieOptions, httpOnly: false },
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: { ...cookieOptions, httpOnly: false },
    },
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const ip = getClientIp();
        const rateCheck = checkRateLimit(ip);
        if (!rateCheck.allowed) {
          const mins = Math.ceil((rateCheck.remainingMs || 0) / 60000);
          throw new Error(`Too many attempts. Try again in ${mins} minutes.`);
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          recordFailedAttempt(ip);
          throw new Error('Invalid credentials');
        }

        const isValid = await verifyPassword(credentials.password, user.passwordHash);
        if (!isValid) {
          recordFailedAttempt(ip);
          throw new Error('Invalid credentials');
        }

        // Success - clear attempts
        clearAttempts(ip);

        return {
          id: user.id,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};

/**
 * Check if the current request has a valid session.
 * Call at the top of every API route handler (except auth routes).
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { authorized: false as const, session: null };
  }
  return { authorized: true as const, session };
}

// Type extensions for NextAuth
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
  }
}
