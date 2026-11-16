import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { AskProvider } from "@/components/Ask";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

// Display: headlines and big figures. Body/UI: Inter. Numbers: JetBrains Mono.
const display = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["500", "600"] });

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
      <body className={`${display.variable} ${sans.variable} ${mono.variable}`}>
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
