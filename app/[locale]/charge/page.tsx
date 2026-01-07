'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function ChargePage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations();
  
  const [usdtAmount, setUsdtAmount] = useState<number>(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Mock USDT(TRC-20) 지갑 주소
  const walletAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

  useEffect(() => {
    // 인증 확인
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setIsAuthenticated(true);
        } else {
          router.push(`/${locale}/login`);
        }
      })
      .catch(() => {
        router.push(`/${locale}/login`);
      });
  }, [router, locale]);

  // 환율 계산: 1 USDT = 100 Coins
  const calculatedCoins = Math.floor(usdtAmount * 100);

  // 주소 복사
  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setError(t('common.error'));
    }
  };

  // 입금 완료 확인 (Mock)
  const handleDepositConfirm = async () => {
    if (!usdtAmount || usdtAmount <= 0) {
      setError(t('common.error'));
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const response = await fetch('/api/charge/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usdtAmount }),
      });

      const data = await response.json();

      if (data.success) {
        // 성공 시 마이페이지로 이동
        router.push(`/${locale}/mypage`);
        router.refresh();
      } else {
        setError(data.message || t('common.error'));
        setIsProcessing(false);
      }
    } catch (err) {
      setError(t('common.error'));
      setIsProcessing(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* 헤더 */}
      <header className="container mx-auto px-4 py-6 border-b border-[#D4AF37]/20">
        <div className="flex items-center justify-between">
          <a href={`/${locale}`} className="text-2xl font-bold" style={{ color: '#D4AF37' }}>
            {t('common.siteName')}
          </a>
          <nav className="flex gap-4 items-center">
            <a
              href={`/${locale}/mypage`}
              className="text-white/80 hover:text-white transition-colors text-sm"
            >
              {t('nav.mypage')}
            </a>
          </nav>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#D4AF37' }}>
            {t('charge.title')}
          </h1>
          <p className="text-gray-400">USDT (TRC-20) Only</p>
        </div>

        {/* 충전 카드 */}
        <div
          className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 mb-8 shadow-2xl border-2"
          style={{ borderColor: '#D4AF37' }}
        >
          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* USDT 금액 선택 */}
          <div className="mb-8">
            <label className="block text-gray-300 text-sm font-medium mb-3">
              {t('charge.selectAmount')}
            </label>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[10, 50, 100, 500].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setUsdtAmount(amount)}
                  className={`py-3 px-4 rounded-lg font-semibold transition-all transform ${
                    usdtAmount === amount
                      ? 'scale-[1.02]'
                      : 'hover:scale-[1.01]'
                  }`}
                  style={{
                    backgroundColor: usdtAmount === amount ? '#D4AF37' : '#1a1a1a',
                    color: usdtAmount === amount ? '#000000' : '#D4AF37',
                    border: `2px solid ${usdtAmount === amount ? '#D4AF37' : '#333333'}`,
                  }}
                >
                  {amount} USDT
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              step="1"
              value={usdtAmount}
              onChange={(e) => setUsdtAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white text-lg font-semibold text-center focus:outline-none focus:border-[#D4AF37] transition-colors"
              placeholder="Enter amount"
            />
          </div>

          {/* 환율 계산 결과 */}
          <div className="mb-8 p-6 bg-black/50 rounded-xl border border-[#D4AF37]/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">Amount</span>
              <span className="text-2xl font-bold text-white">{usdtAmount} USDT</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
              <span>Rate</span>
              <span>1 USDT = 100 Coins</span>
            </div>
            <div className="border-t border-[#D4AF37]/30 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 font-medium">You will receive</span>
                <span className="text-3xl font-bold" style={{ color: '#D4AF37' }}>
                  {calculatedCoins.toLocaleString()} <span className="text-xl">{t('common.coins')}</span>
                </span>
              </div>
            </div>
          </div>

          {/* 지갑 주소 */}
          <div className="mb-8">
            <label className="block text-gray-300 text-sm font-medium mb-3">
              Deposit Address (USDT TRC-20)
            </label>
            <div className="flex gap-2">
              <div className="flex-1 px-4 py-3 bg-black border border-gray-700 rounded-lg text-white font-mono text-sm break-all">
                {walletAddress}
              </div>
              <button
                type="button"
                onClick={handleCopyAddress}
                className={`px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-[1.02] ${
                  copySuccess ? 'scale-[0.98]' : ''
                }`}
                style={{
                  backgroundColor: copySuccess ? '#B8941F' : '#D4AF37',
                  color: '#000000',
                }}
              >
                {copySuccess ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            {copySuccess && (
              <p className="mt-2 text-sm text-center" style={{ color: '#D4AF37' }}>
                Address copied to clipboard!
              </p>
            )}
          </div>

          {/* 안내 문구 */}
          <div className="mb-8 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-300 text-xs leading-relaxed">
              ⚠️ Important:
              <br />
              • Please use <strong>USDT (TRC-20)</strong> network only.
              <br />
              • Deposits via other networks cannot be recovered.
              <br />
              • Click confirm after completing the deposit.
            </p>
          </div>

          {/* 입금 완료 확인 버튼 */}
          <button
            type="button"
            onClick={handleDepositConfirm}
            disabled={isProcessing || usdtAmount <= 0}
            className="w-full py-4 px-4 rounded-lg font-semibold text-black text-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            style={{
              backgroundColor: isProcessing ? '#B8941F' : '#D4AF37',
            }}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                {t('charge.processing')}
              </span>
            ) : (
              t('charge.chargeButton')
            )}
          </button>
        </div>

        {/* 하단 안내 */}
        <div className="text-center">
          <p className="text-gray-500 text-xs mb-2">
            Coins will be credited automatically after deposit.
          </p>
          <a
            href={`/${locale}/mypage`}
            className="text-sm hover:underline transition-colors"
            style={{ color: '#D4AF37' }}
          >
            {t('nav.mypage')}
          </a>
        </div>
      </main>
    </div>
  );
}

