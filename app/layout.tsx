import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Secret Line - Emotional Voice Consultation",
  description: "Experience genuine emotional conversations anywhere in the world",
};

// 이 레이아웃은 API 라우트와 루트 리다이렉션만 처리
// 실제 페이지 레이아웃은 app/[locale]/layout.tsx에서 처리
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
