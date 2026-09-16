import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { requireEnv } from "./env.js";

export const QUEUE_NAME = "hasheemstudio-jobs";

export function redisConnection(): ConnectionOptions {
  return {
    host: "127.0.0.1",
    port: Number(requireEnv("REDIS_PORT")),
    password: requireEnv("REDIS_PASSWORD"),
    maxRetriesPerRequest: null,
  };
}

export function getQueue(): Queue {
  return new Queue(QUEUE_NAME, { connection: redisConnection() });
}

export function startWorker(processor: (jobId: string) => Promise<void>): Worker {
  return new Worker(
    QUEUE_NAME,
    async (job) => {
      await processor(job.data.jobId as string);
    },
    { connection: redisConnection(), concurrency: 1 },
  );
}
