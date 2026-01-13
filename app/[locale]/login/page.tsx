
'use client';
import { useMessages, useLocale } from 'next-intl';


export default function LoginPage() {
  const messages = useMessages();
  const locale = useLocale();

  // 번역 메시지 사용 예시 (messages['login.title'] 등)
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-[#0A0B10]">
      <div className="w-full max-w-md bg-white/5 rounded-2xl shadow-2xl p-8 border border-[#D4AF37]" style={{boxShadow:'0 0 32px #D4AF37, 0 0 8px #fff8'}}>
        <h1 className="text-3xl font-bold text-center mb-6" style={{color:'#D4AF37', textShadow:'0 0 8px #D4AF37'}}>Secret Line</h1>
        <form className="flex flex-col gap-6">
          <div>
            <label htmlFor="login-id" className="block text-lg font-semibold mb-2" style={{color:'#D4AF37'}}>아이디</label>
            <input
              id="login-id"
              type="text"
              placeholder="아이디를 입력하세요"
              className="w-full px-4 py-3 rounded-xl bg-[#181A20] border border-[#D4AF37]/40 text-white placeholder-[#D4AF37]/40 focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/40 transition-all shadow-md"
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-lg font-semibold mb-2" style={{color:'#D4AF37'}}>비밀번호</label>
            <input
              id="login-password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              className="w-full px-4 py-3 rounded-xl bg-[#181A20] border border-[#D4AF37]/40 text-white placeholder-[#D4AF37]/40 focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/40 transition-all shadow-md"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[#D4AF37] text-[#0A0B10] font-bold text-lg shadow-lg hover:bg-[#bfa23a] transition-colors"
          >
            로그인
          </button>
        </form>
      </div>
    </main>
  );
}

