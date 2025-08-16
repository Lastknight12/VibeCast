import { Type } from "@sinclair/typebox";
import { CustomSocket } from "src/types/socket";
import { rooms } from "src/lib/roomState";
import { SocketError } from "src/socket/core";
import { errors } from "../../errors";
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
      if (!user.roomName) {
        throw new SocketError(errors.room.USER_NOT_IN_ROOM);
      }

      const room = rooms.get(user.roomName);
      if (!room) {
        throw new SocketError(errors.room.NOT_FOUND);
      }

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(errors.room.USER_NOT_IN_ROOM);
      }

      const consumer = peer.consumers.get(input.id);
      if (!consumer) {
        throw new SocketError(errors.mediasoup.consumer.NOT_FOUND);
      }

      consumer.close();
      peer.consumers.delete(input.id);
      logger.info(peer.consumers);
    },
  });
}
