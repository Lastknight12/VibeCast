import { Router } from "mediasoup/node/lib/RouterTypes";
import { rooms } from "src/lib/roomState";
import { env } from "src/config";
import { logger } from "src/lib/logger";

export async function createWebRtcTransport(router: Router) {
  const ips = env.ANNOUNCED_IPS.split(",");
  const listenIps = ips.map((ip) => {
    return {
      ip: "0.0.0.0",
      announcedIp: ip,
    };
  });

  logger.info(`Announced IPs: ${JSON.stringify(listenIps)}`);

  const transport = await router.createWebRtcTransport({
    listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });
  return transport;
}

export function getRoomRouter(roomName: string): Router | null {
  const room = rooms.get(roomName);
  if (!room) {
    return null;
  }

  return room.router;
}

export function closeRelatedConsumers(
  producerIds: string[],
  roomName: string,
  onConsumerClosed?: (consumerId: string) => void
) {
  const room = rooms.get(roomName);
  if (!room) {
    console.log("Room not found");
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
