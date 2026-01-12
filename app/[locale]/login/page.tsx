'use client';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  // 1. Next.js 16 규격에 따라 params를 await 합니다.
  const { locale } = await params;
  
  // 2. 서버 사이드에서 번역 메시지를 가져옵니다.
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <h1 className="text-3xl font-bold">Secret Line</h1>
        <p className="mt-4 text-xl">로그인 페이지 준비 중입니다...</p>
      </main>
    </NextIntlClientProvider>
  );
}

