import type { Metadata, Viewport } from "next";
import { Noto_Sans_TC } from "next/font/google";
import "./globals.css"; // Global styles

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-tc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Enhanced LRC Studio",
  description: "A desktop-like web app for syncing lyrics",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0f2f5" },
    { media: "(prefers-color-scheme: dark)", color: "#16191E" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={notoSansTC.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (function() {
            const isTauri = typeof window !== 'undefined' && (
              window.__TAURI__ || 
              window.__TAURI_INTERNALS__
            );
            const electronAPI = typeof window !== 'undefined' && window.electronAPI;
            const isElectron = !!(electronAPI && electronAPI.isElectron);
            const ua = navigator.userAgent.toLowerCase();
            
            // Set defaults for web
            document.documentElement.style.setProperty('--top-toolbar-display', 'flex');

            // Force viewport-fit=cover for mobile
            const viewportMeta = document.querySelector('meta[name="viewport"]');
            if (viewportMeta) {
                let content = viewportMeta.getAttribute('content');
                if (!content.includes('viewport-fit=cover')) {
                    viewportMeta.setAttribute('content', content + ', viewport-fit=cover');
                }
            }

            if (isElectron && electronAPI.shell) {
                document.documentElement.classList.add('electron-shell');
                var sh = electronAPI.shell;
                if (sh.titlebarLeftPadding) {
                    document.documentElement.style.setProperty('--titlebar-left-padding', sh.titlebarLeftPadding);
                }
                if (sh.titlebarRightPadding && !sh.useCustomWindowControls) {
                    document.documentElement.style.setProperty('--titlebar-right-padding', sh.titlebarRightPadding);
                }
                if (sh.useCustomWindowControls) {
                    document.documentElement.style.setProperty('--titlebar-right-padding', '0px');
                }
            } else if (isTauri) {
                if (ua.includes('macintosh') || ua.includes('mac os x')) {
                    document.documentElement.style.setProperty('--titlebar-left-padding', '70px');
                } else if (ua.includes('linux')) {
                    document.documentElement.style.setProperty('--top-toolbar-display', 'none');
                }
            }
          })()
        `,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
