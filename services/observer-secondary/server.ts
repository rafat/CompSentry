import { createObserverServer } from "../observer-common";

const PORT = parseInt(process.env.SECONDARY_OBSERVER_PORT || "4003", 10);
const app = createObserverServer("observer-secondary", PORT, 1000);

app.listen(PORT, () => {
  console.log(`[Observer Secondary Monitor] Running at http://localhost:${PORT}`);
});
