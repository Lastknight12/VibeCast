import { Static, Type } from "@sinclair/typebox";
import sfuModule from "..";
import { ErrorCb, HandlerInput } from "src/socket/core";

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

type Data = HandlerInput<{
  payload: Static<typeof connectTransportSchema>;
  cb: (data: { connected: boolean } | Parameters<ErrorCb>[0]) => void;
}>;

sfuModule.defineSocketHandler({
  event: "connectTransport",
  config: {
    schema: connectTransportSchema,
    expectCb: true,
  },
  handler: async (ctx, params: Data) => {
    const { rooms, socket } = ctx;
    const { payload, cb } = params;

    const { user } = socket.data;
    if (!user.roomName) {
      cb({ error: "User not joined room" });
      return;
    }
    const room = rooms.get(user.roomName);
    if (!room) return cb({ error: "Room not found" });

    const peer = room.peers.get(user.id);
    if (!peer) return cb({ error: "Peer not found" });

    switch (payload.type) {
      case "send": {
        if (!peer.transports.send) {
          cb({ error: "Transport not found" });
          return;
        }

        await peer.transports.send.connect({
          dtlsParameters: payload.dtlsParameters,
        });

        cb({ connected: true });
        return;
      }
      case "recv": {
        if (!peer.transports.recv) {
          cb({ error: "Transport not found" });
          return;
        }

        await peer.transports.recv.connect({
          dtlsParameters: payload.dtlsParameters,
        });

        cb({ connected: true });
        return;
      }
    }
  },
});
