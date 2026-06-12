import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "../lib/providers";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jbMono = JetBrains_Mono({ variable: "--font-mono-jb", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SAI Credit — Admin Portal",
  description: "Insurance & Loan Management System — Administration",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jbMono.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Apply saved theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('crm-theme');var d=t? t==='dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
