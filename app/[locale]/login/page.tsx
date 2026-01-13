
'use client';
import { useMessages, useLocale } from 'next-intl';


export default function LoginPage() {
  const messages = useMessages();
  const locale = useLocale();

  // 번역 메시지 사용 예시 (messages['login.title'] 등)
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-3xl font-bold">Secret Line</h1>
      <p className="mt-4 text-xl">로그인 페이지 준비 중입니다...</p>
    </main>
  );
}

