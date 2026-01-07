import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

export type AdminGuardResult =
  | {
      authorized: true;
      user: { id: string; email: string; role: string; adminRole: string | null };
    }
  | { authorized: false; status: number; message: string };

const SUPER_ADMIN_EMAIL = 'limtaesik@gmail.com';

type AuthUser = { id: string; email: string; role: string; adminRole: string | null };

interface AuthResult {
  user: AuthUser | null;
  status?: number;
  message?: string;
}

async function getAuthenticatedUser(): Promise<AuthResult> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('auth_session');

  if (!sessionCookie) {
    return { user: null, status: 401, message: '로그인이 필요합니다.' };
  }

  let session: any;
  try {
    session = JSON.parse(sessionCookie.value);
  } catch {
    return { user: null, status: 401, message: '세션이 올바르지 않습니다.' };
  }

  const connected = await ensurePrismaConnected();
  if (!connected) {
    return { user: null, status: 503, message: '데이터베이스 연결에 실패했습니다.' };
  }

  const email: string | undefined = session.email;
  const userId: string | undefined = session.userId;

  // 1) 마스터 계정: 이메일 기준 우선 처리 및 DB 동기화
  if (email === SUPER_ADMIN_EMAIL) {
    const existing = await prisma.user.findUnique({
      where: { email: SUPER_ADMIN_EMAIL },
      select: { id: true, email: true, role: true, adminRole: true },
    });

    if (!existing) {
      return {
        user: null,
        status: 403,
        message: '마스터 관리자 계정을 찾을 수 없습니다.',
      };
    }

    if (existing.role !== 'ADMIN' || existing.adminRole !== 'SUPER') {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'ADMIN', adminRole: 'SUPER' },
        select: { id: true, email: true, role: true, adminRole: true },
      });
      return { user: updated };
    }

    return { user: existing };
  }

  // 2) 일반 관리자: userId 기반 조회
  if (!userId) {
    return { user: null, status: 401, message: '세션 정보가 올바르지 않습니다.' };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, adminRole: true },
  });

  if (!user) {
    return { user: null, status: 403, message: '사용자를 찾을 수 없습니다.' };
  }

  return { user };
}

export async function requireSuperAdmin(): Promise<AdminGuardResult> {
  const { user, status, message } = await getAuthenticatedUser();

  if (!user) {
    return {
      authorized: false,
      status: status ?? 401,
      message: message ?? '인증에 실패했습니다.',
    };
  }

  if (
    user.email === SUPER_ADMIN_EMAIL ||
    (user.role === 'ADMIN' && user.adminRole === 'SUPER')
  ) {
    return { authorized: true, user };
  }

  return {
    authorized: false,
    status: 403,
    message: '최고관리자 권한이 필요합니다.',
  };
}

export async function requireAdmin(allowedRoles: string[]): Promise<AdminGuardResult> {
  const { user, status, message } = await getAuthenticatedUser();

  if (!user) {
    return {
      authorized: false,
      status: status ?? 401,
      message: message ?? '인증에 실패했습니다.',
    };
  }

  // 마스터 계정 및 SUPER 등급은 항상 통과
  if (user.email === SUPER_ADMIN_EMAIL || user.adminRole === 'SUPER') {
    return { authorized: true, user };
  }

  if (user.role !== 'ADMIN' || !user.adminRole || !allowedRoles.includes(user.adminRole)) {
    return {
      authorized: false,
      status: 403,
      message: '해당 메뉴에 대한 접근 권한이 없습니다.',
    };
  }

  return { authorized: true, user };
}

