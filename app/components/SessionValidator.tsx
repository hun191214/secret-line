'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * 세션 유효성 검증 컴포넌트
 * - 30초마다 세션 상태를 체크
 * - 페이지 이동 시에도 체크
 * - 중복 로그인 감지 시 즉시 로그아웃
 */
export default function SessionValidator() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let isChecking = false; // 중복 체크 방지

    const validateSession = async () => {
      // 이미 체크 중이면 스킵
      if (isChecking) return;
      isChecking = true;

      try {
        const response = await fetch('/api/auth/validate-session', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        const data = await response.json();

        // 세션이 유효하지 않거나 중복 로그인 감지
        if (!data.valid || data.reason === 'DUPLICATE_LOGIN') {
          if (data.shouldLogout || data.reason === 'DUPLICATE_LOGIN') {
            // 로그인 페이지가 아닌 경우에만 리다이렉트
            if (!pathname?.includes('/login')) {
              alert(data.message || '다른 기기에서 로그인하여 현재 세션이 종료되었습니다.');
              router.push(pathname?.split('/').slice(0, 2).join('/') + '/login' || '/ko/login');
            }
          }
        }
      } catch (error) {
        // 에러 발생 시 무시 (서버 장애 시에도 서비스 중단 방지)
        console.error('세션 검증 오류:', error);
      } finally {
        isChecking = false;
      }
    };

    // 즉시 한 번 체크
    validateSession();

    // 30초마다 체크
    intervalId = setInterval(validateSession, 30000);

    // 페이지 이동 시에도 체크
    const handlePathChange = () => {
      validateSession();
    };

    // cleanup
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [router, pathname]);

  return null; // UI 렌더링 없음
}

