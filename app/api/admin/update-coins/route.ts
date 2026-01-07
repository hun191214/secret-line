import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 관리자 코인 조절 API (테스트용)
 * POST: 사용자 코인 잔액 업데이트
 * GET: 사용자 코인 잔액 조회
 */

// 코인 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, message: '이메일이 필요합니다.' },
        { status: 400 }
      );
    }

    // DB 연결 확인
    const isConnected = await ensurePrismaConnected();
    
    if (!isConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503 }
      );
    }

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        coins: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    console.log(`[코인 조회] ${email}: ${user.coins} 코인`);

    return NextResponse.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        coins: user.coins,
      },
    });
  } catch (error: any) {
    console.error('코인 조회 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '코인 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 코인 업데이트 (POST)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, coins } = body;

    // 입력 검증
    if (!email) {
      return NextResponse.json(
        { success: false, message: '이메일이 필요합니다.' },
        { status: 400 }
      );
    }

    if (typeof coins !== 'number' || isNaN(coins)) {
      return NextResponse.json(
        { success: false, message: '유효한 코인 수량을 입력해주세요.' },
        { status: 400 }
      );
    }

    // DB 연결 확인
    const isConnected = await ensurePrismaConnected();
    
    if (!isConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503 }
      );
    }

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        coins: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 코인 업데이트 (절대값으로 설정)
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        coins: coins,
      },
      select: {
        id: true,
        email: true,
        coins: true,
        name: true,
        role: true,
      },
    });

    console.log(`[코인 업데이트] ${email}: ${user.coins} → ${updatedUser.coins} 코인`);

    return NextResponse.json({
      success: true,
      message: `코인이 ${updatedUser.coins} 코인으로 업데이트되었습니다.`,
      user: {
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        coins: updatedUser.coins,
      },
    });
  } catch (error: any) {
    console.error('코인 업데이트 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '코인 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

