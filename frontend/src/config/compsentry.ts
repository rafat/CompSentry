export const COMPSENTRY = {
  chainId: 10143,
  chainName: "Monad Testnet",
  currency: {
    symbol: "MON",
    decimals: 18,
  },
  contracts: {
    hub: (process.env.NEXT_PUBLIC_HUB_ADDRESS || "0x0fD55d06B382C72d8b95f5Bf9Ae1682D079B79bB") as `0x${string}`,
    vault: (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0xFF3260a3aab725b4BbBf9A94A57A5718196E5a73") as `0x${string}`,
    settlementController: (process.env.NEXT_PUBLIC_CONTROLLER_ADDRESS || "0x8ef7455e8d01C85Af8ed9CFcc0274f4125737e2f") as `0x${string}`,
    mockUSDC: (process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || "0xF35e93EaeE4c6dCfA24eb0BD6aE1164c8a0ffB64") as `0x${string}`,
  },
  indexer: {
    graphqlUrl: (process.env.NEXT_PUBLIC_INDEXER_GRAPHQL_URL && process.env.NEXT_PUBLIC_INDEXER_GRAPHQL_URL.includes("/v1/graphql"))
      ? process.env.NEXT_PUBLIC_INDEXER_GRAPHQL_URL
      : "https://indexer.dev.hyperindex.xyz/ac3fc11/v1/graphql",
  },
  evaluator: {
    url: process.env.NEXT_PUBLIC_EVALUATOR_URL || "http://localhost:4000",
  },
  observers: [
    {
      id: "observer-provider",
      name: "Observer 1 (Provider Node)",
      url: process.env.NEXT_PUBLIC_OBSERVER_1_URL || "http://localhost:4001",
    },
    {
      id: "observer-independent",
      name: "Observer 2 (Independent Probe)",
      url: process.env.NEXT_PUBLIC_OBSERVER_2_URL || "http://localhost:4002",
    },
    {
      id: "observer-secondary",
      name: "Observer 3 (Secondary Monitor)",
      url: process.env.NEXT_PUBLIC_OBSERVER_3_URL || "http://localhost:4003",
    },
  ],
  explorer: {
    baseUrl: "https://testnet.monadscan.com",
    txUrl: (tx: string) => `https://testnet.monadscan.com/tx/${tx}`,
    addressUrl: (addr: string) => `https://testnet.monadscan.com/address/${addr}`,
  },
  resourceMetadata: {
    "0xf37913391db8ae88e6202ba99fc5299a7d4dd5c992fddcfea2ad6579d269ffe2": {
      name: "vLLM — Llama 3 70B Instruct",
      tag: "llama3-70b-prod",
      hardware: "4x NVIDIA H100 80GB SXM5",
      providerName: "HyperCompute Cluster-01",
    },
    "0x7880e802250473b091f3aca5841bdd51101aca127e924fd896fe08352c862207": {
      name: "DeepSeek R1 671B (FP8 MoE)",
      tag: "deepseek-r1-moe",
      hardware: "8x NVIDIA H100 80GB SXM5",
      providerName: "Aetheria Decentralized Node",
    },
    "0xd77aa6284458399bea91bb8bb1f7ebcca142d8d7315c0acdea4ed7d897774e7c": {
      name: "Mistral Large 2 (123B)",
      tag: "mistral-large-2",
      hardware: "4x NVIDIA A100 80GB PCIe",
      providerName: "NodeOps Genesis",
    },
  } as Record<string, { name: string; tag: string; hardware: string; providerName: string }>,
};
