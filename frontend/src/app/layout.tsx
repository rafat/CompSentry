import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/providers/Web3Provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "CompSentry | Autonomous SLA Micro-Settlement for AI Compute on Monad",
  description: "Deterministic micro-epoch SLA arbitration, Chainlink CRE consensus, and dual-collateral performance vaults on Monad.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} bg-cyber-bg text-gray-100 antialiased min-h-screen flex flex-col font-sans`}>
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
