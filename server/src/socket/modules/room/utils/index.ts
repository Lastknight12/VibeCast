import { Static } from "@sinclair/typebox/build/cjs/type/static";
import { Router } from "mediasoup/node/lib/types";
import { createRoomSchema } from "../handlers/createRoom";
import { rooms } from "src/state/roomState";
import { PeersMap } from "src/lib/dataTypes/peersMap";
import { cloudinary } from "src/lib/cloudinary";
import { logger } from "src/lib/logger";
import { CustomSocket } from "src/socket/core";
import { Server } from "socket.io";

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

export async function leaveRoom(
  userId: string,
  roomId: string,
  socket: CustomSocket,
  io: Server
) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error("room not found for given id");
  }

  room.peers.delete(userId);
  socket.data.user.roomId = undefined;
  io.to(roomId).emit("userDisconnect", userId);
  if (room.type === "public") {
    io.emit("userLeftRoom", roomId, userId);
  }

  if (room.peers.size === 0) {
    rooms.delete(roomId);

    if (room.type === "public") {
      io.emit("roomDeleted", roomId);
    }
  }

  try {
    await cloudinary.api.delete_resources_by_prefix(`thumbnails/${roomId}`);
    await cloudinary.api.delete_folder(`thumbnails/${roomId}`);
  } catch (error) {
    logger.error(error);
  }
}
