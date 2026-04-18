import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Rajdhani } from "next/font/google";

import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

const displayFont = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: {
    default: "LeaveDefensePortal",
    template: "%s | LeaveDefensePortal",
  },
  description:
    "A modern operational leave portal with route protection, command visibility, and policy-aware request workflows.",
  applicationName: "LeaveDefensePortal",
  icons: {
    icon: "/images/dod-seal.png",
    shortcut: "/images/dod-seal.png",
    apple: "/images/dod-seal.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171d13",
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
