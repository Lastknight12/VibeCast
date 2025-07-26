import { Static, Type } from "@sinclair/typebox";
import sfuModule from "..";
import { createWebRtcTransport } from "../sfu.utils";
import { ErrorCb, HandlerInput } from "src/socket/core";
import {
  DtlsParameters,
  IceCandidate,
  IceParameters,
} from "mediasoup/node/lib/types";
import { SctpParameters } from "mediasoup/node/lib/types";

const createTransportSchema = Type.Object({
  type: Type.Union([Type.Literal("send"), Type.Literal("recv")]),
});

type Data = HandlerInput<{
  payload: Static<typeof createTransportSchema>;
  cb: (
    result:
      | {
          id: string;
          iceParameters: IceParameters;
          iceCandidates: IceCandidate[];
          dtlsParameters: DtlsParameters;
          sctpParameters: SctpParameters | undefined;
        }
      | Parameters<ErrorCb>[0]
  ) => void;
}>;

sfuModule.defineSocketHandler({
  event: "createTransport",
  config: {
    schema: createTransportSchema,
    expectCb: true,
    protected: true,
  },
  handler: async (ctx, params: Data) => {
    const { socket, rooms } = ctx;
    const { cb, payload } = params;

    const { user } = socket.data;
    if (!user.roomName) {
      console.log("User not joined room");
      return;
    }

    const room = rooms.get(user.roomName);
    if (!room) {
      return cb({ error: "Room not found" });
    }

    const peer = room.peers.get(user.id);
    if (!peer) {
      console.log(`Peer not found in room ${user.roomName}`);
      return;
    }

    try {
      const transport = await createWebRtcTransport(room.router);
      if (payload.type === "send") {
        peer.transports.send = transport;
      } else {
        peer.transports.recv = transport;
      }

      cb({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
      });
    } catch (error) {
      console.log(`Error creating transport: ${error}`);
      cb({ error: "Error creating transport" });
    }
  },
});
