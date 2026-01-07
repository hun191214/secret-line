/**
 * Next.js 서버 초기화 시 실행되는 설정 파일
 */
export async function register() {
  // 서버 환경(Node.js)에서만 실행되도록 제한
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      // ✅ 수정 완료: 이름을 startBillingCron으로 정확히 맞췄습니다.
      const { startBillingCron } = await import('./lib/cron-billing');

      console.log('🔧 [Instrumentation] 서버 초기화 중...');
      
      // ✅ 수정 완료: 바뀐 이름으로 함수를 실행합니다.
      startBillingCron();
      
      console.log('✅ [Instrumentation] 자동 정산 크론 작업이 활성화되었습니다.');
    } catch (error) {
      console.error('❌ [Instrumentation] 초기화 중 오류 발생:', error);
    }
  }
}