import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vegas High/Low (Social Casino)",
  description: "Vegas-style High/Low using fake chips only. No cash value, no cash out."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
