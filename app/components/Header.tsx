'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { locales, localeNames, localeFlags, type Locale } from '@/lib/i18n';

interface User {
  email: string;
  role: string;
  userId?: string;
}

interface CounselorProfile {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
}

export default function Header() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'ko';
  const t = useTranslations();
  
  const [user, setUser] = useState<User | null>(null);
  const [counselorProfile, setCounselorProfile] = useState<CounselorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLangMenu, setShowLangMenu] = useState(false);

  useEffect(() => {
    // 세션 확인 및 상담사 프로필 상태 확인
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setUser(data.user);
          
          // 상담사인 경우 프로필 상태 확인
          if (data.user.role === 'COUNSELOR') {
            fetch('/api/counselor/profile-status')
              .then((res) => res.json())
              .then((profileData) => {
                if (profileData.success) {
                  setCounselorProfile({
                    status: profileData.hasProfile ? profileData.status : null,
                  });
                }
              })
              .catch(() => {
                // 무시
              });
          }
        }
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push(`/${locale}`);
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleLanguageChange = (newLocale: string) => {
    // 현재 경로에서 locale 부분만 교체
    const currentPath = window.location.pathname;
    const pathWithoutLocale = currentPath.replace(`/${locale}`, '');
    const newPath = `/${newLocale}${pathWithoutLocale || ''}`;
    router.push(newPath);
    setShowLangMenu(false);
  };

  return (
    <header className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between">
        <a 
          href={`/${locale}`} 
          className="text-2xl font-bold"
          style={{
            background: 'linear-gradient(135deg, #D4AF37 0%, #F4E4BA 50%, #D4AF37 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {t('common.siteName')}
        </a>
        <nav className="flex gap-4 items-center">
          {/* 언어 선택 드롭다운 */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <span>{localeFlags[locale as Locale] || '🌐'}</span>
              <span className="hidden sm:inline">{localeNames[locale as Locale] || locale}</span>
              <span className="text-xs">▼</span>
            </button>
            
            {showLangMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
                {locales.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => handleLanguageChange(loc)}
                    className={`w-full px-4 py-2 text-left hover:bg-white/10 transition-colors flex items-center gap-2 ${
                      loc === locale ? 'bg-white/5 text-[#D4AF37]' : 'text-white'
                    } ${loc === locales[0] ? 'rounded-t-lg' : ''} ${loc === locales[locales.length - 1] ? 'rounded-b-lg' : ''}`}
                  >
                    <span>{localeFlags[loc]}</span>
                    <span>{localeNames[loc]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="w-20 h-8 bg-white/10 rounded-lg animate-pulse"></div>
          ) : user ? (
            <>
              <span className="text-white/80 text-sm hidden sm:inline">
                {user.email}
              </span>
              <a
                href={`/${locale}/mypage`}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                {t('nav.mypage')}
              </a>
              {/* ★★★ 승인된 상담사만 대시보드 메뉴 표시 ★★★ */}
              {user.role === 'COUNSELOR' && counselorProfile?.status === 'APPROVED' && (
                <a
                  href={`/${locale}/counselor/dashboard`}
                  className="px-4 py-2 rounded-lg font-semibold text-black transition-all transform hover:scale-105"
                  style={{
                    backgroundColor: '#D4AF37',
                    boxShadow: '0 0 15px rgba(212, 175, 55, 0.4)',
                  }}
                >
                  {t('nav.dashboard')}
                </a>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              <a
                href={`/${locale}/login`}
                className="text-white/80 hover:text-white transition-colors"
              >
                {t('nav.login')}
              </a>
              <a
                href={`/${locale}/register`}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                {t('nav.register')}
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
