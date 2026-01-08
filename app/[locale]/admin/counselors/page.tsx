'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { RegionCode, REGIONS } from '@/lib/regions';
import { getCountryFlag, getCountryName } from '@/lib/country';

interface Counselor {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  status: 'ONLINE' | 'OFFLINE';
  region: string | null;
  country: string | null;
  languages: string | null;
  coins: number;
  createdAt: string;
}

export default function AdminCounselorsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations();
  
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  
  // 지역 변경 모달 상태
  const [regionModal, setRegionModal] = useState<{
    isOpen: boolean;
    counselor: Counselor | null;
    selectedRegion: RegionCode | '';
  }>({
    isOpen: false,
    counselor: null,
    selectedRegion: '',
  });

  // 상담사 목록 로드
  const loadCounselors = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/counselors');
      const data = await response.json();
      
      if (data.success) {
        setCounselors(data.counselors);
      } else {
        setError(data.message || '상담사 목록을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('상담사 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCounselors();
  }, []);

  // 테스트 상담사 생성
  const handleCreateTestData = async () => {
    setIsCreating(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch('/api/admin/counselors/create-test', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        setSuccess(t('admin.counselors.createSuccess'));
        await loadCounselors(); // 목록 새로고침
      } else {
        setError(data.message || t('admin.counselors.createError'));
      }
    } catch (err) {
      setError(t('admin.counselors.createError'));
    } finally {
      setIsCreating(false);
    }
  };

  // 지역 변경 모달 열기
  const openRegionModal = (counselor: Counselor) => {
    setRegionModal({
      isOpen: true,
      counselor,
      selectedRegion: (counselor.region as RegionCode) || '',
    });
  };

  // 지역 변경 적용
  const handleUpdateRegion = async () => {
    if (!regionModal.counselor || !regionModal.selectedRegion) {
      setError('지역을 선택해주세요.');
      return;
    }

    const counselorId = regionModal.counselor.id;
    setUpdatingIds(prev => new Set(prev).add(counselorId));
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/counselors/${counselorId}/update-region`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: regionModal.selectedRegion }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(t('admin.counselors.updateRegionSuccess'));
        setRegionModal({ isOpen: false, counselor: null, selectedRegion: '' });
        await loadCounselors(); // 목록 새로고침
      } else {
        setError(data.message || t('admin.counselors.updateRegionError'));
      }
    } catch (err) {
      setError(t('admin.counselors.updateRegionError'));
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(counselorId);
        return next;
      });
    }
  };

  // 상태 전환
  const handleToggleStatus = async (counselor: Counselor) => {
    setUpdatingIds(prev => new Set(prev).add(counselor.id));
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/counselors/${counselor.id}/toggle-status`, {
        method: 'PATCH',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(t('admin.counselors.toggleStatusSuccess'));
        await loadCounselors(); // 목록 새로고침
      } else {
        setError(data.message || t('admin.counselors.toggleStatusError'));
      }
    } catch (err) {
      setError(t('admin.counselors.toggleStatusError'));
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(counselor.id);
        return next;
      });
    }
  };

  // 상담사 삭제
  const handleDeleteCounselor = async (counselor: Counselor) => {
    // 확인 창
    if (!confirm(t('admin.counselors.deleteConfirm'))) {
      return;
    }

    setUpdatingIds(prev => new Set(prev).add(counselor.id));
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/counselors/${counselor.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(t('admin.counselors.deleteSuccess'));
        await loadCounselors(); // 목록 새로고침
      } else {
        setError(data.message || t('admin.counselors.deleteError'));
      }
    } catch (err) {
      setError(t('admin.counselors.deleteError'));
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(counselor.id);
        return next;
      });
    }
  };

  // 지역 이름 가져오기
  const getRegionName = (region: string | null): string => {
    if (!region) return t('admin.counselors.regions.NONE');
    const regionKey = region as keyof typeof REGIONS;
    if (REGIONS[regionKey]) {
      return REGIONS[regionKey].emoji + ' ' + REGIONS[regionKey].nameKo;
    }
    return region;
  };

  return (
    <div className="text-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#D4AF37' }}>
            {t('admin.counselors.title')}
          </h1>
          <p className="text-gray-400">{t('admin.counselors.subtitle')}</p>
        </div>

        {/* 테스트 데이터 생성 버튼 */}
        <div className="mb-6">
          <button
            onClick={handleCreateTestData}
            disabled={isCreating}
            className="px-6 py-3 rounded-lg font-semibold text-black transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            style={{
              backgroundColor: isCreating ? '#B8941F' : '#D4AF37',
            }}
          >
            {isCreating ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                {t('admin.counselors.creating')}
              </span>
            ) : (
              t('admin.counselors.createTestData')
            )}
          </button>
        </div>

        {/* 에러/성공 메시지 */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-500/50 rounded-lg text-green-300">
            {success}
          </div>
        )}

        {/* 상담사 테이블 */}
        <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 shadow-2xl border-2" style={{ borderColor: '#D4AF37' }}>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-400">{t('admin.counselors.loading')}</p>
            </div>
          ) : counselors.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              {t('admin.counselors.noCounselors')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">{t('admin.table.name')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">{t('admin.table.email')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">{t('admin.table.status')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">국가</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">{t('admin.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {counselors.map((counselor) => {
                    const isUpdating = updatingIds.has(counselor.id);
                    return (
                      <tr key={counselor.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white">
                          {counselor.displayName || counselor.name || counselor.email?.split('@')[0] || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{counselor.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              counselor.status === 'ONLINE'
                                ? 'bg-green-900/50 text-green-300 border border-green-500/50'
                                : 'bg-gray-800 text-gray-400 border border-gray-700'
                            }`}
                          >
                            {counselor.status === 'ONLINE' ? t('admin.counselors.statusOnline') : t('admin.counselors.statusOffline')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {getCountryFlag(counselor.country)} {getCountryName(counselor.country)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openRegionModal(counselor)}
                              disabled={isUpdating}
                              className="px-3 py-1.5 text-xs rounded bg-blue-900/50 text-blue-300 border border-blue-500/50 hover:bg-blue-900/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {t('admin.counselors.changeRegion')}
                            </button>
                            <button
                              onClick={() => handleToggleStatus(counselor)}
                              disabled={isUpdating}
                              className="px-3 py-1.5 text-xs rounded bg-purple-900/50 text-purple-300 border border-purple-500/50 hover:bg-purple-900/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isUpdating ? t('admin.counselors.updating') : t('admin.counselors.toggleStatus')}
                            </button>
                            <button
                              onClick={() => handleDeleteCounselor(counselor)}
                              disabled={isUpdating}
                              className="px-3 py-1.5 text-xs rounded bg-red-900/50 text-red-300 border border-red-500/50 hover:bg-red-900/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isUpdating ? t('admin.counselors.deleting') : t('admin.counselors.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 지역 변경 모달 */}
      {regionModal.isOpen && regionModal.counselor && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 max-w-md w-full mx-4 border-2" style={{ borderColor: '#D4AF37' }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#D4AF37' }}>
              {t('admin.counselors.changeRegion')}
            </h2>
            <p className="text-gray-400 mb-2">{t('admin.counselors.selectRegion')}</p>
            <p className="text-sm text-gray-500 mb-6">
              {t('admin.counselors.currentRegion')}: {getRegionName(regionModal.counselor.region)}
            </p>
            
            <div className="space-y-2 mb-6">
              {Object.entries(REGIONS).map(([code, data]) => (
                <label
                  key={code}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    regionModal.selectedRegion === code
                      ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="region"
                    value={code}
                    checked={regionModal.selectedRegion === code}
                    onChange={(e) => setRegionModal({ ...regionModal, selectedRegion: e.target.value as RegionCode })}
                    className="w-4 h-4"
                  />
                  <span className="text-lg">{data.emoji}</span>
                  <span className="text-white">{data.nameKo}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRegionModal({ isOpen: false, counselor: null, selectedRegion: '' })}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700 transition-colors"
              >
                {t('admin.counselors.cancel')}
              </button>
              <button
                onClick={handleUpdateRegion}
                disabled={!regionModal.selectedRegion || updatingIds.has(regionModal.counselor.id)}
                className="flex-1 px-4 py-2 rounded-lg font-semibold text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#D4AF37',
                }}
              >
                {updatingIds.has(regionModal.counselor.id) ? t('admin.counselors.updating') : t('admin.counselors.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

