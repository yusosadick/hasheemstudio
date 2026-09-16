import { loadEnv } from "./env.js";
loadEnv();

import { startDispatcher } from "./dispatcher.js";
import { startReconciler } from "./reconciler.js";
import { startWorker } from "./queue.js";
import { processJob } from "./processor.js";

startDispatcher();
startReconciler();
const worker = startWorker(processJob);

worker.on("failed", (job, err) => {
  console.error(`bullmq job ${job?.id} failed:`, err.message);
});
worker.on("completed", (job) => {
  console.log(`bullmq job ${job.id} completed`);
});

console.log("hasheemstudio worker started: dispatcher polling outbox, BullMQ worker listening");
