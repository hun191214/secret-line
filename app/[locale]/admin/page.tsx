'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';

interface StatsData {
  todayRevenue: {
    payments: number;
    settlements: number;
    total: number;
  };
  activeCalls: {
    count: number;
    users: number;
    counselors: number;
  };
  pendingRequests: number;
  newUsersToday: number;
}

interface AdminSession {
  adminRole: 'OPERATOR' | 'FINANCE' | 'SUPER' | null;
}

export default function AdminDashboardPage() {
  const params = useParams();
  const locale = params.locale as string;
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [session, setSession] = useState<AdminSession>({ adminRole: null });

  // 세션 가져오기
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        if (data.success && data.user) {
          setSession({ adminRole: data.user.adminRole || 'SUPER' });
        }
      } catch (error) {
        console.error('세션 조회 실패:', error);
      }
    };
    fetchSession();
  }, []);

  // 통계 데이터 가져오기
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
        setLastUpdated(new Date(data.updatedAt));
      }
    } catch (error) {
      console.error('통계 데이터 조회 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 초기 로드 및 30초마다 자동 갱신
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, [fetchStats]);

  // 역할별 메뉴 아이템
  const getMenuItems = () => {
    const allMenuItems = [
      {
        id: 'users',
        label: '유저 관리',
        description: '일반 회원과 상담사의 전체 목록을 확인하고 관리합니다.',
        path: `/${locale}/admin/users`,
        emoji: '👥',
        color: '#3B82F6',
        allowedRoles: ['OPERATOR', 'SUPER'],
      },
      {
        id: 'counselors',
        label: '상담사 관리',
        description: '상담사 정보, 상태, 지역을 확인하고 관리합니다.',
        path: `/${locale}/admin/counselors`,
        emoji: '👔',
        color: '#8B5CF6',
        allowedRoles: ['OPERATOR', 'SUPER'],
      },
      {
        id: 'requests',
        label: '신청 관리',
        description: '상담사 신청을 검토하고 승인/거절합니다.',
        path: `/${locale}/admin/requests`,
        emoji: '📝',
        color: '#10B981',
        allowedRoles: ['OPERATOR', 'SUPER'],
      },
      {
        id: 'payouts',
        label: '정산 관리',
        description: '출금 신청을 확인하고 승인합니다.',
        path: `/${locale}/admin/payouts`,
        emoji: '💰',
        color: '#F59E0B',
        allowedRoles: ['FINANCE', 'SUPER'],
      },
    ];

    return allMenuItems.filter((item) => {
      if (session.adminRole === 'SUPER') return true;
      return item.allowedRoles.includes(session.adminRole as string);
    });
  };

  const menuItems = getMenuItems();

  // 통계 카드 컴포넌트
  const StatCard = ({
    title,
    value,
    subValue,
    emoji,
    color,
    isLive = false,
  }: {
    title: string;
    value: string | number;
    subValue?: string;
    emoji: string;
    color: string;
    isLive?: boolean;
  }) => (
    <div
      className="relative overflow-hidden rounded-2xl p-6 transition-all hover:scale-[1.02] hover:shadow-xl"
      style={{
        background: `linear-gradient(135deg, rgba(${hexToRgb(color)}, 0.15) 0%, rgba(${hexToRgb(color)}, 0.05) 100%)`,
        border: `2px solid rgba(${hexToRgb(color)}, 0.3)`,
      }}
    >
      {isLive && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <span className="relative flex h-3 w-3">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: color }}
            />
            <span
              className="relative inline-flex rounded-full h-3 w-3"
              style={{ backgroundColor: color }}
            />
          </span>
          <span className="text-xs font-medium" style={{ color }}>
            LIVE
          </span>
        </div>
      )}
      <div className="flex items-center gap-4">
        <div
          className="text-4xl p-3 rounded-xl"
          style={{
            background: `rgba(${hexToRgb(color)}, 0.2)`,
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
          }}
        >
          {emoji}
        </div>
        <div className="flex-1">
          <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
          <p
            className="text-3xl font-bold"
            style={{ color }}
          >
            {value}
          </p>
          {subValue && (
            <p className="text-gray-500 text-xs mt-1">{subValue}</p>
          )}
        </div>
      </div>
      <div
        className="absolute bottom-0 right-0 w-24 h-24 rounded-full opacity-10"
        style={{
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          transform: 'translate(30%, 30%)',
        }}
      />
    </div>
  );

  // HEX를 RGB로 변환
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '255, 255, 255';
  };

  // 금액 포맷팅
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* 헤더 */}
        <div className="text-center mb-10">
          <h1
            className="text-4xl font-bold mb-3"
            style={{ color: '#D4AF37' }}
          >
            📊 실시간 비즈니스 대시보드
          </h1>
          <p className="text-gray-400 text-base">
            서비스의 핵심 지표를 실시간으로 모니터링하세요
          </p>
          {lastUpdated && (
            <p className="text-gray-500 text-xs mt-2">
              마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')} (30초마다 자동 갱신)
            </p>
          )}
        </div>

        {/* 통계 카드 그리드 */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-40 rounded-2xl animate-pulse"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {/* 오늘의 총수익 */}
            <StatCard
              title="💰 오늘의 총수익"
              value={formatCurrency(stats.todayRevenue.total)}
              subValue={`결제 ${formatCurrency(stats.todayRevenue.payments)} / 정산 ${formatCurrency(stats.todayRevenue.settlements)}`}
              emoji="💰"
              color="#22C55E"
            />

            {/* 실시간 통화 */}
            <StatCard
              title="📡 실시간 통화"
              value={`${stats.activeCalls.count}건`}
              subValue={`유저 ${stats.activeCalls.users}명 / 상담사 ${stats.activeCalls.counselors}명`}
              emoji="📡"
              color="#3B82F6"
              isLive={stats.activeCalls.count > 0}
            />

            {/* 미처리 신청 */}
            <StatCard
              title="📋 미처리 신청"
              value={`${stats.pendingRequests}건`}
              subValue="상담사 신청 대기 중"
              emoji="📋"
              color={stats.pendingRequests > 0 ? '#EF4444' : '#6B7280'}
            />

            {/* 신규 가입자 */}
            <StatCard
              title="🆕 금일 신규 가입"
              value={`${stats.newUsersToday}명`}
              subValue="오늘 새로 가입한 회원"
              emoji="🆕"
              color="#A855F7"
            />
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400">
            통계 데이터를 불러올 수 없습니다.
          </div>
        )}

        {/* 미처리 신청 알림 배너 */}
        {stats && stats.pendingRequests > 0 && (session.adminRole === 'SUPER' || session.adminRole === 'OPERATOR') && (
          <Link
            href={`/${locale}/admin/requests`}
            className="block mb-10 p-4 rounded-xl transition-all hover:scale-[1.01]"
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)',
              border: '2px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-white font-semibold">
                    미처리 상담사 신청 {stats.pendingRequests}건이 대기 중입니다
                  </p>
                  <p className="text-gray-400 text-sm">
                    클릭하여 신청을 검토하세요
                  </p>
                </div>
              </div>
              <span className="text-2xl">→</span>
            </div>
          </Link>
        )}

        {/* 메뉴 그리드 */}
        <h2
          className="text-xl font-bold mb-6"
          style={{ color: '#D4AF37' }}
        >
          🛠️ 관리 메뉴
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {menuItems.map((item) => (
            <Link
              key={item.id}
              href={item.path}
              className="group relative overflow-hidden rounded-2xl p-8 transition-all transform hover:scale-105 hover:shadow-2xl"
              style={{
                background: `linear-gradient(135deg, rgba(${hexToRgb(item.color)}, 0.1) 0%, rgba(${hexToRgb(item.color)}, 0.05) 100%)`,
                border: `2px solid rgba(${hexToRgb(item.color)}, 0.3)`,
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="text-5xl transition-transform group-hover:scale-110"
                  style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}
                >
                  {item.emoji}
                </div>
                <div className="flex-1">
                  <h3
                    className="text-2xl font-bold mb-2 transition-colors"
                    style={{ color: item.color }}
                  >
                    {item.label}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
              <div
                className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 group-hover:opacity-20 transition-opacity"
                style={{
                  background: `radial-gradient(circle, ${item.color} 0%, transparent 70%)`,
                  transform: 'translate(30%, -30%)',
                }}
              />
            </Link>
          ))}
        </div>

        {/* 빠른 정보 */}
        <div
          className="mt-10 p-6 rounded-2xl"
          style={{
            background: 'rgba(212, 175, 55, 0.05)',
            border: '1px solid rgba(212, 175, 55, 0.2)',
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: '#D4AF37' }}>
            💡 빠른 안내
          </h3>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li>
              • <strong className="text-white">실시간 지표</strong>: 대시보드는 30초마다 자동으로 갱신됩니다
            </li>
            <li>
              • <strong className="text-white">보안 정책</strong>: 30분간 활동이 없으면 자동 로그아웃됩니다
            </li>
            <li>
              • <strong className="text-white">권한 관리</strong>: 귀하의 역할에 따라 접근 가능한 메뉴가 다릅니다
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
