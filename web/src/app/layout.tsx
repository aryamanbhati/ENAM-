import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { AskProvider } from "@/components/Ask";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader" });

export const metadata: Metadata = {
  title: "FINN",
  description: "What changed in your portfolio, and whether it needs you.",
  appleWebApp: { capable: true, title: "FINN", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#121211" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${newsreader.variable}`}>
        <AskProvider>
          <main className="mx-auto min-h-dvh max-w-md px-5 pb-36">{children}</main>
          <BottomNav />
        </AskProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
