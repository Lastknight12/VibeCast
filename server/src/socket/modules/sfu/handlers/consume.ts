import { Static, Type } from "@sinclair/typebox";
import sfuModule from "..";
import { ErrorCb, HandlerInput } from "src/socket/core";
import {
  MediaKind,
  RtpCapabilities,
  RtpParameters,
} from "mediasoup/node/lib/types";

const rtpCodecCapabilitySchema = Type.Object({
  kind: Type.Union([Type.Literal("audio"), Type.Literal("video")]),
  mimeType: Type.String(),
  preferredPayloadType: Type.Optional(Type.Number()),
  clockRate: Type.Number(),
  channels: Type.Optional(Type.Number()),
  parameters: Type.Optional(Type.Record(Type.String(), Type.Any())),
  rtcpFeedback: Type.Optional(
    Type.Array(
      Type.Object({
        type: Type.String(),
        parameter: Type.Optional(Type.String()),
      })
    )
  ),
});

const rtpHeaderExtensionSchema = Type.Object({
  kind: Type.Union([Type.Literal("audio"), Type.Literal("video")]),
  uri: Type.String(),
  preferredId: Type.Number(),
  preferredEncrypt: Type.Optional(Type.Boolean()),
  direction: Type.Optional(
    Type.Union([
      Type.Literal("sendrecv"),
      Type.Literal("sendonly"),
      Type.Literal("recvonly"),
      Type.Literal("inactive"),
    ])
  ),
});

const rtpCapabilitiesSchema = Type.Object({
  codecs: Type.Array(rtpCodecCapabilitySchema),
  headerExtensions: Type.Array(rtpHeaderExtensionSchema),
  fecMechanisms: Type.Optional(Type.Array(Type.String())),
});

const consumeSchema = Type.Object({
  producerId: Type.String({ minLength: 1 }),
  rtpCapabilities: rtpCapabilitiesSchema,
});

type Data = HandlerInput<{
  payload: Static<typeof consumeSchema>;
  cb: (
    data:
      | {
          id: string;
          producerId: string;
          kind: MediaKind;
          rtpParameters: RtpParameters;
        }
      | Parameters<ErrorCb>[0]
  ) => void;
}>;

sfuModule.defineSocketHandler({
  event: "consume",
  config: {
    schema: consumeSchema,
    expectCb: true,
    protected: true,
  },
  handler: async (ctx, params: Data) => {
    const { socket, rooms } = ctx;
    const { payload, cb } = params;

    const { user } = socket.data;
    if (!user.roomName) {
      console.log("User not joined room");
      return;
    }

    const room = rooms.get(user.roomName);
    if (!room) return cb({ error: "Room not found" });
    if (
      !room.router.canConsume({
        producerId: payload.producerId,
        rtpCapabilities: payload.rtpCapabilities as RtpCapabilities,
      })
    ) {
      return cb({ error: "Can't consume" });
    }

    const peer = room.peers.get(user.id);
    if (!peer) return cb({ error: "Peer not found" });
    if (!peer.transports.recv) return cb({ error: "Transport not found" });

    const consumer = await peer.transports.recv.consume({
      producerId: payload.producerId,
      rtpCapabilities: payload.rtpCapabilities as RtpCapabilities,
      paused: true,
    });
    peer.consumers.set(consumer.id, consumer);

    cb({
      id: consumer.id,
      producerId: payload.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    });
  },
});
