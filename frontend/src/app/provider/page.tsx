"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SLAHealthBadge } from "@/components/common/SLAHealthBadge";
import { fetchAllProviders, fetchActiveContracts } from "@/graphql/queries";
import { Provider, SLAContract, SLAOffer } from "@/types";
import {
  formatUSDC,
  formatPercent,
  shortenAddress,
  shortenHash,
  resolveResourceMetadata,
} from "@/lib/formatting";
import { COMPSENTRY } from "@/config/compsentry";
import { ComputeSLAHubABI, ERC20_ABI } from "@/lib/contracts";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEventLogs } from "viem";
import {
  Server,
  ShieldCheck,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Cpu,
  Layers,
  ExternalLink,
  ArrowRight,
  PlusCircle,
  X,
  Sparkles,
  Coins,
  CheckCircle2
} from "lucide-react";

export default function ProviderDashboardPage() {
  const { address, isConnected } = useAccount();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [contracts, setContracts] = useState<SLAContract[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdOfferId, setCreatedOfferId] = useState<string | null>(null);

  // Offer Form State
  const [modelName, setModelName] = useState("vLLM — Llama 3 70B Instruct");
  const [resourceId, setResourceId] = useState("0xf37913391db8ae88e6202ba99fc5299a7d4dd5c992fddcfea2ad6579d269ffe2");
  const [hardware, setHardware] = useState("4x NVIDIA H100 80GB SXM5");
  const [serviceFeeUSDC, setServiceFeeUSDC] = useState("100");
  const [bondPercent, setBondPercent] = useState("20");
  const [epochDurationSec, setEpochDurationSec] = useState("30");
  const [totalEpochs, setTotalEpochs] = useState("20");
  const [latencyThresholdMs, setLatencyThresholdMs] = useState("120");
  const [availabilityBps, setAvailabilityBps] = useState("9950");

  // Read provider USDC allowance for CollateralVault
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: COMPSENTRY.contracts.mockUSDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && COMPSENTRY.contracts.vault ? [address, COMPSENTRY.contracts.vault] : undefined,
  });

  // Faucet write
  const { data: faucetTx, isPending: isMinting, writeContract: writeFaucet } = useWriteContract();
  const { isSuccess: isMintConfirmed } = useWaitForTransactionReceipt({ hash: faucetTx });

  // Approve write
  const { data: approveTx, isPending: isApproving, writeContract: writeApprove } = useWriteContract();
  const { isSuccess: isApproveConfirmed, isLoading: isWaitingApprove } = useWaitForTransactionReceipt({ hash: approveTx });

  // Create offer write
  const { data: createTx, isPending: isCreating, writeContract: writeCreate } = useWriteContract();
  const { data: createReceipt, isSuccess: isCreateConfirmed, isLoading: isWaitingCreate } = useWaitForTransactionReceipt({ hash: createTx });

  useEffect(() => {
    if (isApproveConfirmed) {
      refetchAllowance();
    }
  }, [isApproveConfirmed, refetchAllowance]);

  // Decode offerId when create offer confirms
  useEffect(() => {
    if (isCreateConfirmed && createReceipt) {
      try {
        const logs = parseEventLogs({
          abi: ComputeSLAHubABI,
          eventName: "SLAOfferCreated",
          logs: createReceipt.logs,
        });
        const offerId = (logs[0] as any)?.args?.offerId;
        if (offerId) {
          setCreatedOfferId(offerId);

          // Save to localStorage for instant marketplace availability
          const newOffer: SLAOffer = {
            id: offerId,
            provider: {
              id: address || "",
              priScore: "5000",
              totalOffers: "1",
              totalContracts: "1",
              activeContracts: "1",
              totalEarned: "0",
              totalSlashed: "0",
              totalBondStaked: providerBondBN.toString(),
              breachCount: "0",
              compliantEpochsCount: "0",
            },
            token: COMPSENTRY.contracts.mockUSDC,
            resourceId: resourceId,
            serviceFee: (BigInt(serviceFeeUSDC) * 1000000n).toString(),
            bondBps: (Number(bondPercent) * 100).toString(),
            availabilityThresholdBps: availabilityBps.toString(),
            latencyThresholdMs: latencyThresholdMs.toString(),
            epochDuration: epochDurationSec.toString(),
            totalEpochs: totalEpochs.toString(),
            epochPayoutCap: ((BigInt(serviceFeeUSDC) * 1000000n) / BigInt(totalEpochs)).toString(),
            maxTotalPayout: (BigInt(serviceFeeUSDC) * 1000000n).toString(),
            active: true,
            createdAtBlock: createReceipt.blockNumber.toString(),
            createdAtTimestamp: Math.floor(Date.now() / 1000).toString(),
          };

          const stored = localStorage.getItem("compsentry_custom_offers");
          const customOffers = stored ? JSON.parse(stored) : [];
          localStorage.setItem("compsentry_custom_offers", JSON.stringify([newOffer, ...customOffers]));
        }
      } catch (err) {
        console.warn("Error decoding SLAOfferCreated:", err);
      }
    }
  }, [isCreateConfirmed, createReceipt, address, resourceId, serviceFeeUSDC, bondPercent, availabilityBps, latencyThresholdMs, epochDurationSec, totalEpochs]);

  useEffect(() => {
    let mounted = true;

    async function loadProviderData() {
      try {
        const [p, c] = await Promise.all([fetchAllProviders(), fetchActiveContracts()]);
        if (!mounted) return;
        setProviders(p);
        setContracts(c);
      } catch (err) {
        console.warn("Failed to load provider metrics:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProviderData();
    const interval = setInterval(loadProviderData, 12000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Calculations
  const serviceFeeBN = BigInt(serviceFeeUSDC || "0") * 1000000n;
  const bondBpsBN = BigInt(bondPercent || "0") * 100n;
  const providerBondBN = (serviceFeeBN * bondBpsBN) / 10000n;
  const currentAllowance = (allowance as bigint) || 0n;
  const needsApproval = currentAllowance < providerBondBN;

  const handleMintUSDC = () => {
    if (!address) return;
    writeFaucet({
      address: COMPSENTRY.contracts.mockUSDC,
      abi: ERC20_ABI,
      functionName: "mint",
      args: [address, 500000000n], // 500 USDC
    });
  };

  const handleApproveBond = () => {
    writeApprove({
      address: COMPSENTRY.contracts.mockUSDC,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [COMPSENTRY.contracts.vault, providerBondBN * 10n],
    });
  };

  const handleCreateOffer = () => {
    const totalE = BigInt(totalEpochs || "20");
    const epochDuration = BigInt(epochDurationSec || "30");
    const availBps = Number(availabilityBps || "9950");
    const latMs = Number(latencyThresholdMs || "120");
    const fee = BigInt(serviceFeeUSDC || "100") * 1000000n;
    const bondBps = Number(bondPercent || "20") * 100;
    const epochCap = fee / totalE;
    const maxTotal = fee;

    writeCreate({
      address: COMPSENTRY.contracts.hub,
      abi: ComputeSLAHubABI,
      functionName: "createOffer",
      args: [
        COMPSENTRY.contracts.mockUSDC,
        resourceId as `0x${string}`,
        fee,
        bondBps,
        epochDuration,
        Number(totalE),
        availBps,
        latMs,
        epochCap,
        maxTotal,
      ],
    });
  };

  // Find active provider matching connected wallet, or fallback to the primary indexed provider
  const currentProvider =
    providers.find((p) => address && p.id.toLowerCase() === address.toLowerCase()) ||
    providers[0] ||
    null;

  const priPercent = currentProvider ? (Number(currentProvider.priScore || 5000) / 100).toFixed(1) : "95.0";

  // Provider's contracts
  const providerContracts = currentProvider
    ? contracts.filter((c) => c.provider?.id?.toLowerCase() === currentProvider.id.toLowerCase())
    : contracts;

  const compliantEpochs = Number(currentProvider?.compliantEpochsCount || 0);
  const breachCount = Number(currentProvider?.breachCount || 0);
  const totalEvaluated = compliantEpochs + breachCount;
  const complianceRate = totalEvaluated > 0 ? ((compliantEpochs / totalEvaluated) * 100).toFixed(1) : "100.0";

  return (
    <div className="min-h-screen flex flex-col bg-cyber-bg font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 w-full">
        {/* Header */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 space-y-4 font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cyber-border">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-monad-400 bg-monad-950 px-2 py-0.5 rounded border border-monad-500/30">
                GPU PROVIDER PROFILE
              </span>
              <div className="flex items-center gap-3 pt-1">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Provider {currentProvider ? shortenAddress(currentProvider.id) : "Cluster 01"}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>HEALTHY</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-monad-600 to-cyan-600 hover:from-monad-500 hover:to-cyan-500 text-white font-mono text-xs font-semibold flex items-center gap-2 shadow-lg shadow-monad-500/25 transition"
              >
                <PlusCircle className="h-4 w-4" />
                <span>List New GPU Cluster</span>
              </button>

              <div className="flex items-center gap-3 bg-cyber-bg p-2.5 rounded-lg border border-cyber-border">
                <div>
                  <span className="text-gray-500 text-[10px] uppercase block">Provider PRI</span>
                  <span className="text-base font-bold text-monad-400">{priPercent}%</span>
                </div>
                <div className="h-8 w-8 rounded-lg bg-monad-950/80 border border-monad-500/30 flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4 text-monad-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <span>Provider Address: <strong className="text-white">{currentProvider?.id || "—"}</strong></span>
              <span>•</span>
              <a
                href={currentProvider ? COMPSENTRY.explorer.addressUrl(currentProvider.id) : "#"}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>View On MonadScan</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Quick Faucet */}
            {isConnected && (
              <button
                onClick={handleMintUSDC}
                disabled={isMinting}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-cyber-border hover:border-emerald-500/60 text-[11px] text-emerald-400 hover:text-emerald-300 transition"
              >
                <Coins className="h-3.5 w-3.5" />
                <span>{isMinting ? "Minting 500 USDC..." : isMintConfirmed ? "✓ Minted 500 USDC" : "Faucet: Mint 500 USDC"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal: Create SLA Offer */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-cyber-card border border-cyber-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 font-mono text-xs max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-cyber-border">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-monad-400" />
                  <h2 className="text-lg font-bold text-white">List GPU Cluster on Monad</h2>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreatedOfferId(null);
                  }}
                  className="p-1 hover:text-white text-gray-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {createdOfferId ? (
                <div className="space-y-4 py-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-500 flex items-center justify-center mx-auto text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">SLA Compute Offer Published!</h3>
                  <p className="text-gray-400 text-xs">
                    Your cluster is registered on <span className="text-monad-400">ComputeSLAHub</span> and ready to receive client rental requests.
                  </p>
                  <div className="p-3 bg-cyber-bg rounded-lg border border-cyber-border font-mono text-left break-all text-[11px] space-y-1">
                    <span className="text-gray-500 uppercase block text-[10px]">Offer ID:</span>
                    <span className="text-cyan-400 font-bold">{createdOfferId}</span>
                  </div>
                  {createTx && (
                    <a
                      href={COMPSENTRY.explorer.txUrl(createTx)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-monad-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                    >
                      <span>View MonadScan Transaction</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <div className="pt-2 flex items-center justify-center gap-3">
                    <Link
                      href={`/compute/${createdOfferId}`}
                      className="px-5 py-2.5 rounded-lg bg-monad-600 hover:bg-monad-500 text-white font-bold transition flex items-center gap-2"
                    >
                      <span>Rent Compute & Activate Contract</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-monad-950/40 p-3 rounded-lg border border-monad-500/30">
                    <span className="text-gray-300">Need standard demo parameters?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setModelName("vLLM — Llama 3 70B Instruct");
                        setServiceFeeUSDC("100");
                        setBondPercent("20");
                        setEpochDurationSec("30");
                        setTotalEpochs("20");
                        setLatencyThresholdMs("120");
                        setAvailabilityBps("9950");
                      }}
                      className="px-3 py-1 bg-monad-600/80 hover:bg-monad-500 text-white text-[11px] rounded font-bold transition"
                    >
                      Prefill Llama 3 (4x H100)
                    </button>
                  </div>

                  {/* Form fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-400 text-[10px] uppercase block mb-1">Inference Model</label>
                      <input
                        type="text"
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                        className="w-full bg-cyber-bg border border-cyber-border rounded px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-gray-400 text-[10px] uppercase block mb-1">Hardware Specification</label>
                      <input
                        type="text"
                        value={hardware}
                        onChange={(e) => setHardware(e.target.value)}
                        className="w-full bg-cyber-bg border border-cyber-border rounded px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-gray-400 text-[10px] uppercase block mb-1">Total Service Fee ($USDC)</label>
                      <input
                        type="number"
                        value={serviceFeeUSDC}
                        onChange={(e) => setServiceFeeUSDC(e.target.value)}
                        className="w-full bg-cyber-bg border border-cyber-border rounded px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-gray-400 text-[10px] uppercase block mb-1">Provider Bond (%)</label>
                      <input
                        type="number"
                        min="10"
                        max="25"
                        value={bondPercent}
                        onChange={(e) => setBondPercent(e.target.value)}
                        className="w-full bg-cyber-bg border border-cyber-border rounded px-3 py-2 text-white"
                      />
                      <span className="text-[10px] text-cyan-400 block mt-0.5">Required: ${((Number(serviceFeeUSDC || 0) * Number(bondPercent || 0)) / 100).toFixed(2)} USDC</span>
                    </div>

                    <div>
                      <label className="text-gray-400 text-[10px] uppercase block mb-1">Epoch Duration (Seconds)</label>
                      <input
                        type="number"
                        value={epochDurationSec}
                        onChange={(e) => setEpochDurationSec(e.target.value)}
                        className="w-full bg-cyber-bg border border-cyber-border rounded px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-gray-400 text-[10px] uppercase block mb-1">Total Micro-Epochs</label>
                      <input
                        type="number"
                        value={totalEpochs}
                        onChange={(e) => setTotalEpochs(e.target.value)}
                        className="w-full bg-cyber-bg border border-cyber-border rounded px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-gray-400 text-[10px] uppercase block mb-1">Latency SLA Limit (ms)</label>
                      <input
                        type="number"
                        value={latencyThresholdMs}
                        onChange={(e) => setLatencyThresholdMs(e.target.value)}
                        className="w-full bg-cyber-bg border border-cyber-border rounded px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-gray-400 text-[10px] uppercase block mb-1">Availability SLA Min (bps)</label>
                      <input
                        type="number"
                        value={availabilityBps}
                        onChange={(e) => setAvailabilityBps(e.target.value)}
                        className="w-full bg-cyber-bg border border-cyber-border rounded px-3 py-2 text-white"
                      />
                      <span className="text-[10px] text-emerald-400 block mt-0.5">{(Number(availabilityBps) / 100).toFixed(2)}% minimum uptime</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="pt-4 border-t border-cyber-border flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-[11px] text-gray-400">
                      Performance Bond to Lock: <strong className="text-cyan-400">{formatUSDC(providerBondBN.toString())}</strong>
                    </div>

                    <div className="flex items-center gap-3">
                      {!isConnected ? (
                        <span className="text-amber-400 text-[11px]">Connect Wallet</span>
                      ) : needsApproval ? (
                        <button
                          onClick={handleApproveBond}
                          disabled={isApproving || isWaitingApprove}
                          className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-900 text-white font-bold transition shadow-lg shadow-cyan-500/20"
                        >
                          {isApproving || isWaitingApprove ? "Approving Bond..." : `1. Approve Bond (${formatUSDC(providerBondBN.toString())})`}
                        </button>
                      ) : (
                        <button
                          onClick={handleCreateOffer}
                          disabled={isCreating || isWaitingCreate}
                          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-monad-600 to-cyan-600 hover:from-monad-500 hover:to-cyan-500 disabled:bg-gray-800 text-white font-bold transition shadow-lg shadow-monad-500/20"
                        >
                          {isCreating || isWaitingCreate ? "Publishing on Monad..." : "2. Publish SLA Offer on Monad"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-4">
            <span className="text-gray-400 text-[10px] uppercase block">Active SLAs</span>
            <div className="text-2xl font-bold text-cyan-400 mt-1">
              {currentProvider?.activeContracts ? Number(currentProvider.activeContracts) : providerContracts.length}
            </div>
            <span className="text-[10px] text-gray-500 block mt-1">Live Inferences</span>
          </div>

          <div className="bg-cyber-card border border-cyber-border rounded-xl p-4">
            <span className="text-gray-400 text-[10px] uppercase block">Bond Locked</span>
            <div className="text-2xl font-bold text-white mt-1">
              {formatUSDC(currentProvider?.totalBondStaked || "20000000")}
            </div>
            <span className="text-[10px] text-gray-500 block mt-1">Staked in Vault</span>
          </div>

          <div className="bg-cyber-card border border-cyber-border rounded-xl p-4">
            <span className="text-gray-400 text-[10px] uppercase block">Earned Fees</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {formatUSDC(currentProvider?.totalEarned || "0")}
            </div>
            <span className="text-[10px] text-gray-500 block mt-1">Service Revenue</span>
          </div>

          <div className="bg-cyber-card border border-cyber-border rounded-xl p-4">
            <span className="text-gray-400 text-[10px] uppercase block">Compliance Rate</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {complianceRate}%
            </div>
            <span className="text-[10px] text-gray-500 block mt-1">On-Time Settlements</span>
          </div>

          <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 col-span-2 sm:col-span-1">
            <span className="text-gray-400 text-[10px] uppercase block">Slashed Collateral</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">
              {formatUSDC(currentProvider?.totalSlashed || "0")}
            </div>
            <span className="text-[10px] text-gray-500 block mt-1">Penalties Paid</span>
          </div>
        </div>

        {/* Reliability Overview Box */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 font-mono text-xs space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider pb-2 border-b border-cyber-border">
            Provider Reliability Telemetry
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-cyber-bg/70 p-3 rounded-lg border border-cyber-border/70">
              <span className="text-gray-500 text-[10px] uppercase block">Compliance Rate</span>
              <span className="text-emerald-400 font-bold text-base">{complianceRate}%</span>
            </div>

            <div className="bg-cyber-bg/70 p-3 rounded-lg border border-cyber-border/70">
              <span className="text-gray-500 text-[10px] uppercase block">Breach Count</span>
              <span className="text-rose-400 font-bold text-base">{breachCount} Breaches</span>
            </div>

            <div className="bg-cyber-bg/70 p-3 rounded-lg border border-cyber-border/70">
              <span className="text-gray-500 text-[10px] uppercase block">Compliant Epochs</span>
              <span className="text-white font-bold text-base">{compliantEpochs} Epochs</span>
            </div>

            <div className="bg-cyber-bg/70 p-3 rounded-lg border border-cyber-border/70">
              <span className="text-gray-500 text-[10px] uppercase block">PRI Reliability</span>
              <span className="text-monad-400 font-bold text-base">{priPercent} / 100</span>
            </div>
          </div>
        </div>

        {/* Provider Contracts Table */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 font-mono text-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-cyber-border">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              <h3 className="font-bold text-white text-sm">Provider Hosted SLA Contracts</h3>
            </div>
            <span className="text-gray-400 text-[11px]">{providerContracts.length} Contracts Under Monitoring</span>
          </div>

          {providerContracts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No contracts currently hosted for this provider.
            </div>
          ) : (
            <div className="divide-y divide-cyber-border/40">
              {providerContracts.map((c) => {
                const meta = resolveResourceMetadata(c.offer?.resourceId);
                return (
                  <div key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-cyber-bg/40 px-2 rounded-lg transition">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">SLA #{shortenHash(c.id)}</span>
                        <span className="text-gray-400">({meta.name})</span>
                      </div>
                      <span className="text-[11px] text-gray-500">
                        Buyer: {shortenAddress(c.buyer?.id)} • Bond: {formatUSDC(c.providerBond)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-gray-400 text-[10px] block uppercase">Remaining Bond</span>
                        <span className="text-cyan-400 font-bold">{formatUSDC(c.currentRemainingBond)}</span>
                      </div>
                      <SLAHealthBadge status={c.status} />
                      <Link
                        href={`/my-slas/${c.id}`}
                        className="px-3 py-1.5 rounded bg-cyber-bg border border-cyber-border hover:border-monad-500 text-gray-200 transition"
                      >
                        Inspect
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
