import { Type } from "@sinclair/typebox";
import { createWebRtcTransport } from "../sfu.utils";
import {
  DtlsParameters,
  IceCandidate,
  IceParameters,
} from "mediasoup/node/lib/types";
import { SctpParameters } from "mediasoup/node/lib/types";
import { CustomSocket } from "src/types/socket";
import { rooms } from "src/lib/roomState";
import { SocketError } from "src/socket/core";
import { errors } from "../../shared/errors";
import { logger } from "src/lib/logger";

interface Result {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
  sctpParameters: SctpParameters | undefined;
}

const createTransportSchema = Type.Object({
  type: Type.Union([Type.Literal("send"), Type.Literal("recv")]),
});
export default function (socket: CustomSocket) {
  socket.customOn({
    event: "createTransport",
    config: {
      schema: createTransportSchema,

      protected: true,
    },
    handler: async (input): Promise<Result> => {
      const { user } = socket.data;
      if (!user.roomName) {
        throw new SocketError(errors.room.USER_NOT_IN_ROOM);
      }

      const room = rooms.get(user.roomName);
      if (!room) {
        throw new SocketError(errors.room.NOT_FOUND);
      }

      const peer = room.peers.get(user.id);
      if (!peer) {
        throw new SocketError(errors.room.USER_NOT_IN_ROOM);
      }

      try {
        const transport = await createWebRtcTransport(room.router);
        if (input.type === "send") {
          peer.transports.send = transport;
        } else {
          peer.transports.recv = transport;
        }

        return {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
          sctpParameters: transport.sctpParameters,
        };
      } catch (error) {
        logger.error(`Error creating transport: ${error}`);
        // TODO: add unknown error in enum or smth like that

        throw new SocketError({
          code: "UNKNOWN_ERROR",
          message: "Error creating transport",
        });
      }
    },
  });
}
