import { Static } from "@sinclair/typebox/build/cjs/type/static";
import { Router } from "mediasoup/node/lib/types";
import { createRoomSchema } from "../handlers/createRoom";
import { rooms } from "src/state/roomState";
import { PeersMap } from "src/lib/dataTypes/peersMap";

export function createRoom(
  router: Router,
  roomType: Static<typeof createRoomSchema.properties.roomType>,
  name: string
) {
  const uuid = crypto.randomUUID();

  if (rooms.has(uuid)) {
    const uuid = createRoom(router, roomType, name);
    return uuid;
  }

  rooms.set(uuid, {
    name,
    router,
    peers: new PeersMap(),
    type: roomType,
  });

  return uuid;
}
