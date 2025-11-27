import { Worker } from "mediasoup/node/lib/types";
import promClient from "prom-client";
import register from "./registry";
import { logger } from "../logger";

// exporter.js

// 1. Пам'ять: Максимальний Resident Set Size (фактично використана фізична RAM)
const workerMaxRss = new promClient.Gauge({
  name: "mediasoup_worker_max_rss_bytes",
  help: "Maximum resident set size (physical RAM used) in bytes.",
  labelNames: ["workerId", "workerPid"],
  registers: [register],
});

// 2. I/O: Блокові операції читання/запису
const workerIoOperations = new promClient.Gauge({
  name: "mediasoup_worker_io_operations_total",
  help: "Block input/output operations count.",
  labelNames: ["workerId", "workerPid", "type"], // 'type' буде 'input' або 'output'
  registers: [register],
});

// 3. Перемикання контексту: важливо для виявлення проблем планувальника
const workerContextSwitches = new promClient.Gauge({
  name: "mediasoup_worker_context_switches_total",
  help: "Voluntary and involuntary context switches.",
  labelNames: ["workerId", "workerPid", "type"], // 'type' буде 'voluntary' або 'involuntary'
  registers: [register],
});

const workerCpuTime = new promClient.Gauge({
  name: "mediasoup_worker_cpu_time_ms_total",
  help: "Total CPU time (user + system) used by the worker (in ms).",
  labelNames: ["workerId", "workerPid"],
  registers: [register],
});

export async function collectWorkersMetrics(workers: Worker[]) {
  if (!workers || workers.length === 0) return;

  const results = await Promise.allSettled(
    workers.map((worker) => worker.getResourceUsage())
  );

  workers.forEach((worker, index) => {
    const result = results[index];

    if (result.status === "fulfilled") {
      const stats = result.value;
      const workerId = index + 1;
      const workerPid = worker.pid;

      // --- 1. CPU Time (Накопичувальний лічильник) ---
      const totalCpuTimeMs = stats.ru_utime + stats.ru_stime;
      workerCpuTime.set({ workerId }, totalCpuTimeMs);

      // --- 2. Пам'ять (ru_maxrss) ---
      // ru_maxrss зазвичай вимірюється в кілобайтах (залежно від ОС),
      // переводимо в байти, щоб відповідати загальноприйнятому стандарту
      workerMaxRss.set({ workerId, workerPid }, stats.ru_maxrss);

      // --- 3. I/O Операції (ru_inblock, ru_oublock) ---
      workerIoOperations.set(
        { workerId, workerPid, type: "input" },
        stats.ru_inblock
      );
      workerIoOperations.set(
        { workerId, workerPid, type: "output" },
        stats.ru_oublock
      );

      // --- 4. Перемикання контексту (ru_nvcsw, ru_nivcsw) ---
      workerContextSwitches.set(
        { workerId, workerPid, type: "voluntary" },
        stats.ru_nvcsw
      );
      workerContextSwitches.set(
        { workerId, workerPid, type: "involuntary" },
        stats.ru_nivcsw
      );
    } else {
      logger.error(
        `Failed to get stats for worker ${worker.pid}:`,
        result.reason
      );
    }
  });

  return register;
}
