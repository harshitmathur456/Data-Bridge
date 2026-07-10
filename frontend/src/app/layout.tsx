import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DataBridge AI — Smart CSV Importer",
  description: "Integrate, parse, and map any CSV format to your CRM using intelligent AI schemas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f9f9f7] text-[#171717] font-sans flex flex-col">
        {children}
      </body>
    </html>
  );
}
