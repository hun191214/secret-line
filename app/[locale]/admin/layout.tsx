export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import AdminLayoutShell from '@/app/components/AdminLayoutShell';

interface AdminLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

const MASTER_EMAIL = 'limtaesik@gmail.com';

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  // 1. 비동기 데이터들 미리 받기
  const resolvedParams = await params;
  const locale = resolvedParams?.locale || 'ko';
  
  // 2. 쿠키 조회
  let cookieStore;
  try {
    cookieStore = await cookies();
  } catch (cookieError) {
    console.error('[Admin Layout] 쿠키 조회 실패:', cookieError);
    redirect(`/${locale}`);
  }
  
  const sessionCookie = cookieStore.get('auth_session');

  // 3. 비로그인/세션 없음 -> 튕겨내기
  if (!sessionCookie || !sessionCookie.value) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Admin Layout] 세션 쿠키 없음');
    }
    redirect(`/${locale}`);
  }

  // 4. 세션 파싱
  let session: {
    email?: string;
    userId?: string;
    role?: string;
    adminRole?: string;
  };
  
  try {
    session = JSON.parse(sessionCookie.value);
  } catch (parseError) {
    console.error('[Admin Layout] 세션 파싱 실패:', parseError);
    redirect(`/${locale}`);
  }

  // 5. 세션 기본 검증
  if (!session || (!session.email && !session.userId)) {
    console.error('[Admin Layout] 세션에 email/userId 없음');
    redirect(`/${locale}`);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Admin Layout] 세션 정보:', {
      email: session.email,
      userId: session.userId,
      role: session.role,
      adminRole: session.adminRole,
    });
  }

  const email = session.email;
  const userId = session.userId;
  const sessionRole = session.role;
  const sessionAdminRole = session.adminRole;

  // ★★★ 빠른 경로: 세션에 이미 ADMIN role이 있으면 DB 조회 없이 진행 ★★★
  // (마스터 계정이거나 세션에 role=ADMIN이 있는 경우)
  if (email === MASTER_EMAIL || (sessionRole === 'ADMIN' && sessionAdminRole)) {
    const adminRole = email === MASTER_EMAIL ? 'SUPER' : sessionAdminRole;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Admin Layout] 빠른 경로 - 세션 기반 인증 통과:', { email, adminRole });
    }
    
    return (
      <AdminLayoutShell locale={locale} adminRole={adminRole as any}>
        {children}
      </AdminLayoutShell>
    );
  }

  // 6. DB 검증이 필요한 경우
  try {
    const connected = await ensurePrismaConnected();
    if (!connected) {
      console.error('[Admin Layout] DB 연결 실패 - 세션 기반 폴백 시도');
      
      // DB 연결 실패 시 세션 정보로 폴백
      if (sessionRole === 'ADMIN' && sessionAdminRole) {
        return (
          <AdminLayoutShell locale={locale} adminRole={sessionAdminRole as any}>
            {children}
          </AdminLayoutShell>
        );
      }
      redirect(`/${locale}`);
    }

    let user = null;

    // 7. 마스터 계정 처리
    if (email === MASTER_EMAIL) {
      user = await prisma.user.findUnique({
        where: { email: MASTER_EMAIL },
        select: { id: true, email: true, role: true, adminRole: true },
      });

      if (!user) {
        console.error('[Admin Layout] 마스터 계정을 DB에서 찾을 수 없음');
        redirect(`/${locale}`);
      }

      // 마스터 계정 role/adminRole 강제 설정
      if (user.role !== 'ADMIN' || user.adminRole !== 'SUPER') {
        try {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN', adminRole: 'SUPER' },
            select: { id: true, email: true, role: true, adminRole: true },
          });
        } catch (updateError) {
          console.error('[Admin Layout] 마스터 계정 업데이트 실패:', updateError);
          // 업데이트 실패해도 마스터는 통과
        }
      }
    } else {
      // 8. 일반 사용자 조회
      if (userId) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, role: true, adminRole: true },
        });
      }
      
      if (!user && email) {
        user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, role: true, adminRole: true },
        });
      }

      // 사용자 없음
      if (!user) {
        console.error('[Admin Layout] 사용자를 찾을 수 없음:', { userId, email });
        redirect(`/${locale}`);
      }
      
      // ADMIN이 아님
      if (user.role !== 'ADMIN') {
        console.error('[Admin Layout] 관리자 권한 없음:', {
          email: user.email,
          role: user.role,
        });
        redirect(`/${locale}`);
      }
    }

    // 9. 최종 확인
    if (!user || user.role !== 'ADMIN') {
      console.error('[Admin Layout] 최종 권한 체크 실패');
      redirect(`/${locale}`);
    }

    return (
      <AdminLayoutShell locale={locale} adminRole={user.adminRole as any}>
        {children}
      </AdminLayoutShell>
    );

  } catch (error) {
    console.error('[Admin Layout] 에러 발생:', error);
    
    // DB 에러 시 세션 기반 폴백
    if (sessionRole === 'ADMIN' && sessionAdminRole) {
      console.log('[Admin Layout] DB 에러 - 세션 기반 폴백');
      return (
        <AdminLayoutShell locale={locale} adminRole={sessionAdminRole as any}>
          {children}
        </AdminLayoutShell>
      );
    }
    
    redirect(`/${locale}`);
  }
}