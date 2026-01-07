import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * 로그아웃 처리: 세션 쿠키 삭제
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('auth_session');

    return NextResponse.json({
      success: true,
      message: '로그아웃되었습니다.',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: '로그아웃 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

