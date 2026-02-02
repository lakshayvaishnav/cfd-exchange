import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "100xness - Turn Market Volatility into 100x Returns",
  description: "Buy with upto 100x leverage, because 10x ain't enough",
  openGraph: {
    title: "100xness - Turn Market Volatility into 100x Returns",
    description: "Buy with upto 100x leverage, because 10x ain't enough",
    images: [
      {
        url: "/images/OG.png",
        width: 1200,
        height: 630,
        alt: "100xness - Turn Market Volatility into 100x Returns",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "100xness - Turn Market Volatility into 100x Returns",
    description: "Buy with upto 100x leverage, because 10x ain't enough",
    images: ["/images/OG.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
