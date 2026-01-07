'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface Withdrawal {
  id: string;
  coinAmount: number;
  usdtAmount: number;
  walletAddress: string;
  walletAddressFull: string;
  network: string;
  status: 'PENDING' | 'AUTO_COMPLETED' | 'MANUAL_COMPLETED' | 'REJECTED';
  rejectedReason: string | null;
  txHash: string | null;
  requestedAt: string;
  processedAt: string | null;
}

interface Stats {
  totalRequests: number;
  totalUsdtAmount: number;
  totalCoinAmount: number;
  pendingCount: number;
  completedCount: number;
}

interface RateInfo {
  coinToUsdt: number;
  autoApprovalThreshold: number;
  minWithdrawalCoins: number;
  supportedNetworks: string[];
}

// 네트워크 정보 (TRC-20 전용 - 입금 시스템과 동일)
const NETWORK_INFO: Record<string, { icon: string; color: string; description: string }> = {
  'TRC-20': { icon: '🔴', color: '#FF0606', description: 'Tron Network (USDT TRC-20)' },
};

// 기본 네트워크 (TRC-20 전용)
const DEFAULT_NETWORK = 'TRC-20';

export default function USDTPayoutPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const t = useTranslations();

  const [isLoading, setIsLoading] = useState(true);
  const [coins, setCoins] = useState(0);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rateInfo, setRateInfo] = useState<RateInfo | null>(null);

  // 출금 신청 폼
  const [coinAmount, setCoinAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  // 네트워크는 TRC-20 전용 (입금과 동일)
  const network = DEFAULT_NETWORK;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    isAutoApproval?: boolean;
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [balanceRes, historyRes, rateRes] = await Promise.all([
        fetch('/api/charge/balance'),
        fetch('/api/payout/history'),
        fetch('/api/payout/request'), // GET으로 환율 정보
      ]);

      const balanceData = await balanceRes.json();
      const historyData = await historyRes.json();
      const rateData = await rateRes.json();

      if (balanceData.coins !== undefined) {
        setCoins(balanceData.coins);
      }

      if (historyData.success) {
        setWithdrawals(historyData.withdrawals || []);
        setStats(historyData.stats || null);
      }

      if (rateData.success && rateData.rate) {
        setRateInfo(rateData.rate);
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const response = await fetch('/api/payout/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coinAmount: parseInt(coinAmount),
          walletAddress,
          network,
        }),
      });

      const data = await response.json();

      setSubmitResult({
        success: data.success,
        message: data.message,
        isAutoApproval: data.withdrawal?.isAutoApproval,
      });

      if (data.success) {
        // 폼 초기화 및 데이터 새로고침
        setCoinAmount('');
        setWalletAddress('');
        await fetchData();
      }
    } catch (error) {
      setSubmitResult({
        success: false,
        message: '출금 신청 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('클립보드에 복사되었습니다!');
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('클립보드에 복사되었습니다!');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            ⏳ 승인 대기
          </span>
        );
      case 'AUTO_COMPLETED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            ⚡ 자동 완료
          </span>
        );
      case 'MANUAL_COMPLETED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            ✅ 송금 완료
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
            ❌ 반려됨
          </span>
        );
      default:
        return null;
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

  // 계산된 USDT 금액
  const coinToUsdtRate = rateInfo?.coinToUsdt || 100;
  const autoThreshold = rateInfo?.autoApprovalThreshold || 50;
  const minCoins = rateInfo?.minWithdrawalCoins || 100;
  const calculatedUsdt = parseInt(coinAmount || '0') / coinToUsdtRate;
  const isAutoApproval = calculatedUsdt > 0 && calculatedUsdt <= autoThreshold;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0B0B0B] via-[#1a0a1a] to-[#0B0B0B] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">💎</div>
          <div className="text-[#E8B4B8] text-lg animate-pulse">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0B0B] via-[#1a0a1a] to-[#0B0B0B] text-white">
      {/* 헤더 */}
      <header className="border-b border-[#9B59B6]/20 backdrop-blur-sm bg-black/30 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <a
            href={`/${locale}/mypage`}
            className="flex items-center gap-2 text-[#E8B4B8] hover:text-white transition-colors"
          >
            <span className="text-xl">←</span>
            <span>마이페이지</span>
          </a>
          <h1 className="text-xl font-bold bg-gradient-to-r from-[#E8B4B8] to-[#9B59B6] bg-clip-text text-transparent">
            💎 USDT 정산
          </h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* 잔액 카드 */}
        <section
          className="mb-8 p-8 rounded-3xl text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(155,89,182,0.15) 100%)',
            border: '2px solid rgba(232,180,184,0.3)',
          }}
        >
          {/* 배경 장식 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-20"
              style={{ background: 'radial-gradient(circle, #E8B4B8, transparent)' }}
            />
            <div
              className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl opacity-20"
              style={{ background: 'radial-gradient(circle, #9B59B6, transparent)' }}
            />
          </div>

          <div className="relative z-10">
            <p className="text-sm text-[#E8B4B8]/70 mb-2">정산 가능 잔액</p>
            <div className="text-5xl font-bold mb-2">
              <span className="bg-gradient-to-r from-[#E8B4B8] to-[#9B59B6] bg-clip-text text-transparent">
                {coins.toLocaleString()}
              </span>
              <span className="text-2xl text-white/60 ml-2">코인</span>
            </div>
            <p className="text-lg text-white/60">
              ≈ <span className="text-[#26A17B] font-bold">{(coins / coinToUsdtRate).toFixed(2)}</span> USDT
            </p>
            <p className="text-xs text-white/40 mt-2">
              환율: {coinToUsdtRate} 코인 = 1 USDT
            </p>
          </div>
        </section>

        {/* 통계 */}
        {stats && (
          <section className="grid grid-cols-2 gap-4 mb-8">
            <div
              className="p-4 rounded-2xl text-center"
              style={{
                background: 'rgba(38,161,123,0.1)',
                border: '1px solid rgba(38,161,123,0.3)',
              }}
            >
              <p className="text-xs text-[#26A17B]/70 mb-1">총 정산액</p>
              <p className="text-xl font-bold text-[#26A17B]">
                {stats.totalUsdtAmount.toFixed(2)} USDT
              </p>
            </div>
            <div
              className="p-4 rounded-2xl text-center"
              style={{
                background: 'rgba(155,89,182,0.1)',
                border: '1px solid rgba(155,89,182,0.2)',
              }}
            >
              <p className="text-xs text-[#9B59B6]/60 mb-1">완료 / 대기</p>
              <p className="text-xl font-bold text-[#9B59B6]">
                {stats.completedCount} / {stats.pendingCount}건
              </p>
            </div>
          </section>
        )}

        {/* USDT 출금 신청 폼 */}
        <section
          className="mb-8 p-6 rounded-3xl"
          style={{
            background: 'linear-gradient(180deg, rgba(232,180,184,0.08) 0%, rgba(155,89,182,0.08) 100%)',
            border: '1px solid rgba(232,180,184,0.2)',
          }}
        >
          <h2 className="text-lg font-bold text-[#E8B4B8] mb-6 flex items-center gap-2">
            💸 USDT 출금 신청
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 코인 수량 + 실시간 계산기 */}
            <div>
              <label className="block text-sm text-white/70 mb-2">출금할 코인</label>
              <div className="relative">
                <input
                  type="number"
                  value={coinAmount}
                  onChange={(e) => setCoinAmount(e.target.value)}
                  placeholder={`최소 ${minCoins} 코인`}
                  min={minCoins}
                  max={coins}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#E8B4B8]/30 text-white placeholder-white/30 focus:outline-none focus:border-[#E8B4B8] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setCoinAmount(coins.toString())}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 text-xs rounded-lg bg-[#E8B4B8]/20 text-[#E8B4B8] hover:bg-[#E8B4B8]/30 transition-colors"
                >
                  전액
                </button>
              </div>

              {/* 실시간 USDT 계산기 */}
              {parseInt(coinAmount || '0') > 0 && (
                <div
                  className="mt-3 p-4 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(38,161,123,0.15) 0%, rgba(38,161,123,0.05) 100%)',
                    border: '1px solid rgba(38,161,123,0.3)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">받게 될 예상 금액</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-[#26A17B]">
                        {calculatedUsdt.toFixed(2)}
                      </span>
                      <span className="text-[#26A17B] ml-1">USDT</span>
                    </div>
                  </div>
                  {isAutoApproval && (
                    <p className="text-emerald-400 text-xs mt-2 flex items-center gap-1">
                      <span>⚡</span>
                      {autoThreshold} USDT 이하 - 자동 승인 대상
                    </p>
                  )}
                  {!isAutoApproval && calculatedUsdt > 0 && (
                    <p className="text-amber-400 text-xs mt-2 flex items-center gap-1">
                      <span>⏳</span>
                      {autoThreshold} USDT 초과 - 관리자 승인 필요
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 네트워크 표시 (TRC-20 전용 - 입금과 동일) */}
            <div>
              <label className="block text-sm text-white/70 mb-2">출금 네트워크</label>
              <div
                className="p-4 rounded-xl flex items-center gap-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,6,6,0.1) 0%, rgba(255,6,6,0.05) 100%)',
                  border: '2px solid rgba(255,6,6,0.4)',
                }}
              >
                <span className="text-3xl">🔴</span>
                <div className="flex-1">
                  <p className="font-bold text-white text-lg">USDT TRC-20</p>
                  <p className="text-xs text-white/60">Tron Network (입금과 동일한 네트워크)</p>
                </div>
                <span className="text-[#26A17B] text-xl">✓</span>
              </div>
              {/* 주의 문구 */}
              <div
                className="mt-3 p-3 rounded-xl"
                style={{
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.3)',
                }}
              >
                <p className="text-amber-400 text-xs flex items-start gap-2">
                  <span className="text-base">⚠️</span>
                  <span>
                    <strong>입금 시 사용하셨던 네트워크와 동일한 네트워크입니다.</strong>
                    <br />
                    다른 네트워크 지갑 주소를 입력하면 자산을 잃을 수 있습니다.
                  </span>
                </p>
              </div>
            </div>

            {/* 지갑 주소 */}
            <div>
              <label className="block text-sm text-white/70 mb-2">
                USDT 지갑 주소 (TRC-20)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="지갑 주소를 붙여넣기 하세요"
                  required
                  className="w-full px-4 py-3 pr-20 rounded-xl bg-white/5 border border-[#E8B4B8]/30 text-white placeholder-white/30 focus:outline-none focus:border-[#E8B4B8] transition-colors font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setWalletAddress(text);
                    } catch {
                      alert('클립보드에서 붙여넣기 할 수 없습니다.');
                    }
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 text-xs rounded-lg bg-[#9B59B6]/30 text-[#9B59B6] hover:bg-[#9B59B6]/40 transition-colors"
                >
                  📋 붙여넣기
                </button>
              </div>
              <p className="text-xs text-amber-400/70 mt-2">
                ⚠️ 주소를 잘못 입력하면 자산을 잃을 수 있습니다. 반드시 확인하세요.
              </p>
            </div>

            {/* 자동 승인 안내 */}
            <div
              className="p-4 rounded-xl text-sm"
              style={{
                background: 'rgba(38,161,123,0.1)',
                border: '1px solid rgba(38,161,123,0.2)',
              }}
            >
              <p className="text-[#26A17B] font-semibold mb-1">⚡ 스마트 자동 정산</p>
              <p className="text-white/60">
                {autoThreshold} USDT 이하 출금은 <span className="text-[#26A17B]">즉시 자동 승인</span>됩니다.
                <br />
                초과 금액은 관리자 검토 후 송금됩니다.
              </p>
            </div>

            {/* 결과 메시지 */}
            {submitResult && (
              <div
                className={`p-4 rounded-xl text-center ${
                  submitResult.success
                    ? submitResult.isAutoApproval
                      ? 'bg-emerald-500/20 border border-emerald-500/30'
                      : 'bg-blue-500/20 border border-blue-500/30'
                    : 'bg-red-500/20 border border-red-500/30'
                }`}
              >
                <p className={submitResult.success ? 'text-white' : 'text-red-400'}>
                  {submitResult.success && submitResult.isAutoApproval && (
                    <span className="text-2xl block mb-2">⚡</span>
                  )}
                  {submitResult.success && !submitResult.isAutoApproval && (
                    <span className="text-2xl block mb-2">📝</span>
                  )}
                  {!submitResult.success && <span className="text-2xl block mb-2">❌</span>}
                  {submitResult.message}
                </p>
              </div>
            )}

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !coinAmount ||
                parseInt(coinAmount) < minCoins ||
                parseInt(coinAmount) > coins ||
                !walletAddress
              }
              className="w-full py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #26A17B 0%, #1A7F5A 100%)',
                color: 'white',
              }}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">🔄</span>
                  처리 중...
                </span>
              ) : (
                <>💎 USDT 출금 신청하기</>
              )}
            </button>
          </form>
        </section>

        {/* 출금 내역 타임라인 */}
        <section>
          <h2 className="text-lg font-bold text-[#9B59B6] mb-6 flex items-center gap-2">
            📋 출금 내역
          </h2>

          {withdrawals.length === 0 ? (
            <div
              className="p-8 rounded-2xl text-center"
              style={{
                background: 'rgba(155,89,182,0.05)',
                border: '1px solid rgba(155,89,182,0.1)',
              }}
            >
              <p className="text-white/40">아직 출금 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {withdrawals.map((w, index) => (
                <div
                  key={w.id}
                  className="relative pl-8"
                  style={{
                    borderLeft: index < withdrawals.length - 1 ? '2px solid rgba(155,89,182,0.2)' : 'none',
                  }}
                >
                  {/* 타임라인 점 */}
                  <div
                    className="absolute left-0 top-0 w-4 h-4 rounded-full -translate-x-[9px]"
                    style={{
                      background:
                        w.status === 'PENDING'
                          ? '#F59E0B'
                          : w.status === 'REJECTED'
                          ? '#EF4444'
                          : '#26A17B',
                      boxShadow: `0 0 10px ${
                        w.status === 'PENDING' ? '#F59E0B' : w.status === 'REJECTED' ? '#EF4444' : '#26A17B'
                      }40`,
                    }}
                  />

                  {/* 카드 */}
                  <div
                    className="p-5 rounded-2xl mb-4"
                    style={{
                      background: 'linear-gradient(180deg, rgba(155,89,182,0.08) 0%, rgba(232,180,184,0.05) 100%)',
                      border: '1px solid rgba(155,89,182,0.15)',
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xl font-bold text-[#26A17B]">
                          {w.usdtAmount.toFixed(2)} USDT
                        </p>
                        <p className="text-sm text-white/50">
                          {w.coinAmount.toLocaleString()} 코인
                        </p>
                      </div>
                      {getStatusBadge(w.status)}
                    </div>

                    <div className="text-sm text-white/60 space-y-1">
                      <p className="flex items-center gap-2">
                        <span>{NETWORK_INFO[w.network]?.icon || '🔘'}</span>
                        <span>{w.network}</span>
                      </p>
                      <p className="font-mono text-xs break-all">
                        {w.walletAddress}
                      </p>
                      <p>신청: {formatDate(w.requestedAt)}</p>
                      {w.processedAt && <p>처리: {formatDate(w.processedAt)}</p>}
                    </div>

                    {/* 트랜잭션 해시 */}
                    {w.txHash && (
                      <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-xs text-emerald-400 mb-1">트랜잭션 해시</p>
                        <button
                          onClick={() => copyToClipboard(w.txHash!)}
                          className="font-mono text-xs text-white/70 break-all hover:text-white transition-colors"
                        >
                          {w.txHash} 📋
                        </button>
                      </div>
                    )}

                    {w.status === 'REJECTED' && w.rejectedReason && (
                      <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-sm text-red-400">
                          <span className="font-semibold">반려 사유:</span> {w.rejectedReason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
