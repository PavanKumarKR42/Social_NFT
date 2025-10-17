import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  themeColor: "#0052ff",
};

export const metadata: Metadata = {
  title: "Social NFT Platform",
  description: "Share your moments and mint them as NFTs on Base Mainnet",
  keywords: ["NFT", "Social", "Base", "Web3", "Blockchain"],
  authors: [{ name: "Social NFT Platform" }],
  openGraph: {
    title: "Social NFT Platform",
    description: "Share your moments and mint them as NFTs on Base Mainnet",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#0052ff" />
      </head>
      <body>{children}</body>
    </html>
  );
}