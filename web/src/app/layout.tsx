import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { AskProvider } from "@/components/Ask";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

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
    { media: "(prefers-color-scheme: light)", color: "#f7f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#f7f5f2" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.variable}`}>
        <AskProvider>
          <main
            className="mx-auto min-h-dvh max-w-md px-4"
            style={{ paddingBottom: "calc(var(--dock-h) + env(safe-area-inset-bottom) + 24px)" }}
          >
            {children}
          </main>
          <BottomNav />
        </AskProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
