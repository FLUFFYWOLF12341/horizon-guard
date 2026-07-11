import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "Horizon Guard — DeFi Risk Copilot",
    description: "An AI pre-transaction guard and risk sandbox for HSK Chain users.",
    openGraph: {
      title: "Horizon Guard — DeFi Risk Copilot",
      description: "Understand the risk before you sign.",
      images: [{ url: "/og.png", width: 1731, height: 909, alt: "Horizon Guard risk copilot" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Horizon Guard — DeFi Risk Copilot",
      description: "Understand the risk before you sign.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
