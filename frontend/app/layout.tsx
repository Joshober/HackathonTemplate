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
    <html lang="en" className="dark" data-scroll-behavior="smooth">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- Material Symbols for icons */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${spaceGrotesk.variable} font-sans antialiased bg-background-dark text-slate-100 selection:bg-primary selection:text-background-dark`}>
        {children}
      </body>
    </html>
  );
}
