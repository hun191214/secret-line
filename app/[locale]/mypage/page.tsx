'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import CallOverlay from '../../components/CallOverlay';

interface User {
  email: string;
  role: string;
  userId?: string;
  coins?: number;
  gender?: 'MALE' | 'FEMALE' | null;
}

interface CallData {
  callId: string;
  counselors: Array<{ id: string; name: string }>;
}

export default function MyPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations();
  
  const [user, setUser] = useState<User | null>(null);
  const [counselorProfileStatus, setCounselorProfileStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | null>(null);
  const [rejectedReason, setRejectedReason] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // 통화 관련 상태
  const [isCalling, setIsCalling] = useState(false);
  const [callData, setCallData] = useState<CallData | null>(null);
  const [isStartingCall, setIsStartingCall] = useState(false);

  useEffect(() => {
    // ★★★ 상담사 프로필 상태를 가장 먼저 확인 (역할과 무관하게) ★★★
    const checkCounselorProfile = async () => {
      try {
        const profileRes = await fetch('/api/counselor/profile-status');
        const profileData = await profileRes.json();
        if (profileData.success && profileData.hasProfile) {
          setCounselorProfileStatus(profileData.status);
        } else {
          setCounselorProfileStatus(null);
        }
      } catch {
        setCounselorProfileStatus(null);
      }
    };

    // 세션 및 잔액 확인
    Promise.all([
      fetch('/api/auth/session').then((res) => res.json()),
      fetch('/api/charge/balance').then((res) => res.json()),
      fetch('/api/auth/refresh-session').then((res) => res.json()), // 세션 갱신 체크
    ])
      .then(async ([sessionData, balanceData, refreshData]) => {
        if (sessionData.authenticated && sessionData.user) {
          // ★★★ 중복 로그인 감지 시 즉시 로그아웃 ★★★
          if (sessionData.reason === 'DUPLICATE_LOGIN') {
            alert('다른 기기에서 로그인하여 현재 세션이 종료되었습니다.');
            router.push(`/${locale}/login`);
            return;
          }

          // ★★★ 세션 갱신 처리 (Silent Refresh) ★★★
          let currentUser = sessionData.user;
          if (refreshData.success && refreshData.roleChanged) {
            console.log(`🔄 [세션 갱신됨] ${refreshData.oldRole} → ${refreshData.newRole}`);
            currentUser = refreshData.user; // 갱신된 사용자 정보 사용
            
            // ★★★ 강제 페이지 리로드로 UI 즉시 반영 ★★★
            if (refreshData.shouldReload) {
              window.location.reload();
              return;
            }
          }

          setUser({
            ...currentUser,
            coins: balanceData.coins || 0,
          });

          // ★★★ 모든 사용자에 대해 상담사 프로필 상태 확인 ★★★
          const profileRes = await fetch('/api/counselor/profile-status');
          const profileData = await profileRes.json();
          if (profileData.success && profileData.hasProfile) {
            setCounselorProfileStatus(profileData.status);
            setRejectedReason(profileData.rejectedReason || null);
          } else {
            setCounselorProfileStatus(null);
            setRejectedReason(null);
          }
          
          // 상담사인 경우 자동 오프라인 전환
          if (currentUser.role === 'COUNSELOR') {
            console.log('📴 [마이페이지] 상담사 자동 오프라인 전환');
            fetch('/api/counselor/status', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ status: 'offline' }),
            }).catch((err) => {
              console.error('오프라인 전환 실패:', err);
            });
          }
        } else {
          router.push(`/${locale}`);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
        router.push(`/${locale}`);
      });
  }, [router, locale]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push(`/${locale}`);
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  // 상담 시작하기 (메인 페이지와 동일한 로직)
  const handleStartCall = async () => {
    if (!user) {
      alert(t('auth.invalidCredentials'));
      return;
    }

    // 상담사는 통화 시작 불가
    if (user.role === 'COUNSELOR') {
      alert(t('counselor.networkTestRequired'));
      return;
    }

    setIsStartingCall(true);

    try {
      // DB에서 실시간 코인 잔액 조회
      const coinsResponse = await fetch('/api/user/coins', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache',
        },
        credentials: 'include',
      });

      if (coinsResponse.status === 401) {
        alert(t('auth.invalidCredentials'));
        router.push(`/${locale}/login`);
        return;
      }

      const coinsData = await coinsResponse.json();
      const userCoins = coinsData.success ? coinsData.coins : 0;

      // 최소 코인 체크 (28 코인 이상 필요 - 운영 안전성)
      const MIN_COINS_REQUIRED = 28;
      if (userCoins < MIN_COINS_REQUIRED) {
        alert(`${t('home.minCoinsRequired')} (${userCoins} ${t('common.coins')})`);
        router.push(`/${locale}/charge`);
        return;
      }

      // 통화 매칭 시작
      const response = await fetch('/api/call/match', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setCallData({
          callId: data.call.id,
          counselors: data.counselors,
        });
        setIsCalling(true);
      } else {
        alert(data.message || t('call.matchFailed'));
      }
    } catch (error) {
      console.error('통화 시작 오류:', error);
      alert(t('common.error'));
    } finally {
      setIsStartingCall(false);
    }
  };

  const handleCallCancel = () => {
    setIsCalling(false);
    setCallData(null);
    // 통화 종료 후 잔액 새로고침
    fetch('/api/charge/balance')
      .then((res) => res.json())
      .then((balanceData) => {
        if (user) {
          setUser({
            ...user,
            coins: balanceData.coins || 0,
          });
        }
      });
  };

  // ★★★ 역할 한글 변환: gender 기반으로 표시 ★★★
  const getRoleDisplayName = (role: string, gender?: 'MALE' | 'FEMALE' | null) => {
    switch (role) {
      case 'MEMBER':
        // gender가 FEMALE이면 "이용자 (여성)", 아니면 "이용자 (남성)"
        return gender === 'FEMALE' ? '이용자 (여성)' : '이용자 (남성)';
      case 'COUNSELOR':
        return t('auth.counselor');
      case 'ADMIN':
        return 'Admin';
      default:
        return role;
    }
  };

  // ★★★ 역할 이모지: gender 기반으로 표시 ★★★
  const getRoleEmoji = (role: string, gender?: 'MALE' | 'FEMALE' | null) => {
    switch (role) {
      case 'MEMBER':
        // gender가 FEMALE이면 여성 아이콘, 아니면 남성 아이콘
        return gender === 'FEMALE' ? '👩' : '👤';
      case 'COUNSELOR':
        return '👩‍⚕️';
      case 'ADMIN':
        return '👑';
      default:
        return '👤';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // 리다이렉트 중
  }

  return (
    <div className="min-h-screen bg-black">
      {/* 통화 오버레이 */}
      {isCalling && callData && (
        <CallOverlay
          callId={callData.callId}
          counselors={callData.counselors}
          onCancel={handleCallCancel}
        />
      )}

      {/* 헤더 */}
      <header className="container mx-auto px-4 py-6 border-b border-[#D4AF37]/20">
        <div className="flex items-center justify-between">
          <a href={`/${locale}`} className="text-2xl font-bold" style={{ color: '#D4AF37' }}>
            {t('common.siteName')}
          </a>
          <nav className="flex gap-4 items-center">
            <a
              href={`/${locale}`}
              className="text-white/80 hover:text-white transition-colors text-sm"
            >
              {t('nav.home')}
            </a>
          </nav>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#D4AF37' }}>
            {t('mypage.title')}
          </h1>
          <p className="text-gray-400">{t('mypage.premiumCard')}</p>
        </div>

        {/* ★★★ 여성/상담사용 테마: 로즈골드 + 퍼플 톤 적용 ★★★ */}
        {/* 멤버십 카드 */}
        <div
          className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 mb-8 shadow-2xl border-2"
          style={{ 
            borderColor: user.gender === 'FEMALE' || counselorProfileStatus !== null ? '#E8B4B8' : '#D4AF37',
            boxShadow: user.gender === 'FEMALE' || counselorProfileStatus !== null 
              ? '0 0 30px rgba(232, 180, 184, 0.3)' 
              : '0 0 30px rgba(212, 175, 55, 0.2)',
          }}
        >
          {/* 카드 상단 디자인 */}
          <div className="flex items-center justify-between mb-6">
            <div className="text-5xl">{getRoleEmoji(user.role, user.gender)}</div>
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                {t('common.siteName')}
              </div>
              <div 
                className="text-sm font-semibold" 
                style={{ 
                  color: user.gender === 'FEMALE' || counselorProfileStatus !== null ? '#E8B4B8' : '#D4AF37' 
                }}
              >
                {user.gender === 'FEMALE' ? 'Counselor Member' : 'Premium Member'}
              </div>
            </div>
          </div>

          {/* 사용자 정보 */}
          <div className="space-y-6">
            {/* 닉네임/이메일 */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                {t('mypage.emailLabel')}
              </div>
              <div className="text-xl font-semibold text-white">
                {user.email || 'Anonymous'}
              </div>
            </div>

            {/* 역할 */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                {t('mypage.roleLabel')}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div
                  className="inline-block px-4 py-2 rounded-lg font-semibold text-lg"
                  style={{
                    backgroundColor: '#D4AF37',
                    color: '#000000',
                  }}
                >
                  {getRoleEmoji(user.role, user.gender)} {getRoleDisplayName(user.role, user.gender)}
                </div>
                {/* ★★★ 상담사 신청 대기 중 뱃지 ★★★ */}
                {user.role === 'MEMBER' && counselorProfileStatus === 'PENDING' && (
                  <div
                    className="inline-block px-3 py-1 rounded-lg text-xs font-semibold animate-pulse"
                    style={{
                      backgroundColor: '#FFD700',
                      color: '#000000',
                    }}
                  >
                    ⏳ 상담사 승인 대기 중
                  </div>
                )}
                {user.role === 'MEMBER' && counselorProfileStatus === 'REJECTED' && (
                  <div
                    className="inline-block px-3 py-1 rounded-lg text-xs font-semibold"
                    style={{
                      backgroundColor: '#FF6B6B',
                      color: '#FFFFFF',
                    }}
                  >
                    ❌ 신청 거절됨
                  </div>
                )}
              </div>
            </div>

            {/* 코인 잔액 */}
            <div className="pt-4 border-t border-[#D4AF37]/30">
              <div className="flex items-center justify-between mb-4">
                <div>
                  {/* 역할에 따른 명칭 분리 */}
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    {user.role === 'COUNSELOR' ? t('mypage.accumulatedLabel') : t('mypage.coinsLabel')}
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {user.coins?.toLocaleString() || 0}{' '}
                    <span className="text-xl" style={{ color: '#D4AF37' }}>
                      {t('common.coins')}
                    </span>
                  </div>
                  {/* USDT 환산 값 표기 (100코인 = 1 USDT) - 모든 역할에 표시 */}
                  <div className="text-sm text-gray-400 mt-1">
                    {t('mypage.usdtEquivalent', { amount: (((user.coins ?? 0) as number) / 100).toFixed(2) })}
                  </div>
                </div>
                <div className="text-4xl">💰</div>
              </div>

              {/* ★★★ 남성 이용자 전용: 상담 시작하기 버튼 (여성이거나 상담사 신청 이력 있으면 숨김) ★★★ */}
              {user.role === 'MEMBER' && user.gender !== 'FEMALE' && counselorProfileStatus === null && (
                <button
                  onClick={handleStartCall}
                  disabled={isStartingCall}
                  className="block w-full py-4 px-4 rounded-lg font-bold text-black text-lg text-center transition-all transform hover:scale-[1.02] mb-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  style={{
                    background: 'linear-gradient(to right, #ec4899, #f43f5e)',
                    boxShadow: '0 0 20px rgba(236, 72, 153, 0.5)',
                  }}
                >
                  {isStartingCall ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                      {t('call.connecting')}
                    </span>
                  ) : (
                    <>📞 {t('home.startCall')}</>
                  )}
                </button>
              )}

              {/* ★★★ 남성 이용자 전용: 충전하기 버튼 (여성이거나 상담사 신청 이력 있으면 숨김) ★★★ */}
              {user.role === 'MEMBER' && user.gender !== 'FEMALE' && counselorProfileStatus === null && (
                <a
                  href={`/${locale}/charge`}
                  className="block w-full py-3 px-4 rounded-lg font-semibold text-black text-center transition-all transform hover:scale-[1.02] mb-3"
                  style={{ backgroundColor: '#D4AF37' }}
                >
                  {t('mypage.chargeButton')}
                </a>
              )}

              {/* ★★★ 여성 MEMBER 또는 상담사 신청 대기 중: 강화된 안내 UI ★★★ */}
              {user.role === 'MEMBER' && (user.gender === 'FEMALE' || counselorProfileStatus === 'PENDING') && counselorProfileStatus === 'PENDING' && (
                <div
                  className="w-full py-6 px-6 rounded-2xl text-center mb-4"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(232, 180, 184, 0.2) 100%)',
                    border: '2px solid #FFD700',
                    boxShadow: '0 0 25px rgba(255, 215, 0, 0.3)',
                  }}
                >
                  <div className="text-4xl mb-3 animate-bounce">⏳</div>
                  <h3 
                    className="text-xl font-bold mb-2 animate-pulse"
                    style={{ color: '#FFD700' }}
                  >
                    상담사 승인 대기 중입니다
                  </h3>
                  <p className="text-gray-300 text-sm mb-2">
                    관리자의 검토가 진행 중입니다.
                  </p>
                  <p className="text-gray-400 text-xs">
                    ✨ 승인 후에는 전화를 받아 코인을 벌 수 있습니다
                  </p>
                </div>
              )}

              {/* ★★★ 여성 MEMBER + 신청 완료(APPROVED): 대시보드 이동 버튼 ★★★ */}
              {user.role === 'MEMBER' && counselorProfileStatus === 'APPROVED' && (
                <a
                  // href={`/${locale}/counselor/dashboard`}
                  className="block w-full py-4 px-4 rounded-lg font-bold text-white text-lg text-center transition-all transform hover:scale-[1.02] mb-3"
                  style={{
                    background: 'linear-gradient(135deg, #E8B4B8 0%, #9B59B6 100%)',
                    boxShadow: '0 0 25px rgba(155, 89, 182, 0.5)',
                  }}
                >
                  📞 대시보드로 가기
                </a>
              )}

              {/* ★★★ 여성 MEMBER + 신청 이력 없음: 신청 유도 ★★★ */}
              {user.role === 'MEMBER' && user.gender === 'FEMALE' && counselorProfileStatus === null && (
                <div
                  className="w-full py-6 px-6 rounded-2xl text-center mb-4"
                  style={{
                    background: 'linear-gradient(135deg, rgba(232, 180, 184, 0.2) 0%, rgba(155, 89, 182, 0.2) 100%)',
                    border: '2px solid #E8B4B8',
                  }}
                >
                  <div className="text-3xl mb-3">💎</div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: '#E8B4B8' }}>
                    상담사로 활동해보세요
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    감성 상담으로 코인을 벌고 정산받을 수 있습니다
                  </p>
                  <a
                    href={`/${locale}/counselors/apply`}
                    className="inline-block px-6 py-3 rounded-lg font-semibold text-black transition-all transform hover:scale-105"
                    style={{
                      background: 'linear-gradient(135deg, #E8B4B8 0%, #D4AF37 100%)',
                      boxShadow: '0 0 15px rgba(232, 180, 184, 0.4)',
                    }}
                  >
                    상담사 신청하기
                  </a>
                </div>
              )}

              {/* ★★★ 여성 MEMBER + 거절됨: 재신청 유도 ★★★ */}
              {user.role === 'MEMBER' && counselorProfileStatus === 'REJECTED' && (
                <div
                  className="w-full py-6 px-6 rounded-2xl text-center mb-4"
                  style={{
                    background: 'rgba(255, 107, 107, 0.1)',
                    border: '2px solid #FF6B6B',
                  }}
                >
                  <div className="text-3xl mb-3">😔</div>
                  <h3 className="text-lg font-bold mb-2 text-red-400">
                    신청이 거절되었습니다
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    다른 조건으로 재신청해주세요
                  </p>
                  <a
                    href={`/${locale}/counselors/apply`}
                    className="inline-block px-6 py-3 rounded-lg font-semibold text-black transition-all transform hover:scale-105"
                    style={{
                      background: '#D4AF37',
                    }}
                  >
                    재신청하기
                  </a>
                </div>
              )}

              {/* ★★★ COUNSELOR 전용: 로즈골드/퍼플 테마 버튼들 ★★★ */}
              {user.role === 'COUNSELOR' && (
                <>
                  {/* 대시보드 버튼 (승인된 경우) */}
                  {counselorProfileStatus === 'APPROVED' && (
                    <a
                      // href={`/${locale}/counselor/dashboard`}
                      className="block w-full py-4 px-4 rounded-lg font-bold text-white text-lg text-center transition-all transform hover:scale-[1.02] mb-3"
                      style={{
                        background: 'linear-gradient(135deg, #E8B4B8 0%, #9B59B6 100%)',
                        boxShadow: '0 0 25px rgba(155, 89, 182, 0.5)',
                      }}
                    >
                      📞 {t('mypage.dashboardButton')}
                    </a>
                  )}
                  
                  {/* 수익 정산 페이지 버튼 (승인된 경우) */}
                  {counselorProfileStatus === 'APPROVED' && (
                    <a
                      href={`/${locale}/mypage/payout`}
                      className="block w-full py-3 px-4 rounded-lg font-semibold text-black text-center transition-all transform hover:scale-[1.02] mb-3"
                      style={{ 
                        background: 'linear-gradient(135deg, #E8B4B8 0%, #9B59B6 100%)',
                      }}
                    >
                      💎 수익 정산
                    </a>
                  )}
                  
                  {/* 승인 대기 중 (COUNSELOR + PENDING) */}
                  {counselorProfileStatus === 'PENDING' && (
                    <div
                      className="w-full py-6 px-6 rounded-2xl text-center mb-4"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(232, 180, 184, 0.2) 100%)',
                        border: '2px solid #FFD700',
                        boxShadow: '0 0 25px rgba(255, 215, 0, 0.3)',
                      }}
                    >
                      <div className="text-4xl mb-3 animate-bounce">⏳</div>
                      <h3 
                        className="text-xl font-bold mb-2 animate-pulse"
                        style={{ color: '#FFD700' }}
                      >
                        상담사 승인 대기 중입니다
                      </h3>
                      <p className="text-gray-300 text-sm mb-2">
                        관리자의 검토가 진행 중입니다.
                      </p>
                      <p className="text-gray-400 text-xs">
                        ✨ 승인 후에는 전화를 받아 코인을 벌 수 있습니다
                      </p>
                    </div>
                  )}
                  
                  {/* 거절됨 - 거절 사유 UI 강화 */}
                  {counselorProfileStatus === 'REJECTED' && (
                    <>
                      {/* 주요 알림 박스 */}
                      <div
                        className="w-full py-6 px-6 rounded-2xl text-center mb-4"
                        style={{
                          background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.15) 0%, rgba(255, 107, 107, 0.05) 100%)',
                          border: '2px solid #FF6B6B',
                          boxShadow: '0 0 20px rgba(255, 107, 107, 0.2)',
                        }}
                      >
                        <div className="text-4xl mb-3">😔</div>
                        <h3 className="text-xl font-bold mb-2 text-red-400">
                          신청이 거절되었습니다
                        </h3>
                        <p className="text-gray-400 text-sm mb-4">
                          관리자 검토 결과 신청이 거절되었습니다.
                        </p>
                      </div>

                      {/* 거절 사유 Warning Box */}
                      {rejectedReason && (
                        <div
                          className="w-full py-5 px-5 rounded-2xl mb-4 animate-pulse"
                          style={{
                            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)',
                            border: '2px solid #F59E0B',
                            boxShadow: '0 0 15px rgba(245, 158, 11, 0.3)',
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-3xl">⚠️</span>
                            <div className="flex-1 text-left">
                              <h4 className="text-lg font-bold text-amber-400 mb-2">
                                거절 사유
                              </h4>
                              <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
                                {rejectedReason}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 재신청 안내 */}
                      <div className="mb-4">
                        <a
                          href={`/${locale}/counselors/apply`}
                          className="inline-block px-6 py-3 rounded-lg font-semibold text-black transition-all transform hover:scale-105"
                          style={{
                            background: '#D4AF37',
                          }}
                        >
                          재신청하기
                        </a>
                      </div>
                    </>
                  )}
                  
                  {/* 프로필 없음 */}
                  {counselorProfileStatus === null && (
                    <div
                      className="w-full py-6 px-6 rounded-2xl text-center mb-4"
                      style={{
                        background: 'linear-gradient(135deg, rgba(232, 180, 184, 0.2) 0%, rgba(155, 89, 182, 0.2) 100%)',
                        border: '2px solid #E8B4B8',
                      }}
                    >
                      <div className="text-3xl mb-3">📝</div>
                      <h3 className="text-lg font-bold mb-2" style={{ color: '#E8B4B8' }}>
                        상담사 신청이 필요합니다
                      </h3>
                      <p className="text-gray-400 text-sm mb-4">
                        프로필을 작성하고 승인받으세요
                      </p>
                      <a
                        href={`/${locale}/counselors/apply`}
                        className="inline-block px-6 py-3 rounded-lg font-semibold text-black transition-all transform hover:scale-105"
                        style={{
                          background: 'linear-gradient(135deg, #E8B4B8 0%, #D4AF37 100%)',
                          boxShadow: '0 0 15px rgba(232, 180, 184, 0.4)',
                        }}
                      >
                        상담사 신청하기
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* 로그아웃 버튼 */}
        <div className="text-center">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="px-8 py-3 rounded-lg font-semibold text-black transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            style={{
              backgroundColor: isLoggingOut ? '#B8941F' : '#D4AF37',
            }}
          >
            {isLoggingOut ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                {t('common.loading')}
              </span>
            ) : (
              t('mypage.logoutButton')
            )}
          </button>
        </div>

        {/* 하단 안내 */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-xs">
            Your data is encrypted and safely stored
          </p>
        </div>
      </main>
    </div>
  );
}

