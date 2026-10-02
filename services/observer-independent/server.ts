import { createObserverServer } from "../observer-common";

const PORT = parseInt(process.env.INDEPENDENT_PROBE_PORT || "4002", 10);
const app = createObserverServer("observer-independent", PORT, 1000);

app.listen(PORT, () => {
  console.log(`[Observer Independent Probe] Running at http://localhost:${PORT}`);
});
