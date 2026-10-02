import { createObserverServer } from "../observer-common";

const PORT = parseInt(process.env.PROVIDER_OBSERVER_PORT || "4001", 10);
const app = createObserverServer("observer-provider", PORT, 1000);

app.listen(PORT, () => {
  console.log(`[Observer Provider] Running at http://localhost:${PORT}`);
});
