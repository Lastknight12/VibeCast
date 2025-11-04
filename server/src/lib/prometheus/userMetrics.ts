import client from "prom-client";
import register from "./registry";
import { rooms as roomsState } from "src/state/roomState";

const roomCount = new client.Gauge({
  name: "mediasoup_room_count",
  help: "Total number of active rooms.",
  registers: [register],
});

// 2. Кількість користувачів (Peers)
const peerCount = new client.Gauge({
  name: "mediasoup_peer_count",
  help: "Total number of peers (users) across all rooms.",
  registers: [register],
});

export const usersOnlineMetric = new client.Gauge({
  name: "total_users_online",
  help: "Total number of users connected to socket (online)",
  registers: [register],
});

// 3. Кількість Продюсерів
const producerCount = new client.Gauge({
  name: "mediasoup_producer_count",
  help: "Total number of active Producers (video, audio, video_audio).",
  labelNames: ["type"],
  registers: [register],
});

// 4. Кількість Консюмерів
const consumerCount = new client.Gauge({
  name: "mediasoup_consumer_count",
  help: "Total number of active Consumers.",
  labelNames: ["kind"],
  registers: [register],
});

export const collectUserMetrics = (rooms: typeof roomsState) => {
  // 1. Скидаємо лічильники для гарантії актуальності (якщо кімнати/об'єкти зникають)
  roomCount.reset();
  peerCount.reset();
  producerCount.reset();
  consumerCount.reset();

  let totalPeers = 0;
  const totalProducers = { audio: 0, video: 0, video_audio: 0 };
  const totalConsumers = { audio: 0, video: 0 };

  for (const [_roomId, room] of rooms.entries()) {
    totalPeers += room.peers.size;

    // Підрахунок Продюсерів та Консюмерів
    for (const [_peerId, peer] of room.peers.entries()) {
      const producers = peer.producers;
      if (producers.audio) {
        totalProducers.audio += 1;
      }

      if (producers.screenShare) {
        if (producers.screenShare.video) {
          totalProducers.video += 1;
        }

        if (producers.screenShare.audio) {
          totalProducers.video_audio += 1;
        }
      }
      for (const [_id, consumer] of peer.consumers.entries()) {
        totalConsumers[consumer.kind] += 1;
      }
    }
  }

  // 2. Встановлюємо загальні значення
  roomCount.set(rooms.size);
  peerCount.set(totalPeers);

  // 3. Встановлюємо значення з мітками
  producerCount.set({ type: "audio" }, totalProducers.audio);
  producerCount.set({ type: "video" }, totalProducers.video);
  producerCount.set({ type: "video_audio" }, totalProducers.video_audio);

  consumerCount.set(
    { kind: "audio" },
    totalConsumers.audio + totalConsumers.video
  );
  consumerCount.set({ kind: "video" }, totalConsumers.video);
  consumerCount.set({ kind: "audio" }, totalConsumers.audio);
};
