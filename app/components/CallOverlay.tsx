'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { audioManager } from '@/lib/audio-manager';

interface CallOverlayProps {
  callId: string;
  counselors: Array<{ id: string; name: string }>;
  onCancel: () => void;
  userRole?: 'MEMBER' | 'COUNSELOR'; // 역할 추가
}

type CallStatus = 'CONNECTING' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

export default function CallOverlay({ callId, counselors, onCancel, userRole = 'MEMBER' }: CallOverlayProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 통화 상태
  const [callStatus, setCallStatus] = useState<CallStatus>('CONNECTING');
  const [connectedCounselor, setConnectedCounselor] = useState<{ id: string; name: string } | null>(null);
  const [activeCallStartTime, setActiveCallStartTime] = useState<Date | null>(null);
  const [activeElapsedSeconds, setActiveElapsedSeconds] = useState(0);
  const [remainingCoins, setRemainingCoins] = useState<number>(0);

  // 선물 관련 상태
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [isGifting, setIsGifting] = useState(false);
  const [giftMessage, setGiftMessage] = useState<string | null>(null);
  const [totalGiftsSent, setTotalGiftsSent] = useState(0);
  
  // 상담사용 선물 수신 알림
  const [receivedGiftNotification, setReceivedGiftNotification] = useState<string | null>(null);
  const [totalGiftsReceived, setTotalGiftsReceived] = useState(0);
  const lastGiftAmountRef = useRef(0); // 현재 알고 있는 선물 총액 저장
  const [isRelayingToNext, setIsRelayingToNext] = useState(false); // 다음 상담사로 릴레이 중 상태
  const [connectingMessageIndex, setConnectingMessageIndex] = useState(0); // 연결 메시지 인덱스
  const audioInitializedRef = useRef(false); // 오디오 초기화 플래그
  
  // 연결 메시지 배열 (주기적으로 교체)
  const connectingMessages = [
    '비밀 선로 연결 중...',
    '상대방의 목소리를 가져오는 중...',
    '안전한 경로를 설정하는 중...',
    '연결을 암호화하는 중...',
    '신호를 전송하는 중...',
  ];

  // 인터벌 참조 (메모리 누수 방지)
  const statusPollRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const connectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTransitioningRef = useRef(false); // 상담사 전환 중 플래그 (중복 호출 방지)
  const previousCounselorIdRef = useRef<string | null>(null); // 이전 상담사 ID (거절 감지용)

  // 오디오 초기화 (사용자 인터랙션 후)
  const initializeAudio = useCallback(async () => {
    if (audioInitializedRef.current) return;
    
    try {
      await audioManager.initialize();
      audioInitializedRef.current = true;
      console.log('🎵 [CallOverlay] 오디오 초기화 완료');
    } catch (error) {
      console.error('❌ [CallOverlay] 오디오 초기화 실패:', error);
    }
  }, []);

  // 통화 상태 폴링 (2초마다) + 선물 수신 감지
  const checkCallStatus = useCallback(async () => {
    if (!callId) return;

    try {
      const response = await fetch(`/api/call/status?callId=${callId}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-store' },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.call) {
          // ★★★ 실시간 코인 잔액 업데이트 (서버에서 최신 값 반환) ★★★
          // 이용자(MEMBER)인 경우 잔액을 강제로 동기화
          if (data.user && typeof data.user.coins === 'number') {
            const serverCoins = data.user.coins;
            setRemainingCoins((prevCoins) => {
              if (prevCoins !== serverCoins) {
                console.log(`💰 [잔액 동기화] ${prevCoins} → ${serverCoins} 코인 (차이: ${prevCoins - serverCoins})`);
              }
              return serverCoins;
            });
          }

          const newStatus = data.call.status as CallStatus;
          const currentCounselorId = data.call.counselor?.id || null;

          // ★★★ 상담사 ID 변경 감지 (거절 시 릴레이 매칭) ★★★
          if (userRole === 'MEMBER' && 
              callStatus === 'CONNECTING' && 
              newStatus === 'CONNECTING' && 
              currentCounselorId && 
              previousCounselorIdRef.current && 
              currentCounselorId !== previousCounselorIdRef.current) {
            
            // 상담사가 거절하여 다음 상담사로 전환됨
            console.log(`🔄 [릴레이 매칭] 상담사 변경 감지: ${previousCounselorIdRef.current} → ${currentCounselorId}`);
            
            // 릴레이 중 상태 활성화 (3초 후 자동 해제)
            setIsRelayingToNext(true);
            setTimeout(() => setIsRelayingToNext(false), 3000);
            
            // 현재 상담사 정보 업데이트
            setConnectedCounselor(data.call.counselor);
            
            // 타이머 리셋 및 재시작 (새로운 상담사에게 10초 카운트 시작)
            setElapsedSeconds(0);
            
            // counselors 배열에서 새로운 상담사 인덱스 찾기
            const newCounselorIndex = counselors.findIndex((c) => c.id === currentCounselorId);
            if (newCounselorIndex >= 0) {
              setCurrentIndex(newCounselorIndex);
              console.log(`✅ [릴레이 매칭] 다음 상담사로 전환 완료: ${newCounselorIndex + 1}번 (${data.call.counselor?.name})`);
            }
            
            // 이전 상담사 ID 업데이트
            previousCounselorIdRef.current = currentCounselorId;
            
            // 에러 메시지 초기화
            setError(null);
          }

          // 상태 변경 감지
          if (newStatus !== callStatus) {
            console.log(`📞 [상태 변경] ${callStatus} → ${newStatus}`);
            setCallStatus(newStatus);

            if (newStatus === 'ACTIVE') {
              setConnectedCounselor(data.call.counselor);
              setActiveCallStartTime(new Date(data.call.startedAt));
              // ★★★ 통화 연결 시 연결 대기 소리 페이드아웃 ★★★
              audioManager.fadeOut(0.8);
              console.log('✅ [통화 연결] 상담사와 연결됨:', data.call.counselor?.name);
              // 상담사 ID 저장
              if (data.call.counselor?.id) {
                previousCounselorIdRef.current = data.call.counselor.id;
              }
            } else if (newStatus === 'ENDED' || newStatus === 'CANCELLED') {
              console.log('📴 [통화 종료] 상태:', newStatus);
              
              // CANCELLED 상태가 "연결 가능한 상담사가 없습니다"인지 확인
              if (newStatus === 'CANCELLED' && callStatus === 'CONNECTING') {
                setError('연결 가능한 상담사가 없습니다.');
              }
              
              setTimeout(() => onCancel(), 2000);
            } else if (newStatus === 'CONNECTING' && currentCounselorId) {
              // CONNECTING 상태에서 상담사 ID 저장 (초기 설정)
              if (!previousCounselorIdRef.current) {
                previousCounselorIdRef.current = currentCounselorId;
                setConnectedCounselor(data.call.counselor);
              }
            }
          }

          // 상담사인 경우 선물 수신 감지 (2초마다 체크)
          // ★★★ Ref 값과 직접 비교하여 1코인이라도 차이나면 즉시 팝업 ★★★
          if (userRole === 'COUNSELOR') {
            const currentGifts = data.call.totalGifts ?? 0;
            const previousGifts = lastGiftAmountRef.current;
            
            // 항상 현재 선물 총액 업데이트
            setTotalGiftsReceived(currentGifts);
            
            // 1코인이라도 차이가 나면 즉시 팝업 (Ref 직접 비교)
            if (currentGifts > previousGifts) {
              const newGiftAmount = currentGifts - previousGifts;
              
              console.log(`🎁 [선물 감지] 이전: ${previousGifts}코인 → 현재: ${currentGifts}코인 (차이: +${newGiftAmount}코인)`);
              
              // 즉시 화면 중앙에 핑크색 팝업 표시
              setReceivedGiftNotification(`🎁 [선물 도착!] ${newGiftAmount.toLocaleString()} 코인을 받았습니다!`);
              
              // 선물 알림음 재생
              audioManager.playGiftSound();
              
              // 3초 후 자동 사라짐
              setTimeout(() => setReceivedGiftNotification(null), 3000);
            }
            
            // Ref 값 업데이트
            lastGiftAmountRef.current = currentGifts;
          }
        }
      }
    } catch (err) {
      console.error('상태 확인 오류:', err);
    }
  }, [callId, callStatus, onCancel, userRole]);

  // 코인 잔액 조회
  const checkRemainingCoins = useCallback(async () => {
    try {
      const response = await fetch('/api/user/coins', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-store' },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRemainingCoins(data.coins || 0);
        }
      }
    } catch (err) {
      console.error('잔액 조회 오류:', err);
    }
  }, []);

  // 선물하기
  const handleGift = async (amount: number) => {
    setIsGifting(true);
    setGiftMessage(null);

    try {
      const response = await fetch('/api/call/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId, amount }),
      });

      const data = await response.json();

      if (data.success) {
        setGiftMessage(`🎁 ${amount}코인 선물 완료!`);
        setShowGiftModal(false);
        setTotalGiftsSent((prev) => prev + amount);
        checkRemainingCoins();
        setTimeout(() => setGiftMessage(null), 3000);
      } else {
        setGiftMessage(`❌ ${data.message}`);
        setTimeout(() => setGiftMessage(null), 3000);
      }
    } catch (err) {
      setGiftMessage('❌ 선물 처리 중 오류가 발생했습니다.');
      setTimeout(() => setGiftMessage(null), 3000);
    } finally {
      setIsGifting(false);
    }
  };

  // 초기화 및 오디오 관리
  useEffect(() => {
    if (counselors.length === 0) {
      setError('현재 통화 가능한 상담사가 없습니다.');
    } else {
      setError(null);
      console.log(`✅ [CallOverlay] 상담사 ${counselors.length}명 로드됨`);
    }
    checkRemainingCoins();
    
    // CONNECTING 상태일 때 연결 대기 알림음 시작
    if (callStatus === 'CONNECTING') {
      initializeAudio().then(() => {
        audioManager.playConnectingSound();
      });
    }
    
    // 정리 함수
    return () => {
      if (callStatus === 'CONNECTING') {
        audioManager.stop();
      }
    };
  }, [counselors, checkRemainingCoins, callStatus, initializeAudio]);

  // 연결 메시지 자동 교체 (3초마다)
  useEffect(() => {
    if (callStatus !== 'CONNECTING' || isRelayingToNext) return;

    const messageInterval = setInterval(() => {
      setConnectingMessageIndex((prev) => (prev + 1) % connectingMessages.length);
    }, 3000);

    return () => clearInterval(messageInterval);
  }, [callStatus, isRelayingToNext, connectingMessages.length]);

  // 상태 폴링 (2초마다) - 중복 방지
  // checkCallStatus에서 이미 코인 잔액을 업데이트하므로 checkRemainingCoins는 불필요
  useEffect(() => {
    if (statusPollRef.current) {
      clearInterval(statusPollRef.current);
      statusPollRef.current = null;
    }

    checkCallStatus();

    statusPollRef.current = setInterval(() => {
      checkCallStatus(); // 여기서 코인 잔액도 함께 업데이트됨
    }, 2000);

    return () => {
      if (statusPollRef.current) {
        clearInterval(statusPollRef.current);
        statusPollRef.current = null;
      }
    };
  }, [checkCallStatus]);

  // 다음 상담사로 전환하는 함수 (Side Effect 분리)
  const moveToNextCounselor = useCallback(async () => {
    // 중복 호출 방지 체크 (ref만 사용하여 의존성 최소화)
    if (isTransitioningRef.current) {
      console.log('⚠️ [10초 릴레이] 이미 전환 진행 중 - 중복 호출 방지');
      return;
    }

    // 전환 시작 플래그 설정
    isTransitioningRef.current = true;
    setIsLoading(true);

    // 타이머 중지 (API 완료 후 재시작)
    if (connectTimerRef.current) {
      clearInterval(connectTimerRef.current);
      connectTimerRef.current = null;
    }

    // 현재 인덱스 기준으로 다음 인덱스 계산
    const currentIdx = currentIndex;
    const nextIdx = (currentIdx + 1) % counselors.length;

    console.log(`⏰ [10초 릴레이] ${currentIdx + 1}번 상담사에게 10초 경과 → ${nextIdx + 1}번 상담사로 전환`);

    try {
      // API 호출로 다음 상담사로 업데이트
      const response = await fetch(`/api/call/match?callId=${callId}&counselorIndex=${currentIdx}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-store' },
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        // API 응답에서 받은 인덱스로 업데이트
        if (data.currentCounselorIndex !== undefined) {
          setCurrentIndex(data.currentCounselorIndex);
          console.log(`✅ [10초 릴레이] 다음 상담사로 전환 완료: ${data.currentCounselorIndex + 1}번`);
        }
        // 상담사 정보가 있으면 로그
        if (data.currentCounselor) {
          console.log(`👤 [10초 릴레이] 새로운 상담사: ${data.currentCounselor.name}`);
        }
        setError(null);
      } else {
        console.error(`❌ [10초 릴레이] API 응답 실패: ${data.message}`);
        setError(data.message || '상담사 전환에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('❌ [10초 릴레이] API 호출 오류:', err);
      setError('상담사 전환 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      isTransitioningRef.current = false;
      
            // 타이머 리셋 및 재시작 (성공/실패 무관하게)
            setElapsedSeconds(0);
            
            // 연결 대기 알림음 재시작 (새로운 상담사에게)
            audioManager.playConnectingSound();
            
            // 타이머 재시작
            if (connectTimerRef.current) {
              clearInterval(connectTimerRef.current);
              connectTimerRef.current = null;
            }
            
            connectTimerRef.current = setInterval(() => {
              setElapsedSeconds((prev) => {
                const newElapsed = prev + 1;
                
                // 정확히 20초에 도달했을 때 다음 상담사로 전환
                if (newElapsed >= 20) {
                  // 연결 대기 알림음 부드럽게 교체
                  audioManager.fadeOut(0.5);
                  setTimeout(() => {
                    audioManager.playConnectingSound();
                  }, 500);
                  
                  // 상태 업데이트 함수에서는 순수하게 숫자만 반환
                  // 실제 전환 로직은 moveToNextCounselor에서 처리
                  moveToNextCounselor();
                  return 20; // 전환 진행 중에는 20에 고정
                }
                
                return newElapsed;
              });
            }, 1000);
    }
  }, [callId, counselors.length, currentIndex]);

  // CONNECTING 상태: 10초 타이머 (상담사 순환) - 구조적으로 개선된 버전
  useEffect(() => {
    // 기존 타이머 정리
    if (connectTimerRef.current) {
      clearInterval(connectTimerRef.current);
      connectTimerRef.current = null;
    }

    // 전환 플래그 리셋
    isTransitioningRef.current = false;

    if (callStatus !== 'CONNECTING' || !callId || counselors.length === 0) {
      return;
    }

    // 초기 elapsedSeconds를 0으로 설정
    setElapsedSeconds(0);

    // 타이머 시작 (1초마다 실행)
    connectTimerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const newElapsed = prev + 1;
        
        // 정확히 20초에 도달했을 때 다음 상담사로 전환 (오디오와 연동)
        if (newElapsed >= 20) {
          // 연결 대기 알림음 부드럽게 교체 (새로운 상담사로 전환 시)
          audioManager.fadeOut(0.5);
          setTimeout(() => {
            audioManager.playConnectingSound();
          }, 600);
          
          // 상태 업데이트 함수에서는 순수하게 숫자만 반환
          // 실제 전환 로직은 moveToNextCounselor에서 처리
          moveToNextCounselor();
          return 20; // 전환 진행 중에는 20에 고정
        }
        
        return newElapsed;
      });
    }, 1000);

    return () => {
      if (connectTimerRef.current) {
        clearInterval(connectTimerRef.current);
        connectTimerRef.current = null;
      }
      isTransitioningRef.current = false;
    };
  }, [callId, counselors.length, callStatus, moveToNextCounselor]);

  // ACTIVE 상태: 통화 시간 카운터
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (callStatus !== 'ACTIVE' || !activeCallStartTime) {
      return;
    }

    timerRef.current = setInterval(() => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - activeCallStartTime.getTime()) / 1000);
      setActiveElapsedSeconds(elapsed);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [callStatus, activeCallStartTime]);

  const handleCancel = async () => {
    setIsCancelling(true);

    try {
      const endpoint = callStatus === 'ACTIVE' ? '/api/call/end' : '/api/call/cancel';
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId }),
      });

      onCancel();
      router.refresh();
    } catch (error) {
      console.error('통화 종료 오류:', error);
      onCancel();
    } finally {
      setIsCancelling(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 역할에 따른 비용/수익 계산
  const estimatedCost = Math.ceil(activeElapsedSeconds / 60) * 14; // 이용자 비용
  const estimatedEarnings = Math.ceil(activeElapsedSeconds / 60) * 8; // 상담사 수익 (60%)

  const currentCounselor = counselors[currentIndex];
  
  // 컴포넌트 언마운트 시 오디오 정리
  useEffect(() => {
    return () => {
      audioManager.clear();
    };
  }, []);

  // ACTIVE 상태: 통화 중 화면
  if (callStatus === 'ACTIVE') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>

        {/* 선물 모달 (이용자만) */}
        {showGiftModal && userRole === 'MEMBER' && (
          <div className="absolute inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
            <div
              className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-6 max-w-sm w-full shadow-2xl border-2"
              style={{ borderColor: '#D4AF37' }}
            >
              <div className="text-center">
                <div className="text-5xl mb-4">🎁</div>
                <h3 className="text-xl font-bold mb-4" style={{ color: '#D4AF37' }}>
                  {connectedCounselor?.name}님에게 선물하기
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  잔액: {remainingCoins.toLocaleString()} 코인
                </p>

                <div className="space-y-3 mb-6">
                  {[100, 500, 1000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleGift(amount)}
                      disabled={isGifting || remainingCoins < amount}
                      className="w-full py-3 px-4 rounded-lg font-bold transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: remainingCoins >= amount ? '#D4AF37' : '#555',
                        color: remainingCoins >= amount ? '#000' : '#888',
                      }}
                    >
                      {isGifting ? '전송 중...' : `💝 ${amount.toLocaleString()} 코인`}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowGiftModal(false)}
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="relative z-10 text-center px-4 max-w-md w-full">
          {/* 이용자: 선물 완료 메시지 */}
          {giftMessage && userRole === 'MEMBER' && (
            <div
              className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-16 px-4 py-2 rounded-lg text-sm font-semibold animate-bounce"
              style={{
                backgroundColor: giftMessage.startsWith('🎁') ? '#D4AF37' : '#f43f5e',
                color: giftMessage.startsWith('🎁') ? '#000' : '#fff',
              }}
            >
              {giftMessage}
            </div>
          )}

          {/* 상담사: 선물 수신 알림 - 화면 중앙에 핑크색 팝업 (z-index: 999) */}
          {receivedGiftNotification && userRole === 'COUNSELOR' && (
            <div
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-10 py-6 rounded-3xl text-2xl font-bold shadow-2xl animate-bounce"
              style={{ 
                background: 'linear-gradient(135deg, #ec4899, #f472b6)',
                color: '#ffffff',
                boxShadow: '0 0 60px rgba(236, 72, 153, 1)',
                zIndex: 999,
              }}
            >
              {receivedGiftNotification}
            </div>
          )}

          {/* 로고 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold" style={{ color: '#D4AF37' }}>
              Secret Line
            </h1>
          </div>

          {/* 통화 중 아이콘 */}
          <div className="mb-6">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full bg-green-500/20 animate-pulse"></div>
              <div className="absolute inset-2 rounded-full bg-green-500/40 flex items-center justify-center">
                <div className="text-4xl">🎧</div>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-green-400 mb-2">통화 중</h2>
            <p className="text-white text-lg">
              {connectedCounselor?.name || '상담사'}님과 연결됨
            </p>
          </div>

          {/* 통화 시간 및 비용/수익 */}
          <div className="bg-gray-900/80 rounded-2xl p-6 mb-6 border border-green-500/30">
            <div className="grid grid-cols-2 gap-4">
              {/* 통화 시간 */}
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-1">통화 시간</div>
                <div className="text-3xl font-mono font-bold text-white">
                  {formatTime(activeElapsedSeconds)}
                </div>
              </div>

              {/* 역할에 따라 비용/수익 표시 - 상담사는 무조건 "💰 현재 수익" */}
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-1">
                  {userRole === 'COUNSELOR' ? '💰 현재 수익' : '현재 비용'}
                </div>
                <div className="text-3xl font-bold" style={{ color: '#D4AF37' }}>
                  {userRole === 'COUNSELOR' ? estimatedEarnings : estimatedCost}
                  <span className="text-lg ml-1">코인</span>
                </div>
              </div>
            </div>

            {/* 상담사: 통화 시간 아래 별도 행 - 이번 통화 선물 표시 */}
            {userRole === 'COUNSELOR' && totalGiftsReceived > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700/50">
                <div className="text-center">
                  <span className="text-lg font-bold" style={{ color: '#ec4899' }}>
                    🎁 이번 통화 선물: {totalGiftsReceived.toLocaleString()} 코인
                  </span>
                </div>
              </div>
            )}

            {/* 이용자: 남은 잔액 */}
            {userRole === 'MEMBER' && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">남은 잔액</span>
                  <span 
                    className={`text-xl font-bold ${
                      remainingCoins <= 28 ? 'text-yellow-400' : 'text-white'
                    }`}
                  >
                    {remainingCoins.toLocaleString()} 코인
                  </span>
                </div>
                
                {/* 잔액 경고 메시지 */}
                {remainingCoins > 14 && remainingCoins <= 28 && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-yellow-900/30 border border-yellow-500/50">
                    <p className="text-xs text-yellow-300">
                      ⚠️ 잔액이 부족합니다. 잔액이 14코인 이하가 되면 통화가 자동 종료됩니다.
                    </p>
                  </div>
                )}
                {remainingCoins <= 14 && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-red-900/30 border border-red-500/50">
                    <p className="text-xs text-red-300">
                      ⚠️ 잔액 부족으로 곧 통화가 종료됩니다.
                    </p>
                  </div>
                )}
                
                {totalGiftsSent > 0 && (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-400">🎁 총 선물</span>
                    <span className="text-lg font-bold" style={{ color: '#ec4899' }}>
                      {totalGiftsSent.toLocaleString()} 코인
                    </span>
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-500">💰 분당 14코인 과금 중</div>
              </div>
            )}

            {/* 상담사: 추가 정보 (수익 배분 정보) */}
            {userRole === 'COUNSELOR' && (
              <div className="mt-2 text-xs text-gray-500 text-center">
                분당 8코인 수익 (60% 배분)
              </div>
            )}
          </div>

          {/* 버튼 그룹 */}
          <div className="space-y-3">
            {/* 이용자만: 선물하기 버튼 */}
            {userRole === 'MEMBER' && (
              <button
                onClick={() => setShowGiftModal(true)}
                className="w-full py-3 px-6 rounded-lg font-semibold text-black transition-all transform hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(to right, #f472b6, #ec4899)',
                  boxShadow: '0 0 15px rgba(244, 114, 182, 0.5)',
                }}
              >
                🎁 선물하기
              </button>
            )}

            {/* 통화 종료 버튼 */}
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 rounded-lg font-semibold text-white transition-all transform hover:scale-[1.02] disabled:opacity-50"
            >
              {isCancelling ? '종료 중...' : '📴 통화 종료'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ENDED/CANCELLED 상태: 종료 화면
  if (callStatus === 'ENDED' || callStatus === 'CANCELLED') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>

        <div className="relative z-10 text-center px-4 max-w-md w-full">
          <div className="text-6xl mb-6">{callStatus === 'ENDED' ? '📴' : '❌'}</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {callStatus === 'ENDED' ? '통화가 종료되었습니다' : '통화가 취소되었습니다'}
          </h2>
          <p className="text-gray-400 mb-6">
            {activeElapsedSeconds > 0 && `총 통화 시간: ${formatTime(activeElapsedSeconds)}`}
          </p>
          <p className="text-sm text-gray-500">잠시 후 메인 화면으로 이동합니다...</p>
        </div>
      </div>
    );
  }

  // CONNECTING 상태: 매칭 중 화면
  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>

      <div className="relative z-10 text-center px-4 max-w-md w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#D4AF37' }}>
            Secret Line
          </h1>
        </div>

        <div className="mb-8">
          {/* 심장 박동 애니메이션 */}
          <div className="relative w-40 h-40 mx-auto mb-6">
            {/* 여러 개의 파동 (심장 박동 효과) */}
            <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: '#D4AF37', opacity: 0.2, animation: 'heartbeat-pulse 2s ease-in-out infinite' }}></div>
            <div className="absolute inset-2 rounded-full border-2" style={{ borderColor: '#D4AF37', opacity: 0.3, animation: 'heartbeat-pulse 2s ease-in-out infinite 0.3s' }}></div>
            <div className="absolute inset-4 rounded-full border-2" style={{ borderColor: '#D4AF37', opacity: 0.4, animation: 'heartbeat-pulse 2s ease-in-out infinite 0.6s' }}></div>
            <div className="absolute inset-6 rounded-full border-2" style={{ borderColor: '#D4AF37', opacity: 0.5, animation: 'heartbeat-pulse 2s ease-in-out infinite 0.9s' }}></div>
            
            {/* 중앙 아이콘 */}
            <div className="absolute inset-10 rounded-full bg-gradient-to-br from-gray-900 to-black flex items-center justify-center border-2" style={{ borderColor: '#D4AF37', boxShadow: '0 0 30px rgba(212, 175, 55, 0.3)' }}>
              <div className="text-4xl animate-pulse">💓</div>
            </div>
          </div>
          

          {error ? (
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-red-400 mb-2">매칭 실패</h2>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          ) : isRelayingToNext ? (
            <div className="mb-4">
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#D4AF37' }}>
                다음 상담사를 연결 중입니다...
              </h2>
              <p className="text-gray-400 text-sm animate-pulse">잠시만 기다려주세요</p>
            </div>
          ) : currentCounselor ? (
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-white mb-2">{currentCounselor.name}님</h2>
              <p className="text-gray-400 text-sm animate-pulse">
                {isLoading ? '상담사를 전환하는 중...' : connectingMessages[connectingMessageIndex]}
              </p>
            </div>
          ) : (
            <div className="mb-4">
              <h2 className="text-2xl font-bold mb-2" style={{ 
                background: 'linear-gradient(135deg, #D4AF37 0%, #8B5CF6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                비밀 선로 연결
              </h2>
              <p className="text-gray-400 text-sm animate-pulse transition-all duration-500">
                {connectingMessages[connectingMessageIndex]}
              </p>
            </div>
          )}

          <div className="mb-6">
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-1000 ease-linear"
                style={{ width: `${(elapsedSeconds / 20) * 100}%`, backgroundColor: '#D4AF37' }}
              ></div>
            </div>
            <div className="mt-2 text-sm text-gray-400">{elapsedSeconds}초 / 20초</div>
          </div>

          <div className="text-gray-500 text-xs mb-4">
            {currentIndex + 1}번째 상담사 호출 중 ({currentIndex + 1}/{counselors.length})
          </div>
        </div>

        <button
          onClick={handleCancel}
          disabled={isCancelling}
          className="w-full py-4 px-6 rounded-lg font-semibold text-black transition-all hover:scale-[1.02] disabled:opacity-50"
          style={{
            backgroundColor: isCancelling ? '#B8941F' : '#D4AF37',
            boxShadow: '0 0 20px rgba(212, 175, 55, 0.5)',
          }}
        >
          {isCancelling ? '취소 중...' : '통화 취소'}
        </button>

        <p className="mt-6 text-gray-500 text-xs">상담사가 응답할 때까지 기다려주세요</p>
      </div>
    </div>
  );
}
