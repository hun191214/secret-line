import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import { getDisplayName } from '@/lib/displayName';

/**
 * 통화 매칭 API
 * POST: 통화 시작 및 상담사 매칭 시작 (지역 우선순위 적용)
 * GET: 현재 매칭 상태 조회
 * 
 * Phase 4: 지역 우선순위 릴레이 매칭 알고리즘
 * - 1~5번: 선호 지역 상담사 우선 배치
 * - 6~10번: 전체 온라인 상담사 (지역 무관)
 */

// 세션에서 사용자 정보 가져오기
async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('auth_session');
  
  if (!sessionCookie) {
    return null;
  }
  
  try {
    const cookieValue = sessionCookie.value.trim();
    const session = JSON.parse(cookieValue);
    if (!session || typeof session !== 'object') {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

// 온라인 상태인 상담사 목록 조회 (지역 우선순위 적용)
async function getOnlineCounselors(preferredRegion?: string | null) {
  try {
    await prisma.$connect();
  } catch {
    // 연결 실패해도 계속 진행
  }

  const isConnected = await ensurePrismaConnected();
  
  if (!isConnected) {
    console.log('⚠️ [매칭] DB 연결 실패 - Mock 데이터 반환');
    return [
      { id: 'mock-1', name: '지아', email: 'counselor1@example.com', region: 'EAST_ASIA' },
      { id: 'mock-2', name: '서연', email: 'counselor2@example.com', region: 'SEA' },
    ];
  }

  try {
    // ★★★ DB에서 ONLINE 상태이고 APPROVED된 상담사만 조회: role 조건 제거 ★★★
    const onlineCounselors = await prisma.user.findMany({
      where: {
        status: 'ONLINE',
        counselorProfile: {
          status: 'APPROVED', // 승인된 상담사만 (role 조건 제거)
        },
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        region: true,  // 지역 정보 포함
        country: true, // 국가 정보 포함
        updatedAt: true,
        counselorProfile: {
          select: {
            displayName: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    console.log(`🔔 [매칭] ONLINE 상담사 총 ${onlineCounselors.length}명`);
    if (preferredRegion) {
      console.log(`🔔 [매칭] 선호 지역: ${preferredRegion}`);
    }

    if (onlineCounselors.length === 0) {
      console.log('⚠️ [매칭] ONLINE 상태인 상담사가 0명입니다.');
      return [];
    }

    // 상담사 포맷팅 (getDisplayName 사용)
    const formattedCounselors = onlineCounselors.map((c) => ({
      id: c.id,
      name: getDisplayName({
        email: c.email,
        nickname: c.nickname,
        counselorProfile: c.counselorProfile,
      }),
      email: c.email || '',
      region: c.region || null,
      country: c.country || null,
    }));

    // 지역 우선순위 매칭 로직
    if (preferredRegion) {
      // 1단계: 선호 지역 상담사 (최대 5명)
      const regionMatched = formattedCounselors.filter((c) => c.region === preferredRegion);
      const regionNotMatched = formattedCounselors.filter((c) => c.region !== preferredRegion);
      
      console.log(`🔔 [매칭] 선호 지역(${preferredRegion}) 상담사: ${regionMatched.length}명`);
      console.log(`🔔 [매칭] 기타 지역 상담사: ${regionNotMatched.length}명`);
      
      // 배열 셔플 (랜덤성 부여)
      const shuffledRegionMatched = shuffleArray([...regionMatched]);
      const shuffledOthers = shuffleArray([...regionNotMatched]);
      
      // 2단계: 최종 목록 구성 (선호 지역 최대 5명 + 나머지로 채움)
      const prioritized = [
        ...shuffledRegionMatched.slice(0, 5),        // 선호 지역 최대 5명
        ...shuffledOthers.slice(0, 10 - Math.min(shuffledRegionMatched.length, 5)), // 나머지로 10명까지 채움
      ];
      
      console.log(`✅ [매칭] 지역 우선순위 적용 완료: 총 ${prioritized.length}명`);
      prioritized.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.name} (${c.region || '지역없음'})`);
      });
      
      return prioritized;
    }

    // 선호 지역 없음 → 전체 랜덤 (최대 10명)
    const shuffled = shuffleArray([...formattedCounselors]).slice(0, 10);
    
    console.log(`✅ [매칭] 전체 지역 랜덤 매칭: 총 ${shuffled.length}명`);
    return shuffled;
  } catch (error: any) {
    console.error('❌ [매칭] 상담사 조회 오류:', error?.message);
    return [];
  }
}

// 배열 셔플 (Fisher-Yates 알고리즘)
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// 통화 시작 (POST)
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    
    if (!session || !session.userId) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 이용자(MEMBER)만 통화 가능
    if (session.role !== 'MEMBER') {
      return NextResponse.json(
        { success: false, message: '이용자만 통화를 시작할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 요청 본문에서 선호 지역 추출
    let preferredRegion: string | null = null;
    try {
      const body = await request.json();
      preferredRegion = body.preferredRegion || null;
      console.log(`🔔 [매칭 POST] 요청 수신 - preferredRegion: ${preferredRegion || '전체'}`);
    } catch {
      // body가 없거나 파싱 실패 시 무시
      console.log('🔔 [매칭 POST] 요청 본문 없음 - 전체 지역 매칭');
    }

    // 온라인 상담사 목록 조회 (지역 우선순위 적용)
    const onlineCounselors = await getOnlineCounselors(preferredRegion);

    if (onlineCounselors.length === 0) {
      console.log('⚠️ [매칭] 온라인 상담사 0명 - 통화 차단');
      return NextResponse.json(
        { success: false, message: '상담사가 현재 오프라인 상태입니다. 잠시 후 다시 시도해주세요.' },
        { status: 404 }
      );
    }

    // 통화 기록 생성 (첫 번째 상담사에게 먼저 호출)
    const firstCounselor = onlineCounselors[0];

    try {
      await prisma.$connect();
    } catch {
      // 연결 실패해도 계속 진행
    }

    const isConnected = await ensurePrismaConnected();
    
    let callRecord;
    if (isConnected) {
      try {
        // Call 레코드 생성 (preferredRegion 포함)
        callRecord = await prisma.call.create({
          data: {
            callerId: session.userId,
            counselorId: firstCounselor.id,
            status: 'CONNECTING',
            startedAt: new Date(),
            preferredRegion: preferredRegion, // 사용자 선호 지역 저장
          },
          select: {
            id: true,
            status: true,
            startedAt: true,
            preferredRegion: true,
          },
        });
        console.log(`✅ [매칭] Call 레코드 생성 완료 - ID: ${callRecord.id}, preferredRegion: ${callRecord.preferredRegion || '없음'}`);
      } catch (dbError: any) {
        console.error('통화 기록 생성 오류:', dbError?.message);
        // DB 저장 실패해도 계속 진행 (Mock 모드)
        callRecord = {
          id: `call_${Date.now()}`,
          status: 'CONNECTING',
          startedAt: new Date(),
          preferredRegion: preferredRegion,
        };
      }
    } else {
      // Mock 모드
      callRecord = {
        id: `call_${Date.now()}`,
        status: 'CONNECTING',
        startedAt: new Date(),
        preferredRegion: preferredRegion,
      };
    }

    return NextResponse.json({
      success: true,
      message: '통화 매칭이 시작되었습니다.',
      call: {
        id: callRecord.id,
        status: callRecord.status,
        startedAt: callRecord.startedAt,
        preferredRegion: callRecord.preferredRegion,
      },
      counselors: onlineCounselors.map((c) => ({
        id: c.id,
        name: c.name, // 이미 getDisplayName으로 처리됨
        region: c.region || null,
      })),
      currentCounselorIndex: 0,
    });
  } catch (error: any) {
    console.error('통화 매칭 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '통화 매칭 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 통화 상태 조회 및 다음 상담사 릴레이 (GET)
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    
    if (!session || !session.userId) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');
    const counselorIndex = parseInt(searchParams.get('counselorIndex') || '0');

    if (!callId) {
      return NextResponse.json(
        { success: false, message: '통화 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Call 레코드에서 preferredRegion 조회
    let preferredRegion: string | null = null;
    const isConnected = await ensurePrismaConnected();
    
    if (isConnected) {
      try {
        const existingCall = await prisma.call.findUnique({
          where: { id: callId },
          select: { preferredRegion: true },
        });
        preferredRegion = existingCall?.preferredRegion || null;
        console.log(`🔔 [매칭 GET] Call ${callId}의 preferredRegion: ${preferredRegion || '없음'}`);
      } catch {
        // 조회 실패 시 무시
      }
    }

    // 온라인 상담사 목록 조회 (지역 우선순위 적용)
    const onlineCounselors = await getOnlineCounselors(preferredRegion);

    if (onlineCounselors.length === 0) {
      console.log('⚠️ [매칭 GET] 온라인 상담사 0명');
      return NextResponse.json(
        { success: false, message: '상담사가 현재 오프라인 상태입니다.' },
        { status: 404 }
      );
    }

    // 다음 상담사 인덱스 계산
    // 10명까지 릴레이, 모두 시도 후 처음으로 돌아감
    const maxRelayCount = Math.min(onlineCounselors.length, 10);
    const nextIndex = (counselorIndex + 1) % maxRelayCount;
    const nextCounselor = onlineCounselors[nextIndex];

    console.log(`🔔 [매칭 GET] 다음 상담사: ${nextCounselor.name} (${nextCounselor.region || '지역없음'}) - index: ${nextIndex}/${maxRelayCount}`);

    // 통화 기록 업데이트 (다음 상담사로 변경)
    if (isConnected) {
      try {
        await prisma.call.update({
          where: { id: callId },
          data: {
            counselorId: nextCounselor.id,
            status: 'CONNECTING',
            updatedAt: new Date(),
          },
        });
      } catch (dbError: any) {
        console.error('통화 기록 업데이트 오류:', dbError?.message);
      }
    }

    return NextResponse.json({
      success: true,
      call: {
        id: callId,
        status: 'CONNECTING',
        preferredRegion: preferredRegion,
      },
      currentCounselor: {
        id: nextCounselor.id,
        name: nextCounselor.name, // 이미 getDisplayName으로 처리됨
        region: nextCounselor.region || null,
      },
      currentCounselorIndex: nextIndex,
      totalCounselors: maxRelayCount,
    });
  } catch (error: any) {
    console.error('통화 상태 조회 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '통화 상태 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

