import { Type } from "@sinclair/typebox";
import { rooms } from "src/state/roomState";
import { SocketError } from "src/socket/core";
import { CustomSocket } from "src/socket/core";
import ApiRoomError from "../../room/utils/errors";
import ApiSfuError from "../utils/errors";

const connectTransportSchema = Type.Object({
  dtlsParameters: Type.Object({
    role: Type.Optional(Type.String({ nullable: true })),
    fingerprints: Type.Array(
      Type.Object({
        algorithm: Type.String(),
        value: Type.String(),
      }),
      { minItems: 1 }
    ),
  }),
  type: Type.String({ minLength: 1 }),
});

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "connectTransport",
    config: {
      schema: connectTransportSchema,
      protected: true,
      expectCb: true,
    },
    handler: async (input, cb) => {
      const { user } = socket.data;
      if (!user.roomId) {
        throw new SocketError(ApiRoomError.USER_NOT_IN_ROOM);
      }
      const room = rooms.get(user.roomId);
      if (!room) throw new SocketError(ApiRoomError.NOT_FOUND);

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(ApiRoomError.USER_NOT_IN_ROOM);
      }

      switch (input.type) {
        case "send": {
          if (!peer.transports.send) {
            throw new SocketError(ApiSfuError.transport.NOT_FOUND);
          }

          await peer.transports.send.connect({
            dtlsParameters: input.dtlsParameters,
          });

          break;
        }
        case "recv": {
          if (!peer.transports.recv) {
            throw new SocketError(ApiSfuError.transport.NOT_FOUND);
          }

          await peer.transports.recv.connect({
            dtlsParameters: input.dtlsParameters,
          });

          break;
        }
      }

      cb({ data: { connected: true } });
    },
  });
}
