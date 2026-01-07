'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Header from '../components/Header';
import CallOverlay from '../components/CallOverlay';

// 지역 필터 옵션 (lib/regions.ts 기반)
const REGION_OPTIONS = [
  { value: '', key: 'allRegions' },
  { value: 'SEA', key: 'SEA' },
  { value: 'EAST_ASIA', key: 'EAST_ASIA' },
  { value: 'EUROPE', key: 'EUROPE' },
  { value: 'AMERICAS', key: 'AMERICAS' },
  { value: 'AFRICA', key: 'AFRICA' },
] as const;

export default function Home() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;
  
  const [isCalling, setIsCalling] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [preferredRegion, setPreferredRegion] = useState<string>('');
  const [onlineCounselorsCount, setOnlineCounselorsCount] = useState<number>(0);
  const [callData, setCallData] = useState<{
    callId: string;
    counselors: Array<{ id: string; name: string }>;
  } | null>(null);

  // 온라인 상담사 수 조회
  useEffect(() => {
    const fetchOnlineCounselors = async () => {
      try {
        const response = await fetch('/api/counselors/online-count');
        const data = await response.json();
        if (data.success) {
          setOnlineCounselorsCount(data.count);
        }
      } catch (error) {
        console.log('온라인 상담사 수 조회 실패');
      }
    };

    fetchOnlineCounselors();
    // 30초마다 갱신
    const interval = setInterval(fetchOnlineCounselors, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleStartCall = async () => {
    // 매칭 애니메이션 시작
    setIsMatching(true);

    try {
      // 1. 세션 확인
      const balanceResponse = await fetch('/api/auth/session', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache',
        },
        credentials: 'include',
      });

      if (balanceResponse.status === 401) {
        setIsMatching(false);
        alert(t('auth.invalidCredentials'));
        window.location.href = `/${locale}/login`;
        return;
      }

      const balanceData = await balanceResponse.json();
      
      if (!balanceData.authenticated) {
        setIsMatching(false);
        alert(t('auth.invalidCredentials'));
        window.location.href = `/${locale}/login`;
        return;
      }

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
        setIsMatching(false);
        alert(t('auth.invalidCredentials'));
        window.location.href = `/${locale}/login`;
        return;
      }

      const coinsData = await coinsResponse.json();
      
      if (!coinsData.success) {
        setIsMatching(false);
        alert(coinsData.message || t('common.error'));
        return;
      }
      
      const userCoins = coinsData.coins || 0;

      // 최소 코인 체크 (28코인 이상 필요 - 운영 안전성)
      const MIN_COINS_REQUIRED = 28;
      if (userCoins < MIN_COINS_REQUIRED) {
        setIsMatching(false);
        alert(`${t('home.minCoinsRequired')} (${userCoins} ${t('common.coins')})`);
        return;
      }

      // 2~3초 매칭 애니메이션 대기
      await new Promise(resolve => setTimeout(resolve, 2500));

      // 통화 매칭 시작
      const response = await fetch('/api/call/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache',
        },
        credentials: 'include',
        body: JSON.stringify({
          preferredRegion: preferredRegion || null,
        }),
      });

      if (response.status === 401) {
        setIsMatching(false);
        alert(t('auth.invalidCredentials'));
        window.location.href = `/${locale}/login`;
        return;
      }

      const data = await response.json();

      if (data.success) {
        setCallData({
          callId: data.call.id,
          counselors: data.counselors,
        });
        setIsMatching(false);
        setIsCalling(true);
      } else {
        setIsMatching(false);
        alert(data.message || t('call.matchFailed'));
      }
    } catch (error: any) {
      setIsMatching(false);
      console.error('❌ [통화 시작] 예상치 못한 오류:', error?.message || error);
      alert(t('common.error'));
    }
  };

  const handleCancelCall = () => {
    setIsCalling(false);
    setCallData(null);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0B0B0B' }}>
      {/* 배경 그라디언트 오버레이 */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(212, 175, 55, 0.08) 0%, transparent 40%)',
        }}
      />

      {/* 헤더 */}
      <Header />

      {/* 메인 히어로 섹션 */}
      <main className="relative container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          
          {/* 프리미엄 뱃지 */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8" style={{ backgroundColor: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#D4AF37' }}></span>
            <span className="text-sm font-medium" style={{ color: '#D4AF37' }}>Premium Anonymous Service</span>
          </div>

          {/* 메인 타이틀 */}
          <h1 
            className="text-6xl md:text-7xl font-bold mb-4 tracking-tight"
            style={{ 
              background: 'linear-gradient(135deg, #D4AF37 0%, #F4E4BA 50%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 60px rgba(212, 175, 55, 0.3)',
            }}
          >
            {t('home.title')}
          </h1>
          
          <p className="text-xl md:text-2xl text-white/60 mb-4 font-light tracking-wide">
            {t('home.subtitle')}
          </p>
          
          <p className="text-lg text-white/40 mb-12 max-w-2xl mx-auto leading-relaxed">
            {t('home.description')}
          </p>

          {/* 신뢰 지표 */}
          <div className="flex flex-wrap justify-center gap-8 mb-16">
            <div className="flex items-center gap-2 text-white/50">
              <span className="text-xl">🔒</span>
              <span className="text-sm">{t('home.anonymous')}</span>
            </div>
            <div className="flex items-center gap-2 text-white/50">
              <span className="text-xl">💎</span>
              <span className="text-sm">{t('home.encrypted')}</span>
            </div>
            <div className="flex items-center gap-2 text-white/50">
              <span className="text-xl">👁️‍🗨️</span>
              <span className="text-sm">{t('home.noTrace')}</span>
            </div>
          </div>

          {/* 실시간 대기 상담사 수 */}
          <div 
            className="inline-block mb-12 px-8 py-6 rounded-3xl"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(212, 175, 55, 0.05) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              boxShadow: '0 0 40px rgba(139, 92, 246, 0.1)',
            }}
          >
            <p className="text-white/60 text-sm mb-2">{t('home.availableCounselors')}</p>
            <div className="flex items-baseline justify-center gap-2">
              <span 
                className="text-5xl font-bold tabular-nums"
                style={{ 
                  background: 'linear-gradient(135deg, #8B5CF6 0%, #D4AF37 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {onlineCounselorsCount.toString().padStart(2, '0')}
              </span>
              <span className="text-xl text-white/60">{t('home.counselorUnit')}</span>
            </div>
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-xs text-green-400/80">Live</span>
            </div>
          </div>

          {/* 지역 필터 */}
          <div className="mb-10">
            <p className="text-white/40 text-sm mb-4">{t('home.regionFilter')}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {REGION_OPTIONS.map((region) => (
                <button
                  key={region.value || 'all'}
                  onClick={() => setPreferredRegion(region.value)}
                  className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                    preferredRegion === region.value
                      ? 'scale-105'
                      : 'hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: preferredRegion === region.value 
                      ? 'rgba(139, 92, 246, 0.3)' 
                      : 'rgba(255, 255, 255, 0.05)',
                    border: preferredRegion === region.value 
                      ? '1px solid rgba(139, 92, 246, 0.5)' 
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    color: preferredRegion === region.value 
                      ? '#C4B5FD' 
                      : 'rgba(255, 255, 255, 0.6)',
                    boxShadow: preferredRegion === region.value 
                      ? '0 0 20px rgba(139, 92, 246, 0.3)' 
                      : 'none',
                  }}
                >
                  {t(`home.${region.key}`)}
                </button>
              ))}
            </div>
          </div>

          {/* CTA 버튼 */}
          <div className="mb-20">
            <button
              onClick={handleStartCall}
              disabled={isMatching}
              className="group relative px-12 py-5 text-xl font-bold rounded-full transition-all duration-500 transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                background: 'linear-gradient(135deg, #D4AF37 0%, #8B5CF6 100%)',
                boxShadow: '0 0 40px rgba(212, 175, 55, 0.4), 0 0 80px rgba(139, 92, 246, 0.2)',
              }}
            >
              <span className="relative z-10 text-black">{t('home.connectNow')}</span>
              <div 
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: 'linear-gradient(135deg, #F4E4BA 0%, #A78BFA 100%)',
                }}
              />
            </button>
            <p className="mt-4 text-white/30 text-sm">{t('home.priceInfo')}</p>
          </div>

          {/* 서비스 특징 */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <div 
              className="p-8 rounded-3xl transition-all duration-300 hover:scale-105"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div className="text-4xl mb-4 opacity-80">🔐</div>
              <h3 className="text-lg font-semibold text-white/90 mb-2">{t('home.step1Title')}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{t('home.step1Desc')}</p>
            </div>
            <div 
              className="p-8 rounded-3xl transition-all duration-300 hover:scale-105"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div className="text-4xl mb-4 opacity-80">💎</div>
              <h3 className="text-lg font-semibold text-white/90 mb-2">{t('home.step2Title')}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{t('home.step2Desc')}</p>
            </div>
            <div 
              className="p-8 rounded-3xl transition-all duration-300 hover:scale-105"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div className="text-4xl mb-4 opacity-80">⚡</div>
              <h3 className="text-lg font-semibold text-white/90 mb-2">{t('home.step3Title')}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{t('home.step3Desc')}</p>
            </div>
          </div>

          {/* 하단 태그라인 */}
          <div className="text-center">
            <p 
              className="text-lg font-light tracking-widest"
              style={{ color: 'rgba(212, 175, 55, 0.5)' }}
            >
              {t('home.tagline')}
            </p>
          </div>
        </div>
      </main>

      {/* 매칭 애니메이션 오버레이 */}
      {isMatching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(11, 11, 11, 0.95)' }}>
          <div className="text-center px-8">
            {/* 펄스 애니메이션 원 */}
            <div className="relative w-40 h-40 mx-auto mb-10">
              {/* 외곽 펄스 */}
              <div 
                className="absolute inset-0 rounded-full animate-ping"
                style={{ 
                  background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
                  animationDuration: '2s',
                }}
              />
              <div 
                className="absolute inset-4 rounded-full animate-ping"
                style={{ 
                  background: 'radial-gradient(circle, rgba(212, 175, 55, 0.3) 0%, transparent 70%)',
                  animationDuration: '2s',
                  animationDelay: '0.5s',
                }}
              />
              {/* 중앙 아이콘 */}
              <div 
                className="absolute inset-8 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(212, 175, 55, 0.2) 100%)',
                  border: '2px solid rgba(212, 175, 55, 0.3)',
                }}
              >
                <span className="text-5xl animate-pulse">✨</span>
              </div>
            </div>
            
            <h2 
              className="text-2xl md:text-3xl font-medium mb-4"
              style={{ 
                background: 'linear-gradient(135deg, #D4AF37 0%, #8B5CF6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {t('home.matchingTitle')}
            </h2>
            <p className="text-white/40 text-lg">
              {t('home.matchingSubtitle')}
            </p>
            
            {/* 로딩 도트 */}
            <div className="flex justify-center gap-2 mt-8">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{
                    backgroundColor: '#D4AF37',
                    animationDelay: `${i * 0.2}s`,
                    animationDuration: '1s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CallOverlay - 통화 중일 때만 표시 */}
      {isCalling && callData && (
        <CallOverlay
          callId={callData.callId}
          counselors={callData.counselors}
          onCancel={handleCancelCall}
        />
      )}

      {/* 푸터 */}
      <footer className="relative container mx-auto px-4 py-8 mt-16 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}>
        <div className="max-w-4xl mx-auto text-center text-white/30 text-sm">
          <p>{t('footer.copyright')}</p>
          <div className="mt-4 flex justify-center gap-6">
            <a href={`/${locale}/terms`} className="hover:text-white/50 transition-colors">{t('footer.terms')}</a>
            <a href={`/${locale}/privacy`} className="hover:text-white/50 transition-colors">{t('footer.privacy')}</a>
            <a href={`/${locale}/contact`} className="hover:text-white/50 transition-colors">{t('footer.support')}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
