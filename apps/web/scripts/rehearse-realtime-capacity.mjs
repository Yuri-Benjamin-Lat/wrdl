import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const clientCount = Number(process.env.WRDL_REALTIME_CLIENTS ?? 100);
const batchSize = Number(process.env.WRDL_REALTIME_BATCH_SIZE ?? 20);
const batchDelayMs = Number(process.env.WRDL_REALTIME_BATCH_DELAY_MS ?? 250);
const holdMs = Number(process.env.WRDL_REALTIME_HOLD_MS ?? 10_000);

if (!supabaseUrl || !publishableKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.",
  );
}
if (!Number.isInteger(clientCount) || clientCount < 1 || clientCount > 100) {
  throw new Error("WRDL_REALTIME_CLIENTS must be an integer from 1 to 100.");
}
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
  throw new Error("WRDL_REALTIME_BATCH_SIZE must be an integer from 1 to 100.");
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const percentile = (values, fraction) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
};

const runId = randomUUID();
const topic = `m10-capacity-${runId}`;
const clients = [];
const joinLatencies = [];
const receivedBy = new Set();

function openClient(index) {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  const channel = client.channel(topic, {
    config: { broadcast: { self: true }, private: false },
  });
  channel.on("broadcast", { event: "probe" }, ({ payload }) => {
    if (payload?.runId === runId) receivedBy.add(index);
  });
  clients.push({ channel, client });

  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const timeout = setTimeout(
      () => reject(new Error(`Client ${index + 1} join timed out.`)),
      15_000,
    );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        joinLatencies.push(performance.now() - startedAt);
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timeout);
        reject(new Error(`Client ${index + 1} failed with ${status}.`));
      }
    });
  });
}

try {
  console.log(
    `Opening ${clientCount} independent Realtime connections in batches of ${batchSize}.`,
  );
  for (let offset = 0; offset < clientCount; offset += batchSize) {
    const count = Math.min(batchSize, clientCount - offset);
    await Promise.all(Array.from({ length: count }, (_, index) => openClient(offset + index)));
    if (offset + count < clientCount) await delay(batchDelayMs);
  }

  await delay(500);
  const broadcastResult = await clients[0].channel.send({
    type: "broadcast",
    event: "probe",
    payload: { runId },
  });
  if (broadcastResult !== "ok") throw new Error(`Realtime probe returned ${broadcastResult}.`);

  const deliveryDeadline = Date.now() + 5_000;
  while (receivedBy.size < clientCount && Date.now() < deliveryDeadline) await delay(50);
  await delay(holdMs);

  const deliveryRate = (receivedBy.size / clientCount) * 100;
  console.log(`Connected: ${joinLatencies.length}/${clientCount}`);
  console.log(
    `Join latency: p50 ${percentile(joinLatencies, 0.5).toFixed(0)} ms; p95 ${percentile(joinLatencies, 0.95).toFixed(0)} ms; max ${Math.max(...joinLatencies).toFixed(0)} ms`,
  );
  console.log(`Probe delivery: ${receivedBy.size}/${clientCount} (${deliveryRate.toFixed(1)}%)`);
  if (joinLatencies.length !== clientCount || deliveryRate < 99) {
    throw new Error("Realtime rehearsal did not meet the 99% success gate.");
  }
  console.log("Realtime capacity rehearsal passed.");
} finally {
  await Promise.allSettled(clients.map(({ channel, client }) => client.removeChannel(channel)));
  for (const { client } of clients) client.realtime.disconnect();
}
