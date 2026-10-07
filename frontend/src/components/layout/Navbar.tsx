"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Shield, Radio, Wallet, ExternalLink, ChevronDown, Check, Copy, LogOut } from "lucide-react";
import { shortenAddress } from "@/lib/formatting";
import { COMPSENTRY } from "@/config/compsentry";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/compute", label: "Compute" },
  { href: "/my-slas", label: "My SLAs" },
  { href: "/provider", label: "Provider" },
  { href: "/demo", label: "Live Demo" },
];

export function Navbar() {
  const pathname = usePathname();
  const { address, isConnected, chain } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();

  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="border-b border-cyber-border bg-cyber-bg/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-monad-700 to-monad-500 flex items-center justify-center shadow-lg shadow-monad-500/20 group-hover:scale-105 transition">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">COMP SENTRY</span>
              </div>
              <p className="text-[10px] text-gray-400 font-mono tracking-tight hidden sm:block">
                Compute SLA Protection Layer
              </p>
            </div>
          </Link>

          {/* Navigation items */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-mono transition ${
                    isActive
                      ? "text-white bg-cyber-card border border-cyber-border font-semibold shadow-sm"
                      : "text-gray-400 hover:text-gray-200 hover:bg-cyber-card/40"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side actions: Monad Badge & Wallet */}
        <div className="flex items-center gap-3">
          {/* Monad Testnet indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyber-card border border-cyber-border text-[11px] font-mono text-gray-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Monad Testnet</span>
          </div>

          {/* Wallet Button */}
          {isConnected && address ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 bg-cyber-card hover:bg-cyber-highlight border border-cyber-border text-white text-xs font-mono px-3.5 py-2 rounded-lg transition"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{shortenAddress(address)}</span>
                <ChevronDown className="h-3 w-3 text-gray-400" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-cyber-card border border-cyber-border shadow-2xl p-2 z-50 font-mono text-xs">
                  <div className="px-3 py-2 border-b border-cyber-border/60">
                    <span className="text-[10px] text-gray-400 block uppercase">Connected Account</span>
                    <span className="font-bold text-white text-xs break-all">{shortenAddress(address)}</span>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={copyAddress}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-cyber-bg rounded-lg text-gray-300 text-left transition"
                    >
                      <span className="flex items-center gap-2">
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copied ? "Copied!" : "Copy Address"}</span>
                      </span>
                    </button>

                    <a
                      href={COMPSENTRY.explorer.addressUrl(address)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between px-3 py-2 hover:bg-cyber-bg rounded-lg text-gray-300 transition"
                    >
                      <span className="flex items-center gap-2">
                        <ExternalLink className="h-3.5 w-3.5 text-cyan-400" />
                        <span>View on Explorer</span>
                      </span>
                    </a>

                    <button
                      onClick={() => {
                        disconnect();
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-rose-950/40 text-rose-400 rounded-lg text-left transition mt-1 border-t border-cyber-border/40"
                    >
                      <span className="flex items-center gap-2">
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Disconnect</span>
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                const injectedConnector = connectors.find((c) => c.id === "injected") || connectors[0];
                if (injectedConnector) connect({ connector: injectedConnector });
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-monad-600 to-monad-500 hover:from-monad-500 hover:to-monad-400 text-white font-mono text-xs px-4 py-2 rounded-lg font-semibold shadow-lg shadow-monad-500/20 transition"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>Connect Wallet</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden border-t border-cyber-border/60 px-4 py-2 flex items-center justify-around bg-cyber-bg">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-2 py-1 rounded text-[11px] font-mono ${
              pathname === link.href ? "text-white font-semibold" : "text-gray-400"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
