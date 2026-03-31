import { POST as register } from '@/app/api/auth/register/route';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { POST as changePassword } from '@/app/api/auth/change-password/route';
import { GET as me } from '@/app/api/me/route';
import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({
  createSession: jest.fn(),
  setSessionCookie: jest.fn(),
  validateEmail: jest.fn(() => true),
  validatePassword: jest.fn(() => true),
  hashPassword: jest.fn(async () => 'hashed'),
  verifyPassword: jest.fn(async () => true),
  requireAuth: jest.fn(),
  clearSessionCookie: jest.fn(),
  hashToken: jest.fn(() => 'token-hash'),
  SESSION_COOKIE_NAME: 'trip_planner_session',
}));

import { prisma } from '@/lib/prisma';
import {
  clearSessionCookie,
  createSession,
  hashPassword,
  requireAuth,
  setSessionCookie,
  validatePassword,
  verifyPassword,
} from '@/lib/auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockCreateSession = createSession as jest.Mock;
const mockSetSessionCookie = setSessionCookie as jest.Mock;
const mockHashPassword = hashPassword as jest.Mock;
const mockVerifyPassword = verifyPassword as jest.Mock;
const mockRequireAuth = requireAuth as jest.Mock;
const mockClearSessionCookie = clearSessionCookie as jest.Mock;
const mockValidatePassword = validatePassword as jest.Mock;

describe('auth routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registers new user and sets session cookie', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.create as jest.Mock).mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'A' });
    mockCreateSession.mockResolvedValue({ rawToken: 'token', session: { expiresAt: new Date() } });

    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'password123', name: 'A' }),
    });

    const res = await register(req);
    expect(res.status).toBe(201);
    expect(mockHashPassword).toHaveBeenCalled();
    expect(mockSetSessionCookie).toHaveBeenCalled();
  });

  it('rejects duplicate email on register', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1' });

    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'password123', name: 'A' }),
    });

    const res = await register(req);
    expect(res.status).toBe(409);
  });

  it('logs in existing user', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      passwordHash: 'stored',
    });
    mockVerifyPassword.mockResolvedValue(true);
    mockCreateSession.mockResolvedValue({ rawToken: 'token', session: { expiresAt: new Date() } });

    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'password123' }),
    });

    const res = await login(req);
    expect(res.status).toBe(200);
    expect(mockSetSessionCookie).toHaveBeenCalled();
  });

  it('rejects invalid login password', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      passwordHash: 'stored',
    });
    mockVerifyPassword.mockResolvedValue(false);

    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'wrong' }),
    });

    const res = await login(req);
    expect(res.status).toBe(401);
  });

  it('clears cookie on logout', async () => {
    const req = new NextRequest('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: { cookie: 'trip_planner_session=abc' },
    });

    const res = await logout(req);
    expect(res.status).toBe(204);
    expect(mockPrisma.session.deleteMany).toHaveBeenCalled();
    expect(mockClearSessionCookie).toHaveBeenCalled();
  });

  it('returns current user from /api/me', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'A' });
    const req = new NextRequest('http://localhost/api/me');

    const res = await me(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.email).toBe('a@b.com');
  });

  it('returns 401 from /api/me when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    const req = new NextRequest('http://localhost/api/me');

    const res = await me(req);
    expect(res.status).toBe(401);
  });

  it('changes password when current password is correct', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'A' });
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      passwordHash: 'old-hash',
    });
    mockVerifyPassword.mockResolvedValue(true);
    mockValidatePassword.mockReturnValue(true);
    mockHashPassword.mockResolvedValue('new-hash');
    (mockPrisma.user.update as jest.Mock).mockResolvedValue({ id: 'u1' });

    const req = new NextRequest('http://localhost/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'oldpass123', newPassword: 'newpass123' }),
    });

    const res = await changePassword(req);
    expect(res.status).toBe(200);
    expect(mockVerifyPassword).toHaveBeenCalledWith('oldpass123', 'old-hash');
    expect(mockHashPassword).toHaveBeenCalledWith('newpass123');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: 'new-hash' },
    });
  });

  it('rejects change-password when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const req = new NextRequest('http://localhost/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'oldpass123', newPassword: 'newpass123' }),
    });

    const res = await changePassword(req);
    expect(res.status).toBe(401);
  });

  it('rejects change-password when current password is wrong', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'A' });
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      passwordHash: 'old-hash',
    });
    mockVerifyPassword.mockResolvedValue(false);

    const req = new NextRequest('http://localhost/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'wrongpass', newPassword: 'newpass123' }),
    });

    const res = await changePassword(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('rejects change-password when new password is too short', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'A' });
    mockValidatePassword.mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'oldpass123', newPassword: 'short' }),
    });

    const res = await changePassword(req);
    expect(res.status).toBe(400);
  });
});
