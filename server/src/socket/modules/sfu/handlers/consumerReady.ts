import { Type } from "@sinclair/typebox";
import { rooms } from "src/state/roomState";
import { SocketError } from "src/socket/core";
import { CustomSocket } from "src/socket/core";
import ApiRoomError from "../../room/utils/errors";
import ApiSfuError from "../utils/errors";

const consumerReadySchema = Type.Object({
  id: Type.String({ minLength: 1 }),
});

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "consumerReady",
    config: {
      schema: consumerReadySchema,
      protected: true,
      expectCb: true,
    },
    handler: (input, cb) => {
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

      const peerConsumer = peer.consumers.get(input.id);
      if (!peerConsumer) {
        throw new SocketError(ApiSfuError.consumer.NOT_FOUND);
      }

      peerConsumer.resume();
      cb({ data: null });
    },
  });
}
