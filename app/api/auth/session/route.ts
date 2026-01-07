import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { getDisplayName } from '@/lib/displayName';

/**
 * 현재 로그인 세션 확인 + 중복 로그인 검증 + displayName 주입
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_session');

    if (!sessionCookie) {
      return NextResponse.json({
        success: false,
        authenticated: false,
      });
    }

    let session;
    try {
      // ★★★ 쿠키 값 정리 (앞뒤 공백 제거) ★★★
      const cookieValue = sessionCookie.value.trim();
      session = JSON.parse(cookieValue);
      
      // 세션 객체 구조 검증
      if (!session || typeof session !== 'object') {
        throw new Error('Invalid session structure');
      }
    } catch (parseError: any) {
      // 깨진 세션 쿠키 삭제
      cookieStore.delete('auth_session');
      // console.error 제거 (JSON 응답 간섭 방지)
      return NextResponse.json({
        success: false,
        authenticated: false,
        error: 'INVALID_SESSION_COOKIE',
      });
    }
    
    // ★★★ DB에서 최신 사용자 정보 조회 ★★★
    let gender = session.gender || null;
    let displayName = session.email?.split('@')[0] || '사용자';
    let dbRole = session.role;
    let adminRole: string | null = session.adminRole || null;
    let isSessionValid = true;
    
    try {
      const isConnected = await ensurePrismaConnected();
      if (isConnected && session.userId) {
        const user = await prisma.user.findUnique({
          where: { id: session.userId },
          select: { 
            gender: true,
            role: true,
            adminRole: true,
            nickname: true,
            lastSessionId: true,
            counselorProfile: {
              select: {
                displayName: true,
              },
            },
          },
        });
        
        if (user) {
          gender = user.gender || gender;
          dbRole = user.role;
          adminRole = user.adminRole || null;
          
          // ★★★ getDisplayName 함수로 이름 결정 ★★★
          displayName = getDisplayName({
            email: session.email,
            nickname: user.nickname,
            counselorProfile: user.counselorProfile,
          });
          
          // ★★★ 중복 로그인 검증 ★★★
          if (user.lastSessionId && session.sessionId && user.lastSessionId !== session.sessionId) {
            // console.log 제거 (JSON 응답 간섭 방지)
            cookieStore.delete('auth_session');
            return NextResponse.json({
              success: false,
              authenticated: false,
              reason: 'DUPLICATE_LOGIN',
              message: '다른 기기에서 로그인하여 현재 세션이 종료되었습니다.',
            });
          }
        }
      }
    } catch (dbError: any) {
      // DB 조회 실패 시 세션 값 사용 (로그는 서버 측에서만)
      // console.log 제거로 JSON 응답 정리
    }
    
    // ★★★ JSON 응답 생성 (순수 객체만) ★★★
    const responseData = {
      success: true,
      authenticated: true,
      user: {
        email: session.email || null,
        role: dbRole || session.role || 'MEMBER',
        adminRole: adminRole,
        userId: session.userId || null,
        coins: session.coins || 0,
        counselorStatus: session.counselorStatus || 'offline',
        gender: gender || null,
        displayName: displayName || '사용자',
      },
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    return NextResponse.json({
      success: false,
      authenticated: false,
    });
  }
}

