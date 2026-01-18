import { Type } from "@sinclair/typebox";
import { rooms } from "src/state/roomState";
import { CustomSocket, SocketError } from "src/socket/core";
import { ApiRoomErrors } from "../../room/errors";
import { ApiSfuErrors } from "../errors";

const connectTransportSchema = Type.Object({
  dtlsParameters: Type.Object({
    role: Type.Optional(Type.String({ nullable: true })),
    fingerprints: Type.Array(
      Type.Object({
        algorithm: Type.String(),
        value: Type.String(),
      }),
      { minItems: 1 },
    ),
  }),
  type: Type.Union([Type.Literal("send"), Type.Literal("recv")]),
});

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "connectTransport",
    config: {
      schema: connectTransportSchema,
      protected: true,
    },
    handler: async (input, cb) => {
      const { user } = input.context;
      if (!user.roomId) {
        throw new SocketError(ApiRoomErrors.USER_NOT_IN_ROOM);
      }

      const room = rooms.get(user.roomId);
      if (!room) throw new SocketError(ApiRoomErrors.NOT_FOUND);

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(ApiRoomErrors.USER_NOT_IN_ROOM);
      }

      const { data } = input;

      switch (data.type) {
        case "send": {
          if (!peer.transports.send) {
            throw new SocketError(ApiSfuErrors.transport.NOT_FOUND);
          }

          await peer.transports.send.connect({
            dtlsParameters: data.dtlsParameters,
          });

          break;
        }
        case "recv": {
          if (!peer.transports.recv) {
            throw new SocketError(ApiSfuErrors.transport.NOT_FOUND);
          }

          await peer.transports.recv.connect({
            dtlsParameters: data.dtlsParameters,
          });

          break;
        }
      }

      cb({ data: { connected: true } });
    },
  });
}
