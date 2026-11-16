import type { Metadata, Viewport } from "next";
import { AskProvider } from "@/components/Ask";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

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
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#f7f5f0" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AskProvider>
          <main
            className="app-shell mx-auto min-h-dvh max-w-md px-4"
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
