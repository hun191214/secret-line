
export const dynamic = 'force-dynamic';
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function AdminTestToolsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations();
  
  const [email, setEmail] = useState('');
  const [coins, setCoins] = useState<number | ''>('');
  const [currentCoins, setCurrentCoins] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 코인 잔액 조회
  const handleGetBalance = async () => {
    if (!email) {
      setError(t('admin.testTools.emailRequired'));
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/update-coins?email=${encodeURIComponent(email)}`);
      const data = await response.json();

      if (data.success) {
        setCurrentCoins(data.user.coins);
        setSuccess(t('admin.testTools.getBalanceSuccess', { email, coins: data.user.coins }));
      } else {
        setError(data.message || t('admin.testTools.getBalanceError'));
        setCurrentCoins(null);
      }
    } catch (err) {
      setError(t('admin.testTools.queryError'));
      setCurrentCoins(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 코인 업데이트
  const handleUpdateCoins = async () => {
    if (!email) {
      setError(t('admin.testTools.emailRequired'));
      return;
    }

    if (typeof coins !== 'number' || coins < 0) {
      setError(t('admin.testTools.validCoinAmount'));
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/update-coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, coins }),
      });

      const data = await response.json();

      if (data.success) {
        setCurrentCoins(data.user.coins);
        setSuccess(data.message || t('admin.testTools.updateSuccess'));
        setCoins(''); // 입력 필드 초기화
      } else {
        setError(data.message || t('admin.testTools.updateError'));
      }
    } catch (err) {
      setError(t('admin.testTools.updateRequestError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="text-white">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#D4AF37' }}>
            {t('admin.testTools.title')}
          </h1>
          <p className="text-gray-400">{t('admin.testTools.subtitle')}</p>
        </div>

        {/* 코인 컨트롤 카드 */}
        <div
          className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 mb-8 shadow-2xl border-2"
          style={{ borderColor: '#D4AF37' }}
        >
          {/* 이메일 입력 */}
          <div className="mb-6">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              {t('admin.testTools.userEmail')}
            </label>
            <div className="flex gap-3">
              <input
                type="email"
                id="email"
                className="flex-grow px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                placeholder={t('admin.testTools.emailPlaceholder')}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                  setSuccess('');
                }}
              />
              <button
                onClick={handleGetBalance}
                disabled={isLoading || !email}
                className="px-6 py-3 rounded-lg font-semibold text-black transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                style={{
                  backgroundColor: isLoading ? '#B8941F' : '#D4AF37',
                }}
              >
                {isLoading ? t('admin.testTools.gettingBalance') : t('admin.testTools.getBalance')}
              </button>
            </div>
          </div>

          {/* 현재 코인 잔액 표시 */}
          {currentCoins !== null && (
            <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-[#D4AF37]/30">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                {t('admin.testTools.currentBalance')}
              </div>
              <div className="text-3xl font-bold text-white">
                {currentCoins.toLocaleString()}{' '}
                <span className="text-xl" style={{ color: '#D4AF37' }}>
                  {t('common.coins')}
                </span>
              </div>
            </div>
          )}

          {/* 코인 수량 입력 */}
          <div className="mb-6">
            <label
              htmlFor="coins"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              {t('admin.testTools.coinAmount')}
            </label>
            <input
              type="number"
              id="coins"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              placeholder={t('admin.testTools.coinAmountPlaceholder')}
              value={coins === '' ? '' : coins}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  setCoins('');
                } else {
                  const numValue = parseInt(value);
                  if (!isNaN(numValue) && numValue >= 0) {
                    setCoins(numValue);
                  }
                }
                setError('');
                setSuccess('');
              }}
              min="0"
            />
            <p className="mt-2 text-xs text-gray-500">
              {t('admin.testTools.coinAmountWarning')}
            </p>
          </div>

          {/* 업데이트 버튼 */}
          <button
            onClick={handleUpdateCoins}
            disabled={isLoading || !email || typeof coins !== 'number' || coins < 0}
            className="w-full py-4 px-6 rounded-lg font-semibold text-black transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            style={{
              backgroundColor: isLoading ? '#B8941F' : '#D4AF37',
              boxShadow: '0 0 20px rgba(212, 175, 55, 0.5)',
            }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                {t('admin.testTools.updating')}
              </span>
            ) : (
              t('admin.testTools.updateCoins')
            )}
          </button>

          {/* 에러/성공 메시지 */}
          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-300 text-sm">
              {success}
            </div>
          )}
        </div>

        {/* 안내 문구 */}
        <div className="text-center text-gray-500 text-xs space-y-2">
          <p>{t('admin.testTools.warning1')}</p>
          <p>{t('admin.testTools.warning2')}</p>
        </div>
      </div>
    </div>
  );
}


