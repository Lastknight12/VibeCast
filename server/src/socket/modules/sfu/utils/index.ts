import { Router } from "mediasoup/node/lib/RouterTypes";
import { rooms } from "src/state/roomState";
import { env } from "src/config";
import { logger } from "src/lib/logger";

export async function createWebRtcTransport(router: Router) {
  const transport = await router.createWebRtcTransport({
    listenInfos: [
      {
        protocol: "udp",
        ip: "0.0.0.0",
        announcedIp: env.ANNOUNCED_IP,
        portRange: {
          min: +env.MIN_MEDIASOUP_PORT,
          max: +env.MAX_MEDIASOUP_PORT,
        },
      },
    ],
    enableUdp: true,
    preferUdp: true,
  });
  return transport;
}

export function getRoomRouter(roomId: string): Router | null {
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }

  return room.router;
}

export function closeRelatedConsumers(
  producerIds: string[],
  roomId: string,
  onConsumerClosed?: (consumerId: string) => void
) {
  const room = rooms.get(roomId);
  if (!room) {
    logger.error("Room not found");
    return;
  }

  const producerIdsSet = new Set(producerIds);

  for (const [_, peer] of room.peers) {
    for (const [consumerId, consumer] of peer.consumers.entries()) {
      if (producerIdsSet.has(consumer.producerId)) {
        consumer.close();
        peer.consumers.delete(consumerId);
        onConsumerClosed?.(consumerId);
      }
    }
  }
}
