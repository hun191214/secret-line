'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface Withdrawal {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  displayName: string | null;
  coinAmount: number;
  usdtAmount: number;
  walletAddress: string;
  network: string;
  status: 'PENDING' | 'AUTO_COMPLETED' | 'MANUAL_COMPLETED' | 'REJECTED';
  rejectedReason: string | null;
  txHash: string | null;
  requestedAt: string;
  processedAt: string | null;
}

interface Stats {
  pendingCount: number;
  pendingUsdtAmount: number;
  autoCompletedCount: number;
  manualCompletedCount: number;
  rejectedCount: number;
  totalUsdtProcessed: number;
}

// 네트워크 아이콘 (TRC-20 전용)
const NETWORK_ICONS: Record<string, string> = {
  'TRC-20': '🔴',
};

export default function AdminUSDTPayoutsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations();

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'AUTO'>('ALL');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchWithdrawals = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/payouts');
      const data = await response.json();

      if (data.success) {
        setWithdrawals(data.withdrawals || []);
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
  }, []);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleApprove = async (id: string) => {
    const withdrawal = withdrawals.find((w) => w.id === id);
    if (!withdrawal) return;

    if (
      !confirm(
        `이 출금 신청을 승인하시겠습니까?\n\n` +
          `금액: ${withdrawal.usdtAmount.toFixed(2)} USDT\n` +
          `네트워크: ${withdrawal.network}\n` +
          `지갑: ${withdrawal.walletAddress}\n\n` +
          `승인 즉시 코인이 차감됩니다.`
      )
    ) {
      return;
    }

    setProcessingIds((prev) => new Set(prev).add(id));

    try {
      const response = await fetch(`/api/admin/payouts/${id}/approve`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        alert(
          `✅ ${data.message}\n\n` +
            `송금 정보:\n` +
            `• 네트워크: ${data.withdrawal?.network}\n` +
            `• 금액: ${data.withdrawal?.usdtAmount.toFixed(2)} USDT\n` +
            `• 지갑: ${data.withdrawal?.walletAddress}`
        );
        await fetchWithdrawals();
      } else {
        alert('❌ ' + (data.message || '승인에 실패했습니다.'));
      }
    } catch {
      alert('❌ 승인 중 오류가 발생했습니다.');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const openRejectModal = (id: string) => {
    setRejectingId(id);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectingId) return;

    if (!rejectReason.trim()) {
      alert('반려 사유를 입력해주세요.');
      return;
    }

    setProcessingIds((prev) => new Set(prev).add(rejectingId));

    try {
      const response = await fetch(`/api/admin/payouts/${rejectingId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });

      const data = await response.json();

      if (data.success) {
        alert('⛔ ' + data.message);
        setRejectingId(null);
        await fetchWithdrawals();
      } else {
        alert('❌ ' + (data.message || '반려에 실패했습니다.'));
      }
    } catch {
      alert('❌ 반려 중 오류가 발생했습니다.');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(rejectingId);
        return next;
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            ⏳ 대기
          </span>
        );
      case 'AUTO_COMPLETED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            ⚡ 자동
          </span>
        );
      case 'MANUAL_COMPLETED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            ✅ 승인
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
            ❌ 반려
          </span>
        );
      default:
        return null;
    }
  };

  // 필터링
  const filteredWithdrawals = withdrawals.filter((w) => {
    if (filter === 'PENDING') return w.status === 'PENDING';
    if (filter === 'COMPLETED') return w.status === 'MANUAL_COMPLETED' || w.status === 'AUTO_COMPLETED';
    if (filter === 'AUTO') return w.status === 'AUTO_COMPLETED';
    return true;
  });

  // 권한 오류 전용 화면
  if (error && error.includes('권한')) {
    return (
      <div className="text-white">
        <div className="max-w-lg mx-auto py-16">
          <div
            className="p-8 rounded-2xl text-center"
            style={{
              background: 'rgba(255, 107, 107, 0.1)',
              border: '2px solid #FF6B6B',
            }}
          >
            <div className="text-5xl mb-4">🔒</div>
            <h1 className="text-2xl font-bold text-red-400 mb-4">접근 권한 없음</h1>
            <p className="text-gray-300 mb-6">{error}</p>
            <Link
              href={`/${locale}/admin`}
              className="inline-block px-6 py-3 rounded-lg font-semibold text-black transition-all transform hover:scale-105"
              style={{ backgroundColor: '#26A17B' }}
            >
              관리자 메인으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-white">
      <div className="max-w-6xl mx-auto">
        {/* 통계 카드 */}
        {stats && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div
              className="p-5 rounded-2xl text-center relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.05) 100%)',
                border: '2px solid rgba(245,158,11,0.4)',
              }}
            >
              {stats.pendingCount > 0 && (
                <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
              )}
              <p className="text-xs text-amber-400/70 mb-1">⏳ 대기 중</p>
              <p className="text-2xl font-bold text-amber-400">{stats.pendingCount}건</p>
              <p className="text-sm text-amber-400/70">{stats.pendingUsdtAmount.toFixed(2)} USDT</p>
            </div>
            <div
              className="p-5 rounded-2xl text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(38,161,123,0.15) 0%, rgba(38,161,123,0.05) 100%)',
                border: '1px solid rgba(38,161,123,0.3)',
              }}
            >
              <p className="text-xs text-[#26A17B]/70 mb-1">⚡ 자동 완료</p>
              <p className="text-2xl font-bold text-[#26A17B]">{stats.autoCompletedCount}건</p>
            </div>
            <div
              className="p-5 rounded-2xl text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
                border: '1px solid rgba(59,130,246,0.3)',
              }}
            >
              <p className="text-xs text-blue-400/70 mb-1">✅ 수동 승인</p>
              <p className="text-2xl font-bold text-blue-400">{stats.manualCompletedCount}건</p>
            </div>
            <div
              className="p-5 rounded-2xl text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(38,161,123,0.2) 0%, rgba(38,161,123,0.1) 100%)',
                border: '1px solid rgba(38,161,123,0.4)',
              }}
            >
              <p className="text-xs text-[#26A17B]/70 mb-1">💰 총 송금액</p>
              <p className="text-2xl font-bold text-[#26A17B]">{stats.totalUsdtProcessed.toFixed(2)}</p>
              <p className="text-sm text-[#26A17B]/70">USDT</p>
            </div>
          </section>
        )}

        {/* 필터 탭 */}
        <section className="mb-6 flex gap-2 flex-wrap">
          {(['ALL', 'PENDING', 'COMPLETED', 'AUTO'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                filter === f
                  ? 'bg-[#26A17B] text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {f === 'ALL' && '전체'}
              {f === 'PENDING' && '⏳ 대기 중'}
              {f === 'COMPLETED' && '✅ 완료'}
              {f === 'AUTO' && '⚡ 자동 승인'}
            </button>
          ))}
          <button
            onClick={fetchWithdrawals}
            className="ml-auto px-4 py-2 rounded-xl text-sm bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
          >
            🔄 새로고침
          </button>
        </section>

        {/* 목록 */}
        {isLoading ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4 animate-bounce">💎</div>
            <p className="text-white/50">로딩 중...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-400">{error}</div>
        ) : filteredWithdrawals.length === 0 ? (
          <div
            className="text-center py-16"
            style={{
              background: 'rgba(38,161,123,0.05)',
              borderRadius: '1rem',
              border: '1px solid rgba(38,161,123,0.1)',
            }}
          >
            <p className="text-white/50">표시할 출금 신청이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredWithdrawals.map((w) => (
              <div
                key={w.id}
                className={`p-5 rounded-2xl transition-all ${
                  w.status === 'PENDING' && w.usdtAmount > 50
                    ? 'ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/20'
                    : w.status === 'PENDING'
                    ? 'ring-1 ring-amber-500/30'
                    : ''
                }`}
                style={{
                  background:
                    w.status === 'PENDING'
                      ? 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(0,0,0,0.3) 100%)'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* 신청 정보 */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      {getStatusBadge(w.status)}
                      <span className="text-xl font-bold text-[#26A17B]">
                        {w.usdtAmount.toFixed(2)} USDT
                      </span>
                      <span className="text-sm text-white/50">({w.coinAmount.toLocaleString()}코인)</span>
                      {w.status === 'PENDING' && w.usdtAmount > 50 && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400 border border-red-500/30">
                          🔥 고액
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-white/70 mb-1">
                      {w.displayName || w.userName || '이름없음'} ({w.userEmail || 'N/A'})
                    </p>

                    {/* 네트워크 & 지갑 주소 */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{NETWORK_ICONS[w.network] || '🔘'}</span>
                      <span className="text-sm text-white/60">{w.network}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-white/70 bg-white/5 px-2 py-1 rounded break-all">
                        {w.walletAddress}
                      </code>
                      <button
                        onClick={() => copyToClipboard(w.walletAddress, w.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          copiedId === w.id
                            ? 'bg-emerald-500 text-white'
                            : 'bg-[#26A17B]/20 text-[#26A17B] hover:bg-[#26A17B]/30'
                        }`}
                      >
                        {copiedId === w.id ? '✅ 복사됨' : '📋 복사'}
                      </button>
                    </div>

                    <p className="text-xs text-white/40 mt-2">
                      신청: {formatDate(w.requestedAt)}
                      {w.processedAt && ` · 처리: ${formatDate(w.processedAt)}`}
                    </p>

                    {w.status === 'REJECTED' && w.rejectedReason && (
                      <p className="text-sm text-red-400 mt-2">반려 사유: {w.rejectedReason}</p>
                    )}

                    {w.txHash && (
                      <p className="text-xs text-emerald-400 mt-2">
                        TX: {w.txHash.slice(0, 20)}...
                      </p>
                    )}
                  </div>

                  {/* 액션 버튼 (PENDING만) */}
                  {w.status === 'PENDING' && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleApprove(w.id)}
                        disabled={processingIds.has(w.id)}
                        className="px-5 py-2 rounded-xl font-semibold text-white bg-[#26A17B] hover:bg-[#1A7F5A] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingIds.has(w.id) ? '...' : '✅ 승인'}
                      </button>
                      <button
                        onClick={() => openRejectModal(w.id)}
                        disabled={processingIds.has(w.id)}
                        className="px-5 py-2 rounded-xl font-semibold text-white bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ❌ 반려
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 반려 모달 */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="w-full max-w-md p-6 rounded-2xl"
            style={{
              background: 'linear-gradient(180deg, #1a1a1a 0%, #0B0B0B 100%)',
              border: '1px solid rgba(239,68,68,0.3)',
            }}
          >
            <h3 className="text-xl font-bold text-red-400 mb-4">USDT 출금 반려</h3>
            <p className="text-white/70 text-sm mb-4">
              반려 사유를 입력해주세요. 상담사에게 안내됩니다.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="예: 지갑 주소 확인 필요, 본인 인증 필요 등"
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-red-500/30 text-white placeholder-white/30 focus:outline-none focus:border-red-500 transition-colors mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectingId(null)}
                className="flex-1 px-4 py-3 rounded-xl font-semibold text-white/70 bg-white/5 hover:bg-white/10 transition-all"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={processingIds.has(rejectingId)}
                className="flex-1 px-4 py-3 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-400 transition-all disabled:opacity-50"
              >
                {processingIds.has(rejectingId) ? '처리 중...' : '반려 확정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
