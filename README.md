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

# Note:
# - Leave CRE_ENV unset (or set CRE_ENV=local) for local installs with local observers (reads config.json).
# - Set CRE_ENV=online ONLY when connecting to Google Cloud Run hosted observers (reads config.online.json).
```

Create `.env.local` in `frontend/`:
```bash
NEXT_PUBLIC_HUB_ADDRESS=0x0fD55d06B382C72d8b95f5Bf9Ae1682D079B79bB
NEXT_PUBLIC_CONTROLLER_ADDRESS=0x8ef7455e8d01C85Af8ed9CFcc0274f4125737e2f
NEXT_PUBLIC_VAULT_ADDRESS=0xFF3260a3aab725b4BbBf9A94A57A5718196E5a73
NEXT_PUBLIC_MOCK_USDC_ADDRESS=0xF35e93EaeE4c6dCfA24eb0BD6aE1164c8a0ffB64

# For local development with local services:
NEXT_PUBLIC_INDEXER_GRAPHQL_URL=http://localhost:8080/v1/graphql
NEXT_PUBLIC_EVALUATOR_URL=http://localhost:4000

# Or for hosted production endpoints:
# NEXT_PUBLIC_INDEXER_GRAPHQL_URL=https://indexer.bigdevenergy.link/09ef97e/v1/graphql
# NEXT_PUBLIC_EVALUATOR_URL=https://compsentry-provider-961098530006.asia-south1.run.app
```

---

## 🏃 Running the Protocol

You can run CompSentry in either a **Fully Local Setup** (local observers and telemetry server) or an **Online Setup** (hosted Cloud Run observers).

---

### Option A: Fully Local Setup (Local Observers & Telemetry)

#### 1. Start Local Telemetry Evaluator & 3 Observers

You can run the full telemetry stack natively or via Docker containers:

**Method 1: Native Node / TSX (Recommended)**
```bash
cd services
pnpm install
pnpm start:all
```
This single command spins up:
- **Evaluator / Compute Simulator**: `http://localhost:4000` (handles mock inference & scenario controls)
- **Observer 1**: `http://localhost:4001`
- **Observer 2**: `http://localhost:4002`
- **Observer 3**: `http://localhost:4003`

**Method 2: Docker Containers**
```bash
# Start local compute provider
cd services/compute-provider
docker build -t compsentry-provider .
docker run -d -p 4000:8080 -e PORT=8080 compsentry-provider

# Start the 3 independent observer probe containers
cd ../observer
docker build -t compsentry-observer .
docker run -d -p 4001:8080 -e OBSERVER_ID=observer-1 -e PROVIDER_URL=http://host.docker.internal:4000 compsentry-observer
docker run -d -p 4002:8080 -e OBSERVER_ID=observer-2 -e PROVIDER_URL=http://host.docker.internal:4000 compsentry-observer
docker run -d -p 4003:8080 -e OBSERVER_ID=observer-3 -e PROVIDER_URL=http://host.docker.internal:4000 compsentry-observer
```

#### 2. Start the Frontend Dashboard
```bash
cd frontend
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to activate compute rentals and view the live dashboard.

#### 3. Run the Autonomous CRE Settlement Engine (Local Mode)
For local installations, do **not** set `CRE_ENV=online`. Omitting `CRE_ENV` automatically directs CRE to `config.json` (`http://localhost:4001-4003/telemetry`):

```bash
cd cre/compsentry-workflow

# Runs continuously across the full rental duration (settling every 30s):
CRE_CONTRACT=0x<CONTRACT_ID> bun run-epoch
```

---

### Option B: Online / Cloud Run Setup (Hosted Observers)

If you are using the live Google Cloud Run observers:

```bash
cd cre/compsentry-workflow

# Specifies config.online.json pointing to Cloud Run observer URLs:
CRE_CONTRACT=0x<CONTRACT_ID> CRE_ENV=online bun run-epoch
```

---

### ⚡ Outage & SLA Breach Injection (GUI-Driven)

Outage and thermal throttling simulations are triggered directly from the **Dashboard GUI**:
1. Open your active rental in the **SLA Cockpit** on the frontend.
2. Under **Scenario Controls**, click **High Latency** (simulates GPU thermal throttling, ~440ms P95 latency) or **Outage** (simulates CUDA OOM / HTTP 503).
3. The observers continuously query the compute provider and detect the real degraded metrics.
4. When the next 30-second epoch window concludes, Chainlink CRE queries the observers, confirms consensus on the SLA breach, and submits the settlement transaction to Monad to execute buyer rebates and bond slashing automatically.

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
