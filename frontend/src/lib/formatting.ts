import { COMPSENTRY } from "@/config/compsentry";

/**
 * Format 6-decimal USDC values from Monad contracts
 */
export function formatUSDC(amount: string | bigint | number | undefined | null): string {
  if (!amount) return "$0.00";
  try {
    const val = Number(BigInt(amount.toString())) / 1e6;
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } catch {
    return "$0.00";
  }
}

/**
 * Format basis points into percentage string (e.g. 9950 -> "99.50%")
 */
export function formatPercent(bps: string | bigint | number | undefined | null): string {
  if (bps === undefined || bps === null) return "0.00%";
  try {
    const val = Number(bps) / 100;
    return `${val.toFixed(2)}%`;
  } catch {
    return "0.00%";
  }
}

/**
 * Format latency in milliseconds
 */
export function formatLatency(ms: string | bigint | number | undefined | null): string {
  if (ms === undefined || ms === null) return "0 ms";
  return `${ms} ms`;
}

/**
 * Shorten Ethereum/Monad address (e.g. 0x1234...5678)
 */
export function shortenAddress(address: string | undefined | null): string {
  if (!address) return "0x0000...0000";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Shorten transaction or evidence hash
 */
export function shortenHash(hash: string | undefined | null): string {
  if (!hash) return "0x0000...0000";
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

/**
 * Resolve human readable resource metadata from resourceId hash
 */
export function resolveResourceMetadata(resourceId: string | undefined | null) {
  if (!resourceId) {
    return {
      name: "Custom Inference Cluster",
      tag: "custom-compute",
      hardware: "NVIDIA Tensor Core GPU",
      providerName: "Verified Provider",
    };
  }
  return COMPSENTRY.resourceMetadata[resourceId.toLowerCase()] || {
    name: "Custom Inference Cluster",
    tag: shortenHash(resourceId),
    hardware: "NVIDIA Tensor Core GPU",
    providerName: "Verified Provider",
  };
}

/**
 * Format unix timestamp into human time
 */
export function formatTimestamp(ts: string | number | undefined | null): string {
  if (!ts) return "—";
  const num = Number(ts);
  const date = new Date(num < 1e11 ? num * 1000 : num);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
