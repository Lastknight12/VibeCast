import { createWorker } from "mediasoup";
import { Worker } from "mediasoup/node/lib/types";
import os from "node:os";
import { logger } from "./logger";

export const workers: Worker[] = [];
let nextMediasoupWorkerIdx = 0;

export function getMediasoupWorker(): Worker {
  const worker = workers[nextMediasoupWorkerIdx];
  nextMediasoupWorkerIdx = (nextMediasoupWorkerIdx + 1) % workers.length;
  return worker;
}

export async function createMediasoupWorkers() {
  const numCpus = os.cpus().length;

  for (let i = 0; i < numCpus; i++) {
    const worker = await createWorker({
      logLevel: "debug",
      logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
    });
    worker.on("died", (data) => {
      console.error(
        `Mediasoup worker #${i} died, exiting in 2 seconds. ${data}`
      );
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
  }

  logger.info(`${numCpus} mediasoup workers spawned`);
}
