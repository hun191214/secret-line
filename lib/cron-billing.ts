/**
 * 실시간 과금 스케줄러
 * 60초마다 ACTIVE 상태인 통화에 대해 자동 과금 처리
 * 
 * ⚠️ 주의: Prisma 6.2.0 버전 유지 필수
 */

import cron from 'node-cron';
import { prisma, ensurePrismaConnected } from '@/lib/prisma';

const COST_PER_MINUTE = 14; // 1분당 14코인
const COUNSELOR_SHARE = 0.6; // 상담사 60%
const PLATFORM_SHARE = 0.4; // 플랫폼 40%

let billingCronJob: cron.ScheduledTask | null = null;
let isRunning = false;

/**
 * 개별 통화 과금 처리 (billing/route.ts와 동일한 로직)
 */
async function processCallBilling(call: any) {
  const { id: callId, callerId, counselorId, startedAt, caller, counselor } = call;

  // 시작 시간이 없으면 스킵
  if (!startedAt) {
    return {
      callId,
      success: false,
      error: '시작 시간이 없습니다.',
    };
  }

  // 경과 시간 계산 (초)
  const now = new Date();
  const elapsedSeconds = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  // 이미 과금된 분 수 확인 (duration은 마지막으로 과금된 시점까지의 초)
  const lastBilledSeconds = call.duration || 0;
  const lastBilledMinutes = Math.floor(lastBilledSeconds / 60);

  // 새로 과금할 분 수
  const minutesToBill = elapsedMinutes - lastBilledMinutes;

  if (minutesToBill <= 0) {
    return {
      callId,
      success: true,
      billed: false,
      message: '과금할 시간이 없습니다.',
      elapsedSeconds,
      elapsedMinutes,
    };
  }

  // 과금할 코인 계산
  const coinsToDeduct = minutesToBill * COST_PER_MINUTE;
  const counselorEarnings = Math.floor(coinsToDeduct * COUNSELOR_SHARE * 10) / 10; // 8.4코인
  const platformEarnings = Math.floor(coinsToDeduct * PLATFORM_SHARE * 10) / 10; // 5.6코인

  // 이용자 잔액 확인
  const callerCoins = caller.coins ?? 0;

  // 운영 안전성: 다음 1분을 보장할 수 없는 경우(14코인 이하) 자동 종료
  const MIN_BALANCE_TO_CONTINUE = 14; // 차감 후 남을 최소 잔액

  console.log(`💰 [자동 과금] 통화 ${callId}:`);
  console.log(`   → 경과 시간: ${elapsedMinutes}분 (${elapsedSeconds}초)`);
  console.log(`   → 이번 과금: ${minutesToBill}분 = ${coinsToDeduct}코인`);
  console.log(`   → 이용자 잔액: ${callerCoins}코인`);

  // 잔액 부족 체크 - 자동 종료 처리
  // 차감 후 잔액이 14코인 이하인 경우 (다음 1분을 보장할 수 없음)
  if (callerCoins < coinsToDeduct || (callerCoins - coinsToDeduct) <= MIN_BALANCE_TO_CONTINUE) {
    const finalBalance = Math.max(0, callerCoins - coinsToDeduct);
    console.log(`⚠️ [자동 과금] 잔액 부족으로 통화 강제 종료: ${callId}`);
    console.log(`   → 이용자: ${caller.email} (잔액: ${callerCoins}코인, 필요: ${coinsToDeduct}코인, 종료 후 잔액: ${finalBalance}코인)`);
    console.log(`   → 종료 사유: 잔액 부족으로 통화가 종료되었습니다`);
    
    // 통화 강제 종료 (예의를 갖춘 종료)
    try {
      await prisma.call.update({
        where: { id: callId },
        data: {
          status: 'ENDED',
          endedAt: now,
          duration: elapsedSeconds,
          cost: (lastBilledMinutes * COST_PER_MINUTE) / 100, // USD로 변환
        },
      });
      console.log(`✅ [자동 과금] 통화 ${callId} 자동 종료 완료 (잔액 부족)`);
    } catch (endError: any) {
      console.error(`❌ [자동 과금] 통화 종료 실패: ${endError?.message}`);
    }

    return {
      callId,
      success: true,
      ended: true,
      reason: '잔액 부족',
      callerCoins,
      requiredCoins: coinsToDeduct,
      finalBalance,
    };
  }

  // 트랜잭션으로 과금 처리
  try {
    await prisma.$transaction([
      // 1. 이용자 잔액 차감
      prisma.user.update({
        where: { id: callerId },
        data: {
          coins: {
            decrement: coinsToDeduct,
          },
        },
      }),
      // 2. 상담사 수익 가산
      prisma.user.update({
        where: { id: counselorId },
        data: {
          coins: {
            increment: Math.floor(counselorEarnings),
          },
        },
      }),
      // 3. 통화 기록 업데이트 (과금된 시간 기록)
      prisma.call.update({
        where: { id: callId },
        data: {
          duration: elapsedMinutes * 60, // 과금된 분까지의 초
          cost: (elapsedMinutes * COST_PER_MINUTE) / 100, // USD로 변환
        },
      }),
    ]);

    console.log(`✅ [자동 과금] 통화 ${callId} 과금 완료:`);
    console.log(`   → 이용자 차감: ${coinsToDeduct}코인`);
    console.log(`   → 상담사 수익: ${counselorEarnings}코인 (60%)`);
    console.log(`   → 플랫폼 수익: ${platformEarnings}코인 (40%)`);

    return {
      callId,
      success: true,
      billed: true,
      minutesBilled: minutesToBill,
      coinsDeducted: coinsToDeduct,
      counselorEarnings,
      platformEarnings,
      callerNewBalance: callerCoins - coinsToDeduct,
    };
  } catch (txError: any) {
    console.error(`❌ [자동 과금] 트랜잭션 오류: ${txError?.message}`);
    return {
      callId,
      success: false,
      error: txError?.message,
    };
  }
}

/**
 * 과금 작업 실행 함수
 */
async function executeBilling() {
  // 중복 실행 방지
  if (isRunning) {
    console.log('⚠️ [자동 과금] 이미 실행 중인 과금 작업이 있습니다. 스킵합니다.');
    return;
  }

  isRunning = true;

  try {
    // 1. DB 연결 확인
    const dbConnected = await ensurePrismaConnected();
    if (!dbConnected) {
      console.error('❌ [자동 과금] 데이터베이스 연결에 실패했습니다.');
      return;
    }

    // 2. ACTIVE 상태인 모든 통화 조회
    let activeCalls;
    try {
      activeCalls = await prisma.call.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          callerId: true,
          counselorId: true,
          startedAt: true,
          duration: true,
          caller: {
            select: {
              id: true,
              email: true,
              coins: true,
            },
          },
          counselor: {
            select: {
              id: true,
              email: true,
              coins: true,
            },
          },
        },
      });
    } catch (dbError: any) {
      console.error(`❌ [자동 과금] 통화 조회 오류: ${dbError?.message}`);
      return;
    }

    if (activeCalls.length === 0) {
      // 과금할 통화가 없으면 로그를 남기지 않음 (너무 많은 로그 방지)
      return;
    }

    console.log(`\n💰 [자동 과금] ACTIVE 상태인 통화 ${activeCalls.length}건 처리 시작`);

    // 3. 각 통화에 대해 과금 처리
    const results = [];
    for (const call of activeCalls) {
      try {
        const result = await processCallBilling(call);
        results.push(result);
      } catch (error: any) {
        console.error(`❌ [자동 과금] 통화 ${call.id} 처리 오류: ${error?.message}`);
        results.push({
          callId: call.id,
          success: false,
          error: error?.message,
        });
      }
    }

    // 4. 결과 요약
    const successCount = results.filter((r) => r.success).length;
    const endedCount = results.filter((r) => r.ended).length;

    if (successCount > 0 || endedCount > 0) {
      console.log(`✅ [자동 과금] 처리 완료: 성공 ${successCount}건, 종료 ${endedCount}건`);
    }

  } catch (error: any) {
    console.error(`❌ [자동 과금] 예상치 못한 오류: ${error?.message}`);
  } finally {
    isRunning = false;
  }
}

/**
 * 스케줄러 시작
 */
export function startBillingScheduler() {
  // 이미 실행 중이면 중복 시작 방지
  if (billingCronJob) {
    console.log('⚠️ [자동 과금] 스케줄러가 이미 실행 중입니다.');
    return;
  }

  console.log('🚀 [자동 과금] 스케줄러 시작: 60초마다 자동 과금 처리');

  // 매 분의 0초에 실행 (60초마다 과금 처리)
  // cron 표현식: 초 분 시 일 월 요일
  billingCronJob = cron.schedule('0 * * * * *', async () => {
    await executeBilling();
  }, {
    scheduled: true,
    timezone: 'Asia/Seoul',
  });

  // 서버 시작 시 즉시 한 번 실행
  setTimeout(() => {
    console.log('🔍 [자동 과금] 서버 시작 시 초기 과금 처리 실행');
    executeBilling();
  }, 5000); // 서버가 완전히 시작된 후 5초 뒤 실행
}

/**
 * 스케줄러 중지
 */
export function stopBillingScheduler() {
  if (billingCronJob) {
    billingCronJob.stop();
    billingCronJob = null;
    console.log('⏹️ [자동 과금] 스케줄러가 중지되었습니다.');
  }
}

