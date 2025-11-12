import client from "prom-client";
import register from "./registry";
import { rooms as roomsState } from "src/state/roomState";

const roomCount = new client.Gauge({
  name: "mediasoup_room_count",
  help: "Total number of active rooms.",
  registers: [register],
});

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

const producerCount = new client.Gauge({
  name: "mediasoup_producer_count",
  help: "Total number of active Producers (video, audio, video_audio).",
  labelNames: ["type"],
  registers: [register],
});

const consumerCount = new client.Gauge({
  name: "mediasoup_consumer_count",
  help: "Total number of active Consumers.",
  labelNames: ["kind"],
  registers: [register],
});

export const collectUserMetrics = (rooms: typeof roomsState) => {
  roomCount.reset();
  peerCount.reset();
  producerCount.reset();
  consumerCount.reset();

  let totalPeers = 0;
  const totalProducers = { audio: 0, video: 0, video_audio: 0 };
  const totalConsumers = { audio: 0, video: 0 };

  for (const [_roomId, room] of rooms.entries()) {
    totalPeers += room.peers.size;

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

  roomCount.set(rooms.size);
  peerCount.set(totalPeers);

  producerCount.set({ type: "audio" }, totalProducers.audio);
  producerCount.set({ type: "video" }, totalProducers.video);
  producerCount.set({ type: "video_audio" }, totalProducers.video_audio);

  consumerCount.set({ kind: "video" }, totalConsumers.video);
  consumerCount.set({ kind: "audio" }, totalConsumers.audio);
};
