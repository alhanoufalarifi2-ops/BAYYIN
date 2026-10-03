import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "بَيِّن | BAYYIN — تحقّق قبل أن تنشر",
  description:
    "مساحة عمل للتحقق من المحتوى ومصادره قبل النشر: تحليل النص إلى ادعاءات قابلة للتحقق، وعرض حالة كل ادعاء وسبب تصنيفه.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F7F6F2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${arabic.variable} font-[family-name:var(--font-arabic)] antialiased`}>
        {children}
      </body>
    </html>
  );
}
