# CompSentry Demo Compute Provider

Lightweight, stateless mock AI inference provider for SLA verification on Monad Testnet and Chainlink CRE consensus.

## Endpoints

- `GET /health` — Cloud Run health probe & active scenario status
- `GET /status` — Service uptime & scenario details
- `POST /inference` — Simulates LLM inference request
- `POST /v1/chat/completions` — OpenAI/vLLM compatible inference endpoint
- `GET /admin/scenario` — Returns current scenario
- `POST /admin/scenario` — Switches scenario (`NORMAL`, `HIGH_LATENCY`, `OUTAGE`). Requires `x-admin-key: <DEMO_ADMIN_KEY>` if configured.

## Local Development

```bash
pnpm install
pnpm dev
```

## Cloud Run Deployment

```bash
gcloud run deploy compsentry-provider \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 256Mi \
  --cpu 0.5 \
  --set-env-vars DEMO_ADMIN_KEY=your_secret_demo_key
```
