'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface CounselorRequest {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  displayName: string | null;
  voiceTone: string[];
  specialty: string | null;
  bio: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectedReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  userCreatedAt: string;
}

export default function AdminRequestsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations();

  const [autoApproval, setAutoApproval] = useState(false);
  const [isLoadingAutoApproval, setIsLoadingAutoApproval] = useState(false);
  const [requests, setRequests] = useState<CounselorRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // 자동 승인 설정 조회
  useEffect(() => {
    const fetchAutoApproval = async () => {
      try {
        const response = await fetch('/api/admin/settings/auto-approval');
        const data = await response.json();
        if (data.success) {
          setAutoApproval(data.autoApproval);
        }
      } catch (err) {
        console.error('자동 승인 설정 조회 오류:', err);
      }
    };

    fetchAutoApproval();
  }, []);

  // 신청 목록 조회
  const fetchRequests = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/counselor-requests?status=PENDING');
      const data = await response.json();

      if (data.success) {
        setRequests(data.requests || []);
      } else {
        setError(data.message || '신청 목록을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('신청 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // 자동 승인 모드 토글
  const handleToggleAutoApproval = async () => {
    setIsLoadingAutoApproval(true);

    try {
      const newValue = !autoApproval;
      const response = await fetch('/api/admin/settings/auto-approval', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ autoApproval: newValue }),
      });

      const data = await response.json();

      if (data.success) {
        setAutoApproval(newValue);
        alert(data.message);
      } else {
        alert(data.message || '설정 변경에 실패했습니다.');
      }
    } catch (err) {
      alert('설정 변경 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingAutoApproval(false);
    }
  };

  // 신청 승인
  const handleApprove = async (requestId: string) => {
    if (!confirm('이 신청을 승인하시겠습니까?')) {
      return;
    }

    setUpdatingIds((prev) => new Set(prev).add(requestId));

    try {
      const response = await fetch(`/api/admin/counselor-requests/${requestId}/approve`, {
        method: 'PATCH',
      });

      const data = await response.json();

      if (data.success) {
        alert('신청이 승인되었습니다.');
        fetchRequests(); // 목록 새로고침
      } else {
        alert(data.message || '승인에 실패했습니다.');
      }
    } catch (err) {
      alert('승인 중 오류가 발생했습니다.');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  // 신청 거절
  const handleReject = async (requestId: string) => {
    const reason = prompt('거절 사유를 입력해주세요:');
    if (reason === null) {
      return; // 취소
    }

    setUpdatingIds((prev) => new Set(prev).add(requestId));

    try {
      const response = await fetch(`/api/admin/counselor-requests/${requestId}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (data.success) {
        alert('신청이 거절되었습니다.');
        fetchRequests(); // 목록 새로고침
      } else {
        alert(data.message || '거절에 실패했습니다.');
      }
    } catch (err) {
      alert('거절 중 오류가 발생했습니다.');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ★★★ 에러 메시지 전용 화면 (권한 없음 등) ★★★
  if (error && error.includes('권한')) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] text-white">
        {/* 헤더 */}
        <header className="container mx-auto px-4 py-6 border-b border-[#D4AF37]/20">
          <div className="flex items-center justify-between">
            <a href={`/${locale}`} className="text-2xl font-bold" style={{ color: '#D4AF37' }}>
              {t('common.siteName')}
            </a>
            <div />
          </div>
        </header>

        {/* 에러 메시지 (중앙 배치, 충분한 여백) */}
        <main className="container mx-auto px-4 py-16 max-w-lg">
          <div
            className="p-8 rounded-2xl text-center"
            style={{
              background: 'rgba(255, 107, 107, 0.1)',
              border: '2px solid #FF6B6B',
            }}
          >
            <div className="text-5xl mb-4">🔒</div>
            <h1 className="text-2xl font-bold text-red-400 mb-4">
              접근 권한 없음
            </h1>
            <p className="text-gray-300 mb-6">
              {error}
            </p>
            <a
              href={`/${locale}`}
              className="inline-block px-6 py-3 rounded-lg font-semibold text-black transition-all transform hover:scale-105"
              style={{ backgroundColor: '#D4AF37' }}
            >
              메인으로 돌아가기
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white p-4">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* 헤더 */}
        <header className="mb-8 border-b border-[#D4AF37]/20 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <a href={`/${locale}`} className="text-2xl font-bold" style={{ color: '#D4AF37' }}>
                {t('common.siteName')}
              </a>
              <nav className="flex gap-4 items-center mt-2">
                <a
                  href={`/${locale}/admin/counselors`}
                  className="text-white/60 hover:text-white transition-colors text-sm"
                >
                  상담사 관리
                </a>
                <span className="text-white/40">|</span>
                <span className="text-white/80 text-sm">신청 관리</span>
              </nav>
            </div>
            <div />
          </div>
        </header>

        {/* 자동 승인 모드 토글 */}
        <div
          className="mb-8 bg-gradient-to-br from-gray-900 to-black rounded-2xl p-6 border-2"
          style={{ borderColor: '#D4AF37' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#D4AF37' }}>
                자동 승인 모드
              </h2>
              <p className="text-sm text-gray-400">
                활성화 시 신청이 즉시 승인되며, 비활성화 시 관리자 승인이 필요합니다.
              </p>
            </div>
            <button
              onClick={handleToggleAutoApproval}
              disabled={isLoadingAutoApproval}
              className={`relative w-16 h-8 rounded-full transition-colors ${
                autoApproval ? 'bg-[#D4AF37]' : 'bg-gray-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                  autoApproval ? 'translate-x-8' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {isLoadingAutoApproval && (
            <p className="mt-2 text-xs text-gray-400">설정 변경 중...</p>
          )}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* 신청 목록 */}
        <div
          className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 shadow-2xl border-2"
          style={{ borderColor: '#D4AF37' }}
        >
          <h2 className="text-2xl font-semibold mb-6" style={{ color: '#D4AF37' }}>
            대기 중인 신청 ({requests.length}건)
          </h2>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-400">신청 목록을 불러오는 중...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              대기 중인 신청이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {requests.map((request) => {
                const isUpdating = updatingIds.has(request.id);
                return (
                  <div
                    key={request.id}
                    className="bg-black/50 rounded-xl p-6 border border-gray-700 hover:border-[#D4AF37]/50 transition-colors"
                  >
                    {/* 사용자 정보 */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold" style={{ color: '#D4AF37' }}>
                          {request.displayName || request.name || '이름 없음'}
                        </h3>
                        <span className="text-xs text-gray-400">
                          {formatDate(request.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{request.email}</p>
                    </div>

                    {/* 보이스 톤 */}
                    {request.voiceTone.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">보이스 톤</p>
                        <div className="flex flex-wrap gap-2">
                          {request.voiceTone.map((tone, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300"
                            >
                              {tone}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 전문 분야 */}
                    {request.specialty && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">전문 분야</p>
                        <p className="text-sm text-gray-300">{request.specialty}</p>
                      </div>
                    )}

                    {/* 자기소개 */}
                    {request.bio && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">자기소개</p>
                        <p className="text-sm text-gray-400 line-clamp-3">{request.bio}</p>
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-700">
                      <button
                        onClick={() => handleApprove(request.id)}
                        disabled={isUpdating}
                        className="flex-1 px-4 py-2 rounded-lg bg-green-900/50 text-green-300 border border-green-500/50 hover:bg-green-900/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {isUpdating ? '처리 중...' : '승인'}
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        disabled={isUpdating}
                        className="flex-1 px-4 py-2 rounded-lg bg-red-900/50 text-red-300 border border-red-500/50 hover:bg-red-900/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {isUpdating ? '처리 중...' : '거절'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

