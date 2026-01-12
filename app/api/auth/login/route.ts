import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 로그인 API: 실제 DB 조회 우선, 실패 시 Mock 저장소 사용
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 입력 형식 검증
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 이메일 형식 검증 (간단한 검증)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // 비밀번호 최소 길이 검증 (4자 이상)
    if (password.length < 4) {
      return NextResponse.json(
        { success: false, message: '비밀번호는 최소 4자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const mockUserEmail = email;

    // 실제 DB 연결 확인
    const isConnected = await ensurePrismaConnected();
    
    if (!isConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다. 서버 관리자에게 문의하세요.' },
        { status: 503 }
      );
    }

    // DB에서 사용자 조회
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email: mockUserEmail },
        select: {
          id: true,
          email: true,
          role: true,
          adminRole: true, // ★★★ adminRole 추가 ★★★
          nickname: true, // ★★★ nickname 추가 ★★★
          password: true,
          milliGold: true, // 잔액(milliGold)도 함께 조회
        },
      });
    } catch (dbError: any) {
      return NextResponse.json(
        { success: false, message: '로그인 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { success: false, message: '등록되지 않은 이메일입니다.' },
        { status: 401 }
      );
    }

    // 비밀번호 검증 (실제 운영에서는 해시 비교 필요)
    // 현재는 Mock이므로 형식만 검증
    if (password.length < 4) {
      return NextResponse.json(
        { success: false, message: '비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // ★★★ 중복 로그인 방지: 고유 세션 ID 생성 및 DB 저장 ★★★
    const loginTime = Date.now();
    const newSessionId = `${user.id}-${loginTime}-${Math.random().toString(36).substring(2, 8)}`;
    
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastSessionId: newSessionId, // 새 세션 ID로 갱신 (기존 세션 무효화)
          updatedAt: new Date(),
        },
      });
      console.log(`🔐 [로그인] ${mockUserEmail}: 새 세션 생성 (기존 세션 무효화됨)`);
    } catch (updateError) {
      console.error('세션 ID 업데이트 실패:', updateError);
      // 업데이트 실패해도 로그인은 진행
    }

    // ★★★ 마스터 계정 자동 동기화 ★★★
    const SUPER_ADMIN_EMAIL = 'limtaesik@gmail.com';
    if (mockUserEmail === SUPER_ADMIN_EMAIL) {
      if (user.role !== 'ADMIN' || user.adminRole !== 'SUPER') {
        try {
          const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN', adminRole: 'SUPER' },
            select: { id: true, role: true, adminRole: true },
          });
          user.role = updatedUser.role as any;
          user.adminRole = updatedUser.adminRole as any;
        } catch (updateError) {
          console.error('마스터 계정 동기화 실패:', updateError);
        }
      }
    }

    // 세션 쿠키 설정 (sessionId로 중복 로그인 검증)
    cookieStore.set('auth_session', JSON.stringify({
      userId: user.id,
      email: mockUserEmail,
      role: user.role,
      adminRole: user.adminRole || null, // ★★★ adminRole 추가 ★★★
      nickname: user.nickname || null, // ★★★ nickname 추가 ★★★
      milliGold: user.milliGold || 0,
      loginTime: loginTime,
      sessionId: newSessionId, // DB와 동일한 세션 ID
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });

    return NextResponse.json({
      success: true,
      message: '로그인 성공',
      user: {
        email: mockUserEmail,
        role: user.role,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

