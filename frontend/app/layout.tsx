import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Muses: Write And Share",
  description: "智能将素材转换为个性化博客文章",
  icons: {
    icon: [
      {
        url: "/materials/images/icons/logov2.svg?v=4",
        type: "image/svg+xml",
        sizes: "any",
      },
      {
        url: "/favicon.png?v=2",
        type: "image/png",
        sizes: "any",
      },
    ],
    shortcut: "/materials/images/icons/logov2.svg?v=4",
    apple: "/materials/images/icons/logov2.svg?v=4"
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${inter.className} font-serif`} style={{ fontFamily: '"Times New Roman", Times, serif' }}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange={false}
        >
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}