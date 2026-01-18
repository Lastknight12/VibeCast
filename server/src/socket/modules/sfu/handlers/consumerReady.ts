import { Type } from "@sinclair/typebox";
import { rooms } from "src/state/roomState";
import { CustomSocket, SocketError } from "src/socket/core";
import { ApiRoomErrors } from "../../room/errors";
import { ApiSfuErrors } from "../errors";

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
    handler: (input, cb) => {
      const { user } = input.context;
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

      const { data } = input;

      const peerConsumer = peer.consumers.get(data.id);
      if (!peerConsumer) {
        throw new SocketError(ApiSfuErrors.consumer.NOT_FOUND);
      }

      peerConsumer.resume();
      cb({ data: null });
    },
  });
}
