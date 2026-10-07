# CompSentry Independent Observer Probe

Stateless, lightweight telemetry probe designed to run across multiple Cloud Run instances or edge regions to independently monitor AI compute SLA compliance for Chainlink CRE consensus.

## Endpoints

- `GET /health` — Probe status, configuration, and target provider URL
- `GET /telemetry` — Executes concurrent measurement burst against provider, computes P95 latency and availability, and returns structured `ObserverTelemetry`
- `GET /telemetry/:contractId` — Scoped telemetry for a specific SLA contract
- `POST /admin/desync` — Injects intentional latency bias to test Chainlink CRE Byzantine fault tolerance & outlier neutralization

## Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `OBSERVER_ID` | Unique probe identifier (e.g. `observer-1`, `observer-2`) | `observer-1` |
| `PROVIDER_URL` | Public HTTPS URL of the compute provider | `http://localhost:8080` |
| `PORT` | Listening port (Cloud Run sets this to 8080) | `8080` |
| `SAMPLE_SIZE` | Number of concurrent probes per measurement cycle | `15` |
| `DESYNC_LATENCY_OFFSET_MS` | Artificial latency addition (for BFT testing) | `0` |

## Local Run

```bash
pnpm install
OBSERVER_ID=observer-1 PROVIDER_URL=http://localhost:8080 PORT=8081 pnpm dev
```

## Cloud Run Deployment

All 3 observers use this identical container image, changing only `OBSERVER_ID` and `PROVIDER_URL`:

```bash
# Observer 1
gcloud run deploy compsentry-observer-1 \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 256Mi \
  --cpu 0.5 \
  --set-env-vars OBSERVER_ID=observer-1,PROVIDER_URL=https://compsentry-provider-xxx.run.app

# Observer 2
gcloud run deploy compsentry-observer-2 \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 256Mi \
  --cpu 0.5 \
  --set-env-vars OBSERVER_ID=observer-2,PROVIDER_URL=https://compsentry-provider-xxx.run.app

# Observer 3
gcloud run deploy compsentry-observer-3 \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 256Mi \
  --cpu 0.5 \
  --set-env-vars OBSERVER_ID=observer-3,PROVIDER_URL=https://compsentry-provider-xxx.run.app
```
