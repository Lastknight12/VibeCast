import {
  MediaKind,
  RtpCapabilities,
  RtpParameters,
} from "mediasoup/node/lib/types";
import { CustomSocket } from "src/socket/core";
import { rooms } from "src/state/roomState";
import { Type } from "@sinclair/typebox";
import { HandlerCallback, SocketError } from "src/socket/core";
import ApiRoomError from "../../room/utils/errors";
import ApiSfuError from "../utils/errors";

const rtpCodecCapabilitySchema = Type.Object({
  kind: Type.Union([Type.Literal("audio"), Type.Literal("video")]),
  mimeType: Type.String(),
  preferredinputType: Type.Optional(Type.Number()),
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

interface Result {
  id: string;
  producerId: string;
  kind: MediaKind;
  rtpParameters: RtpParameters;
}

export default function (socket: CustomSocket) {
  socket.customOn({
    event: "consume",
    config: {
      schema: consumeSchema,
      protected: true,
      expectCb: true,
    },
    handler: async (input, cb: HandlerCallback<Result>) => {
      const { user } = socket.data;
      if (!user.roomId) {
        throw new SocketError(ApiRoomError.USER_NOT_IN_ROOM);
      }

      const room = rooms.get(user.roomId);
      if (!room) throw new SocketError(ApiRoomError.NOT_FOUND);
      if (
        !room.router.canConsume({
          producerId: input.producerId,
          rtpCapabilities: input.rtpCapabilities as RtpCapabilities,
        })
      ) {
        throw new SocketError(ApiSfuError.router.CANNOT_CONSUME_PRODUCER);
      }

      const peer = room.peers.get(user.id);
      if (!peer) throw new SocketError(ApiRoomError.USER_NOT_IN_ROOM);
      if (!peer.transports.recv)
        throw new SocketError(ApiSfuError.transport.NOT_FOUND);

      const consumer = await peer.transports.recv.consume({
        producerId: input.producerId,
        rtpCapabilities: input.rtpCapabilities as RtpCapabilities,
        paused: true,
      });
      peer.consumers.set(consumer.id, consumer);

      cb({
        data: {
          id: consumer.id,
          producerId: input.producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        },
      });

      console.log(`consumed ${input.producerId}`);
    },
  });
}
