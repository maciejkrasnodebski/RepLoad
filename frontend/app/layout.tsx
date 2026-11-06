import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepLoad",
  description: "Planuj treningi, zapisuj wyniki i śledź swój progres.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}