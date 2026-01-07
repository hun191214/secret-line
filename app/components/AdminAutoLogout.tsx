'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30분 (밀리초)

export default function AdminAutoLogout() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoggingOut = useRef(false);

  const performLogout = useCallback(async () => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      alert('⚠️ 보안을 위해 30분간 활동이 없어 자동 로그아웃되었습니다.');
      router.push(`/${locale}/login`);
    } catch (error) {
      console.error('자동 로그아웃 중 오류:', error);
      router.push(`/${locale}/login`);
    }
  }, [router, locale]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(performLogout, INACTIVITY_TIMEOUT);
  }, [performLogout]);

  useEffect(() => {
    // 활동 이벤트 리스너 등록
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    
    events.forEach((event) => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    // 초기 타이머 설정
    resetTimer();

    // 클린업
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [resetTimer]);

  // 이 컴포넌트는 UI를 렌더링하지 않음
  return null;
}

