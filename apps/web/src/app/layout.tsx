import "@nearvana/ui/globals.css";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { UserProvider } from "../context/UserContext";
import { TRPCReactProvider } from "../trpc/client";
import { Toaster } from "@nearvana/ui/components/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "nearvana",
  description: "A new way of linking builders and subcontractors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <TRPCReactProvider>
          <UserProvider>{children}</UserProvider>
        </TRPCReactProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
