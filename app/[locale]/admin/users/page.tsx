'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getCountryFlag, getCountryName } from '@/lib/country';

interface User {
  id: string;
  email: string | null;
  name: string | null;
  nickname: string | null;
  displayName: string | null;
  role: 'MEMBER' | 'COUNSELOR' | 'ADMIN';
  adminRole: 'OPERATOR' | 'FINANCE' | 'SUPER' | null;
  gender: 'MALE' | 'FEMALE' | null;
  coins: number;
  status: 'ONLINE' | 'OFFLINE' | null;
  counselorStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  country: string | null;
  createdAt: string;
}

interface Stats {
  totalMembers: number;
  totalCounselors: number;
  onlineCounselors: number;
}

type ViewFilter = 'ALL' | 'STAFF_ONLY';

export default function AdminUsersPage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations();

  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'ALL' | 'MEMBER' | 'COUNSELOR'>('ALL');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [viewFilter, setViewFilter] = useState<ViewFilter>('ALL');
  const [currentAdminRole, setCurrentAdminRole] = useState<
    'SUPER' | 'OPERATOR' | 'FINANCE' | null
  >(null);

  const [roleModalUser, setRoleModalUser] = useState<User | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<
    'USER' | 'OPERATOR' | 'FINANCE' | 'SUPER'
  >('USER');
  const [isSavingRole, setIsSavingRole] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/users?role=${tab}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.users || []);
        setStats(data.stats || null);
      } else {
        if (data.message?.includes('권한')) {
          setError(data.message);
        } else {
          setError(data.message || '목록을 불러오는데 실패했습니다.');
        }
      }
    } catch {
      setError('목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [tab]);

  // 현재 로그인한 관리자 권한 조회 (SUPER만 권한 수정 가능)
  useEffect(() => {
    const loadCurrentAdmin = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentAdminRole(
            (data.user.adminRole as 'SUPER' | 'OPERATOR' | 'FINANCE' | null) ?? null
          );
        }
      } catch {
        setCurrentAdminRole(null);
      }
    };
    loadCurrentAdmin();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDeleteUser = async (userId: string, email: string | null) => {
    if (!confirm(`정말로 ${email || userId} 유저를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setProcessingIds((prev) => new Set(prev).add(userId));

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        alert('✅ ' + data.message);
        await fetchUsers();
      } else {
        alert('❌ ' + (data.message || '삭제에 실패했습니다.'));
      }
    } catch {
      alert('❌ 삭제 중 오류가 발생했습니다.');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleChangeRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'MEMBER' ? 'COUNSELOR' : 'MEMBER';
    if (!confirm(`이 유저의 등급을 ${newRole}로 변경하시겠습니까?`)) {
      return;
    }

    setProcessingIds((prev) => new Set(prev).add(userId));

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await response.json();

      if (data.success) {
        alert('✅ ' + data.message);
        await fetchUsers();
      } else {
        alert('❌ ' + (data.message || '변경에 실패했습니다.'));
      }
    } catch {
      alert('❌ 변경 중 오류가 발생했습니다.');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const getRoleBadge = (role: string, counselorStatus?: string | null) => {
    if (role === 'COUNSELOR') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
          👔 상담사
        </span>
      );
    }
    if (role === 'MEMBER' && counselorStatus === 'PENDING') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
          ⏳ 신청 중
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
        👤 일반회원
      </span>
    );
  };

  const getAdminBadge = (role: string, adminRole: User['adminRole']) => {
    if (role === 'ADMIN') {
      if (adminRole === 'SUPER') {
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
            👑 최고관리자
          </span>
        );
      }
      if (adminRole === 'FINANCE') {
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            💵 재무관리자
          </span>
        );
      }
      if (adminRole === 'OPERATOR') {
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40">
            🛠️ 운영자
          </span>
        );
      }
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/20 text-slate-200 border border-slate-500/40">
          🛡️ 관리자
        </span>
      );
    }

    if (adminRole) {
      if (adminRole === 'SUPER') {
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
            👑 최고관리자
          </span>
        );
      }
      if (adminRole === 'FINANCE') {
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            💵 재무관리자
          </span>
        );
      }
      if (adminRole === 'OPERATOR') {
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40">
            🛠️ 운영자
          </span>
        );
      }
    }

    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/5 text-white/60 border border-white/10">
        일반 유저
      </span>
    );
  };

  const openRoleModal = (user: User) => {
    // SUPER 관리자만 권한 설정 모달을 열 수 있음
    if (currentAdminRole !== 'SUPER') return;
    setRoleModalUser(user);

    if (user.role === 'ADMIN') {
      if (user.adminRole === 'SUPER') {
        setSelectedPermission('SUPER');
      } else if (user.adminRole === 'FINANCE') {
        setSelectedPermission('FINANCE');
      } else if (user.adminRole === 'OPERATOR') {
        setSelectedPermission('OPERATOR');
      } else {
        setSelectedPermission('USER');
      }
    } else {
      if (user.adminRole === 'SUPER') {
        setSelectedPermission('SUPER');
      } else if (user.adminRole === 'FINANCE') {
        setSelectedPermission('FINANCE');
      } else if (user.adminRole === 'OPERATOR') {
        setSelectedPermission('OPERATOR');
      } else {
        setSelectedPermission('USER');
      }
    }
  };

  const closeRoleModal = () => {
    setRoleModalUser(null);
    setIsSavingRole(false);
  };

  const handleSavePermission = async () => {
    if (!roleModalUser) return;

    setIsSavingRole(true);

    try {
      const body = {
        role: selectedPermission === 'USER' ? 'USER' : 'ADMIN',
        adminRole: selectedPermission,
      };

      const response = await fetch(`/api/admin/users/${roleModalUser.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ 권한이 업데이트되었습니다.');
        closeRoleModal();
        await fetchUsers();
      } else {
        alert('❌ ' + (data.message || '권한 변경에 실패했습니다.'));
      }
    } catch {
      alert('❌ 권한 변경 중 오류가 발생했습니다.');
    } finally {
      setIsSavingRole(false);
    }
  };

  // 권한 오류 화면
  if (error && error.includes('권한')) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] text-white">
        <header className="container mx-auto px-4 py-6 border-b border-[#D4AF37]/20">
          <div className="flex items-center justify-between">
            <a href={`/${locale}`} className="text-2xl font-bold" style={{ color: '#D4AF37' }}>
              {t('common.siteName')}
            </a>
            <div />
          </div>
        </header>
        <main className="container mx-auto px-4 py-16 max-w-lg">
          <div className="p-8 rounded-2xl text-center" style={{ background: 'rgba(255,107,107,0.1)', border: '2px solid #FF6B6B' }}>
            <div className="text-5xl mb-4">🔒</div>
            <h1 className="text-2xl font-bold text-red-400 mb-4">접근 권한 없음</h1>
            <p className="text-gray-300 mb-6">{error}</p>
            <a href={`/${locale}`} className="inline-block px-6 py-3 rounded-lg font-semibold text-black" style={{ backgroundColor: '#D4AF37' }}>
              메인으로 돌아가기
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white">
      {/* 헤더 */}
      <header className="border-b border-[#D4AF37]/20 sticky top-0 bg-[#0B0B0B]/95 backdrop-blur-sm z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <a href={`/${locale}`} className="text-2xl font-bold" style={{ color: '#D4AF37' }}>
                {t('common.siteName')}
              </a>
              <nav className="flex gap-4 items-center mt-2">
                <span className="text-[#D4AF37] text-sm font-semibold">👥 유저 관리</span>
                <span className="text-white/40">|</span>
                <a href={`/${locale}/admin/counselors`} className="text-white/60 hover:text-white transition-colors text-sm">
                  👔 상담사 관리
                </a>
                <span className="text-white/40">|</span>
                <a href={`/${locale}/admin/requests`} className="text-white/60 hover:text-white transition-colors text-sm">
                  📝 신청 관리
                </a>
                <span className="text-white/40">|</span>
                <a href={`/${locale}/admin/payouts`} className="text-white/60 hover:text-white transition-colors text-sm">
                  💰 정산 관리
                </a>
              </nav>
            </div>
            <div />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 통계 */}
        {stats && (
          <section className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-5 rounded-2xl text-center" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)', border: '1px solid rgba(59,130,246,0.3)' }}>
              <p className="text-xs text-blue-400/70 mb-1">일반회원</p>
              <p className="text-2xl font-bold text-blue-400">{stats.totalMembers}명</p>
            </div>
            <div className="p-5 rounded-2xl text-center" style={{ background: 'linear-gradient(135deg, rgba(155,89,182,0.15) 0%, rgba(155,89,182,0.05) 100%)', border: '1px solid rgba(155,89,182,0.3)' }}>
              <p className="text-xs text-purple-400/70 mb-1">상담사</p>
              <p className="text-2xl font-bold text-purple-400">{stats.totalCounselors}명</p>
            </div>
            <div className="p-5 rounded-2xl text-center" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <p className="text-xs text-emerald-400/70 mb-1">온라인</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.onlineCounselors}명</p>
            </div>
          </section>
        )}

        {/* 상단 필터: 전체 유저 / 운영진만 보기 */}
        <section className="mb-3 flex gap-2">
          <button
            onClick={() => setViewFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all ${
              viewFilter === 'ALL'
                ? 'bg-white text-black'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            전체 유저
          </button>
          <button
            onClick={() => setViewFilter('STAFF_ONLY')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all ${
              viewFilter === 'STAFF_ONLY'
                ? 'bg-[#D4AF37] text-black'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            👑 운영진만 보기
          </button>
        </section>

        {/* 역할 탭 */}
        <section className="mb-6 flex gap-2">
          {(['ALL', 'MEMBER', 'COUNSELOR'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === t ? 'bg-[#D4AF37] text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {t === 'ALL' && '전체'}
              {t === 'MEMBER' && '👤 일반회원'}
              {t === 'COUNSELOR' && '👔 상담사'}
            </button>
          ))}
          <button onClick={fetchUsers} className="ml-auto px-4 py-2 rounded-xl text-sm bg-white/5 text-white/60 hover:bg-white/10">
            🔄 새로고침
          </button>
        </section>

        {/* 테이블 */}
        {isLoading ? (
          <div className="text-center py-16 text-white/50">로딩 중...</div>
        ) : error ? (
          <div className="text-center py-16 text-red-400">{error}</div>
        ) : (
          (() => {
            const visibleUsers =
              viewFilter === 'ALL'
                ? users
                : users.filter((u) => u.role === 'ADMIN' || !!u.adminRole);

            if (visibleUsers.length === 0) {
              return (
                <div
                  className="text-center py-16"
                  style={{
                    background: 'rgba(212,175,55,0.05)',
                    borderRadius: '1rem',
                    border: '1px solid rgba(212,175,55,0.1)',
                  }}
                >
                  <p className="text-white/50">표시할 유저가 없습니다.</p>
                </div>
              );
            }

            return (
              <div
                className="overflow-x-auto rounded-2xl"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                        이름
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                        이메일
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                        등급
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                        권한
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                        성별
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                        국가
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                        코인
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                        가입일
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                        관리
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers.map((user) => {
                      const isProcessing = processingIds.has(user.id);
                      const isAdminTarget = user.role === 'ADMIN';
                      const isMaster = user.email === 'limtaesik@gmail.com';
                      const canModifyAdmin =
                        currentAdminRole === 'SUPER' && !isMaster;

                      return (
                        <tr
                          key={user.id}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <td className="px-4 py-3 text-white font-medium">
                            {user.displayName || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-sm">
                            {user.email || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {getRoleBadge(user.role, user.counselorStatus)}
                          </td>
                          <td className="px-4 py-3">
                            {getAdminBadge(user.role, user.adminRole)}
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {user.gender === 'MALE'
                              ? '👨 남성'
                              : user.gender === 'FEMALE'
                              ? '👩 여성'
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {user.country
                              ? `${getCountryFlag(user.country)} ${getCountryName(user.country)}`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-[#D4AF37] font-semibold">
                            {user.coins.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-sm">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {/* 등급 변경: ADMIN 대상은 SUPER만, 나머지는 모든 관리자 가능 */}
                              {(!isAdminTarget || canModifyAdmin) && (
                                <button
                                  onClick={() => handleChangeRole(user.id, user.role)}
                                  disabled={isProcessing}
                                  className="px-3 py-1 text-xs rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 disabled:opacity-50"
                                >
                                  등급 변경
                                </button>
                              )}

                              {/* 권한 설정: 이미 SUPER만 노출 */}
                              {currentAdminRole === 'SUPER' && (
                                <button
                                  onClick={() => openRoleModal(user)}
                                  disabled={isProcessing}
                                  className="px-3 py-1 text-xs rounded bg-amber-500/20 text-amber-200 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-50"
                                >
                                  ⚙️ 권한 설정
                                </button>
                              )}

                              {/* 삭제: ADMIN 대상은 SUPER만, 마스터 계정은 항상 비활성화 */}
                              {(!isAdminTarget || canModifyAdmin) && !isMaster && (
                                <button
                                  onClick={() => handleDeleteUser(user.id, user.email)}
                                  disabled={isProcessing}
                                  className="px-3 py-1 text-xs rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()
        )}
      </main>

      {/* 권한 설정 모달 */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#111111] border border-[#D4AF37]/40 p-6">
            <h2 className="text-xl font-bold mb-2" style={{ color: '#D4AF37' }}>
              ⚙️ 권한 설정
            </h2>
            <p className="text-sm text-gray-300 mb-4">
              {roleModalUser.displayName || roleModalUser.email} 님의 운영진 권한을 설정합니다.
            </p>

            <div className="space-y-2 mb-6">
              <button
                type="button"
                onClick={() => setSelectedPermission('USER')}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                  selectedPermission === 'USER'
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                <div className="font-semibold">일반 유저</div>
                <div className="text-xs text-gray-400">
                  운영진 권한 없이 서비스만 이용하는 일반 회원입니다.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPermission('OPERATOR')}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                  selectedPermission === 'OPERATOR'
                    ? 'border-sky-400 bg-sky-500 text-black'
                    : 'border-sky-400/40 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20'
                }`}
              >
                <div className="font-semibold">🛠️ 운영자 (OPERATOR)</div>
                <div className="text-xs text-sky-100/80">
                  상담사/유저 관리 및 신청 처리 등 운영 전반을 담당합니다.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPermission('FINANCE')}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                  selectedPermission === 'FINANCE'
                    ? 'border-emerald-400 bg-emerald-500 text-black'
                    : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
                }`}
              >
                <div className="font-semibold">💵 재무관리자 (FINANCE)</div>
                <div className="text-xs text-emerald-100/80">
                  정산/출금 승인 등 금전 관련 기능에만 접근 가능합니다.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPermission('SUPER')}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                  selectedPermission === 'SUPER'
                    ? 'border-yellow-400 bg-yellow-400 text-black'
                    : 'border-yellow-400/60 bg-yellow-500/10 text-yellow-100 hover:bg-yellow-500/20'
                }`}
              >
                <div className="font-semibold">👑 최고관리자 (SUPER)</div>
                <div className="text-xs text-yellow-100/80">
                  모든 관리자 기능에 접근 가능한 최상위 권한입니다.
                </div>
              </button>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeRoleModal}
                disabled={isSavingRole}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSavePermission}
                disabled={isSavingRole}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#D4AF37] text-black hover:bg-[#e2c15b] disabled:opacity-50"
              >
                {isSavingRole ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

