# CompSentry 🛡️⚡

> **Capital-Efficient Compute SLA Protection Market on Monad, Powered by Chainlink Runtime Environment (CRE) Consensus & Envio HyperIndex**

CompSentry is a decentralized performance-assurance protocol for decentralized AI and compute clusters. Rather than forcing providers to lock inefficient 1:1 collateral (e.g. locking \$10,000 to earn \$300) or relying on centralized buyer claims, CompSentry introduces:

- **Calibrated Performance Bonding (10%–25%)**: Providers post bounded collateral, unlocking 4x–10x higher capital efficiency.
- **Buyer Service-Fee Escrow**: Renters deposit compute payments into escrow, released incrementally epoch-by-epoch.
- **Independent Multi-Observer Telemetry**: 3 independent observer probes continually sample latency and uptime. Single-party outage claims can never unilaterally trigger financial penalties.
- **Chainlink Runtime Environment (CRE)**: Autonomous off-chain consensus engine executing multi-observer quorum aggregation, outlier filtering, cryptographic evidence hashing, and deterministic settlement submission to Monad.
- **Real-Time Settlement on Monad**: Deterministic 30-second micro-epochs enforcing strict mathematical invariants for automated rebates, fee earnings, and bond slashing.
- **Envio HyperIndex**: Blazing-fast indexing of micro-settlement events, providing real-time GraphQL APIs for uptime analytics, the Provider Reliability Index (PRI), and Collateral Utilization Ratio (CUR).

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Compute Infrastructure & Observers
        GPU[AI / GPU Inference Cluster]
        OB1[Observer 1: Cloud Run Probe]
        OB2[Observer 2: Cloud Run Probe]
        OB3[Observer 3: Cloud Run Probe]
        GPU --> OB1 & OB2 & OB3
    end

    subgraph Chainlink Runtime Environment (CRE)
        CRON[Cron / Daemon Trigger]
        SYNC[Read Monad SLA State & Epoch Window]
        FETCH[Fetch Signed Telemetry from Observers]
        QUORUM[Deterministic Quorum & Median Consensus]
        HASH[Generate Keccak256 Evidence Hash]
        SIGN[Construct SLAReport]

        CRON --> SYNC --> FETCH
        OB1 & OB2 & OB3 -.->|HTTPS / Telemetry| FETCH
        FETCH --> QUORUM --> HASH --> SIGN
    end

    subgraph Monad Testnet (Chain ID 10143)
        HUB[ComputeSLAHub.sol]
        SETTLE[SettlementController.sol]
        VAULT[CollateralVault.sol]

        SIGN -->|settleEpoch / report| SETTLE
        HUB -->|Activate Contract| VAULT
        SETTLE -->|Execute Fee / Rebate / Slash| VAULT
    end

    subgraph Analytics & Experience
        ENVIO[Envio HyperIndex]
        UI[CompSentry Next.js Dashboard]
        
        HUB & SETTLE & VAULT -->|Emit Events| ENVIO
        ENVIO -->|GraphQL API| UI
        SETTLE -.->|Direct Monad RPC Fallback| UI
        UI -->|Rent Compute / Manage| HUB
    end
```

---

## 🚀 Live Deployment Information

All smart contracts are deployed and verified on **Monad Testnet**.

| Contract / Service | Address / Endpoint | Explorer Link |
| :--- | :--- | :--- |
| **ComputeSLAHub** | `0x0fD55d06B382C72d8b95f5Bf9Ae1682D079B79bB` | [MonadScan](https://testnet.monadscan.com/address/0x0fD55d06B382C72d8b95f5Bf9Ae1682D079B79bB) |
| **SettlementController** | `0x8ef7455e8d01C85Af8ed9CFcc0274f4125737e2f` | [MonadScan](https://testnet.monadscan.com/address/0x8ef7455e8d01C85Af8ed9CFcc0274f4125737e2f) |
| **CollateralVault** | `0xFF3260a3aab725b4BbBf9A94A57A5718196E5a73` | [MonadScan](https://testnet.monadscan.com/address/0xFF3260a3aab725b4BbBf9A94A57A5718196E5a73) |
| **Mock USDC Token** | `0xF35e93EaeE4c6dCfA24eb0BD6aE1164c8a0ffB64` | [MonadScan](https://testnet.monadscan.com/address/0xF35e93EaeE4c6dCfA24eb0BD6aE1164c8a0ffB64) |
| **Authorized CRE Reporter** | `0xE5d7e81226E2Ca1355F8954673eCe59Fe40fDBFd` | [MonadScan](https://testnet.monadscan.com/address/0xE5d7e81226E2Ca1355F8954673eCe59Fe40fDBFd) |

### Network Details
- **Network**: Monad Testnet
- **Chain ID**: `10143`
- **Native Currency**: MON
- **RPC URL**: `https://testnet-rpc.monad.xyz`

### Production Web Application & Observers
- **Web App**: [https://comp-sentry.vercel.app](https://comp-sentry.vercel.app)
- **Observer 1**: `https://compsentry-observer-1-961098530006.asia-south1.run.app/telemetry`
- **Observer 2**: `https://compsentry-observer-2-961098530006.asia-south1.run.app/telemetry`
- **Observer 3**: `https://compsentry-observer-3-961098530006.asia-south1.run.app/telemetry`

---

## 📁 Repository Structure

```text
CompSentry/
├── contracts/                  # Foundry Solidity smart contracts
│   ├── src/
│   │   ├── ComputeSLAHub.sol       # SLA offer creation & contract lifecycle state machine
│   │   ├── SettlementController.sol # Deterministic epoch payout & slashing rules
│   │   └── CollateralVault.sol     # Escrow & performance bond accounting
│   └── test/
│       ├── unit/                   # Unit test suites (lifecycle, security, caps)
│       └── invariant/              # Formal invariant handler tests (solvency, bounding)
├── cre/compsentry-workflow/    # Chainlink Runtime Environment (CRE) Workflow
│   ├── workflow.ts                 # CRE SDK workflow definition (cron-triggered)
│   ├── consensus.ts                # Deterministic quorum, median filter & outlier rejection
│   └── index.ts                    # Autonomous rental-duration settlement runner
├── frontend/                   # Next.js 14 App Router Web Application
│   ├── src/app/                    # Pages: Marketplace, Contract Cockpit, Provider Studio
│   ├── src/components/             # Real-time charts, epoch tables, health indicators
│   └── src/graphql/                # Envio HyperIndex queries with on-chain RPC fallback
├── indexer/                    # Envio HyperIndex configuration
│   ├── config.yaml                 # Monad contract event bindings
│   ├── schema.graphql              # Entities: SLAContract, EpochSettlement, Incident
│   └── src/EventHandlers.ts        # Indexing & PRI / CUR analytics derivation
└── services/                   # Telemetry probes & Evaluator
    ├── evaluator/                  # Synthetic inference workload simulator
    └── observer-*/                 # Multi-region telemetry aggregation probes
```

---

## 🛠️ Local Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ or [Bun](https://bun.sh/) v1.1+
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`)
- [pnpm](https://pnpm.io/) or `npm`

### 1. Clone Repository & Install Dependencies

```bash
git clone https://github.com/rafat/CompSentry.git
cd CompSentry

# Install Frontend dependencies
cd frontend && npm install && cd ..

# Install CRE Workflow dependencies
cd cre/compsentry-workflow && bun install && cd ..

# Install Mock Services dependencies
cd services && pnpm install && cd ..

# Install Foundry dependencies
cd contracts && forge install && cd ..
```

### 2. Configure Environment Variables

Create `.env` in `cre/compsentry-workflow/`:
```bash
DEPLOYER_PRIVATE_KEY=0x<YOUR_PRIVATE_KEY>
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
CRE_ENV=online
```

Create `.env.local` in `frontend/`:
```bash
NEXT_PUBLIC_HUB_ADDRESS=0x0fD55d06B382C72d8b95f5Bf9Ae1682D079B79bB
NEXT_PUBLIC_CONTROLLER_ADDRESS=0x8ef7455e8d01C85Af8ed9CFcc0274f4125737e2f
NEXT_PUBLIC_VAULT_ADDRESS=0xFF3260a3aab725b4BbBf9A94A57A5718196E5a73
NEXT_PUBLIC_MOCK_USDC_ADDRESS=0xF35e93EaeE4c6dCfA24eb0BD6aE1164c8a0ffB64
NEXT_PUBLIC_INDEXER_GRAPHQL_URL=https://indexer.bigdevenergy.link/09ef97e/v1/graphql
```

---

## 🏃 Running the Protocol

### 1. Start the Frontend Application
```bash
cd frontend
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the Marketplace and Live SLA Dashboard.

### 2. Run the Autonomous CRE Settlement Engine
The CRE workflow runs continuously for the full duration of a compute rental (settling every 30-second epoch):

```bash
cd cre/compsentry-workflow

# Run continuously for an active rental
CRE_CONTRACT=0x<CONTRACT_ID> CRE_ENV=online bun run-epoch
```

#### Interactive Outage Simulation:
While the CRE runner is active in your terminal:
- Press **`o` + Enter** at any time to toggle an SLA outage breach on the upcoming epoch.
- Or pass `--outage-epoch 2` to automatically settle Epoch 1 compliantly and breach Epoch 2:
  ```bash
  CRE_CONTRACT=0x<CONTRACT_ID> CRE_ENV=online bun run-epoch --outage-epoch 2
  ```

---

## 🧪 Testing Suites

### 1. Smart Contract Test Suite (Foundry)
CompSentry features a 32-test suite including unit tests, strict economic caps, boundary checks, and property-based invariant fuzzing:

```bash
cd contracts
forge test
```

#### Test Coverage Highlights:
- **`test_CalculateEpochSettlement_Matrix`**: Verifies exact payout arithmetic across compliant, minor breach, and major breach scenarios.
- **`test_Security_MaliciousReporterCannotFabricatePayout`**: Proves unauthorized callers cannot forge reports.
- **`invariant_VaultSolvency`**: Formally asserts that the CollateralVault token balance always satisfies:
  $$\text{VaultBalance} \ge \sum \text{RemainingEscrow} + \sum \text{RemainingBond} + \sum \text{AccruedRebates}$$
- **`invariant_ExactLiabilityConservation`**: Proves no funds are ever created, stranded, or lost.

### 2. Chainlink CRE Consensus Engine Tests
Verifies multi-observer quorum calculation, median latency aggregation, and outlier neutralization:

```bash
cd cre/compsentry-workflow
bun test.ts
```

### 3. Frontend Production Build
```bash
cd frontend
npm run build
```

---

## 📊 Envio HyperIndex Setup

The Envio indexer ingests on-chain events from Monad Testnet and exposes a unified GraphQL endpoint:

```bash
cd indexer

# Generate TypeScript types from ABI events and GraphQL schema
pnpm codegen

# Start local indexer development instance
pnpm start
```

### Key Graph Entities
- **`SLAContract`**: Tracks remaining escrow, remaining bond, current epoch, and status.
- **`EpochSettlement`**: Historical log of P95 latency, availability, rebate paid, and bond slashed.
- **`Incident`**: Automatic breach logging for SLA violations.
- **`Provider`**: Aggregates the Provider Reliability Index (PRI) and Collateral Utilization Ratio (CUR).

---

## 📜 License

MIT License. Open source for the Monad & Chainlink ecosystem.
