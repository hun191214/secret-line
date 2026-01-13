import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
};

// 더미 데이터(실제 구현 시 DB/API 연동 필요)
async function getDashboardStats() {
  // 실제로는 서버에서 유저, settlement, call 데이터 fetch 필요
  // 아래는 예시용 mock 데이터
  return {
    user: { milliGold: 123450 }, // 누적 수익 (milliGold)
    todaySettlement: 23450,      // 오늘의 수익 (milliGold)
    todayCallDuration: 3720      // 오늘 통화 시간 (초)
  };
}

export default async function MinimalPage({ params }: Props) {
  const { locale } = await params;
  const messages = await getMessages();
  const { user, todaySettlement, todayCallDuration } = await getDashboardStats();


  // milliGold → Gold 변환 (정밀, 소수점 3자리, 오차 방지)
  function formatGold(milliGold: number): string {
    // 1 Gold = 1000 milliGold
    // toFixed(3)로 소수점 3자리, BigInt는 필요 없으나 오차 방지 위해 곱셈 후 나눗셈
    const gold = Math.round((milliGold * 1000) / 1000) / 1000;
    return gold.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  }

  // 통화 시간 변환 (시:분:초)
  function formatDuration(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0B10] py-16 px-4">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-12 text-center tracking-tight" style={{color:'#D4AF37', textShadow:'0 2px 24px #000, 0 0 8px #D4AF37'}}>Counselor Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
          {/* 누적 수익 카드 */}
          <div className="backdrop-blur-lg bg-[#0A0B10] border border-[#D4AF37] rounded-3xl shadow-xl p-8 flex flex-col items-center" style={{boxShadow:'0 0 32px #D4AF37, 0 0 16px #fff2'}}>
            <div className="text-5xl mb-4" style={{color:'#D4AF37', textShadow:'0 0 16px #D4AF37, 0 0 8px #fff8'}}>💰</div>
            <div className="text-3xl font-bold mb-2" style={{color:'#D4AF37', textShadow:'0 0 12px #D4AF37, 0 0 4px #fff8'}}>{formatGold(user.milliGold)} Gold</div>
            <div className="text-[#D4AF37] text-lg font-medium" style={{textShadow:'0 0 8px #D4AF37'}}>누적 수익</div>
          </div>
          {/* 오늘의 수익 카드 */}
          <div className="backdrop-blur-lg bg-[#0A0B10] border border-[#D4AF37] rounded-3xl shadow-xl p-8 flex flex-col items-center" style={{boxShadow:'0 0 32px #D4AF37, 0 0 16px #fff2'}}>
            <div className="text-5xl mb-4" style={{color:'#D4AF37', textShadow:'0 0 16px #D4AF37, 0 0 8px #fff8'}}>📈</div>
            <div className="text-3xl font-bold mb-2" style={{color:'#D4AF37', textShadow:'0 0 12px #D4AF37, 0 0 4px #fff8'}}>{formatGold(todaySettlement)} Gold</div>
            <div className="text-[#D4AF37] text-lg font-medium" style={{textShadow:'0 0 8px #D4AF37'}}>오늘의 수익</div>
          </div>
          {/* 통화 시간 카드 */}
          <div className="backdrop-blur-lg bg-[#0A0B10] border border-[#D4AF37] rounded-3xl shadow-xl p-8 flex flex-col items-center" style={{boxShadow:'0 0 32px #D4AF37, 0 0 16px #fff2'}}>
            <div className="text-5xl mb-4" style={{color:'#D4AF37', textShadow:'0 0 16px #D4AF37, 0 0 8px #fff8'}}>⏱️</div>
            <div className="text-3xl font-bold mb-2" style={{color:'#D4AF37'}}>{formatDuration(todayCallDuration)}</div>
            <div className="text-[#D4AF37] text-lg font-medium" style={{textShadow:'0 0 8px #D4AF37'}}>오늘의 통화 시간</div>
          </div>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
