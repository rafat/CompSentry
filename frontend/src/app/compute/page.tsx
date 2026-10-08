"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SLAOfferCard } from "@/components/marketplace/SLAOfferCard";
import { OfferFilters } from "@/components/marketplace/OfferFilters";
import { fetchSLAOffers } from "@/graphql/queries";
import { SLAOffer } from "@/types";
import { resolveResourceMetadata } from "@/lib/formatting";
import { Cpu, Server, ShieldCheck, Sparkles } from "lucide-react";

export default function ComputeMarketplacePage() {
  const [offers, setOffers] = useState<SLAOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [maxLatency, setMaxLatency] = useState(500);

  useEffect(() => {
    let mounted = true;

    async function loadOffers() {
      try {
        const data = await fetchSLAOffers();
        if (mounted) setOffers(data);
      } catch (err) {
        console.warn("Failed to load offers:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadOffers();
    const interval = setInterval(loadOffers, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      const meta = resolveResourceMetadata(offer.resourceId);
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        meta.name.toLowerCase().includes(query) ||
        meta.hardware.toLowerCase().includes(query) ||
        meta.tag.toLowerCase().includes(query) ||
        offer.provider.id.toLowerCase().includes(query);

      const matchesLatency = Number(offer.latencyThresholdMs) <= maxLatency;
      return matchesSearch && matchesLatency;
    });
  }, [offers, searchQuery, maxLatency]);

  return (
    <div className="min-h-screen flex flex-col bg-cyber-bg font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 w-full">
        {/* Marketplace Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-cyber-border">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-monad-950/80 border border-monad-500/30 font-mono text-xs text-monad-400">
              <Sparkles className="h-3.5 w-3.5 text-monad-400" />
              <span>Verified GPU Clusters on Monad Testnet</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight">
              Verified Compute Marketplace
            </h1>
            <p className="text-gray-400 text-sm max-w-2xl">
              Procure enterprise-grade AI inference compute protected by dual-collateral smart contract vaults.
              If a cluster breaches your latency or availability requirements, performance bonds are automatically slashed.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-gray-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>100% Cryptographically Bonded</span>
          </div>
        </div>

        {/* Filters */}
        <OfferFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          maxLatency={maxLatency}
          onMaxLatencyChange={setMaxLatency}
        />

        {/* Offer Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-72 rounded-xl bg-cyber-card border border-cyber-border animate-pulse" />
            ))}
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="text-center py-16 bg-cyber-card border border-cyber-border rounded-xl p-8 space-y-3 font-mono">
            <Server className="h-10 w-10 text-gray-500 mx-auto" />
            <h3 className="text-base font-bold text-white">No Compute Offers Match Your Filters</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              Try adjusting your maximum latency slider or search query to see active GPU clusters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOffers.map((offer) => (
              <SLAOfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
