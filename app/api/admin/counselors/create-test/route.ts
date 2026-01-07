import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/app/api/admin/_auth';

/**
 * 관리자 테스트 상담사 생성 API
 * POST /api/admin/counselors/create-test - 테스트용 상담사 3명 생성
 */

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // SUPER, OPERATOR 허용
    const guard = await requireAdmin(['SUPER', 'OPERATOR']);
    if (!guard.authorized) {
      return NextResponse.json(
        { success: false, message: guard.message },
        { status: guard.status }
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

    const testData = [
      {
        email: `test_counselor_sea_${Date.now()}@secretline.test`,
        name: '테스트 상담사 (동남아)',
        region: 'SEA',
        country: 'PH',
        languages: JSON.stringify(['en', 'tl']),
      },
      {
        email: `test_counselor_europe_${Date.now()}@secretline.test`,
        name: '테스트 상담사 (유럽)',
        region: 'EUROPE',
        country: 'GB',
        languages: JSON.stringify(['en']),
      },
      {
        email: `test_counselor_africa_${Date.now()}@secretline.test`,
        name: '테스트 상담사 (아프리카)',
        region: 'AFRICA',
        country: 'ZA',
        languages: JSON.stringify(['en']),
      },
    ];

    const createdCounselors = [];

    for (const data of testData) {
      // 이미 존재하는 이메일인지 확인
      const existing = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existing) {
        console.log(`[테스트 상담사 생성] ${data.email} 이미 존재, 스킵`);
        continue;
      }

      // 비밀번호 해시 (테스트용: 'test1234')
      const hashedPassword = await bcrypt.hash('test1234', 10);

      // ★★★ 상담사 생성 및 프로필 승인 처리 ★★★
      const counselor = await prisma.$transaction(async (tx) => {
        // 1. 사용자 생성 (MEMBER로 시작)
        const user = await tx.user.create({
          data: {
            email: data.email,
            name: data.name,
            password: hashedPassword,
            role: 'MEMBER', // 초기에는 MEMBER
            gender: 'FEMALE',
            status: 'ONLINE', // 온라인 상태로 생성
            region: data.region,
            country: data.country,
            languages: data.languages,
            coins: 0,
          },
        });

        // 2. CounselorProfile 생성 및 즉시 승인
        await tx.counselorProfile.create({
          data: {
            userId: user.id,
            displayName: data.name,
            specialty: '테스트 상담사',
            bio: '테스트용 상담사입니다.',
            status: 'APPROVED', // 즉시 승인
            approvedAt: new Date(),
          },
        });

        // 3. 역할을 COUNSELOR로 승격
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: { role: 'COUNSELOR' },
          select: {
            id: true,
            email: true,
            name: true,
            status: true,
            region: true,
            country: true,
            languages: true,
          },
        });

        return updatedUser;
      });

      createdCounselors.push(counselor);
    }

    console.log(`[테스트 상담사 생성] ${createdCounselors.length}명 생성 완료`);

    return NextResponse.json({
      success: true,
      message: `테스트 상담사 ${createdCounselors.length}명이 생성되었습니다.`,
      counselors: createdCounselors,
    });
  } catch (error: any) {
    console.error('테스트 상담사 생성 오류:', error?.message);
    return NextResponse.json(
      { success: false, message: '테스트 상담사 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

