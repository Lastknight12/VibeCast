import { Type } from "@sinclair/typebox";
import { rooms } from "src/lib/roomState";
import { SocketError } from "src/socket/core";
import { CustomSocket } from "src/types/socket";
import { errors } from "../../errors";

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
      if (!user.roomName) {
        throw new SocketError(errors.room.USER_NOT_IN_ROOM);
      }
      const room = rooms.get(user.roomName);
      if (!room) throw new SocketError(errors.room.NOT_FOUND);

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(errors.room.USER_NOT_IN_ROOM);
      }

      switch (input.type) {
        case "send": {
          if (!peer.transports.send) {
            throw new SocketError(errors.mediasoup.transport.NOT_FOUND);
          }

          await peer.transports.send.connect({
            dtlsParameters: input.dtlsParameters,
          });

          break;
        }
        case "recv": {
          if (!peer.transports.recv) {
            throw new SocketError(errors.mediasoup.transport.NOT_FOUND);
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
