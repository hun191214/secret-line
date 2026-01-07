'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { runNetworkTest, formatTestResult, NETWORK_REQUIREMENTS, type NetworkTestResult } from '@/lib/network-test';

interface IncomingCall {
  id: string;
  status: string;
  startedAt: string | null;
  createdAt: string;
  caller: {
    id: string;
    name: string;
  };
}

// 네트워크 테스트 상태
type NetworkTestStatus = 'idle' | 'testing_ping' | 'testing_speed' | 'complete';

export default function CounselorDashboard() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations();
  
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [consultationEarnings, setConsultationEarnings] = useState(0);
  const [giftEarnings, setGiftEarnings] = useState(0);
  const [totalTodayEarnings, setTotalTodayEarnings] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [userEmail, setUserEmail] = useState('');
  const [error, setError] = useState('');
  const [profileStatus, setProfileStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  // 네트워크 테스트 상태
  const [showNetworkTest, setShowNetworkTest] = useState(false);
  const [networkTestStatus, setNetworkTestStatus] = useState<NetworkTestStatus>('idle');
  const [networkTestResult, setNetworkTestResult] = useState<NetworkTestResult | null>(null);

  // 수신 통화 상태
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [activeCall, setActiveCall] = useState<IncomingCall | null>(null);
  const [activeCallElapsed, setActiveCallElapsed] = useState(0);
  const [currentEarnings, setCurrentEarnings] = useState(0);
  const [totalGifts, setTotalGifts] = useState(0);
  const [giftNotification, setGiftNotification] = useState<string | null>(null);

  // 오디오 관련
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // 인터벌 참조
  const incomingPollRef = useRef<NodeJS.Timeout | null>(null);
  const activeCallPollRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneRef = useRef<NodeJS.Timeout | null>(null);

  // 오디오 초기화
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        setAudioEnabled(true);
      } catch (err) {
        console.error('Audio init failed:', err);
      }
    }
  }, []);

  // 벨소리 재생
  const playRingtone = useCallback(() => {
    if (!audioEnabled || !audioContextRef.current) return;

    try {
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const playTone = (freq: number, startTime: number, duration: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = freq;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.2, ctx.currentTime + startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);

        oscillator.start(ctx.currentTime + startTime);
        oscillator.stop(ctx.currentTime + startTime + duration);
      };

      playTone(659, 0, 0.12);
      playTone(523, 0.15, 0.12);
      playTone(659, 0.4, 0.12);
      playTone(523, 0.55, 0.12);
    } catch (err) {
      console.error('Ringtone error:', err);
    }
  }, [audioEnabled]);

  // 벨소리 정지
  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      clearInterval(ringtoneRef.current);
      ringtoneRef.current = null;
    }
  }, []);

  // 수익 조회
  const refreshEarnings = useCallback(async () => {
    try {
      const response = await fetch('/api/counselor/stats', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-store' },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setConsultationEarnings(data.consultationEarnings || 0);
          setGiftEarnings(data.giftEarnings || 0);
          setTotalTodayEarnings(data.totalTodayEarnings || 0);
          setTotalCoins(data.totalCoins || 0);
        }
      }
    } catch (err) {
      console.error('Stats fetch error:', err);
    }
  }, []);

  // 통화 상태 확인
  const checkActiveCallStatus = useCallback(async () => {
    if (!activeCall) return;

    try {
      const response = await fetch(`/api/call/status?callId=${activeCall.id}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-store' },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.call) {
          const status = data.call.status;

          if (status === 'ENDED' || status === 'CANCELLED') {
            setActiveCall(null);
            setActiveCallElapsed(0);
            setCurrentEarnings(0);
            setTotalGifts(0);
            stopRingtone();
            setTimeout(refreshEarnings, 1000);
          }

          if (data.call.totalGifts !== undefined && data.call.totalGifts > totalGifts) {
            const newGiftAmount = data.call.totalGifts - totalGifts;
            setTotalGifts(data.call.totalGifts);
            setGiftNotification(`🎁 ${newGiftAmount.toLocaleString()} ${t('common.coins')}!`);
            setTimeout(() => setGiftNotification(null), 3000);
          }
        }
      }
    } catch (err) {
      console.error('Call status check error:', err);
    }
  }, [activeCall, totalGifts, stopRingtone, refreshEarnings, t]);

  // 수신 통화 확인
  const checkIncomingCall = useCallback(async () => {
    if (!isOnline || activeCall) return;

    try {
      const response = await fetch('/api/call/incoming', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-store' },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.hasIncoming && data.call) {
          setIncomingCall(data.call);
        } else {
          setIncomingCall(null);
        }
      }
    } catch (err) {
      console.error('Incoming call check error:', err);
    }
  }, [isOnline, activeCall]);

  // 초기 로드 - 승인 상태 확인 포함
  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated || !data.user || data.user.role !== 'COUNSELOR') {
          router.push(`/${locale}`);
          return;
        }

        setUserEmail(data.user.email || '');

        // ★★★ 승인 상태 확인 ★★★
        fetch('/api/counselor/profile-status')
          .then((res) => res.json())
          .then((profileData) => {
            if (profileData.success && profileData.hasProfile) {
              setProfileStatus(profileData.status);
              
              // APPROVED가 아니면 대시보드 접근 제한
              if (profileData.status !== 'APPROVED') {
                setIsCheckingStatus(false);
                setIsLoading(false);
                return;
              }
            } else {
              // 프로필이 없으면 PENDING으로 간주
              setProfileStatus('PENDING');
              setIsCheckingStatus(false);
              setIsLoading(false);
              return;
            }

            // APPROVED인 경우에만 데이터 로드
            Promise.all([
              fetch('/api/counselor/status').then((res) => res.json()),
              fetch('/api/counselor/stats').then((res) => res.json()),
            ])
              .then(([statusData, statsData]) => {
                if (statusData.success) setIsOnline(statusData.status === 'online');
                if (statsData.success) {
                  setConsultationEarnings(statsData.consultationEarnings || 0);
                  setGiftEarnings(statsData.giftEarnings || 0);
                  setTotalTodayEarnings(statsData.totalTodayEarnings || 0);
                  setTotalCoins(statsData.totalCoins || 0);
                }
                setIsCheckingStatus(false);
                setIsLoading(false);
              })
              .catch(() => {
                setIsCheckingStatus(false);
                setIsLoading(false);
              });
          })
          .catch(() => {
            setIsCheckingStatus(false);
            setIsLoading(false);
          });
      })
      .catch(() => router.push(`/${locale}`));
  }, [router, locale]);

  // 수신 통화 폴링
  useEffect(() => {
    if (incomingPollRef.current) {
      clearInterval(incomingPollRef.current);
      incomingPollRef.current = null;
    }

    if (!isOnline || activeCall) {
      setIncomingCall(null);
      return;
    }

    checkIncomingCall();
    incomingPollRef.current = setInterval(checkIncomingCall, 2000);

    return () => {
      if (incomingPollRef.current) {
        clearInterval(incomingPollRef.current);
        incomingPollRef.current = null;
      }
    };
  }, [isOnline, activeCall, checkIncomingCall]);

  // 통화 중 상태 폴링
  useEffect(() => {
    if (activeCallPollRef.current) {
      clearInterval(activeCallPollRef.current);
      activeCallPollRef.current = null;
    }

    if (!activeCall) return;

    checkActiveCallStatus();
    activeCallPollRef.current = setInterval(checkActiveCallStatus, 2000);

    return () => {
      if (activeCallPollRef.current) {
        clearInterval(activeCallPollRef.current);
        activeCallPollRef.current = null;
      }
    };
  }, [activeCall, checkActiveCallStatus]);

  // 통화 중 타이머
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!activeCall || !activeCall.startedAt) return;

    const startTime = new Date(activeCall.startedAt).getTime();

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setActiveCallElapsed(elapsed);
      setCurrentEarnings(Math.ceil(elapsed / 60) * 8);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeCall]);

  // 벨소리 루프
  useEffect(() => {
    stopRingtone();

    if (!incomingCall || !audioEnabled) return;

    playRingtone();
    ringtoneRef.current = setInterval(playRingtone, 1800);

    return () => stopRingtone();
  }, [incomingCall, audioEnabled, playRingtone, stopRingtone]);

  // 통화 수락
  const handleAcceptCall = async () => {
    if (!incomingCall) return;

    stopRingtone();
    setIsAccepting(true);
    const callToAccept = incomingCall;
    setIncomingCall(null);

    try {
      const response = await fetch('/api/call/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: callToAccept.id }),
      });

      const data = await response.json();

      if (data.success) {
        setActiveCall({
          ...callToAccept,
          startedAt: data.call.startedAt || new Date().toISOString(),
        });
        setActiveCallElapsed(0);
        setCurrentEarnings(0);
        setTotalGifts(0);
      } else {
        setError(data.message || t('common.error'));
      }
    } catch (err) {
      setError(t('common.error'));
    } finally {
      setIsAccepting(false);
    }
  };

  // 통화 거절
  const handleRejectCall = async () => {
    if (!incomingCall) return;

    stopRingtone();
    setIsRejecting(true);
    const callToReject = incomingCall;
    setIncomingCall(null);

    try {
      const response = await fetch('/api/call/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: callToReject.id }),
      });

      const data = await response.json();
      if (!data.success) {
        setError(data.message || t('common.error'));
      }
    } catch (err) {
      setError(t('common.error'));
    } finally {
      setIsRejecting(false);
    }
  };

  // 통화 종료
  const handleEndCall = async () => {
    if (!activeCall) return;

    try {
      const response = await fetch('/api/call/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: activeCall.id }),
      });

      const data = await response.json();

      if (data.success) {
        setActiveCall(null);
        setActiveCallElapsed(0);
        setCurrentEarnings(0);
        setTotalGifts(0);
        setTimeout(refreshEarnings, 1000);
      }
    } catch (err) {
      console.error('Call end error:', err);
    }
  };

  // 네트워크 테스트 실행
  const executeNetworkTest = useCallback(async () => {
    setNetworkTestStatus('testing_ping');
    setNetworkTestResult(null);
    
    // 약간의 지연 후 테스트 시작 (UI 업데이트를 위해)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setNetworkTestStatus('testing_speed');
    
    // 실제 테스트 실행
    const result = await runNetworkTest();
    
    setNetworkTestResult(result);
    setNetworkTestStatus('complete');
    
    return result;
  }, []);

  // 네트워크 테스트 후 온라인 전환
  const confirmGoOnline = useCallback(async () => {
    if (!networkTestResult || !networkTestResult.passed) return;
    
    // ★★★ 승인 상태 확인 ★★★
    if (profileStatus !== 'APPROVED') {
      alert('승인된 상담사만 업무를 시작할 수 있습니다.');
      return;
    }
    
    setIsUpdating(true);
    
    try {
      const response = await fetch('/api/counselor/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'online' }),
      });

      const data = await response.json();

      if (data.success) {
        setIsOnline(true);
        setShowNetworkTest(false);
        setNetworkTestStatus('idle');
        setNetworkTestResult(null);
        
        // 오디오 초기화
        if (!audioEnabled) {
          initAudio();
        }
      } else {
        setError(data.message || t('common.error'));
      }
    } catch (err) {
      setError(t('common.error'));
    } finally {
      setIsUpdating(false);
    }
  }, [networkTestResult, audioEnabled, initAudio, t, profileStatus]);

  // 상태 토글
  const handleToggleStatus = async () => {
    setError('');
    
    // ★★★ 승인 상태 확인: 온라인으로 변경하려는 경우만 검증 ★★★
    if (!isOnline && profileStatus !== 'APPROVED') {
      const statusMsg = profileStatus === 'PENDING' ? '심사 대기 중' : profileStatus === 'REJECTED' ? '거절됨' : '프로필 없음';
      setError(`승인된 상담사만 업무를 시작할 수 있습니다. (현재 상태: ${statusMsg})`);
      alert(`승인된 상담사만 업무를 시작할 수 있습니다.\n현재 상태: ${statusMsg}`);
      return;
    }
    
    // 오프라인으로 전환하는 경우
    if (isOnline) {
      setIsUpdating(true);
      
      try {
        const response = await fetch('/api/counselor/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'offline' }),
        });

        const data = await response.json();

        if (data.success) {
          setIsOnline(false);
        } else {
          setError(data.message || t('common.error'));
        }
      } catch (err) {
        setError(t('common.error'));
      } finally {
        setIsUpdating(false);
      }
      return;
    }
    
    // 온라인으로 전환하는 경우 - 네트워크 테스트 팝업 표시
    setShowNetworkTest(true);
    setNetworkTestStatus('idle');
    setNetworkTestResult(null);
  };

  // 네트워크 테스트 팝업 닫기
  const closeNetworkTest = () => {
    setShowNetworkTest(false);
    setNetworkTestStatus('idle');
    setNetworkTestResult(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ★★★ 승인 상태 확인 중 또는 승인되지 않은 경우 UI ★★★
  if (isCheckingStatus || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // 승인되지 않은 경우 (PENDING, REJECTED, 또는 프로필 없음)
  if (profileStatus !== 'APPROVED') {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center p-4">
        <div
          className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-12 shadow-2xl border-2 max-w-md w-full text-center"
          style={{ borderColor: '#D4AF37' }}
        >
          <div className="mb-6">
            <div className="text-6xl mb-4">⏳</div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#D4AF37' }}>
              심사 대기 중
            </h1>
          </div>
          
          <div className="space-y-4 text-gray-300">
            {profileStatus === 'PENDING' ? (
              <>
                <p className="text-lg">
                  상담사 신청이 접수되었습니다.
                </p>
                <p className="text-sm text-gray-400">
                  관리자 검토 후 승인되면 업무를 시작하실 수 있습니다.
                </p>
              </>
            ) : profileStatus === 'REJECTED' ? (
              <>
                <p className="text-lg text-red-400">
                  신청이 거절되었습니다.
                </p>
                <p className="text-sm text-gray-400">
                  다른 조건으로 재신청해주시기 바랍니다.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg">
                  상담사 프로필이 없습니다.
                </p>
                <p className="text-sm text-gray-400">
                  먼저 상담사 신청을 제출해주세요.
                </p>
                <a
                  href={`/${locale}/counselors/apply`}
                  className="inline-block mt-4 px-6 py-3 rounded-lg font-semibold text-black transition-all transform hover:scale-105"
                  style={{
                    backgroundColor: '#D4AF37',
                    boxShadow: '0 0 15px rgba(212, 175, 55, 0.4)',
                  }}
                >
                  상담사 신청하기
                </a>
              </>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-gray-700">
            <a
              href={`/${locale}/mypage`}
              className="text-sm text-gray-400 hover:text-[#D4AF37] transition-colors"
            >
              ← 마이페이지로 돌아가기
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 네트워크 테스트 결과 포맷팅
  const formattedResult = networkTestResult ? formatTestResult(networkTestResult) : null;

  return (
    <div className="min-h-screen bg-black">
      {/* 네트워크 테스트 팝업 */}
      {showNetworkTest && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 max-w-md w-full shadow-2xl border-2"
            style={{ borderColor: '#D4AF37' }}
          >
            <div className="text-center">
              {/* 헤더 */}
              <div className="text-5xl mb-4">📡</div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#D4AF37' }}>
                {t('counselor.networkTestTitle')}
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                {t('counselor.networkTestDesc')}
              </p>

              {/* 테스트 상태 표시 */}
              {networkTestStatus === 'idle' && (
                <div className="mb-6">
                  <div className="p-4 bg-gray-800/50 rounded-xl mb-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-left">
                        <div className="text-gray-500 mb-1">{t('counselor.pingLabel')}</div>
                        <div className="text-gray-300">≤ {NETWORK_REQUIREMENTS.MAX_PING_MS}{t('counselor.pingUnit')}</div>
                      </div>
                      <div className="text-left">
                        <div className="text-gray-500 mb-1">{t('counselor.speedLabel')}</div>
                        <div className="text-gray-300">≥ {NETWORK_REQUIREMENTS.MIN_SPEED_KBPS}{t('counselor.speedUnit')}</div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={executeNetworkTest}
                    className="w-full py-4 px-6 font-bold rounded-xl transition-all transform hover:scale-105"
                    style={{ backgroundColor: '#D4AF37', color: '#000' }}
                  >
                    🔍 {t('counselor.checkingNetwork').replace('...', '')}
                  </button>
                </div>
              )}

              {/* 테스트 진행 중 */}
              {(networkTestStatus === 'testing_ping' || networkTestStatus === 'testing_speed') && (
                <div className="mb-6">
                  <div className="relative w-20 h-20 mx-auto mb-6">
                    <div className="absolute inset-0 border-4 border-transparent rounded-full animate-spin"
                      style={{ borderTopColor: '#D4AF37', borderRightColor: '#D4AF37' }}
                    />
                    <div className="absolute inset-2 flex items-center justify-center">
                      <div className="text-3xl">
                        {networkTestStatus === 'testing_ping' ? '⏱️' : '📶'}
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-300 animate-pulse">
                    {networkTestStatus === 'testing_ping' 
                      ? t('counselor.testingPing')
                      : t('counselor.testingSpeed')
                    }
                  </p>
                </div>
              )}

              {/* 테스트 결과 */}
              {networkTestStatus === 'complete' && networkTestResult && formattedResult && (
                <div className="mb-6">
                  {/* 결과 아이콘 */}
                  <div className={`text-6xl mb-4 ${networkTestResult.passed ? 'animate-bounce' : 'animate-pulse'}`}>
                    {networkTestResult.passed ? '✅' : '❌'}
                  </div>
                  
                  <h3 className={`text-xl font-bold mb-4 ${networkTestResult.passed ? 'text-green-400' : 'text-red-400'}`}>
                    {networkTestResult.passed ? t('counselor.testPassed') : t('counselor.testFailed')}
                  </h3>

                  {/* 상세 결과 */}
                  <div className="p-4 bg-gray-800/50 rounded-xl mb-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Ping 결과 */}
                      <div className="text-left">
                        <div className="text-gray-500 text-sm mb-1">{t('counselor.pingLabel')}</div>
                        <div className={`text-xl font-bold ${
                          formattedResult.pingStatus === 'good' ? 'text-green-400' :
                          formattedResult.pingStatus === 'warning' ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {formattedResult.pingDisplay}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {networkTestResult.pingPassed ? '✓' : '✗'} {t('counselor.pingRequirement')}
                        </div>
                      </div>
                      
                      {/* 속도 결과 */}
                      <div className="text-left">
                        <div className="text-gray-500 text-sm mb-1">{t('counselor.speedLabel')}</div>
                        <div className={`text-xl font-bold ${
                          formattedResult.speedStatus === 'good' ? 'text-green-400' :
                          formattedResult.speedStatus === 'warning' ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {formattedResult.speedDisplay}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {networkTestResult.speedPassed ? '✓' : '✗'} {t('counselor.speedRequirement')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 실패 메시지 */}
                  {!networkTestResult.passed && (
                    <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-xl mb-4 text-left">
                      <p className="text-red-300 text-sm mb-2 font-medium">
                        {t('counselor.networkTestFailed')}
                      </p>
                      <ul className="text-red-400 text-xs space-y-1">
                        {!networkTestResult.pingPassed && (
                          <li>• {t('counselor.pingTooHigh')}</li>
                        )}
                        {!networkTestResult.speedPassed && (
                          <li>• {t('counselor.speedTooLow')}</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  <div className="flex gap-3">
                    {networkTestResult.passed ? (
                      <>
                        <button
                          onClick={closeNetworkTest}
                          className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-all"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          onClick={confirmGoOnline}
                          disabled={isUpdating}
                          className="flex-1 py-3 px-4 font-bold rounded-xl transition-all transform hover:scale-105 disabled:opacity-50"
                          style={{ backgroundColor: '#D4AF37', color: '#000' }}
                        >
                          {isUpdating ? '...' : `✅ ${t('counselor.goOnline')}`}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={closeNetworkTest}
                          className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-all"
                        >
                          {t('common.close')}
                        </button>
                        <button
                          onClick={executeNetworkTest}
                          className="flex-1 py-3 px-4 font-bold rounded-xl transition-all transform hover:scale-105"
                          style={{ backgroundColor: '#D4AF37', color: '#000' }}
                        >
                          🔄 {t('counselor.retryTest')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 수신 통화 팝업 */}
      {incomingCall && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 max-w-md w-full shadow-2xl border-2 animate-pulse"
            style={{ borderColor: '#D4AF37' }}
          >
            <div className="text-center">
              <div className="text-8xl mb-6 animate-bounce">📞</div>
              <h2 className="text-3xl font-bold mb-2" style={{ color: '#D4AF37' }}>
                {t('counselor.incomingCall')}
              </h2>
              <p className="text-gray-400 mb-2">
                <span className="text-white font-semibold">{incomingCall.caller.name}</span>
                {' '}{t('counselor.callRequested', { name: '' })}
              </p>
              <p className="text-xs text-gray-500 mb-6">
                {audioEnabled ? '🔔' : '🔇'}
              </p>

              <div className="flex gap-4">
                <button
                  onClick={handleRejectCall}
                  disabled={isRejecting || isAccepting}
                  className="flex-1 py-4 px-6 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  {isRejecting ? '...' : `❌ ${t('counselor.rejectCall')}`}
                </button>
                <button
                  onClick={handleAcceptCall}
                  disabled={isAccepting || isRejecting}
                  className="flex-1 py-4 px-6 font-bold rounded-xl transition-all disabled:opacity-50"
                  style={{ backgroundColor: '#D4AF37', color: '#000' }}
                >
                  {isAccepting ? '...' : `✅ ${t('counselor.acceptCall')}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 진행 중인 통화 표시 */}
      {activeCall && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div
            className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 max-w-md w-full shadow-2xl border-2"
            style={{ borderColor: '#D4AF37' }}
          >
            {giftNotification && (
              <div 
                className="absolute top-4 left-1/2 transform -translate-x-1/2 px-8 py-4 rounded-2xl text-xl font-bold z-60 shadow-2xl animate-bounce"
                style={{ 
                  background: 'linear-gradient(135deg, #ec4899, #f472b6)',
                  color: '#ffffff',
                  boxShadow: '0 0 30px rgba(236, 72, 153, 0.8)',
                }}
              >
                {giftNotification}
              </div>
            )}

            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full bg-green-500/20 animate-pulse"></div>
                <div className="absolute inset-2 rounded-full bg-green-500/40 flex items-center justify-center">
                  <div className="text-4xl">🎧</div>
                </div>
              </div>

              <h2 className="text-3xl font-bold mb-2" style={{ color: '#D4AF37' }}>
                {t('call.callInProgress')}
              </h2>
              <p className="text-gray-400 mb-6">
                <span className="text-white font-semibold">{activeCall.caller.name}</span>
              </p>

              <div className="mb-6 p-4 bg-black/50 rounded-xl">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-500 mb-1">{t('call.callDuration')}</div>
                    <div className="text-3xl text-white font-mono font-bold">
                      {formatTime(activeCallElapsed)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500 mb-1">💰 {t('call.currentRevenue')}</div>
                    <div className="text-3xl font-bold" style={{ color: '#D4AF37' }}>
                      {currentEarnings}
                      <span className="text-lg ml-1">{t('common.coins')}</span>
                    </div>
                  </div>
                </div>

                {totalGifts > 0 && (
                  <div className="pt-4 border-t border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">🎁 {t('call.gift')}</span>
                      <span className="text-xl font-bold" style={{ color: '#ec4899' }}>
                        {totalGifts.toLocaleString()} {t('common.coins')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleEndCall}
                className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all transform hover:scale-105"
              >
                📴 {t('call.endCall')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="container mx-auto px-4 py-6 border-b border-[#D4AF37]/20">
        <div className="flex items-center justify-between">
          <a href={`/${locale}`} className="text-2xl font-bold" style={{ color: '#D4AF37' }}>
            {t('common.siteName')}
          </a>
          <nav className="flex gap-4 items-center">
            <span className="text-white/80 text-sm hidden sm:inline">{userEmail}</span>
            <a href={`/${locale}/mypage`} className="text-white/80 hover:text-white transition-colors text-sm">
              {t('nav.mypage')}
            </a>
            <a href={`/${locale}`} className="text-white/80 hover:text-white transition-colors text-sm">
              {t('nav.home')}
            </a>
          </nav>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#D4AF37' }}>
            {t('counselor.dashboardTitle')}
          </h1>
          <p className="text-gray-400">{t('counselor.statusOnline')}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm max-w-2xl mx-auto">
            {error}
          </div>
        )}

        {/* 통화 대기 토글 */}
        <div
          className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 mb-8 shadow-2xl border-2 max-w-2xl mx-auto"
          style={{ borderColor: '#D4AF37' }}
        >
          <div className="text-center">
            <div className="mb-6">
              <div className="text-6xl mb-4">{isOnline ? '📞' : '😴'}</div>
              <h2 className="text-3xl font-bold mb-2" style={{ color: isOnline ? '#D4AF37' : '#666' }}>
                {isOnline ? t('counselor.statusOnline') : t('counselor.statusOffline')}
              </h2>
            </div>

            <button
              onClick={handleToggleStatus}
              disabled={isUpdating || (profileStatus !== 'APPROVED' && !isOnline)}
              className={`relative w-32 h-16 rounded-full transition-all duration-300 ${
                isUpdating || (profileStatus !== 'APPROVED' && !isOnline) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'
              }`}
              style={{
                backgroundColor: isOnline ? '#D4AF37' : '#333',
                boxShadow: isOnline ? '0 0 30px rgba(212, 175, 55, 0.6)' : '0 0 10px rgba(0, 0, 0, 0.3)',
              }}
            >
              <div
                className={`absolute top-1 left-1 w-14 h-14 bg-white rounded-full transition-all duration-300 ${
                  isOnline ? 'translate-x-16' : 'translate-x-0'
                }`}
              />
            </button>

            <div className="mt-6 flex items-center justify-center gap-4">
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-gray-400 text-sm">
                {isOnline ? `Online ${audioEnabled ? '🔔' : '🔇'}` : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div
            className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 shadow-2xl border-2"
            style={{ borderColor: '#D4AF37' }}
          >
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="text-4xl mr-2">💰</div>
                <h3 className="text-xl font-bold" style={{ color: '#D4AF37' }}>{t('counselor.todayEarnings')}</h3>
              </div>
              <div className="text-6xl font-bold mb-6" style={{ color: '#D4AF37', textShadow: '0 0 20px rgba(212, 175, 55, 0.5)' }}>
                {totalTodayEarnings.toLocaleString()}
              </div>
              <div className="text-lg font-semibold mb-2" style={{ color: '#D4AF37' }}>
                {t('common.coins')}
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🎙️</span>
                    <span className="text-gray-300 font-medium">{t('counselor.consultationEarnings')}</span>
                  </div>
                  <span className="text-xl font-bold text-white">
                    {consultationEarnings.toLocaleString()} {t('common.coins')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">💝</span>
                    <span className="text-gray-300 font-medium">{t('counselor.giftEarnings')}</span>
                  </div>
                  <span className="text-xl font-bold" style={{ color: '#ec4899' }}>
                    {giftEarnings.toLocaleString()} {t('common.coins')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-6 shadow-xl border-2"
            style={{ borderColor: '#D4AF37' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-300">{t('mypage.accumulatedLabel')}</h3>
              <div className="text-3xl">💰</div>
            </div>
            <div className="text-3xl font-bold mb-2" style={{ color: '#D4AF37' }}>
              {totalCoins.toLocaleString()}
              <span className="text-lg ml-1">{t('common.coins')}</span>
            </div>
            <p className="text-gray-400 text-sm mb-2">
              {t('mypage.usdtEquivalent', { amount: (totalCoins / 100).toFixed(2) })}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

