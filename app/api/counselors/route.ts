/**
 * 상담사 목록 API 라우트
 * GET /api/counselors - 상담사 목록 조회
 * 
 * Mock Mode: DB 연결 실패 시 가상 데이터 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma, isPrismaConnected } from '@/lib/prisma';

export const runtime = 'nodejs';

// 가상 상담사 데이터 (Mock Data) - 여성 상담사 전용
const MOCK_COUNSELORS = [
  {
    id: 'mock-1',
    name: '지아',
    specialty: '익명 상담 전문가',
    description: '여성 상담사의 세심한 공감과 비밀 보장. 익명 상담으로 안심하고 이야기하세요. 분당 $0.14',
    pricePerMinute: 0.14,
    rating: 4.9,
    totalSessions: 1247,
    isOnline: true,
    avatar: '👩‍⚕️',
  },
  {
    id: 'mock-2',
    name: '서연',
    specialty: '비밀 보장 상담',
    description: '전문 여성 상담사가 비밀 보장으로 편안하게 상담해드립니다. 분당 $0.14의 투명한 이용료입니다.',
    pricePerMinute: 0.14,
    rating: 4.8,
    totalSessions: 892,
    isOnline: true,
    avatar: '👩‍⚕️',
  },
  {
    id: 'mock-3',
    name: '민서',
    specialty: '심리 상담 전문가',
    description: '비밀 보장을 최우선으로 하는 전문 여성 상담사. 익명 상담으로 마음 편히 대화하세요. 분당 $0.14',
    pricePerMinute: 0.14,
    rating: 4.7,
    totalSessions: 634,
    isOnline: false,
    avatar: '👩‍💼',
  },
];

export async function GET(request: NextRequest) {
  try {
    // 현재 로그인한 상담사의 상태 확인
    let loggedInCounselorStatus: { email: string; status: string } | null = null;
    try {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get('auth_session');
      if (sessionCookie) {
        try {
          const cookieValue = sessionCookie.value.trim();
          const session = JSON.parse(cookieValue);
          if (session && typeof session === 'object') {
            if (session.role === 'COUNSELOR' && session.email) {
              loggedInCounselorStatus = {
                email: session.email,
                status: session.counselorStatus || 'offline',
              };
            }
          }
        } catch {
          // 세션 파싱 실패 시 무시
        }
      }
    } catch {
      // 세션 확인 실패 시 무시 (상담사 목록은 계속 반환)
    }

    // DB 연결 실패 시 Mock Data 반환
    if (!isPrismaConnected) {
      // 로그인한 상담사가 있고 온라인 상태라면 목록 상단에 배치
      let counselors = [...MOCK_COUNSELORS];
      if (loggedInCounselorStatus && loggedInCounselorStatus.status === 'online') {
        // 현재 상담사를 찾아서 상단으로 이동
        const currentCounselorIndex = counselors.findIndex(
          (c) => c.name === loggedInCounselorStatus!.email.split('@')[0] || 
                 loggedInCounselorStatus!.email.includes(c.name.toLowerCase())
        );
        if (currentCounselorIndex >= 0) {
          const currentCounselor = counselors[currentCounselorIndex];
          counselors.splice(currentCounselorIndex, 1);
          counselors.unshift({ ...currentCounselor, isOnline: true });
        } else {
          // 매칭되는 상담사가 없으면 새로운 항목 추가
          counselors.unshift({
            id: 'current-counselor',
            name: loggedInCounselorStatus.email.split('@')[0] || '상담사',
            specialty: '전문 상담사',
            description: '비밀 보장 익명 상담을 제공합니다. 분당 $0.14',
            pricePerMinute: 0.14,
            rating: 5.0,
            totalSessions: 0,
            isOnline: true,
            avatar: '👩‍⚕️',
          });
        }
      }

      return NextResponse.json({
        success: true,
        mode: 'mock',
        counselors,
        message: '오프라인 모드: 가상 데이터가 표시됩니다.',
      });
    }

    // ★★★ 실제 DB에서 상담사 목록 조회: role이 아닌 승인 상태만 체크 ★★★
    const counselors = await prisma.user.findMany({
      where: {
        counselorProfile: {
          status: 'APPROVED', // 승인된 상담사만 (role 조건 제거)
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    // DB 조회 결과가 빈 배열일 경우 Mock Data 반환
    if (counselors.length === 0) {
      return NextResponse.json({
        success: true,
        mode: 'fallback',
        counselors: MOCK_COUNSELORS,
        message: '데이터베이스에 상담사 데이터가 없어 가상 데이터가 표시됩니다.',
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'database',
      counselors: counselors.map((c) => ({
        ...c,
        specialty: '전문 상담사',
        description: '비밀 보장 익명 상담을 제공합니다.',
        pricePerMinute: 0.14,
        rating: 4.5,
        totalSessions: 0,
        isOnline: true,
        avatar: '👤',
      })),
    });
  } catch {
    // 에러 발생 시에도 Mock Data 반환 (서비스 중단 방지)
    return NextResponse.json({
      success: true,
      mode: 'fallback',
      counselors: MOCK_COUNSELORS,
      message: '데이터베이스 오류로 가상 데이터가 표시됩니다.',
    });
  }
}

