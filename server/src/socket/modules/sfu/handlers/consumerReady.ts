import { Type } from "@sinclair/typebox";
import { rooms } from "src/state/roomState";
import { SocketError } from "src/socket/core";
import { CustomSocket } from "src/socket/core";
import { ApiRoomErrors } from "../../room/utils/errors";
import { ApiSfuErrors } from "../utils/errors";

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

      const peerConsumer = peer.consumers.get(data.id);
      if (!peerConsumer) {
        throw new SocketError(ApiSfuErrors.consumer.NOT_FOUND);
      }

      peerConsumer.resume();
      cb({ data: null });
    },
  });
}
