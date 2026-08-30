import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '東洋新聞：日式版式 × 中文新闻源',
  description: 'asahi.com 风格版式复刻，数据来自各媒体公开 RSS。设计对照演示。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hans">
      <body>{children}</body>
    </html>
  );
}
