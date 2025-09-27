import { Type } from "@sinclair/typebox";
import { CustomSocket } from "src/socket/core";
import { rooms } from "src/state/roomState";
import { SocketError } from "src/socket/core";
import ApiSfuError from "../utils/errors";
import ApiRoomError from "../../room/utils/errors";
import { logger } from "src/lib/logger";

const closeProducerSchema = Type.Object({
  id: Type.String(),
});

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "closeConsumer",
    config: {
      schema: closeProducerSchema,
      protected: true,
    },
    handler(input) {
      const { user } = socket.data;
      if (!user.roomId) {
        throw new SocketError(ApiRoomError.USER_NOT_IN_ROOM);
      }

      const room = rooms.get(user.roomId);
      if (!room) {
        throw new SocketError(ApiRoomError.NOT_FOUND);
      }

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(ApiRoomError.USER_NOT_IN_ROOM);
      }

      const consumer = peer.consumers.get(input.id);
      if (!consumer) {
        throw new SocketError(ApiSfuError.consumer.NOT_FOUND);
      }

      consumer.close();
      peer.consumers.delete(input.id);
      logger.info(peer.consumers);
    },
  });
}
