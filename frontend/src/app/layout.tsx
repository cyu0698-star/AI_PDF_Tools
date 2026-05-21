import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "I Love 财务表单 - AI 智能财务文件处理",
  description: "AI 驱动的财务文件自动化处理平台，一键转换财务文件为标准化表单",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
