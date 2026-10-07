"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { fetchSLAOfferById } from "@/graphql/queries";
import { SLAOffer } from "@/types";
import {
  formatUSDC,
  formatPercent,
  formatLatency,
  shortenAddress,
  resolveResourceMetadata,
} from "@/lib/formatting";
import { COMPSENTRY } from "@/config/compsentry";
import { ComputeSLAHubABI, ERC20_ABI } from "@/lib/contracts";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import {
  Shield,
  ShieldCheck,
  ArrowRight,
  Server,
  Zap,
  Clock,
  Activity,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Lock,
  ArrowLeft,
} from "lucide-react";

export default function SLAOfferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = params.offerId as string;

  const [offer, setOffer] = useState<SLAOffer | null>(null);
  const [loading, setLoading] = useState(true);

  const { address, isConnected } = useAccount();

  // Load offer from Envio
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await fetchSLAOfferById(offerId);
        if (mounted) setOffer(data);
      } catch (err) {
        console.warn("Failed to load offer:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (offerId) load();
    return () => {
      mounted = false;
    };
  }, [offerId]);

  // Read buyer's USDC allowance for CollateralVault
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: COMPSENTRY.contracts.mockUSDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && COMPSENTRY.contracts.vault ? [address, COMPSENTRY.contracts.vault] : undefined,
  });

  // Wagmi Contract Writes
  const { data: approveTxHash, isPending: isApproving, writeContract: writeApprove } = useWriteContract();
  const { isSuccess: isApproveConfirmed, isLoading: isWaitingApprove } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  const { data: activateTxHash, isPending: isActivating, writeContract: writeActivate } = useWriteContract();
  const { isSuccess: isActivateConfirmed, isLoading: isWaitingActivate } = useWaitForTransactionReceipt({
    hash: activateTxHash,
  });

  useEffect(() => {
    if (isApproveConfirmed) {
      refetchAllowance();
    }
  }, [isApproveConfirmed, refetchAllowance]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-cyber-bg">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="font-mono text-xs text-gray-400 animate-pulse">Loading SLA Offer Terms...</div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="min-h-screen flex flex-col bg-cyber-bg font-mono">
        <Navbar />
        <div className="flex-1 max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
          <h2 className="text-xl font-bold text-white">SLA Offer Not Found</h2>
          <p className="text-gray-400 text-xs">The requested compute offer could not be loaded from the indexer.</p>
          <Link href="/compute" className="text-monad-400 underline text-xs">
            Return to Marketplace
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const metadata = resolveResourceMetadata(offer.resourceId);
  const serviceFeeBN = BigInt(offer.serviceFee || "0");
  const bondBpsBN = BigInt(offer.bondBps || "1500");
  const providerBondBN = (serviceFeeBN * bondBpsBN) / 10000n;
  const priPercent = (Number(offer.provider?.priScore || 5000) / 100).toFixed(1);

  const currentAllowance = (allowance as bigint) || 0n;
  const needsApproval = currentAllowance < serviceFeeBN;

  const handleApprove = () => {
    writeApprove({
      address: COMPSENTRY.contracts.mockUSDC,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [COMPSENTRY.contracts.vault, serviceFeeBN * 10n],
    });
  };

  const handleActivate = () => {
    writeActivate({
      address: COMPSENTRY.contracts.hub,
      abi: ComputeSLAHubABI,
      functionName: "activateContract",
      args: [offer.id as `0x${string}`],
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-cyber-bg font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 w-full">
        {/* Back Link */}
        <Link
          href="/compute"
          className="inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-white transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Marketplace</span>
        </Link>

        {/* Top Header Card */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 space-y-4 font-mono">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-cyber-border">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-monad-400 font-semibold bg-monad-950/80 px-2 py-0.5 rounded border border-monad-500/30">
                  GPU INFERENCE SERVICE
                </span>
                <span className="text-gray-500 text-xs">•</span>
                <span className="text-gray-400 text-xs">{metadata.providerName}</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{metadata.name}</h1>
              <p className="text-gray-400 text-xs">
                Resource ID: <span className="text-gray-200">{metadata.tag}</span> • Hardware: {metadata.hardware}
              </p>
            </div>

            <div className="flex items-center gap-4 bg-cyber-bg p-3 rounded-lg border border-cyber-border">
              <div className="text-right">
                <span className="text-gray-500 text-[10px] uppercase block">Provider Reliability</span>
                <span className="text-base font-bold text-monad-400">{priPercent}% PRI</span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-monad-950/80 border border-monad-500/30 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-monad-400" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-gray-400">
            <div>
              <span className="text-gray-500 text-[10px] uppercase block">Provider Account</span>
              <a
                href={COMPSENTRY.explorer.addressUrl(offer.provider.id)}
                target="_blank"
                rel="noreferrer"
                className="text-white hover:text-monad-400 font-semibold transition"
              >
                {shortenAddress(offer.provider.id)}
              </a>
            </div>
            <div>
              <span className="text-gray-500 text-[10px] uppercase block">Offer Commitment</span>
              <span className="text-white font-semibold">{offer.id.slice(0, 10)}...</span>
            </div>
            <div>
              <span className="text-gray-500 text-[10px] uppercase block">Arbitration Quorum</span>
              <span className="text-cyan-400 font-semibold">Chainlink CRE (3 Probes)</span>
            </div>
          </div>
        </div>

        {/* SLA Terms & Financial Parameters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Terms */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 space-y-4 font-mono text-xs">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider pb-2 border-b border-cyber-border">
              SLA Commitments & Thresholds
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-1 border-b border-cyber-border/40">
                <span className="text-gray-400">Availability Threshold</span>
                <span className="text-white font-bold">≥ {formatPercent(offer.availabilityThresholdBps)}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-cyber-border/40">
                <span className="text-gray-400">P95 Latency Threshold</span>
                <span className="text-white font-bold">≤ {formatLatency(offer.latencyThresholdMs)}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-cyber-border/40">
                <span className="text-gray-400">Epoch Duration</span>
                <span className="text-white font-bold">{offer.epochDuration} Seconds</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-cyber-border/40">
                <span className="text-gray-400">Total Epoch Schedule</span>
                <span className="text-white font-bold">{offer.totalEpochs} Micro-Epochs</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-cyber-border/40">
                <span className="text-gray-400">Per-Epoch Payout Cap</span>
                <span className="text-cyan-400 font-bold">{formatUSDC(offer.epochPayoutCap)}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-gray-400">Maximum Total Payout</span>
                <span className="text-cyan-400 font-bold">{formatUSDC(offer.maxTotalPayout)}</span>
              </div>
            </div>
          </div>

          {/* Economics & Capital */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 space-y-4 font-mono text-xs">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider pb-2 border-b border-cyber-border">
              Capital & Collateral Requirements
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-1 border-b border-cyber-border/40">
                <span className="text-gray-400">Buyer Service Fee (Escrow)</span>
                <span className="text-emerald-400 font-bold text-sm">{formatUSDC(offer.serviceFee)}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-cyber-border/40">
                <span className="text-gray-400">Provider Bond Locked</span>
                <span className="text-cyan-400 font-bold text-sm">{formatUSDC(providerBondBN.toString())}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-cyber-border/40">
                <span className="text-gray-400">Bond Requirement Ratio</span>
                <span className="text-white font-bold">{formatPercent(offer.bondBps)}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-cyber-border/40">
                <span className="text-gray-400">Slashing Penalty on Outage</span>
                <span className="text-rose-400 font-bold">5% Provider Bond / Outage</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-gray-400">Settlement Currency</span>
                <span className="text-gray-200 font-semibold">Mock USDC (6 Decimals)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Protection Layer Flowchart Diagram */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 font-mono text-xs space-y-4">
          <h2 className="text-xs uppercase font-semibold text-gray-400 tracking-wider">
            CompSentry Dual-Collateral Protection Architecture
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center items-center py-2">
            {/* Box 1 */}
            <div className="p-4 bg-cyber-bg rounded-xl border border-cyber-border space-y-1">
              <span className="text-[10px] text-gray-500 uppercase block">1. Buyer Deposit</span>
              <span className="text-base font-bold text-emerald-400">{formatUSDC(offer.serviceFee)}</span>
              <p className="text-[11px] text-gray-400">Locked in CollateralVault</p>
            </div>

            {/* Box 2 (Center) */}
            <div className="p-4 bg-monad-950/40 rounded-xl border border-monad-500/40 space-y-1">
              <span className="text-[10px] text-monad-400 uppercase font-semibold block">
                2. Autonomous Arbitration
              </span>
              <span className="text-sm font-bold text-white">Chainlink CRE Consensus</span>
              <p className="text-[11px] text-gray-400">Micro-Epoch Evaluation</p>
            </div>

            {/* Box 3 */}
            <div className="p-4 bg-cyber-bg rounded-xl border border-cyber-border space-y-1">
              <span className="text-[10px] text-cyan-400 uppercase block">3. Performance Bond</span>
              <span className="text-base font-bold text-cyan-400">{formatUSDC(providerBondBN.toString())}</span>
              <p className="text-[11px] text-gray-400">Slashed if Provider Breaches</p>
            </div>
          </div>
        </div>

        {/* Activation Action Card */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 font-mono text-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white">Activate SLA Contract</h3>
              <p className="text-gray-400 text-[11px]">
                Lock {formatUSDC(offer.serviceFee)} into CollateralVault and initiate real-time telemetry monitoring.
              </p>
            </div>

            {/* Action Buttons */}
            <div>
              {!isConnected ? (
                <div className="text-right">
                  <span className="text-amber-400 text-[11px] block mb-1">Wallet Connection Required</span>
                  <button
                    disabled
                    className="px-6 py-2.5 rounded-lg bg-gray-800 text-gray-500 font-semibold cursor-not-allowed"
                  >
                    Connect Wallet to Activate
                  </button>
                </div>
              ) : isActivateConfirmed ? (
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>SLA Activated!</span>
                  </span>
                  <Link
                    href="/my-slas"
                    className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
                  >
                    View in My SLAs
                  </Link>
                </div>
              ) : needsApproval ? (
                <button
                  onClick={handleApprove}
                  disabled={isApproving || isWaitingApprove}
                  className="px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-900 text-white font-semibold transition shadow-lg shadow-cyan-500/20"
                >
                  {isApproving || isWaitingApprove ? "Approving USDC..." : "1. Approve USDC Escrow"}
                </button>
              ) : (
                <button
                  onClick={handleActivate}
                  disabled={isActivating || isWaitingActivate}
                  className="px-6 py-2.5 rounded-lg bg-monad-600 hover:bg-monad-500 disabled:bg-monad-900 text-white font-semibold transition shadow-lg shadow-monad-500/20"
                >
                  {isActivating || isWaitingActivate ? "Activating Contract..." : "2. Lock Escrow & Activate SLA"}
                </button>
              )}
            </div>
          </div>

          {/* Transaction receipt link if available */}
          {(approveTxHash || activateTxHash) && (
            <div className="pt-3 border-t border-cyber-border/60 flex items-center justify-between text-[11px]">
              <span className="text-gray-400">Transaction Status:</span>
              <a
                href={COMPSENTRY.explorer.txUrl(activateTxHash || approveTxHash || "")}
                target="_blank"
                rel="noreferrer"
                className="text-monad-400 hover:underline flex items-center gap-1"
              >
                <span>View on MonadVision</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
