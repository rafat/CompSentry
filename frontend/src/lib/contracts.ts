import ComputeSLAHubABI from "@/abis/ComputeSLAHub.json";
import SettlementControllerABI from "@/abis/SettlementController.json";
import CollateralVaultABI from "@/abis/CollateralVault.json";

export const CONTRACT_ADDRESSES = {
  hub: (process.env.NEXT_PUBLIC_HUB_ADDRESS || "0x0fD55d06B382C72d8b95f5Bf9Ae1682D079B79bB") as `0x${string}`,
  settlementController: (process.env.NEXT_PUBLIC_CONTROLLER_ADDRESS || "0x8ef7455e8d01C85Af8ed9CFcc0274f4125737e2f") as `0x${string}`,
  vault: (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0xFF3260a3aab725b4BbBf9A94A57A5718196E5a73") as `0x${string}`,
  mockUSDC: (process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || "0xF35e93EaeE4c6dCfA24eb0BD6aE1164c8a0ffB64") as `0x${string}`,
};

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  }
] as const;

export { ComputeSLAHubABI, SettlementControllerABI, CollateralVaultABI };
