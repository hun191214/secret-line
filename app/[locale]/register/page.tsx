'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function RegisterPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'MEMBER' | 'COUNSELOR'>('MEMBER');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name, role }),
      });

      const data = await response.json();

      if (data.success) {
        alert(t('auth.registerSuccess'));
        router.push(`/${locale}/login`);
      } else {
        setError(data.message || t('common.error'));
        setIsLoading(false);
      }
    } catch (err) {
      setError(t('common.error'));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 및 타이틀 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#D4AF37' }}>
            {t('common.siteName')}
          </h1>
          <p className="text-gray-400">{t('home.title')}</p>
        </div>

        {/* 회원가입 폼 */}
        <div className="bg-gray-900 border border-[#D4AF37]/30 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-semibold mb-6" style={{ color: '#D4AF37' }}>
            {t('auth.registerTitle')}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 역할 선택 */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-3">
                {t('auth.selectRole')}
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRole('MEMBER')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    role === 'MEMBER'
                      ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                      : 'border-gray-700 bg-black hover:border-gray-600'
                  }`}
                >
                  <div className="text-3xl mb-2">👤</div>
                  <div className={`font-medium ${role === 'MEMBER' ? 'text-[#D4AF37]' : 'text-gray-300'}`}>
                    {t('auth.member')}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('COUNSELOR')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    role === 'COUNSELOR'
                      ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                      : 'border-gray-700 bg-black hover:border-gray-600'
                  }`}
                >
                  <div className="text-3xl mb-2">👩‍⚕️</div>
                  <div className={`font-medium ${role === 'COUNSELOR' ? 'text-[#D4AF37]' : 'text-gray-300'}`}>
                    {t('auth.counselor')}
                  </div>
                </button>
              </div>
            </div>

            {/* 닉네임 입력 */}
            <div>
              <label htmlFor="name" className="block text-gray-300 text-sm font-medium mb-2">
                {t('auth.name')}
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors"
                placeholder={t('auth.name')}
              />
            </div>

            {/* 이메일 입력 */}
            <div>
              <label htmlFor="email" className="block text-gray-300 text-sm font-medium mb-2">
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors"
                placeholder="your@email.com"
              />
            </div>

            {/* 비밀번호 입력 */}
            <div>
              <label htmlFor="password" className="block text-gray-300 text-sm font-medium mb-2">
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={4}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label htmlFor="confirmPassword" className="block text-gray-300 text-sm font-medium mb-2">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={4}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {/* 회원가입 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-lg font-semibold text-black transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              style={{
                backgroundColor: isLoading ? '#B8941F' : '#D4AF37',
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                  {t('common.loading')}
                </span>
              ) : (
                t('auth.registerButton')
              )}
            </button>
          </form>

          {/* 로그인 링크 */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              {t('auth.hasAccount')}{' '}
              <a
                href={`/${locale}/login`}
                className="font-medium hover:underline transition-colors"
                style={{ color: '#D4AF37' }}
              >
                {t('nav.login')}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

