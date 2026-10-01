import evaluatorApp from "./evaluator/server";
import { createObserverServer } from "./observer-common";

const EVALUATOR_PORT = 4000;
const OBSERVER_1_PORT = 4001;
const OBSERVER_2_PORT = 4002;
const OBSERVER_3_PORT = 4003;

console.log("==========================================");
console.log("🚀 Starting CompSentry Telemetry Services ");
console.log("==========================================");

evaluatorApp.listen(EVALUATOR_PORT, () => {
  console.log(`[1/4] Evaluator running on http://localhost:${EVALUATOR_PORT}`);
});

const obs1 = createObserverServer("observer-provider", OBSERVER_1_PORT, 2500);
obs1.listen(OBSERVER_1_PORT, () => {
  console.log(`[2/4] Observer 1 (Provider) running on http://localhost:${OBSERVER_1_PORT}`);
});

const obs2 = createObserverServer("observer-independent", OBSERVER_2_PORT, 2500);
obs2.listen(OBSERVER_2_PORT, () => {
  console.log(`[3/4] Observer 2 (Independent Probe) running on http://localhost:${OBSERVER_2_PORT}`);
});

const obs3 = createObserverServer("observer-secondary", OBSERVER_3_PORT, 2500);
obs3.listen(OBSERVER_3_PORT, () => {
  console.log(`[4/4] Observer 3 (Secondary Monitor) running on http://localhost:${OBSERVER_3_PORT}`);
  console.log("==========================================");
  console.log("✅ All Telemetry & Observer Services Active");
  console.log("==========================================");
});
