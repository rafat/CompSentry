"use client";

import React, { useEffect, useState } from "react";
import { Server, Zap, ShieldCheck, Clock, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { CONTRACT_ADDRESSES, ERC20_ABI } from "@/lib/contracts";
import ComputeSLAHubABI from "@/abis/ComputeSLAHub.json";
import { fetchActiveOffers, SLAOfferData } from "@/lib/api";

interface MarketplaceProps {
  onSelectOffer: (contractId: string) => void;
  activeContractId: string | null;
}

// Known compute catalog metadata by resourceId hash
const CATALOG_METADATA: Record<string, { modelName: string; hardware: string; providerName: string }> = {
  "0xf37913391db8ae88e6202ba99fc5299a7d4dd5c992fddcfea2ad6579d269ffe2": {
    modelName: "vLLM — Llama 3 70B Instruct",
    hardware: "4x NVIDIA H100 80GB SXM5",
    providerName: "HyperCompute Cluster-01",
  },
  "0x7880e802250473b091f3aca5841bdd51101aca127e924fd896fe08352c862207": {
    modelName: "DeepSeek R1 671B (FP8 MoE)",
    hardware: "8x NVIDIA H100 80GB SXM5",
    providerName: "Aetheria Decentralized Node",
  },
  "0xd77aa6284458399bea91bb8bb1f7ebcca142d8d7315c0acdea4ed7d897774e7c": {
    modelName: "Mistral Large 2 (123B)",
    hardware: "4x NVIDIA A100 80GB PCIe",
    providerName: "NodeOps Genesis",
  },
};

export function Marketplace({ onSelectOffer, activeContractId }: MarketplaceProps) {
  const { address: userAddress, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [offers, setOffers] = useState<SLAOfferData[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch active offers dynamically from Envio HyperIndex
  useEffect(() => {
    let mounted = true;
    async function loadOffers() {
      try {
        const liveOffers = await fetchActiveOffers();
        if (mounted && liveOffers.length > 0) {
          setOffers(liveOffers);
          setSelectedOfferId(liveOffers[0].id);
        }
      } catch (err) {
        console.warn("Could not load offers from indexer:", err);
      }
    }
    loadOffers();
    const interval = setInterval(loadOffers, 10_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleActivate = async (offer: SLAOfferData) => {
    if (!isConnected) {
      setErrorMsg("Please connect your wallet to activate an on-chain SLA contract.");
      return;
    }

    try {
      setErrorMsg(null);
      setIsActivating(true);
      setSelectedOfferId(offer.id);

      const serviceFeeBigInt = BigInt(offer.serviceFee);

      // Step 1: Ensure USDC token allowance to CollateralVault
      setStatusMessage("1/2: Approving CollateralVault for fee escrow...");
      const approveTx = await writeContractAsync({
        address: CONTRACT_ADDRESSES.mockUSDC,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESSES.vault, serviceFeeBigInt],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }

      // Step 2: Call ComputeSLAHub.activateContract(offerId)
      setStatusMessage("2/2: Broadcasting activateContract to Monad Testnet...");
      const activateTx = await writeContractAsync({
        address: CONTRACT_ADDRESSES.hub,
        abi: ComputeSLAHubABI,
        functionName: "activateContract",
        args: [offer.id as `0x${string}`],
      });

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: activateTx });
        // Find SLAContractActivated log topic
        const activatedLog = receipt.logs.find(
          (log) => log.topics[0]?.toLowerCase() === "0x0b3c74f13e396f2a3192cb7b6e15a78bf193131e20d8a27199d157c316d04a35"
        );
        const contractId = activatedLog?.topics[1] || offer.id;
        setStatusMessage("Contract successfully activated!");
        onSelectOffer(contractId);
      } else {
        onSelectOffer(offer.id);
      }
    } catch (err: any) {
      console.error("Activation failed:", err);
      setErrorMsg(err?.shortMessage || err?.message || "Contract activation reverted.");
    } finally {
      setIsActivating(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Server className="h-5 w-5 text-monad-500" />
            <span>Verified AI Compute Marketplace</span>
          </h2>
          <p className="text-xs text-gray-400">
            Select a high-performance GPU cluster with cryptographically enforced SLA collateral on Monad.
          </p>
        </div>

        {statusMessage && (
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-monad-950/60 border border-monad-500/40 text-xs font-mono text-monad-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-monad-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-rose-950/60 border border-rose-500/40 text-xs font-mono text-rose-300">
            <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {offers.length === 0 ? (
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-8 text-center space-y-3">
          <Server className="h-8 w-8 text-gray-500 mx-auto animate-pulse" />
          <h3 className="text-sm font-semibold text-gray-300">Syncing Compute Offers from Monad Testnet...</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Reading active provider offers from ComputeSLAHub (0x0fD5...79bB). Ensure the Envio indexer is running to populate real-time catalog items.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {offers.map((offer) => {
            const meta = CATALOG_METADATA[offer.resourceId] || {
              modelName: `GPU Node (${offer.resourceId.slice(0, 10)}...)`,
              hardware: "NVIDIA Tensor Core Accelerator",
              providerName: `Provider ${offer.provider.id.slice(0, 8)}...`,
            };

            const isSelected = selectedOfferId === offer.id;
            const priScore = Number(offer.provider.priScore || 5000) / 100;
            const feeUsdc = (Number(offer.serviceFee) / 1e6).toFixed(2);
            const bondPercent = (Number(offer.bondBps) / 100).toFixed(0);
            const availPercent = (Number(offer.availabilityThresholdBps) / 100).toFixed(1);

            return (
              <div
                key={offer.id}
                className={`relative bg-cyber-card rounded-xl border p-5 transition flex flex-col justify-between ${
                  isSelected
                    ? "border-monad-500 ring-1 ring-monad-500/50 shadow-lg shadow-monad-500/10"
                    : "border-cyber-border hover:border-cyber-highlight"
                }`}
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-white text-sm">{meta.modelName}</h3>
                      <p className="text-xs text-monad-400 font-mono mt-0.5">{meta.hardware}</p>
                    </div>
                    <div className="flex items-center gap-1 bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full text-[11px] font-mono">
                      <ShieldCheck className="h-3 w-3" />
                      <span>PRI {priScore.toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* SLA Specifications */}
                  <div className="grid grid-cols-2 gap-2 my-4 text-xs font-mono bg-cyber-bg/70 p-3 rounded-lg border border-cyber-border">
                    <div>
                      <span className="text-gray-400 block text-[10px]">P95 LATENCY SLA</span>
                      <span className="text-emerald-400 font-semibold">&lt; {offer.latencyThresholdMs} ms</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">AVAILABILITY SLA</span>
                      <span className="text-emerald-400 font-semibold">{availPercent}%</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-gray-400 block text-[10px]">EPOCH DURATION</span>
                      <span className="text-gray-200">{offer.epochDuration}s Micro-Epoch</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-gray-400 block text-[10px]">PROVIDER BOND</span>
                      <span className="text-monad-400 font-semibold">{bondPercent}% Staked</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    <span>Chainlink CRE Consensus Settlement</span>
                  </div>
                </div>

                {/* Action */}
                <div className="pt-2 border-t border-cyber-border flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-400">Total Escrow: </span>
                    <span className="text-sm font-bold text-white font-mono">${feeUsdc} USDC</span>
                  </div>
                  <button
                    onClick={() => handleActivate(offer)}
                    disabled={isActivating}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                      isSelected
                        ? "bg-monad-600 hover:bg-monad-500 text-white shadow-md shadow-monad-600/30"
                        : "bg-cyber-highlight hover:bg-cyber-border text-gray-200"
                    }`}
                  >
                    {isActivating && isSelected ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Activating...</span>
                      </>
                    ) : (
                      <>
                        <span>Activate SLA</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
