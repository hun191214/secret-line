import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import AdminLayoutShell from '@/app/components/AdminLayoutShell';

interface AdminLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>; // Next.js 최신 버전은 params도 Promise입니다.
}

const MASTER_EMAIL = 'limtaesik@gmail.com';

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  // 1. 비동기 데이터들 미리 받기 (await 처리)
  const { locale } = await params;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('auth_session');

  // 2. 비로그인/세션 없음 -> 즉시 튕겨내기
  if (!sessionCookie) {
    redirect(`/${locale}`);
  }

  try {
    let session: any;
    try {
      session = JSON.parse(sessionCookie.value);
    } catch {
      redirect(`/${locale}`);
    }

    const connected = await ensurePrismaConnected();
    if (!connected) {
      redirect(`/${locale}`);
    }

    const email: string | undefined = session.email;
    const userId: string | undefined = session.userId;

    let user = null;

    // 3. 마스터 계정 우선 처리
    if (email === MASTER_EMAIL) {
      user = await prisma.user.findUnique({
        where: { email: MASTER_EMAIL },
        select: { id: true, email: true, role: true, adminRole: true },
      });

      // 마스터 계정이 없으면 생성하거나, 있으면 role/adminRole 강제 업데이트
      if (!user) {
        // 마스터 계정이 DB에 없으면 리다이렉트 (일반적으로는 생성되어 있어야 함)
        redirect(`/${locale}`);
      } else {
        // 마스터 계정의 role과 adminRole을 강제로 ADMIN/SUPER로 설정
        if (user.role !== 'ADMIN' || user.adminRole !== 'SUPER') {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN', adminRole: 'SUPER' },
            select: { id: true, email: true, role: true, adminRole: true },
          });
        }
      }
    } else {
      // 4. 일반 사용자: userId 또는 email로 DB 조회
      if (userId) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, role: true, adminRole: true },
        });
      } else if (email) {
        // userId가 없으면 email로 조회 시도
        user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, role: true, adminRole: true },
        });
      }

      // 5. 일반 유저(ADMIN이 아닌 경우) -> 즉시 튕겨내기
      if (!user || user.role !== 'ADMIN') {
        redirect(`/${locale}`);
      }
    }

    // 6. 관리자라면 쉘로 감싸서 렌더링
    return (
      <AdminLayoutShell locale={locale} adminRole={user?.adminRole as any}>
        {children}
      </AdminLayoutShell>
    );

  } catch (error) {
    console.error("Admin Layout Error:", error);
    redirect(`/${locale}`); // 에러 발생 시에도 안전하게 메인으로 보냅니다.
  }
}