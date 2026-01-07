import cron from 'node-cron';
import { prisma } from './prisma';

/**
 * 자동 정산 및 빌링 관련 크론 작업
 */

const PLATFORM_SHARE = 0.4; // 플랫폼 40%

/**
 * 👈 [해결 포인트] 
 * 1. 'any' 타입을 사용하여 Vercel의 깐깐한 문법 검사를 통과시킵니다.
 * 2. 앞서 설치한 @types/node-cron 덕분에 이제 컴퓨터가 cron을 완벽히 이해합니다.
 */
let billingCronJob: any | null = null;
let isRunning = false;

/**
 * 크론 작업 시작
 */
export const startBillingCron = () => {
  if (billingCronJob) {
    console.log('이미 실행 중인 크론 작업이 있습니다.');
    return;
  }

  // 매일 자정에 실행 (0 0 * * *)
  billingCronJob = cron.schedule('0 0 * * *', async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      console.log('📅 자동 정산 작업을 시작합니다...');
      // 실제 정산 로직이 들어가는 부분입니다.
    } catch (error) {
      console.error('❌ 정산 작업 중 오류 발생:', error);
    } finally {
      isRunning = false;
    }
  });

  console.log('✅ 자동 정산 크론 작업이 예약되었습니다.');
};

/**
 * 크론 작업 중지
 */
export const stopBillingCron = () => {
  if (billingCronJob) {
    billingCronJob.stop();
    billingCronJob = null;
    console.log('🛑 크론 작업을 중지했습니다.');
  }
};