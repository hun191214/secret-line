'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminAutoLogout from '@/app/components/AdminAutoLogout';
import { ReactNode } from 'react';

type AdminRole = 'OPERATOR' | 'FINANCE' | 'SUPER' | null;

interface MenuItem {
  id: string;
  label: string;
  path: string;
  emoji: string;
  allowedRoles: AdminRole[];
}

interface AdminLayoutShellProps {
  children: ReactNode;
  locale: string;
  adminRole: AdminRole;
}

export default function AdminLayoutShell({
  children,
  locale,
  adminRole,
}: AdminLayoutShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const allMenuItems: MenuItem[] = [
    {
      id: 'users',
      label: '👥 유저 관리',
      path: `/${locale}/admin/users`,
      emoji: '👥',
      allowedRoles: ['OPERATOR', 'SUPER'],
    },
    {
      id: 'counselors',
      label: '👔 상담사 관리',
      path: `/${locale}/admin/counselors`,
      emoji: '👔',
      allowedRoles: ['OPERATOR', 'SUPER'],
    },
    {
      id: 'requests',
      label: '📝 신청 관리',
      path: `/${locale}/admin/requests`,
      emoji: '📝',
      allowedRoles: ['OPERATOR', 'SUPER'],
    },
    {
      id: 'payouts',
      label: '💰 정산 관리',
      path: `/${locale}/admin/payouts`,
      emoji: '💰',
      allowedRoles: ['FINANCE', 'SUPER'],
    },
  ];

  const menuItems = allMenuItems.filter((item) => {
    if (adminRole === 'SUPER') return true;
    return item.allowedRoles.includes(adminRole);
  });

  const isActive = (path: string) => pathname === path;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push(`/${locale}/login`);
    } catch (error) {
      console.error('로그아웃 실패:', error);
      alert('로그아웃 중 오류가 발생했습니다.');
    }
  };

  const getRoleLabel = (role: AdminRole) => {
    switch (role) {
      case 'SUPER':
        return '👑 최고관리자';
      case 'OPERATOR':
        return '🛠️ 운영자';
      case 'FINANCE':
        return '💵 재무관리자';
      default:
        return '관리자';
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#0B0B0B' }}>
      {/* 자동 로그아웃 컴포넌트 */}
      <AdminAutoLogout />

      {/* 관리자 전용 헤더 */}
      <div
        className="w-full border-b"
        style={{
          background:
            'linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(15, 15, 15, 0.95) 100%)',
          borderColor: '#D4AF37',
          boxShadow: '0 2px 10px rgba(212, 175, 55, 0.1)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 상단 바 */}
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href={`/${locale}/admin`}
                className="text-2xl font-bold transition-all hover:scale-105"
                style={{ color: '#D4AF37' }}
              >
                🔐 관리자 대시보드
              </Link>
              <Link
                href={`/${locale}/admin`}
                className="px-3 py-1.5 text-sm rounded-lg transition-all hover:scale-105"
                style={{
                  background: 'rgba(212, 175, 55, 0.1)',
                  color: '#D4AF37',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                }}
              >
                🏠 메인으로
              </Link>
            </div>

            {/* 우측: 역할 표시 및 로그아웃 */}
            <div className="flex items-center gap-4">
              {adminRole && (
                <span
                  className="px-3 py-1 text-xs rounded-full font-medium"
                  style={{
                    background: 'rgba(212, 175, 55, 0.15)',
                    color: '#D4AF37',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                  }}
                >
                  {getRoleLabel(adminRole)}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                  color: '#FFF',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                }}
              >
                🚪 로그아웃
              </button>
            </div>
          </div>

          {/* 네비게이션 메뉴 */}
          <div className="flex items-center gap-2 pb-3 overflow-x-auto">
            {menuItems.map((item) => (
              <Link
                key={item.id}
                href={item.path}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
                  isActive(item.path)
                    ? 'scale-105 shadow-lg'
                    : 'hover:scale-105 opacity-80 hover:opacity-100'
                }`}
                style={
                  isActive(item.path)
                    ? {
                        background:
                          'linear-gradient(135deg, #D4AF37 0%, #B8941F 100%)',
                        color: '#000',
                        boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)',
                      }
                    : {
                        background: 'rgba(212, 175, 55, 0.1)',
                        color: '#D4AF37',
                        border: '1px solid rgba(212, 175, 55, 0.2)',
                      }
                }
              >
                {item.emoji} {item.label.split(' ')[1]}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 컨텐츠 영역 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
}


