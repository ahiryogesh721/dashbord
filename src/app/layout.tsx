import Link from "next/link";
import type { Metadata } from "next";

import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Real Estate Leads Dashboard",
  description: "Lead lifecycle and performance dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="topbarInner">
            <Link href="/dashbord" className="brand">
              Real Estate CRM
            </Link>
            <nav className="topnav">
              <Link href="/dashbord">Dashboard</Link>
            </nav>
            <ThemeToggle />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
