import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

/**
 * 상담사 신청 API
 * POST /api/counselors/apply
 * 
 * ⚠️ 주의: Prisma 6.2.0 버전 유지 필수
 */

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // ★★★ 세션 체크를 최우선으로 실행 ★★★
  let cookieStore;
  let sessionCookie;
  let session;
  
  try {
    cookieStore = await cookies();
    sessionCookie = cookieStore.get('auth_session');
  } catch (cookieError: any) {
    console.error('❌ [상담사 신청] 쿠키 조회 오류:', cookieError?.message);
    return NextResponse.json(
      { success: false, message: '세션 정보를 확인할 수 없습니다. 다시 로그인해주세요.' },
      { status: 401 }
    );
  }
  
  if (!sessionCookie) {
    console.log('❌ [상담사 신청] 세션 쿠키 없음 - 로그인 필요');
    return NextResponse.json(
      { success: false, message: '로그인이 필요합니다. 먼저 로그인 후 다시 시도해주세요.' },
      { status: 401 }
    );
  }

  try {
    const cookieValue = sessionCookie.value.trim();
    session = JSON.parse(cookieValue);
    if (!session || typeof session !== 'object') {
      throw new Error('Invalid session structure');
    }
  } catch (parseError: any) {
    cookieStore.delete('auth_session');
    // console.error 제거 (JSON 응답 간섭 방지)
    return NextResponse.json(
      { success: false, message: '세션 정보가 손상되었습니다. 다시 로그인해주세요.', error: 'INVALID_SESSION_COOKIE' },
      { status: 401 }
    );
  }
  
  if (!session.userId || !session.email) {
    console.log('❌ [상담사 신청] 불완전한 세션 정보');
    return NextResponse.json(
      { success: false, message: '세션이 만료되었습니다. 다시 로그인해주세요.' },
      { status: 401 }
    );
  }

  console.log(`✅ [상담사 신청] 세션 확인 완료: ${session.email}`);

  try {
    // DB 연결 확인
    const isConnected = await ensurePrismaConnected();
    if (!isConnected) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 연결에 실패했습니다.' },
        { status: 503 }
      );
    }

    // 요청 본문 파싱
    const body = await request.json();
    const { displayName, country, voiceTone, specialty, bio } = body;

    // 필수 필드 검증
    if (!displayName || !country || !specialty || !bio) {
      return NextResponse.json(
        { success: false, message: '활동명, 거주 국가, 전문 분야, 자기소개는 필수 항목입니다.' },
        { status: 400 }
      );
    }

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { counselorProfile: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ★★★ 역할 체크 제거: MEMBER라면 신청 가능 ★★★
    // 이미 신청한 경우만 체크 (PENDING 상태)
    if (user.counselorProfile) {
      const existingStatus = user.counselorProfile.status;
      if (existingStatus === 'PENDING') {
        return NextResponse.json(
          { success: false, message: '이미 신청이 진행 중입니다.' },
          { status: 400 }
        );
      }
      // REJECTED 상태인 경우 재신청 허용 (프로필 업데이트)
      if (existingStatus === 'REJECTED') {
        // 아래에서 upsert로 처리되므로 여기서는 통과
      }
      // APPROVED 상태인 경우는 이미 상담사이므로 신청 불필요
      if (existingStatus === 'APPROVED') {
        return NextResponse.json(
          { success: false, message: '이미 승인된 상담사입니다.' },
          { status: 400 }
        );
      }
    }

    // 시스템 설정 조회 (자동 승인 여부)
    let autoApproval = false;
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'counselor_auto_approval' },
      });
      if (setting) {
        const settingValue = JSON.parse(setting.value);
        autoApproval = settingValue === true || settingValue === 'true';
      }
    } catch {
      // 설정이 없으면 기본값 false 사용
    }

    // 신청 상태 결정
    const status = autoApproval ? 'APPROVED' : 'PENDING';

    // 트랜잭션으로 프로필 생성 및 역할 업데이트
    const result = await prisma.$transaction(async (tx) => {
      // CounselorProfile 생성 또는 업데이트
      const profile = await tx.counselorProfile.upsert({
        where: { userId: session.userId },
        update: {
          displayName,
          country,
          voiceTone: voiceTone ? JSON.stringify(voiceTone) : null,
          specialty,
          bio,
          status,
          approvedAt: status === 'APPROVED' ? new Date() : null,
          rejectedAt: null,
          rejectedReason: null,
          updatedAt: new Date(),
        },
        create: {
          userId: session.userId,
          displayName,
          country,
          voiceTone: voiceTone ? JSON.stringify(voiceTone) : null,
          specialty,
          bio,
          status,
          approvedAt: status === 'APPROVED' ? new Date() : null,
        },
      });

      // ★★★ 자동 승인 시에도 역할 변경하지 않음: 관리자 승인 시에만 역할 변경 ★★★
      // 역할은 관리자가 승인할 때만 'COUNSELOR'로 변경됨

      return profile;
    });

    console.log(`✅ [상담사 신청] ${session.email}: ${status} 상태로 신청 완료`);

    return NextResponse.json({
      success: true,
      message: status === 'APPROVED' 
        ? '신청이 즉시 승인되었습니다.' 
        : '신청이 제출되었습니다. 관리자 검토 후 결과를 알려드립니다.',
      profile: {
        id: result.id,
        status: result.status,
        displayName: result.displayName,
      },
    });
  } catch (error: any) {
    console.error('상담사 신청 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '상담사 신청 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

