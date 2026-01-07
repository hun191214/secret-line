/**
 * Next.js Instrumentation Hook
 * 서버 시작 시 자동으로 실행되는 코드
 * 
 * 이 파일은 서버 측에서만 실행되며, 클라이언트 번들에는 포함되지 않습니다.
 */

export async function register() {
  // 서버 환경에서만 실행
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBillingScheduler } = await import('./lib/cron-billing');
    
    console.log('🔧 [Instrumentation] 서버 초기화 중...');
    
    // 과금 스케줄러 시작
    startBillingScheduler();
    
    console.log('✅ [Instrumentation] 서버 초기화 완료');
  }
}

