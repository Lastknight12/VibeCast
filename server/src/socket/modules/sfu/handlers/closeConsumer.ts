import { Type } from "@sinclair/typebox";
import { rooms } from "src/state/roomState";
import { SocketError, CustomSocket } from "src/socket/core";
import { ApiSfuErrors } from "../utils/errors";
import { ApiRoomErrors } from "../../room/utils/errors";

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
      const { data } = input;
      const { user } = socket.data;
      if (!user.roomId) {
        throw new SocketError(ApiRoomErrors.USER_NOT_IN_ROOM);
      }

      const room = rooms.get(user.roomId);
      if (!room) {
        throw new SocketError(ApiRoomErrors.NOT_FOUND);
      }

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(ApiRoomErrors.USER_NOT_IN_ROOM);
      }

      const consumer = peer.consumers.get(data.id);
      if (!consumer) {
        throw new SocketError(ApiSfuErrors.consumer.NOT_FOUND);
      }

      consumer.close();
      peer.consumers.delete(data.id);
    },
  });
}
