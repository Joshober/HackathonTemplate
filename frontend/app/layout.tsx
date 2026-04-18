import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Travel Companion | Lockton",
  description:
    "Enterprise travel made calmer: plan, approve, travel, and return with clear progress, AI assistance, and a mobile-first experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${spaceGrotesk.variable} font-sans antialiased bg-gray-50 text-gray-900 selection:bg-primary selection:text-white`}
      >
        {children}
      </body>
    </html>
  );
}
