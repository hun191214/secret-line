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
  const cookieStore = await cookies(); // 여기서 await가 없으면 에러가 납니다!
  const sessionCookie = cookieStore.get('auth_session');

  // 2. 비로그인/세션 없음 -> 즉시 튕겨내기
  if (!sessionCookie) {
    redirect(`/${locale}`);
  }

  try {
    const session = JSON.parse(sessionCookie.value);
    await ensurePrismaConnected();

    // 3. 실시간 DB 권한 체크
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, role: true, adminRole: true }
    });

    // 4. 일반 유저(ADMIN이 아닌 경우) -> 즉시 튕겨내기
    // 단, 마스터 이메일 계정은 무조건 통과
    if (user?.email !== MASTER_EMAIL && user?.role !== 'ADMIN') {
      redirect(`/${locale}`);
    }

    // 5. 관리자라면 쉘로 감싸서 렌더링
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