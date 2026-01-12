
'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface CoinLog {
  id: string;
  grantedAt: string;
  grantedBy: string;
  recipientEmail: string;
  recipientName: string;
  milliAmount: number; // 1/1000 Gold 단위
  reason: string;
  previousMilliGold: number; // 1/1000 Gold 단위
  newMilliGold: number; // 1/1000 Gold 단위
}

interface Stats {
  totalMilliAmount: number; // 1/1000 Gold 단위
  totalCount: number;
  todayMilliAmount: number; // 1/1000 Gold 단위
  todayCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export default function CoinLogsPage() {
  const params = useParams();
  const locale = params.locale as string;

  const [logs, setLogs] = useState<CoinLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = async (page: number = 1, searchTerm: string = '') => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }

      const response = await fetch(`/api/admin/coin-logs?${params}`);
      const data = await response.json();

      if (data.success) {
        // 서버 응답이 coins 기반이면 변환 필요 (예: amount → milliAmount = amount * 1000)
        setLogs((data.logs || []).map((log: any) => ({
          ...log,
          milliAmount: log.amount !== undefined ? log.amount * 1000 : 0,
          previousMilliGold: log.previousBalance !== undefined ? log.previousBalance * 1000 : 0,
          newMilliGold: log.newBalance !== undefined ? log.newBalance * 1000 : 0,
        })));
        setPagination(data.pagination);
        setStats(data.stats ? {
          ...data.stats,
          totalMilliAmount: data.stats.totalAmount !== undefined ? data.stats.totalAmount * 1000 : 0,
          todayMilliAmount: data.stats.todayAmount !== undefined ? data.stats.todayAmount * 1000 : 0,
        } : null);
      } else {
        setError(data.message || '코인 지급 내역을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('코인 지급 내역을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1, search);
  }, [search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handlePageChange = (newPage: number) => {
    fetchLogs(newPage, search);
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

  // 권한 오류 화면
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
              style={{ backgroundColor: '#D4AF37' }}
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
      <div className="max-w-7xl mx-auto">
        {/* 페이지 타이틀 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#D4AF37' }}>
            💰 코인 지급 내역
          </h1>
          <p className="text-gray-400">관리자가 지급한 코인 내역을 확인합니다.</p>
        </div>

        {/* 통계 카드 (SUPER만) */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div
              className="p-5 rounded-2xl text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.05) 100%)',
                border: '1px solid rgba(212,175,55,0.3)',
              }}
            >
              <p className="text-xs text-[#D4AF37]/70 mb-1">전체 지급 횟수</p>
              <p className="text-2xl font-bold text-[#D4AF37]">{stats.totalCount.toLocaleString()}회</p>
            </div>
            <div
              className="p-5 rounded-2xl text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
                border: '1px solid rgba(16,185,129,0.3)',
              }}
            >
              <p className="text-xs text-emerald-400/70 mb-1">전체 지급량</p>
              <p className="text-2xl font-bold text-emerald-400">{Math.floor(stats.totalMilliAmount/1000).toLocaleString()} Gold</p>
            </div>
            <div
              className="p-5 rounded-2xl text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
                border: '1px solid rgba(59,130,246,0.3)',
              }}
            >
              <p className="text-xs text-blue-400/70 mb-1">오늘 지급 횟수</p>
              <p className="text-2xl font-bold text-blue-400">{stats.todayCount.toLocaleString()}회</p>
            </div>
            <div
              className="p-5 rounded-2xl text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(155,89,182,0.15) 0%, rgba(155,89,182,0.05) 100%)',
                border: '1px solid rgba(155,89,182,0.3)',
              }}
            >
              <p className="text-xs text-purple-400/70 mb-1">오늘 지급량</p>
              <p className="text-2xl font-bold text-purple-400">{Math.floor(stats.todayMilliAmount/1000).toLocaleString()} Gold</p>
            </div>
          </div>
        )}

        {/* 검색 */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="이메일 또는 사유로 검색..."
              className="flex-1 px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-colors"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-lg font-semibold text-black transition-all hover:scale-105"
              style={{ backgroundColor: '#D4AF37' }}
            >
              🔍 검색
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                }}
                className="px-4 py-3 rounded-lg font-semibold bg-gray-700 text-white hover:bg-gray-600 transition-colors"
              >
                초기화
              </button>
            )}
          </div>
        </form>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* 테이블 */}
        <div
          className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border overflow-hidden"
          style={{ borderColor: 'rgba(212,175,55,0.3)' }}
        >
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-400">불러오는 중...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              {search ? '검색 결과가 없습니다.' : '코인 지급 내역이 없습니다.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 bg-black/50">
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">지급일시</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">지급자</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">수령자</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">금액(Gold)</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">사유</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">지급 전(Gold)</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-medium">지급 후(Gold)</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {formatDate(log.grantedAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                          👑 {log.grantedBy}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white font-medium">{log.recipientName}</p>
                          <p className="text-xs text-gray-500">{log.recipientEmail}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-green-400 font-semibold">+{Math.floor(log.milliAmount/1000).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate" title={log.reason}>
                        {log.reason}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {Math.floor(log.previousMilliGold/1000).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-[#D4AF37] font-medium">
                        {Math.floor(log.newMilliGold/1000).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 페이지네이션 */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t border-gray-800">
              <p className="text-sm text-gray-400">
                총 {pagination.totalCount.toLocaleString()}건 중 {((pagination.page - 1) * pagination.limit) + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.totalCount)}건
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                >
                  ◀ 이전
                </button>
                <span className="px-3 py-1 text-gray-400">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                >
                  다음 ▶
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

