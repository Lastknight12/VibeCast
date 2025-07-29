import { Type } from "@sinclair/typebox";
import { rooms } from "src/lib/roomState";
import { SocketError } from "src/socket/core";
import { CustomSocket } from "src/types/socket";
import { errors } from "../../shared/errors";

const consumerReadySchema = Type.Object({
  id: Type.String({ minLength: 1 }),
});

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "consumerReady",
    config: {
      schema: consumerReadySchema,
      protected: true,
    },
    handler: (input) => {
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

      const peerConsumer = peer.consumers.get(input.id);
      if (!peerConsumer) {
        throw new SocketError(errors.mediasoup.consumer.NOT_FOUND);
      }

      peerConsumer.resume();
    },
  });
}
