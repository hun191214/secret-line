/**
 * 상담사 상태 초기화 스크립트
 * 200@gmail.com을 제외한 모든 상담사의 status를 OFFLINE으로 설정
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function initCounselorStatus() {
  try {
    console.log('🔔 [초기화] 상담사 상태 초기화 시작...');

    // 200@gmail.com을 제외한 모든 상담사의 status를 OFFLINE으로 설정
    const result = await prisma.user.updateMany({
      where: {
        role: 'COUNSELOR',
        email: {
          not: '200@gmail.com',
        },
      },
      data: {
        status: 'OFFLINE',
      },
    });

    console.log(`✅ [초기화] ${result.count}명의 상담사 상태를 OFFLINE으로 설정했습니다.`);

    // 200@gmail.com 상담사 확인
    const targetCounselor = await prisma.user.findUnique({
      where: { email: '200@gmail.com' },
      select: {
        email: true,
        status: true,
        role: true,
      },
    });

    if (targetCounselor) {
      console.log(`✅ [초기화] 200@gmail.com 상담사 상태: ${targetCounselor.status || 'NULL'}`);
    } else {
      console.log('⚠️ [초기화] 200@gmail.com 상담사가 DB에 없습니다.');
    }

    // 모든 상담사 상태 확인
    const allCounselors = await prisma.user.findMany({
      where: {
        role: 'COUNSELOR',
      },
      select: {
        email: true,
        status: true,
      },
    });

    console.log('\n📋 [초기화] 모든 상담사 상태:');
    allCounselors.forEach((c) => {
      console.log(`  - ${c.email}: ${c.status || 'NULL'}`);
    });

    console.log('\n✅ [초기화] 완료!');
  } catch (error: any) {
    console.error('❌ [초기화] 오류:', error?.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

initCounselorStatus();

