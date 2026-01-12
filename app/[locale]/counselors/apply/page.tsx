'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function CounselorApplyPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations();

  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('');
  const [voiceTone, setVoiceTone] = useState<string[]>([]);
  const [specialty, setSpecialty] = useState('');
  const [bio, setBio] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 국가 목록
  const countries = [
    { code: 'KR', name: '대한민국', flag: '🇰🇷' },
    { code: 'JP', name: '일본', flag: '🇯🇵' },
    { code: 'US', name: '미국', flag: '🇺🇸' },
    { code: 'CN', name: '중국', flag: '🇨🇳' },
    { code: 'VN', name: '베트남', flag: '🇻🇳' },
    { code: 'PH', name: '필리핀', flag: '🇵🇭' },
    { code: 'TH', name: '태국', flag: '🇹🇭' },
    { code: 'OTHER', name: '기타', flag: '🌍' },
  ];

  // 보이스 톤 옵션
  const voiceToneOptions = [
    '부드러운',
    '차분한',
    '따뜻한',
    '친근한',
    '세련된',
    '모던한',
    '고급스러운',
    '감성적인',
  ];

  const handleVoiceToneToggle = (tone: string) => {
    setVoiceTone((prev) => {
      if (prev.includes(tone)) {
        return prev.filter((t) => t !== tone);
      } else {
        if (prev.length < 3) {
          return [...prev, tone];
        } else {
          alert('보이스 톤은 최대 3개까지 선택할 수 있습니다.');
          return prev;
        }
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // 유효성 검사
    if (!displayName.trim()) {
      setError('활동명을 입력해주세요.');
      return;
    }

    if (!country) {
      setError('거주 국가를 선택해주세요.');
      return;
    }

    if (voiceTone.length === 0) {
      setError('보이스 톤을 최소 1개 이상 선택해주세요.');
      return;
    }

    if (!specialty.trim()) {
      setError('전문 분야를 입력해주세요.');
      return;
    }

    if (!bio.trim() || bio.trim().length < 20) {
      setError('자기소개는 최소 20자 이상 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/counselors/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: displayName.trim(),
          country,
          voiceTone,
          specialty: specialty.trim(),
          bio: bio.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        setTimeout(() => {
          if (data.profile.status === 'APPROVED') {
            // router.push(`/${locale}/counselor/dashboard`);
          } else {
            router.push(`/${locale}/mypage`);
          }
        }, 2000);
      } else {
        setError(data.message || '신청 중 오류가 발생했습니다.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('신청 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#D4AF37' }}>
            {t('common.siteName')}
          </h1>
          <p className="text-gray-400">상담사 신청</p>
        </div>

        {/* 신청 폼 */}
        <div
          className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 shadow-2xl border-2"
          style={{ borderColor: '#D4AF37' }}
        >
          <h2 className="text-2xl font-semibold mb-6" style={{ color: '#D4AF37' }}>
            상담사 신청서
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-900/30 border border-green-500/50 rounded-lg text-green-300 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 활동명 */}
            <div>
              <label htmlFor="displayName" className="block text-gray-300 text-sm font-medium mb-2">
                활동명 <span className="text-red-400">*</span>
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors"
                placeholder="고객에게 표시될 이름을 입력해주세요"
                disabled={isLoading}
              />
            </div>

            {/* 거주 국가 */}
            <div>
              <label htmlFor="country" className="block text-gray-300 text-sm font-medium mb-2">
                거주 국가 <span className="text-red-400">*</span>
              </label>
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#D4AF37] transition-colors appearance-none"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23D4AF37' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")",
                  backgroundPosition: 'right 0.75rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em',
                }}
                disabled={isLoading}
              >
                <option value="" className="bg-black">
                  국가를 선택하세요
                </option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code} className="bg-black">
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 보이스 톤 */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-3">
                보이스 톤 (최대 3개) <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-4 gap-3">
                {voiceToneOptions.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => handleVoiceToneToggle(tone)}
                    disabled={isLoading}
                    className={`px-4 py-2 rounded-lg border-2 transition-all text-sm ${
                      voiceTone.includes(tone)
                        ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]'
                        : 'border-gray-700 bg-black text-gray-300 hover:border-gray-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
              {voiceTone.length > 0 && (
                <p className="mt-2 text-xs text-gray-400">
                  선택됨: {voiceTone.join(', ')}
                </p>
              )}
            </div>

            {/* 전문 분야 */}
            <div>
              <label htmlFor="specialty" className="block text-gray-300 text-sm font-medium mb-2">
                전문 분야 <span className="text-red-400">*</span>
              </label>
              <input
                id="specialty"
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors"
                placeholder="예: 연애 상담, 심리 상담, 친구 대화 등"
                disabled={isLoading}
              />
            </div>

            {/* 자기소개 */}
            <div>
              <label htmlFor="bio" className="block text-gray-300 text-sm font-medium mb-2">
                자기소개 <span className="text-red-400">*</span>
                <span className="text-xs text-gray-500 ml-2">(최소 20자)</span>
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors resize-none"
                placeholder="고객에게 어필할 수 있는 자기소개를 작성해주세요. 최소 20자 이상 작성해주세요."
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                {bio.length}자 / 최소 20자
              </p>
            </div>

            {/* 제출 버튼 */}
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
                  신청 중...
                </span>
              ) : (
                '신청 제출'
              )}
            </button>
          </form>

          {/* 안내 문구 */}
          <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <p className="text-xs text-gray-400">
              * 신청 후 관리자 검토를 거쳐 승인됩니다. 자동 승인 모드가 활성화된 경우 즉시 승인됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

